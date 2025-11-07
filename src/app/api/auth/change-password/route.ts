import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader || '');

    if (!token) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: 'Token inválido ou expirado' },
        { status: 401 }
      );
    }

    // Obter dados do corpo da requisição
    const body = await request.json();
    const { currentPassword, newPassword } = body;

    // Validar dados
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Senha atual e nova senha são obrigatórias' },
        { status: 400 }
      );
    }

    // Validar nova senha
    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'A nova senha deve ter pelo menos 8 caracteres' },
        { status: 400 }
      );
    }

    // Inicializar cliente Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Buscar usuário
    const { data: userData, error: userError } = await supabase
      .from('users_unified')
      .select('password, password_hash, access_history')
      .eq('id', payload.userId)
      .single();

    if (userError) {
      console.error('Erro ao buscar usuário:', userError);
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // Verificar senha atual
    const passwordToCheck = userData.password_hash || userData.password;
    if (!passwordToCheck) {
      return NextResponse.json(
        { error: 'Usuário não possui senha definida' },
        { status: 400 }
      );
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, passwordToCheck);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Senha atual incorreta' },
        { status: 400 }
      );
    }

    // Gerar hash da nova senha
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const now = new Date().toISOString();

    // Preparar o histórico de acesso atualizado
    const accessHistory = [
      ...(userData.access_history || []),
      {
        timestamp: now,
        action: 'PASSWORD_CHANGED',
        details: 'Senha alterada pelo usuário'
      }
    ];

    // Atualizar senha
    const { error: updateError } = await supabase
      .from('users_unified')
      .update({
        password: hashedPassword, // Manter compatibilidade com código existente
        password_hash: hashedPassword, // Usar nova coluna
        password_last_changed: now,
        updated_at: now,
        access_history: accessHistory
      })
      .eq('id', payload.userId);

    if (updateError) {
      console.error('Erro ao atualizar senha:', updateError);
      return NextResponse.json(
        { error: 'Erro ao alterar senha' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Senha alterada com sucesso'
    });
  } catch (error) {
    console.error('Erro ao processar requisição:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
