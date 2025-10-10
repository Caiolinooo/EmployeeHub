'use client';

import React, { useState } from 'react';
import { FiPlay, FiCheck, FiX, FiAlertCircle, FiRefreshCw } from 'react-icons/fi';
import { supabase } from '@/lib/supabase';
import { WorkflowAvaliacaoService } from '@/lib/services/workflow-avaliacao';
import { getCriteriosPorTipoUsuario } from '@/data/criterios-avaliacao';
import { useI18n } from '@/contexts/I18nContext';

interface TestResult {
  name: string;
  status: 'pending' | 'running' | 'success' | 'error';
  message: string;
  details?: string;
}

export default function DiagnosticoSistemaAvaliacao() {
  const { t } = useI18n();

  const [tests, setTests] = useState<TestResult[]>([
    { name: t('components.conexaoComBanco'), status: 'pending', message: t('components.aguardandoExecucao') },
    { name: 'Tabelas Essenciais', status: 'pending', message: t('components.aguardandoExecucao') },
    { name: t('components.sistemaDeCriterios'), status: 'pending', message: t('components.aguardandoExecucao') },
    { name: t('components.periodosDeAvaliacao'), status: 'pending', message: t('components.aguardandoExecucao') },
    { name: t('components.workflowDeAvaliacao'), status: 'pending', message: t('components.aguardandoExecucao') },
    { name: t('components.sistemaDeNotificacoes'), status: 'pending', message: t('components.aguardandoExecucao') }
  ]);
  
  const [isRunning, setIsRunning] = useState(false);

  const updateTest = (index: number, updates: Partial<TestResult>) => {
    setTests(prev => prev.map((test, i) => 
      i === index ? { ...test, ...updates } : test
    ));
  };

  const testConexaoBanco = async (index: number) => {
    updateTest(index, { status: 'running', message: 'Testando conexão...' });
    
    try {
      const { data, error } = await supabase
        .from('users_unified')
        .select('count')
        .limit(1);

      if (error) {
        updateTest(index, { 
          status: 'error', 
          message: t('components.falhaNaConexao'), 
          details: error.message 
        });
        return false;
      }

      updateTest(index, { 
        status: 'success', 
        message: t('components.conexaoEstabelecidaComSucesso') 
      });
      return true;
    } catch (error) {
      updateTest(index, { 
        status: 'error', 
        message: t('components.erroNaConexao'), 
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      });
      return false;
    }
  };

  const testTabelasEssenciais = async (index: number) => {
    updateTest(index, { status: 'running', message: 'Verificando tabelas...' });
    
    const tabelas = [
      'users_unified',
      'criterios', 
      'avaliacoes',
      'periodos_avaliacao',
      'autoavaliacoes',
      'lideres',
      'historico_avaliacao'
    ];

    const resultados = [];
    
    for (const tabela of tabelas) {
      try {
        const { error } = await supabase
          .from(tabela)
          .select('*')
          .limit(1);

        if (error) {
          resultados.push(`❌ ${tabela}: ${error.message}`);
        } else {
          resultados.push(`✅ ${tabela}: OK`);
        }
      } catch (error) {
        resultados.push(`❌ ${tabela}: Erro de acesso`);
      }
    }

    const erros = resultados.filter(r => r.includes('❌'));
    
    if (erros.length === 0) {
      updateTest(index, { 
        status: 'success', 
        message: t('components.todasAsTabelaslengthTabelasEstaoAcessiveis'),
        details: resultados.join('\n')
      });
      return true;
    } else {
      updateTest(index, { 
        status: 'error', 
        message: `${erros.length} tabela(s) com problema`,
        details: resultados.join('\n')
      });
      return false;
    }
  };

  const testSistemaCriterios = async (index: number) => {
    updateTest(index, { status: 'running', message: 'Testando critérios...' });
    
    try {
      const criteriosComum = getCriteriosPorTipoUsuario(false);
      const criteriosLider = getCriteriosPorTipoUsuario(true);
      const criteriosLiderancaEspecificos = criteriosLider.filter(c => c.apenas_lideres);

      const detalhes = [
        {t('components.criteriosParaUsuarioComumCriterioscomumlength')},
        {t('components.criteriosParaLiderCriteriosliderlength')},
        {t('components.criteriosEspecificosDeLiderancaCriteriosliderancae')},
        '',
        {t('components.criteriosDeLideranca')},
        ...criteriosLiderancaEspecificos.map(c => `  • ${c.nome}`)
      ];

      updateTest(index, { 
        status: 'success', 
        message: t('components.sistemaDeCriteriosFuncionando'),
        details: detalhes.join('\n')
      });
      return true;
    } catch (error) {
      updateTest(index, { 
        status: 'error', 
        message: t('components.erroNoSistemaDeCriterios'),
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      });
      return false;
    }
  };

  const testPeriodosAvaliacao = async (index: number) => {
    updateTest(index, { status: 'running', message: 'Verificando períodos...' });
    
    try {
      const { data: periodos, error } = await supabase
        .from('periodos_avaliacao')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        updateTest(index, { 
          status: 'error', 
          message: t('components.erroAoAcessarPeriodos'),
          details: error.message
        });
        return false;
      }

      const periodosAtivos = periodos?.filter(p => p.ativo) || [];
      const periodoAtivo = await WorkflowAvaliacaoService.getPeriodoAvaliacaoAtivo();

      const detalhes = [
        {t('components.totalDePeriodosPeriodoslength0')},
        {t('components.periodosAtivosPeriodosativoslength')},
        {t('components.periodoAtivoAtualPeriodoativoPeriodoativonome')}Nenhum'}`,
        '',
        {t('components.periodosEncontrados')},
        ...(periodos?.map(p => `  • ${p.nome} (${p.ativo ? 'Ativo' : 'Inativo'})`) || [])
      ];

      updateTest(index, { 
        status: 'success', 
        message: t('components.periodoslength0PeriodosConfigurados'),
        details: detalhes.join('\n')
      });
      return true;
    } catch (error) {
      updateTest(index, { 
        status: 'error', 
        message: t('components.erroAoVerificarPeriodos'),
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      });
      return false;
    }
  };

  const testWorkflowAvaliacao = async (index: number) => {
    updateTest(index, { status: 'running', message: 'Testando workflow...' });
    
    try {
      // Verificar se há avaliações no sistema
      const { data: avaliacoes, error: avaliacoesError } = await supabase
        .from('avaliacoes')
        .select('id, etapa_atual, status')
        .limit(10);

      if (avaliacoesError) {
        updateTest(index, { 
          status: 'error', 
          message: t('components.erroAoAcessarAvaliacoes'),
          details: avaliacoesError.message
        });
        return false;
      }

      // Verificar autoavaliações
      const { data: autoavaliacoes, error: autoavaliacoesError } = await supabase
        .from('autoavaliacoes')
        .select('id')
        .limit(5);

      if (autoavaliacoesError) {
        updateTest(index, { 
          status: 'error', 
          message: t('components.erroAoAcessarAutoavaliacoes'),
          details: autoavaliacoesError.message
        });
        return false;
      }

      const etapas = avaliacoes?.reduce((acc: Record<string, number>, av) => {
        acc[av.etapa_atual] = (acc[av.etapa_atual] || 0) + 1;
        return acc;
      }, {}) || {};

      const detalhes = [
        {t('components.totalDeAvaliacoesAvaliacoeslength0')},
        {t('components.totalDeAutoavaliacoesAutoavaliacoeslength0')},
        '',
        {t('components.distribuicaoPorEtapa')},
        ...Object.entries(etapas).map(([etapa, count]) => `  • ${etapa}: ${count}`)
      ];

      updateTest(index, { 
        status: 'success', 
        message: 'Workflow funcionando corretamente',
        details: detalhes.join('\n')
      });
      return true;
    } catch (error) {
      updateTest(index, { 
        status: 'error', 
        message: 'Erro no workflow',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      });
      return false;
    }
  };

  const testSistemaNotificacoes = async (index: number) => {
    updateTest(index, { status: 'running', message: 'Testando notificações...' });
    
    try {
      // Verificar se a tabela de notificações existe e está acessível
      const { data: notificacoes, error } = await supabase
        .from('notifications')
        .select('id, type, title')
        .limit(5);

      if (error) {
        updateTest(index, { 
          status: 'error', 
          message: t('components.erroAoAcessarNotificacoes'),
          details: error.message
        });
        return false;
      }

      const notificacoesAvaliacao = notificacoes?.filter(n => 
        n.type?.includes('avaliacao') || n.type?.includes('periodo')
      ) || [];

      const detalhes = [
        {t('components.totalDeNotificacoesNotificacoeslength0')},
        {t('components.notificacoesDeAvaliacaoNotificacoesavaliacaolength')},
        '',
        {t('components.tiposDeNotificacaoEncontrados')},
        ...Array.from(new Set(notificacoes?.map(n => n.type) || [])).map(type => `  • ${type}`)
      ];

      updateTest(index, { 
        status: 'success', 
        message: t('components.sistemaDeNotificacoesAcessivel'),
        details: detalhes.join('\n')
      });
      return true;
    } catch (error) {
      updateTest(index, { 
        status: 'error', 
        message: t('components.erroNoSistemaDeNotificacoes'),
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      });
      return false;
    }
  };

  const runAllTests = async () => {
    setIsRunning(true);
    
    const testFunctions = [
      testConexaoBanco,
      testTabelasEssenciais,
      testSistemaCriterios,
      testPeriodosAvaliacao,
      testWorkflowAvaliacao,
      testSistemaNotificacoes
    ];

    for (let i = 0; i < testFunctions.length; i++) {
      await testFunctions[i](i);
      // Pequena pausa entre testes
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setIsRunning(false);
  };

  const resetTests = () => {
    setTests(prev => prev.map(test => ({
      ...test,
      status: 'pending' as const,
      message: t('components.aguardandoExecucao'),
      details: undefined
    })));
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'pending':
        return <div className="w-5 h-5 border-2 border-gray-300 rounded-full" />;
      case 'running':
        return <FiRefreshCw className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'success':
        return <FiCheck className="w-5 h-5 text-green-500" />;
      case 'error':
        return <FiX className="w-5 h-5 text-red-500" />;
    }
  };

  const getStatusColor = (status: TestResult['status']) => {
    switch (status) {
      case 'pending':
        return 'border-gray-200 bg-gray-50';
      case 'running':
        return 'border-blue-200 bg-blue-50';
      case 'success':
        return 'border-green-200 bg-green-50';
      case 'error':
        return 'border-red-200 bg-red-50';
    }
  };

  const successCount = tests.filter(t => t.status === 'success').length;
  const errorCount = tests.filter(t => t.status === 'error').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Diagnóstico do Sistema de Avaliação</h2>
          <p className="text-gray-600">Verifique o status e funcionamento de todos os componentes</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={resetTests}
            disabled={isRunning}
            className="flex items-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <FiRefreshCw className="mr-2" size={16} />
            Resetar
          </button>
          <button
            onClick={runAllTests}
            disabled={isRunning}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <FiPlay className="mr-2" size={16} />
            {isRunning ? 'Executando...' : 'Executar Testes'}
          </button>
        </div>
      </div>

      {/* Resumo */}
      {(successCount > 0 || errorCount > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <FiCheck className="text-green-600" size={20} />
              </div>
              <div className="ml-3">
                <p className="text-sm text-gray-600">Testes Passaram</p>
                <p className="text-2xl font-semibold text-gray-900">{successCount}</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <FiX className="text-red-600" size={20} />
              </div>
              <div className="ml-3">
                <p className="text-sm text-gray-600">Testes Falharam</p>
                <p className="text-2xl font-semibold text-gray-900">{errorCount}</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FiAlertCircle className="text-blue-600" size={20} />
              </div>
              <div className="ml-3">
                <p className="text-sm text-gray-600">Taxa de Sucesso</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {tests.length > 0 ? Math.round((successCount / tests.length) * 100) : 0}%
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lista de Testes */}
      <div className="space-y-3">
        {tests.map((test, index) => (
          <div key={index} className={`border rounded-lg p-4 ${getStatusColor(test.status)}`}>
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                {getStatusIcon(test.status)}
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">{test.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">{test.message}</p>
                  {test.details && (
                    <details className="mt-2">
                      <summary className="text-sm text-blue-600 cursor-pointer hover:text-blue-800">
                        Ver detalhes
                      </summary>
                      <pre className="mt-2 text-xs text-gray-700 bg-white p-2 rounded border overflow-x-auto">
                        {test.details}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
