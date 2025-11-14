-- =====================================================
-- SETUP DE CRON JOB NO SUPABASE
-- Para criação automática de avaliações
-- =====================================================

-- Habilitar extensão pg_cron (se ainda não estiver)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- =====================================================
-- FUNÇÃO PARA CRIAR AVALIAÇÕES AUTOMATICAMENTE
-- =====================================================
CREATE OR REPLACE FUNCTION criar_avaliacoes_automaticamente()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_periodo RECORD;
  v_usuario RECORD;
  v_gerente_id UUID;
  v_avaliacoes_criadas INTEGER := 0;
  v_tempo_inicio TIMESTAMP := NOW();
  v_hoje DATE := CURRENT_DATE;
BEGIN
  -- Log de início
  RAISE NOTICE 'Iniciando criação automática de avaliações para %', v_hoje;

  -- Buscar períodos que devem iniciar hoje
  -- REGRA: Criar avaliações 2 SEMANAS (14 dias) ANTES da data fim do período
  FOR v_periodo IN
    SELECT *
    FROM periodos_avaliacao
    WHERE (data_fim - INTERVAL '14 days')::DATE = v_hoje
      AND criacao_automatica_executada = false
      AND ativo = true
  LOOP
    RAISE NOTICE 'Processando período: % (ID: %)', v_periodo.nome, v_periodo.id;

    -- Buscar usuários elegíveis
    FOR v_usuario IN
      SELECT u.*
      FROM avaliacao_usuarios_elegiveis ue
      INNER JOIN users_unified u ON ue.usuario_id = u.id
      WHERE ue.ativo = true
        AND u.status = 'active'
    LOOP
      BEGIN
        -- Buscar gerente do usuário
        v_gerente_id := get_gerente_colaborador(v_usuario.id, v_periodo.id);

        IF v_gerente_id IS NULL THEN
          RAISE NOTICE 'Usuário % % sem gerente configurado', v_usuario.first_name, v_usuario.last_name;
          CONTINUE;
        END IF;

        -- Criar avaliação
        INSERT INTO avaliacoes_desempenho (
          funcionario_id,
          avaliador_id,
          periodo_id,
          periodo,
          data_inicio,
          data_fim,
          status,
          pontuacao_total,
          created_at,
          updated_at
        ) VALUES (
          v_usuario.id,
          v_gerente_id,
          v_periodo.id,
          v_periodo.nome,
          v_periodo.data_inicio,
          v_periodo.data_fim,
          'pending_response',
          0,
          NOW(),
          NOW()
        );

        v_avaliacoes_criadas := v_avaliacoes_criadas + 1;

        -- Enviar notificações
        PERFORM enviar_notificacao_avaliacao(
          v_usuario.id,
          v_gerente_id,
          v_periodo.nome,
          v_periodo.data_limite_autoavaliacao
        );

      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Erro ao criar avaliação para usuário %: %', v_usuario.id, SQLERRM;
      END;
    END LOOP;

    -- Atualizar período como executado
    UPDATE periodos_avaliacao
    SET criacao_automatica_executada = true,
        data_criacao_automatica = NOW(),
        total_avaliacoes_criadas = v_avaliacoes_criadas,
        updated_at = NOW()
    WHERE id = v_periodo.id;

    RAISE NOTICE 'Criadas % avaliações para o período %', v_avaliacoes_criadas, v_periodo.nome;
  END LOOP;

  -- Registrar log
  INSERT INTO avaliacao_cron_log (
    tipo,
    descricao,
    executado_em,
    resultado,
    sucesso,
    tempo_execucao_ms,
    created_by
  ) VALUES (
    'criacao_automatica',
    'Criação automática de avaliações',
    NOW(),
    jsonb_build_object(
      'data', v_hoje,
      'avaliacoes_criadas', v_avaliacoes_criadas,
      'tempo_execucao_ms', EXTRACT(MILLISECONDS FROM (NOW() - v_tempo_inicio))
    ),
    true,
    EXTRACT(MILLISECONDS FROM (NOW() - v_tempo_inicio))::INTEGER,
    'SYSTEM'
  );

  RAISE NOTICE 'Processo concluído. Total de avaliações criadas: %', v_avaliacoes_criadas;
END;
$$;

-- =====================================================
-- FUNÇÃO AUXILIAR: ENVIAR NOTIFICAÇÕES
-- =====================================================
CREATE OR REPLACE FUNCTION enviar_notificacao_avaliacao(
  p_funcionario_id UUID,
  p_gerente_id UUID,
  p_periodo TEXT,
  p_data_limite DATE
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Notificar colaborador
  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    data,
    read,
    created_at
  ) VALUES (
    p_funcionario_id,
    'periodo_iniciado',
    'Nova Avaliação de Desempenho',
    'O período de avaliação "' || p_periodo || '" foi iniciado. Por favor, preencha sua autoavaliação até ' || TO_CHAR(p_data_limite, 'DD/MM/YYYY') || '.',
    jsonb_build_object(
      'periodo', p_periodo,
      'data_limite', p_data_limite
    ),
    false,
    NOW()
  );

  -- Notificar gerente
  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    data,
    read,
    created_at
  ) VALUES (
    p_gerente_id,
    'periodo_iniciado',
    'Novo Período de Avaliação',
    'O período de avaliação "' || p_periodo || '" foi iniciado. Você terá avaliações para revisar após os colaboradores preencherem suas autoavaliações.',
    jsonb_build_object(
      'periodo', p_periodo
    ),
    false,
    NOW()
  );

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Erro ao enviar notificações: %', SQLERRM;
END;
$$;

-- =====================================================
-- AGENDAR CRON JOB
-- =====================================================
-- Executar diariamente às 9h da manhã (horário UTC-3 = 12h UTC)
SELECT cron.schedule(
  'criar-avaliacoes-automaticamente',
  '0 12 * * *',  -- 12h UTC = 9h BRT
  $$SELECT criar_avaliacoes_automaticamente()$$
);

-- =====================================================
-- FUNÇÃO PARA EXECUTAR MANUALMENTE (TESTE)
-- =====================================================
-- Para testar, execute: SELECT criar_avaliacoes_automaticamente();

-- =====================================================
-- VISUALIZAR CRON JOBS AGENDADOS
-- =====================================================
-- SELECT * FROM cron.job;

-- =====================================================
-- REMOVER CRON JOB (se necessário)
-- =====================================================
-- SELECT cron.unschedule('criar-avaliacoes-automaticamente');

-- =====================================================
-- COMENTÁRIOS
-- =====================================================
COMMENT ON FUNCTION criar_avaliacoes_automaticamente() IS 'Função executada diariamente para criar avaliações automaticamente quando um período iniciar';
COMMENT ON FUNCTION enviar_notificacao_avaliacao(UUID, UUID, TEXT, DATE) IS 'Envia notificações para colaborador e gerente quando uma avaliação é criada';

-- Log de setup
INSERT INTO avaliacao_cron_log (
  tipo,
  descricao,
  executado_em,
  resultado,
  sucesso,
  created_by
) VALUES (
  'setup_cron',
  'Configuração do cron job para criação automática de avaliações',
  NOW(),
  jsonb_build_object(
    'schedule', '0 12 * * *',
    'timezone', 'UTC',
    'funcao', 'criar_avaliacoes_automaticamente'
  ),
  true,
  'SYSTEM'
);
