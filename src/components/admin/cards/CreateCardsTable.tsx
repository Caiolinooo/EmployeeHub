'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2, Database } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { useI18n } from '@/contexts/I18nContext';

/**
 * Componente para criar a tabela de cards no banco de dados
 */
export function CreateCardsTable() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Função para criar a tabela de cards
  const createTable = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(false);
      setMessage(t('admin.creatingCardsTable'));

      // Chamar a API para criar a tabela
      const response = await fetch('/api/admin/cards/create-table', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t('admin.errorCreatingCardsTable'));
      }

      setSuccess(true);
      setMessage(data.message || t('admin.cardsTableCreatedSuccess'));
    } catch (err) {
      console.error('Erro ao criar tabela de cards:', err);
      setError(err instanceof Error ? err.message : t('common.unknownError'));
      setMessage(null);
    } finally {
      setLoading(false);
    }
  };

  // Função para verificar se a tabela existe
  const checkTable = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(false);
      setMessage(t('admin.checkingCardsTable'));

      // Chamar a API para verificar a tabela
      const response = await fetch('/api/admin/cards/create-table');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t('admin.errorCheckingCardsTable'));
      }

      if (data.exists) {
        setSuccess(true);
        setMessage(t('admin.cardsTableExists'));
      } else {
        setMessage(t('admin.cardsTableNotExists'));
      }
    } catch (err) {
      console.error('Erro ao verificar tabela de cards:', err);
      setError(err instanceof Error ? err.message : t('common.unknownError'));
      setMessage(null);
    } finally {
      setLoading(false);
    }
  };

  // Verificar a tabela ao montar o componente
  React.useEffect(() => {
    checkTable();
  }, []);

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-card">
      <div className="flex items-center gap-2">
        <Database className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">{t('admin.cardsTable')}</h3>
      </div>

      <div className="text-sm text-muted-foreground">
        <p>
          {t('admin.cardsTableDescription')}
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t('common.error')}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert variant="success" className="bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800">{t('common.success')}</AlertTitle>
          <AlertDescription className="text-green-700">{message}</AlertDescription>
        </Alert>
      )}

      {message && !success && !error && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t('common.information')}</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2">
        <Button
          onClick={createTable}
          disabled={loading || success}
          className="bg-primary hover:bg-primary/90"
        >
          {loading ? <Spinner className="mr-2" /> : <Database className="mr-2 h-4 w-4" />}
          {t('admin.createCardsTable')}
        </Button>

        <Button
          onClick={checkTable}
          variant="outline"
          disabled={loading}
        >
          {t('admin.checkTable')}
        </Button>
      </div>
    </div>
  );
}
