'use client';

import React, { useState } from 'react';
import { FiSave, FiX, FiEye, FiPlus, FiTrash2 } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import { TemplateRelatorio, ConfiguracaoRelatorio } from '@/types/relatorios-pdf';

interface EditorTemplateProps {
  template?: TemplateRelatorio | null;
  onSalvar: (template: TemplateRelatorio) => void;
  onCancelar: () => void;
  modo: 'criar' | 'editar' | 'visualizar';
}

export default function EditorTemplate({ template, onSalvar, onCancelar, modo }: EditorTemplateProps) {
  const { t } = useI18n();
  const [dados, setDados] = useState<Partial<TemplateRelatorio>>(template || {
    nome: '',
    categoria: 'avaliacao',
    descricao: '',
    tags: [],
    publico: false,
    configuracao: {
      id: '',
      nome: '',
      descricao: '',
      tipo: 'avaliacao',
      template: '',
      parametros: [],
      graficos: [],
      tabelas: [],
      cabecalho: {
        mostrar_logo: true,
        titulo: '',
        informacoes_empresa: true,
        data_geracao: true,
        estilo: { fonte: 'helvetica', tamanho: 16, cor: '#000000' }
      },
      rodape: {
        mostrar_numeracao: true,
        informacoes_sistema: true,
        estilo: { fonte: 'helvetica', tamanho: 10, cor: '#666666' }
      },
      estilo: {
        fonte_principal: 'helvetica',
        tamanho_fonte: 12,
        cores: {
          primaria: '#3B82F6',
          secundaria: '#10B981',
          texto: '#374151',
          fundo: '#FFFFFF'
        },
        margens: { superior: 20, inferior: 20, esquerda: 20, direita: 20 },
        espacamento: { entre_secoes: 10, entre_paragrafos: 5 }
      },
      ativo: true,
      criado_por: '',
      criado_em: '',
      atualizado_em: ''
    }
  });

  const handleSalvar = () => {
    if (!dados.nome || !dados.configuracao?.nome) {
      alert('Nome é obrigatório');
      return;
    }

    const templateCompleto: TemplateRelatorio = {
      id: template?.id || `template_${Date.now()}`,
      nome: dados.nome!,
      categoria: dados.categoria!,
      descricao: dados.descricao!,
      configuracao: dados.configuracao as ConfiguracaoRelatorio,
      tags: dados.tags || [],
      publico: dados.publico || false,
      downloads: template?.downloads || 0,
      avaliacao: template?.avaliacao || 0,
      criado_por: template?.criado_por || '',
      criado_em: template?.criado_em || new Date().toISOString()
    };

    onSalvar(templateCompleto);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">
          {modo === 'criar' ? t('relatorios.criar_template', 'Criar Template') :
           modo === 'editar' ? t('relatorios.editar_template', 'Editar Template') :
           t('relatorios.visualizar_template', 'Visualizar Template')}
        </h2>
        <div className="flex items-center space-x-3">
          {modo !== 'visualizar' && (
            <button
              onClick={handleSalvar}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm text-sm font-medium hover:bg-blue-700"
            >
              <FiSave className="mr-2 h-4 w-4" />
              {t('common.salvar', 'Salvar')}
            </button>
          )}
          <button
            onClick={onCancelar}
            className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-md shadow-sm text-sm font-medium hover:bg-gray-700"
          >
            <FiX className="mr-2 h-4 w-4" />
            {t('common.cancelar', 'Cancelar')}
          </button>
        </div>
      </div>

      {/* Informações Básicas */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          {t('relatorios.informacoes_basicas', 'Informações Básicas')}
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('common.nome', 'Nome')} *
            </label>
            <input
              type="text"
              value={dados.nome || ''}
              onChange={(e) => setDados({ ...dados, nome: e.target.value })}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              disabled={modo === 'visualizar'}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('relatorios.categoria', 'Categoria')}
            </label>
            <select
              value={dados.categoria || 'avaliacao'}
              onChange={(e) => setDados({ ...dados, categoria: e.target.value })}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              disabled={modo === 'visualizar'}
            >
              <option value="avaliacao">Avaliação</option>
              <option value="desempenho">Desempenho</option>
              <option value="departamento">Departamento</option>
              <option value="funcionario">Funcionário</option>
              <option value="personalizado">Personalizado</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('common.descricao', 'Descrição')}
            </label>
            <textarea
              value={dados.descricao || ''}
              onChange={(e) => setDados({ ...dados, descricao: e.target.value })}
              rows={3}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              disabled={modo === 'visualizar'}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('relatorios.tags', 'Tags')}
            </label>
            <input
              type="text"
              value={dados.tags?.join(', ') || ''}
              onChange={(e) => setDados({ ...dados, tags: e.target.value.split(',').map(t => t.trim()) })}
              placeholder={t('components.separadasPorVirgula')}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              disabled={modo === 'visualizar'}
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              checked={dados.publico || false}
              onChange={(e) => setDados({ ...dados, publico: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              disabled={modo === 'visualizar'}
            />
            <label className="ml-2 text-sm text-gray-700">
              {t('relatorios.template_publico', 'Template Público')}
            </label>
          </div>
        </div>
      </div>

      {/* Configuração do Relatório */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          {t('relatorios.configuracao_relatorio', 'Configuração do Relatório')}
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('relatorios.nome_configuracao', 'Nome da Configuração')} *
            </label>
            <input
              type="text"
              value={dados.configuracao?.nome || ''}
              onChange={(e) => setDados({
                ...dados,
                configuracao: { ...dados.configuracao!, nome: e.target.value }
              })}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              disabled={modo === 'visualizar'}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('relatorios.tipo_relatorio', 'Tipo de Relatório')}
            </label>
            <select
              value={dados.configuracao?.tipo || 'avaliacao'}
              onChange={(e) => setDados({
                ...dados,
                configuracao: { ...dados.configuracao!, tipo: e.target.value as any }
              })}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              disabled={modo === 'visualizar'}
            >
              <option value="avaliacao">Avaliação</option>
              <option value="desempenho">Desempenho</option>
              <option value="departamento">Departamento</option>
              <option value="funcionario">Funcionário</option>
              <option value="personalizado">Personalizado</option>
            </select>
          </div>
        </div>
      </div>

      {/* Estilo do Relatório */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          {t('relatorios.estilo_relatorio', 'Estilo do Relatório')}
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('relatorios.fonte_principal', 'Fonte Principal')}
            </label>
            <select
              value={dados.configuracao?.estilo?.fonte_principal || 'helvetica'}
              onChange={(e) => setDados({
                ...dados,
                configuracao: {
                  ...dados.configuracao!,
                  estilo: { ...dados.configuracao!.estilo, fonte_principal: e.target.value }
                }
              })}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              disabled={modo === 'visualizar'}
            >
              <option value="helvetica">Helvetica</option>
              <option value="times">Times</option>
              <option value="courier">Courier</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('relatorios.tamanho_fonte', 'Tamanho da Fonte')}
            </label>
            <input
              type="number"
              min="8"
              max="24"
              value={dados.configuracao?.estilo?.tamanho_fonte || 12}
              onChange={(e) => setDados({
                ...dados,
                configuracao: {
                  ...dados.configuracao!,
                  estilo: { ...dados.configuracao!.estilo, tamanho_fonte: parseInt(e.target.value) }
                }
              })}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              disabled={modo === 'visualizar'}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('relatorios.cor_primaria', 'Cor Primária')}
            </label>
            <input
              type="color"
              value={dados.configuracao?.estilo?.cores?.primaria || '#3B82F6'}
              onChange={(e) => setDados({
                ...dados,
                configuracao: {
                  ...dados.configuracao!,
                  estilo: {
                    ...dados.configuracao!.estilo,
                    cores: { ...dados.configuracao!.estilo.cores, primaria: e.target.value }
                  }
                }
              })}
              className="block w-full h-10 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              disabled={modo === 'visualizar'}
            />
          </div>
        </div>
      </div>

      {/* Cabeçalho e Rodapé */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {t('relatorios.cabecalho', 'Cabeçalho')}
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('relatorios.titulo_cabecalho', 'Título')}
              </label>
              <input
                type="text"
                value={dados.configuracao?.cabecalho?.titulo || ''}
                onChange={(e) => setDados({
                  ...dados,
                  configuracao: {
                    ...dados.configuracao!,
                    cabecalho: { ...dados.configuracao!.cabecalho, titulo: e.target.value }
                  }
                })}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                disabled={modo === 'visualizar'}
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={dados.configuracao?.cabecalho?.mostrar_logo || false}
                  onChange={(e) => setDados({
                    ...dados,
                    configuracao: {
                      ...dados.configuracao!,
                      cabecalho: { ...dados.configuracao!.cabecalho, mostrar_logo: e.target.checked }
                    }
                  })}
                  className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  disabled={modo === 'visualizar'}
                />
                <span className="ml-2 text-sm text-gray-700">
                  {t('relatorios.mostrar_logo', 'Mostrar Logo')}
                </span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={dados.configuracao?.cabecalho?.data_geracao || false}
                  onChange={(e) => setDados({
                    ...dados,
                    configuracao: {
                      ...dados.configuracao!,
                      cabecalho: { ...dados.configuracao!.cabecalho, data_geracao: e.target.checked }
                    }
                  })}
                  className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  disabled={modo === 'visualizar'}
                />
                <span className="ml-2 text-sm text-gray-700">
                  {t('relatorios.mostrar_data_geracao', 'Mostrar Data de Geração')}
                </span>
              </label>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {t('relatorios.rodape', 'Rodapé')}
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('relatorios.texto_personalizado', 'Texto Personalizado')}
              </label>
              <input
                type="text"
                value={dados.configuracao?.rodape?.texto_personalizado || ''}
                onChange={(e) => setDados({
                  ...dados,
                  configuracao: {
                    ...dados.configuracao!,
                    rodape: { ...dados.configuracao!.rodape, texto_personalizado: e.target.value }
                  }
                })}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                disabled={modo === 'visualizar'}
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={dados.configuracao?.rodape?.mostrar_numeracao || false}
                  onChange={(e) => setDados({
                    ...dados,
                    configuracao: {
                      ...dados.configuracao!,
                      rodape: { ...dados.configuracao!.rodape, mostrar_numeracao: e.target.checked }
                    }
                  })}
                  className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  disabled={modo === 'visualizar'}
                />
                <span className="ml-2 text-sm text-gray-700">
                  {t('relatorios.mostrar_numeracao', 'Mostrar Numeração')}
                </span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={dados.configuracao?.rodape?.informacoes_sistema || false}
                  onChange={(e) => setDados({
                    ...dados,
                    configuracao: {
                      ...dados.configuracao!,
                      rodape: { ...dados.configuracao!.rodape, informacoes_sistema: e.target.checked }
                    }
                  })}
                  className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  disabled={modo === 'visualizar'}
                />
                <span className="ml-2 text-sm text-gray-700">
                  {t('relatorios.informacoes_sistema', 'Informações do Sistema')}
                </span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
