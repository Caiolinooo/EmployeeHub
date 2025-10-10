'use client';

import React, { useState, useEffect } from 'react';
import { FiCalendar, FiUsers, FiBriefcase, FiCheck, FiX } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import { FiltroAnalise } from '@/types/avaliacoes-avancadas';

interface FiltrosAvancadosProps {
  filtros: FiltroAnalise;
  onChange: (filtros: FiltroAnalise) => void;
  onApply: () => void;
}

export default function FiltrosAvancados({ filtros, onChange, onApply }: FiltrosAvancadosProps) {
  const { t } = useI18n();
  const [departamentos, setDepartamentos] = useState<string[]>([]);
  const [cargos, setCargos] = useState<string[]>([]);
  const [funcionarios, setFuncionarios] = useState<{ id: string; nome: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Carregar opções de filtro
  useEffect(() => {
    carregarOpcoesFiltro();
  }, []);

  const carregarOpcoesFiltro = async () => {
    try {
      setLoading(true);
      
      // Carregar departamentos únicos
      const deptResponse = await fetch('/api/avaliacoes-avancadas/opcoes-filtro?tipo=departamentos');
      if (deptResponse.ok) {
        const deptData = await deptResponse.json();
        setDepartamentos(deptData.departamentos || []);
      }

      // Carregar cargos únicos
      const cargosResponse = await fetch('/api/avaliacoes-avancadas/opcoes-filtro?tipo=cargos');
      if (cargosResponse.ok) {
        const cargosData = await cargosResponse.json();
        setCargos(cargosData.cargos || []);
      }

      // Carregar funcionários
      const funcResponse = await fetch('/api/avaliacoes-avancadas/opcoes-filtro?tipo=funcionarios');
      if (funcResponse.ok) {
        const funcData = await funcResponse.json();
        setFuncionarios(funcData.funcionarios || []);
      }

    } catch (error) {
      console.error({t('components.erroAoCarregarOpcoesDeFiltro')}, error);
    } finally {
      setLoading(false);
    }
  };

  const handlePeriodoChange = (campo: 'periodo_inicio' | 'periodo_fim', valor: string) => {
    onChange({
      ...filtros,
      [campo]: valor
    });
  };

  const handleMultiSelectChange = (campo: keyof FiltroAnalise, valor: string, checked: boolean) => {
    const arrayAtual = filtros[campo] as string[];
    let novoArray: string[];
    
    if (checked) {
      novoArray = [...arrayAtual, valor];
    } else {
      novoArray = arrayAtual.filter(item => item !== valor);
    }
    
    onChange({
      ...filtros,
      [campo]: novoArray
    });
  };

  const limparFiltros = () => {
    onChange({
      periodo_inicio: new Date(new Date().setMonth(new Date().getMonth() - 6)).toISOString().split('T')[0],
      periodo_fim: new Date().toISOString().split('T')[0],
      departamentos: [],
      cargos: [],
      funcionarios: [],
      status_avaliacoes: ['concluida'],
      criterios: []
    });
  };

  const aplicarFiltros = () => {
    onApply();
  };

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, index) => (
            <div key={index} className="space-y-2">
              <div className="h-4 bg-gray-200 rounded w-20"></div>
              <div className="h-10 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">
          {t('avaliacoes.filtros_avancados', 'Filtros Avançados')}
        </h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={limparFiltros}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <FiX className="mr-1 h-4 w-4" />
            {t('common.limpar', 'Limpar')}
          </button>
          <button
            onClick={aplicarFiltros}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            <FiCheck className="mr-1 h-4 w-4" />
            {t('common.aplicar', 'Aplicar')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Período */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            <FiCalendar className="inline mr-1 h-4 w-4" />
            {t('common.periodo_inicio', 'Período Início')}
          </label>
          <input
            type="date"
            value={filtros.periodo_inicio}
            onChange={(e) => handlePeriodoChange('periodo_inicio', e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            <FiCalendar className="inline mr-1 h-4 w-4" />
            {t('common.periodo_fim', 'Período Fim')}
          </label>
          <input
            type="date"
            value={filtros.periodo_fim}
            onChange={(e) => handlePeriodoChange('periodo_fim', e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          />
        </div>

        {/* Departamentos */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            <FiUsers className="inline mr-1 h-4 w-4" />
            {t('common.departamentos', 'Departamentos')}
          </label>
          <div className="relative">
            <select
              multiple
              value={filtros.departamentos}
              onChange={(e) => {
                const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
                onChange({ ...filtros, departamentos: selectedOptions });
              }}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              size={3}
            >
              {departamentos.map(dept => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Cargos */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            <FiBriefcase className="inline mr-1 h-4 w-4" />
            {t('common.cargos', 'Cargos')}
          </label>
          <div className="relative">
            <select
              multiple
              value={filtros.cargos}
              onChange={(e) => {
                const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
                onChange({ ...filtros, cargos: selectedOptions });
              }}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              size={3}
            >
              {cargos.map(cargo => (
                <option key={cargo} value={cargo}>
                  {cargo}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Status */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            {t('common.status', 'Status')}
          </label>
          <div className="space-y-2">
            {[
              { value: 'pendente', label: 'Pendente' },
              { value: 'em_andamento', label: 'Em Andamento' },
              { value: 'concluida', label: {t('components.concluida')} },
              { value: 'cancelada', label: 'Cancelada' }
            ].map(status => (
              <label key={status.value} className="flex items-center">
                <input
                  type="checkbox"
                  checked={filtros.status_avaliacoes.includes(status.value)}
                  onChange={(e) => handleMultiSelectChange('status_avaliacoes', status.value, e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">{status.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Funcionários Específicos */}
      {funcionarios.length > 0 && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            {t('avaliacoes.funcionarios_especificos', 'Funcionários Específicos')}
          </label>
          <div className="max-h-32 overflow-y-auto border border-gray-300 rounded-md p-2 space-y-1">
            {funcionarios.map(func => (
              <label key={func.id} className="flex items-center">
                <input
                  type="checkbox"
                  checked={filtros.funcionarios.includes(func.id)}
                  onChange={(e) => handleMultiSelectChange('funcionarios', func.id, e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">{func.nome}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Resumo dos Filtros Aplicados */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-900 mb-2">
          {t('avaliacoes.filtros_aplicados', 'Filtros Aplicados')}
        </h4>
        <div className="flex flex-wrap gap-2">
          {filtros.departamentos.length > 0 && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {filtros.departamentos.length} departamento(s)
            </span>
          )}
          {filtros.cargos.length > 0 && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              {filtros.cargos.length} cargo(s)
            </span>
          )}
          {filtros.funcionarios.length > 0 && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
              {filtros.funcionarios.length} funcionário(s)
            </span>
          )}
          {filtros.status_avaliacoes.length > 0 && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
              {filtros.status_avaliacoes.length} status
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
