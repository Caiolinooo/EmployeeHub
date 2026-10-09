import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sameSigner, uniqueSignatureDocuments } from '@/lib/contracts/signature-queue';
import { latestAuditForDocument, storagePathFromUrl } from '@/lib/contracts/signed-file';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, props: { params: Promise<{ token: string }> }) {
    const params = await props.params;
    try {
        const { token } = params;

        if (!token) {
            return NextResponse.json({ error: 'Token não fornecido' }, { status: 400 });
        }

        // 1. Fetch the reference solicitation for this token
        const { data: refSols, error: refError } = await supabaseAdmin
            .from('solicitacoes_assinatura')
            .select(`
                *,
                documento:documentos_trabalhistas (*),
                colaborador:users_unified!colaborador_id (email, first_name, last_name, tax_id, birth_date),
                envelope:envelopes!envelope_id (id, titulo, remetente_id)
            `)
            .eq('token_acesso', token);

        if (refError || !refSols || refSols.length === 0) {
            return NextResponse.json({ error: 'Link de assinatura inválido ou expirado' }, { status: 404 });
        }

        const refSol = refSols[0];

        // 2. Todos os campos do envelope. O filtro antigo era só colaborador_id OU e-mail exato:
        // o segundo PDF (mesmo signatário, e-mail com outra capitalização ou vínculo interno x externo) sumia.
        const { data: envelopeSols, error: solError } = await supabaseAdmin
            .from('solicitacoes_assinatura')
            .select(`
                *,
                documento:documentos_trabalhistas (*),
                colaborador:users_unified!colaborador_id (email, first_name, last_name, tax_id, birth_date),
                envelope:envelopes!envelope_id (id, titulo, remetente_id)
            `)
            .eq('envelope_id', refSol.envelope_id)
            .order('ordem', { ascending: true })
            .order('created_at', { ascending: true });

        const solicitacoes = (envelopeSols || []).filter((row) => sameSigner(refSol, row));

        if (solError || !solicitacoes || solicitacoes.length === 0) {
            return NextResponse.json({ error: 'Erro ao buscar solicitações de assinatura' }, { status: 500 });
        }

        // 1.5. Track View & Notify Creator if not viewed before
        // Filter only pending requests that have never been viewed
        const unviewedSolicitacoes = solicitacoes.filter((sol: any) => !sol.visualizado_em && sol.status === 'PENDING');
        
        if (unviewedSolicitacoes.length > 0) {
            const now = new Date().toISOString();
            const unviewedIds = unviewedSolicitacoes.map((sol: any) => sol.id);
            
            // Mark as viewed in DB
            await supabaseAdmin
                .from('solicitacoes_assinatura')
                .update({ visualizado_em: now })
                .in('id', unviewedIds);
                
            // Notify Envelope Creator/Sender about the view
            try {
                const firstSol = unviewedSolicitacoes[0];
                const remetenteId = firstSol.envelope?.remetente_id || firstSol.documento?.enviado_por;
                
                if (remetenteId) {
                    const { sendGlobalNotification } = await import('@/lib/global-notifications');
                    
                    const viewerName = firstSol.colaborador 
                        ? `${firstSol.colaborador.first_name} ${firstSol.colaborador.last_name || ''}`.trim() 
                        : firstSol.external_signer_name;
                        
                    const envelopeTitle = firstSol.envelope?.titulo || 'Envelope de Documentos';
                    
                    await sendGlobalNotification({
                        userId: remetenteId,
                        submodule: 'contratos',
                        type: 'signature_viewed',
                        title: 'Documento visualizado',
                        message: `${viewerName || 'Um signatário'} visualizou os documentos do envelope "${envelopeTitle}".`,
                        actionUrl: `/contratos/${firstSol.envelope_id}`,
                        channels: ['in-app', 'email'],
                        priority: 'low'
                    });
                }
            } catch (notifErr) {
                console.error('Erro ao enviar notificação de visualização:', notifErr);
            }
        }

        // 2. Iterate over all tasks in this batch and generate signed URLs
        const bucket = supabaseAdmin.storage.from('documentos-trabalhistas');
        
        const payload = await Promise.all(solicitacoes.map(async (sol: any) => {
            const doc = sol.documento;
            let currentPdfUrl = null;

            // Check if this document has signed steps already (from a previous signer in the chain)
            const lastAudit = doc?.id ? await latestAuditForDocument(supabaseAdmin, doc.id) : null;

            let finalPathToSign = doc?.arquivo_url;
            
            // Prioritize the accumulated signed file of THIS document only
            if (lastAudit && lastAudit.arquivo_assinado_url) {
                finalPathToSign = lastAudit.arquivo_assinado_url;
            }

            if (finalPathToSign) {
                const storagePath = storagePathFromUrl(finalPathToSign);
                const { data: signedData } = storagePath
                    ? await bucket.createSignedUrl(storagePath, 3600)
                    : { data: null };
                if (signedData?.signedUrl) {
                    currentPdfUrl = signedData.signedUrl;
                } else if (doc?.arquivo_url && doc.arquivo_url !== finalPathToSign) {
                    const originalPath = storagePathFromUrl(doc.arquivo_url);
                    const { data: originalSigned } = originalPath
                        ? await bucket.createSignedUrl(originalPath, 3600)
                        : { data: null };
                    currentPdfUrl = originalSigned?.signedUrl || null;
                }
            }

            const targetEmail = sol.colaborador?.email || sol.external_signer_email;
            const targetName = sol.colaborador 
                ? `${sol.colaborador.first_name} ${sol.colaborador.last_name || ''}`.trim() 
                : sol.external_signer_name;
            const targetTaxId = sol.colaborador?.tax_id || sol.external_signer_tax_id || null;
            const targetBirthDate = sol.colaborador?.birth_date || sol.external_signer_birth_date || null;

            return {
                id: sol.id,
                status: sol.status,
                ordem: sol.ordem,
                tipo: sol.tipo,
                pagina_assinatura: sol.pagina_assinatura,
                posicao_x: sol.posicao_x,
                posicao_y: sol.posicao_y,
                largura_assinatura: sol.largura_assinatura,
                altura_assinatura: sol.altura_assinatura,
                target_email: targetEmail,
                target_name: targetName,
                target_tax_id: targetTaxId,
                target_birth_date: targetBirthDate,
                valor_preenchido: sol.valor_preenchido,
                obrigatorio: sol.obrigatorio !== false,
                documento: {
                    id: doc?.id,
                    titulo: doc?.titulo,
                    descricao: doc?.descricao,
                    hash_original: doc?.hash_original
                },
                pdf_url: currentPdfUrl
            };
        }));

        const documentos = uniqueSignatureDocuments(payload).map((item) => ({
            id: item.documento?.id,
            titulo: item.documento?.titulo,
            pdf_url: item.pdf_url,
        }));

        return NextResponse.json({
            success: true,
            queue: payload,
            documentos,
            file_count: documentos.length,
        });

    } catch (error) {
        console.error('Erro em GET /api/contracts/sign-access/[token]:', error);
        return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }
}
