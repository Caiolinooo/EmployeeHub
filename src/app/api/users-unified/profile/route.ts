import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function PUT(request: NextRequest) {
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
    const updateData: any = await request.json();
    console.log('Dados recebidos para atualização:', updateData);

    // Remover campos que não devem ser atualizados diretamente ou que são validados separadamente
    delete updateData.id; // Não permitir alteração de ID
    delete updateData.email; // Email deve ser atualizado por outro endpoint se necessário
    delete updateData.phone_number; // Telefone deve ser atualizado por outro endpoint se necessário
    delete updateData.created_at; // Não permitir alteração da data de criação
    delete updateData.updated_at; // A data de atualização será definida abaixo

    // Adicionar data de atualização
    updateData.updated_at = new Date().toISOString();
    console.log('Dados após remoção de campos protegidos:', updateData);

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

    // Primeiro, buscar dados existentes do usuário
    const { data: existingUser, error: fetchError } = await supabase
      .from('users_unified')
      .select('*')
      .eq('id', payload.userId)
      .single();

    if (fetchError) {
      console.error('Erro ao buscar dados existentes do usuário:', {
        error: fetchError,
        message: fetchError.message,
        details: fetchError.details,
        hint: fetchError.hint,
        code: fetchError.code
      });
      return NextResponse.json(
        { 
          error: 'Erro ao buscar dados do usuário',
          details: fetchError.message
        },
        { status: 500 }
      );
    }

    // Mesclar dados existentes com atualizações
    const mergedData = {
      ...existingUser,
      ...updateData,
      updated_at: new Date().toISOString()
    };

    console.log('Dados mesclados para atualização:', mergedData);

    // Atualizar perfil do usuário com os dados mesclados
    const { error: updateError } = await supabase
      .from('users_unified')
      .update(mergedData)
      .eq('id', payload.userId);

    if (updateError) {
      console.error('Erro ao atualizar perfil:', {
        error: updateError,
        message: updateError.message,
        details: updateError.details,
        hint: updateError.hint,
        code: updateError.code
      });
      return NextResponse.json(
        { 
          error: 'Erro ao atualizar perfil',
          details: updateError.message,
          code: updateError.code,
          hint: updateError.hint
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Perfil atualizado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao processar requisição:', {
      error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
