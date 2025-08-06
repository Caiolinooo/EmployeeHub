import { NextRequest, NextResponse } from 'next/server';
import { verifyEmailToken } from '@/lib/email-verification';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Token de verificação não fornecido' 
        },
        { status: 400 }
      );
    }

    console.log('Verificando token de email:', token);

    // Verificar o token
    const result = await verifyEmailToken(token);

    if (result.success) {
      console.log('Email verificado com sucesso para usuário:', result.user?.email);
      
      return NextResponse.json({
        success: true,
        message: 'Email verificado com sucesso',
        user: {
          id: result.user?.id,
          email: result.user?.email,
          first_name: result.user?.first_name,
          last_name: result.user?.last_name
        }
      });
    } else {
      console.log('Falha na verificação do token:', result.message);
      
      return NextResponse.json(
        { 
          success: false, 
          message: result.message 
        },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Erro ao processar verificação de email:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Erro interno do servidor' 
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Token de verificação não fornecido' 
        },
        { status: 400 }
      );
    }

    console.log('Verificando token de email via POST:', token);

    // Verificar o token
    const result = await verifyEmailToken(token);

    if (result.success) {
      console.log('Email verificado com sucesso para usuário:', result.user?.email);
      
      return NextResponse.json({
        success: true,
        message: 'Email verificado com sucesso',
        user: {
          id: result.user?.id,
          email: result.user?.email,
          first_name: result.user?.first_name,
          last_name: result.user?.last_name
        }
      });
    } else {
      console.log('Falha na verificação do token:', result.message);
      
      return NextResponse.json(
        { 
          success: false, 
          message: result.message 
        },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Erro ao processar verificação de email:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Erro interno do servidor' 
      },
      { status: 500 }
    );
  }
}
