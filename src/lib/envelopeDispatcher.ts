import { supabaseAdmin } from '@/lib/supabase-admin';
import { sendGlobalNotification } from '@/lib/global-notifications';
import { sendEmail } from '@/lib/email';
import { buildAppUrl } from '@/lib/app-url';
import { baseTemplate } from '@/lib/emailTemplates';
import crypto from 'crypto';

export async function dispatchEnvelopeStage(envelopeId: string) {
    try {
        console.log(`[Dispatcher] Iniciando processamento para envelope ${envelopeId}...`);

        // 1. Obter dados do envelope e documentos associados para compor as mensagens
        const { data: envelope, error: envError } = await supabaseAdmin
            .from('envelopes')
            .select('*')
            .eq('id', envelopeId)
            .single();

        if (envError || !envelope) {
            throw new Error(`Envelope não encontrado: ${envError?.message}`);
        }

        // 2. Obter todas as solicitações de assinatura do envelope ordenadas
        const { data: solicitacoes, error: solError } = await supabaseAdmin
            .from('solicitacoes_assinatura')
            .select(`
                *,
                colaborador:users_unified!colaborador_id (id, first_name, last_name, email)
            `)
            .eq('envelope_id', envelopeId)
            .order('ordem', { ascending: true });

        if (solError) {
            throw new Error(`Erro ao buscar solicitações: ${solError.message}`);
        }

        if (!solicitacoes || solicitacoes.length === 0) {
            console.log('[Dispatcher] Nenhuma solicitação encontrada para este envelope.');
            return { success: true, message: 'Nenhuma solicitação pendente' };
        }

        // 3. Determinar o status atual do envelope (Ignorando observadores CC que não assinam)
        const pendentes = solicitacoes.filter(s => s.status === 'PENDING' && s.tipo !== 'copia');
        
        // Se não houver mais NADA pendente, o envelope foi 100% assinado
        if (pendentes.length === 0) {
            console.log('[Dispatcher] Todos assinaram. Concluindo envelope.');
            await supabaseAdmin
                .from('envelopes')
                .update({ status: 'COMPLETED' })
                .eq('id', envelopeId);
            
            // Notificar criador do sucesso
            if (envelope.remetente_id) {
                await sendGlobalNotification({
                    userId: envelope.remetente_id,
                    submodule: 'contratos',
                    type: 'envelope_completed',
                    title: 'Envelope Concluído! / Envelope Completed!',
                    message: `O envelope "${envelope.titulo}" foi assinado por todas as partes. / The envelope "${envelope.titulo}" has been signed by all parties.`,
                    actionUrl: `/contratos/${envelopeId}`,
                    channels: ['in-app', 'email']
                }).catch(e => console.warn('Erro ao notificar criador sobre conclusão:', e));
            }

            // 2. Notificar observadores (CC) sobre a finalização do envelope
            const observadores = solicitacoes.filter(s => s.tipo === 'copia');
            if (observadores.length > 0) {
                console.log(`[Dispatcher] Notificando ${observadores.length} observadores da conclusão...`);
                for (const obs of observadores) {
                    const email = obs.colaborador?.email || obs.external_signer_email;
                    const name = obs.colaborador?.first_name || obs.external_signer_name || 'Observador';
                    if (email) {
                        const emailText = `Olá ${name} / Hello ${name},\n\nO envelope "${envelope.titulo}" foi concluído e assinado por todos os signatários. / The envelope "${envelope.titulo}" has been completed and signed by all signatories.\n\nAtenciosamente / Best regards,\nABZ Group`;
                        const emailHtml = baseTemplate(`
                            <div style="color: #333; max-width: 600px; font-family: sans-serif;">
                                <h2 style="color: #10b981; border-bottom: 1px solid #eee; padding-bottom: 8px;">Envelope Concluído! / Envelope Completed!</h2>
                                <p>Olá / Hello <strong>${name}</strong>,</p>
                                
                                <div style="margin-top: 15px; border-left: 3px solid #10b981; padding-left: 12px;">
                                    <p style="margin-bottom: 5px;">Informamos que o processo de assinaturas para o envelope <strong>"${envelope.titulo}"</strong> foi finalizado com sucesso por todas as partes.</p>
                                    <p style="font-size: 12px; color: #666;">Você recebeu este e-mail pois foi incluído em cópia para acompanhamento do fluxo.</p>
                                </div>

                                <div style="margin-top: 20px; padding-top: 10px; border-top: 1px dashed #eee; border-left: 3px solid #9ca3af; padding-left: 12px; opacity: 0.85;">
                                    <p style="margin-bottom: 5px;">We inform you that the signature process for the envelope <strong>"${envelope.titulo}"</strong> has been successfully completed by all parties.</p>
                                    <p style="font-size: 12px; color: #666;">You received this email because you were copied to monitor the workflow.</p>
                                </div>
                            </div>
                        `);
                        await sendEmail(email, `Envelope Concluído / Envelope Completed: ${envelope.titulo}`, emailText, emailHtml)
                            .catch(e => console.warn(`[Dispatcher] Falha ao notificar observador ${email} da conclusão:`, e));
                    }
                }
            }

            return { success: true, status: 'COMPLETED' };
        }

        // 4. Encontrar a MENOR ORDEM pendente
        const ordensPendentes = pendentes.map(p => p.ordem || 1);
        const minOrdem = Math.min(...ordensPendentes);

        console.log(`[Dispatcher] Menor ordem pendente identificada: ${minOrdem}`);

        // 5. Obter TODOS os signatários desse estágio (podem ter múltiplos na mesma ordem)
        const signatariosDaVez = pendentes.filter(s => (s.ordem || 1) === minOrdem);
        
        // Uma pessoa = um link, mesmo se um PDF está no id interno e o outro só no e-mail.
        const recipientKeyOf = (s: any) => {
            const email = (s.colaborador?.email || s.external_signer_email || '').trim().toLowerCase();
            if (email) return `email:${email}`;
            if (s.colaborador_id) return `colab:${s.colaborador_id}`;
            return '';
        };
        const uniqueRecipients = Array.from(new Set(signatariosDaVez.map(recipientKeyOf).filter(Boolean)));

        let notifyCount = 0;

        for (const recipientKey of uniqueRecipients) {
            if (!recipientKey) continue;

            // Filtrar registros desse grupo
            const groupForUser = signatariosDaVez.filter(s => recipientKeyOf(s) === recipientKey);
            
            const firstRequest = groupForUser[0];
            
            // Um token para todos os PDFs deste signatário no envelope.
            // Antes só gravava se o primeiro campo estava vazio e só na ordem atual:
            // o segundo arquivo ficava com outro token e o link abria um PDF só.
            let finalToken = firstRequest.token_acesso;
            if (!finalToken) {
                finalToken = crypto.randomUUID();
            }

            const ids = groupForUser.map((s) => s.id).filter(Boolean);
            if (ids.length > 0) {
                await supabaseAdmin
                    .from('solicitacoes_assinatura')
                    .update({ token_acesso: finalToken })
                    .in('id', ids);
            }

            const actionUrl = `/assinatura/${finalToken}`;
            const fullAccessUrl = buildAppUrl(actionUrl);

            // IDENTIFICAR SE É USUÁRIO SISTEMA OU EXTERNO
            if (firstRequest.colaborador_id) {
                // --- FLUXO SISTEMA (Notificação Global) ---
                const user = firstRequest.colaborador;
                if (!user) continue;

                console.log(`[Dispatcher] Enviando notificação sistêmica para ${user.email}`);
                
                await sendGlobalNotification({
                    userId: firstRequest.colaborador_id,
                    submodule: 'contratos',
                    type: 'signature_requested',
                    title: 'Pendência de Assinatura / Signature Pending',
                    message: `Você possui documentos no envelope "${envelope.titulo}" aguardando sua assinatura eletrônica. / You have documents in envelope "${envelope.titulo}" awaiting your electronic signature.`,
                    actionUrl: actionUrl,
                    channels: ['in-app', 'email', 'push'],
                    priority: 'high'
                }).catch(err => {
                    console.error(`[Dispatcher] Falha ao notificar ${user.email}:`, err);
                });
            } else {
                // --- FLUXO EXTERNO (E-mail Direto) ---
                const targetEmail = firstRequest.external_signer_email;
                const targetName = firstRequest.external_signer_name || 'Signatário';
                
                if (!targetEmail) continue;

                console.log(`[Dispatcher] Enviando e-mail direto para ${targetEmail}`);

                const emailText = `Olá ${targetName} / Hello ${targetName},\n\nVocê foi convidado a assinar documentos eletronicamente no envelope "${envelope.titulo}". / You have been invited to electronically sign documents in the envelope "${envelope.titulo}".\n\nAcesse o link para assinar / Access the link to sign:\n${fullAccessUrl}\n\nAtenciosamente / Best regards,\nABZ Group`;
                const emailHtml = baseTemplate(`
                    <div style="color: #333; font-family: sans-serif; max-width: 600px;">
                        <h2 style="border-bottom: 1px solid #eee; padding-bottom: 8px; color: #0066cc;">Solicitação de Assinatura / Signature Request</h2>
                        <p>Olá / Hello <strong>${targetName}</strong>,</p>
                        
                        <div style="margin-top: 15px; border-left: 3px solid #0066cc; padding-left: 12px;">
                            <p style="margin: 0;">Você foi convidado a visualizar e assinar eletronicamente o envelope <strong>"${envelope.titulo}"</strong>.</p>
                        </div>

                        <div style="margin-top: 15px; border-left: 3px solid #9ca3af; padding-left: 12px; opacity: 0.85;">
                            <p style="margin: 0;">You have been invited to view and electronically sign the envelope <strong>"${envelope.titulo}"</strong>.</p>
                        </div>

                        <div style="margin: 30px 0; text-align: center;">
                            <a href="${fullAccessUrl}" style="background-color: #0066cc; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                                Acessar e Assinar / Access and Sign
                            </a>
                        </div>

                        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                        
                        <div style="font-size: 12px; color: #777;">
                            <p style="margin: 3px 0;">Caso o botão não funcione, copie e cole este link no navegador:</p>
                            <p style="margin: 3px 0 10px 0; font-style: italic;">If the button doesn't work, copy and paste this link into your browser:</p>
                            <code style="background: #f3f4f6; padding: 4px 8px; border-radius: 4px; word-break: break-all; display: block; color: #374151;">${fullAccessUrl}</code>
                        </div>
                    </div>
                `);

                await sendEmail(targetEmail, `Solicitação de Assinatura / Signature Request: ${envelope.titulo}`, emailText, emailHtml)
                    .catch(err => console.error(`[Dispatcher] Falha ao enviar e-mail para ${targetEmail}:`, err));
            }

            notifyCount++;
        }

        // Se for o DISPARO INICIAL (status !== 'SENT'), notificar observadores sobre o início
        if (envelope.status !== 'SENT') {
            const observadores = solicitacoes.filter(s => s.tipo === 'copia');
            if (observadores.length > 0) {
                console.log(`[Dispatcher] Notificando ${observadores.length} observadores do início do fluxo...`);
                for (const obs of observadores) {
                    const email = obs.colaborador?.email || obs.external_signer_email;
                    const name = obs.colaborador?.first_name || obs.external_signer_name || 'Observador';
                    if (email) {
                        const emailText = `Olá ${name} / Hello ${name},\n\nVocê foi incluído em cópia para acompanhar o processo de assinatura do envelope "${envelope.titulo}". / You have been copied to monitor the signature process of the envelope "${envelope.titulo}".\n\nVocê receberá uma cópia assim que concluído. / You will receive a copy as soon as it is completed.\n\nAtenciosamente / Best regards,\nABZ Group`;
                        const emailHtml = baseTemplate(`
                            <div style="color: #333; max-width: 600px; font-family: sans-serif;">
                                <h2 style="color: #4f46e5; border-bottom: 1px solid #eee; padding-bottom: 8px;">Acompanhamento / Monitoring</h2>
                                <p>Olá / Hello <strong>${name}</strong>,</p>
                                
                                <div style="margin-top: 15px; border-left: 3px solid #4f46e5; padding-left: 12px;">
                                    <p style="margin-bottom: 5px;">Informamos que você foi incluído em cópia para acompanhar o fluxo de assinaturas do envelope <strong>"${envelope.titulo}"</strong>.</p>
                                    <p style="font-size: 12px; color: #666;">Este é um aviso de acompanhamento. Nenhuma ação é necessária neste momento.</p>
                                </div>

                                <div style="margin-top: 20px; padding-top: 10px; border-top: 1px dashed #eee; border-left: 3px solid #9ca3af; padding-left: 12px; opacity: 0.85;">
                                    <p style="margin-bottom: 5px;">We inform you that you have been copied to monitor the signature workflow for the envelope <strong>"${envelope.titulo}"</strong>.</p>
                                    <p style="font-size: 12px; color: #666;">This is a tracking notification. No action is required at this moment.</p>
                                </div>
                            </div>
                        `);
                        await sendEmail(email, `Acompanhamento / Monitoring: ${envelope.titulo}`, emailText, emailHtml)
                            .catch(e => console.warn(`[Dispatcher] Falha ao notificar observador ${email} do início:`, e));
                    }
                }
            }
        }

        // Atualiza o status do envelope para 'IN_PROGRESS' / 'SENT'
        await supabaseAdmin
            .from('envelopes')
            .update({ status: 'SENT' })
            .eq('id', envelopeId);

        return { 
            success: true, 
            status: 'SENT', 
            stage: minOrdem, 
            notifiedCount: notifyCount 
        };

    } catch (error: any) {
        console.error('[Dispatcher] Erro FATAL no fluxo de despacho:', error);
        return { success: false, error: error.message };
    }
}
