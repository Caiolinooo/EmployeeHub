import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { authenticateUser } from '@/lib/api-auth';
import {
    canMutateEnvelope,
    denyUnlessCan,
    getOwnEnvelopeIds,
    loadContractAccess,
} from '@/lib/contracts/view-access';

export const dynamic = 'force-dynamic';

// GET — List contract documents with filters
export async function GET(request: NextRequest) {
    try {
        const { user, error: authError } = await authenticateUser(request);
        if (authError) return authError;
        if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const search = searchParams.get('search');
        const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50') || 50, 1), 200);
        const offset = Math.max(parseInt(searchParams.get('offset') || '0') || 0, 0);
        const id = searchParams.get('id');

        const access = await loadContractAccess(user);
        const { scope, can } = access;
        if (scope === 'none') {
            return NextResponse.json({ error: 'Permissão insuficiente' }, { status: 403 });
        }

        if (id) {
            if (scope !== 'all' && !(await getOwnEnvelopeIds(user)).includes(id)) {
                return NextResponse.json({ error: 'Envelope não encontrado' }, { status: 404 });
            }

            // Single Envelope fetch
            const { data: envelope, error: envError } = await supabaseAdmin
                .from('vw_envelopes_completo')
                .select('*')
                .eq('id', id)
                .single();

            if (envError) {
                return NextResponse.json({ error: 'Envelope não encontrado' }, { status: 404 });
            }

            // Fetch ALL documents belonging to this envelope
            const { data: documentos, error: docError } = await supabaseAdmin
                .from('documentos_trabalhistas')
                .select('*')
                .eq('envelope_id', id)
                .order('data_criacao', { ascending: true });

            if (docError) {
                return NextResponse.json({ error: 'Erro ao carregar documentos do envelope' }, { status: 500 });
            }

            // Fetch ALL assignments for this envelope
            const { data: assignments, error: assignError } = await supabaseAdmin
                .from('solicitacoes_assinatura')
                .select(`
                    id,
                    documento_id,
                    envelope_id,
                    colaborador_id,
                    external_signer_name,
                    external_signer_email,
                    pagina_assinatura,
                    posicao_x,
                    posicao_y,
                    largura_assinatura,
                    altura_assinatura,
                    ordem,
                    status,
                    tipo,
                    token_acesso,
                    valor_preenchido,
                    visualizado_em,
                    created_at,
                    colaborador:users_unified!colaborador_id (
                        id, first_name, last_name, email
                    )
                `)
                .eq('envelope_id', id)
                .order('ordem', { ascending: true });

            // Process pre-signed URLs for ALL documents in the envelope to allow viewer to cycle
            const processedDocuments = await Promise.all((documentos || []).map(async (doc) => {
                // Check if this document has signed steps already
                const { data: lastAudit } = await supabaseAdmin
                    .from('auditoria_assinaturas')
                    .select('arquivo_assinado_url, solicitacoes_assinatura!inner(documento_id)')
                    .eq('solicitacoes_assinatura.documento_id', doc.id)
                    .order('data_assinatura', { ascending: false })
                    .limit(1)
                    .single();

                let finalPathToSign = doc.arquivo_url;
                
                // If it was signed, prioritize the signed path
                const isSigned = !!lastAudit?.arquivo_assinado_url;
                if (isSigned) {
                    finalPathToSign = lastAudit!.arquivo_assinado_url;
                }

                if (!(isSigned ? can.download_signed : can.download)) {
                    return { ...doc, arquivo_url: null };
                }

                let storagePath = finalPathToSign;
                
                if (storagePath.includes('/storage/v1/object/')) {
                    const bucketMarker = '/documentos-trabalhistas/';
                    if (storagePath.includes(bucketMarker)) {
                        const parts = storagePath.split(bucketMarker);
                        storagePath = decodeURIComponent(parts[1]);
                        if (storagePath.includes('?')) {
                            storagePath = storagePath.split('?')[0];
                        }
                    } else {
                        const parts = storagePath.split('/object/public/');
                        if (parts.length > 1) {
                            const pathParts = parts[1].split('/');
                            storagePath = decodeURIComponent(pathParts.slice(1).join('/'));
                        }
                    }
                }

                try {
                    const { data: signedData } = await supabaseAdmin
                        .storage
                        .from('documentos-trabalhistas')
                        .createSignedUrl(storagePath, 3600);

                    return {
                        ...doc,
                        arquivo_url: signedData?.signedUrl || finalPathToSign
                    };
                } catch (e) {
                    return {
                        ...doc,
                        arquivo_url: finalPathToSign
                    };
                }
            }));

            // token_acesso permite assinar como signatário externo: só gestores recebem
            const solicitacoes = (assignments || []).map((s) => (can['signers.manage'] ? s : { ...s, token_acesso: null }));

            return NextResponse.json({
                success: true,
                scope,
                can,
                envelope: envelope,
                // Para compatibilidade com o frontend legado, se for necessário:
                documento: processedDocuments[0] || null, 
                documentos: processedDocuments,
                solicitacoes,
            });
        }

        // List Envelopes
        {
            let query = supabaseAdmin
                .from('vw_envelopes_completo')
                .select('*')
                .neq('status', 'DELETED')
                .order('data_criacao', { ascending: false })
                .range(offset, offset + limit - 1);

            if (scope !== 'all') {
                const ownIds = await getOwnEnvelopeIds(user);
                if (ownIds.length === 0) {
                    return NextResponse.json({ success: true, scope, can, documentos: [] });
                }
                query = query.in('id', ownIds);
            }

            if (status === 'PENDING') {
                query = query.gt('total_pendentes', 0);
            } else if (status === 'SIGNED') {
                query = query.eq('total_pendentes', 0).gt('total_assinados', 0);
            }

            if (search) {
                query = query.ilike('titulo', `%${search}%`);
            }

            const { data, error } = await query;
            if (error) {
                console.error('Erro ao buscar envelopes:', error);
                return NextResponse.json({ error: 'Erro ao buscar envelopes' }, { status: 500 });
            }

            return NextResponse.json({ success: true, scope, can, documentos: data || [] });
        }
    } catch (error) {
        console.error('Erro em GET /api/contracts:', error);
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
    }
}

// DELETE — Soft delete a contract document (HR only)
export async function DELETE(request: NextRequest) {
    try {
        const { user, error: authError } = await authenticateUser(request);
        if (authError) return authError;
        if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

        const access = await loadContractAccess(user);
        const denied = denyUnlessCan(access, 'delete');
        if (denied) return denied;

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });
        if (!(await canMutateEnvelope(user, access, id))) {
            return NextResponse.json({ error: 'Envelope não encontrado' }, { status: 404 });
        }

        // 1. Locate all documents to extract their file paths
        const { data: docs, error: docsErr } = await supabaseAdmin
            .from('documentos_trabalhistas')
            .select('id, arquivo_url')
            .eq('envelope_id', id);

        if (docsErr) {
            return NextResponse.json({ error: 'Erro ao buscar metadados para deleção' }, { status: 500 });
        }

        // 2. Collect all potential storage keys to wipe
        const filesToDelete = new Set<string>();

        const extractPath = (pathOrUrl: string) => {
            if (!pathOrUrl) return null;
            let cleanPath = pathOrUrl;
            if (cleanPath.includes('/storage/v1/object/')) {
                const bucketMarker = '/documentos-trabalhistas/';
                if (cleanPath.includes(bucketMarker)) {
                    cleanPath = decodeURIComponent(cleanPath.split(bucketMarker)[1]);
                } else {
                    const parts = cleanPath.split('/object/public/');
                    if (parts.length > 1) {
                        const pathParts = parts[1].split('/');
                        cleanPath = decodeURIComponent(pathParts.slice(1).join('/'));
                    }
                }
            }
            if (cleanPath.includes('?')) {
                cleanPath = cleanPath.split('?')[0];
            }
            return cleanPath;
        };

        // Extract originals
        (docs || []).forEach(d => {
            const path = extractPath(d.arquivo_url);
            if (path) filesToDelete.add(path);
        });

        // 3. Query any audit records for signed file variants
        if (docs && docs.length > 0) {
            const { data: audits } = await supabaseAdmin
                .from('auditoria_assinaturas')
                .select('arquivo_assinado_url, solicitacoes_assinatura!inner(documento_id)')
                .in('solicitacoes_assinatura.documento_id', docs.map(d => d.id));

            (audits || []).forEach(a => {
                const path = extractPath(a.arquivo_assinado_url);
                if (path) filesToDelete.add(path);
            });
        }

        // 4. Wipe physical files from Supabase Storage
        const filesArray = Array.from(filesToDelete);
        if (filesArray.length > 0) {
            const { error: storageErr } = await supabaseAdmin
                .storage
                .from('documentos-trabalhistas')
                .remove(filesArray);

            if (storageErr) {
                console.error('Aviso: Falha parcial ao limpar Storage:', storageErr);
                // Proceeding anyway, database integrity is priority
            }
        }

        // 5. Hard delete the Envelope from DB
        // Due to pre-configured CASCADE constraint on `documentos_trabalhistas.envelope_id`,
        // deleting this single row automatically kills documents -> requests -> audit logs!
        const { error: deleteErr } = await supabaseAdmin
            .from('envelopes')
            .delete()
            .eq('id', id);

        if (deleteErr) {
            console.error('Erro crítico ao excluir envelope:', deleteErr);
            return NextResponse.json({ error: 'Falha ao deletar registro do banco de dados' }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: 'Envelope e arquivos excluídos permanentemente' });
    } catch (error) {
        console.error('Erro crítico em DELETE /api/contracts:', error);
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
    }
}
