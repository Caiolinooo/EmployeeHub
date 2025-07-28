'use client';

import React, { useState } from 'react';
import { ArrowLeft, Download, Calendar, Filter, FileText } from 'lucide-react';
import Link from 'next/link';
import { useI18n } from '@/contexts/I18nContext';

export default function RelatorioMensalPage() {
  const { t } = useI18n();
  const [filters, setFilters] = useState({
    empresa: '',
    ano: new Date().getFullYear(),
    mes: new Date().getMonth() + 1,
    departamento: ''
  });

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilters({
      ...filters,
      [e.target.name]: e.target.value
    });
  };

  const handleGenerateReport = () => {
    console.log('Gerando relatório mensal:', filters);
    alert('Funcionalidade em desenvolvimento!');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Link
                href="/folha-pagamento"
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                title={t('common.back', 'Voltar')}
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div className="p-2 bg-abz-blue/10 rounded-lg">
                <FileText className="h-6 w-6 text-abz-blue" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-abz-text-dark">
                  {t('payroll.monthlyReport', 'Relatório Mensal')}
                </h1>
                <p className="text-gray-600">
                  Gere relatórios mensais da folha de pagamento
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Filtros */}
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-abz-text-dark mb-4 flex items-center space-x-2">
            <Filter className="h-5 w-5" />
            <span>Filtros do Relatório</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Empresa *
              </label>
              <select
                name="empresa"
                value={filters.empresa}
                onChange={handleFilterChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-abz-blue focus:border-transparent"
              >
                <option value="">Selecione uma empresa</option>
                <option value="abz-group">ABZ Group</option>
                <option value="abz-logistica">ABZ Logística</option>
                <option value="abz-transportes">ABZ Transportes</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Departamento
              </label>
              <select
                name="departamento"
                value={filters.departamento}
                onChange={handleFilterChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-abz-blue focus:border-transparent"
              >
                <option value="">Todos os departamentos</option>
                <option value="logistica">Logística</option>
                <option value="administrativo">Administrativo</option>
                <option value="financeiro">Financeiro</option>
                <option value="rh">Recursos Humanos</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ano *
              </label>
              <select
                name="ano"
                value={filters.ano}
                onChange={handleFilterChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-abz-blue focus:border-transparent"
              >
                <option value="2024">2024</option>
                <option value="2023">2023</option>
                <option value="2022">2022</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mês *
              </label>
              <select
                name="mes"
                value={filters.mes}
                onChange={handleFilterChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-abz-blue focus:border-transparent"
              >
                <option value="1">Janeiro</option>
                <option value="2">Fevereiro</option>
                <option value="3">Março</option>
                <option value="4">Abril</option>
                <option value="5">Maio</option>
                <option value="6">Junho</option>
                <option value="7">Julho</option>
                <option value="8">Agosto</option>
                <option value="9">Setembro</option>
                <option value="10">Outubro</option>
                <option value="11">Novembro</option>
                <option value="12">Dezembro</option>
              </select>
            </div>
          </div>
        </div>

        {/* Opções de Relatório */}
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-abz-text-dark mb-4">
            Opções do Relatório
          </h2>
          <div className="space-y-4">
            <div className="flex items-center">
              <input
                id="incluir-descontos"
                type="checkbox"
                defaultChecked
                className="h-4 w-4 text-abz-blue focus:ring-abz-blue border-gray-300 rounded"
              />
              <label htmlFor="incluir-descontos" className="ml-2 text-sm text-gray-700">
                Incluir detalhamento de descontos
              </label>
            </div>
            <div className="flex items-center">
              <input
                id="incluir-beneficios"
                type="checkbox"
                defaultChecked
                className="h-4 w-4 text-abz-blue focus:ring-abz-blue border-gray-300 rounded"
              />
              <label htmlFor="incluir-beneficios" className="ml-2 text-sm text-gray-700">
                Incluir benefícios e adicionais
              </label>
            </div>
            <div className="flex items-center">
              <input
                id="incluir-encargos"
                type="checkbox"
                defaultChecked
                className="h-4 w-4 text-abz-blue focus:ring-abz-blue border-gray-300 rounded"
              />
              <label htmlFor="incluir-encargos" className="ml-2 text-sm text-gray-700">
                Incluir encargos patronais
              </label>
            </div>
            <div className="flex items-center">
              <input
                id="incluir-totalizadores"
                type="checkbox"
                defaultChecked
                className="h-4 w-4 text-abz-blue focus:ring-abz-blue border-gray-300 rounded"
              />
              <label htmlFor="incluir-totalizadores" className="ml-2 text-sm text-gray-700">
                Incluir totalizadores por departamento
              </label>
            </div>
          </div>
        </div>

        {/* Formatos de Exportação */}
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-abz-text-dark mb-4">
            Formato de Exportação
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={handleGenerateReport}
              className="p-4 border-2 border-gray-200 rounded-lg hover:border-abz-blue hover:bg-abz-blue/5 transition-colors text-center"
            >
              <Download className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <div className="text-sm font-medium text-gray-900">PDF</div>
              <div className="text-xs text-gray-500">Relatório formatado</div>
            </button>
            <button
              onClick={handleGenerateReport}
              className="p-4 border-2 border-gray-200 rounded-lg hover:border-abz-blue hover:bg-abz-blue/5 transition-colors text-center"
            >
              <Download className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <div className="text-sm font-medium text-gray-900">Excel</div>
              <div className="text-xs text-gray-500">Planilha editável</div>
            </button>
            <button
              onClick={handleGenerateReport}
              className="p-4 border-2 border-gray-200 rounded-lg hover:border-abz-blue hover:bg-abz-blue/5 transition-colors text-center"
            >
              <Download className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <div className="text-sm font-medium text-gray-900">CSV</div>
              <div className="text-xs text-gray-500">Dados tabulares</div>
            </button>
          </div>
        </div>

        {/* Ações */}
        <div className="flex justify-end space-x-4">
          <Link
            href="/folha-pagamento"
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
          >
            {t('common.cancel', 'Cancelar')}
          </Link>
          <button
            onClick={handleGenerateReport}
            className="px-6 py-2 bg-abz-blue text-white rounded-md hover:bg-abz-blue-dark transition-colors flex items-center space-x-2"
          >
            <Download className="h-4 w-4" />
            <span>Gerar Relatório</span>
          </button>
        </div>
      </div>
    </div>
  );
}
