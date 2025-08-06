/**
 * Funções para verificação de email por link
 */

import { sendEmail } from '@/lib/email-service';

/**
 * Envia um email com link de verificação
 * @param email Email do destinatário
 * @param name Nome do usuário
 * @param token Token de verificação
 * @returns Resultado do envio
 */
export async function sendEmailVerificationLink(
  email: string,
  name: string,
  token: string
): Promise<{ success: boolean; message: string; previewUrl?: string }> {
  try {
    console.log(`Enviando email de verificação por link para: ${email}`);

    // Obter a URL base do sistema
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const verificationUrl = `${baseUrl}/verify-email?token=${token}`;

    // Texto simples para clientes que não suportam HTML
    const text = `
Olá ${name},

Bem-vindo ao ABZ Group!

Para completar seu cadastro, por favor verifique seu endereço de email clicando no link abaixo:

${verificationUrl}

Este link é válido por 24 horas.

Após verificar seu email, você poderá fazer login no sistema.

Se você não se cadastrou no ABZ Group, por favor ignore este email.

--
Equipe ABZ Group
https://abzgroup.com.br
${new Date().getFullYear()} © Todos os direitos reservados.
    `.trim();

    // HTML para clientes que suportam HTML
    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #ffffff;">
      <!-- Header com logo -->
      <div style="text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #f0f0f0;">
        <img src="https://abzgroup.com.br/wp-content/uploads/2023/05/LC1_Azul.png" alt="ABZ Group Logo" style="max-width: 200px; height: auto;">
      </div>

      <!-- Conteúdo principal -->
      <div style="text-align: center;">
        <h1 style="color: #0066cc; font-size: 24px; margin-bottom: 20px;">Bem-vindo ao ABZ Group!</h1>
        
        <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
          Olá <strong>${name}</strong>,
        </p>
        
        <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
          Para completar seu cadastro e ativar sua conta, por favor verifique seu endereço de email clicando no botão abaixo:
        </p>

        <!-- Botão de verificação -->
        <div style="margin: 30px 0;">
          <a href="${verificationUrl}" 
             style="display: inline-block; background-color: #0066cc; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">
            Verificar Email
          </a>
        </div>

        <p style="color: #666666; font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
          Ou copie e cole este link no seu navegador:
        </p>
        
        <p style="color: #0066cc; font-size: 14px; word-break: break-all; margin-bottom: 30px; padding: 10px; background-color: #f8f9fa; border-radius: 4px;">
          ${verificationUrl}
        </p>

        <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px; padding: 15px; margin: 20px 0;">
          <p style="color: #856404; font-size: 14px; margin: 0;">
            <strong>⏰ Importante:</strong> Este link é válido por 24 horas.
          </p>
        </div>

        <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
          Após verificar seu email, você poderá fazer login no sistema e acessar todas as funcionalidades.
        </p>
      </div>

      <!-- Footer -->
      <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center;">
        <p style="color: #666666; font-size: 12px; margin: 0;">
          Se você não se cadastrou no ABZ Group, por favor ignore este email.
        </p>
        <p style="color: #666666; font-size: 12px; margin: 10px 0 0 0;">
          © ${new Date().getFullYear()} ABZ Group. Todos os direitos reservados.
        </p>
        <p style="color: #666666; font-size: 12px; margin: 5px 0 0 0;">
          <a href="https://abzgroup.com.br" style="color: #0066cc; text-decoration: none;">abzgroup.com.br</a>
        </p>
      </div>
    </div>
    `;

    // Enviar o email
    const result = await sendEmail(
      email,
      'Verifique seu email - ABZ Group',
      text,
      html
    );

    if (result.success) {
      console.log(`Email de verificação enviado com sucesso para: ${email}`);
      return {
        success: true,
        message: 'Email de verificação enviado com sucesso',
        previewUrl: result.previewUrl
      };
    } else {
      console.error(`Erro ao enviar email de verificação para ${email}:`, result.message);
      return {
        success: false,
        message: 'Erro ao enviar email de verificação'
      };
    }

  } catch (error) {
    console.error('Erro ao enviar email de verificação por link:', error);
    return {
      success: false,
      message: `Erro ao enviar email: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    };
  }
}

/**
 * Verifica se um token de verificação de email é válido
 * @param token Token de verificação
 * @returns Dados do usuário se válido, null se inválido
 */
export async function verifyEmailToken(token: string): Promise<{
  success: boolean;
  user?: any;
  message: string;
}> {
  try {
    const { supabaseAdmin } = await import('@/lib/supabase');
    
    // Buscar usuário pelo token
    const { data: user, error } = await supabaseAdmin
      .from('users_unified')
      .select('*')
      .eq('email_verification_token', token)
      .single();

    if (error || !user) {
      return {
        success: false,
        message: 'Token de verificação inválido ou expirado'
      };
    }

    // Verificar se o token não expirou (24 horas)
    const tokenCreatedAt = new Date(user.updated_at);
    const now = new Date();
    const hoursDiff = (now.getTime() - tokenCreatedAt.getTime()) / (1000 * 60 * 60);

    if (hoursDiff > 24) {
      return {
        success: false,
        message: 'Token de verificação expirado'
      };
    }

    // Marcar email como verificado e limpar token
    const { error: updateError } = await supabaseAdmin
      .from('users_unified')
      .update({
        email_verified: true,
        email_verification_token: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Erro ao atualizar verificação de email:', updateError);
      return {
        success: false,
        message: 'Erro ao verificar email'
      };
    }

    return {
      success: true,
      user,
      message: 'Email verificado com sucesso'
    };

  } catch (error) {
    console.error('Erro ao verificar token de email:', error);
    return {
      success: false,
      message: 'Erro interno do servidor'
    };
  }
}
