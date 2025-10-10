'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2, Database } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { fetchWithToken } from '@/lib/tokenStorage';
import { useI18n } from '@/contexts/I18nContext';

/**
 * Componente para criar a tabela de critérios no banco de dados
 */
export function CreateCriteriosTable() {
  const { t } = useI18n();

  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [tableExists, setTableExists] = useState(false);
  const [criteriosCount, setCriteriosCount] = useState(0);

  // Verificar se a tabela existe ao montar o componente
  useEffect(() => {
    checkTable();
  }, []);

  // Função para verificar se a tabela existe
  const checkTable = async () => {
    try {
      setChecking(true);
      setError(null);
      setMessage(t('components.verificandoTabelasDoSistemaDeAvaliacao')});

      // Chamar a API para verificar todas as tabelas
      const response = await fetchWithToken('/api/avaliacao/setup-tables');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao verificar tabelas do sistema');
      }

      // Verificar especificamente a tabela de critérios
      const criteriosTable = data.tables.criterios;
      setTableExists(criteriosTable?.exists || false);
      setCriteriosCount(criteriosTable?.count || 0);

      if (criteriosTable?.exists) {
        setSuccess(true);
        setMessage(t('components.aTabelaDeCriteriosJaExisteNoBancoDeDadosComCriteri')});
      } else {
        setMessage(t('components.umaOuMaisTabelasNecessariasNaoExistemCliqueNoBotao')});
      }
    } catch (err) {
      console.error('Erro ao verificar tabelas:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      setMessage(null);
    } finally {
      setChecking(false);
    }
  };

  // Função para criar todas as tabelas necessárias
  const createTable = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(false);
      setMessage(t('components.criandoTabelasDoSistemaDeAvaliacao')});

      // Chamar a API para criar todas as tabelas
      const response = await fetchWithToken('/api/avaliacao/setup-tables', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao criar tabelas do sistema');
      }

      setSuccess(true);
      setTableExists(true);
      setMessage(data.message || 'Tabelas do sistema criadas com sucesso');

      // Verificar novamente para atualizar a contagem
      await checkTable();
    } catch (err) {
      console.error('Erro ao criar tabelas:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      setMessage(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-white">
      <div className="flex items-center gap-2">
        <Database className="h-5 w-5 text-blue-600" />
        <h3 className="text-lg font-semibold">Configuração do Banco de Dados de Avaliação</h3>
      </div>

      <div className="text-sm text-gray-600">
        <p>
          Este utilitário permite criar todas as tabelas necessárias para o sistema de avaliação no banco de dados Supabase.
          As tabelas incluem: critérios, avaliações e pontuações, que são essenciais para o funcionamento do módulo de avaliação.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert variant="success" className="bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800">Sucesso</AlertTitle>
          <AlertDescription className="text-green-700">{message}</AlertDescription>
        </Alert>
      )}

      {message && !success && !error && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Informação</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2">
        <Button
          onClick={createTable}
          disabled={loading || checking || (tableExists && criteriosCount > 0)}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          {loading ? <Spinner className="mr-2" /> : <Database className="mr-2 h-4 w-4" />}
          {tableExists ? 'Atualizar Tabelas do Sistema' : 'Criar Tabelas do Sistema'}
        </Button>

        <Button
          onClick={checkTable}
          variant="outline"
          disabled={loading || checking}
          className="border-gray-300 hover:bg-gray-100"
        >
          {checking ? <Spinner className="mr-2" /> : null}
          Verificar Tabela
        </Button>
      </div>
    </div>
  );
}
