import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

/**
 * API para enviar um e-mail de teste
 * @route POST /api/email/send-test
 */
export async function POST(request: Request) {
  try {
    // Obter os dados da requisição
    const data = await request.json();
    const { email } = data;

    // Validar o e-mail
    if (!email) {
      return NextResponse.json(
        {
          success: false,
          message: 'E-mail não fornecido'
        },
        { status: 400 }
      );
    }

    console.log(`Enviando e-mail de teste para ${email}...`);

    // Preparar o conteúdo do e-mail
    const subject = 'Teste de E-mail - ABZ Group';
    const text = 'Este é um e-mail de teste enviado pelo sistema ABZ Group.';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <img src="${process.env.EMAIL_LOGO_URL || 'https://abzgroup.com.br/wp-content/uploads/2023/05/LC1_Azul.png'}" alt="ABZ Group Logo" style="max-width: 200px;">
        </div>
        <h2 style="color: #0066cc; text-align: center;">Teste de E-mail</h2>
        <p style="margin-bottom: 20px; text-align: center;">Este é um e-mail de teste enviado pelo sistema ABZ Group.</p>
        <p style="margin-bottom: 20px; text-align: center;">Data e hora do envio: ${new Date().toLocaleString('pt-BR')}</p>
        <div style="border-top: 1px solid #e0e0e0; margin-top: 20px; padding-top: 20px; text-align: center; font-size: 12px; color: #999;">
          &copy; ${new Date().getFullYear()} ABZ Group. Todos os direitos reservados.
        </div>
      </div>
    `;

    // Enviar o e-mail
    const result = await sendEmail(email, subject, text, html);

    // Retornar o resultado
    return NextResponse.json(result);
  } catch (error) {
    console.error('Erro ao enviar e-mail de teste:', error);

    // Retornar erro
    return NextResponse.json(
      {
        success: false,
        message: `Erro ao enviar e-mail de teste: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      },
      { status: 500 }
    );
  }
}
