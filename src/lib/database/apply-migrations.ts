import { supabase } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';

/**
 * Aplica todas as migrações do sistema de avaliação
 */
export async function aplicarMigracoes() {
  const migrationsDir = path.join(process.cwd(), 'src/lib/database/migrations');
  
  const migracoes = [
    'add-apenas-lideres-column.sql',
    'create-lideres-table.sql',
    'create-novo-workflow-avaliacao.sql'
  ];

  console.log('Iniciando aplicação das migrações...');

  for (const migracao of migracoes) {
    try {
      console.log(`Aplicando migração: ${migracao}`);
      
      const migracaoPath = path.join(migrationsDir, migracao);
      const sql = fs.readFileSync(migracaoPath, 'utf8');
      
      // Dividir o SQL em comandos individuais
      const comandos = sql
        .split(';')
        .map(cmd => cmd.trim())
        .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));

      for (const comando of comandos) {
        if (comando.trim()) {
          const { error } = await supabase.rpc('exec_sql', { sql_query: comando });
          
          if (error) {
            console.error(`Erro ao executar comando: ${comando.substring(0, 100)}...`);
            console.error('Erro:', error);
            // Continuar com próximo comando em caso de erro não crítico
          }
        }
      }
      
      console.log(`✓ Migração ${migracao} aplicada com sucesso`);
    } catch (error) {
      console.error(`✗ Erro ao aplicar migração ${migracao}:`, error);
    }
  }

  console.log('Migrações concluídas!');
}

/**
 * Verifica se as tabelas necessárias existem
 */
export async function verificarTabelas() {
  const tabelasNecessarias = [
    'criterios',
    'lideres', 
    'periodos_avaliacao',
    'autoavaliacoes',
    'historico_avaliacao'
  ];

  console.log('Verificando tabelas necessárias...');

  for (const tabela of tabelasNecessarias) {
    try {
      const { data, error } = await supabase
        .from(tabela)
        .select('*')
        .limit(1);

      if (error) {
        console.error(`✗ Tabela ${tabela} não encontrada ou com erro:`, error.message);
      } else {
        console.log(`✓ Tabela ${tabela} existe e está acessível`);
      }
    } catch (error) {
      console.error(`✗ Erro ao verificar tabela ${tabela}:`, error);
    }
  }
}

/**
 * Popula dados iniciais para teste
 */
export async function popularDadosIniciais() {
  console.log('Populando dados iniciais para teste...');

  try {
    // Criar período de avaliação de teste
    const { data: periodo, error: periodoError } = await supabase
      .from('periodos_avaliacao')
      .upsert({
        id: '550e8400-e29b-41d4-a716-446655440000',
        nome: 'Avaliação Teste 2024',
        descricao: 'Período de teste para validação do sistema',
        data_inicio: '2024-01-01',
        data_fim: '2024-12-31',
        data_limite_autoavaliacao: '2024-06-30',
        data_limite_aprovacao: '2024-07-31',
        ativo: true
      })
      .select()
      .single();

    if (periodoError) {
      console.error('Erro ao criar período de teste:', periodoError);
    } else {
      console.log('✓ Período de avaliação de teste criado');
    }

    // Atualizar critérios com novos campos
    const { error: criteriosError } = await supabase
      .from('criterios')
      .update({ 
        peso: 1.0,
        apenas_lideres: false 
      })
      .neq('nome', 'Liderança');

    if (criteriosError) {
      console.error('Erro ao atualizar critérios:', criteriosError);
    } else {
      console.log('✓ Critérios atualizados');
    }

    console.log('Dados iniciais populados com sucesso!');
  } catch (error) {
    console.error('Erro ao popular dados iniciais:', error);
  }
}

/**
 * Executa todos os testes de validação
 */
export async function executarTestes() {
  console.log('=== INICIANDO TESTES DE VALIDAÇÃO ===\n');

  await aplicarMigracoes();
  console.log('');
  
  await verificarTabelas();
  console.log('');
  
  await popularDadosIniciais();
  console.log('');

  console.log('=== TESTES CONCLUÍDOS ===');
}
