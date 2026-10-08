import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { canWithGrant } from '@/lib/permission-gate';
import { buildAppUrl } from '@/lib/app-url';
import { sendEmail } from '@/lib/email';
import { generateReimbursementPDF } from '@/lib/pdf-generator';
import { reimbursementApprovalTemplate, reimbursementRejectionTemplate } from '@/lib/emailTemplates';

export const dynamic = 'force-dynamic';

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
    if (!(await canWithGrant(userId, userRole, ['reimbursement_approval', 'reimbursement.approve']))) {
      console.error('User does not have permission to approve reimbursements');
      return NextResponse.json(
        { error: 'Sem permissão para aprovar reembolsos' },
        { status: 403 }
      );
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

      // Use consistent email templates
      let emailBody = '';
      const valorNumerico = parseFloat(reimbursement.valor_total || reimbursement.valorTotal || 0);
      const valorFormatado = `R$ ${valorNumerico.toFixed(2)}`;

      if (status === 'APPROVED') {
        emailBody = reimbursementApprovalTemplate(
          reimbursement.nome || '',
          reimbursement.protocolo,
          valorFormatado,
          reimbursement.metodo_pagamento || reimbursement.metodoPagamento || 'Não especificado',
          comments || ''
        );
      } else {
        emailBody = reimbursementRejectionTemplate(
          reimbursement.nome || '',
          reimbursement.protocolo,
          comments || 'Não especificado'
        );
      }


      // Generate PDF if approved
      const attachments: any[] = [];
      if (status === 'APPROVED') {
        try {
          console.log('Generating PDF for approved reimbursement');
          // Voltar a usar generateReimbursementPDF com os parâmetros corretos
          const pdfBuffer = await generateReimbursementPDF(reimbursement as any);

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
