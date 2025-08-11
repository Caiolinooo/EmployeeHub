import { NextRequest, NextResponse } from 'next/server';
import { testEmailConnection, sendVerificationEmail } from '@/lib/email';
import nodemailer from 'nodemailer';

export const dynamic = 'force-dynamic';

/**
 * API para depurar problemas com o serviço de email
 * @route GET /api/email/debug
 */
export async function GET(request: NextRequest) {
  try {
    // Obter parâmetros da URL
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action') || 'test';
    const email = searchParams.get('email') || 'caio.correia@groupabz.com';

    // Informações de configuração
    const config = {
      host: process.env.EMAIL_HOST || 'smtp.office365.com',
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: process.env.EMAIL_SECURE === 'true',
      user: process.env.EMAIL_USER || 'apiabz@groupabz.com',
      pass: process.env.EMAIL_PASSWORD || 'Caio@2122@',
      from: process.env.EMAIL_FROM || 'apiabz@groupabz.com',
      environment: process.env.NODE_ENV || 'development',
      apiKey: process.env.SENDGRID_API_KEY ? 'Configurado' : 'Não configurado'
    };

    // Verificar a ação solicitada
    switch (action) {
      case 'test':
        // Testar conexão com servidor de email
        const connectionResult = await testEmailConnection();
        return NextResponse.json({
          ...connectionResult,
          config
        });

      case 'send':
        // Enviar email de teste
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const sendResult = await sendVerificationEmail(email, code);
        return NextResponse.json({
          ...sendResult,
          config,
          code
        });

      case 'direct':
        // Testar envio direto com nodemailer
        const transporter = nodemailer.createTransport({
          host: config.host,
          port: config.port,
          secure: config.secure,
          auth: {
            user: config.user,
            pass: config.pass
          },
          tls: {
            rejectUnauthorized: process.env.NODE_ENV === 'production'
          }
        });

        // Verificar conexão
        await transporter.verify();

        // Enviar email de teste
        const testCode = Math.floor(100000 + Math.random() * 900000).toString();
        const info = await transporter.sendMail({
          from: `"ABZ Group" <${config.from}>`,
          to: email,
          subject: "Teste de Email - ABZ Group",
          text: `Este é um email de teste. Seu código é: ${testCode}`,
          html: `<p>Este é um email de teste.</p><p>Seu código é: <strong>${testCode}</strong></p>`
        });

        return NextResponse.json({
          success: true,
          messageId: info.messageId,
          config,
          code: testCode
        });

      default:
        // Ação desconhecida
        return NextResponse.json(
          { success: false, message: 'Ação desconhecida', config },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Erro ao processar solicitação de debug de email:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Erro ao processar solicitação: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        error: error instanceof Error ? error.stack : 'Sem stack trace'
      },
      { status: 500 }
    );
  }
}
