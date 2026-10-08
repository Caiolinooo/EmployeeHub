import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { authenticateUser } from '@/lib/api-auth';
import { loadContractAccess } from '@/lib/contracts/view-access';

export const dynamic = 'force-dynamic';

// POST — Generate secure access to sign a document (used by both authenticated and public signers)
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { documento_id } = body;

        if (!documento_id) {
            return NextResponse.json({
                error: 'Campo obrigatório: documento_id'
            }, { status: 400 });
        }

        const { user, error: authError } = await authenticateUser(request);
        if (authError || !user) {
            // Acesso público é só via token: GET /api/contracts/sign-access/[token]
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
        }

        // Fetch the document
        const { data: documento, error: docError } = await supabaseAdmin
            .from('documentos_trabalhistas')
            .select('*')
            .eq('id', documento_id)
            .single();

        if (docError || !documento) {
            return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 });
        }

        // Escopo `all` + download: acesso direto. Demais só com atribuição existente (sem auto-atribuição)
        const access = await loadContractAccess(user);
        if (!(access.scope === 'all' && access.can.download)) {
            const { data: assignments } = await supabaseAdmin
                .from('solicitacoes_assinatura')
                .select('id, status')
                .eq('documento_id', documento_id)
                .eq('colaborador_id', user.id);

            if (!assignments?.length) {
                return NextResponse.json({ error: 'Documento não atribuído a você' }, { status: 403 });
            }
            if (!assignments.some((a) => a.status === 'PENDING')) {
                return NextResponse.json({
                    error: 'Este documento já foi assinado por você',
                    code: 'ALREADY_SIGNED'
                }, { status: 403 });
            }
        }

        // Generate signed URL for secure PDF access
        let storagePath = documento.arquivo_url;

        if (storagePath.includes('/storage/v1/object/')) {
            const bucketMarker = '/documentos-trabalhistas/';
            if (storagePath.includes(bucketMarker)) {
                const parts = storagePath.split(bucketMarker);
                storagePath = decodeURIComponent(parts[1]);
            } else {
                const parts = storagePath.split('/object/public/');
                if (parts.length > 1) {
                    const pathParts = parts[1].split('/');
                    storagePath = decodeURIComponent(pathParts.slice(1).join('/'));
                }
            }
        }
        // Não alterar o caminho caso seja relativo, pois ele inicia com o prefixo válido 'documentos/'.

        if (!storagePath) {
            return NextResponse.json({
                error: 'Documento não encontrado no storage',
                code: 'STORAGE_ERROR'
            }, { status: 404 });
        }

        const bucket = supabaseAdmin.storage.from('documentos-trabalhistas');

        try {
            const { data: signedData, error: signedError } = await bucket.createSignedUrl(storagePath, 3600);

            if (!signedError && signedData?.signedUrl) {
                return NextResponse.json({
                    success: true,
                    documento: {
                        id: documento.id,
                        titulo: documento.titulo,
                        descricao: documento.descricao,
                        hash_original: documento.hash_original,
                    },
                    pdf_url: signedData.signedUrl,
                    solicitacao_id: null,
                    is_public: false,
                });
            } else {
                console.error('[sign-access] Erro ao gerar URL assinada:', signedError);
                return NextResponse.json({
                    error: `Erro ao acessar documento: ${signedError?.message || 'Erro desconhecido'}`,
                    code: 'STORAGE_ERROR'
                }, { status: 500 });
            }
        } catch (storageError: any) {
            console.error('[sign-access] Erro ao gerar URL assinada:', storageError);
            return NextResponse.json({
                error: `Erro ao acessar documento no storage: ${storageError.message}`,
                code: 'STORAGE_ERROR'
            }, { status: 500 });
        }

    } catch (error) {
        console.error('Erro em POST /api/contracts/sign-access:', error);
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
    }
}