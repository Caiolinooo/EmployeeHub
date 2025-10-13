'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import MainLayout from '@/components/Layout/MainLayout';
import { useI18n } from '@/contexts/I18nContext';
import {
  FiCheck,
  FiX,
  FiAlertTriangle,
  FiDatabase,
  FiCopy,
  FiRefreshCw,
  FiPlay
} from 'react-icons/fi';

interface SystemCheck {
  name: string;
  status: 'checking' | 'success' | 'error' | 'warning';
  message: string;
  sql?: string;
  action?: string;
}

export default function AdminSetupPage() {
  const { t } = useI18n();

  const router = useRouter();
  const { toast } = useToast();
  const [checks, setChecks] = useState<SystemCheck[]>([]);
  const [loading, setLoading] = useState(true);
  // const [user, setUser] = useState<any>(null); // Removido - não utilizado

  // Verificar autenticação
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    
    if (!token || !userStr) {
      router.push('/login');
      return;
    }

    const user = JSON.parse(userStr);
    if (user.role !== 'ADMIN') {
      toast({
        title: "Acesso Negado",
        description: t('admin.apenasAdministradoresPodemAcessarEstaPagina'),
        variant: "destructive",
      });
      router.push('/dashboard');
      return;
    }

    runSystemChecks();
  }, [router, toast]);

  const runSystemChecks = async () => {
    setLoading(true);
    const newChecks: SystemCheck[] = [];

    // Check 1: Verificar tabela cards
    newChecks.push({
      name: 'Tabela Cards',
      status: 'checking',
      message: 'Verificando se a tabela cards existe...'
    });
    setChecks([...newChecks]);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/admin/cards/check-table', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      
      if (data.tableExists) {
        newChecks[0] = {
          name: 'Tabela Cards',
          status: 'success',
          message: `Tabela cards existe com ${data.supabaseCount} registros`
        };
      } else {
        newChecks[0] = {
          name: 'Tabela Cards',
          status: 'error',
          message: t('admin.tabelaCardsNaoExisteNoSupabase'),
          sql: `-- SQL para criar a tabela cards
CREATE TABLE IF NOT EXISTS public.cards (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  href TEXT NOT NULL,
  icon_name TEXT,
  color TEXT,
  hover_color TEXT,
  external BOOLEAN DEFAULT false,
  enabled BOOLEAN DEFAULT true,
  "order" INTEGER DEFAULT 0,
  admin_only BOOLEAN DEFAULT false,
  manager_only BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_cards_enabled ON public.cards(enabled);
CREATE INDEX IF NOT EXISTS idx_cards_order ON public.cards("order");
CREATE INDEX IF NOT EXISTS idx_cards_admin_only ON public.cards(admin_only);
CREATE INDEX IF NOT EXISTS idx_cards_manager_only ON public.cards(manager_only);

-- Habilitar RLS
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;

-- Política para leitura (todos os usuários autenticados)
CREATE POLICY IF NOT EXISTS "cards_select_policy" ON public.cards
  FOR SELECT USING (auth.role() = 'authenticated');

-- Política para inserção/atualização/exclusão (apenas admins)
CREATE POLICY IF NOT EXISTS "cards_admin_policy" ON public.cards
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users_unified 
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );`,
          action: 'execute_sql'
        };
      }
    } catch (error) {
      newChecks[0] = {
        name: 'Tabela Cards',
        status: 'error',
        message: 'Erro ao verificar tabela cards'
      };
    }

    // Check 2: Verificar conectividade Supabase
    newChecks.push({
      name: 'Conectividade Supabase',
      status: 'checking',
      message: t('admin.testandoConexaoComSupabase')
    });
    setChecks([...newChecks]);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/auth/verify-token', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        newChecks[1] = {
          name: 'Conectividade Supabase',
          status: 'success',
          message: t('admin.conexaoComSupabaseFuncionando')
        };
      } else {
        newChecks[1] = {
          name: 'Conectividade Supabase',
          status: 'error',
          message: t('admin.problemaNaConexaoComSupabase')
        };
      }
    } catch (error) {
      newChecks[1] = {
        name: 'Conectividade Supabase',
        status: 'error',
        message: t('admin.erroNaConexaoComSupabase')
      };
    }

    // Check 3: Verificar usuários
    newChecks.push({
      name: t('admin.sistemaDeUsuarios'),
      status: 'checking',
      message: t('admin.verificandoSistemaDeUsuarios')
    });
    setChecks([...newChecks]);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/admin/users/check', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        newChecks[2] = {
          name: t('admin.sistemaDeUsuarios'),
          status: 'success',
          message: t('admin.sistemaDeUsuariosFuncionandoDatausercountUsuarios')
        };
      } else {
        newChecks[2] = {
          name: t('admin.sistemaDeUsuarios'),
          status: 'warning',
          message: t('admin.sistemaDeUsuariosComProblemas')
        };
      }
    } catch (error) {
      newChecks[2] = {
        name: t('admin.sistemaDeUsuarios'),
        status: 'warning',
        message: t('admin.erroAoVerificarSistemaDeUsuarios')
      };
    }

    setChecks(newChecks);
    setLoading(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado!",
      description: t('admin.sqlCopiadoParaAAreaDeTransferencia'),
    });
  };

  const testAfterExecution = async () => {
    toast({
      title: "Testando...",
      description: t('admin.verificandoSeAsAlteracoesForamAplicadas'),
    });
    await runSystemChecks();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <FiCheck className="h-5 w-5 text-green-600" />;
      case 'error':
        return <FiX className="h-5 w-5 text-red-600" />;
      case 'warning':
        return <FiAlertTriangle className="h-5 w-5 text-yellow-600" />;
      case 'checking':
        return <FiRefreshCw className="h-5 w-5 text-blue-600 animate-spin" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'border-green-200 bg-green-50';
      case 'error':
        return 'border-red-200 bg-red-50';
      case 'warning':
        return 'border-yellow-200 bg-yellow-50';
      case 'checking':
        return 'border-blue-200 bg-blue-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  if (loading && checks.length === 0) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-screen">
          <FiRefreshCw className="animate-spin text-2xl" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Setup do Sistema</h1>
            <p className="text-gray-600">
              Diagnóstico e configuração inicial do sistema
            </p>
          </div>
          
          <Button onClick={runSystemChecks} disabled={loading}>
            <FiRefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Verificar Novamente
          </Button>
        </div>

        {/* Verificações do Sistema */}
        <div className="space-y-4">
          {checks.map((check, index) => (
            <Card key={index} className={`${getStatusColor(check.status)}`}>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  {getStatusIcon(check.status)}
                  {check.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-4">{check.message}</p>
                
                {check.sql && (
                  <div className="space-y-3">
                    <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                      <pre>{check.sql}</pre>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(check.sql!)}
                      >
                        <FiCopy className="mr-2 h-4 w-4" />
                        Copiar SQL
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={testAfterExecution}
                      >
                        <FiPlay className="mr-2 h-4 w-4" />
                        Testar Após Execução
                      </Button>
                    </div>
                    
                    <div className="bg-blue-50 border border-blue-200 p-3 rounded">
                      <p className="text-sm text-blue-800">
                        <strong>Instruções:</strong>
                      </p>
                      <ol className="text-sm text-blue-700 mt-2 space-y-1">
                        <li>1. Acesse o Supabase Dashboard</li>
                        <li>2. Vá para SQL Editor</li>
                        <li>3. Cole e execute o SQL acima</li>
                        <li>4. Clique em {t('admin.testarAposExecucao')}</li>
                      </ol>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Resumo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FiDatabase className="h-5 w-5" />
              Resumo do Sistema
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">
                  {checks.filter(c => c.status === 'success').length}
                </p>
                <p className="text-sm text-gray-600">Funcionando</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-600">
                  {checks.filter(c => c.status === 'warning').length}
                </p>
                <p className="text-sm text-gray-600">Avisos</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">
                  {checks.filter(c => c.status === 'error').length}
                </p>
                <p className="text-sm text-gray-600">Erros</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}

