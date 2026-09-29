/**
 * API Route: SMB Files (file manager)
 * GET    ?connection_id&path=            - Download de arquivo
 * POST   multipart (connection_id, path, file) - Upload de arquivo
 * POST   JSON {connection_id, action: 'mkdir'|'rename', path, newName?}
 * DELETE ?connection_id&path=&isDirectory=     - Excluir arquivo ou pasta
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAdmin } from '@/lib/api-auth';
import { createServiceFromConfig, getMimeType, SmbService, LocalFsService } from '@/lib/smbService';

export const dynamic = 'force-dynamic';

interface SmbConnectionRecord {
    id: string;
    base_path?: string;
    [key: string]: unknown;
}

/** Resolve o path requisitado dentro do base_path da conexão (bloqueia "..") */
function resolvePath(conn: SmbConnectionRecord, subPath: string): string {
    const clean = subPath.replace(/^[/\\]+|[/\\]+$/g, '');
    if (clean.split(/[/\\]/).includes('..')) {
        throw new Error('Caminho inválido: ".." não é permitido');
    }
    const base = (conn.base_path || '').replace(/^[/\\]+|[/\\]+$/g, '');
    return base ? (clean ? `${base}/${clean}` : base) : clean;
}

async function loadConnection(id: string): Promise<SmbConnectionRecord | null> {
    const { data, error } = await supabaseAdmin
        .from('smb_connections')
        .select('*')
        .eq('id', id)
        .single();
    return error || !data ? null : data;
}

function err(message: string, status: number = 500) {
    return NextResponse.json({ success: false, error: message }, { status });
}

// GET - Download de arquivo
export const GET = withAdmin(async (request: NextRequest) => {
    let service: SmbService | LocalFsService | null = null;
    try {
        const { searchParams } = new URL(request.url);
        const connectionId = searchParams.get('connection_id');
        const filePath = searchParams.get('path');
        if (!connectionId || !filePath) {
            return err('connection_id e path são obrigatórios', 400);
        }

        const conn = await loadConnection(connectionId);
        if (!conn) return err('Conexão não encontrada', 404);

        service = createServiceFromConfig(conn as any);
        const data = await service.readFile(resolvePath(conn, filePath));

        const name = filePath.split(/[/\\]/).pop() || 'arquivo';
        return new NextResponse(new Uint8Array(data), {
            headers: {
                'Content-Type': getMimeType(name),
                'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
                'Content-Length': String(data.length),
            },
        });
    } catch (error: any) {
        return err(error.message);
    } finally {
        service?.disconnect();
    }
});

// POST - Upload (multipart) ou ações mkdir/rename (JSON)
export const POST = withAdmin(async (request: NextRequest) => {
    let service: SmbService | LocalFsService | null = null;
    try {
        const contentType = request.headers.get('content-type') || '';

        if (contentType.includes('multipart/form-data')) {
            // Upload
            const form = await request.formData();
            const connectionId = String(form.get('connection_id') || '');
            const dirPath = String(form.get('path') || '');
            const file = form.get('file');
            if (!connectionId || !(file instanceof File)) {
                return err('connection_id e file são obrigatórios', 400);
            }

            const conn = await loadConnection(connectionId);
            if (!conn) return err('Conexão não encontrada', 404);

            const targetDir = resolvePath(conn, dirPath);
            const target = targetDir ? `${targetDir}/${file.name}` : file.name;

            service = createServiceFromConfig(conn as any);
            const buffer = Buffer.from(await file.arrayBuffer());
            await service.writeFile(target, buffer);

            return NextResponse.json({ success: true, data: { path: target, size: buffer.length } });
        }

        // Ações JSON
        const body = await request.json();
        const { connection_id: connectionId, action, path: targetPath, newName } = body || {};
        if (!connectionId || !action || !targetPath) {
            return err('connection_id, action e path são obrigatórios', 400);
        }

        const conn = await loadConnection(connectionId);
        if (!conn) return err('Conexão não encontrada', 404);

        service = createServiceFromConfig(conn as any);
        const resolved = resolvePath(conn, String(targetPath));

        if (action === 'mkdir') {
            await service.mkdir(resolved);
            return NextResponse.json({ success: true, data: { path: resolved } });
        }

        if (action === 'rename') {
            if (!newName || String(newName).includes('/') || String(newName).includes('\\')) {
                return err('newName inválido (somente o nome, sem pastas)', 400);
            }
            const parent = resolved.split('/').slice(0, -1).join('/');
            const newPath = parent ? `${parent}/${newName}` : String(newName);
            await service.rename(resolved, newPath);
            return NextResponse.json({ success: true, data: { path: newPath } });
        }

        return err(`Ação desconhecida: ${action}`, 400);
    } catch (error: any) {
        return err(error.message);
    } finally {
        service?.disconnect();
    }
});

// DELETE - Excluir arquivo ou pasta
export const DELETE = withAdmin(async (request: NextRequest) => {
    let service: SmbService | LocalFsService | null = null;
    try {
        const { searchParams } = new URL(request.url);
        const connectionId = searchParams.get('connection_id');
        const targetPath = searchParams.get('path');
        const isDirectory = searchParams.get('isDirectory') === 'true';
        if (!connectionId || !targetPath) {
            return err('connection_id e path são obrigatórios', 400);
        }

        const conn = await loadConnection(connectionId);
        if (!conn) return err('Conexão não encontrada', 404);

        service = createServiceFromConfig(conn as any);
        const resolved = resolvePath(conn, targetPath);
        await service.delete(resolved, isDirectory);

        return NextResponse.json({ success: true, data: { path: resolved } });
    } catch (error: any) {
        return err(error.message);
    } finally {
        service?.disconnect();
    }
});
