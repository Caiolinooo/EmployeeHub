'use client';

import React, { useState } from 'react';
import { ArrowLeft, Plus, Search, Filter, Edit, Trash2, Building2 } from 'lucide-react';
import Link from 'next/link';
import { useI18n } from '@/contexts/I18nContext';

interface Company {
  id: string;
  nome: string;
  cnpj: string;
  endereco: string;
  telefone: string;
  email: string;
  funcionarios: number;
  status: 'ativa' | 'inativa';
}

export default function EmpresasPage() {
  const { t } = useI18n();
  const [searchTerm, setSearchTerm] = useState('');
  const [companies] = useState<Company[]>([
    {
      id: '1',
      nome: 'ABZ Group Ltda',
      cnpj: '12.345.678/0001-90',
      endereco: 'Rua Principal, 123 - São Paulo/SP',
      telefone: '(11) 3456-7890',
      email: 'contato@abzgroup.com',
      funcionarios: 25,
      status: 'ativa'
    },
    {
      id: '2',
      nome: 'ABZ Logística S.A.',
      cnpj: '98.765.432/0001-10',
      endereco: 'Av. Industrial, 456 - São Paulo/SP',
      telefone: '(11) 9876-5432',
      email: 'logistica@abzgroup.com',
      funcionarios: 18,
      status: 'ativa'
    },
    {
      id: '3',
      nome: 'ABZ Transportes Ltda',
      cnpj: '11.222.333/0001-44',
      endereco: 'Rua dos Transportes, 789 - São Paulo/SP',
      telefone: '(11) 1122-3344',
      email: 'transportes@abzgroup.com',
      funcionarios: 12,
      status: 'inativa'
    }
  ]);

  const filteredCompanies = companies.filter(company =>
    company.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    company.cnpj.includes(searchTerm) ||
    company.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
                <Building2 className="h-6 w-6 text-abz-blue" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-abz-text-dark">
                  {t('payroll.manageCompanies', 'Gerenciar Empresas')}
                </h1>
                <p className="text-gray-600">
                  Gerencie as empresas da folha de pagamento
                </p>
              </div>
            </div>
            <button className="bg-abz-blue text-white px-4 py-2 rounded-md hover:bg-abz-blue-dark transition-colors flex items-center space-x-2">
              <Plus className="h-4 w-4" />
              <span>Nova Empresa</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Filtros */}
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-6">
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Buscar empresas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-abz-blue focus:border-transparent"
                />
              </div>
            </div>
            <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
              <Filter className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total de Empresas</p>
                <p className="text-2xl font-bold text-abz-blue">{companies.length}</p>
              </div>
              <div className="p-3 bg-abz-blue/10 rounded-lg">
                <Building2 className="h-6 w-6 text-abz-blue" />
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Empresas Ativas</p>
                <p className="text-2xl font-bold text-green-600">
                  {companies.filter(c => c.status === 'ativa').length}
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <Building2 className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total de Funcionários</p>
                <p className="text-2xl font-bold text-purple-600">
                  {companies.reduce((total, company) => total + company.funcionarios, 0)}
                </p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <Building2 className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Lista de Empresas */}
        <div className="bg-white rounded-lg shadow-md border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-abz-text-dark">
              Empresas ({filteredCompanies.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Empresa
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    CNPJ
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contato
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Funcionários
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCompanies.map((company) => (
                  <tr key={company.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {company.nome}
                        </div>
                        <div className="text-sm text-gray-500">
                          {company.endereco}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {company.cnpj}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm text-gray-900">
                          {company.telefone}
                        </div>
                        <div className="text-sm text-gray-500">
                          {company.email}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {company.funcionarios}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        company.status === 'ativa' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {company.status === 'ativa' ? 'Ativa' : 'Inativa'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <button className="text-abz-blue hover:text-abz-blue-dark">
                          <Edit className="h-4 w-4" />
                        </button>
                        <button className="text-red-600 hover:text-red-800">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredCompanies.length === 0 && (
            <div className="text-center py-8">
              <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Nenhuma empresa encontrada</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
