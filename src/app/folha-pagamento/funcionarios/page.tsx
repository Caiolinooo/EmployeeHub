'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  Search, 
  Filter, 
  Download,
  Building2,
  ArrowLeft
} from 'lucide-react';
import Link from 'next/link';
import EmployeeList from '@/components/payroll/EmployeeList';
import { PayrollCompany } from '@/types/payroll';

/**
 * Página de gestão de funcionários da folha de pagamento
 * Sistema de Folha de Pagamento - Painel ABZ
 */
export default function EmployeesPage() {
  const [companies, setCompanies] = useState<PayrollCompany[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/payroll/companies?limit=100');
      const data = await response.json();

      if (data.success) {
        setCompanies(data.data);
        // Selecionar primeira empresa por padrão
        if (data.data.length > 0) {
          setSelectedCompanyId(data.data[0].id);
        }
      } else {
        console.error('Erro ao carregar empresas:', data.error);
      }
    } catch (error) {
      console.error('Erro ao carregar empresas:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-abz-background">
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-300 rounded w-1/4 mb-2"></div>
              <div className="h-4 bg-gray-300 rounded w-1/3"></div>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto p-6">
          <div className="animate-pulse">
            <div className="h-64 bg-gray-300 rounded-lg"></div>
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
            <div className="flex items-center space-x-4">
              <Link
                href="/folha-pagamento"
                className="p-2 text-gray-400 hover:text-abz-blue transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-abz-green/10 rounded-lg">
                  <Users className="h-6 w-6 text-abz-green" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-abz-text-dark">
                    Funcionários
                  </h1>
                  <p className="text-gray-600">
                    Gestão de funcionários da folha de pagamento
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 transition-colors flex items-center space-x-2">
                <Download className="h-4 w-4" />
                <span>Exportar</span>
              </button>
              <button className="bg-abz-green text-white px-4 py-2 rounded-md hover:bg-abz-green-dark transition-colors flex items-center space-x-2">
                <Plus className="h-4 w-4" />
                <span>Novo Funcionário</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* Filtros */}
        <div className="bg-white rounded-lg shadow-md border border-gray-200 mb-6">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-abz-text-dark mb-4">Filtros</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Empresa
                </label>
                <select
                  value={selectedCompanyId}
                  onChange={(e) => setSelectedCompanyId(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-abz-blue focus:border-transparent"
                >
                  <option value="">Todas as empresas</option>
                  {companies.map(company => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <select className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-abz-blue focus:border-transparent">
                  <option value="">Todos os status</option>
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo</option>
                  <option value="terminated">Desligado</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cargo
                </label>
                <input
                  type="text"
                  placeholder="Filtrar por cargo..."
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-abz-blue focus:border-transparent"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Estatísticas Rápidas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total</p>
                <p className="text-2xl font-bold text-abz-blue">0</p>
              </div>
              <div className="p-3 bg-abz-blue/10 rounded-lg">
                <Users className="h-6 w-6 text-abz-blue" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Ativos</p>
                <p className="text-2xl font-bold text-green-600">0</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <Users className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Inativos</p>
                <p className="text-2xl font-bold text-yellow-600">0</p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-lg">
                <Users className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Folha Total</p>
                <p className="text-2xl font-bold text-abz-purple">R$ 0,00</p>
              </div>
              <div className="p-3 bg-abz-purple/10 rounded-lg">
                <Building2 className="h-6 w-6 text-abz-purple" />
              </div>
            </div>
          </div>
        </div>

        {/* Lista de Funcionários */}
        {companies.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-8 text-center">
            <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">
              Nenhuma empresa cadastrada
            </h3>
            <p className="text-gray-500 mb-4">
              Para gerenciar funcionários, primeiro cadastre uma empresa.
            </p>
            <Link
              href="/folha-pagamento/empresas"
              className="bg-abz-blue text-white px-4 py-2 rounded-md hover:bg-abz-blue-dark transition-colors inline-flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>Cadastrar Empresa</span>
            </Link>
          </div>
        ) : (
          <EmployeeList 
            companyId={selectedCompanyId || undefined}
          />
        )}
      </div>
    </div>
  );
}


