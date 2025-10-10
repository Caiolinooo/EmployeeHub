'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import MainLayout from '@/components/Layout/MainLayout';
import { 
import { useI18n } from '@/contexts/I18nContext';
  FiPlus, 
  FiEdit, 
  // FiTrash2, // Removido - não utilizado
  FiRefreshCw, 
  FiDatabase,
  FiActivity,
  FiBookOpen,
  FiClipboard,
  FiFileText,
  FiBriefcase,
  FiCalendar,
  FiRss,
  FiDollarSign,
  FiSettings,
  FiUsers
} from 'react-icons/fi';

interface DashboardCard {
  id: string;
  title: string;
  description: string;
  href: string;
  icon_name: string;
  enabled: boolean;
  admin_only: boolean;
  manager_only: boolean;
  order: number;
}

const iconOptions = [
  { value: 'FiActivity', icon: FiActivity, label: 'Atividade' },
  { value: 'FiBookOpen', icon: FiBookOpen, label: 'Livro' },
  { value: 'FiClipboard', icon: FiClipboard, label: 'Prancheta' },
  { value: 'FiFileText', icon: FiFileText, label: 'Arquivo' },
  { value: 'FiBriefcase', icon: FiBriefcase, label: 'Maleta' },
  { value: 'FiCalendar', icon: FiCalendar, label: t('admin.calendario') },
  { value: 'FiRss', icon: FiRss, label: 'RSS' },
  { value: 'FiDollarSign', icon: FiDollarSign, label: 'Dinheiro' },
  { value: 'FiSettings', icon: FiSettings, label: t('admin.configuracoes') },
  { value: 'FiUsers', icon: FiUsers, label: t('admin.usuarios') },
];

export default function AdminCardsPage() {
  const { t } = useI18n();

  const router = useRouter();
  const { toast } = useToast();
  const [cards, setCards] = useState<DashboardCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [migrationStatus, setMigrationStatus] = useState<any>(null);
  // const [user, setUser] = useState<any>(null); // Removido - não utilizado

  // Verificar autenticação e permissões
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

    loadCards();
    checkMigrationStatus();
  }, [router, toast]);

  const loadCards = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/cards', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCards(data);
      }
    } catch (error) {
      console.error('Erro ao carregar cards:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkMigrationStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/admin/migrate-cards', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setMigrationStatus(data);
      }
    } catch (error) {
      console.error(t('admin.erroAoVerificarStatusDaMigracao'), error);
    }
  };

  const handleMigration = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/admin/migrate-cards', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: t('admin.migracaoConcluida'),
          description: `${result.success} sucessos, ${result.errors} erros`,
        });
        loadCards();
        checkMigrationStatus();
      } else {
        toast({
          title: t('admin.erroNaMigracao'),
          description: t('admin.falhaAoExecutarAMigracao'),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error(t('admin.erroNaMigracao'), error);
      toast({
        title: t('admin.erroNaMigracao'),
        description: t('admin.falhaAoExecutarAMigracao'),
        variant: "destructive",
      });
    }
  };

  if (loading) {
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
            <h1 className="text-3xl font-bold">Gerenciamento de Cards</h1>
            <p className="text-gray-600">
              Gerencie os cards do dashboard do sistema
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button onClick={handleMigration} variant="outline">
              <FiDatabase className="mr-2 h-4 w-4" />
              Migrar Dados
            </Button>
            
            <Button onClick={() => router.push('/admin/system/cards/new')}>
              <FiPlus className="mr-2 h-4 w-4" />
              Novo Card
            </Button>
          </div>
        </div>

        {/* Status da Migração */}
        {migrationStatus && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FiDatabase className="h-5 w-5" />
                Status da Migração
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Cards no Supabase</p>
                  <p className="text-2xl font-bold">{migrationStatus.supabaseCount}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Cards Hardcoded</p>
                  <p className="text-2xl font-bold">{migrationStatus.hardcodedCount}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Diferença</p>
                  <p className="text-2xl font-bold">{migrationStatus.hardcodedCount - migrationStatus.supabaseCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Lista de Cards */}
        <Card>
          <CardHeader>
            <CardTitle>Cards Cadastrados ({cards.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {cards.map((card) => {
                const IconComponent = iconOptions.find(opt => opt.value === card.icon_name)?.icon || FiActivity;
                
                return (
                  <div key={card.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <IconComponent className="h-5 w-5 text-blue-600" />
                        <div>
                          <h3 className="font-medium">{card.title}</h3>
                          <p className="text-sm text-gray-600">{card.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded text-xs ${card.enabled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {card.enabled ? 'Ativo' : 'Inativo'}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/admin/system/cards/${card.id}`)}
                        >
                          <FiEdit className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>Permissões:</span>
                      {card.admin_only && <span className="bg-red-100 text-red-800 px-2 py-1 rounded">Admin</span>}
                      {card.manager_only && <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded">Manager</span>}
                      {!card.admin_only && !card.manager_only && <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded">Todos</span>}
                    </div>
                  </div>
                );
              })}
              
              {cards.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <FiActivity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum card encontrado</p>
                  <p className="text-sm">Clique em "Migrar Dados" para importar os cards padrão</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}

