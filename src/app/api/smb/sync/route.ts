/**
 * API Route: SMB Sync
 * POST - Sincroniza arquivos do SMB para Supabase Storage + library_items
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAdmin } from '@/lib/api-auth';
import { createServiceFromConfig, getMimeType, SmbService, LocalFsService } from '@/lib/smbService';

export const dynamic = 'force-dynamic';
// Increase timeout for sync operations
export const maxDuration = 60;

export const POST = withAdmin(async (request: NextRequest) => {
    let service: SmbService | LocalFsService | null = null;

    try {
        const body = await request.json();
        const { connection_id } = body;

        if (!connection_id) {
            return NextResponse.json(
                { error: 'connection_id é obrigatório' },
                { status: 400 }
            );
        }

        // Load connection
        const { data: conn, error: connError } = await supabaseAdmin
            .from('smb_connections')
            .select('*')
            .eq('id', connection_id)
            .single();

        if (connError || !conn) {
            return NextResponse.json(
                { error: 'Conexão não encontrada' },
                { status: 404 }
            );
        }

        // Create sync log entry
        const { data: syncLog, error: logError } = await supabaseAdmin
            .from('smb_sync_log')
            .insert({
                connection_id,
                status: 'running',
                started_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (logError) {
            console.error('Error creating sync log:', logError);
        }

        service = createServiceFromConfig(conn);

        // List all files recursively from base_path
        const basePath = conn.base_path || '';
        const files = await service.listAllFiles(basePath);

        let filesSynced = 0;
        let filesFailed = 0;
        let filesSkipped = 0;
        const errors: string[] = [];

        const category = conn.sync_target_category || 'Políticas Internas';

        for (const file of files) {
            try {
                // Skip hidden/temp files
                if (file.name.startsWith('.') || file.name.startsWith('~$') || file.name === 'Thumbs.db' || file.name === 'desktop.ini') {
                    filesSkipped++;
                    continue;
                }

                // Check if this file was already synced (by checking metadata in library_items)
                const smbRelativePath = file.path;
                const { data: existing } = await supabaseAdmin
                    .from('library_items')
                    .select('id, metadata')
                    .eq('metadata->>smb_source', smbRelativePath)
                    .eq('metadata->>smb_connection_id', connection_id)
                    .maybeSingle();

                if (existing) {
                    filesSkipped++;
                    continue;
                }

                // Download file from SMB/Local
                const fileData = await service.readFile(file.path);

                // Generate a safe storage path
                const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
                const storagePath = `smb-sync/${connection_id}/${Date.now()}_${safeName}`;
                const mimeType = getMimeType(file.name);

                // Upload to Supabase Storage — bucket canônico da biblioteca
                const bucket = 'library-assets';
                const { error: uploadError } = await supabaseAdmin
                    .storage
                    .from(bucket)
                    .upload(storagePath, fileData, {
                        contentType: mimeType,
                        upsert: true
                    });

                if (uploadError) {
                    errors.push(`Upload falhou para ${file.name}: ${uploadError.message}`);
                    filesFailed++;
                    continue;
                }

                // Get the public URL
                const { data: urlData } = supabaseAdmin
                    .storage
                    .from(bucket)
                    .getPublicUrl(storagePath);

                // Determine file type
                const ext = file.name.split('.').pop()?.toLowerCase();
                let fileType = 'document';
                if (['pdf'].includes(ext || '')) fileType = 'pdf';
                else if (['jpg', 'jpeg', 'png', 'gif', 'svg'].includes(ext || '')) fileType = 'image';
                else if (['mp4', 'avi', 'mov'].includes(ext || '')) fileType = 'video';
                else if (['xls', 'xlsx', 'csv'].includes(ext || '')) fileType = 'document';

                // Create slug from filename
                const slug = file.name
                    .replace(/\.[^/.]+$/, '') // Remove extension
                    .replace(/[^a-zA-Z0-9\s-]/g, '')
                    .trim()
                    .replace(/\s+/g, '-')
                    .toLowerCase()
                    + '-' + Date.now().toString(36);

                // Create library_items entry
                const { error: insertError } = await supabaseAdmin
                    .from('library_items')
                    .insert({
                        title: file.name.replace(/\.[^/.]+$/, ''), // Remove extension for title
                        slug,
                        description: `Documento sincronizado de ${conn.name} — ${category}`,
                        type: fileType,
                        content_url: urlData.publicUrl,
                        is_active: true,
                        metadata: {
                            smb_source: smbRelativePath,
                            smb_connection_id: connection_id,
                            smb_connection_name: conn.name,
                            category,
                            original_filename: file.name,
                            mime_type: mimeType,
                            synced_at: new Date().toISOString(),
                        },
                    });

                if (insertError) {
                    errors.push(`Falha ao criar item para ${file.name}: ${insertError.message}`);
                    filesFailed++;
                } else {
                    filesSynced++;
                }

            } catch (fileError: any) {
                errors.push(`Erro em ${file.name}: ${fileError.message}`);
                filesFailed++;
                console.error(fileError);
            }
        }

        // Update sync log
        const status = filesFailed > 0 ? 'completed_with_errors' : 'completed';

        if (syncLog) {
            await supabaseAdmin
                .from('smb_sync_log')
                .update({
                    status,
                    files_synced: filesSynced,
                    files_failed: filesFailed,
                    files_skipped: filesSkipped,
                    error_message: errors.length > 0 ? errors.join('\n') : null,
                    completed_at: new Date().toISOString(),
                })
                .eq('id', syncLog.id);
        }

        // Update connection status
        await supabaseAdmin
            .from('smb_connections')
            .update({
                last_sync_at: new Date().toISOString(),
                last_sync_status: status,
                last_sync_files_count: filesSynced,
                last_sync_error: errors.length > 0 ? errors[0] : null,
                updated_at: new Date().toISOString(),
            })
            .eq('id', connection_id);

        return NextResponse.json({
            status,
            files_synced: filesSynced,
            files_failed: filesFailed,
            files_skipped: filesSkipped,
            total_files: files.length,
            errors: errors.length > 0 ? errors : undefined,
        });

    } catch (error: any) {
        return NextResponse.json(
            { error: error.message, status: 'failed' },
            { status: 500 }
        );
    } finally {
        service?.disconnect();
    }
});

// GET - Get sync history
export const GET = withAdmin(async (request: NextRequest) => {
    try {
        const { searchParams } = new URL(request.url);
        const connectionId = searchParams.get('connection_id');

        let query = supabaseAdmin
            .from('smb_sync_log')
            .select('*')
            .order('started_at', { ascending: false })
            .limit(20);

        if (connectionId) {
            query = query.eq('connection_id', connectionId);
        }

        const { data, error } = await query;

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data || []);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
});
