import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { authenticateUser } from '@/lib/api-auth';
import { denyUnlessCan, loadContractAccess } from '@/lib/contracts/view-access';
import { generateSHA256 } from '@/lib/services/CryptographyService';

export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

// POST — Criar envelope com múltiplos PDFs
export async function POST(request: NextRequest) {
    try {
        const { user, error: authError } = await authenticateUser(request);
        if (authError) return authError;
        if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

        const denied = denyUnlessCan(await loadContractAccess(user), 'create');
        if (denied) return denied;

        const formData = await request.formData();
        const tituloEnvelope = formData.get('titulo') as string | null;
        const descricaoEnvelope = formData.get('descricao') as string | null;
        
        const files = formData.getAll('files') as File[];

        if (!tituloEnvelope || files.length === 0) {
            return NextResponse.json({ error: 'Título do envelope e pelo menos um arquivo PDF são obrigatórios' }, { status: 400 });
        }

        // Validações iniciais
        for (const file of files) {
            if (!file.type.includes('pdf')) {
                return NextResponse.json({ error: `Arquivo "${file.name}" não é um PDF válido` }, { status: 400 });
            }
            if (file.size > MAX_FILE_SIZE) {
                return NextResponse.json({ error: `Arquivo "${file.name}" excede o limite de 25MB` }, { status: 400 });
            }
        }

        // 1. Criar o Envelope
        const { data: envelope, error: envError } = await supabaseAdmin
            .from('envelopes')
            .insert({
                titulo: tituloEnvelope,
                descricao: descricaoEnvelope || null,
                remetente_id: user.id,
                status: 'DRAFT'
            })
            .select('*')
            .single();

        if (envError) {
            console.error('Erro ao criar envelope:', envError);
            return NextResponse.json({ error: 'Erro ao registrar o envelope' }, { status: 500 });
        }

        const documentosCriados = [];
        const uploadedPaths: string[] = [];
        // Falha no meio do lote: remove envelope (cascata nos documentos) e os PDFs já enviados
        const rollback = async () => {
            await supabaseAdmin.from('envelopes').delete().eq('id', envelope.id);
            if (uploadedPaths.length > 0) {
                await supabaseAdmin.storage.from('documentos-trabalhistas').remove(uploadedPaths);
            }
        };

        // 2. Iterar nos arquivos, fazer upload e inserir registros na tabela de documentos
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const arrayBuffer = await file.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const hashOriginal = generateSHA256(buffer);

            // Upload para Supabase Storage
            const ts = Date.now();
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
            const fileName = `${ts}_${i}_${safeName}`;
            const storagePath = `documentos/${user.id}/${fileName}`;

            const { error: uploadError } = await supabaseAdmin
                .storage
                .from('documentos-trabalhistas')
                .upload(storagePath, buffer, {
                    contentType: 'application/pdf',
                    upsert: false,
                });

            if (uploadError) {
                console.error(`Erro ao fazer upload do arquivo ${file.name}:`, uploadError);
                await rollback();
                return NextResponse.json({ 
                    error: `Falha no upload do arquivo: ${file.name}. Nenhum envelope foi criado.` 
                }, { status: 500 });
            }
            uploadedPaths.push(storagePath);

            // Inserir documento vinculado ao envelope
            const { data: doc, error: docError } = await supabaseAdmin
                .from('documentos_trabalhistas')
                .insert({
                    envelope_id: envelope.id,
                    titulo: `${file.name.replace('.pdf', '')}`, // Título do doc individual
                    arquivo_url: storagePath,
                    arquivo_nome: file.name,
                    arquivo_tamanho: file.size,
                    hash_original: hashOriginal,
                    enviado_por: user.id,
                    status: 'DRAFT'
                })
                .select('*')
                .single();

            if (docError) {
                console.error('Erro ao registrar documento individual:', docError);
                await rollback();
                return NextResponse.json({ error: `Erro ao vincular o arquivo ${file.name} ao envelope.` }, { status: 500 });
            }

            documentosCriados.push(doc);
        }

        return NextResponse.json({
            success: true,
            envelope,
            documentos: documentosCriados
        });

    } catch (error) {
        console.error('Erro em POST /api/contracts/envelope:', error);
        return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }
}
