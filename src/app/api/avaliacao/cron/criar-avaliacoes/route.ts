import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Inicializar Supabase Admin Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * API para criação automática de avaliações
 * Executado diariamente para verificar períodos que devem iniciar
 *
 * Fluxo:
 * 1. Buscar períodos com data_inicio = HOJE e criacao_automatica_executada = false
 * 2. Para cada período, buscar usuários elegíveis
 * 3. Para cada usuário, buscar seu gerente configurado
 * 4. Criar avaliação (colaborador + gerente)
 * 5. Enviar notificações
 * 6. Marcar período como executado
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verificar autenticação (Vercel Cron Secret ou token admin)
    const authHeader = request.headers.get('authorization');
    const cronSecret = request.headers.get('x-vercel-cron-secret');

    const isVercelCron = cronSecret === process.env.CRON_SECRET;
    const isAdminToken = authHeader && authHeader.startsWith('Bearer ');

    if (!isVercelCron && !isAdminToken) {
      return NextResponse.json(
        {
          success: false,
          error: 'Não autorizado',
        },
        { status: 401 }
      );
    }

    console.log('🔄 Iniciando processo de criação automática de avaliações...');

    // 1. Buscar períodos que devem iniciar hoje
    const hoje = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    const { data: periodos, error: periodosError } = await supabase
      .from('periodos_avaliacao')
      .select('*')
      .eq('data_inicio', hoje)
      .eq('criacao_automatica_executada', false)
      .eq('ativo', true);

    if (periodosError) {
      throw new Error(`Erro ao buscar períodos: ${periodosError.message}`);
    }

    if (!periodos || periodos.length === 0) {
      console.log('ℹ️  Nenhum período para iniciar hoje');

      await registrarLog({
        tipo: 'criacao_automatica',
        descricao: 'Verificação diária - Nenhum período para iniciar',
        resultado: { data: hoje, periodos: 0 },
        sucesso: true,
        tempo_execucao_ms: Date.now() - startTime,
      });

      return NextResponse.json({
        success: true,
        message: 'Nenhum período para iniciar hoje',
        periodos: 0,
        avaliacoes_criadas: 0,
      });
    }

    console.log(`📅 Encontrado(s) ${periodos.length} período(s) para iniciar`);

    let totalAvaliacoesCriadas = 0;
    const resultadosPorPeriodo: any[] = [];

    // 2. Para cada período, criar avaliações
    for (const periodo of periodos) {
      console.log(`\n🔹 Processando período: ${periodo.nome} (${periodo.id})`);

      try {
        // Buscar usuários elegíveis
        const usuarios = await buscarUsuariosElegiveis(periodo);
        console.log(`   👥 Usuários elegíveis: ${usuarios.length}`);

        let avaliacoesCriadas = 0;
        const errosUsuario: any[] = [];

        // Criar avaliação para cada usuário
        for (const usuario of usuarios) {
          try {
            // Buscar gerente do usuário
            const gerente = await buscarGerenteUsuario(usuario.id, periodo.id);

            if (!gerente) {
              console.log(`   ⚠️  Usuário ${usuario.first_name} ${usuario.last_name} sem gerente configurado`);
              errosUsuario.push({
                usuario_id: usuario.id,
                usuario_nome: `${usuario.first_name} ${usuario.last_name}`,
                erro: 'Gerente não configurado',
              });
              continue;
            }

            // Criar avaliação
            const avaliacaoCriada = await criarAvaliacao({
              funcionario_id: usuario.id,
              avaliador_id: gerente.id,
              periodo_id: periodo.id,
              periodo: periodo.nome,
              data_inicio: periodo.data_inicio,
              data_fim: periodo.data_fim,
            });

            if (avaliacaoCriada) {
              avaliacoesCriadas++;

              // Enviar notificações
              await enviarNotificacoes({
                avaliacao_id: avaliacaoCriada.id,
                funcionario_id: usuario.id,
                avaliador_id: gerente.id,
                periodo: periodo.nome,
                data_limite: periodo.data_limite_autoavaliacao,
              });
            }
          } catch (userError: any) {
            console.error(`   ❌ Erro ao criar avaliação para ${usuario.first_name}:`, userError.message);
            errosUsuario.push({
              usuario_id: usuario.id,
              usuario_nome: `${usuario.first_name} ${usuario.last_name}`,
              erro: userError.message,
            });
          }
        }

        // Atualizar período como executado
        const { error: updateError } = await supabase
          .from('periodos_avaliacao')
          .update({
            criacao_automatica_executada: true,
            data_criacao_automatica: new Date().toISOString(),
            total_avaliacoes_criadas: avaliacoesCriadas,
            updated_at: new Date().toISOString(),
          })
          .eq('id', periodo.id);

        if (updateError) {
          console.error(`   ❌ Erro ao atualizar período:`, updateError.message);
        }

        totalAvaliacoesCriadas += avaliacoesCriadas;

        resultadosPorPeriodo.push({
          periodo_id: periodo.id,
          periodo_nome: periodo.nome,
          usuarios_elegiveis: usuarios.length,
          avaliacoes_criadas: avaliacoesCriadas,
          erros: errosUsuario,
        });

        console.log(`   ✅ Criadas ${avaliacoesCriadas} avaliações para o período ${periodo.nome}`);
      } catch (periodoError: any) {
        console.error(`   ❌ Erro ao processar período ${periodo.nome}:`, periodoError.message);
        resultadosPorPeriodo.push({
          periodo_id: periodo.id,
          periodo_nome: periodo.nome,
          erro: periodoError.message,
        });
      }
    }

    const tempoExecucao = Date.now() - startTime;

    // Registrar log de execução
    await registrarLog({
      tipo: 'criacao_automatica',
      descricao: `Criação automática de avaliações - ${periodos.length} período(s)`,
      resultado: {
        data: hoje,
        periodos_processados: periodos.length,
        avaliacoes_criadas: totalAvaliacoesCriadas,
        detalhes: resultadosPorPeriodo,
      },
      sucesso: true,
      tempo_execucao_ms: tempoExecucao,
    });

    console.log(`\n✅ Processo concluído em ${tempoExecucao}ms`);
    console.log(`📊 Total de avaliações criadas: ${totalAvaliacoesCriadas}`);

    return NextResponse.json({
      success: true,
      message: 'Avaliações criadas com sucesso',
      periodos: periodos.length,
      avaliacoes_criadas: totalAvaliacoesCriadas,
      tempo_execucao_ms: tempoExecucao,
      resultados: resultadosPorPeriodo,
    });
  } catch (error: any) {
    console.error('❌ Erro no processo de criação automática:', error);

    const tempoExecucao = Date.now() - startTime;

    await registrarLog({
      tipo: 'criacao_automatica',
      descricao: 'Erro no processo de criação automática',
      resultado: { erro: error.message },
      sucesso: false,
      tempo_execucao_ms: tempoExecucao,
      erro: error.message,
    });

    return NextResponse.json(
      {
        success: false,
        error: error.message,
        tempo_execucao_ms: tempoExecucao,
      },
      { status: 500 }
    );
  }
}

/**
 * Busca usuários elegíveis para um período
 */
async function buscarUsuariosElegiveis(periodo: any): Promise<any[]> {
  // Verificar se o período tem configuração específica de usuários
  if (periodo.usuarios_elegiveis_config && Array.isArray(periodo.usuarios_elegiveis_config)) {
    const { data: usuarios, error } = await supabase
      .from('users_unified')
      .select('*')
      .in('id', periodo.usuarios_elegiveis_config)
      .eq('status', 'active');

    if (error) throw error;
    return usuarios || [];
  }

  // Usar configuração global de usuários elegíveis
  const { data: usuarios, error } = await supabase
    .from('vw_usuarios_elegiveis')
    .select('*');

  if (error) throw error;
  return usuarios || [];
}

/**
 * Busca o gerente de um usuário
 */
async function buscarGerenteUsuario(usuarioId: string, periodoId: string): Promise<any | null> {
  // Tentar buscar gerente específico do período
  const { data: mapeamento } = await supabase
    .from('avaliacao_colaborador_gerente')
    .select('gerente_id, users_unified!avaliacao_colaborador_gerente_gerente_id_fkey(*)')
    .eq('colaborador_id', usuarioId)
    .eq('periodo_id', periodoId)
    .eq('ativo', true)
    .single();

  if (mapeamento && mapeamento.users_unified) {
    return mapeamento.users_unified;
  }

  // Buscar gerente padrão (sem período específico)
  const { data: mapeamentoPadrao } = await supabase
    .from('avaliacao_colaborador_gerente')
    .select('gerente_id, users_unified!avaliacao_colaborador_gerente_gerente_id_fkey(*)')
    .eq('colaborador_id', usuarioId)
    .is('periodo_id', null)
    .eq('ativo', true)
    .single();

  return mapeamentoPadrao?.users_unified || null;
}

/**
 * Cria uma avaliação
 */
async function criarAvaliacao(dados: any): Promise<any | null> {
  const { data, error } = await supabase
    .from('avaliacoes_desempenho')
    .insert({
      funcionario_id: dados.funcionario_id,
      avaliador_id: dados.avaliador_id,
      periodo_id: dados.periodo_id,
      periodo: dados.periodo,
      data_inicio: dados.data_inicio,
      data_fim: dados.data_fim,
      status: 'pending_response',
      pontuacao_total: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('Erro ao criar avaliação:', error);
    throw error;
  }

  return data;
}

/**
 * Envia notificações para colaborador e gerente
 */
async function enviarNotificacoes(dados: any): Promise<void> {
  try {
    // Notificar colaborador
    await supabase.from('notifications').insert({
      user_id: dados.funcionario_id,
      type: 'periodo_iniciado',
      title: 'Nova Avaliação de Desempenho',
      message: `O período de avaliação "${dados.periodo}" foi iniciado. Por favor, preencha sua autoavaliação até ${new Date(dados.data_limite).toLocaleDateString('pt-BR')}.`,
      data: {
        avaliacao_id: dados.avaliacao_id,
        periodo: dados.periodo,
        data_limite: dados.data_limite,
      },
      read: false,
      created_at: new Date().toISOString(),
    });

    // Notificar gerente
    await supabase.from('notifications').insert({
      user_id: dados.avaliador_id,
      type: 'periodo_iniciado',
      title: 'Novo Período de Avaliação',
      message: `O período de avaliação "${dados.periodo}" foi iniciado. Você terá avaliações para revisar após os colaboradores preencherem suas autoavaliações.`,
      data: {
        avaliacao_id: dados.avaliacao_id,
        periodo: dados.periodo,
      },
      read: false,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Erro ao enviar notificações:', error);
    // Não lançar erro - notificação é importante mas não crítica
  }
}

/**
 * Registra log de execução
 */
async function registrarLog(dados: any): Promise<void> {
  try {
    await supabase.from('avaliacao_cron_log').insert({
      tipo: dados.tipo,
      descricao: dados.descricao,
      executado_em: new Date().toISOString(),
      resultado: dados.resultado,
      sucesso: dados.sucesso,
      tempo_execucao_ms: dados.tempo_execucao_ms,
      erro: dados.erro || null,
      created_by: 'SYSTEM',
    });
  } catch (error) {
    console.error('Erro ao registrar log:', error);
  }
}
