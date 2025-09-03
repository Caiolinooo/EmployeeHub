/**
 * Script para testar o sistema completo de cards do Supabase
 * Verifica se todas as funcionalidades estão funcionando corretamente
 */

import { supabaseAdmin } from '@/lib/supabase';

interface TestResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  details?: any;
}

async function testCardsSystem(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  
  console.log('🧪 Iniciando testes do sistema de cards...\n');

  // Teste 1: Verificar se a tabela cards existe
  try {
    const { data: tableCheck, error: tableError } = await supabaseAdmin
      .from('cards')
      .select('id')
      .limit(1);

    if (tableError) {
      if (tableError.message.includes('does not exist') || tableError.code === '42P01') {
        results.push({
          test: 'Existência da tabela cards',
          status: 'FAIL',
          message: 'Tabela cards não existe',
          details: tableError
        });
      } else {
        results.push({
          test: 'Existência da tabela cards',
          status: 'WARN',
          message: 'Erro ao acessar tabela cards',
          details: tableError
        });
      }
    } else {
      results.push({
        test: 'Existência da tabela cards',
        status: 'PASS',
        message: 'Tabela cards existe e é acessível'
      });
    }
  } catch (error) {
    results.push({
      test: 'Existência da tabela cards',
      status: 'FAIL',
      message: 'Erro crítico ao verificar tabela',
      details: error
    });
  }

  // Teste 2: Verificar estrutura da tabela
  try {
    const { data: cards, error } = await supabaseAdmin
      .from('cards')
      .select('id, title, module_key, icon_name, enabled, order')
      .limit(1);

    if (error) {
      results.push({
        test: 'Estrutura da tabela cards',
        status: 'FAIL',
        message: 'Erro ao verificar estrutura da tabela',
        details: error
      });
    } else {
      const requiredFields = ['id', 'title', 'module_key', 'icon_name', 'enabled', 'order'];
      const hasAllFields = cards && cards.length > 0 && 
        requiredFields.every(field => cards[0].hasOwnProperty(field));

      results.push({
        test: 'Estrutura da tabela cards',
        status: hasAllFields ? 'PASS' : 'WARN',
        message: hasAllFields 
          ? 'Tabela tem todos os campos necessários' 
          : 'Alguns campos podem estar faltando',
        details: cards?.[0]
      });
    }
  } catch (error) {
    results.push({
      test: 'Estrutura da tabela cards',
      status: 'FAIL',
      message: 'Erro ao verificar estrutura',
      details: error
    });
  }

  // Teste 3: Verificar se há cards na tabela
  try {
    const { data: cards, error } = await supabaseAdmin
      .from('cards')
      .select('id, title, enabled')
      .order('order', { ascending: true });

    if (error) {
      results.push({
        test: 'Conteúdo da tabela cards',
        status: 'FAIL',
        message: 'Erro ao buscar cards',
        details: error
      });
    } else if (!cards || cards.length === 0) {
      results.push({
        test: 'Conteúdo da tabela cards',
        status: 'WARN',
        message: 'Tabela cards está vazia',
        details: { count: 0 }
      });
    } else {
      const enabledCount = cards.filter(card => card.enabled).length;
      results.push({
        test: 'Conteúdo da tabela cards',
        status: 'PASS',
        message: `${cards.length} cards encontrados (${enabledCount} habilitados)`,
        details: { total: cards.length, enabled: enabledCount }
      });
    }
  } catch (error) {
    results.push({
      test: 'Conteúdo da tabela cards',
      status: 'FAIL',
      message: 'Erro ao verificar conteúdo',
      details: error
    });
  }

  // Teste 4: Verificar se o card Academy existe
  try {
    const { data: academyCard, error } = await supabaseAdmin
      .from('cards')
      .select('*')
      .eq('id', 'academy')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        results.push({
          test: 'Card Academy',
          status: 'FAIL',
          message: 'Card Academy não encontrado',
          details: { id: 'academy', found: false }
        });
      } else {
        results.push({
          test: 'Card Academy',
          status: 'WARN',
          message: 'Erro ao buscar card Academy',
          details: error
        });
      }
    } else {
      results.push({
        test: 'Card Academy',
        status: 'PASS',
        message: 'Card Academy encontrado e configurado',
        details: {
          id: academyCard.id,
          title: academyCard.title,
          module_key: academyCard.module_key,
          enabled: academyCard.enabled,
          href: academyCard.href
        }
      });
    }
  } catch (error) {
    results.push({
      test: 'Card Academy',
      status: 'FAIL',
      message: 'Erro ao verificar card Academy',
      details: error
    });
  }

  // Teste 5: Verificar cards com module_key
  try {
    const { data: cardsWithModule, error } = await supabaseAdmin
      .from('cards')
      .select('id, title, module_key')
      .not('module_key', 'is', null);

    if (error) {
      results.push({
        test: 'Cards com module_key',
        status: 'WARN',
        message: 'Erro ao verificar module_keys',
        details: error
      });
    } else {
      const moduleKeys = cardsWithModule?.map(card => card.module_key) || [];
      const uniqueModules = [...new Set(moduleKeys)];
      
      results.push({
        test: 'Cards com module_key',
        status: cardsWithModule && cardsWithModule.length > 0 ? 'PASS' : 'WARN',
        message: `${cardsWithModule?.length || 0} cards com module_key (${uniqueModules.length} módulos únicos)`,
        details: {
          cards_with_module: cardsWithModule?.length || 0,
          unique_modules: uniqueModules,
          modules: moduleKeys
        }
      });
    }
  } catch (error) {
    results.push({
      test: 'Cards com module_key',
      status: 'FAIL',
      message: 'Erro ao verificar module_keys',
      details: error
    });
  }

  // Teste 6: Testar API de cards
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/cards`);
    
    if (response.ok) {
      const apiCards = await response.json();
      const academyCardFromAPI = apiCards.find((card: any) => card.id === 'academy');
      
      results.push({
        test: 'API /api/cards',
        status: 'PASS',
        message: `API retornou ${apiCards.length} cards`,
        details: {
          total_cards: apiCards.length,
          academy_found: !!academyCardFromAPI,
          academy_details: academyCardFromAPI ? {
            id: academyCardFromAPI.id,
            title: academyCardFromAPI.title,
            moduleKey: academyCardFromAPI.moduleKey,
            enabled: academyCardFromAPI.enabled
          } : null
        }
      });
    } else {
      results.push({
        test: 'API /api/cards',
        status: 'FAIL',
        message: `API retornou erro: ${response.status}`,
        details: { status: response.status, statusText: response.statusText }
      });
    }
  } catch (error) {
    results.push({
      test: 'API /api/cards',
      status: 'FAIL',
      message: 'Erro ao testar API',
      details: error
    });
  }

  // Teste 7: Testar API do Supabase
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/cards/supabase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'test-user',
        userRole: 'user',
        userEmail: 'test@example.com'
      })
    });
    
    if (response.ok) {
      const supabaseCards = await response.json();
      const academyCardFromSupabase = supabaseCards.find((card: any) => card.id === 'academy');
      
      results.push({
        test: 'API /api/cards/supabase',
        status: 'PASS',
        message: `API Supabase retornou ${supabaseCards.length} cards`,
        details: {
          total_cards: supabaseCards.length,
          academy_found: !!academyCardFromSupabase,
          academy_details: academyCardFromSupabase
        }
      });
    } else {
      results.push({
        test: 'API /api/cards/supabase',
        status: 'FAIL',
        message: `API Supabase retornou erro: ${response.status}`,
        details: { status: response.status, statusText: response.statusText }
      });
    }
  } catch (error) {
    results.push({
      test: 'API /api/cards/supabase',
      status: 'FAIL',
      message: 'Erro ao testar API Supabase',
      details: error
    });
  }

  return results;
}

async function runTests() {
  console.log('🧪 TESTE DO SISTEMA DE CARDS DO SUPABASE');
  console.log('==========================================\n');

  const results = await testCardsSystem();
  
  let passCount = 0;
  let warnCount = 0;
  let failCount = 0;

  results.forEach((result, index) => {
    const icon = result.status === 'PASS' ? '✅' : result.status === 'WARN' ? '⚠️' : '❌';
    console.log(`${index + 1}. ${icon} ${result.test}`);
    console.log(`   ${result.message}`);
    
    if (result.details && typeof result.details === 'object') {
      console.log(`   Detalhes:`, JSON.stringify(result.details, null, 2));
    }
    console.log('');

    if (result.status === 'PASS') passCount++;
    else if (result.status === 'WARN') warnCount++;
    else failCount++;
  });

  console.log('==========================================');
  console.log(`📊 RESUMO DOS TESTES:`);
  console.log(`✅ Passou: ${passCount}`);
  console.log(`⚠️  Avisos: ${warnCount}`);
  console.log(`❌ Falhou: ${failCount}`);
  console.log(`📋 Total: ${results.length}`);
  
  const overallStatus = failCount === 0 ? (warnCount === 0 ? 'SUCESSO' : 'SUCESSO COM AVISOS') : 'FALHA';
  console.log(`🎯 Status Geral: ${overallStatus}`);

  return {
    results,
    summary: { pass: passCount, warn: warnCount, fail: failCount, total: results.length },
    status: overallStatus
  };
}

// Executar apenas se chamado diretamente
if (require.main === module) {
  runTests()
    .then((result) => {
      process.exit(result.summary.fail > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error('❌ Erro fatal nos testes:', error);
      process.exit(1);
    });
}

export { testCardsSystem, runTests };
