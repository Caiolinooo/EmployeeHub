import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { authenticateUser } from '@/lib/api-auth';
import { buildAppUrl } from '@/lib/app-url';
import { baseTemplate } from '@/lib/emailTemplates';
import { sendEmail } from '@/lib/email-service';
import { canMutateEnvelope, denyUnlessCan, loadContractAccess } from '@/lib/contracts/view-access';

export const dynamic = 'force-dynamic';

// POST — Reenvia o link de assinatura (/assinatura/[token]) de uma atribuição pendente do e-mail informado
export async function POST(request: NextRequest) {
    try {
        const { user, error: authError } = await authenticateUser(request);
        if (authError) return authError;
        if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

        const access = await loadContractAccess(user);
        const denied = denyUnlessCan(access, 'send', 'resend');
        if (denied) return denied;

        const body = await request.json();
        const { documento_id, recipient_email } = body;

        if (!documento_id || !recipient_email) {
            return NextResponse.json({ 
                error: 'Campos obrigatórios: documento_id, recipient_email' 
            }, { status: 400 });
        }

        // Get document info
        const { data: doc, error: docError } = await supabaseAdmin
            .from('documentos_trabalhistas')
            .select('id, titulo, envelope_id')
            .eq('id', documento_id)
            .single();

        if (docError || !doc) {
            return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 });
        }
        if (!doc.envelope_id || !(await canMutateEnvelope(user, access, doc.envelope_id))) {
            return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 });
        }

        // Link público = fluxo real por token (/assinatura/[token]) da atribuição pendente deste e-mail
        const { data: pending } = await supabaseAdmin
            .from('solicitacoes_assinatura')
            .select('token_acesso')
            .eq('documento_id', documento_id)
            .eq('status', 'PENDING')
            .neq('tipo', 'copia')
            .not('token_acesso', 'is', null)
            .ilike('external_signer_email', String(recipient_email).trim().replace(/[\\%_]/g, '\\$&'))
            .limit(1)
            .maybeSingle();

        if (!pending?.token_acesso) {
            return NextResponse.json({
                error: 'Nenhuma assinatura pendente com link para este e-mail neste documento. Atribua o signatário e dispare o envelope.',
            }, { status: 404 });
        }
        const signLink = buildAppUrl(`/assinatura/${pending.token_acesso}`);

        // Send email notification
        try {
            const emailText = `Novo documento para assinatura: ${doc.titulo}\n\nAcesse o link para assinar: ${signLink}`;
            const emailHtml = baseTemplate(`
                <div style="color: #333;">
                    <h2 style="color: #1a56db;">Novo documento para assinatura</h2>
                    <p>Olá,</p>
                    <p>Você recebeu um documento que requer sua assinatura eletrônica:</p>
                    <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
                        <strong>Documento:</strong> ${doc.titulo}
                    </div>
                    <p>Clique no botão abaixo para acessar e assinar o documento:</p>
                    <div style="margin: 25px 0;">
                        <a href="${signLink}" style="display: inline-block; background: #1a56db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                            Assinar Documento
                        </a>
                    </div>
                </div>
            `);

            await sendEmail(
                recipient_email,
                `Documento para assinatura: ${doc.titulo}`,
                emailText,
                emailHtml
            );

            return NextResponse.json({ success: true, message: 'E-mail enviado com sucesso' });
        } catch (emailError: any) {
            console.error('Erro ao enviar e-mail:', emailError);
            return NextResponse.json({ 
                error: `Erro ao enviar e-mail: ${emailError.message}` 
            }, { status: 500 });
        }
    } catch (error) {
        console.error('Erro em POST /api/contracts/send-email:', error);
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
    }
}