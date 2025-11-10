import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email-gmail';

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function POST(request: Request) {
  try {
    const { reimbursement, status } = await request.json();

    // Validação básica
    if (!reimbursement || !status) {
      return NextResponse.json(
        { error: 'Dados inválidos' },
        { status: 400 }
      );
    }

    // Preparar anexos para o email
    const attachments: any[] = [];
    const subject = `Solicitação de Reembolso ${status === 'APPROVED' ? 'Aprovada' : 'Rejeitada'}`;
    const emailBody = `
      <h1>Status da sua solicitação de reembolso</h1>
      <p>Sua solicitação de reembolso foi ${status === 'APPROVED' ? 'aprovada' : 'rejeitada'}.</p>
      <p>Valor: R$ ${reimbursement.valor}</p>
      <p>Descrição: ${reimbursement.descricao}</p>
    `;

    try {
      // Processar anexos
      if (reimbursement.comprovantes && Array.isArray(reimbursement.comprovantes)) {
        console.log(`Processando ${reimbursement.comprovantes.length} comprovantes`);

        for (const attachment of reimbursement.comprovantes) {
          try {
            // Baixar arquivo do Supabase storage
            const fileName = attachment.url.split('/').pop() || attachment.url;
            console.log(`Baixando anexo: ${fileName}`);

            const { data, error } = await supabaseAdmin
              .storage
              .from('comprovantes')
              .download(fileName);

            if (error) {
              console.error(`Erro ao baixar anexo ${fileName}:`, error);
              continue;
            }

            if (data) {
              console.log(`Anexo baixado com sucesso ${fileName}`);
              const arrayBuffer = await data.arrayBuffer();

              attachments.push({
                filename: attachment.nome,
                content: Buffer.from(arrayBuffer),
                contentType: attachment.tipo || 'application/octet-stream'
              });
            }
          } catch (attachError) {
            console.error('Erro ao processar anexo:', attachError);
          }
        }
      }

      console.log(`Enviando email para ${reimbursement.email} com ${attachments.length} anexos`);

      await sendEmail(
        reimbursement.email,
        subject,
        emailBody, // texto simples (mesmo conteúdo do HTML por enquanto)
        emailBody, // HTML
        { attachments }
      );

      console.log('Email enviado com sucesso');
    } catch (emailError) {
      console.error('Erro ao enviar email:', emailError);
      // Continuar mesmo se o email falhar
    }

    return NextResponse.json({
      success: true,
      message: `Reembolso ${status === 'APPROVED' ? 'aprovado' : 'rejeitado'} com sucesso`
    });
  } catch (error) {
    console.error('Erro ao aprovar reembolso:', error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Helper function to get MIME type from file extension
 */
function getMimeType(extension: string): string {
  const mimeTypes: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  };

  return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
}
