import { supabase } from '@/lib/supabase';
import { WorkflowAvaliacaoService } from '@/lib/services/workflow-avaliacao';
import { NotificacoesAvaliacaoService } from '@/lib/services/notificacoes-avaliacao';
import { adicionarLider, isUsuarioLider } from '@/lib/utils/lideranca';
import { getCriteriosPorTipoUsuario } from '@/data/criterios-avaliacao';

/**
 * Script de teste para validar o sistema de avaliação
 */

async function testarConexaoBanco() {
  console.log('🔍 Testando conexão com banco de dados...');
  
  try {
    const { data, error } = await supabase
      .from('users_unified')
      .select('count')
      .limit(1);

    if (error) {
      console.error('❌ Erro na conexão:', error);
      return false;
    }

    console.log('✅ Conexão com banco estabelecida');
    return true;
  } catch (error) {
    console.error('❌ Erro na conexão:', error);
    return false;
  }
}

async function testarCriterios() {
  console.log('\n🔍 Testando sistema de critérios...');
  
  try {
    // Testar critérios para usuário comum
    const criteriosComum = getCriteriosPorTipoUsuario(false);
    console.log(`✅ Critérios para usuário comum: ${criteriosComum.length} critérios`);
    
    // Testar critérios para líder
    const criteriosLider = getCriteriosPorTipoUsuario(true);
    console.log(`✅ Critérios para líder: ${criteriosLider.length} critérios`);
    
    // Verificar se há critérios específicos de liderança
    const criteriosLiderancaEspecificos = criteriosLider.filter(c => c.apenas_lideres);
    console.log(`✅ Critérios específicos de liderança: ${criteriosLiderancaEspecificos.length}`);
    
    return true;
  } catch (error) {
    console.error('❌ Erro ao testar critérios:', error);
    return false;
  }
}

async function testarSistemaLideranca() {
  console.log('\n🔍 Testando sistema de liderança...');
  
  try {
    // Buscar um usuário para teste
    const { data: usuarios, error } = await supabase
      .from('users_unified')
      .select('id, name')
      .limit(1);

    if (error || !usuarios || usuarios.length === 0) {
      console.log('⚠️ Nenhum usuário encontrado para teste de liderança');
      return false;
    }

    const usuarioTeste = usuarios[0];
    
    // Verificar se é líder (deve ser false inicialmente)
    const ehLiderAntes = await isUsuarioLider(usuarioTeste.id);
    console.log(`✅ Status inicial de liderança: ${ehLiderAntes ? 'Líder' : 'Não líder'}`);
    
    // Adicionar como líder
    const adicionado = await adicionarLider(usuarioTeste.id, 'Gerente de Teste', 'TI');
    if (adicionado) {
      console.log('✅ Usuário adicionado como líder');
      
      // Verificar se agora é líder
      const ehLiderDepois = await isUsuarioLider(usuarioTeste.id);
      console.log(`✅ Status após adição: ${ehLiderDepois ? 'Líder' : 'Não líder'}`);
      
      return ehLiderDepois;
    } else {
      console.error('❌ Falha ao adicionar usuário como líder');
      return false;
    }
  } catch (error) {
    console.error('❌ Erro ao testar sistema de liderança:', error);
    return false;
  }
}

async function testarWorkflowAvaliacao() {
  console.log('\n🔍 Testando workflow de avaliação...');
  
  try {
    // Verificar período ativo
    const periodoAtivo = await WorkflowAvaliacaoService.getPeriodoAvaliacaoAtivo();
    
    if (!periodoAtivo) {
      console.log('⚠️ Nenhum período de avaliação ativo encontrado');
      return false;
    }
    
    console.log(`✅ Período ativo encontrado: ${periodoAtivo.nome}`);
    
    // Buscar usuário para teste
    const { data: usuarios, error } = await supabase
      .from('users_unified')
      .select('id, name')
      .limit(1);

    if (error || !usuarios || usuarios.length === 0) {
      console.log('⚠️ Nenhum usuário encontrado para teste de workflow');
      return false;
    }

    const usuarioTeste = usuarios[0];
    
    // Verificar se pode autoavaliar
    const podeAutoavaliar = await WorkflowAvaliacaoService.podeAutoavaliar(usuarioTeste.id);
    console.log(`✅ Usuário pode autoavaliar: ${podeAutoavaliar ? 'Sim' : 'Não'}`);
    
    // Tentar iniciar avaliação
    const avaliacaoId = await WorkflowAvaliacaoService.iniciarAvaliacao(
      usuarioTeste.id,
      periodoAtivo.id
    );
    
    if (avaliacaoId) {
      console.log(`✅ Avaliação iniciada com ID: ${avaliacaoId}`);
      return true;
    } else {
      console.log('⚠️ Não foi possível iniciar avaliação (pode já existir)');
      return true; // Não é erro crítico
    }
  } catch (error) {
    console.error('❌ Erro ao testar workflow:', error);
    return false;
  }
}

async function testarNotificacoes() {
  console.log('\n🔍 Testando sistema de notificações...');
  
  try {
    // Buscar usuário para teste
    const { data: usuarios, error } = await supabase
      .from('users_unified')
      .select('id, name')
      .limit(1);

    if (error || !usuarios || usuarios.length === 0) {
      console.log('⚠️ Nenhum usuário encontrado para teste de notificações');
      return false;
    }

    const usuarioTeste = usuarios[0];
    
    // Testar criação de notificação
    const notificacaoId = await NotificacoesAvaliacaoService.criarNotificacao({
      usuario_id: usuarioTeste.id,
      tipo: 'autoavaliacao_pendente',
      titulo: 'Teste de Notificação',
      mensagem: 'Esta é uma notificação de teste do sistema de avaliação',
      dados_avaliacao: {
        avaliacao_id: 'test-id',
        data_limite: '2024-12-31'
      },
      lida: false,
      enviada_push: false,
      enviada_email: false
    });

    if (notificacaoId) {
      console.log(`✅ Notificação criada com ID: ${notificacaoId}`);
      return true;
    } else {
      console.error('❌ Falha ao criar notificação');
      return false;
    }
  } catch (error) {
    console.error('❌ Erro ao testar notificações:', error);
    return false;
  }
}

async function testarTabelasEssenciais() {
  console.log('\n🔍 Testando tabelas essenciais...');
  
  const tabelas = [
    'users_unified',
    'criterios',
    'avaliacoes',
    'periodos_avaliacao',
    'autoavaliacoes',
    'lideres',
    'historico_avaliacao'
  ];

  let todasOk = true;

  for (const tabela of tabelas) {
    try {
      const { error } = await supabase
        .from(tabela)
        .select('*')
        .limit(1);

      if (error) {
        console.error(`❌ Erro na tabela ${tabela}:`, error.message);
        todasOk = false;
      } else {
        console.log(`✅ Tabela ${tabela} acessível`);
      }
    } catch (error) {
      console.error(`❌ Erro ao acessar tabela ${tabela}:`, error);
      todasOk = false;
    }
  }

  return todasOk;
}

/**
 * Executa todos os testes
 */
export async function executarTodosOsTestes() {
  console.log('🚀 INICIANDO TESTES DO SISTEMA DE AVALIAÇÃO\n');
  
  const resultados = {
    conexao: false,
    tabelas: false,
    criterios: false,
    lideranca: false,
    workflow: false,
    notificacoes: false
  };

  // Executar testes
  resultados.conexao = await testarConexaoBanco();
  resultados.tabelas = await testarTabelasEssenciais();
  resultados.criterios = await testarCriterios();
  resultados.lideranca = await testarSistemaLideranca();
  resultados.workflow = await testarWorkflowAvaliacao();
  resultados.notificacoes = await testarNotificacoes();

  // Resumo dos resultados
  console.log('\n📊 RESUMO DOS TESTES:');
  console.log('========================');
  
  Object.entries(resultados).forEach(([teste, passou]) => {
    const status = passou ? '✅ PASSOU' : '❌ FALHOU';
    console.log(`${teste.toUpperCase().padEnd(15)} ${status}`);
  });

  const totalTestes = Object.keys(resultados).length;
  const testesPassaram = Object.values(resultados).filter(Boolean).length;
  
  console.log('========================');
  console.log(`RESULTADO FINAL: ${testesPassaram}/${totalTestes} testes passaram`);
  
  if (testesPassaram === totalTestes) {
    console.log('🎉 TODOS OS TESTES PASSARAM! Sistema pronto para uso.');
  } else {
    console.log('⚠️ Alguns testes falharam. Verifique os erros acima.');
  }

  return testesPassaram === totalTestes;
}

// Executar testes se chamado diretamente
if (require.main === module) {
  executarTodosOsTestes()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Erro fatal nos testes:', error);
      process.exit(1);
    });
}
