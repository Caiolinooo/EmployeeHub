// Não importamos o Twilio diretamente para evitar problemas com o Edge Runtime
// O Twilio será carregado dinamicamente apenas quando necessário
import nodemailer from 'nodemailer';

// Configuração do Twilio
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

// Configuração do Email
let emailTransporter: nodemailer.Transporter | null = null;

/**
 * Gera um código de verificação aleatório
 * @returns Código de verificação de 6 dígitos
 */
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Envia um SMS com o código de verificação
 * @param phoneNumber Número de telefone do destinatário
 * @param code Código de verificação
 * @returns Promise com o resultado do envio
 */
export async function sendVerificationSMS(phoneNumber: string, code: string): Promise<{ success: boolean; message: string }> {
  // Em ambiente de desenvolvimento ou se não tiver configuração do Twilio, simular envio
  if (process.env.NODE_ENV !== 'production' || !accountSid || !authToken || !verifyServiceSid) {
    console.log(`[DEV MODE] Enviando SMS para ${phoneNumber} com código: ${code}`);
    return {
      success: true,
      message: 'SMS simulado enviado com sucesso (modo de desenvolvimento)'
    };
  }

  try {
    // Carregar o Twilio dinamicamente apenas quando necessário
    // Isso evita problemas com o Edge Runtime
    const twilio = await import('twilio');
    const client = twilio.default(accountSid, authToken);

    // Enviar SMS usando o Twilio
    const message = await client.messages.create({
      body: `Seu código de verificação ABZ Group é: ${code}`,
      messagingServiceSid: messagingServiceSid,
      to: phoneNumber
    });

    console.log(`SMS enviado com sucesso. SID: ${message.sid}`);

    return {
      success: true,
      message: 'SMS enviado com sucesso'
    };
  } catch (error) {
    console.error('Erro ao enviar SMS:', error);
    return {
      success: false,
      message: 'Erro ao enviar SMS'
    };
  }
}

// Importar a função de inicialização de email do arquivo email-gmail.ts
import { createTransport as getEmailTransporter } from './email-gmail';

/**
 * Inicializa o transporte de email
 * @returns Transporter do Nodemailer
 */
async function initEmailTransport(): Promise<nodemailer.Transporter> {
  if (emailTransporter) return emailTransporter;

  // Usar a função de inicialização de email do arquivo email.ts
  try {
    emailTransporter = await getEmailTransporter();
    console.log('Transporte de email inicializado com sucesso (usando configuração consolidada)');
  } catch (error) {
    console.error('Erro ao inicializar transporte de email:', error);

    // Fallback para Ethereal em caso de erro
    console.log('Usando configuração de email de teste (Ethereal)');
    const testAccount = await nodemailer.createTestAccount();

    emailTransporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });

    console.log('Credenciais de email de teste criadas:', {
      user: testAccount.user,
      pass: testAccount.pass,
      previewURL: `https://ethereal.email/message/`,
    });
  }

  return emailTransporter;
}

/**
 * Envia um email com o código de verificação
 * @param email Endereço de email do destinatário
 * @param code Código de verificação
 * @returns Objeto com o resultado do envio
 */
export async function sendVerificationEmail(
  email: string,
  code: string,
  customOptions?: {
    to?: string;
    subject?: string;
    text?: string;
    html?: string;
  }
): Promise<{ success: boolean; message: string; previewUrl?: string }> {
  try {
    // Inicializa o transporte se ainda não foi inicializado
    const transporter = await initEmailTransport();

    // Conteúdo do email padrão
    const defaultMailOptions = {
      from: process.env.EMAIL_FROM || '"ABZ Group" <apiabz@groupabz.com>',
      to: email,
      subject: 'Código de Verificação - ABZ Group',
      text: `Seu código de verificação é: ${code}. Este código expira em 15 minutos.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <img src="https://abzgroup.com.br/wp-content/uploads/2023/05/LC1_Azul.png" alt="ABZ Group Logo" style="max-width: 200px;">
          </div>
          <h2 style="color: #0066cc; text-align: center;">Seu Código de Verificação</h2>
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; text-align: center; margin: 20px 0; font-size: 24px; letter-spacing: 5px; font-weight: bold;">
            ${code}
          </div>
          <p style="margin-bottom: 20px; text-align: center;">Este código expira em <strong>15 minutos</strong>.</p>
          <p style="color: #666; font-size: 12px; text-align: center; margin-top: 30px;">
            Se você não solicitou este código, por favor ignore este email.
          </p>
          <div style="border-top: 1px solid #e0e0e0; margin-top: 20px; padding-top: 20px; text-align: center; font-size: 12px; color: #999;">
            &copy; ${new Date().getFullYear()} ABZ Group. Todos os direitos reservados.
          </div>
        </div>
      `,
    };

    // Mesclar opções padrão com opções personalizadas, se fornecidas
    const mailOptions = {
      ...defaultMailOptions,
      ...customOptions
    };

    console.log('Enviando email para:', mailOptions.to);
    console.log('Assunto:', mailOptions.subject);
    // Email configuration validated securely

    // Envia o email
    const info = await transporter.sendMail(mailOptions);
    console.log('Email enviado com sucesso. ID da mensagem:', info.messageId);

    // Se estamos usando Ethereal, retorna a URL de preview
    let previewUrl;
    if (process.env.NODE_ENV !== 'production') {
      previewUrl = nodemailer.getTestMessageUrl(info);
      console.log('URL de preview do email:', previewUrl);
    }

    return {
      success: true,
      message: 'Email de verificação enviado com sucesso',
      previewUrl: typeof previewUrl === 'string' ? previewUrl : undefined,
    };
  } catch (error) {
    console.error('Erro ao enviar email de verificação:', error);
    // Detalhes adicionais para depuração
    if (error instanceof Error) {
      console.error('Detalhes do erro:', error.message);
      console.error('Stack trace:', error.stack);
    }
    return {
      success: false,
      message: `Erro ao enviar email de verificação: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
    };
  }
}

/**
 * Envia um SMS de convite
 * @param phoneNumber Número de telefone do destinatário
 * @param inviteCode Código de convite
 * @param name Nome do destinatário (opcional)
 * @returns Resultado do envio
 */
export async function sendInviteSMS(phoneNumber: string, inviteCode: string, name?: string): Promise<{ success: boolean; message: string }> {
  // Em ambiente de desenvolvimento ou se não tiver configuração do Twilio, simular envio
  if (process.env.NODE_ENV !== 'production' || !accountSid || !authToken || !messagingServiceSid) {
    console.log(`[DEV MODE] Enviando SMS de convite para ${phoneNumber} com código: ${inviteCode}`);
    return {
      success: true,
      message: 'SMS de convite simulado enviado com sucesso (modo de desenvolvimento)'
    };
  }

  try {
    // Carregar o Twilio dinamicamente apenas quando necessário
    const twilio = await import('twilio');
    const client = twilio.default(accountSid, authToken);

    // Obter a URL de registro do sistema
    const registerUrl = process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/register?code=${inviteCode}` : `http://localhost:3000/register?code=${inviteCode}`;

    // Preparar a mensagem de convite
    const greeting = name ? `Olá ${name}! ` : 'Olá! ';
    const messageBody = `${greeting}Você foi convidado para o ABZ Group. Seu código de convite é: ${inviteCode}. Acesse: ${registerUrl}`;

    // Enviar SMS usando o Twilio
    const message = await client.messages.create({
      body: messageBody,
      messagingServiceSid: messagingServiceSid,
      to: phoneNumber
    });

    console.log(`SMS de convite enviado com sucesso. SID: ${message.sid}`);

    return {
      success: true,
      message: 'SMS de convite enviado com sucesso'
    };
  } catch (error) {
    console.error('Erro ao enviar SMS de convite:', error);
    return {
      success: false,
      message: 'Erro ao enviar SMS de convite'
    };
  }
}

/**
 * Verifica se um código de verificação é válido
 * @param identifier Número de telefone ou email do usuário
 * @param providedCode Código fornecido pelo usuário
 * @param storedCode Código armazenado
 * @param expirationDate Data de expiração do código
 * @param method Método de verificação (sms ou email)
 * @returns Verdadeiro se o código for válido e não estiver expirado
 */
export async function isVerificationCodeValid(
  identifier: string,
  providedCode: string,
  storedCode?: string,
  expirationDate?: Date,
  method: 'sms' | 'email' = 'sms'
): Promise<boolean> {
  // Importar o serviço de código para verificar também os códigos em memória
  const { verifyCode: verifyCodeService } = await import('./code-service');

  // Verificar primeiro no serviço em memória
  console.log(`Verificando código ${providedCode} para ${identifier} via ${method} no serviço em memória`);
  const isValidInMemory = verifyCodeService(identifier, providedCode, method);

  if (isValidInMemory) {
    console.log(`Código ${providedCode} válido no serviço em memória`);
    return true;
  }

  // Se não for válido em memória, verificar no banco de dados
  console.log(`Código não encontrado em memória, verificando no banco de dados`);

  // Verificar localmente (sempre para email, ou para SMS em desenvolvimento)
  if (method === 'email' || process.env.NODE_ENV !== 'production' || !accountSid || !authToken || !verifyServiceSid) {
    if (!storedCode || !expirationDate) {
      console.log(`Código não encontrado no banco de dados`);
      return false;
    }

    const now = new Date();
    const isValid = storedCode === providedCode && expirationDate > now;
    console.log(`Código ${isValid ? 'válido' : 'inválido'} no banco de dados`);
    return isValid;
  }

  // Se for SMS em produção, usar o Twilio Verify
  try {
    // Carregar o Twilio dinamicamente apenas quando necessário
    const twilioModule = await import('twilio');
    const twilio = twilioModule.default;
    const client = twilio(accountSid, authToken);

    // Verificar o código usando o serviço Twilio Verify
    const verificationCheck = await client.verify.v2.services(verifyServiceSid)
      .verificationChecks
      .create({
        to: identifier, // Número de telefone
        code: providedCode
      });

    const isValid = verificationCheck.status === 'approved';
    console.log(`Código ${isValid ? 'válido' : 'inválido'} no Twilio Verify`);
    return isValid;
  } catch (error) {
    console.error('Erro ao verificar código no Twilio:', error);
    return false;
  }
}


