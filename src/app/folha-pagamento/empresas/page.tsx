'use client';

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Search, Filter, Edit, Trash2, Building2, Upload, FileSpreadsheet, Workflow } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/contexts/I18nContext';
import { PayrollCompany } from '@/types/payroll';

export default function EmpresasPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [companies, setCompanies] = useState<PayrollCompany[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/payroll/companies');
      const data = await response.json();

      if (data.success) {
        setCompanies(data.data);
      }
    } catch (error) {
      console.error('Erro ao carregar empresas:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCompanyWorkflowType = (company: PayrollCompany) => {
    if (company.name === 'LUZ MARÍTIMA LTDA') {
      return 'import_based';
    }
    return 'standard';
  };

  const handleCompanyWorkflow = (company: PayrollCompany) => {
    const workflowType = getCompanyWorkflowType(company);

    if (workflowType === 'import_based') {
      router.push(`/folha-pagamento/import?companyId=${company.id}&type=luz-maritima`);
    } else {
      router.push(`/folha-pagamento/funcionarios?companyId=${company.id}`);
    }
  };

  const handleImportData = (company: PayrollCompany) => {
    if (company.name === 'LUZ MARÍTIMA LTDA') {
      // Criar input file para upload
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.xlsx,.xls';
      input.onchange = (e) => handleFileUpload(e, company.id);
      input.click();
    } else {
      alert('Importação disponível apenas para clientes específicos');
    }
  };

  const handleFileUpload = async (event: any, companyId: string) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const month = prompt('Mês de referência (1-12):');
    const year = prompt('Ano de referência:');

    if (!month || !year) {
      alert('Mês e ano são obrigatórios');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('companyId', companyId);
      formData.append('referenceMonth', month);
      formData.append('referenceYear', year);

      const response = await fetch('/api/payroll/luz-maritima/import', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        alert(`Importação concluída! ${data.data.employeesImported} funcionários e ${data.data.payrollRecords} registros importados.`);
        router.push(`/folha-pagamento/sheets?companyId=${companyId}`);
      } else {
        alert(`Erro na importação: ${data.error}`);
      }
    } catch (error) {
      console.error('Erro no upload:', error);
      alert('Erro no upload do arquivo');
    }
  };

  const filteredCompanies = companies.filter(company =>
    company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    company.cnpj.includes(searchTerm) ||
    (company.email && company.email.toLowerCase().includes(searchTerm.toLowerCase()))
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
                  {companies.filter(c => c.isActive).length}
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
                <p className="text-sm font-medium text-gray-600">Workflows Especiais</p>
                <p className="text-2xl font-bold text-purple-600">
                  {companies.filter(c => getCompanyWorkflowType(c) === 'import_based').length}
                </p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <FileSpreadsheet className="h-6 w-6 text-purple-600" />
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
                    Workflow
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
                          {company.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {company.address || 'Endereço não informado'}
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
                          {company.phone || 'Não informado'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {company.email || 'Não informado'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getCompanyWorkflowType(company) === 'import_based' ? (
                          <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                            <FileSpreadsheet className="h-3 w-3 mr-1" />
                            Importação
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                            <Workflow className="h-3 w-3 mr-1" />
                            Padrão
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        company.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {company.isActive ? 'Ativa' : 'Inativa'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        {getCompanyWorkflowType(company) === 'import_based' ? (
                          <>
                            <button
                              onClick={() => handleImportData(company)}
                              className="text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                              title="Importar Planilha"
                            >
                              <Upload className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => router.push(`/folha-pagamento/sheets?companyId=${company.id}`)}
                              className="text-green-600 hover:text-green-800 flex items-center space-x-1"
                              title="Ver Folhas"
                            >
                              <FileSpreadsheet className="h-4 w-4" />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleCompanyWorkflow(company)}
                            className="text-abz-blue hover:text-abz-blue-dark flex items-center space-x-1"
                            title="Gerenciar Funcionários"
                          >
                            <Workflow className="h-4 w-4" />
                          </button>
                        )}
                        <button className="text-gray-600 hover:text-gray-800" title="Editar">
                          <Edit className="h-4 w-4" />
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
