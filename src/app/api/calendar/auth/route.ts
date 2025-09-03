import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

// Configuração OAuth2 do Google Calendar
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXTAUTH_URL}/api/calendar/callback`
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'url') {
      // Gerar URL de autorização
      const scopes = [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events'
      ];

      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        prompt: 'consent'
      });

      return NextResponse.json({
        authUrl,
        message: 'URL de autorização gerada com sucesso'
      });
    }

    if (action === 'status') {
      // Verificar status da autenticação
      // Aqui você verificaria se o usuário já tem tokens salvos
      return NextResponse.json({
        authenticated: false,
        message: 'Usuário não autenticado com Google Calendar'
      });
    }

    return NextResponse.json({
      message: 'API de autenticação do Google Calendar',
      endpoints: {
        'GET ?action=url': 'Gera URL de autorização',
        'GET ?action=status': 'Verifica status da autenticação',
        'POST': 'Processa callback de autorização'
      }
    });

  } catch (error) {
    console.error('Erro na autenticação do Google Calendar:', error);
    return NextResponse.json({
      error: 'Erro interno na autenticação',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, userId } = body;

    if (!code) {
      return NextResponse.json({
        error: 'Código de autorização é obrigatório'
      }, { status: 400 });
    }

    console.log('🔐 Processando código de autorização do Google Calendar...');

    // Trocar código por tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    console.log('✅ Tokens obtidos com sucesso');

    // Aqui você salvaria os tokens no banco de dados associados ao usuário
    // Por enquanto, vamos simular o salvamento
    const tokenData = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date,
      token_type: tokens.token_type,
      scope: tokens.scope
    };

    // TODO: Salvar tokens no banco de dados
    // await supabaseAdmin
    //   .from('user_google_tokens')
    //   .upsert({
    //     user_id: userId,
    //     tokens: tokenData,
    //     updated_at: new Date().toISOString()
    //   });

    return NextResponse.json({
      message: 'Autenticação realizada com sucesso',
      authenticated: true,
      tokens: {
        hasAccessToken: !!tokens.access_token,
        hasRefreshToken: !!tokens.refresh_token,
        expiryDate: tokens.expiry_date
      }
    });

  } catch (error) {
    console.error('Erro ao processar código de autorização:', error);
    return NextResponse.json({
      error: 'Erro ao processar autorização',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}
