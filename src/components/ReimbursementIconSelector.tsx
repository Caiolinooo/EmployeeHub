'use client';

import React, { useState, useRef } from 'react';
import {
  FiCoffee, FiShoppingBag, FiTruck, FiHome, FiDollarSign,
  FiBriefcase,
  FiTool, FiPackage, FiMonitor, FiPrinter, FiBook,
  FiUpload, FiX, FiSearch, FiPlus
} from 'react-icons/fi';
import { IconType } from 'react-icons';
import Image from 'next/image';
import { useI18n } from '@/contexts/I18nContext';

// Definição dos ícones disponíveis para reembolso
const reimbursementIcons: Record<string, { icon: IconType, label: string, category: string }> = {
  // Alimentação
  FiCoffee: { icon: FiCoffee, label: t('components.cafe'), category: 'alimentacao' },
  FiShoppingBag: { icon: FiShoppingBag, label: 'Compras', category: 'alimentacao' },
  
  // Transporte
  FiTruck: { icon: FiTruck, label: t('components.caminhao'), category: 'transporte' },

  // Hospedagem
  FiHome: { icon: FiHome, label: 'Casa', category: 'hospedagem' },
  
  // Material de Trabalho
  FiTool: { icon: FiTool, label: 'Ferramentas', category: 'material' },
  FiBriefcase: { icon: FiBriefcase, label: 'Maleta', category: 'material' },
  FiPackage: { icon: FiPackage, label: 'Pacote', category: 'material' },
  FiMonitor: { icon: FiMonitor, label: 'Monitor', category: 'material' },
  FiPrinter: { icon: FiPrinter, label: 'Impressora', category: 'material' },
  FiBook: { icon: FiBook, label: 'Livro', category: 'material' },
  
  // Outros
  FiDollarSign: { icon: FiDollarSign, label: 'Dinheiro', category: 'outro' }
};

interface ReimbursementIconSelectorProps {
  selectedIcon: string;
  onIconChange: (iconName: string) => void;
  onCustomIconUpload?: (file: File) => void;
  allowCustomUpload?: boolean;
  category?: string;
}

export default function ReimbursementIconSelector({
  selectedIcon,
  onIconChange,
  onCustomIconUpload,
  allowCustomUpload = true,
  category
}: ReimbursementIconSelectorProps) {
  const { t } = useI18n();
  const [searchTerm, setSearchTerm] = useState('');
  const [showIconGrid, setShowIconGrid] = useState(false);
  const [customIcons, setCustomIcons] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Filtrar ícones por categoria e termo de busca
  const filteredIcons = Object.entries(reimbursementIcons)
    .filter(([key, data]) => 
      (!category || data.category === category || category === 'outro') &&
      (data.label.toLowerCase().includes(searchTerm.toLowerCase()) || 
       key.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  
  // Função para renderizar o ícone
  const renderIcon = (iconName: string) => {
    // Verificar se é um ícone personalizado
    if (customIcons[iconName]) {
      return (
        <div className="w-5 h-5 flex items-center justify-center">
          <Image 
            src={customIcons[iconName]} 
            alt={iconName} 
            width={20} 
            height={20} 
            className="max-w-full max-h-full object-contain"
          />
        </div>
      );
    }
    
    // Ícone padrão
    if (reimbursementIcons[iconName]) {
      const IconComponent = reimbursementIcons[iconName].icon;
      return <IconComponent className="h-5 w-5" />;
    }
    
    return <FiDollarSign className="h-5 w-5" />;
  };
  
  // Função para selecionar um ícone
  const handleSelectIcon = (iconName: string) => {
    onIconChange(iconName);
    setShowIconGrid(false);
  };
  
  // Função para fazer upload de ícone personalizado
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onCustomIconUpload) return;
    
    // Criar um ID único para o ícone personalizado
    const iconId = `custom-${Date.now()}`;
    
    // Criar URL para o arquivo
    const fileUrl = URL.createObjectURL(file);
    
    // Adicionar ao estado de ícones personalizados
    setCustomIcons(prev => ({
      ...prev,
      [iconId]: fileUrl
    }));
    
    // Chamar a função de callback
    onCustomIconUpload(file);
    
    // Selecionar o novo ícone
    onIconChange(iconId);
    
    // Fechar o grid
    setShowIconGrid(false);
  };
  
  return (
    <div className="relative">
      <div className="flex items-center mb-2">
        <label className="block text-sm font-medium text-gray-700 mr-2">
          Ícone
        </label>
        <button
          type="button"
          onClick={() => setShowIconGrid(!showIconGrid)}
          className="text-xs text-blue-600 hover:text-blue-800"
        >
          {showIconGrid ? 'Fechar seletor' : t('components.mostrarIcones')}
        </button>
      </div>
      
      <div className="flex items-center space-x-2">
        <div className="p-3 border border-gray-300 rounded-md bg-gray-50 flex items-center justify-center w-12 h-12">
          {selectedIcon && renderIcon(selectedIcon)}
        </div>
        
        <div className="flex-1">
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => setShowIconGrid(!showIconGrid)}
              className="px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 flex-1"
            >
              {selectedIcon ? reimbursementIcons[selectedIcon]?.label || t('components.iconePersonalizado') : t('components.selecionarIcone')}
            </button>
            
            {allowCustomUpload && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="ml-2 px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                title={t('components.fazerUploadDeIconePersonalizado')}
              >
                <FiUpload className="h-5 w-5" />
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/png,image/jpeg,image/svg+xml"
                  className="hidden"
                />
              </button>
            )}
          </div>
        </div>
      </div>
      
      {showIconGrid && (
        <div className="absolute z-10 mt-2 w-full bg-white border border-gray-300 rounded-md shadow-lg p-4">
          <div className="flex items-center mb-3 border border-gray-300 rounded-md overflow-hidden">
            <div className="px-3 py-2 bg-gray-50">
              <FiSearch className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('components.buscarIcones')}
              className="flex-1 px-3 py-2 border-none focus:outline-none focus:ring-0"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="px-3 py-2 text-gray-400 hover:text-gray-600"
              >
                <FiX className="h-5 w-5" />
              </button>
            )}
          </div>
          
          <div className="max-h-60 overflow-y-auto grid grid-cols-4 gap-2">
            {filteredIcons.map(([iconName, data]) => (
              <button
                key={iconName}
                type="button"
                onClick={() => handleSelectIcon(iconName)}
                className={`p-2 rounded-md flex flex-col items-center justify-center hover:bg-gray-100 ${
                  selectedIcon === iconName ? 'bg-blue-100 border border-blue-300' : ''
                }`}
                title={data.label}
              >
                <div className="p-2">
                  {renderIcon(iconName)}
                </div>
                <span className="text-xs text-gray-600 truncate w-full text-center">
                  {data.label}
                </span>
              </button>
            ))}
            
            {/* Ícones personalizados */}
            {Object.entries(customIcons).map(([iconId, url]) => (
              <button
                key={iconId}
                type="button"
                onClick={() => handleSelectIcon(iconId)}
                className={`p-2 rounded-md flex flex-col items-center justify-center hover:bg-gray-100 ${
                  selectedIcon === iconId ? 'bg-blue-100 border border-blue-300' : ''
                }`}
                title={t('components.iconePersonalizado')}
              >
                <div className="p-2">
                  <Image 
                    src={url} 
                    alt={t('components.iconePersonalizado')} 
                    width={20} 
                    height={20} 
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
                <span className="text-xs text-gray-600 truncate w-full text-center">
                  Personalizado
                </span>
              </button>
            ))}
            
            {filteredIcons.length === 0 && Object.keys(customIcons).length === 0 && (
              <div className="col-span-4 py-4 text-center text-gray-500">
                Nenhum ícone encontrado para "{searchTerm}"
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
