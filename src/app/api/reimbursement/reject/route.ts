import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { sendEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

/**
 * API endpoint to reject a reimbursement request
 * This endpoint handles the rejection of reimbursement requests with proper authentication
 */
export async function POST(request: NextRequest) {
  try {
    console.log('Reimbursement rejection request received');

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

    // Check if user has permission to reject reimbursements
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
        console.error('User does not have permission to reject reimbursements');
        return NextResponse.json(
          { error: 'Sem permissão para rejeitar reembolsos' },
          { status: 403 }
        );
      }
    }

    // Parse request body
    const { id, comments } = await request.json();

    if (!id) {
      console.error('Missing reimbursement ID');
      return NextResponse.json(
        { error: 'ID de reembolso não fornecido' },
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
        status: 'REJECTED',
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
      const subject = `Solicitação de reembolso rejeitada - ${reimbursement.protocolo}`;

      // Prepare a more detailed email body with reimbursement information
      let emailBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #dc3545;">Solicitação de Reembolso Rejeitada</h2>
          </div>

          <p>Olá ${reimbursement.nome || ''},</p>

          <p>Sua solicitação de reembolso com protocolo <strong>${reimbursement.protocolo}</strong> foi <strong style="color: #dc3545;">rejeitada</strong>.</p>

          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <h3 style="margin-top: 0; color: #0066cc;">Detalhes da Solicitação</h3>
            <p><strong>Protocolo:</strong> ${reimbursement.protocolo}</p>
            <p><strong>Data da Solicitação:</strong> ${new Date(reimbursement.created_at).toLocaleDateString('pt-BR')}</p>
            <p><strong>Valor:</strong> R$ ${parseFloat(reimbursement.valor_total || reimbursement.valorTotal || 0).toFixed(2)}</p>
            <p><strong>Tipo:</strong> ${reimbursement.tipo_reembolso || reimbursement.tipoReembolso || 'Não especificado'}</p>
            <p><strong>Status:</strong> <span style="color: #dc3545;">REJEITADO</span></p>
          </div>`;

      if (comments) {
        emailBody += `
          <div style="background-color: #f8d7da; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #dc3545;">
            <h3 style="margin-top: 0; color: #721c24;">Motivo da Rejeição</h3>
            <p>${comments}</p>
          </div>`;
      }

      emailBody += `
          <div style="background-color: #e2e3e5; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #6c757d;">
            <h3 style="margin-top: 0; color: #383d41;">O que fazer agora?</h3>
            <p>Você pode criar uma nova solicitação de reembolso corrigindo os problemas mencionados acima.</p>
            <p>Se você acredita que houve um erro na avaliação, entre em contato com o departamento financeiro.</p>
          </div>

          <p>Para mais detalhes ou para criar uma nova solicitação, acesse o <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://painel.groupabz.com'}/reembolso" style="color: #0066cc; text-decoration: none; font-weight: bold;">Painel de Reembolsos</a>.</p>

          <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #e0e0e0;">
            <p style="color: #666; font-size: 12px;">
              Este é um email automático. Por favor, não responda a este email.<br>
              Em caso de dúvidas, entre em contato com o departamento financeiro.
            </p>
            <p style="color: #666;">Atenciosamente,<br>Equipe ABZ Group</p>
          </div>
        </div>
      `;

      console.log(`Sending rejection notification to ${reimbursement.email}`);

      await sendEmail(
        reimbursement.email,
        subject,
        '', // text
        emailBody
      );

      console.log('Rejection email notification sent successfully');
    } catch (emailError) {
      console.error('Error sending email notification:', emailError);
      // Continue even if email fails
    }

    return NextResponse.json({
      success: true,
      message: 'Reembolso rejeitado com sucesso'
    });
  } catch (error) {
    console.error('Error rejecting reimbursement:', error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
