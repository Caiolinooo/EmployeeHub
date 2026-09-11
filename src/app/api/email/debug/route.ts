import { NextRequest, NextResponse } from 'next/server';
import { testEmailConnection, sendVerificationEmail } from '@/lib/email';
import { verifyAuth } from '@/lib/api-utils';
import nodemailer from 'nodemailer';
import { emailTlsOptions, resolveEmailAuth } from '@/lib/email-env';

export const dynamic = 'force-dynamic';

/**
 * API para depurar problemas com o serviço de email (somente ADMIN).
 * Nunca retorna senha ou segredos em texto plano.
 * @route GET /api/email/debug
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request, true);
    if (authResult.error) {
      return authResult.error;
    }

    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_EMAIL_DEBUG !== 'true') {
      return NextResponse.json(
        { success: false, message: 'Debug de email desabilitado em produção' },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action') || 'test';
    const email = searchParams.get('email');

    let auth;
    try {
      auth = await resolveEmailAuth();
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          message: error instanceof Error ? error.message : 'Credenciais de email ausentes',
        },
        { status: 500 }
      );
    }

    // Nunca expor senha
    const publicConfig = {
      host: auth.host,
      port: auth.port,
      secure: auth.secure,
      user: auth.user,
      passwordConfigured: Boolean(auth.pass),
      from: auth.from,
      environment: process.env.NODE_ENV || 'development',
      sendgridConfigured: Boolean(process.env.SENDGRID_API_KEY),
    };

    switch (action) {
      case 'test': {
        const connectionResult = await testEmailConnection();
        return NextResponse.json({
          ...connectionResult,
          config: publicConfig,
        });
      }

      case 'send': {
        if (!email) {
          return NextResponse.json(
            { success: false, message: 'Parâmetro email é obrigatório para action=send' },
            { status: 400 }
          );
        }
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const sendResult = await sendVerificationEmail(email, code);
        return NextResponse.json({
          ...sendResult,
          config: publicConfig,
          // Não retornar o código em produção
          code: process.env.NODE_ENV === 'production' ? undefined : code,
        });
      }

      case 'direct': {
        if (!email) {
          return NextResponse.json(
            { success: false, message: 'Parâmetro email é obrigatório para action=direct' },
            { status: 400 }
          );
        }

        const transporter = nodemailer.createTransport({
          host: auth.host,
          port: auth.port,
          secure: auth.secure,
          auth: {
            user: auth.user,
            pass: auth.pass,
          },
          tls: emailTlsOptions(),
        });

        await transporter.verify();

        const testCode = Math.floor(100000 + Math.random() * 900000).toString();
        const info = await transporter.sendMail({
          from: `"ABZ Group" <${auth.from}>`,
          to: email,
          subject: 'Teste de Email - ABZ Group',
          text: `Este é um email de teste. Seu código é: ${testCode}`,
          html: `<p>Este é um email de teste.</p><p>Seu código é: <strong>${testCode}</strong></p>`,
        });

        return NextResponse.json({
          success: true,
          messageId: info.messageId,
          config: publicConfig,
          code: process.env.NODE_ENV === 'production' ? undefined : testCode,
        });
      }

      default:
        return NextResponse.json(
          { success: false, message: 'Ação desconhecida', config: publicConfig },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Erro ao processar solicitação de debug de email:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Erro ao processar solicitação: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
      },
      { status: 500 }
    );
  }
}
