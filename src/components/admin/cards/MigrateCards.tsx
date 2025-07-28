'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2, MoveRight } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';

/**
 * Componente para migrar cards hardcoded para o banco de dados
 */
export function MigrateCards() {
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
      setMessage('Verificando status da migração...');

      // Chamar a API para verificar o status da migração
      const response = await fetch('/api/admin/cards/migrate');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao verificar status da migração');
      }

      setMigrationStatus({
        hardcodedCount: data.hardcodedCount || 0,
        databaseCount: data.databaseCount || 0,
        migrationNeeded: data.migrationNeeded || false
      });

      setMessage(data.message || 'Status da migração verificado com sucesso');
    } catch (err) {
      console.error('Erro ao verificar status da migração:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
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
      setMessage('Migrando cards para o banco de dados...');

      // Chamar a API para migrar os cards
      const response = await fetch('/api/admin/cards/migrate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao migrar cards');
      }

      setSuccess(true);
      setMessage(data.message || 'Cards migrados com sucesso');
      
      // Atualizar o status da migração
      await checkMigrationStatus();
    } catch (err) {
      console.error('Erro ao migrar cards:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
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
        <h3 className="text-lg font-semibold">Migração de Cards</h3>
      </div>

      <div className="text-sm text-muted-foreground">
        <p>
          Este utilitário permite migrar os cards hardcoded do código-fonte para o banco de dados Supabase.
          Isso permite que os cards sejam editados através da interface administrativa.
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
                ? 'Migração necessária' 
                : 'Todos os cards já foram migrados'}
            </p>
          </div>
        </div>
      )}

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
          onClick={migrateCards}
          disabled={loading || checking || (migrationStatus && !migrationStatus.migrationNeeded) || false}
          className="bg-primary hover:bg-primary/90"
        >
          {loading ? <Spinner className="mr-2" /> : <MoveRight className="mr-2 h-4 w-4" />}
          Migrar Cards
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
