import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { authenticateUser } from '@/lib/api-auth';
import { denyUnlessCan, loadContractAccess } from '@/lib/contracts/view-access';
import { generateSHA256 } from '@/lib/services/CryptographyService';

export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

// POST — Upload a PDF document (HR only)
export async function POST(request: NextRequest) {
    try {
        const { user, error: authError } = await authenticateUser(request);
        if (authError) return authError;
        if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

        const denied = denyUnlessCan(await loadContractAccess(user), 'create');
        if (denied) return denied;

        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const titulo = formData.get('titulo') as string | null;
        const descricao = formData.get('descricao') as string | null;

        if (!file || !titulo) {
            return NextResponse.json({ error: 'Arquivo PDF e título são obrigatórios' }, { status: 400 });
        }

        if (!file.type.includes('pdf')) {
            return NextResponse.json({ error: 'Apenas arquivos PDF são permitidos' }, { status: 400 });
        }

        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json({ error: `Arquivo excede o limite de 25MB` }, { status: 400 });
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const hashOriginal = generateSHA256(buffer);

        // Upload to Supabase Storage
        const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const storagePath = `documentos/${user.id}/${fileName}`;

        const { error: uploadError } = await supabaseAdmin
            .storage
            .from('documentos-trabalhistas')
            .upload(storagePath, buffer, {
                contentType: 'application/pdf',
                upsert: false,
            });

        if (uploadError) {
            console.error('Erro ao fazer upload:', uploadError);
            return NextResponse.json({ error: 'Erro ao fazer upload do arquivo' }, { status: 500 });
        }

        const arquivoUrl = storagePath;

        const { data: documento, error: dbError } = await supabaseAdmin
            .from('documentos_trabalhistas')
            .insert({
                titulo,
                descricao: descricao || null,
                arquivo_url: arquivoUrl,
                arquivo_nome: file.name,
                arquivo_tamanho: file.size,
                hash_original: hashOriginal,
                enviado_por: user.id,
            })
            .select('*')
            .single();

        if (dbError) {
            console.error('Erro ao registrar documento:', dbError);
            return NextResponse.json({ error: 'Erro ao registrar documento' }, { status: 500 });
        }

        return NextResponse.json({ success: true, documento });
    } catch (error) {
        console.error('Erro em POST /api/contracts/upload:', error);
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
    }
}
