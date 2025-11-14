'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useI18n } from '@/contexts/I18nContext';

export default function ReimbursementMigrationPage() {
  const { t } = useI18n();

  const { user, isLoading: authLoading } = useSupabaseAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('migration');

  // Verificar se o usuário é admin
  const isAdmin = user?.role === 'ADMIN';

  // Redirecionar se não for admin
  React.useEffect(() => {
    if (!authLoading && !isAdmin) {
      toast({
        title: 'Acesso negado',
        description: t('admin.voceNaoTemPermissaoParaAcessarEstaPagina'),
        variant: 'destructive',
      });
      router.push('/dashboard');
    }
  }, [authLoading, isAdmin, router, toast]);

  // Executar a migração
  const executeMigration = async (force = false) => {
    try {
      setLoading(true);
      setError(null);
      setResult(null);

      // Obter token de autenticação
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error(t('admin.tokenDeAutenticacaoNaoEncontrado'));
      }

      // Chamar a API para executar a migração
      const response = await fetch('/api/reembolso/add-user-id-column', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ force }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t('admin.erroAoExecutarMigracao'));
      }

      setResult(data);
      toast({
        title: t('admin.migracaoExecutada'),
        description: t('admin.aMigracaoFoiExecutadaComSucesso'),
        variant: 'default',
      });
    } catch (err) {
      console.error(t('admin.erroAoExecutarMigracao'), err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      toast({
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Verificar status da migração
  const checkMigrationStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      setResult(null);

      // Obter token de autenticação
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error(t('admin.tokenDeAutenticacaoNaoEncontrado'));
      }

      // Chamar a API para verificar o status da migração
      const response = await fetch('/api/reembolso/add-user-id-column', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t('admin.erroAoVerificarStatusDaMigracao'));
      }

      setResult(data);
      toast({
        title: 'Status verificado',
        description: t('admin.oStatusDaMigracaoFoiVerificadoComSucesso'),
        variant: 'default',
      });
    } catch (err) {
      console.error(t('admin.erroAoVerificarStatusDaMigracao'), err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      toast({
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Carregando...</span>
      </div>
    );
  }

  if (!isAdmin) {
    return null; // Não renderizar nada enquanto redireciona
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Migração de Reembolsos</h1>
      
      <Tabs defaultValue="migration" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="migration">Migração</TabsTrigger>
          <TabsTrigger value="info">Informações</TabsTrigger>
        </TabsList>
        
        <TabsContent value="migration">
          <Card>
            <CardHeader>
              <CardTitle>Migração de Reembolsos</CardTitle>
              <CardDescription>
                Esta ferramenta permite migrar os reembolsos para usar o ID do usuário como chave de vinculação em vez do e-mail.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Erro</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              {result && (
                <Alert variant={result.success ? "default" : "destructive"} className="mb-4">
                  {result.success ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                  <AlertTitle>{result.success ? "Sucesso" : "Erro"}</AlertTitle>
                  <AlertDescription>
                    {result.success ? (
                      <div>
                        <p>Coluna: {result.columnResult?.message || 'N/A'}</p>
                        <p>Migração: {result.migrationResult?.message || 'N/A'}</p>
                      </div>
                    ) : (
                      <div>
                        <p>{result.error}</p>
                        {result.details && <p>Detalhes: {result.details}</p>}
                        {result.sql && (
                          <div className="mt-2">
                            <p>Execute o seguinte SQL no Supabase:</p>
                            <pre className="bg-gray-100 p-2 rounded mt-1 overflow-x-auto">
                              {result.sql}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-4">
                <p>
                  Esta migração irá adicionar uma coluna <code>user_id</code> à tabela <code>Reimbursement</code> e 
                  migrar os dados existentes para usar o ID do usuário como chave de vinculação em vez do e-mail.
                </p>
                <p>
                  Isso garantirá que os usuários sempre vejam todos os seus reembolsos, independentemente de mudanças 
                  em seus endereços de e-mail.
                </p>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button 
                variant="outline" 
                onClick={checkMigrationStatus} 
                disabled={loading}
              >
                {loading && activeTab === 'migration' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Verificar Status
              </Button>
              <Button 
                onClick={() => executeMigration(false)} 
                disabled={loading}
              >
                {loading && activeTab === 'migration' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Executar Migração
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="info">
          <Card>
            <CardHeader>
              <CardTitle>Informações sobre a Migração</CardTitle>
              <CardDescription>
                Detalhes sobre o processo de migração de reembolsos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">O que esta migração faz?</h3>
                <p>
                  Esta migração realiza duas tarefas principais:
                </p>
                <ol className="list-decimal pl-5 space-y-2">
                  <li>
                    Adiciona uma coluna <code>user_id</code> à tabela <code>Reimbursement</code> que referencia a tabela <code>users_unified</code>.
                  </li>
                  <li>
                    Atualiza os reembolsos existentes para associá-los ao ID do usuário correspondente com base no e-mail.
                  </li>
                </ol>
                
                <h3 className="text-lg font-semibold mt-6">Por que esta migração é necessária?</h3>
                <p>
                  Anteriormente, os reembolsos eram vinculados aos usuários apenas pelo e-mail. Isso pode causar problemas quando:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Um usuário muda seu endereço de e-mail</li>
                  <li>Um usuário tem múltiplos endereços de e-mail</li>
                  <li>Há conflitos de e-mail entre usuários diferentes</li>
                </ul>
                
                <p className="mt-4">
                  Ao usar o ID único do usuário como chave de vinculação, garantimos que os reembolsos sempre sejam associados 
                  corretamente ao usuário, independentemente de mudanças em seus endereços de e-mail.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
