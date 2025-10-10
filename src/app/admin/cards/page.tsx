'use client';

import React, { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiEye, FiEyeOff, FiArrowUp, FiArrowDown, FiX, FiLock, FiCheck, FiInfo, FiDatabase } from 'react-icons/fi';
import { DashboardCard } from '@/data/cards';
import * as Icons from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import { CreateCardsTable } from '@/components/admin/cards/CreateCardsTable';
import { MigrateCards } from '@/components/admin/cards/MigrateCards';

// Componente para edição de card
interface CardEditorProps {
  card: DashboardCard;
  onSave: (card: DashboardCard) => void;
  onCancel: () => void;
  isNew?: boolean;
}

const CardEditor = ({ card, onSave, onCancel, isNew = false }: CardEditorProps) => {
  // Normalizar o ícone antes de inicializar o estado
  let initialIcon = card.icon;
  if (typeof initialIcon === 'string') {
    // Se for uma string, tentar obter o componente do objeto Icons
    initialIcon = Icons[initialIcon as keyof typeof Icons] || Icons.FiGrid;
  } else if (typeof initialIcon !== 'function') {
    // Se não for uma função, usar o FiGrid como fallback
    initialIcon = Icons.FiGrid;
  }

  const [editedCard, setEditedCard] = useState<DashboardCard>({
    ...card,
    icon: initialIcon
  });
  const { t } = useI18n();

  // Lista de ícones disponíveis
  const availableIcons = Object.keys(Icons)
    .filter(key => key.startsWith('Fi'))
    .sort();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    if (name === 'icon') {
      // Se estiver alterando o ícone, obter o componente do objeto Icons
      const iconComponent = Icons[value as keyof typeof Icons] || Icons.FiGrid;
      setEditedCard(prev => ({ ...prev, icon: iconComponent }));
    } else {
      setEditedCard(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setEditedCard(prev => ({ ...prev, [name]: checked }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(editedCard);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          {isNew ? t('admin.addNewCard', 'Adicionar Novo Card') : t('admin.editCard', 'Editar Card')}
        </h3>
        <button
          onClick={onCancel}
          className="text-gray-500 hover:text-gray-700"
        >
          <FiX className="h-5 w-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              {t('admin.cardTitle', 'Título')}
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={editedCard.title}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-abz-blue focus:border-abz-blue"
              required
            />
          </div>

          <div>
            <label htmlFor="href" className="block text-sm font-medium text-gray-700 mb-1">
              {t('admin.cardLink', 'Link (URL)')}
            </label>
            <input
              type="text"
              id="href"
              name="href"
              value={editedCard.href}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-abz-blue focus:border-abz-blue"
              required
            />
          </div>

          <div>
            <label htmlFor="order" className="block text-sm font-medium text-gray-700 mb-1">
              {t('admin.cardOrder', 'Ordem')}
            </label>
            <input
              type="number"
              id="order"
              name="order"
              value={editedCard.order}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-abz-blue focus:border-abz-blue"
              min="1"
              required
            />
          </div>

          <div>
            <label htmlFor="color" className="block text-sm font-medium text-gray-700 mb-1">
              {t('admin.cardColor', 'Cor')}
            </label>
            <input
              type="text"
              id="color"
              name="color"
              value={editedCard.color}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-abz-blue focus:border-abz-blue"
              required
            />
          </div>

          <div>
            <label htmlFor="icon" className="block text-sm font-medium text-gray-700 mb-1">
              {t('admin.cardIcon', 'Ícone')}
            </label>
            <select
              id="icon"
              name="icon"
              value={typeof editedCard.icon === 'function' ? (editedCard.icon as { displayName?: string }).displayName || editedCard.iconName || 'FiGrid' : 'FiGrid'}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-abz-blue focus:border-abz-blue"
              required
            >
              {availableIcons.map(iconName => (
                <option key={iconName} value={iconName}>
                  {iconName}
                </option>
              ))}
            </select>
            <div className="mt-2 flex items-center">
              <span className="mr-2 text-sm text-gray-500">Visualização:</span>
              <div className="p-2 rounded-full bg-gray-100">
                {React.createElement(
                  typeof editedCard.icon === 'function' ? editedCard.icon : Icons.FiGrid,
                  { className: "h-5 w-5 text-gray-600" }
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mb-4">
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            {t('admin.cardDescription', 'Descrição')}
          </label>
          <textarea
            id="description"
            name="description"
            value={editedCard.description}
            onChange={handleChange}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-abz-blue focus:border-abz-blue"
            required
          />
        </div>

        <div className="flex items-center space-x-4 mb-4">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="enabled"
              name="enabled"
              checked={editedCard.enabled}
              onChange={handleCheckboxChange}
              className="h-4 w-4 text-abz-blue focus:ring-abz-blue border-gray-300 rounded"
            />
            <label htmlFor="enabled" className="ml-2 block text-sm text-gray-700">
              {t('admin.cardEnabled', 'Ativo')}
            </label>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="external"
              name="external"
              checked={editedCard.external}
              onChange={handleCheckboxChange}
              className="h-4 w-4 text-abz-blue focus:ring-abz-blue border-gray-300 rounded"
            />
            <label htmlFor="external" className="ml-2 block text-sm text-gray-700">
              {t('admin.cardExternal', 'Link Externo')}
            </label>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="adminOnly"
              name="adminOnly"
              checked={editedCard.adminOnly}
              onChange={handleCheckboxChange}
              className="h-4 w-4 text-abz-blue focus:ring-abz-blue border-gray-300 rounded"
            />
            <label htmlFor="adminOnly" className="ml-2 block text-sm text-gray-700">
              {t('admin.cardAdminOnly', 'Somente Admin')}
            </label>
          </div>
        </div>

        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-abz-blue"
          >
            {t('common.cancel', 'Cancelar')}
          </button>
          <button
            type="submit"
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-abz-blue hover:bg-abz-blue-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-abz-blue"
          >
            {isNew ? t('common.add', 'Adicionar') : t('common.save', 'Salvar')}
          </button>
        </div>
      </form>
    </div>
  );
};

// Componente para visualização de card
interface CardItemProps {
  card: DashboardCard;
  onEdit: (card: DashboardCard) => void;
  onDelete: (id: string) => void;
  onToggleVisibility: (id: string, enabled: boolean) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
}

const CardItem = ({ card, onEdit, onDelete, onToggleVisibility, onMoveUp, onMoveDown }: CardItemProps) => {
  const { t } = useI18n();

  // Garantir que o ícone seja um componente válido
  let IconComponent;
  if (typeof card.icon === 'function') {
    IconComponent = card.icon;
  } else if (typeof card.icon === 'string') {
    // Se for uma string, tentar obter o componente do objeto Icons
    IconComponent = Icons[card.icon as keyof typeof Icons] || Icons.FiGrid;
  } else {
    // Fallback para FiGrid
    IconComponent = Icons.FiGrid;
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm p-4 border-l-4 ${card.enabled ? 'border-green-500' : 'border-gray-300'}`}>
      <div className="flex justify-between items-start">
        <div className="flex items-start space-x-3">
          <div className="p-2 rounded-full bg-gray-100">
            <IconComponent className="h-5 w-5 text-gray-600" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900">{card.title}</h3>
            <p className="text-sm text-gray-500 mt-1">{card.description}</p>
            <div className="flex items-center mt-2 text-xs text-gray-500">
              <span className="mr-3">Ordem: {card.order}</span>
              <span className="mr-3">Link: {card.href}</span>
              {card.external && <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded mr-1">Externo</span>}
              {card.adminOnly && <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded flex items-center"><FiLock className="h-3 w-3 mr-1" /> Admin</span>}
            </div>
          </div>
        </div>
        <div className="flex space-x-1">
          <button
            onClick={() => onMoveUp(card.id)}
            className="p-1 text-gray-500 hover:text-gray-700"
            title={t('admin.moveUp', 'Mover para cima')}
          >
            <FiArrowUp className="h-4 w-4" />
          </button>
          <button
            onClick={() => onMoveDown(card.id)}
            className="p-1 text-gray-500 hover:text-gray-700"
            title={t('admin.moveDown', 'Mover para baixo')}
          >
            <FiArrowDown className="h-4 w-4" />
          </button>
          <button
            onClick={() => onToggleVisibility(card.id, !card.enabled)}
            className={`p-1 ${card.enabled ? 'text-green-500 hover:text-green-700' : 'text-gray-400 hover:text-gray-600'}`}
            title={card.enabled ? t('admin.deactivate', 'Desativar') : t('admin.activate', 'Ativar')}
          >
            {card.enabled ? <FiEye className="h-4 w-4" /> : <FiEyeOff className="h-4 w-4" />}
          </button>
          <button
            onClick={() => onEdit(card)}
            className="p-1 text-blue-500 hover:text-blue-700"
            title={t('admin.edit', 'Editar')}
          >
            <FiEdit2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => onDelete(card.id)}
            className="p-1 text-red-500 hover:text-red-700"
            title={t('admin.delete', 'Excluir')}
          >
            <FiTrash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default function CardsPage() {
  const { t } = useI18n();
  const [cards, setCards] = useState<DashboardCard[]>([]);
  const [editingCard, setEditingCard] = useState<DashboardCard | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [tableExists, setTableExists] = useState<boolean>(true);
  // const [creatingTable, setCreatingTable] = useState<boolean>(false); // Removido - não utilizado
  const [dataSource, setDataSource] = useState<'database' | 'hardcoded' | null>(null);
  const [migrationStatus, setMigrationStatus] = useState<{ needed: boolean; inProgress: boolean; message: string | null }>({
    needed: false,
    inProgress: false,
    message: null
  });

  // Carregar cards
  const loadCards = async () => {
    setLoading(true);
    setError(null);

    try {
      // Obter o token de autenticação do localStorage
      const token = localStorage.getItem('token');

      if (!token) {
        throw new Error({t('admin.vocePrecisaEstarAutenticadoParaAcessarEstaPagina')});
      }

      console.log('Token encontrado, fazendo requisição para /api/admin/cards');

      const response = await fetch('/api/admin/cards', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Erro ao carregar cards: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      setCards(data);
    } catch (err) {
      console.error('Erro ao carregar cards:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  // Verificar se a tabela cards existe
  const checkCardsTable = async () => {
    try {
      // Obter o token de autenticação do localStorage
      const token = localStorage.getItem('token');

      if (!token) {
        throw new Error({t('admin.vocePrecisaEstarAutenticadoParaAcessarEstaPagina')});
      }

      console.log('Verificando se a tabela cards existe...');

      const response = await fetch('/api/admin/cards/check-table', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Erro ao verificar tabela: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(t('admin.resultadoDaVerificacaoDaTabelaCards'), data);

      // Verificar se a tabela existe
      setTableExists(data.exists);

      // Verificar a fonte dos dados
      if (data.source) {
        setDataSource(data.source);
        console.log(`Fonte dos dados: ${data.source}`);

        // Se estamos usando cards hardcoded, verificar o status da migração
        if (data.source === 'hardcoded') {
          checkMigrationStatus();

          // Mostrar uma mensagem informativa
          setSuccessMessage({t('admin.usandoCardsDoCodigofonteVocePodeEditarEstesCardsMa')});
          setTimeout(() => setSuccessMessage(null), 5000);
        }
      }

      if (!data.exists) {
        setError(t('admin.aTabelaDeCardsNaoExisteCliqueNoBotaoAbaixoParaCria'));
      }

      return data.exists;
    } catch (err) {
      console.error('Erro ao verificar tabela cards:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      setTableExists(false);
      return false;
    }
  };

  // Verificar o status da migração
  const checkMigrationStatus = async () => {
    try {
      // Obter o token de autenticação do localStorage
      const token = localStorage.getItem('token');

      if (!token) {
        throw new Error({t('admin.vocePrecisaEstarAutenticadoParaVerificarOStatusDaM')});
      }

      console.log(t('admin.verificandoStatusDaMigracao'));

      const response = await fetch('/api/admin/cards/migrate', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error({t('admin.erroAoVerificarStatusDaMigracaoResponsestatusRespo')});
      }

      const data = await response.json();
      console.log(t('admin.resultadoDaVerificacaoDoStatusDaMigracao'), data);

      setMigrationStatus({
        needed: data.migrationNeeded,
        inProgress: false,
        message: data.message
      });

      return data;
    } catch (err) {
      console.error(t('admin.erroAoVerificarStatusDaMigracao'), err);
      setMigrationStatus({
        needed: false,
        inProgress: false,
        message: {t('admin.erroAoVerificarStatusDaMigracao')}
      });
      return null;
    }
  };

  // Migrar cards hardcoded para o banco de dados
  const migrateCards = async () => {
    try {
      setMigrationStatus(prev => ({ ...prev, inProgress: true, message: 'Migrando cards...' }));

      // Obter o token de autenticação do localStorage
      const token = localStorage.getItem('token');

      if (!token) {
        throw new Error({t('admin.vocePrecisaEstarAutenticadoParaMigrarOsCards')});
      }

      console.log('Migrando cards hardcoded para o banco de dados...');

      const response = await fetch('/api/admin/cards/migrate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Erro ao migrar cards: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(t('admin.resultadoDaMigracaoDeCards'), data);

      setMigrationStatus({
        needed: false,
        inProgress: false,
        message: data.message
      });

      setSuccessMessage({t('admin.migracaoConcluidaDatamessage')});
      setTimeout(() => setSuccessMessage(null), 5000);

      // Recarregar os cards e verificar a fonte dos dados
      loadCards();
      checkCardsTable();

      return data;
    } catch (err) {
      console.error('Erro ao migrar cards:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      setMigrationStatus({
        needed: true,
        inProgress: false,
        message: 'Erro ao migrar cards'
      });
      setTimeout(() => setError(null), 5000);
      return null;
    }
  };

  // Função para criar a tabela cards (temporariamente desabilitada)
  // const createCardsTable = async () => {
  //   try {
  //     // setCreatingTable(true); // Removido - variável não existe
  //     setError(null);

  //     // Obter o token de autenticação do localStorage
  //     const token = localStorage.getItem('token');

  //     if (!token) {
  //       throw new Error('Você precisa estar autenticado para criar a tabela');
  //     }

  //     console.log('Criando tabela cards...');

  //     const response = await fetch('/api/admin/cards/create-table', {
  //       method: 'POST',
  //       headers: {
  //         'Authorization': `Bearer ${token}`
  //       }
  //     });

  //     if (!response.ok) {
  //       throw new Error(`Erro ao criar tabela: ${response.status} ${response.statusText}`);
  //     }

  //     const data = await response.json();
  //     console.log('Resultado da criação da tabela cards:', data);

  //     if (data.success) {
  //       setSuccessMessage('Tabela de cards criada com sucesso!');
  //       setTableExists(true);
  //       setTimeout(() => {
  //         setSuccessMessage(null);
  //         loadCards();
  //       }, 2000);
  //     } else {
  //       throw new Error(data.error || 'Erro ao criar tabela');
  //     }
  //   } catch (err) {
  //     console.error('Erro ao criar tabela cards:', err);
  //     setError(err instanceof Error ? err.message : 'Erro desconhecido');
  //   } finally {
  //     // setCreatingTable(false); // Removido - variável não existe
  //   }
  // };

  // Carregar cards quando o componente montar
  useEffect(() => {
    const init = async () => {
      const exists = await checkCardsTable();
      if (exists) {
        loadCards();
      }
    };

    init();
  }, [checkCardsTable, loadCards]);

  // Funções para gerenciar os cards
  const handleEdit = (card: DashboardCard) => {
    setEditingCard(card);
    setIsAdding(false);
  };

  const handleAdd = () => {
    // Criar um novo card com valores padrão
    const newCard: DashboardCard = {
      id: `card-${Date.now()}`,
      title: t('admin.newCard', 'Novo Card'),
      description: t('admin.newCardDescription', 'Descrição do novo card'),
      href: '/novo-card',
      icon: Icons.FiGrid, // Usar o componente FiGrid diretamente
      iconName: 'FiGrid', // Nome do ícone como string
      color: 'bg-abz-blue',
      hoverColor: 'hover:bg-abz-blue-dark',
      external: false,
      enabled: true,
      order: cards.length + 1,
      adminOnly: false
    };

    console.log(t('admin.criandoNovoCardComIcone'), typeof newCard.icon, (newCard.icon as React.ComponentType)?.displayName || newCard.iconName);

    setEditingCard(newCard);
    setIsAdding(true);
  };

  const handleSave = async (card: DashboardCard) => {
    try {
        // Preparar o card para envio (converter o ícone para string)
        const cardToSend = {
          ...card,
          // Se o ícone for um componente, extrair o nome do ícone (string)
          icon: typeof card.icon === 'function' ? (card.icon as React.ComponentType)?.displayName || 'FiGrid' : card.icon
        };

      console.log('Salvando card:', cardToSend);
      console.log('adminOnly:', cardToSend.adminOnly);

      if (isAdding) {
        // Obter o token de autenticação do localStorage
        const token = localStorage.getItem('token');

        if (!token) {
          throw new Error({t('admin.vocePrecisaEstarAutenticadoParaAdicionarUmCard')});
        }

        console.log('Adicionando novo card...');

        // Adicionar novo card
        const response = await fetch('/api/admin/cards', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(cardToSend),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Resposta de erro:', errorText);
          throw new Error(`Erro ao adicionar card: ${response.status} ${response.statusText}`);
        }

        const newCard = await response.json();
        console.log('Card adicionado com sucesso:', newCard);
        setCards(prev => [...prev, newCard]);

        setSuccessMessage(t('admin.cardAddedSuccess', 'Card adicionado com sucesso!'));
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        // Obter o token de autenticação do localStorage
        const token = localStorage.getItem('token');

        if (!token) {
          throw new Error({t('admin.vocePrecisaEstarAutenticadoParaAtualizarUmCard')});
        }

        console.log(`Atualizando card existente com ID: ${card.id}`);
        console.log('Usando novo endpoint: /api/admin/cards/update');

        // Atualizar card existente usando o novo endpoint
        try {
          const response = await fetch('/api/admin/cards/update', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(cardToSend),
          });

          console.log('Status da resposta:', response.status);

          if (!response.ok) {
            const errorText = await response.text();
            console.error('Resposta de erro:', errorText);
            throw new Error(`Erro ao atualizar card: ${response.status} ${response.statusText}`);
          }

          const result = await response.json();
          console.log('Resposta da API:', result);

          if (result.success && result.card) {
            console.log('Card atualizado com sucesso:', result.card);
            setCards(prev => prev.map(c => c.id === card.id ? result.card : c));
          } else {
            console.warn(t('admin.respostaDaApiNaoContemOCardAtualizado'), result);
            // Recarregar todos os cards para garantir que estamos exibindo os dados mais recentes
            loadCards();
          }

          setSuccessMessage(t('admin.cardUpdatedSuccess', 'Card atualizado com sucesso!'));
          setTimeout(() => setSuccessMessage(null), 3000);
        } catch (fetchError) {
          console.error(t('admin.erroNaRequisicaoFetch'), fetchError);
          throw fetchError;
        }
      }

      setEditingCard(null);
      setIsAdding(false);
    } catch (err) {
      console.error('Erro ao salvar card:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleCancel = () => {
    setEditingCard(null);
    setIsAdding(false);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm(t('admin.confirmDeleteCard', 'Tem certeza que deseja excluir este card?'))) {
      try {
        // Obter o token de autenticação do localStorage
        const token = localStorage.getItem('token');

        if (!token) {
          throw new Error({t('admin.vocePrecisaEstarAutenticadoParaExcluirUmCard')});
        }

        const response = await fetch(`/api/admin/cards/${id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error(`Erro ao excluir card: ${response.status} ${response.statusText}`);
        }

        // Atualizar o estado local
        setCards(prev => prev.filter(card => card.id !== id));

        setSuccessMessage(t('admin.cardDeletedSuccess', 'Card excluído com sucesso!'));
        setTimeout(() => setSuccessMessage(null), 3000);
      } catch (err) {
        console.error('Erro ao excluir card:', err);
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
        setTimeout(() => setError(null), 5000);
      }
    }
  };

  const handleToggleVisibility = async (id: string, enabled: boolean) => {
    try {
      // Buscar o card atual
      const card = cards.find(c => c.id === id);
      if (!card) return;

      // Obter o token de autenticação do localStorage
      const token = localStorage.getItem('token');

      if (!token) {
        throw new Error({t('admin.vocePrecisaEstarAutenticadoParaAtualizarAVisibilid')});
      }

      // Preparar o card para envio
      const cardToSend = {
        ...card,
        enabled,
        // Se o ícone for um componente, extrair o displayName
        icon: typeof card.icon === 'function' ? (card.icon as React.ComponentType)?.displayName || card.iconName || 'FiGrid' : card.icon
      };

      console.log('Atualizando visibilidade do card:', cardToSend);

      // Atualizar o card no servidor usando o novo endpoint
      const response = await fetch('/api/admin/cards/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(cardToSend),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Resposta de erro:', errorText);
        throw new Error(`Erro ao atualizar visibilidade do card: ${response.status} ${response.statusText}`);
      }

      // Processar a resposta
      const result = await response.json();
      console.log('Resposta da API:', result);

      if (result.success && result.card) {
        console.log('Card atualizado com sucesso:', result.card);
        // Atualizar o estado local com o card retornado pela API
        setCards(prev => prev.map(c => c.id === id ? result.card : c));
      } else {
        console.warn(t('admin.respostaDaApiNaoContemOCardAtualizado'), result);
        // Atualizar o estado local com base no que sabemos
        setCards(prev => prev.map(c => c.id === id ? { ...c, enabled } : c));
      }

      setSuccessMessage(t('admin.cardUpdatedSuccess', 'Card atualizado com sucesso!'));
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Erro ao atualizar visibilidade do card:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      setTimeout(() => setError(null), 5000);
    }
  };

  // Funções para ordenação de cards
  const handleMoveUp = async (id: string) => {
    try {
      const index = cards.findIndex(card => card.id === id);
      if (index <= 0) return;

      const newCards = [...cards];
      const currentCard = newCards[index];
      const prevCard = newCards[index - 1];

      // Trocar as ordens
      const currentOrder = currentCard.order;
      const prevOrder = prevCard.order;

      // Obter o token de autenticação do localStorage
      const token = localStorage.getItem('token');

      if (!token) {
        throw new Error({t('admin.vocePrecisaEstarAutenticadoParaMoverOCard')});
      }

      // Preparar os cards para envio
      const currentCardToSend = {
        ...currentCard,
        order: prevOrder,
        // Se o ícone for um componente, extrair o displayName
        icon: typeof currentCard.icon === 'function' ? (currentCard.icon as React.ComponentType)?.displayName || 'FiGrid' : currentCard.icon
      };

      const prevCardToSend = {
        ...prevCard,
        order: currentOrder,
        // Se o ícone for um componente, extrair o displayName
        icon: typeof prevCard.icon === 'function' ? (prevCard.icon as React.ComponentType)?.displayName || 'FiGrid' : prevCard.icon
      };

      console.log('Atualizando ordem dos cards:', { currentCardToSend, prevCardToSend });

      // Atualizar o card atual no servidor usando o novo endpoint
      const response1 = await fetch('/api/admin/cards/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(currentCardToSend),
      });

      if (!response1.ok) {
        const errorText = await response1.text();
        console.error('Resposta de erro (card atual):', errorText);
        throw new Error(`Erro ao atualizar ordem do card: ${response1.status} ${response1.statusText}`);
      }

      // Atualizar o card anterior no servidor usando o novo endpoint
      const response2 = await fetch('/api/admin/cards/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(prevCardToSend),
      });

      if (!response2.ok) {
        const errorText = await response2.text();
        console.error('Resposta de erro (card anterior):', errorText);
        throw new Error(`Erro ao atualizar ordem do card: ${response2.status} ${response2.statusText}`);
      }

      // Processar as respostas
      const result1 = await response1.json();
      const result2 = await response2.json();

      console.log('Respostas da API:', { result1, result2 });

      // Recarregar os cards para garantir que estamos exibindo os dados mais recentes
      loadCards();

      // Atualizar o estado local
      newCards[index] = { ...newCards[index], order: prevOrder };
      newCards[index - 1] = { ...newCards[index - 1], order: currentOrder };
      setCards(newCards.sort((a, b) => a.order - b.order));

      setSuccessMessage(t('admin.cardOrderUpdated', 'Ordem dos cards atualizada com sucesso!'));
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Erro ao mover card para cima:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleMoveDown = async (id: string) => {
    try {
      const index = cards.findIndex(card => card.id === id);
      if (index >= cards.length - 1) return;

      const newCards = [...cards];
      const currentCard = newCards[index];
      const nextCard = newCards[index + 1];

      // Trocar as ordens
      const currentOrder = currentCard.order;
      const nextOrder = nextCard.order;

      // Obter o token de autenticação do localStorage
      const token = localStorage.getItem('token');

      if (!token) {
        throw new Error({t('admin.vocePrecisaEstarAutenticadoParaMoverOCard')});
      }

      // Preparar os cards para envio
      const currentCardToSend = {
        ...currentCard,
        order: nextOrder,
        // Se o ícone for um componente, extrair o displayName
        icon: typeof currentCard.icon === 'function' ? (currentCard.icon as React.ComponentType)?.displayName || 'FiGrid' : currentCard.icon
      };

      const nextCardToSend = {
        ...nextCard,
        order: currentOrder,
        // Enviar o nome do ícone como string
        icon: nextCard.iconName
      };

      console.log('Atualizando ordem dos cards:', { currentCardToSend, nextCardToSend });

      // Atualizar o card atual no servidor usando o novo endpoint
      const response1 = await fetch('/api/admin/cards/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(currentCardToSend),
      });

      if (!response1.ok) {
        const errorText = await response1.text();
        console.error('Resposta de erro (card atual):', errorText);
        throw new Error(`Erro ao atualizar ordem do card: ${response1.status} ${response1.statusText}`);
      }

      // Atualizar o próximo card no servidor usando o novo endpoint
      const response2 = await fetch('/api/admin/cards/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(nextCardToSend),
      });

      if (!response2.ok) {
        const errorText = await response2.text();
        console.error(t('admin.respostaDeErroProximoCard'), errorText);
        throw new Error(`Erro ao atualizar ordem do card: ${response2.status} ${response2.statusText}`);
      }

      // Processar as respostas
      const result1 = await response1.json();
      const result2 = await response2.json();

      console.log('Respostas da API:', { result1, result2 });

      // Recarregar os cards para garantir que estamos exibindo os dados mais recentes
      loadCards();

      // Atualizar o estado local
      newCards[index] = { ...newCards[index], order: nextOrder };
      newCards[index + 1] = { ...newCards[index + 1], order: currentOrder };
      setCards(newCards.sort((a, b) => a.order - b.order));

      setSuccessMessage(t('admin.cardOrderUpdated', 'Ordem dos cards atualizada com sucesso!'));
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Erro ao mover card para baixo:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      setTimeout(() => setError(null), 5000);
    }
  };

  // Ordenar cards por ordem
  const sortedCards = [...cards].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('admin.cardManagementTitle', 'Gerenciamento de Cards')}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {t('admin.cardManagementDesc', 'Adicione, edite ou remova os cards exibidos no dashboard.')}
          </p>
        </div>
        <div className="mt-4 md:mt-0">
          <button
            onClick={handleAdd}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-abz-blue hover:bg-abz-blue-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-abz-blue"
          >
            <FiPlus className="mr-2 h-4 w-4" />
            {t('admin.addCard', 'Adicionar Card')}
          </button>
        </div>
      </div>

      {/* Mensagens de erro e sucesso */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md flex flex-col">
          <div className="flex items-start">
            <FiX className="text-red-500 mt-0.5 mr-2 flex-shrink-0" />
            <div>
              <p className="font-medium text-red-800">{t('common.error', 'Erro')}</p>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md flex items-start">
          <FiCheck className="text-green-500 mt-0.5 mr-2 flex-shrink-0" />
          <div>
            <p className="font-medium text-green-800">{t('common.success', 'Sucesso')}</p>
            <p className="text-sm text-green-700">{successMessage}</p>
          </div>
        </div>
      )}

      {/* Mostrar a fonte dos dados */}
      {dataSource && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <div className="flex items-start">
            <FiInfo className="text-blue-500 mt-0.5 mr-2 flex-shrink-0" />
            <div className="flex-grow">
              <p className="font-medium text-blue-800">Informação</p>
              <p className="text-sm text-blue-700">
                {dataSource === 'database'
                  ? {t('admin.osCardsEstaoSendoCarregadosDoBancoDeDados')}
                  : {t('admin.osCardsEstaoSendoCarregadosDoCodigofonteAsAlteraco')}}
              </p>

              {/* Mostrar status da migração e botão para migrar */}
              {dataSource === 'hardcoded' && migrationStatus.needed && (
                <div className="mt-3 flex flex-col sm:flex-row sm:items-center">
                  <div className="flex-grow">
                    <p className="text-sm text-amber-700 font-medium">
                      Recomendamos migrar todos os cards para o banco de dados para evitar problemas de sincronização.
                    </p>
                    {migrationStatus.message && (
                      <p className="text-xs text-amber-600 mt-1">{migrationStatus.message}</p>
                    )}
                  </div>
                  <button
                    onClick={migrateCards}
                    disabled={migrationStatus.inProgress}
                    className="mt-2 sm:mt-0 sm:ml-4 px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 flex items-center whitespace-nowrap"
                  >
                    {migrationStatus.inProgress ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                        Migrando...
                      </>
                    ) : (
                      <>
                        <FiDatabase className="mr-2" />
                        Migrar Cards
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {!tableExists && (
        <CreateCardsTable />
      )}

      {tableExists && dataSource === 'hardcoded' && (
        <div className="mb-6">
          <MigrateCards />
        </div>
      )}

      {loading && tableExists ? (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-abz-blue"></div>
          <span className="ml-2 text-gray-600">{t('common.loading', 'Carregando...')}</span>
        </div>
      ) : tableExists ? (
        <>
          {/* Editor de card */}
          {editingCard && (
            <CardEditor
              card={editingCard}
              onSave={handleSave}
              onCancel={handleCancel}
              isNew={isAdding}
            />
          )}

          {/* Lista de cards */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
              <h3 className="text-lg font-medium leading-6 text-gray-900">
                {t('admin.cardsList', 'Cards')} ({sortedCards.length})
              </h3>
            </div>
            <div className="divide-y divide-gray-200">
              {sortedCards.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  {t('admin.noCardsFound', 'Nenhum card encontrado. Clique em "Adicionar Card" para criar um novo.')}
                </div>
              ) : (
                <div className="space-y-3 p-4">
                  {sortedCards.map(card => (
                    <CardItem
                      key={card.id}
                      card={card}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onToggleVisibility={handleToggleVisibility}
                      onMoveUp={handleMoveUp}
                      onMoveDown={handleMoveDown}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <CreateCardsTable />
      )}
    </div>
  );
}
