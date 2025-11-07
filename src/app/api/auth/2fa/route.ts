import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

export const dynamic = 'force-dynamic';

// Rota para gerar um segredo 2FA para o usuário
export async function POST(req: NextRequest) {
  try {
    // Verificar autenticação
    const authHeader = req.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader || '');
    
    if (!token) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    
    const payload = verifyToken(token);
    
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }
    
    // Gerar um segredo para 2FA
    const secret = speakeasy.generateSecret({
      name: `ABZ Group (${payload.userId})`,
      length: 20
    });
    
    // Gerar QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url || '');
    
    // Salvar o segredo no banco de dados
    const { error } = await supabase
      .from('user_2fa')
      .upsert({
        user_id: payload.userId,
        secret: secret.base32,
        enabled: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    
    if (error) {
      console.error('Erro ao salvar segredo 2FA:', error);
      return NextResponse.json({ error: 'Erro ao configurar 2FA' }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      secret: secret.base32,
      qrCode: qrCodeUrl
    });
  } catch (error) {
    console.error('Erro ao gerar segredo 2FA:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// Rota para verificar e ativar 2FA
export async function PUT(req: NextRequest) {
  try {
    // Verificar autenticação
    const authHeader = req.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader || '');
    
    if (!token) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    
    const payload = verifyToken(token);
    
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }
    
    // Obter o código do corpo da requisição
    const body = await req.json();
    const { code, enabled } = body;
    
    if (enabled === false) {
      // Desativar 2FA
      const { error } = await supabase
        .from('user_2fa')
        .update({
          enabled: false,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', payload.userId);
      
      if (error) {
        console.error('Erro ao desativar 2FA:', error);
        return NextResponse.json({ error: 'Erro ao desativar 2FA' }, { status: 500 });
      }
      
      return NextResponse.json({
        success: true,
        message: 'Autenticação de dois fatores desativada com sucesso'
      });
    }
    
    // Verificar se o código é válido
    if (!code) {
      return NextResponse.json({ error: 'Código não fornecido' }, { status: 400 });
    }
    
    // Buscar o segredo do usuário
    const { data: userData, error: userError } = await supabase
      .from('user_2fa')
      .select('secret')
      .eq('user_id', payload.userId)
      .single();
    
    if (userError || !userData) {
      console.error('Erro ao buscar segredo 2FA:', userError);
      return NextResponse.json({ error: 'Erro ao verificar 2FA' }, { status: 500 });
    }
    
    // Verificar o código
    const verified = speakeasy.totp.verify({
      secret: userData.secret,
      encoding: 'base32',
      token: code,
      window: 1 // Permitir uma pequena janela de tempo para compensar diferenças de relógio
    });
    
    if (!verified) {
      return NextResponse.json({ error: 'Código inválido' }, { status: 400 });
    }
    
    // Ativar 2FA
    const { error } = await supabase
      .from('user_2fa')
      .update({
        enabled: true,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', payload.userId);
    
    if (error) {
      console.error('Erro ao ativar 2FA:', error);
      return NextResponse.json({ error: 'Erro ao ativar 2FA' }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      message: 'Autenticação de dois fatores ativada com sucesso'
    });
  } catch (error) {
    console.error('Erro ao verificar código 2FA:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// Rota para verificar status do 2FA
export async function GET(req: NextRequest) {
  try {
    // Verificar autenticação
    const authHeader = req.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader || '');
    
    if (!token) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    
    const payload = verifyToken(token);
    
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }
    
    // Buscar configuração 2FA do usuário
    const { data, error } = await supabase
      .from('user_2fa')
      .select('enabled, created_at, updated_at')
      .eq('user_id', payload.userId)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      console.error('Erro ao buscar status 2FA:', error);
      return NextResponse.json({ error: 'Erro ao verificar status 2FA' }, { status: 500 });
    }
    
    return NextResponse.json({
      enabled: data?.enabled || false,
      configured: !!data,
      createdAt: data?.created_at,
      updatedAt: data?.updated_at
    });
  } catch (error) {
    console.error('Erro ao verificar status 2FA:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
