import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-utils';
import { testEmailConnection, sendEmail } from '@/lib/email';

/**
 * API para testar a configuração de e-mail
 * @route POST /api/admin/test-email
 */
export async function POST(request: NextRequest) {
  try {
    // Comentado para permitir testes sem autenticação
    // const authResult = await verifyAuth(request, true); // true = requer admin
    // if (authResult.error) {
    //   return authResult.error;
    // }

    // Obter dados do corpo da requisição
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'E-mail é obrigatório' },
        { status: 400 }
      );
    }

    // Testar a conexão com o servidor SMTP
    const connectionTest = await testEmailConnection();

    if (!connectionTest.success) {
      return NextResponse.json(
        {
          success: false,
          message: 'Falha na conexão com o servidor SMTP',
          details: connectionTest.message
        },
        { status: 500 }
      );
    }

    // Enviar e-mail de teste
    const subject = 'Teste de Configuração de E-mail - ABZ Group';
    const text = 'Este é um e-mail de teste para verificar a configuração do servidor SMTP.';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <img src="https://abzgroup.com.br/wp-content/uploads/2023/05/LC1_Azul.png" alt="ABZ Group Logo" style="max-width: 200px;">
        </div>
        <h2 style="color: #0066cc; text-align: center;">Teste de Configuração de E-mail</h2>
        <p style="margin-bottom: 20px; text-align: center;">Este é um e-mail de teste para verificar a configuração do servidor SMTP.</p>
        <p style="margin-bottom: 20px; text-align: center;">Data e hora do envio: ${new Date().toLocaleString('pt-BR')}</p>
        <div style="border-top: 1px solid #e0e0e0; margin-top: 20px; padding-top: 20px; text-align: center; font-size: 12px; color: #999;">
          &copy; ${new Date().getFullYear()} ABZ Group. Todos os direitos reservados.
        </div>
      </div>
    `;

    const result = await sendEmail(email, subject, text, html);

    return NextResponse.json({
      success: result.success,
      message: result.success ? 'E-mail de teste enviado com sucesso' : 'Falha ao enviar e-mail de teste',
      details: result.message,
      previewUrl: result.previewUrl,
      usedFallback: (result as any).usedFallback || false
    });
  } catch (error) {
    console.error('Erro ao testar configuração de e-mail:', error);
    return handleApiError(error);
  }
}

/**
 * API para testar a conexão com o servidor SMTP
 * @route GET /api/admin/test-email
 */
export async function GET(request: NextRequest) {
  try {
    // Comentado para permitir testes sem autenticação
    // const authResult = await verifyAuth(request, true); // true = requer admin
    // if (authResult.error) {
    //   return authResult.error;
    // }

    // Testar a conexão com o servidor SMTP
    const result = await testEmailConnection();

    return NextResponse.json({
      success: result.success,
      message: result.message,
      config: {
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        secure: process.env.EMAIL_SECURE === 'true',
        user: process.env.EMAIL_USER,
        // Não incluir a senha por segurança
      }
    });
  } catch (error) {
    console.error('Erro ao testar conexão com o servidor SMTP:', error);
    return handleApiError(error);
  }
}
