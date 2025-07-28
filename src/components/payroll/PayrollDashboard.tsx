'use client';

import React, { useState, useEffect } from 'react';
import {
  Calculator,
  Users,
  Building2,
  FileText,
  TrendingUp,
  Plus,
  Search,
  Filter,
  Download,
  ArrowLeft
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PayrollDashboardStats } from '@/types/payroll';
import { useI18n } from '@/contexts/I18nContext';

/**
 * Dashboard principal do módulo de folha de pagamento
 * Mantém o design system do Painel ABZ
 */
export default function PayrollDashboard() {
  const { t } = useI18n();
  const router = useRouter();
  const [stats, setStats] = useState<PayrollDashboardStats>({
    totalCompanies: 0,
    totalEmployees: 0,
    totalActiveSheets: 0,
    totalMonthlyPayroll: 0,
    recentSheets: [],
    monthlyTrends: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      // TODO: Implementar chamada para API
      // const response = await fetch('/api/payroll/dashboard');
      // const data = await response.json();
      // setStats(data);
      
      // Dados mockados por enquanto
      setStats({
        totalCompanies: 1,
        totalEmployees: 3,
        totalActiveSheets: 1,
        totalMonthlyPayroll: 21866.68,
        recentSheets: [],
        monthlyTrends: []
      });
    } catch (error) {
      console.error('Erro ao carregar dados do dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Funções de navegação
  const handleNewPayroll = () => {
    router.push('/folha-pagamento/nova');
  };

  const handleManageEmployees = () => {
    router.push('/folha-pagamento/funcionarios');
  };

  const handleManageCompanies = () => {
    router.push('/folha-pagamento/empresas');
  };

  const handleMonthlyReport = () => {
    router.push('/folha-pagamento/relatorios/mensal');
  };

  const handlePaymentGuides = () => {
    router.push('/folha-pagamento/relatorios/guias');
  };

  const handleCostAnalysis = () => {
    router.push('/folha-pagamento/relatorios/custos');
  };

  const handlePayrollCodes = () => {
    router.push('/folha-pagamento/configuracoes/codigos');
  };

  const handleCalculationProfiles = () => {
    router.push('/folha-pagamento/configuracoes/perfis');
  };

  const handleLegalTables = () => {
    router.push('/folha-pagamento/configuracoes/tabelas');
  };

  const handleCreateFirstPayroll = () => {
    router.push('/folha-pagamento/nova');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-abz-background p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 rounded w-1/4 mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white p-6 rounded-lg shadow-md">
                  <div className="h-4 bg-gray-300 rounded w-3/4 mb-4"></div>
                  <div className="h-8 bg-gray-300 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-abz-background">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Link
                href="/dashboard"
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                title={t('common.back', 'Voltar')}
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div className="p-2 bg-abz-blue/10 rounded-lg">
                <Calculator className="h-6 w-6 text-abz-blue" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-abz-text-dark">
                  {t('payroll.title', 'Folha de Pagamento')}
                </h1>
                <p className="text-gray-600">
                  {t('payroll.description', 'Gestão completa de folha de pagamento')}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={handleNewPayroll}
                className="bg-abz-blue text-white px-4 py-2 rounded-md hover:bg-abz-blue-dark transition-colors flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>{t('payroll.newPayroll', 'Nova Folha')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* Cards de Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Mensal</p>
                <p className="text-2xl font-bold text-abz-blue">
                  {formatCurrency(stats.totalMonthlyPayroll)}
                </p>
              </div>
              <div className="p-3 bg-abz-blue/10 rounded-lg">
                <TrendingUp className="h-6 w-6 text-abz-blue" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Funcionários</p>
                <p className="text-2xl font-bold text-abz-green">
                  {stats.totalEmployees}
                </p>
              </div>
              <div className="p-3 bg-abz-green/10 rounded-lg">
                <Users className="h-6 w-6 text-abz-green" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Empresas</p>
                <p className="text-2xl font-bold text-abz-purple">
                  {stats.totalCompanies}
                </p>
              </div>
              <div className="p-3 bg-abz-purple/10 rounded-lg">
                <Building2 className="h-6 w-6 text-abz-purple" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Folhas Ativas</p>
                <p className="text-2xl font-bold text-abz-orange">
                  {stats.totalActiveSheets}
                </p>
              </div>
              <div className="p-3 bg-abz-orange/10 rounded-lg">
                <FileText className="h-6 w-6 text-abz-orange" />
              </div>
            </div>
          </div>
        </div>

        {/* Ações Rápidas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
            <h3 className="text-lg font-semibold text-abz-text-dark mb-4">
              {t('payroll.quickActions', 'Ações Rápidas')}
            </h3>
            <div className="space-y-3">
              <button
                onClick={handleNewPayroll}
                className="w-full bg-abz-blue text-white px-4 py-2 rounded-md hover:bg-abz-blue-dark transition-colors flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>{t('payroll.newPayrollSheet', 'Nova Folha de Pagamento')}</span>
              </button>
              <button
                onClick={handleManageEmployees}
                className="w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 transition-colors flex items-center space-x-2"
              >
                <Users className="h-4 w-4" />
                <span>{t('payroll.manageEmployees', 'Gerenciar Funcionários')}</span>
              </button>
              <button
                onClick={handleManageCompanies}
                className="w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 transition-colors flex items-center space-x-2"
              >
                <Building2 className="h-4 w-4" />
                <span>{t('payroll.manageCompanies', 'Gerenciar Empresas')}</span>
              </button>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
            <h3 className="text-lg font-semibold text-abz-text-dark mb-4">
              {t('payroll.reports', 'Relatórios')}
            </h3>
            <div className="space-y-3">
              <button
                onClick={handleMonthlyReport}
                className="w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 transition-colors flex items-center space-x-2"
              >
                <Download className="h-4 w-4" />
                <span>{t('payroll.monthlyReport', 'Relatório Mensal')}</span>
              </button>
              <button
                onClick={handlePaymentGuides}
                className="w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 transition-colors flex items-center space-x-2"
              >
                <FileText className="h-4 w-4" />
                <span>{t('payroll.paymentGuides', 'Guias de Recolhimento')}</span>
              </button>
              <button
                onClick={handleCostAnalysis}
                className="w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 transition-colors flex items-center space-x-2"
              >
                <TrendingUp className="h-4 w-4" />
                <span>{t('payroll.costAnalysis', 'Análise de Custos')}</span>
              </button>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
            <h3 className="text-lg font-semibold text-abz-text-dark mb-4">
              {t('payroll.settings', 'Configurações')}
            </h3>
            <div className="space-y-3">
              <button
                onClick={handlePayrollCodes}
                className="w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 transition-colors"
              >
                {t('payroll.payrollCodes', 'Códigos de Folha')}
              </button>
              <button
                onClick={handleCalculationProfiles}
                className="w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 transition-colors"
              >
                {t('payroll.calculationProfiles', 'Perfis de Cálculo')}
              </button>
              <button
                onClick={handleLegalTables}
                className="w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 transition-colors"
              >
                {t('payroll.legalTables', 'Tabelas Legais')}
              </button>
            </div>
          </div>
        </div>

        {/* Folhas Recentes */}
        <div className="bg-white rounded-lg shadow-md border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-abz-text-dark">
                {t('payroll.recentSheets', 'Folhas Recentes')}
              </h3>
              <div className="flex items-center space-x-2">
                <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                  <Search className="h-4 w-4" />
                </button>
                <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                  <Filter className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
          <div className="p-6">
            {stats.recentSheets.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">{t('payroll.noPayrollSheets', 'Nenhuma folha de pagamento encontrada')}</p>
                <button
                  onClick={handleCreateFirstPayroll}
                  className="mt-4 bg-abz-blue text-white px-4 py-2 rounded-md hover:bg-abz-blue-dark transition-colors"
                >
                  {t('payroll.createFirstSheet', 'Criar primeira folha')}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Lista de folhas será implementada aqui */}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
