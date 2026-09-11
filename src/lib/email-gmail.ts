/**
 * IMPORTANTE: Este arquivo deve ser usado apenas no servidor.
 * Não importe este arquivo diretamente em componentes do cliente.
 * Use src/lib/email-client.ts para componentes do cliente.
 */

import nodemailer from 'nodemailer';
import type { SendMailOptions } from 'nodemailer';
import { buildAppUrl } from './app-url';
import {
  clearResolvedEmailAuthCache,
  emailTlsOptions,
  resolveEmailAddress,
  resolveEmailAuth,
  resolveEmailFrom,
} from './email-env';

type GmailMailConfig = {
  service: 'gmail';
  host: string;
  port: number;
  secure: boolean;
  auth: { user: string; pass: string };
  connectionTimeout: number;
  greetingTimeout: number;
  socketTimeout: number;
  tls: ReturnType<typeof emailTlsOptions>;
  debug: boolean;
  logger: boolean;
};

let emailConfig: GmailMailConfig | null = null;

async function buildGmailConfig(): Promise<GmailMailConfig> {
  const auth = await resolveEmailAuth();
  return {
    service: 'gmail',
    host: auth.host || 'smtp.gmail.com',
    port: auth.port || 465,
    secure: auth.secure,
    auth: {
      user: auth.user,
      pass: auth.pass,
    },
    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 30000,
    tls: emailTlsOptions(),
    debug: process.env.NODE_ENV !== 'production',
    logger: process.env.NODE_ENV !== 'production',
  };
}

async function getGmailConfig(): Promise<GmailMailConfig> {
  if (!emailConfig) {
    emailConfig = await buildGmailConfig();
    console.log('Configuração de email carregada:', {
      host: emailConfig.host,
      port: emailConfig.port,
      secure: emailConfig.secure,
      user: emailConfig.auth.user,
    });
  }
  return emailConfig;
}

export function resetGmailTransport(): void {
  emailConfig = null;
  clearResolvedEmailAuthCache();
}

/**
 * Inicializa o transporte de e-mail
 * @returns Transporter configurado
 */
export async function createTransport() {
  try {
    const config = await getGmailConfig();
    console.log('Inicializando transporte de email com Gmail');
    console.log('Ambiente:', process.env.NODE_ENV || 'development');
    console.log('Configuração detalhada:', {
      service: config.service,
      host: config.host,
      port: config.port,
      secure: config.secure,
      user: config.auth.user,
      debug: config.debug,
      logger: config.logger,
    });

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: config.auth.user,
        pass: config.auth.pass,
      },
      tls: emailTlsOptions(),
    });

    await transporter.verify();
    console.log('Conexão com o servidor SMTP verificada com sucesso');
    return transporter;
  } catch (error) {
    emailConfig = null;
    clearResolvedEmailAuthCache();
    console.error('Erro ao inicializar transporte de email Gmail:', error);
    throw error;
  }
}

export async function sendEmail(
  to: string | string[],
  subject: string,
  text: string,
  html: string,
  options?: {
    from?: string;
    cc?: string | string[];
    bcc?: string | string[];
    attachments?: Array<{
      filename: string;
      content?: any;
      path?: string;
      contentType?: string;
    }>;
  }
) {
  try {
    const config = await getGmailConfig();
    const transport = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: config.auth.user,
        pass: config.auth.pass
      },
      tls: emailTlsOptions(),
    });

    const mailOptions: SendMailOptions = {
      from: options?.from || (await resolveEmailFrom()),
      to,
      cc: options?.cc,
      bcc: options?.bcc,
      subject,
      text,
      html,
      attachments: options?.attachments,
      replyTo: process.env.EMAIL_REPLY_TO || (await resolveEmailAddress()),
    };

    console.log('Enviando e-mail para:', Array.isArray(to) ? to.join(', ') : to);

    // Enviar e-mail
    const info = await transport.sendMail(mailOptions);
    console.log('E-mail enviado com sucesso. ID:', info.messageId);

    // Obter URL de preview (disponível apenas com Ethereal)
    let previewUrl;
    try {
      previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        console.log('URL de preview:', previewUrl);
      }
    } catch (previewError) {
      // Ignorar erro (normal para Gmail)
    }

    return {
      success: true,
      message: 'Email enviado com sucesso',
      messageId: info.messageId,
      previewUrl
    };
  } catch (error) {
    console.error('Erro ao enviar e-mail:', error);
    return {
      success: false,
      message: `Erro ao enviar email: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    };
  }
}

/**
 * Envia um e-mail com código de verificação
 * @param email E-mail do destinatário
 * @param code Código de verificação
 * @returns Resultado do envio
 */
export async function sendVerificationEmail(email: string, code: string) {
  // Texto simples para clientes que não suportam HTML
  const text = `
Código de Verificação ABZ Group

Seu código de verificação é: ${code}

Este código expira em 10 minutos.

Se você não solicitou este código, por favor ignore este email.

--
ABZ Group
https://abzgroup.com.br
${new Date().getFullYear()} © Todos os direitos reservados.
  `.trim();

  // HTML otimizado para entregabilidade e compatibilidade
  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <title>Código de Verificação - ABZ Group</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.5; color: #333333; background: #f9f9f9;">
      <!-- Wrapper para compatibilidade com clientes de email -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: #f9f9f9;">
        <tr>
          <td align="center" style="padding: 20px 0;">
            <!-- Container principal -->
            <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05); max-width: 600px; margin: 0 auto;">
              <!-- Cabeçalho com logo -->
              <tr>
                <td align="center" style="padding: 30px 20px;">
                  <img src="${process.env.EMAIL_LOGO_URL || 'https://abzgroup.com.br/wp-content/uploads/2023/05/LC1_Azul.png'}" alt="ABZ Group Logo" width="200" style="display: block; max-width: 200px; height: auto;">
                </td>
              </tr>

              <!-- Título -->
              <tr>
                <td align="center" style="padding: 0 20px 20px 20px;">
                  <h1 style="color: #0066cc; font-size: 24px; margin: 0;">Seu Código de Verificação</h1>
                </td>
              </tr>

              <!-- Código de verificação -->
              <tr>
                <td align="center" style="padding: 0 20px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: #f5f5f5; border-radius: 5px; margin: 20px 0;">
                    <tr>
                      <td align="center" style="padding: 20px; font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #333333;">
                        ${code}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Informações -->
              <tr>
                <td align="center" style="padding: 0 20px 20px 20px;">
                  <p style="margin: 0 0 20px 0; text-align: center;">Este código expira em <strong>10 minutos</strong>.</p>
                  <p style="margin: 0; text-align: center; color: #666666; font-size: 14px;">Se você não solicitou este código, por favor ignore este email.</p>
                </td>
              </tr>

              <!-- Rodapé -->
              <tr>
                <td style="padding: 20px; border-top: 1px solid #e0e0e0;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                    <tr>
                      <td align="center" style="font-size: 12px; color: #999999;">
                        <p style="margin: 0 0 10px 0;">&copy; ${new Date().getFullYear()} ABZ Group. Todos os direitos reservados.</p>
                        <p style="margin: 0;">
                          <a href="https://abzgroup.com.br" style="color: #0066cc; text-decoration: none;">abzgroup.com.br</a>
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  try {
    return await sendEmail(email, 'Código de Verificação - ABZ Group', text, html);
  } catch (error) {
    console.error('Erro ao enviar e-mail de verificação:', error);
    return {
      success: false,
      message: `Erro ao enviar email de verificação: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    };
  }
}

/**
 * Função para enviar um email de convite para novos usuários
 */
export async function sendInvitationEmail(
  email: string,
  inviteCode: string,
  name?: string
) {
  const inviteUrl = buildAppUrl(`/set-password?invite=${inviteCode}`);

  const text = `Olá ${name || ''},\n\nVocê foi convidado para acessar o Portal ABZ.\n\nSeu código de convite é: ${inviteCode}\n\nAcesse o portal em: ${inviteUrl}\n\nEste convite não expira, mas pode ser revogado pelo administrador.\n\nAtenciosamente,\nEquipe ABZ Group`;

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Convite para o Portal ABZ</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background: #f9f9f9; color: #333333;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="center" style="padding: 20px 0;">
            <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05); overflow: hidden;">
              <!-- Cabeçalho -->
              <tr>
                <td align="center" style="padding: 30px 20px; background: #ffffff;">
                  <img src="${process.env.EMAIL_LOGO_URL || 'https://abzgroup.com.br/wp-content/uploads/2023/05/LC1_Azul.png'}" alt="ABZ Group Logo" style="max-width: 200px; height: auto;">
                </td>
              </tr>

              <!-- Conteúdo -->
              <tr>
                <td style="padding: 20px 30px;">
                  <h2 style="color: #0066cc; text-align: center; margin-top: 0;">Convite para o Portal ABZ</h2>
                  <p style="margin-bottom: 20px;">Olá ${name || ''},</p>
                  <p style="margin-bottom: 20px;">Você foi convidado para acessar o Portal ABZ, nossa plataforma interna para colaboradores.</p>

                  <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <p style="margin-bottom: 10px; font-weight: bold;">Seu código de convite:</p>
                    <div style="background: #ffffff; padding: 10px; border-radius: 5px; text-align: center; font-size: 18px; letter-spacing: 2px; font-weight: bold; border: 1px dashed #0066cc;">
                      ${inviteCode}
                    </div>
                  </div>

                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${inviteUrl}" style="background: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Acessar o Portal</a>
                  </div>

                  <p style="margin-bottom: 20px;">Se o botão acima não funcionar, copie e cole o seguinte link no seu navegador:</p>
                  <p style="margin-bottom: 20px; word-break: break-all;"><a href="${inviteUrl}" style="color: #0066cc;">${inviteUrl}</a></p>

                  <p style="margin-bottom: 20px;">Este convite não expira, mas pode ser revogado pelo administrador.</p>

                  <p style="margin-bottom: 5px;">Atenciosamente,</p>
                  <p style="margin-bottom: 20px;"><strong>Equipe ABZ Group</strong></p>
                </td>
              </tr>

              <!-- Informações de Segurança -->
              <tr>
                <td style="padding: 15px 30px; background: #f5f5f5; border-top: 1px solid #e0e0e0;">
                  <p style="font-size: 13px; color: #666666; margin: 0 0 10px 0;"><strong>Informações de Segurança:</strong></p>
                  <p style="font-size: 13px; color: #666666; margin: 0 0 10px 0;">• Nunca compartilhe seu código de convite com outras pessoas.</p>
                  <p style="font-size: 13px; color: #666666; margin: 0 0 10px 0;">• A ABZ Group nunca solicitará sua senha por e-mail ou telefone.</p>
                  <p style="font-size: 13px; color: #666666; margin: 0;">• Em caso de dúvidas, entre em contato com o suporte.</p>
                </td>
              </tr>

              <!-- Rodapé -->
              <tr>
                <td style="padding: 20px 30px; text-align: center; background: #ffffff; border-top: 1px solid #e0e0e0;">
                  <p style="font-size: 12px; color: #999999; margin: 0 0 10px 0;">&copy; ${new Date().getFullYear()} ABZ Group. Todos os direitos reservados.</p>
                  <p style="font-size: 12px; color: #999999; margin: 0;">Este e-mail foi enviado para ${email}. Se você não solicitou este convite, por favor ignore esta mensagem ou entre em contato com nosso suporte.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  // Usar a função genérica para enviar o email
  try {
    const result = await sendEmail(email, 'Convite para o Portal ABZ', text, html);
    return result;
  } catch (error) {
    console.error('Erro ao enviar email de convite:', error);
    return {
      success: false,
      message: `Erro ao enviar email de convite: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    };
  }
}

/**
 * Função para enviar um email de redefinição de senha
 * @param email Email do destinatário
 * @param resetUrl URL para redefinição de senha
 * @returns Resultado do envio
 */
export async function sendPasswordResetEmail(email: string, resetUrl: string) {
  console.log(`Enviando email de redefinição de senha para ${email} com URL: ${resetUrl}`);

  // Texto simples para clientes que não suportam HTML
  const text = `
Redefinição de Senha - ABZ Group

Você solicitou a redefinição de senha para sua conta no ABZ Group.

Acesse o link para redefinir sua senha: ${resetUrl}

Se você não solicitou esta redefinição, ignore este email.

Este link é válido por 1 hora.

Atenciosamente,
Equipe ABZ Group
  `.trim();

  // HTML para clientes que suportam HTML
  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Redefinição de Senha - ABZ Group</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background: #f9f9f9; color: #333333;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="center" style="padding: 20px 0;">
            <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05); overflow: hidden;">
              <!-- Cabeçalho -->
              <tr>
                <td align="center" style="padding: 30px 20px; background: #ffffff;">
                  <img src="${process.env.EMAIL_LOGO_URL || 'https://abzgroup.com.br/wp-content/uploads/2023/05/LC1_Azul.png'}" alt="ABZ Group Logo" style="max-width: 200px; height: auto;">
                </td>
              </tr>

              <!-- Conteúdo -->
              <tr>
                <td style="padding: 20px 30px;">
                  <h2 style="color: #0066cc; text-align: center; margin-top: 0;">Redefinição de Senha</h2>
                  <p style="margin-bottom: 20px;">Você solicitou a redefinição de senha para sua conta no ABZ Group.</p>
                  <p style="margin-bottom: 20px;">Clique no botão abaixo para redefinir sua senha:</p>

                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${resetUrl}" style="background: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Redefinir Senha</a>
                  </div>

                  <p style="margin-bottom: 20px;">Se o botão acima não funcionar, copie e cole o seguinte link no seu navegador:</p>
                  <p style="margin-bottom: 20px; word-break: break-all;"><a href="${resetUrl}" style="color: #0066cc;">${resetUrl}</a></p>

                  <p style="margin-bottom: 20px;">Se você não solicitou esta redefinição, ignore este email.</p>
                  <p style="margin-bottom: 20px;">Este link é válido por 1 hora.</p>

                  <p style="margin-bottom: 5px;">Atenciosamente,</p>
                  <p style="margin-bottom: 20px;"><strong>Equipe ABZ Group</strong></p>
                </td>
              </tr>

              <!-- Informações de Segurança -->
              <tr>
                <td style="padding: 15px 30px; background: #f5f5f5; border-top: 1px solid #e0e0e0;">
                  <p style="font-size: 13px; color: #666666; margin: 0 0 10px 0;"><strong>Informações de Segurança:</strong></p>
                  <p style="font-size: 13px; color: #666666; margin: 0 0 10px 0;">• Nunca compartilhe sua senha com outras pessoas.</p>
                  <p style="font-size: 13px; color: #666666; margin: 0 0 10px 0;">• A ABZ Group nunca solicitará sua senha por e-mail ou telefone.</p>
                  <p style="font-size: 13px; color: #666666; margin: 0;">• Em caso de dúvidas, entre em contato com o suporte.</p>
                </td>
              </tr>

              <!-- Rodapé -->
              <tr>
                <td style="padding: 20px 30px; text-align: center; background: #ffffff; border-top: 1px solid #e0e0e0;">
                  <p style="font-size: 12px; color: #999999; margin: 0 0 10px 0;">&copy; ${new Date().getFullYear()} ABZ Group. Todos os direitos reservados.</p>
                  <p style="font-size: 12px; color: #999999; margin: 0;">Este e-mail foi enviado para ${email}. Se você não solicitou esta redefinição, por favor ignore esta mensagem.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  // Usar a função genérica para enviar o email
  try {
    const result = await sendEmail(email, 'Redefinição de Senha - ABZ Group', text, html);
    return result;
  } catch (error) {
    console.error('Erro ao enviar email de redefinição de senha:', error);
    return {
      success: false,
      message: `Erro ao enviar email de redefinição: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    };
  }
}

/**
 * Testa a conexão com o servidor SMTP
 * @returns Resultado do teste
 */
export async function testEmailConnection() {
  try {
    const config = await getGmailConfig();
    console.log('Testando conexão com o servidor de email Gmail...');
    console.log('Configuração:', {
      service: 'gmail',
      host: config.host,
      port: config.port,
      secure: config.secure,
      user: config.auth.user,
      // Não logar a senha por segurança
      environment: process.env.NODE_ENV || 'development'
    });

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: config.auth.user,
        pass: config.auth.pass
      },
      tls: emailTlsOptions(),
    });

    await transporter.verify();
    console.log('Teste de conexão com Gmail bem-sucedido!');

    return {
      success: true,
      message: 'Conexão com o servidor Gmail verificada com sucesso',
      config: {
        service: 'gmail',
        host: config.host,
        port: config.port,
        secure: config.secure,
        user: config.auth.user,
        environment: process.env.NODE_ENV || 'development'
      }
    };
  } catch (error) {
    console.error('Erro ao testar conexão com o servidor Gmail:', error);

    if (error instanceof Error) {
      console.error('Detalhes do erro:', error.message);
      console.error('Stack trace:', error.stack);
    }

    const config = emailConfig;
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Erro desconhecido',
      config: {
        service: 'gmail',
        host: config?.host || 'smtp.gmail.com',
        port: config?.port || 465,
        secure: config?.secure ?? true,
        user: config?.auth.user,
        environment: process.env.NODE_ENV || 'development'
      }
    };
  }
}

// Função para gerar um código de verificação
export function generateVerificationCode(): string {
  // Gera um código de 6 dígitos
  return Math.floor(100000 + Math.random() * 900000).toString();
}
