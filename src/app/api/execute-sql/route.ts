import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

// POST - Executar SQL diretamente
export async function POST(request: NextRequest) {
  try {
    const { error: authError } = await requirePermission(request, 'admin');
    if (authError) {
      return authError;
    }

    console.log('POST /api/execute-sql - Iniciando processamento');
    
    // Obter dados do corpo da requisição
    const body = await request.json();
    const { sql } = body;
    
    // Validar os dados de entrada
    if (!sql || typeof sql !== 'string') {
      console.error('SQL inválido:', sql);
      return NextResponse.json(
        { error: 'SQL inválido' },
        { status: 400 }
      );
    }
    
    // Tentar executar o SQL usando a função execute_sql
    try {
      const { error } = await supabaseAdmin.rpc('execute_sql', { query: sql });
      
      if (error) {
        console.error('Erro ao executar SQL via RPC:', error);
        
        if (error.message.includes('function execute_sql') && error.message.includes('does not exist')) {
          return NextResponse.json(
            { error: 'Função execute_sql não existe. Não será criada automaticamente.' },
            { status: 501 }
          );
        } else {
          return NextResponse.json(
            { error: `Erro ao executar SQL: ${error.message}` },
            { status: 500 }
          );
        }
      }
      
      console.log('SQL executado com sucesso');
      
      return NextResponse.json({
        success: true,
        message: 'SQL executado com sucesso'
      });
    } catch (rpcError) {
      console.error('Erro ao executar RPC:', rpcError);
      
      return NextResponse.json(
        { error: `Erro ao executar SQL: ${rpcError instanceof Error ? rpcError.message : String(rpcError)}` },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Erro ao processar requisição:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
