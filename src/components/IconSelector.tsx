'use client';

import React, { useState, useRef, useCallback } from 'react';
import { FiUpload, FiX, FiSearch } from 'react-icons/fi';
import { IconType } from 'react-icons';
import { useI18n } from '@/contexts/I18nContext';

interface IconSelectorProps {
  selectedIcon: string;
  onIconChange: (iconName: string, iconComponent: IconType) => void;
  onCustomIconUpload?: (file: File) => void;
  allowCustomUpload?: boolean;
}

// Lista limitada de ícones mais usados para evitar importar toda a biblioteca
const commonIcons = [
  'FiHome', 'FiUser', 'FiUsers', 'FiSettings', 'FiMail', 'FiPhone',
  'FiCalendar', 'FiClock', 'FiDollarSign', 'FiFileText', 'FiImage',
  'FiFolder', 'FiDownload', 'FiUpload', 'FiEdit', 'FiTrash2',
  'FiCheck', 'FiX', 'FiPlus', 'FiMinus', 'FiSave', 'FiRefreshCw',
  'FiSearch', 'FiFilter', 'FiEye', 'FiEyeOff', 'FiHeart', 'FiStar',
  'FiShare2', 'FiMessageSquare', 'FiBell', 'FiAlertCircle', 'FiInfo',
  'FiShield', 'FiLock', 'FiUnlock', 'FiKey', 'FiGlobe', 'FiWifi',
  'FiBarChart2', 'FiTrendingUp', 'FiActivity', 'FiCpu', 'FiDatabase',
  'FiGrid', 'FiList', 'FiLayers', 'FiBookOpen', 'FiRss', 'FiLogOut'
];

export default function IconSelector({
  const { t } = useI18n();

  selectedIcon,
  onIconChange,
  onCustomIconUpload,
  allowCustomUpload = true
}: IconSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showIconGrid, setShowIconGrid] = useState(false);
  const [iconComponents, setIconComponents] = useState<Record<string, IconType>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filtrar ícones baseado no termo de busca
  const filteredIcons = commonIcons.filter(iconName =>
    iconName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Função para carregar ícone dinamicamente
  const loadIcon = useCallback(async (iconName: string): Promise<IconType | null> => {
    if (iconComponents[iconName]) {
      return iconComponents[iconName];
    }

    try {
      const iconModule = await import('react-icons/fi');
      const IconComponent = iconModule[iconName as keyof typeof iconModule] as IconType;
      
      if (IconComponent) {
        setIconComponents(prev => ({ ...prev, [iconName]: IconComponent }));
        return IconComponent;
      }
    } catch (error) {
      console.warn(t('components.erroAoCarregarIconeIconname'), error);
    }
    
    return null;
  }, [iconComponents]);

  // Componente para renderizar ícone com carregamento lazy
  const IconRenderer = ({ iconName }: { iconName: string }) => {
    const [IconComponent, setIconComponent] = useState<IconType | null>(null);
    const [loading, setLoading] = useState(true);

    React.useEffect(() => {
      loadIcon(iconName).then(component => {
        setIconComponent(component);
        setLoading(false);
      });
    }, [iconName]);

    if (loading) {
      return <div className="w-5 h-5 bg-gray-300 rounded animate-pulse" />;
    }

    if (!IconComponent) {
      return <div className="w-5 h-5 bg-red-300 rounded" />;
    }

    return <IconComponent className="h-5 w-5" />;
  };

  // Função para selecionar um ícone
  const handleSelectIcon = async (iconName: string) => {
    const IconComponent = await loadIcon(iconName);
    if (IconComponent) {
      onIconChange(iconName, IconComponent);
      setShowIconGrid(false);
    }
  };

  // Função para fazer upload de ícone personalizado
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onCustomIconUpload) {
      onCustomIconUpload(file);
      setShowIconGrid(false);
    }
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
          {showIconGrid ? 'Fechar seletor' : {t('components.mostrarIcones')}}
        </button>
      </div>

      <div className="flex items-center space-x-2">
        <div className="p-3 border border-gray-300 rounded-md bg-gray-50 flex items-center justify-center w-12 h-12">
          {selectedIcon && <IconRenderer iconName={selectedIcon} />}
        </div>

        <div className="flex-1">
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => setShowIconGrid(!showIconGrid)}
              className="px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 flex-1"
            >
              {selectedIcon || t('components.selecionarIcone')}
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

          <div className="max-h-60 overflow-y-auto grid grid-cols-6 gap-2">
            {filteredIcons.map((iconName) => (
              <button
                key={iconName}
                type="button"
                onClick={() => handleSelectIcon(iconName)}
                className={`p-2 rounded-md flex flex-col items-center justify-center hover:bg-gray-100 ${
                  selectedIcon === iconName ? 'bg-blue-100 border border-blue-300' : ''
                }`}
                title={iconName}
              >
                <div className="p-2">
                  <IconRenderer iconName={iconName} />
                </div>
                <span className="text-xs text-gray-600 truncate w-full text-center">
                  {iconName.replace('Fi', '')}
                </span>
              </button>
            ))}

            {filteredIcons.length === 0 && (
              <div className="col-span-6 py-4 text-center text-gray-500">
                Nenhum ícone encontrado para "{searchTerm}"
              </div>
            )}
          </div>

          <div className="mt-3 text-xs text-gray-500 text-center">
            Mostrando {filteredIcons.length} de {commonIcons.length} ícones mais comuns
          </div>
        </div>
      )}
    </div>
  );
}
