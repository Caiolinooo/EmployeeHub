import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';

export const dynamic = 'force-dynamic';

// POST - Executar SQL diretamente
export async function POST(request: NextRequest) {
  try {
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
    
    console.log('Executando SQL:', sql);
    
    // Tentar executar o SQL usando a função execute_sql
    try {
      const { error } = await supabaseAdmin.rpc('execute_sql', { query: sql });
      
      if (error) {
        console.error('Erro ao executar SQL via RPC:', error);
        
        // Tentar criar a função execute_sql se ela não existir
        if (error.message.includes('function execute_sql') && error.message.includes('does not exist')) {
          console.log('Função execute_sql não existe, tentando criar...');
          
          // SQL para criar a função execute_sql
          const createFunctionSQL = `
            CREATE OR REPLACE FUNCTION execute_sql(query text)
            RETURNS VOID AS $$
            BEGIN
              EXECUTE query;
            END;
            $$ LANGUAGE plpgsql SECURITY DEFINER;
          `;
          
          // Executar SQL diretamente via API REST do Supabase
          const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/execute_sql`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': process.env.SUPABASE_SERVICE_KEY || '',
              'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY || ''}`
            },
            body: JSON.stringify({ query: createFunctionSQL })
          });
          
          if (!response.ok) {
            console.error('Erro ao criar função execute_sql:', await response.text());
            return NextResponse.json(
              { error: 'Erro ao criar função execute_sql' },
              { status: 500 }
            );
          }
          
          console.log('Função execute_sql criada com sucesso, tentando executar SQL novamente...');
          
          // Tentar executar o SQL novamente
          const { error: retryError } = await supabaseAdmin.rpc('execute_sql', { query: sql });
          
          if (retryError) {
            console.error('Erro ao executar SQL após criar função:', retryError);
            return NextResponse.json(
              { error: `Erro ao executar SQL: ${retryError.message}` },
              { status: 500 }
            );
          }
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
