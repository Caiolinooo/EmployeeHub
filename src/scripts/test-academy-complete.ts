/**
 * Script completo para testar todas as funcionalidades do ABZ Academy
 * Execute: npx ts-node src/scripts/test-academy-complete.ts
 */

import { supabaseAdmin } from '@/lib/supabase';

interface TestResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  details?: any;
}

class AcademyTester {
  private results: TestResult[] = [];

  private addResult(test: string, status: 'PASS' | 'FAIL' | 'WARN', message: string, details?: any) {
    this.results.push({ test, status, message, details });
    const emoji = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
    console.log(`${emoji} ${test}: ${message}`);
    if (details) {
      console.log('   Details:', details);
    }
  }

  async testDatabaseTables() {
    console.log('\n🔍 Testando tabelas do banco de dados...');

    const tables = [
      'academy_categories',
      'academy_courses', 
      'academy_enrollments',
      'academy_progress',
      'academy_comments',
      'academy_ratings'
    ];

    for (const table of tables) {
      try {
        const { data, error, count } = await supabaseAdmin
          .from(table)
          .select('*', { count: 'exact', head: true });

        if (error) {
          this.addResult(
            `Tabela ${table}`,
            'FAIL',
            `Erro ao acessar tabela: ${error.message}`,
            { code: error.code }
          );
        } else {
          this.addResult(
            `Tabela ${table}`,
            'PASS',
            `Tabela acessível com ${count || 0} registros`
          );
        }
      } catch (err) {
        this.addResult(
          `Tabela ${table}`,
          'FAIL',
          `Erro inesperado: ${err instanceof Error ? err.message : 'Erro desconhecido'}`
        );
      }
    }
  }

  async testAPIs() {
    console.log('\n🔍 Testando APIs do Academy...');

    const apiTests = [
      { endpoint: '/api/academy/categories', method: 'GET' },
      { endpoint: '/api/academy/courses', method: 'GET' },
      { endpoint: '/api/academy/enrollments', method: 'GET' },
      { endpoint: '/api/academy/progress', method: 'GET' },
      { endpoint: '/api/academy/comments', method: 'GET' },
      { endpoint: '/api/academy/ratings', method: 'GET' },
      { endpoint: '/api/academy/certificates', method: 'GET' },
      { endpoint: '/api/academy/notifications', method: 'GET' },
      { endpoint: '/api/academy/check-tables', method: 'GET' },
      { endpoint: '/api/academy/setup', method: 'GET' }
    ];

    for (const test of apiTests) {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const response = await fetch(`${baseUrl}${test.endpoint}`, {
          method: test.method,
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          this.addResult(
            `API ${test.endpoint}`,
            'PASS',
            `Resposta OK (${response.status})`,
            { hasData: !!data }
          );
        } else {
          this.addResult(
            `API ${test.endpoint}`,
            'FAIL',
            `Erro HTTP ${response.status}: ${response.statusText}`
          );
        }
      } catch (err) {
        this.addResult(
          `API ${test.endpoint}`,
          'FAIL',
          `Erro de conexão: ${err instanceof Error ? err.message : 'Erro desconhecido'}`
        );
      }
    }
  }

  async testCardsIntegration() {
    console.log('\n🔍 Testando integração do card Academy...');

    try {
      // Testar API de cards
      const { data: cards, error } = await supabaseAdmin
        .from('cards')
        .select('*')
        .eq('id', 'academy');

      if (error) {
        this.addResult(
          'Card Academy no Supabase',
          'FAIL',
          `Erro ao buscar card: ${error.message}`
        );
      } else if (!cards || cards.length === 0) {
        this.addResult(
          'Card Academy no Supabase',
          'WARN',
          'Card Academy não encontrado na tabela cards'
        );
      } else {
        const card = cards[0];
        this.addResult(
          'Card Academy no Supabase',
          'PASS',
          'Card Academy encontrado',
          {
            title: card.title,
            href: card.href,
            enabled: card.enabled,
            order: card.order
          }
        );
      }

      // Testar API de cards
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const cardsResponse = await fetch(`${baseUrl}/api/cards`);
      
      if (cardsResponse.ok) {
        const cardsData = await cardsResponse.json();
        const academyCard = cardsData.find((c: any) => c.id === 'academy');
        
        if (academyCard) {
          this.addResult(
            'Card Academy na API',
            'PASS',
            'Card Academy retornado pela API',
            academyCard
          );
        } else {
          this.addResult(
            'Card Academy na API',
            'WARN',
            'Card Academy não encontrado na resposta da API'
          );
        }
      } else {
        this.addResult(
          'API Cards',
          'FAIL',
          `Erro ao acessar API de cards: ${cardsResponse.status}`
        );
      }

    } catch (err) {
      this.addResult(
        'Integração Cards',
        'FAIL',
        `Erro inesperado: ${err instanceof Error ? err.message : 'Erro desconhecido'}`
      );
    }
  }

  async testSampleData() {
    console.log('\n🔍 Testando dados de exemplo...');

    try {
      // Verificar se há categorias
      const { data: categories, error: catError } = await supabaseAdmin
        .from('academy_categories')
        .select('*')
        .limit(5);

      if (catError) {
        this.addResult(
          'Categorias de exemplo',
          'FAIL',
          `Erro ao buscar categorias: ${catError.message}`
        );
      } else {
        this.addResult(
          'Categorias de exemplo',
          categories && categories.length > 0 ? 'PASS' : 'WARN',
          `${categories?.length || 0} categorias encontradas`
        );
      }

      // Verificar se há cursos
      const { data: courses, error: coursesError } = await supabaseAdmin
        .from('academy_courses')
        .select('*')
        .limit(5);

      if (coursesError) {
        this.addResult(
          'Cursos de exemplo',
          'FAIL',
          `Erro ao buscar cursos: ${coursesError.message}`
        );
      } else {
        this.addResult(
          'Cursos de exemplo',
          courses && courses.length > 0 ? 'PASS' : 'WARN',
          `${courses?.length || 0} cursos encontrados`
        );
      }

    } catch (err) {
      this.addResult(
        'Dados de exemplo',
        'FAIL',
        `Erro inesperado: ${err instanceof Error ? err.message : 'Erro desconhecido'}`
      );
    }
  }

  async runAllTests() {
    console.log('🚀 Iniciando testes completos do ABZ Academy...\n');

    await this.testDatabaseTables();
    await this.testAPIs();
    await this.testCardsIntegration();
    await this.testSampleData();

    this.printSummary();
  }

  private printSummary() {
    console.log('\n📊 RESUMO DOS TESTES');
    console.log('='.repeat(50));

    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const warnings = this.results.filter(r => r.status === 'WARN').length;

    console.log(`✅ Passou: ${passed}`);
    console.log(`❌ Falhou: ${failed}`);
    console.log(`⚠️  Avisos: ${warnings}`);
    console.log(`📋 Total: ${this.results.length}`);

    if (failed > 0) {
      console.log('\n❌ FALHAS ENCONTRADAS:');
      this.results
        .filter(r => r.status === 'FAIL')
        .forEach(r => console.log(`   - ${r.test}: ${r.message}`));
    }

    if (warnings > 0) {
      console.log('\n⚠️  AVISOS:');
      this.results
        .filter(r => r.status === 'WARN')
        .forEach(r => console.log(`   - ${r.test}: ${r.message}`));
    }

    console.log('\n🎯 PRÓXIMOS PASSOS:');
    if (failed > 0) {
      console.log('1. Corrigir as falhas encontradas');
      console.log('2. Executar as migrações SQL necessárias no Supabase');
      console.log('3. Verificar configurações de ambiente');
    }
    if (warnings > 0) {
      console.log('1. Adicionar dados de exemplo se necessário');
      console.log('2. Verificar configurações opcionais');
    }
    if (failed === 0 && warnings === 0) {
      console.log('🎉 Todos os testes passaram! O ABZ Academy está funcionando corretamente.');
    }
  }
}

// Executar testes se chamado diretamente
if (require.main === module) {
  const tester = new AcademyTester();
  tester.runAllTests().catch(console.error);
}

export default AcademyTester;
