import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export const dynamic = 'force-dynamic';

/**
 * API para testar a conexão com o Gmail usando configuração simplificada
 * @route GET /api/email/test-gmail
 */
export async function GET(request: NextRequest) {
  try {
    // Obter parâmetros da URL
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email') || 'caio.correia@groupabz.com';
    
    console.log('Testando conexão com Gmail usando configuração simplificada...');
    
    // Configuração simplificada do Gmail
    const user = process.env.EMAIL_USER || 'apiabzgroup@gmail.com';
    const pass = process.env.EMAIL_PASSWORD || 'zbli vdst fmco dtfc';
    
    console.log('Configuração:', {
      service: 'gmail',
      user,
      // Não logar a senha por segurança
    });
    
    // Criar transporter com configuração simplificada
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user,
        pass
      }
    });
    
    // Verificar conexão
    console.log('Verificando conexão...');
    await transporter.verify();
    console.log('Conexão verificada com sucesso!');
    
    // Enviar email de teste
    if (email) {
      console.log(`Enviando email de teste para ${email}...`);
      
      const info = await transporter.sendMail({
        from: `"ABZ Group Test" <${user}>`,
        to: email,
        subject: "Teste de Email - ABZ Group",
        text: "Este é um email de teste do sistema ABZ Group.",
        html: "<p>Este é um email de teste do sistema <strong>ABZ Group</strong>.</p>"
      });
      
      console.log('Email enviado com sucesso:', info.messageId);
      
      return NextResponse.json({
        success: true,
        message: 'Conexão verificada e email enviado com sucesso',
        messageId: info.messageId,
        config: {
          service: 'gmail',
          user,
          email
        }
      });
    }
    
    return NextResponse.json({
      success: true,
      message: 'Conexão com Gmail verificada com sucesso',
      config: {
        service: 'gmail',
        user
      }
    });
  } catch (error) {
    console.error('Erro ao testar conexão com Gmail:', error);
    
    if (error instanceof Error) {
      console.error('Detalhes do erro:', error.message);
      console.error('Stack trace:', error.stack);
    }
    
    return NextResponse.json(
      {
        success: false,
        message: `Erro ao testar conexão: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        error: error instanceof Error ? error.stack : 'Sem stack trace'
      },
      { status: 500 }
    );
  }
}
