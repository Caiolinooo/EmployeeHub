import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAdminFromRequest } from '@/lib/auth';
import { criteriosPadrao } from '@/data/criterios-avaliacao';

export const dynamic = 'force-dynamic';

/**
 * Rota para criar a tabela de critérios e inserir critérios padrão
 */
export async function POST(request: NextRequest) {
  try {
    // Verificar se o usuário é administrador
    const adminCheck = await isAdminFromRequest(request);
    if (!adminCheck.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Acesso não autorizado' },
        { status: 403 }
      );
    }

    console.log('Iniciando criação da tabela criterios...');

    // Definir a estrutura da tabela
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS criterios (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        nome TEXT NOT NULL,
        descricao TEXT NOT NULL,
        categoria TEXT NOT NULL,
        peso FLOAT NOT NULL DEFAULT 1.0,
        pontuacao_maxima INTEGER NOT NULL DEFAULT 5,
        ativo BOOLEAN NOT NULL DEFAULT TRUE,
        deleted_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `;

    try {
      // Verificar se a tabela já existe
      const { data: tableExists, error: tableCheckError } = await supabaseAdmin
        .from('criterios')
        .select('id')
        .limit(1);

      if (tableCheckError && (tableCheckError.message.includes('does not exist') || tableCheckError.code === '42P01')) {
        console.log('Tabela criterios não existe, criando...');

        // Tentar criar a tabela usando execute_sql
        try {
          const { error: createTableError } = await supabaseAdmin.rpc('execute_sql', {
            sql: createTableSQL
          });

          if (createTableError) {
            console.error('Erro ao criar tabela usando execute_sql:', createTableError);
            
            // Se falhar, tentar método alternativo
            console.log('Tentando método alternativo para criar tabela...');
            
            // Usar o método de API REST diretamente
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
            const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
            
            if (!supabaseUrl || !supabaseKey) {
              throw new Error('Variáveis de ambiente do Supabase não configuradas');
            }
            
            // Tentar criar a tabela inserindo um registro temporário
            const { error: insertError } = await supabaseAdmin
              .from('criterios')
              .insert({
                id: criteriosPadrao[0].id,
                nome: criteriosPadrao[0].nome,
                descricao: criteriosPadrao[0].descricao,
                categoria: criteriosPadrao[0].categoria,
                peso: criteriosPadrao[0].peso,
                pontuacao_maxima: criteriosPadrao[0].pontuacao_maxima,
                ativo: true
              });
            
            if (insertError && !insertError.message.includes('already exists')) {
              throw new Error(`Erro ao criar tabela: ${insertError.message}`);
            }
          }
        } catch (error) {
          console.error('Erro ao criar tabela criterios:', error);
          return NextResponse.json(
            { success: false, error: `Erro ao criar tabela: ${error instanceof Error ? error.message : String(error)}` },
            { status: 500 }
          );
        }
      } else {
        console.log('Tabela criterios já existe');
      }

      // Inserir critérios padrão
      console.log('Inserindo critérios padrão...');
      
      // Verificar quais critérios já existem
      const { data: existingCriterios, error: existingError } = await supabaseAdmin
        .from('criterios')
        .select('id, nome')
        .is('deleted_at', null);
      
      if (existingError) {
        console.error('Erro ao verificar critérios existentes:', existingError);
      }
      
      const existingNames = new Set((existingCriterios || []).map(c => c.nome.toLowerCase()));
      
      // Filtrar apenas critérios que não existem
      const criteriosToInsert = criteriosPadrao.filter(c => !existingNames.has(c.nome.toLowerCase()));
      
      if (criteriosToInsert.length > 0) {
        console.log(`Inserindo ${criteriosToInsert.length} critérios padrão...`);
        
        const { error: insertError } = await supabaseAdmin
          .from('criterios')
          .insert(criteriosToInsert);
        
        if (insertError) {
          console.error('Erro ao inserir critérios padrão:', insertError);
          return NextResponse.json(
            { success: false, error: `Erro ao inserir critérios padrão: ${insertError.message}` },
            { status: 500 }
          );
        }
        
        console.log('Critérios padrão inseridos com sucesso!');
      } else {
        console.log('Todos os critérios padrão já existem no banco');
      }

      return NextResponse.json({
        success: true,
        message: 'Tabela criterios criada e critérios padrão inseridos com sucesso'
      });
    } catch (error) {
      console.error('Erro ao criar tabela criterios:', error);
      return NextResponse.json(
        { success: false, error: `Erro ao criar tabela: ${error instanceof Error ? error.message : String(error)}` },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Erro na requisição:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Rota para verificar se a tabela criterios existe
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar se o usuário é administrador
    const adminCheck = await isAdminFromRequest(request);
    if (!adminCheck.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Acesso não autorizado' },
        { status: 403 }
      );
    }

    console.log('Verificando se a tabela criterios existe...');

    // Verificar se a tabela existe
    const { data, error } = await supabaseAdmin
      .from('criterios')
      .select('id')
      .limit(1);

    if (error) {
      // Se a tabela não existir, retornar que ela não existe
      if (error.message.includes('does not exist') || error.code === '42P01') {
        return NextResponse.json({
          success: true,
          exists: false,
          message: 'Tabela criterios não existe'
        });
      }

      // Se for outro erro, retornar o erro
      return NextResponse.json(
        { success: false, error: `Erro ao verificar tabela: ${error.message}` },
        { status: 500 }
      );
    }

    // Contar quantos critérios existem
    const { count, error: countError } = await supabaseAdmin
      .from('criterios')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null);

    // Se chegou aqui, a tabela existe
    return NextResponse.json({
      success: true,
      exists: true,
      count: count || 0,
      message: 'Tabela criterios existe'
    });
  } catch (error) {
    console.error('Erro ao verificar tabela criterios:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao verificar tabela criterios', details: String(error) },
      { status: 500 }
    );
  }
}
