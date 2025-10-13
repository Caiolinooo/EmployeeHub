'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2, Upload } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { fetchWithToken } from '@/lib/tokenStorage';
import { useI18n } from '@/contexts/I18nContext';

/**
 * Component to import evaluation criteria from Excel file
 */
export function ImportCriteriosButton() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // Function to import criteria
  const importCriterios = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(false);
      setMessage(t('components.importandoCriteriosDeAvaliacaoDaPlanilha'));

      // Call the API to import criteria
      const response = await fetchWithToken('/api/avaliacao/import-criterios', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})  // Using default file path
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t('components.erroAoImportarCriterios'));
      }

      setSuccess(true);
      setImportedCount(data.imported || 0);
      setTotalCount(data.total || 0);

      if (data.imported === 0) {
        setMessage(t('components.todosOsCriteriosJaExistemNoBancoDeDados'));
      } else {
        setMessage(t('components.dataimportedCriteriosImportadosComSucessoDeUmTotal'));
      }
    } catch (err) {
      console.error(t('components.erroAoImportarCriterios'), err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      setMessage(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-white">
      <div className="flex items-center gap-2">
        <Upload className="h-5 w-5 text-blue-600" />
        <h3 className="text-lg font-semibold">{t('avaliacao.importacao.importCriterios', 'Importar Critérios de Avaliação')}</h3>
      </div>

      <div className="text-sm text-gray-600">
        <p>
          Este utilitário permite importar critérios de avaliação da planilha padrão para o banco de dados.
          Os critérios serão utilizados para avaliar o desempenho dos funcionários.
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
          onClick={importCriterios}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          {loading ? <Spinner className="mr-2" /> : <Upload className="mr-2 h-4 w-4" />}
          {t('avaliacao.importacao.importCriterios', 'Importar Critérios')}
        </Button>
      </div>
    </div>
  );
}
