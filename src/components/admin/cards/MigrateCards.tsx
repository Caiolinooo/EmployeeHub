'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2, MoveRight } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { useI18n } from '@/contexts/I18nContext';

/**
 * Componente para migrar cards hardcoded para o banco de dados
 */
export function MigrateCards() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [migrationStatus, setMigrationStatus] = useState<{
    hardcodedCount: number;
    databaseCount: number;
    migrationNeeded: boolean;
  } | null>(null);

  // Função para verificar o status da migração
  const checkMigrationStatus = async () => {
    try {
      setChecking(true);
      setError(null);
      setMessage(t('admin.checkingMigrationStatus'));

      // Chamar a API para verificar o status da migração
      const response = await fetch('/api/admin/cards/migrate');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t('admin.errorCheckingMigrationStatus'));
      }

      setMigrationStatus({
        hardcodedCount: data.hardcodedCount || 0,
        databaseCount: data.databaseCount || 0,
        migrationNeeded: data.migrationNeeded || false
      });

      setMessage(data.message || t('admin.migrationStatusCheckedSuccess'));
    } catch (err) {
      console.error({t('components.erroAoVerificarStatusDaMigracao')}, err);
      setError(err instanceof Error ? err.message : t('common.unknownError'));
      setMessage(null);
    } finally {
      setChecking(false);
    }
  };

  // Função para migrar os cards
  const migrateCards = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(false);
      setMessage(t('admin.migratingCards'));

      // Chamar a API para migrar os cards
      const response = await fetch('/api/admin/cards/migrate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t('admin.errorMigratingCards'));
      }

      setSuccess(true);
      setMessage(data.message || t('admin.cardsMigratedSuccess'));
      
      // Atualizar o status da migração
      await checkMigrationStatus();
    } catch (err) {
      console.error('Erro ao migrar cards:', err);
      setError(err instanceof Error ? err.message : t('common.unknownError'));
      setMessage(null);
    } finally {
      setLoading(false);
    }
  };

  // Verificar o status da migração ao montar o componente
  useEffect(() => {
    checkMigrationStatus();
  }, []);

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-card">
      <div className="flex items-center gap-2">
        <MoveRight className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">{t('admin.cardsMigration')}</h3>
      </div>

      <div className="text-sm text-muted-foreground">
        <p>
          {t('admin.cardsMigrationDescription')}
        </p>
      </div>

      {migrationStatus && (
        <div className="bg-muted/50 p-3 rounded-md">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-medium">Cards no código-fonte:</p>
              <p className="text-lg font-bold">{migrationStatus.hardcodedCount}</p>
            </div>
            <div>
              <p className="font-medium">Cards no banco de dados:</p>
              <p className="text-lg font-bold">{migrationStatus.databaseCount}</p>
            </div>
          </div>
          <div className="mt-2">
            <p className="text-sm font-medium">
              Status: {migrationStatus.migrationNeeded 
                ? {t('components.migracaoNecessaria')} 
                : {t('components.todosOsCardsJaForamMigrados')}}
            </p>
          </div>
        </div>
      )}

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
          onClick={migrateCards}
          disabled={loading || checking || (migrationStatus && !migrationStatus.migrationNeeded) || false}
          className="bg-primary hover:bg-primary/90"
        >
          {loading ? <Spinner className="mr-2" /> : <MoveRight className="mr-2 h-4 w-4" />}
          {t('admin.migrateCards')}
        </Button>

        <Button
          onClick={checkMigrationStatus}
          variant="outline"
          disabled={loading || checking}
        >
          {checking ? <Spinner className="mr-2" /> : null}
          Verificar Status
        </Button>
      </div>
    </div>
  );
}
