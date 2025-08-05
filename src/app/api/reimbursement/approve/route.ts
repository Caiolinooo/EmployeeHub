import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { sendEmail } from '@/lib/email';
import { generateReimbursementPDF } from '@/lib/pdf-generator';

/**
 * API endpoint to approve a reimbursement request
 * This endpoint handles the approval of reimbursement requests with proper authentication
 */
export async function POST(request: NextRequest) {
  try {
    console.log('Reimbursement approval request received');

    // Check authentication
    const authHeader = request.headers.get('authorization') || '';
    const token = extractTokenFromHeader(authHeader);

    // If no token is provided, try to get it from the cookie
    let isAuthenticated = false;
    let userId = '';
    let userRole = '';
    let userEmail = '';

    if (token) {
      // Verify token if provided
      const payload = verifyToken(token);
      if (payload) {
        isAuthenticated = true;
        userId = payload.userId;
        userRole = payload.role;
        console.log('User authenticated via token:', userId, 'Role:', userRole);
      }
    } else {
      // Try to get session from Supabase
      const { data: { session } } = await supabaseAdmin.auth.getSession();
      if (session) {
        isAuthenticated = true;
        userId = session.user.id;
        userEmail = session.user.email || '';

        // Get user role from database
        const { data: userData } = await supabaseAdmin
          .from('users')
          .select('role, email')
          .eq('id', userId)
          .single();

        userRole = userData?.role || '';
        userEmail = userData?.email || userEmail;
        console.log('User authenticated via session:', userId, 'Role:', userRole);
      }
    }

    // Check if user is authenticated
    if (!isAuthenticated) {
      console.error('User not authenticated');
      return NextResponse.json(
        { error: 'Token inválido ou expirado' },
        { status: 401 }
      );
    }

    // Check if user has permission to approve reimbursements
    const isAdmin = userRole === 'ADMIN';
    const isManager = userRole === 'MANAGER';

    if (!isAdmin && !isManager) {
      // Check if user has specific permission
      const { data: userPermissions } = await supabaseAdmin
        .from('users')
        .select('accessPermissions')
        .eq('id', userId)
        .single();

      const hasApprovalPermission = userPermissions?.accessPermissions?.features?.reimbursement_approval === true;

      if (!hasApprovalPermission) {
        console.error('User does not have permission to approve reimbursements');
        return NextResponse.json(
          { error: 'Sem permissão para aprovar reembolsos' },
          { status: 403 }
        );
      }
    }

    // Parse request body
    const { id, status, comments } = await request.json();

    if (!id) {
      console.error('Missing reimbursement ID');
      return NextResponse.json(
        { error: 'ID de reembolso não fornecido' },
        { status: 400 }
      );
    }

    if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
      console.error('Invalid status:', status);
      return NextResponse.json(
        { error: 'Status inválido' },
        { status: 400 }
      );
    }

    // Get reimbursement details
    const { data: reimbursement, error: getError } = await supabaseAdmin
      .from('Reimbursement')
      .select('*')
      .eq('id', id)
      .single();

    if (getError || !reimbursement) {
      console.error('Error getting reimbursement:', getError);
      return NextResponse.json(
        { error: 'Reembolso não encontrado' },
        { status: 404 }
      );
    }

    // Update reimbursement status
    const { error: updateError } = await supabaseAdmin
      .from('Reimbursement')
      .update({
        status,
        approvedBy: userEmail,
        approvedAt: new Date().toISOString(),
        comments: comments || null
      })
      .eq('id', id);

    if (updateError) {
      console.error('Error updating reimbursement:', updateError);
      return NextResponse.json(
        { error: 'Erro ao atualizar reembolso' },
        { status: 500 }
      );
    }

    // Send email notification
    try {
      const statusText = status === 'APPROVED' ? 'aprovado' : 'rejeitado';
      const subject = `Solicitação de reembolso ${statusText} - ${reimbursement.protocolo}`;

      // Prepare a more detailed email body with reimbursement information
      let emailBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #0066cc;">Atualização de Solicitação de Reembolso</h2>
          </div>

          <p>Olá ${reimbursement.nome || ''},</p>

          <p>Sua solicitação de reembolso com protocolo <strong>${reimbursement.protocolo}</strong> foi <strong style="color: ${status === 'APPROVED' ? '#28a745' : '#dc3545'};">${statusText}</strong>.</p>

          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <h3 style="margin-top: 0; color: #0066cc;">Detalhes da Solicitação</h3>
            <p><strong>Protocolo:</strong> ${reimbursement.protocolo}</p>
            <p><strong>Data da Solicitação:</strong> ${new Date(reimbursement.created_at).toLocaleDateString('pt-BR')}</p>
            <p><strong>Valor:</strong> R$ ${parseFloat(reimbursement.valor_total || reimbursement.valorTotal || 0).toFixed(2)}</p>
            <p><strong>Tipo:</strong> ${reimbursement.tipo_reembolso || reimbursement.tipoReembolso || 'Não especificado'}</p>
            <p><strong>Status:</strong> <span style="color: ${status === 'APPROVED' ? '#28a745' : '#dc3545'};">${statusText.toUpperCase()}</span></p>
          </div>`;

      if (comments) {
        emailBody += `
          <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #ffc107;">
            <h3 style="margin-top: 0; color: #856404;">Observações</h3>
            <p>${comments}</p>
          </div>`;
      }

      if (status === 'APPROVED') {
        emailBody += `
          <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #28a745;">
            <h3 style="margin-top: 0; color: #155724;">Próximos Passos</h3>
            <p>Sua solicitação foi aprovada e será processada para pagamento conforme o método de pagamento informado.</p>
            <p>O comprovante de aprovação está anexado a este email.</p>
          </div>`;
      }

      emailBody += `
          <p>Para mais detalhes, acesse o <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://painel.groupabz.com'}/reembolso" style="color: #0066cc; text-decoration: none; font-weight: bold;">Painel de Reembolsos</a>.</p>

          <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #e0e0e0;">
            <p style="color: #666; font-size: 12px;">
              Este é um email automático. Por favor, não responda a este email.<br>
              Em caso de dúvidas, entre em contato com o departamento financeiro.
            </p>
            <p style="color: #666;">Atenciosamente,<br>Equipe ABZ Group</p>
          </div>
        </div>
      `;

      // Generate PDF if approved
      const attachments: any[] = [];
      if (status === 'APPROVED') {
        try {
          console.log('Generating PDF for approved reimbursement');
          // Voltar a usar generateReimbursementPDF com os parâmetros corretos
          const pdfBuffer = await generateReimbursementPDF(reimbursement as any, reimbursement.protocolo);

          if (pdfBuffer && pdfBuffer.length > 0) {
            console.log('PDF generated successfully, adding to attachments');
            // Add the generated PDF to attachments
            attachments.push({
              filename: `reembolso_${reimbursement.protocolo}.pdf`,
              content: pdfBuffer,
              contentType: 'application/pdf'
            });
          } else {
            console.error('PDF buffer is empty or invalid');
          }

          // Try to download and attach the original attachments
          if (reimbursement.comprovantes && Array.isArray(reimbursement.comprovantes) && reimbursement.comprovantes.length > 0) {
            console.log(`Attempting to attach ${reimbursement.comprovantes.length} original files`);

            for (const attachment of reimbursement.comprovantes) {
              try {
                // Get the file from Supabase storage
                const fileName = attachment.url.split('/').pop() || attachment.url;
                console.log(`Downloading attachment: ${fileName}`);

                const { data, error } = await supabaseAdmin
                  .storage
                  .from('comprovantes')
                  .download(fileName);

                if (error) {
                  console.error(`Error downloading attachment ${fileName}:`, error);
                  continue;
                }

                if (data) {
                  console.log(`Successfully downloaded attachment ${fileName}`);
                  const arrayBuffer = await data.arrayBuffer();

                  attachments.push({
                    filename: attachment.nome,
                    content: Buffer.from(arrayBuffer),
                    contentType: attachment.tipo || 'application/octet-stream'
                  });
                }
              } catch (attachError) {
                console.error('Error processing attachment:', attachError);
              }
            }
          }
        } catch (pdfError) {
          console.error('Error generating PDF:', pdfError);
        }
      }

      console.log(`Sending email notification to ${reimbursement.email} with ${attachments.length} attachments`);

      await sendEmail(
        reimbursement.email,
        subject,
        '', // text
        emailBody,
        { attachments }
      );

      console.log('Email notification sent successfully');
    } catch (emailError) {
      console.error('Error sending email notification:', emailError);
      // Continue even if email fails
    }

    return NextResponse.json({
      success: true,
      message: `Reembolso ${status === 'APPROVED' ? 'aprovado' : 'rejeitado'} com sucesso`
    });
  } catch (error) {
    console.error('Error approving reimbursement:', error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
