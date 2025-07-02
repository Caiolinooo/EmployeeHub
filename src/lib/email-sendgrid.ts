/**
 * IMPORTANTE: Este arquivo deve ser usado apenas no servidor.
 * Não importe este arquivo diretamente em componentes do cliente.
 * Use src/lib/email-client.ts para componentes do cliente.
 *
 * Configuração otimizada para SendGrid
 */

import nodemailer from 'nodemailer';
import { MailService } from '@sendgrid/mail';

// Validate required environment variables
function validateSendGridConfig() {
  if (!process.env.SENDGRID_API_KEY) {
    throw new Error('SENDGRID_API_KEY environment variable is required');
  }
}

// Validate configuration early (only on server)
if (typeof window === 'undefined') {
  try {
    validateSendGridConfig();
  } catch (error) {
    console.error('SendGrid configuration validation failed:', error instanceof Error ? error.message : 'Unknown error');
  }
}

// Inicializar o cliente SendGrid
const sgMail = new MailService();
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// Configuração do nodemailer com SendGrid
const sendgridConfig = {
  host: 'smtp.sendgrid.net',
  port: 587,
  secure: false, // true para 465, false para outras portas
  auth: {
    user: 'apikey', // Sempre 'apikey' para SendGrid
    pass: process.env.SENDGRID_API_KEY
  },
  // Configurações para melhorar a entregabilidade
  pool: true,
  maxConnections: 5,
  maxMessages: 100,
  // Configurações de timeout
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000,
  // Configurações de TLS
  tls: {
    rejectUnauthorized: process.env.NODE_ENV === 'production'
  }
};

/**
 * Inicializa o transporte de e-mail com SendGrid
 * @returns Transporter configurado
 */
export async function createTransport() {
  try {
    console.log('Inicializando transporte de email com SendGrid');
    console.log('Ambiente:', process.env.NODE_ENV || 'development');

    // Criar transporter com configuração do SendGrid
    const transporter = nodemailer.createTransport(sendgridConfig);

    // Verificar conexão
    console.log('Verificando conexão com o servidor SMTP do SendGrid...');
    await transporter.verify();
    console.log('Conexão com o servidor SMTP do SendGrid verificada com sucesso');

    return transporter;
  } catch (error) {
    console.error('Erro ao inicializar transporte de email com SendGrid:', error);

    // Fallback para Ethereal em caso de erro
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
 * Envia um e-mail usando SendGrid
 * @param to Destinatário(s)
 * @param subject Assunto
 * @param text Conteúdo em texto
 * @param html Conteúdo em HTML
 * @param options Opções adicionais
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

    // Preparar opções do e-mail com cabeçalhos anti-spam
    const mailOptions = {
      from: {
        name: 'ABZ Group',
        address: options?.from || process.env.EMAIL_FROM || 'apiabzgroup@gmail.com'
      },
      to,
      cc: options?.cc,
      bcc: options?.bcc,
      subject,
      text,
      html,
      attachments: options?.attachments,
      // Cabeçalhos para melhorar a entregabilidade e evitar spam
      headers: {
        // Prioridade normal para evitar filtros de spam
        'X-Priority': '3',
        'X-MSMail-Priority': 'Normal',
        'Importance': 'Normal',
        // Identificação do remetente
        'X-Mailer': 'ABZ Group Mailer via SendGrid',
        'X-Sender': process.env.EMAIL_USER || 'apiabzgroup@gmail.com',
        // Opção de descadastramento (importante para evitar spam)
        'List-Unsubscribe': `<mailto:${process.env.EMAIL_USER || 'apiabzgroup@gmail.com'}?subject=Unsubscribe>`,
        // Identificação da mensagem
        'Message-ID': `<${Date.now()}.${Math.random().toString(36).substring(2)}@groupabz.com>`,
        // Feedback loop
        'Feedback-ID': `${Date.now()}:abzgroup:${process.env.NODE_ENV || 'development'}`,
        // Cabeçalhos adicionais para evitar spam
        'MIME-Version': '1.0',
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Transfer-Encoding': '7bit',
        'X-SG-EID': 'ABZ Group',
        'X-SG-ID': 'ABZ Group',
        'X-Report-Abuse': `Please report abuse to ${process.env.EMAIL_USER || 'apiabzgroup@gmail.com'}`
      },
      // Configurações adicionais
      encoding: 'utf-8',
      priority: 'normal' as 'normal',
      disableFileAccess: true,
      disableUrlAccess: true,
      // Configurações para melhorar a entregabilidade
      replyTo: process.env.EMAIL_USER || 'apiabzgroup@gmail.com'
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
      // Ignorar erro (normal para SendGrid)
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
https://groupabz.com
${new Date().getFullYear()} © Todos os direitos reservados.
  `.trim();

  // Versão HTML do email
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Código de Verificação</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
    .container { padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px; }
    .header { text-align: center; margin-bottom: 20px; }
    .logo { max-width: 150px; height: auto; }
    .code { background-color: #f5f5f5; padding: 15px; border-radius: 5px; text-align: center; margin: 20px 0; font-size: 24px; letter-spacing: 5px; font-weight: bold; }
    .footer { margin-top: 30px; font-size: 12px; color: #666; text-align: center; border-top: 1px solid #e0e0e0; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/images/LC1_Azul.png" alt="ABZ Group Logo" class="logo" style="max-width: 200px; height: auto;">
      <h2>Código de Verificação</h2>
    </div>

    <p>Olá,</p>

    <p>Recebemos uma solicitação para verificar seu endereço de e-mail. Use o código abaixo para confirmar:</p>

    <div class="code">${code}</div>

    <p>Este código expira em <strong>10 minutos</strong>.</p>

    <p>Se você não solicitou este código, por favor ignore este email.</p>

    <div class="footer">
      <p>ABZ Group</p>
      <p><a href="https://groupabz.com">https://groupabz.com</a></p>
      <p>${new Date().getFullYear()} &copy; Todos os direitos reservados.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

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
 * Envia um e-mail com código de verificação para definir/redefinir senha
 * @param email E-mail do destinatário
 * @param code Código de verificação
 * @param isNewUser Indica se é um novo usuário ou redefinição de senha
 * @returns Resultado do envio
 */
export async function sendPasswordSetupEmail(email: string, code: string, isNewUser: boolean = false) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  // Texto simples para clientes que não suportam HTML
  const text = `
${isNewUser ? 'Bem-vindo ao ABZ Group!' : 'Código de Verificação - ABZ Group'}

${isNewUser
  ? 'Você foi registrado no sistema ABZ Group. Por favor, use o código abaixo para definir sua senha:'
  : 'Recebemos uma solicitação para redefinir sua senha. Use o código abaixo para verificar sua identidade:'}

Seu código de verificação: ${code}

Este código expira em 10 minutos.

Se você não solicitou ${isNewUser ? 'este cadastro' : 'esta redefinição de senha'}, por favor ignore este email.

--
ABZ Group
https://groupabz.com
${new Date().getFullYear()} © Todos os direitos reservados.
  `.trim();

  // Versão HTML do email
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${isNewUser ? 'Bem-vindo ao ABZ Group' : 'Código de Verificação'}</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
    .container { padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px; }
    .header { text-align: center; margin-bottom: 20px; }
    .logo { max-width: 200px; height: auto; }
    .code { background-color: #f5f5f5; padding: 15px; border-radius: 5px; text-align: center; margin: 20px 0; font-size: 24px; letter-spacing: 5px; font-weight: bold; }
    .footer { margin-top: 30px; font-size: 12px; color: #666; text-align: center; border-top: 1px solid #e0e0e0; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="${appUrl}/images/LC1_Azul.png" alt="ABZ Group Logo" class="logo" style="max-width: 200px; height: auto;">
      <h2>${isNewUser ? 'Bem-vindo ao ABZ Group' : 'Código de Verificação'}</h2>
    </div>

    <p>Olá,</p>

    <p>${isNewUser
      ? 'Você foi registrado no sistema ABZ Group. Por favor, use o código abaixo para definir sua senha:'
      : 'Recebemos uma solicitação para redefinir sua senha. Use o código abaixo para verificar sua identidade:'}</p>

    <div class="code">${code}</div>

    <p>Insira este código no site para ${isNewUser ? 'definir sua senha' : 'redefinir sua senha'}.</p>

    <p>Este código expira em <strong>10 minutos</strong>.</p>

    <p>Se você não solicitou ${isNewUser ? 'este cadastro' : 'esta redefinição de senha'}, por favor ignore este email.</p>

    <div class="footer">
      <p>ABZ Group</p>
      <p><a href="https://groupabz.com">https://groupabz.com</a></p>
      <p>${new Date().getFullYear()} &copy; Todos os direitos reservados.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  try {
    return await sendEmail(
      email,
      isNewUser ? 'Bem-vindo ao ABZ Group - Código de Verificação' : 'Código de Verificação - ABZ Group',
      text,
      html
    );
  } catch (error) {
    console.error(`Erro ao enviar e-mail de ${isNewUser ? 'boas-vindas' : 'verificação'}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
}

/**
 * Envia um e-mail com anexo (para reembolsos)
 * @param email E-mail do destinatário
 * @param subject Assunto do e-mail
 * @param text Conteúdo em texto
 * @param html Conteúdo em HTML
 * @param attachments Anexos do e-mail
 * @returns Resultado do envio
 */
export async function sendEmailWithAttachment(
  email: string,
  subject: string,
  text: string,
  html: string,
  attachments: Array<{
    filename: string;
    content?: any;
    path?: string;
    contentType?: string;
  }>
) {
  try {
    return await sendEmail(email, subject, text, html, { attachments });
  } catch (error) {
    console.error('Erro ao enviar e-mail com anexo:', error);
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
      message: 'Conexão com o servidor SMTP do SendGrid verificada com sucesso'
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
}
