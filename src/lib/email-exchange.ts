/**
 * IMPORTANTE: Este arquivo deve ser usado apenas no servidor.
 * Não importe este arquivo diretamente em componentes do cliente.
 * Use src/lib/email-client.ts para componentes do cliente.
 *
 * Configuração otimizada para Microsoft Exchange/Office 365
 */

import nodemailer from 'nodemailer';

// Validate required environment variables
function validateEmailConfig() {
  const requiredVars = ['EMAIL_USER', 'EMAIL_PASSWORD'];
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

// Configuração do Exchange/Office 365 com otimizações para evitar spam
const emailConfig = {
  host: process.env.EMAIL_HOST || 'smtp.office365.com',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: process.env.EMAIL_SECURE === 'true', // geralmente false para porta 587 (STARTTLS)
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  },
  // Log detalhado para depuração
  debug: process.env.NODE_ENV !== 'production',
  logger: process.env.NODE_ENV !== 'production',
  // Configurações para melhorar a entregabilidade
  pool: true, // Usar conexões persistentes
  maxConnections: 5,
  maxMessages: 100,
  // Configurações de timeout
  connectionTimeout: 10000, // 10 segundos
  greetingTimeout: 10000,
  socketTimeout: 10000,
  // Configurações de segurança para Exchange/Office 365
  tls: {
    rejectUnauthorized: process.env.NODE_ENV === 'production',
    ciphers: 'SSLv3',
    minVersion: 'TLSv1.2'
  },
  // Configurações específicas para Exchange/Office 365
  requireTLS: true, // Exigir TLS
  opportunisticTLS: true, // Usar TLS quando disponível
  // Identificação do servidor
  name: 'ABZ Group Mailer'
};

// Validate configuration on import (only in server environment)
if (typeof window === 'undefined') {
  try {
    validateEmailConfig();
    console.log('Email configuration validated successfully');
  } catch (error) {
    console.error('Email configuration validation failed:', error instanceof Error ? error.message : 'Unknown error');
  }
}

// Log para debug
console.log('Configuração de email Exchange/Office 365 carregada:', {
  host: emailConfig.host,
  port: emailConfig.port,
  secure: emailConfig.secure,
  user: emailConfig.auth.user
});

/**
 * Inicializa o transporte de e-mail com Exchange/Office 365
 * @returns Transporter configurado
 */
export async function createTransport() {
  try {
    console.log('Inicializando transporte de email com Exchange/Office 365');
    console.log('Ambiente:', process.env.NODE_ENV || 'development');
    console.log('Configuração detalhada:', {
      host: emailConfig.host,
      port: emailConfig.port,
      secure: emailConfig.secure,
      user: emailConfig.auth.user,
      // Não logar a senha por segurança
      debug: emailConfig.debug,
      logger: emailConfig.logger
    });

    // Criar transporter com configuração otimizada para Exchange
    const transporter = nodemailer.createTransport(emailConfig);

    // Verificar conexão
    console.log('Verificando conexão com o servidor SMTP...');
    await transporter.verify();
    console.log('Conexão com o servidor SMTP verificada com sucesso');

    return transporter;
  } catch (error) {
    console.error('Erro ao inicializar transporte de email Exchange:', error);

    if (error instanceof Error) {
      console.error('Detalhes do erro:', error.message);
      console.error('Stack trace:', error.stack);
    }

    // Tentar criar uma conta de teste Ethereal como fallback
    try {
      console.log('Tentando criar conta de teste Ethereal como fallback...');
      const testAccount = await nodemailer.createTestAccount();

      const etherealTransporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        },
        debug: true,
        logger: true
      });

      console.log('Conta de teste Ethereal criada:', {
        user: testAccount.user,
        pass: testAccount.pass,
        previewURL: `https://ethereal.email/message/`
      });

      // Verificar conexão
      await etherealTransporter.verify();
      console.log('Conexão com Ethereal verificada com sucesso');

      return etherealTransporter;
    } catch (fallbackError) {
      console.error('Erro ao criar conta de teste Ethereal:', fallbackError);

      if (fallbackError instanceof Error) {
        console.error('Detalhes do erro fallback:', fallbackError.message);
        console.error('Stack trace fallback:', fallbackError.stack);
      }

      throw new Error(`Não foi possível inicializar nenhum transporte de email: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }
}

/**
 * Envia um e-mail usando Exchange/Office 365
 * @param to Destinatário(s)
 * @param subject Assunto
 * @param text Conteúdo em texto
 * @param html Conteúdo em HTML
 * @returns Resultado do envio
 */
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
    // Criar transporte
    const transport = await createTransport();

    // Preparar opções do e-mail otimizadas para Exchange/Office 365
    const mailOptions = {
      from: options?.from || process.env.EMAIL_FROM || '"ABZ Group" <apiabz@groupabz.com>',
      to,
      cc: options?.cc,
      bcc: options?.bcc,
      subject,
      text,
      html,
      attachments: options?.attachments,
      // Cabeçalhos otimizados para Exchange/Office 365
      headers: {
        // Prioridade normal (evitar alta prioridade para não acionar filtros de spam)
        'X-Priority': '3',
        'X-MSMail-Priority': 'Normal',
        'Importance': 'Normal',
        // Identificação do remetente
        'X-Mailer': 'ABZ Group Mailer',
        'X-Sender': process.env.EMAIL_USER || 'apiabz@groupabz.com',
        // Opção de descadastramento
        'List-Unsubscribe': `<mailto:${process.env.EMAIL_USER || 'apiabz@groupabz.com'}?subject=Unsubscribe>`,
        // Cabeçalhos específicos para Exchange
        'X-Auto-Response-Suppress': 'OOF, DR, RN, NRN, AutoReply',
        // Cabeçalho para indicar que é um email transacional
        'X-Email-Type': 'transactional'
      },
      // Configurações adicionais
      encoding: 'utf-8',
      priority: 'normal',
      disableFileAccess: true,
      disableUrlAccess: true,
      // Adicionar um endereço de resposta
      replyTo: process.env.EMAIL_REPLY_TO || process.env.EMAIL_USER || 'apiabz@groupabz.com'
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
      // Ignorar erro (normal para Exchange)
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

  // HTML otimizado para Exchange/Office 365
  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <title>Código de Verificação - ABZ Group</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.5; color: #333333; background-color: #f9f9f9;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f9f9f9;">
        <tr>
          <td align="center" style="padding: 20px 0;">
            <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05); max-width: 600px; margin: 0 auto;">
              <tr>
                <td align="center" style="padding: 30px 20px;">
                  <img src="${process.env.EMAIL_LOGO_URL || 'https://abzgroup.com.br/wp-content/uploads/2023/05/LC1_Azul.png'}" alt="ABZ Group Logo" width="200" style="display: block; max-width: 200px; height: auto;">
                </td>
              </tr>
              <tr>
                <td align="center" style="padding: 0 20px 20px 20px;">
                  <h1 style="color: #0066cc; font-size: 24px; margin: 0;">Seu Código de Verificação</h1>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding: 0 20px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f5f5f5; border-radius: 5px; margin: 20px 0;">
                    <tr>
                      <td align="center" style="padding: 20px; font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #333333;">
                        ${code}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding: 0 20px 20px 20px;">
                  <p style="margin: 0 0 20px 0; text-align: center;">Este código expira em <strong>10 minutos</strong>.</p>
                  <p style="margin: 0; text-align: center; color: #666666; font-size: 14px;">Se você não solicitou este código, por favor ignore este email.</p>
                </td>
              </tr>
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
  // Obter a URL do portal a partir das variáveis de ambiente
  const portalUrl = process.env.PORTAL_URL || 'http://localhost:3000';
  const inviteUrl = `${portalUrl}/set-password?invite=${inviteCode}`;

  const text = `Olá ${name || ''},\n\nVocê foi convidado para acessar o Painel ABZ Group.\n\nSeu código de convite é: ${inviteCode}\n\nAcesse o portal em: ${inviteUrl}\n\nEste convite não expira, mas pode ser revogado pelo administrador.\n\nAtenciosamente,\nEquipe ABZ Group`;

  // Usar a função genérica para enviar o email
  try {
    // Importar o template de convite
    const { inviteTemplate } = await import('./emailTemplates');

    // Gerar HTML usando o template
    const html = inviteTemplate(inviteCode, inviteUrl, '', undefined);

    const result = await sendEmail(email, 'Convite para o Painel ABZ Group', text, html);
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
 * Testa a conexão com o servidor SMTP
 * @returns Resultado do teste
 */
export async function testEmailConnection() {
  try {
    console.log('Testando conexão com o servidor de email...');
    console.log('Configuração:', {
      host: emailConfig.host,
      port: emailConfig.port,
      secure: emailConfig.secure,
      user: emailConfig.auth.user,
      // Não logar a senha por segurança
      environment: process.env.NODE_ENV || 'development'
    });

    const transport = await createTransport();
    await transport.verify();

    console.log('Teste de conexão bem-sucedido!');

    return {
      success: true,
      message: 'Conexão com o servidor Exchange/Office 365 verificada com sucesso',
      config: {
        host: emailConfig.host,
        port: emailConfig.port,
        secure: emailConfig.secure,
        user: emailConfig.auth.user,
        environment: process.env.NODE_ENV || 'development'
      }
    };
  } catch (error) {
    console.error('Erro ao testar conexão com o servidor de email:', error);

    if (error instanceof Error) {
      console.error('Detalhes do erro:', error.message);
      console.error('Stack trace:', error.stack);
    }

    return {
      success: false,
      message: error instanceof Error ? error.message : 'Erro desconhecido',
      config: {
        host: emailConfig.host,
        port: emailConfig.port,
        secure: emailConfig.secure,
        user: emailConfig.auth.user,
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
