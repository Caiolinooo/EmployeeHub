'use client';

import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Plus, 
  Search, 
  Filter, 
  Download,
  FileSpreadsheet,
  Users,
  Calculator,
  Eye,
  Edit,
  Upload
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useI18n } from '@/contexts/I18nContext';

interface PayrollSheet {
  id: string;
  reference_month: number;
  reference_year: number;
  status: string;
  total_employees: number;
  total_gross: number;
  total_net: number;
  created_at: string;
  company: {
    id: string;
    name: string;
  };
}

interface ManualData {
  employee: {
    id: string;
    name: string;
    position: string;
  };
  manual_d: number;
  manual_e: number;
  manual_f: number;
  manual_j: number;
  manual_m: number;
}

export default function PayrollSheetsPage() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyId = searchParams?.get('companyId');
  
  const [sheets, setSheets] = useState<PayrollSheet[]>([]);
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [manualData, setManualData] = useState<ManualData[]>([]);
  const [showManualData, setShowManualData] = useState(false);

  useEffect(() => {
    if (companyId) {
      loadCompany();
      loadSheets();
    }
  }, [companyId]);

  const loadCompany = async () => {
    try {
      const response = await fetch(`/api/payroll/companies/${companyId}`);
      const data = await response.json();
      
      if (data.success) {
        setCompany(data.data);
      }
    } catch (error) {
      console.error('Erro ao carregar empresa:', error);
    }
  };

  const loadSheets = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/payroll/sheets?companyId=${companyId}`);
      const data = await response.json();
      
      if (data.success) {
        setSheets(data.data);
      }
    } catch (error) {
      console.error('Erro ao carregar folhas:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadManualData = async (sheetId: string) => {
    try {
      const response = await fetch(`/api/payroll/luz-maritima/manual-data?sheetId=${sheetId}`);
      const data = await response.json();
      
      if (data.success) {
        setManualData(data.data);
        setShowManualData(true);
      }
    } catch (error) {
      console.error('Erro ao carregar dados manuais:', error);
    }
  };

  const updateManualValue = (index: number, field: string, value: string) => {
    const newData = [...manualData];
    newData[index] = {
      ...newData[index],
      [field]: parseFloat(value) || 0
    };
    setManualData(newData);
  };

  const saveManualData = async (employeeIndex: number) => {
    const employee = manualData[employeeIndex];
    
    try {
      const response = await fetch('/api/payroll/luz-maritima/manual-data', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          employeeId: employee.employee.id,
          sheetId: selectedSheet,
          manualData: {
            manual_d: employee.manual_d,
            manual_e: employee.manual_e,
            manual_f: employee.manual_f,
            manual_j: employee.manual_j,
            manual_m: employee.manual_m
          }
        })
      });

      const data = await response.json();
      
      if (data.success) {
        alert('Dados salvos com sucesso!');
      } else {
        alert(`Erro ao salvar: ${data.error}`);
      }
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar dados');
    }
  };

  const exportSheet = async (sheetId: string, format: 'excel' | 'invoice') => {
    try {
      const response = await fetch(`/api/payroll/luz-maritima/export?sheetId=${sheetId}&format=${format}`);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${company?.name}_${format}_${new Date().getTime()}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert('Erro ao exportar arquivo');
      }
    } catch (error) {
      console.error('Erro na exportação:', error);
      alert('Erro na exportação');
    }
  };

  const isLuzMaritima = company?.name === 'LUZ MARÍTIMA LTDA';

  if (!companyId) {
    return (
      <div className="min-h-screen bg-abz-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-600">Empresa não selecionada</h2>
          <Link href="/folha-pagamento/empresas" className="text-abz-blue hover:underline">
            Voltar para empresas
          </Link>
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
                href="/folha-pagamento/empresas"
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                title="Voltar"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileSpreadsheet className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-abz-text-dark">
                  Folhas de Pagamento
                </h1>
                <p className="text-gray-600">
                  {company?.name || 'Carregando...'}
                  {isLuzMaritima && (
                    <span className="ml-2 inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                      <FileSpreadsheet className="h-3 w-3 mr-1" />
                      Workflow Importação
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Link
                href={`/folha-pagamento/nova?companyId=${companyId}`}
                className="bg-abz-blue text-white px-4 py-2 rounded-md hover:bg-abz-blue-dark transition-colors flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>Nova Folha</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* Lista de Folhas */}
        <div className="bg-white rounded-lg shadow-md border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-abz-text-dark">
              Folhas de Pagamento ({sheets.length})
            </h3>
          </div>
          
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-abz-blue mx-auto"></div>
              <p className="mt-2 text-gray-600">Carregando folhas...</p>
            </div>
          ) : sheets.length === 0 ? (
            <div className="p-8 text-center">
              <FileSpreadsheet className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-600 mb-2">
                Nenhuma folha encontrada
              </h3>
              <p className="text-gray-500 mb-4">
                Crie a primeira folha de pagamento para esta empresa.
              </p>
              <Link
                href={`/folha-pagamento/nova?companyId=${companyId}`}
                className="bg-abz-blue text-white px-4 py-2 rounded-md hover:bg-abz-blue-dark transition-colors inline-flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>Criar Primeira Folha</span>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Período
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Funcionários
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Bruto
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
                  {sheets.map((sheet) => (
                    <tr key={sheet.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {sheet.reference_month}/{sheet.reference_year}
                        </div>
                        <div className="text-sm text-gray-500">
                          {new Date(sheet.created_at).toLocaleDateString('pt-BR')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {sheet.total_employees} funcionários
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL'
                          }).format(sheet.total_gross || 0)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          sheet.status === 'approved' 
                            ? 'bg-green-100 text-green-800'
                            : sheet.status === 'calculated'
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {sheet.status === 'approved' ? 'Aprovada' : 
                           sheet.status === 'calculated' ? 'Calculada' : 'Rascunho'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center space-x-2">
                          {isLuzMaritima && (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedSheet(sheet.id);
                                  loadManualData(sheet.id);
                                }}
                                className="text-blue-600 hover:text-blue-800"
                                title="Preenchimento Manual"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => exportSheet(sheet.id, 'excel')}
                                className="text-green-600 hover:text-green-800"
                                title="Exportar Excel"
                              >
                                <Download className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => exportSheet(sheet.id, 'invoice')}
                                className="text-purple-600 hover:text-purple-800"
                                title="Exportar Invoice"
                              >
                                <FileSpreadsheet className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => router.push(`/folha-pagamento/sheet/${sheet.id}`)}
                            className="text-gray-600 hover:text-gray-800"
                            title="Visualizar"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal de Preenchimento Manual para LUZ Marítima */}
        {showManualData && isLuzMaritima && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden">
              <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Preenchimento Manual - Custos
                </h3>
                <button
                  onClick={() => setShowManualData(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-[70vh]">
                <div className="overflow-x-auto">
                  <table className="w-full table-auto">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-4 py-2 text-left">Funcionário</th>
                        <th className="px-4 py-2 text-center">Manual D</th>
                        <th className="px-4 py-2 text-center">Manual E</th>
                        <th className="px-4 py-2 text-center">Manual F</th>
                        <th className="px-4 py-2 text-center">Manual J</th>
                        <th className="px-4 py-2 text-center">Manual M</th>
                        <th className="px-4 py-2 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {manualData.map((employee, index) => (
                        <tr key={employee.employee.id} className="border-b border-gray-200">
                          <td className="px-4 py-2">
                            <div>
                              <div className="font-medium">{employee.employee.name}</div>
                              <div className="text-sm text-gray-500">{employee.employee.position}</div>
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="number"
                              step="0.01"
                              value={employee.manual_d}
                              onChange={(e) => updateManualValue(index, 'manual_d', e.target.value)}
                              className="w-20 p-1 border border-gray-300 rounded text-center"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="number"
                              step="0.01"
                              value={employee.manual_e}
                              onChange={(e) => updateManualValue(index, 'manual_e', e.target.value)}
                              className="w-20 p-1 border border-gray-300 rounded text-center"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="number"
                              step="0.01"
                              value={employee.manual_f}
                              onChange={(e) => updateManualValue(index, 'manual_f', e.target.value)}
                              className="w-20 p-1 border border-gray-300 rounded text-center"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="number"
                              step="0.01"
                              value={employee.manual_j}
                              onChange={(e) => updateManualValue(index, 'manual_j', e.target.value)}
                              className="w-20 p-1 border border-gray-300 rounded text-center"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="number"
                              step="0.01"
                              value={employee.manual_m}
                              onChange={(e) => updateManualValue(index, 'manual_m', e.target.value)}
                              className="w-20 p-1 border border-gray-300 rounded text-center"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <button
                              onClick={() => saveManualData(index)}
                              className="bg-green-600 text-white px-3 py-1 rounded-md hover:bg-green-700 transition-colors text-sm"
                            >
                              Salvar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
