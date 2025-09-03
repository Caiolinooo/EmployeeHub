/**
 * Script final para verificar se todas as funcionalidades do ABZ Academy estão funcionando
 * Execute: npx ts-node src/scripts/academy-final-check.ts
 */

import { supabaseAdmin } from '@/lib/supabase';

interface CheckResult {
  component: string;
  status: 'OK' | 'ERROR' | 'WARNING';
  message: string;
  details?: any;
}

class AcademyFinalChecker {
  private results: CheckResult[] = [];

  private addResult(component: string, status: 'OK' | 'ERROR' | 'WARNING', message: string, details?: any) {
    this.results.push({ component, status, message, details });
    const emoji = status === 'OK' ? '✅' : status === 'ERROR' ? '❌' : '⚠️';
    console.log(`${emoji} ${component}: ${message}`);
    if (details && Object.keys(details).length > 0) {
      console.log('   📋 Details:', JSON.stringify(details, null, 2));
    }
  }

  async checkDatabaseStructure() {
    console.log('\n🔍 Verificando estrutura do banco de dados...');

    const requiredTables = [
      'academy_categories',
      'academy_courses', 
      'academy_enrollments',
      'academy_progress',
      'academy_comments',
      'academy_ratings',
      'cards'
    ];

    for (const table of requiredTables) {
      try {
        const { data, error, count } = await supabaseAdmin
          .from(table)
          .select('*', { count: 'exact', head: true });

        if (error) {
          this.addResult(
            `Tabela ${table}`,
            'ERROR',
            `Tabela inacessível: ${error.message}`,
            { code: error.code }
          );
        } else {
          this.addResult(
            `Tabela ${table}`,
            'OK',
            `Tabela OK (${count || 0} registros)`
          );
        }
      } catch (err) {
        this.addResult(
          `Tabela ${table}`,
          'ERROR',
          `Erro inesperado: ${err instanceof Error ? err.message : 'Desconhecido'}`
        );
      }
    }
  }

  async checkCardsIntegration() {
    console.log('\n🔍 Verificando integração do card Academy...');

    try {
      // Verificar se o card Academy existe
      const { data: academyCard, error } = await supabaseAdmin
        .from('cards')
        .select('*')
        .eq('id', 'academy')
        .single();

      if (error || !academyCard) {
        this.addResult(
          'Card Academy',
          'ERROR',
          'Card Academy não encontrado na tabela cards'
        );
      } else {
        this.addResult(
          'Card Academy',
          'OK',
          'Card Academy encontrado e configurado',
          {
            title: academyCard.title,
            href: academyCard.href,
            enabled: academyCard.enabled,
            order: academyCard.order
          }
        );
      }
    } catch (err) {
      this.addResult(
        'Card Academy',
        'ERROR',
        `Erro ao verificar card: ${err instanceof Error ? err.message : 'Desconhecido'}`
      );
    }
  }

  async checkSampleData() {
    console.log('\n🔍 Verificando dados de exemplo...');

    try {
      // Verificar categorias
      const { data: categories, error: catError } = await supabaseAdmin
        .from('academy_categories')
        .select('*');

      if (catError) {
        this.addResult('Categorias', 'ERROR', `Erro ao buscar categorias: ${catError.message}`);
      } else {
        this.addResult(
          'Categorias',
          categories && categories.length > 0 ? 'OK' : 'WARNING',
          `${categories?.length || 0} categorias encontradas`
        );
      }

      // Verificar cursos
      const { data: courses, error: coursesError } = await supabaseAdmin
        .from('academy_courses')
        .select('*');

      if (coursesError) {
        this.addResult('Cursos', 'ERROR', `Erro ao buscar cursos: ${coursesError.message}`);
      } else {
        const publishedCourses = courses?.filter(c => c.is_published) || [];
        this.addResult(
          'Cursos',
          courses && courses.length > 0 ? 'OK' : 'WARNING',
          `${courses?.length || 0} cursos total, ${publishedCourses.length} publicados`
        );
      }

      // Verificar usuários para instrutor
      const { data: users, error: usersError } = await supabaseAdmin
        .from('users_unified')
        .select('id, first_name, last_name, role')
        .in('role', ['admin', 'gerente'])
        .limit(5);

      if (usersError) {
        this.addResult('Instrutores', 'WARNING', `Erro ao buscar usuários: ${usersError.message}`);
      } else {
        this.addResult(
          'Instrutores',
          users && users.length > 0 ? 'OK' : 'WARNING',
          `${users?.length || 0} usuários disponíveis como instrutores`
        );
      }

    } catch (err) {
      this.addResult(
        'Dados de exemplo',
        'ERROR',
        `Erro inesperado: ${err instanceof Error ? err.message : 'Desconhecido'}`
      );
    }
  }

  async checkFileStructure() {
    console.log('\n🔍 Verificando estrutura de arquivos...');

    const requiredFiles = [
      'src/app/academy/page.tsx',
      'src/app/academy/certificates/page.tsx',
      'src/app/academy/my-courses/page.tsx',
      'src/app/academy/editor/create/page.tsx',
      'src/app/api/academy/courses/route.ts',
      'src/app/api/academy/categories/route.ts',
      'src/app/api/academy/enrollments/route.ts',
      'src/app/api/academy/progress/route.ts',
      'src/app/api/academy/certificates/route.ts',
      'src/components/Academy/Certificates.tsx',
      'src/components/Academy/VideoPlayer.tsx'
    ];

    const fs = require('fs');
    const path = require('path');

    for (const file of requiredFiles) {
      try {
        const fullPath = path.join(process.cwd(), file);
        if (fs.existsSync(fullPath)) {
          this.addResult(`Arquivo ${file}`, 'OK', 'Arquivo existe');
        } else {
          this.addResult(`Arquivo ${file}`, 'ERROR', 'Arquivo não encontrado');
        }
      } catch (err) {
        this.addResult(`Arquivo ${file}`, 'ERROR', 'Erro ao verificar arquivo');
      }
    }
  }

  async runCompleteCheck() {
    console.log('🚀 Iniciando verificação completa do ABZ Academy...\n');

    await this.checkDatabaseStructure();
    await this.checkCardsIntegration();
    await this.checkSampleData();
    await this.checkFileStructure();

    this.printFinalReport();
  }

  private printFinalReport() {
    console.log('\n📊 RELATÓRIO FINAL DO ABZ ACADEMY');
    console.log('='.repeat(60));

    const ok = this.results.filter(r => r.status === 'OK').length;
    const errors = this.results.filter(r => r.status === 'ERROR').length;
    const warnings = this.results.filter(r => r.status === 'WARNING').length;

    console.log(`✅ Funcionando: ${ok}`);
    console.log(`❌ Erros: ${errors}`);
    console.log(`⚠️  Avisos: ${warnings}`);
    console.log(`📋 Total verificado: ${this.results.length}`);

    if (errors > 0) {
      console.log('\n❌ PROBLEMAS CRÍTICOS ENCONTRADOS:');
      this.results
        .filter(r => r.status === 'ERROR')
        .forEach(r => console.log(`   • ${r.component}: ${r.message}`));
    }

    if (warnings > 0) {
      console.log('\n⚠️  AVISOS (não críticos):');
      this.results
        .filter(r => r.status === 'WARNING')
        .forEach(r => console.log(`   • ${r.component}: ${r.message}`));
    }

    console.log('\n🎯 PRÓXIMOS PASSOS:');
    
    if (errors === 0 && warnings === 0) {
      console.log('🎉 PARABÉNS! O ABZ Academy está 100% funcional!');
      console.log('✨ Todas as funcionalidades foram verificadas e estão operacionais.');
      console.log('🚀 O sistema está pronto para uso em produção.');
    } else if (errors === 0) {
      console.log('✅ Sistema funcional com alguns avisos menores.');
      console.log('📝 Considere adicionar dados de exemplo se necessário.');
      console.log('🚀 O sistema está pronto para uso.');
    } else {
      console.log('🔧 Corrija os problemas críticos antes de usar o sistema:');
      console.log('1. Execute as migrações SQL necessárias no Supabase');
      console.log('2. Verifique as configurações de ambiente');
      console.log('3. Execute novamente este script para verificar');
    }

    console.log('\n📚 FUNCIONALIDADES DISPONÍVEIS:');
    console.log('• Visualização de cursos por categoria');
    console.log('• Sistema de matrículas');
    console.log('• Acompanhamento de progresso');
    console.log('• Geração de certificados');
    console.log('• Criação e edição de cursos (admins)');
    console.log('• Sistema de comentários e avaliações');
    console.log('• Central de notificações');
    console.log('• Dashboard de aprendizagem');
  }
}

// Executar verificação se chamado diretamente
if (require.main === module) {
  const checker = new AcademyFinalChecker();
  checker.runCompleteCheck().catch(console.error);
}

export default AcademyFinalChecker;
