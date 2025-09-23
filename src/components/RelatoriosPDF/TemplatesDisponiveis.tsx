'use client';

import React, { useState } from 'react';
import { FiFileText, FiEdit, FiDownload, FiEye, FiStar, FiUsers } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import { TemplateRelatorio } from '@/types/relatorios-pdf';

interface TemplatesDisponiveisProps {
  templates: TemplateRelatorio[];
  onEditar: (template: TemplateRelatorio) => void;
  onUsar: (template: TemplateRelatorio) => void;
  canManage: boolean;
}

export default function TemplatesDisponiveis({ templates, onEditar, onUsar, canManage }: TemplatesDisponiveisProps) {
  const { t } = useI18n();
  const [filtroCategoria, setFiltroCategoria] = useState<string>('');
  const [busca, setBusca] = useState('');

  const templatesFiltrados = templates.filter(template => {
    const matchCategoria = !filtroCategoria || template.categoria === filtroCategoria;
    const matchBusca = !busca || 
      template.nome.toLowerCase().includes(busca.toLowerCase()) ||
      template.descricao.toLowerCase().includes(busca.toLowerCase()) ||
      template.tags.some(tag => tag.toLowerCase().includes(busca.toLowerCase()));
    
    return matchCategoria && matchBusca;
  });

  const categorias = [...new Set(templates.map(t => t.categoria))];

  const getIconeCategoria = (categoria: string) => {
    switch (categoria) {
      case 'avaliacao': return '📊';
      case 'desempenho': return '📈';
      case 'departamento': return '🏢';
      case 'funcionario': return '👤';
      default: return '📄';
    }
  };

  const renderEstrelas = (avaliacao: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <FiStar
        key={i}
        className={`h-4 w-4 ${i < avaliacao ? 'text-yellow-400 fill-current' : 'text-gray-300'}`}
      />
    ));
  };

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div className="flex-1 max-w-lg">
            <input
              type="text"
              placeholder={t('relatorios.buscar_templates', 'Buscar templates...')}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
          </div>
          
          <div className="flex items-center space-x-4">
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="">{t('relatorios.todas_categorias', 'Todas as categorias')}</option>
              {categorias.map(categoria => (
                <option key={categoria} value={categoria}>
                  {categoria.charAt(0).toUpperCase() + categoria.slice(1)}
                </option>
              ))}
            </select>
            
            <div className="text-sm text-gray-500">
              {templatesFiltrados.length} template(s)
            </div>
          </div>
        </div>
      </div>

      {/* Grid de Templates */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templatesFiltrados.map((template) => (
          <div key={template.id} className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow">
            {/* Preview/Thumbnail */}
            <div className="h-32 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-t-lg flex items-center justify-center">
              <div className="text-4xl">
                {getIconeCategoria(template.categoria)}
              </div>
            </div>

            {/* Conteúdo */}
            <div className="p-6">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-gray-900 mb-1">
                    {template.nome}
                  </h3>
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {template.descricao}
                  </p>
                </div>
                
                {template.publico && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <FiUsers className="mr-1 h-3 w-3" />
                    {t('relatorios.publico', 'Público')}
                  </span>
                )}
              </div>

              {/* Categoria e Tags */}
              <div className="flex items-center space-x-2 mb-3">
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  template.categoria === 'avaliacao' ? 'bg-blue-100 text-blue-800' :
                  template.categoria === 'desempenho' ? 'bg-green-100 text-green-800' :
                  template.categoria === 'departamento' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {template.categoria}
                </span>
                
                {template.tags.slice(0, 2).map(tag => (
                  <span key={tag} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                    {tag}
                  </span>
                ))}
                
                {template.tags.length > 2 && (
                  <span className="text-xs text-gray-500">
                    +{template.tags.length - 2}
                  </span>
                )}
              </div>

              {/* Estatísticas */}
              <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center">
                    {renderEstrelas(template.avaliacao)}
                    <span className="ml-1">({template.avaliacao})</span>
                  </div>
                  
                  <div className="flex items-center">
                    <FiDownload className="h-4 w-4 mr-1" />
                    {template.downloads}
                  </div>
                </div>
              </div>

              {/* Ações */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => onUsar(template)}
                  className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  <FiFileText className="mr-1 h-4 w-4" />
                  {t('relatorios.usar', 'Usar')}
                </button>
                
                <button
                  onClick={() => {
                    // Implementar preview
                    console.log('Preview template:', template);
                  }}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  <FiEye className="h-4 w-4" />
                </button>
                
                {canManage && (
                  <button
                    onClick={() => onEditar(template)}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <FiEdit className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Estado Vazio */}
      {templatesFiltrados.length === 0 && (
        <div className="text-center py-12">
          <FiFileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {t('relatorios.nenhum_template', 'Nenhum template encontrado')}
          </h3>
          <p className="text-gray-600 mb-4">
            {busca || filtroCategoria 
              ? t('relatorios.ajuste_filtros', 'Ajuste os filtros para encontrar templates')
              : t('relatorios.nenhum_template_desc', 'Não há templates disponíveis no momento')
            }
          </p>
          {canManage && (
            <button
              onClick={() => {
                // Implementar criação de novo template
                console.log('Criar novo template');
              }}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm text-sm font-medium hover:bg-blue-700"
            >
              {t('relatorios.criar_primeiro_template', 'Criar Primeiro Template')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
