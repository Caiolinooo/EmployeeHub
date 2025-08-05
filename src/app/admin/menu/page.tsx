'use client';

import React, { useState } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiEye, FiEyeOff, FiArrowUp, FiArrowDown, FiSave, FiX, FiLock } from 'react-icons/fi';
import menuItems, { MenuItem } from '@/data/menu';
import { IconType } from 'react-icons';
import * as Icons from 'react-icons/fi';
import IconSelector from '@/components/IconSelector';
import { useI18n } from '@/contexts/I18nContext';

// Componente para edição de item de menu
interface MenuEditorProps {
  item: MenuItem;
  onSave: (item: MenuItem) => void;
  onCancel: () => void;
  isNew?: boolean;
}

const MenuEditor = ({ item, onSave, onCancel, isNew = false }: MenuEditorProps) => {
  const { t } = useI18n();
  const [editedItem, setEditedItem] = useState<MenuItem>({ ...item });
  const [selectedIcon, setSelectedIcon] = useState<string>(item.icon.name);

  // Lista de ícones disponíveis
  const iconOptions = Object.keys(Icons)
    .filter(key => key.startsWith('Fi'))
    .sort();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditedItem(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setEditedItem(prev => ({ ...prev, [name]: checked }));
  };

  const handleIconChange = (iconName: string, iconComponent: IconType) => {
    setSelectedIcon(iconName);
    setEditedItem(prev => ({ ...prev, icon: iconComponent }));
  };

  const handleCustomIconUpload = (file: File) => {
    // Aqui você implementaria a lógica para fazer upload do ícone personalizado
    // Por enquanto, apenas mostramos um alerta
    alert(`Upload de ícone personalizado: ${file.name}`);
    // Em uma implementação real, você faria upload do arquivo e obteria uma URL
    // Então atualizaria o estado com essa URL
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(editedItem);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          {isNew ? t('admin.addMenuItem', 'Adicionar Novo Item') : t('common.edit', 'Editar Item')}
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
            <label htmlFor="label" className="block text-sm font-medium text-gray-700 mb-1">
              Título
            </label>
            <input
              type="text"
              id="label"
              name="label"
              value={editedItem.label}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-abz-blue focus:border-abz-blue"
              required
            />
          </div>

          <div>
            <label htmlFor="href" className="block text-sm font-medium text-gray-700 mb-1">
              Link (URL)
            </label>
            <input
              type="text"
              id="href"
              name="href"
              value={editedItem.href}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-abz-blue focus:border-abz-blue"
              required
            />
          </div>

          <div>
            <IconSelector
              selectedIcon={selectedIcon}
              onIconChange={handleIconChange}
              onCustomIconUpload={handleCustomIconUpload}
              allowCustomUpload={true}
            />
          </div>

          <div>
            <label htmlFor="order" className="block text-sm font-medium text-gray-700 mb-1">
              Ordem
            </label>
            <input
              type="number"
              id="order"
              name="order"
              value={editedItem.order}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-abz-blue focus:border-abz-blue"
              min="1"
              required
            />
          </div>
        </div>

        <div className="flex items-center space-x-4 mb-4">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="enabled"
              name="enabled"
              checked={editedItem.enabled}
              onChange={handleCheckboxChange}
              className="h-4 w-4 text-abz-blue focus:ring-abz-blue border-gray-300 rounded"
            />
            <label htmlFor="enabled" className="ml-2 block text-sm text-gray-700">
              Ativo
            </label>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="external"
              name="external"
              checked={editedItem.external}
              onChange={handleCheckboxChange}
              className="h-4 w-4 text-abz-blue focus:ring-abz-blue border-gray-300 rounded"
            />
            <label htmlFor="external" className="ml-2 block text-sm text-gray-700">
              Link Externo
            </label>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="adminOnly"
              name="adminOnly"
              checked={editedItem.adminOnly}
              onChange={handleCheckboxChange}
              className="h-4 w-4 text-abz-blue focus:ring-abz-blue border-gray-300 rounded"
            />
            <label htmlFor="adminOnly" className="ml-2 block text-sm text-gray-700">
              Apenas Admin
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

// Componente para visualização de item de menu
interface MenuItemProps {
  item: MenuItem;
  onEdit: (item: MenuItem) => void;
  onDelete: (id: string) => void;
  onToggleVisibility: (id: string, enabled: boolean) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
}

const MenuItemComponent = ({ item, onEdit, onDelete, onToggleVisibility, onMoveUp, onMoveDown }: MenuItemProps) => {
  const IconComponent = item.icon;

  return (
    <div className={`bg-white rounded-lg shadow-sm p-4 border-l-4 ${item.enabled ? 'border-green-500' : 'border-gray-300'}`}>
      <div className="flex justify-between items-start">
        <div className="flex items-start space-x-3">
          <div className="p-2 rounded-full bg-gray-100">
            <IconComponent className="h-5 w-5 text-gray-600" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900">{item.label}</h3>
            <div className="flex items-center mt-2 text-xs text-gray-500">
              <span className="mr-3">Ordem: {item.order}</span>
              <span className="mr-3">Link: {item.href}</span>
              {item.external && <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded mr-1">Externo</span>}
              {item.adminOnly && <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded flex items-center"><FiLock className="h-3 w-3 mr-1" /> Admin</span>}
            </div>
          </div>
        </div>
        <div className="flex space-x-1">
          <button
            onClick={() => onMoveUp(item.id)}
            className="p-1 text-gray-500 hover:text-gray-700"
            title="Mover para cima"
          >
            <FiArrowUp className="h-4 w-4" />
          </button>
          <button
            onClick={() => onMoveDown(item.id)}
            className="p-1 text-gray-500 hover:text-gray-700"
            title="Mover para baixo"
          >
            <FiArrowDown className="h-4 w-4" />
          </button>
          <button
            onClick={() => onToggleVisibility(item.id, !item.enabled)}
            className={`p-1 ${item.enabled ? 'text-green-500 hover:text-green-700' : 'text-gray-400 hover:text-gray-600'}`}
            title={item.enabled ? 'Desativar' : 'Ativar'}
          >
            {item.enabled ? <FiEye className="h-4 w-4" /> : <FiEyeOff className="h-4 w-4" />}
          </button>
          <button
            onClick={() => onEdit(item)}
            className="p-1 text-blue-500 hover:text-blue-700"
            title="Editar"
          >
            <FiEdit2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => onDelete(item.id)}
            className="p-1 text-red-500 hover:text-red-700"
            title="Excluir"
          >
            <FiTrash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default function MenuPage() {
  const { t } = useI18n();
  const [items, setItems] = useState<MenuItem[]>(menuItems);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // Funções para gerenciar os itens de menu
  const handleEdit = (item: MenuItem) => {
    setEditingItem(item);
    setIsAdding(false);
  };

  const handleAdd = () => {
    // Criar um novo item com valores padrão
    const newItem: MenuItem = {
      id: `menu-${Date.now()}`,
      href: '/novo-item',
      label: 'Novo Item',
      icon: Icons.FiGrid,
      external: false,
      enabled: true,
      order: items.length + 1,
      adminOnly: false
    };
    setEditingItem(newItem);
    setIsAdding(true);
  };

  const handleSave = (item: MenuItem) => {
    if (isAdding) {
      // Adicionar novo item
      setItems(prev => [...prev, item]);
    } else {
      // Atualizar item existente
      setItems(prev => prev.map(i => i.id === item.id ? item : i));
    }
    setEditingItem(null);
    setIsAdding(false);
  };

  const handleCancel = () => {
    setEditingItem(null);
    setIsAdding(false);
  };

  const handleDelete = (id: string) => {
    if (window.confirm(t('admin.users.deleteConfirm', 'Tem certeza que deseja excluir este item?'))) {
      setItems(prev => prev.filter(item => item.id !== id));
    }
  };

  const handleToggleVisibility = (id: string, enabled: boolean) => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, enabled } : item
    ));
  };

  const handleMoveUp = (id: string) => {
    setItems(prev => {
      const index = prev.findIndex(item => item.id === id);
      if (index <= 0) return prev;

      const newItems = [...prev];
      const currentOrder = newItems[index].order;
      const prevOrder = newItems[index - 1].order;

      newItems[index] = { ...newItems[index], order: prevOrder };
      newItems[index - 1] = { ...newItems[index - 1], order: currentOrder };

      return newItems.sort((a, b) => a.order - b.order);
    });
  };

  const handleMoveDown = (id: string) => {
    setItems(prev => {
      const index = prev.findIndex(item => item.id === id);
      if (index >= prev.length - 1) return prev;

      const newItems = [...prev];
      const currentOrder = newItems[index].order;
      const nextOrder = newItems[index + 1].order;

      newItems[index] = { ...newItems[index], order: nextOrder };
      newItems[index + 1] = { ...newItems[index + 1], order: currentOrder };

      return newItems.sort((a, b) => a.order - b.order);
    });
  };

  // Ordenar itens por ordem
  const sortedItems = [...items].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gerenciamento de Menu</h1>
          <p className="mt-1 text-sm text-gray-500">
            Adicione, edite ou remova os itens do menu lateral.
          </p>
        </div>
        <div className="mt-4 md:mt-0">
          <button
            onClick={handleAdd}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-abz-blue hover:bg-abz-blue-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-abz-blue"
          >
            <FiPlus className="mr-2 h-4 w-4" />
            {t('admin.addMenuItem', 'Adicionar Item')}
          </button>
        </div>
      </div>

      {/* Editor de item */}
      {editingItem && (
        <MenuEditor
          item={editingItem}
          onSave={handleSave}
          onCancel={handleCancel}
          isNew={isAdding}
        />
      )}

      {/* Lista de itens */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg font-medium leading-6 text-gray-900">Itens do Menu ({sortedItems.length})</h3>
        </div>
        <div className="divide-y divide-gray-200">
          {sortedItems.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              {t('admin.noItems', 'Nenhum item encontrado. Clique em "Adicionar Item" para criar um novo.')}
            </div>
          ) : (
            <div className="space-y-3 p-4">
              {sortedItems.map(item => (
                <MenuItemComponent
                  key={item.id}
                  item={item}
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

      {/* Botão de salvar alterações */}
      <div className="flex justify-end">
        <button
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
        >
          <FiSave className="mr-2 h-4 w-4" />
          {t('common.saveSettings', 'Salvar Alterações')}
        </button>
      </div>
    </div>
  );
}
