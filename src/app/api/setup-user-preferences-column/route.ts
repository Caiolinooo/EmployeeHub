import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { isAdminFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * API para adicionar a coluna de preferências à tabela users_unified
 */
export async function POST(request: Request) {
  try {
    // Verificar se o usuário é administrador
    const { isAdmin } = await isAdminFromRequest(request);
    
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores podem executar esta operação.' },
        { status: 403 }
      );
    }
    
    // Verificar se a coluna já existe
    const { data: columnExists, error: checkError } = await supabase
      .rpc('column_exists', {
        table_name: 'users_unified',
        column_name: 'preferences'
      });
      
    if (checkError) {
      return NextResponse.json(
        { error: 'Erro ao verificar coluna', details: checkError.message },
        { status: 500 }
      );
    }
    
    // Se a coluna já existe, retornar sucesso
    if (columnExists) {
      return NextResponse.json({
        success: true,
        message: 'Coluna preferences já existe na tabela users_unified'
      });
    }
    
    // Adicionar a coluna preferences à tabela users_unified
    const { error: addColumnError } = await supabase
      .rpc('execute_sql', {
        sql: `
          ALTER TABLE users_unified
          ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{"theme": "light", "language": "pt-BR", "notifications": true}'::jsonb;
        `
      });
      
    if (addColumnError) {
      return NextResponse.json(
        { error: 'Erro ao adicionar coluna', details: addColumnError.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Coluna preferences adicionada com sucesso à tabela users_unified'
    });
  } catch (error) {
    console.error('Erro ao adicionar coluna preferences:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
