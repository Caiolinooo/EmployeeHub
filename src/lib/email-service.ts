import nodemailer from 'nodemailer';
import { getCredential } from './secure-credentials';

/**
 * Serviço de envio de e-mails
 * Suporta Gmail e Ethereal (para testes)
 */

// Função para obter a configuração de email
async function getEmailConfig() {
  // Valores padrão
  const config = {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '465'),
    secure: process.env.EMAIL_SECURE === 'true', // true para 465, false para outras portas
    auth: {
      user: process.env.EMAIL_USER || 'apiabzgroup@gmail.com',
      pass: process.env.EMAIL_PASSWORD || ''
    },
    // Configurações para melhorar a entregabilidade
    pool: true, // Usar conexões persistentes
    maxConnections: 5,
    maxMessages: 100,
    // Configurações de timeout
    connectionTimeout: 10000, // 10 segundos
    greetingTimeout: 10000,
    socketTimeout: 10000,
    // Desativar verificação de certificado em ambiente de desenvolvimento
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production'
    }
  };

  try {
    // Tentar obter credenciais da tabela app_secrets
    const emailUser = await getCredential('EMAIL_USER');
    const emailPassword = await getCredential('EMAIL_PASSWORD');

    if (emailUser) {
      config.auth.user = emailUser;
    }

    if (emailPassword) {
      config.auth.pass = emailPassword;
    }
  } catch (error) {
    console.warn('Erro ao obter credenciais de email da tabela app_secrets, usando valores do ambiente:', error);
  }

  // Log para debug
  console.log('Configuração de email carregada:', {
    host: config.host,
    port: config.port,
    secure: config.secure,
    user: config.auth.user
  });

  return config;
}

/**
 * Inicializa o transporte de e-mail
 * @returns Transporter configurado
 */
export async function createTransport() {
  try {
    console.log('Inicializando transporte de email com Gmail');
    console.log('Ambiente:', process.env.NODE_ENV || 'development');

    // Obter configuração de email
    const emailConfig = await getEmailConfig();

    // Criar transporter com configuração otimizada para Gmail
    const transporter = nodemailer.createTransport(emailConfig);

    // Verificar conexão
    console.log('Verificando conexão com o servidor SMTP...');
    await transporter.verify();
    console.log('Conexão com o servidor SMTP verificada com sucesso');

    return transporter;
  } catch (error) {
    console.error('Erro ao inicializar transporte de email:', error);

    // Tentar criar uma conta de teste Ethereal
    try {
      console.log('Tentando criar conta de teste Ethereal...');
      const testAccount = await nodemailer.createTestAccount();

      const etherealTransporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });

      console.log('Conta de teste Ethereal criada:', {
        user: testAccount.user,
        pass: testAccount.pass
      });

      // Verificar conexão
      await etherealTransporter.verify();
      console.log('Conexão com Ethereal verificada com sucesso');

      return etherealTransporter;
    } catch (fallbackError) {
      console.error('Erro ao criar conta de teste Ethereal:', fallbackError);
      throw new Error('Não foi possível inicializar nenhum transporte de email');
    }
  }
}

/**
 * Envia um e-mail
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
  html: string
) {
  try {
    // Criar transporte
    const transport = await createTransport();

    // Preparar opções do e-mail com cabeçalhos anti-spam
    const mailOptions = {
      from: process.env.EMAIL_FROM || '"ABZ Group" <apiabzgroup@gmail.com>',
      to,
      subject,
      text,
      html,
      // Cabeçalhos para melhorar a entregabilidade e evitar spam
      headers: {
        // Prioridade do email
        'X-Priority': '1',
        'X-MSMail-Priority': 'High',
        'Importance': 'High',
        // Identificação do remetente
        'X-Mailer': 'ABZ Group Mailer',
        'X-Sender': process.env.EMAIL_USER || 'apiabzgroup@gmail.com',
        // Opção de descadastramento (importante para evitar spam)
        'List-Unsubscribe': `<mailto:${process.env.EMAIL_USER || 'apiabzgroup@gmail.com'}?subject=Unsubscribe>`,
        // Identificação da mensagem
        'Message-ID': `<${Date.now()}.${Math.random().toString(36).substring(2)}@abzgroup.com>`,
        // Feedback loop
        'Feedback-ID': `${Date.now()}:abzgroup:${process.env.NODE_ENV || 'development'}`
      },
      // Configurações adicionais
      encoding: 'utf-8',
      priority: 'high' as const, // Tipo explícito para evitar erro de tipo
      disableFileAccess: true,
      disableUrlAccess: true
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
      message: 'E-mail enviado com sucesso.',
      messageId: info.messageId,
      previewUrl: previewUrl || undefined
    };
  } catch (error) {
    console.error('Erro ao enviar e-mail:', error);
    throw error;
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
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.5; color: #333333; background-color: #f9f9f9;">
      <!-- Wrapper para compatibilidade com clientes de email -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f9f9f9;">
        <tr>
          <td align="center" style="padding: 20px 0;">
            <!-- Container principal -->
            <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05); max-width: 600px; margin: 0 auto;">
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
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f5f5f5; border-radius: 5px; margin: 20px 0;">
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
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
}

/**
 * Testa a conexão com o servidor SMTP
 * @returns Resultado do teste
 */
export async function testConnection() {
  try {
    const transport = await createTransport();
    await transport.verify();

    return {
      success: true,
      message: 'Conexão com o servidor SMTP verificada com sucesso'
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
}
