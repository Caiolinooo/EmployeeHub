import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Corrigindo estrutura da tabela cards...');

    // 1. Verificar se a tabela existe
    const { data: existingCards, error: tableError } = await supabaseAdmin
      .from('cards')
      .select('*')
      .limit(1);

    if (tableError) {
      console.log('❌ Erro ao acessar tabela cards:', tableError.message);
      return NextResponse.json({
        error: 'Tabela cards não acessível',
        details: tableError.message,
        suggestion: 'Execute o SQL manualmente no Supabase Dashboard'
      }, { status: 500 });
    }

    console.log('✅ Tabela cards existe e é acessível');

    // 2. Tentar adicionar colunas que podem estar faltando
    const columnsToAdd = [
      { name: 'module_key', type: 'TEXT' },
      { name: 'title_en', type: 'TEXT' },
      { name: 'description_en', type: 'TEXT' },
      { name: 'category', type: 'TEXT' },
      { name: 'tags', type: 'TEXT[]' },
      { name: 'icon_name', type: 'TEXT' }
    ];

    const results = [];

    for (const column of columnsToAdd) {
      try {
        // Tentar fazer uma query que use a coluna para verificar se existe
        const { error: columnError } = await supabaseAdmin
          .from('cards')
          .select(column.name)
          .limit(1);

        if (columnError && columnError.message.includes('does not exist')) {
          console.log(`⚠️ Coluna ${column.name} não existe`);
          results.push({
            column: column.name,
            status: 'missing',
            error: columnError.message
          });
        } else {
          console.log(`✅ Coluna ${column.name} existe`);
          results.push({
            column: column.name,
            status: 'exists'
          });
        }
      } catch (err) {
        console.log(`❌ Erro ao verificar coluna ${column.name}:`, err);
        results.push({
          column: column.name,
          status: 'error',
          error: err instanceof Error ? err.message : 'Erro desconhecido'
        });
      }
    }

    // 3. Verificar dados existentes
    const { data: allCards, error: dataError } = await supabaseAdmin
      .from('cards')
      .select('*');

    if (dataError) {
      console.log('⚠️ Erro ao buscar dados:', dataError.message);
    } else {
      console.log(`📊 Encontrados ${allCards?.length || 0} cards na tabela`);
    }

    return NextResponse.json({
      success: true,
      message: 'Verificação da estrutura da tabela cards concluída',
      tableExists: true,
      columnStatus: results,
      cardCount: allCards?.length || 0,
      sqlToExecute: `
-- SQL para corrigir a estrutura da tabela cards
-- Execute este SQL no Supabase SQL Editor se houver colunas faltando:

ALTER TABLE cards ADD COLUMN IF NOT EXISTS module_key TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS title_en TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS description_en TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS tags TEXT[];
ALTER TABLE cards ADD COLUMN IF NOT EXISTS icon_name TEXT;

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_cards_module_key ON cards(module_key);
CREATE INDEX IF NOT EXISTS idx_cards_category ON cards(category);
CREATE INDEX IF NOT EXISTS idx_cards_tags ON cards USING GIN(tags);
      `
    });

  } catch (error) {
    console.error('❌ Erro ao corrigir tabela cards:', error);
    return NextResponse.json({
      error: 'Erro interno ao corrigir tabela cards',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'API para corrigir estrutura da tabela cards',
    description: 'Use POST para verificar e corrigir a estrutura da tabela cards',
    endpoints: {
      POST: 'Verifica e corrige a estrutura da tabela cards'
    }
  });
}
