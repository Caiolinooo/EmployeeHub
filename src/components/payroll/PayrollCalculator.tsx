'use client';

import React, { useState, useEffect } from 'react';
import { 
  Calculator, 
  DollarSign, 
  Minus, 
  Plus, 
  FileText,
  AlertCircle,
  CheckCircle,
  Info
} from 'lucide-react';
import { 
  PayrollEmployee, 
  PayrollCalculationResult, 
  PayrollCalculationItem,
  PayrollCode 
} from '@/types/payroll';
import { calculateEmployeePayroll } from '@/lib/payroll/calculations';
import { LegalTablesHelper } from '@/lib/payroll/legal-tables';
import { useI18n } from '@/contexts/I18nContext';

interface PayrollCalculatorProps {
  employee: PayrollEmployee;
  onCalculationComplete?: (result: PayrollCalculationResult) => void;
}

/**
 * Calculadora de folha de pagamento
 * Mantém o design system do Painel ABZ
 */
export default function PayrollCalculator({ employee, onCalculationComplete }: PayrollCalculatorProps) {
  const { t } = useI18n();
  const [items, setItems] = useState<PayrollCalculationItem[]>([]);
  const [codes, setCodes] = useState<PayrollCode[]>([]);
  const [result, setResult] = useState<PayrollCalculationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [showLegalInfo, setShowLegalInfo] = useState(false);

  useEffect(() => {
    loadCodes();
    initializeDefaultItems();
  }, [employee]);

  const loadCodes = async () => {
    try {
      const response = await fetch('/api/payroll/codes');
      const data = await response.json();
      
      if (data.success) {
        setCodes(data.data);
      }
    } catch (error) {
      console.error(t('components.erroAoCarregarCodigos'), error);
    }
  };

  const initializeDefaultItems = () => {
    // Inicializar com itens padrão
    const defaultItems: PayrollCalculationItem[] = [
      {
        codeId: 'base-salary',
        code: '001',
        type: 'provento',
        name: t('components.salarioBase'),
        calculationType: 'fixed',
        value: employee.baseSalary,
        quantity: 1,
        referenceValue: employee.baseSalary
      },
      {
        codeId: 'inss-legal',
        code: '104',
        type: 'desconto',
        name: 'INSS',
        calculationType: 'legal',
        value: 0,
        legalType: 'inss'
      },
      {
        codeId: 'irrf-legal',
        code: '108',
        type: 'desconto',
        name: 'IRRF',
        calculationType: 'legal',
        value: 0,
        legalType: 'irrf'
      },
      {
        codeId: 'fgts-legal',
        code: '119',
        type: 'outros',
        name: 'FGTS 8%',
        calculationType: 'legal',
        value: 0,
        legalType: 'fgts'
      }
    ];

    setItems(defaultItems);
  };

  const addItem = (codeId: string) => {
    const code = codes.find(c => c.id === codeId);
    if (!code) return;

    const newItem: PayrollCalculationItem = {
      codeId: code.id,
      code: code.code,
      type: code.type,
      name: code.name,
      calculationType: code.calculationType,
      value: code.value,
      quantity: 1,
      referenceValue: employee.baseSalary,
      legalType: code.legalType
    };

    setItems(prev => [...prev, newItem]);
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: string, value: any) => {
    setItems(prev => prev.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    ));
  };

  const calculatePayroll = async () => {
    try {
      setLoading(true);
      
      const calculationResult = calculateEmployeePayroll(employee, items);
      setResult(calculationResult);
      
      if (onCalculationComplete) {
        onCalculationComplete(calculationResult);
      }
    } catch (error) {
      console.error('Erro ao calcular folha:', error);
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

  const getItemTypeColor = (type: string) => {
    switch (type) {
      case 'provento':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'desconto':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'outros':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getItemTypeIcon = (type: string) => {
    switch (type) {
      case 'provento':
        return <Plus className="h-4 w-4" />;
      case 'desconto':
        return <Minus className="h-4 w-4" />;
      case 'outros':
        return <FileText className="h-4 w-4" />;
      default:
        return <DollarSign className="h-4 w-4" />;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-abz-blue/10 rounded-lg">
              <Calculator className="h-6 w-6 text-abz-blue" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-abz-text-dark">
                Calculadora de Folha
              </h3>
              <p className="text-sm text-gray-600">
                {employee.name} - {employee.position}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowLegalInfo(!showLegalInfo)}
              className="p-2 text-gray-400 hover:text-abz-blue transition-colors"
              title={t('components.informacoesSobreLegislacao')}
            >
              <Info className="h-4 w-4" />
            </button>
            <button
              onClick={calculatePayroll}
              disabled={loading}
              className="bg-abz-blue text-white px-4 py-2 rounded-md hover:bg-abz-blue-dark transition-colors disabled:opacity-50 flex items-center space-x-2"
            >
              <Calculator className="h-4 w-4" />
              <span>{loading ? 'Calculando...' : 'Calcular'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Informações Legais */}
        {showLegalInfo && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <Info className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="font-semibold text-blue-800 mb-2">Legislação Trabalhista 2025</h4>
                <div className="text-sm text-blue-700 space-y-1">
                  <p><strong>INSS:</strong> Alíquotas de 7,5% a 14% (teto: {formatCurrency(8157.41)})</p>
                  <p><strong>IRRF:</strong> Isenção até {formatCurrency(3036.00)} (rendimento bruto)</p>
                  <p><strong>FGTS:</strong> 8% sobre o salário bruto</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Lista de Itens */}
        <div className="space-y-4 mb-6">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-semibold text-abz-text-dark">Itens da Folha</h4>
            <select
              onChange={(e) => e.target.value && addItem(e.target.value)}
              value=""
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-abz-blue focus:border-transparent"
            >
              <option value="">Adicionar item...</option>
              {codes
                .filter(code => !items.some(item => item.codeId === code.id))
                .map(code => (
                  <option key={code.id} value={code.id}>
                    {code.code} - {code.name}
                  </option>
                ))}
            </select>
          </div>

          {items.map((item, index) => (
            <div
              key={`${item.codeId}-${index}`}
              className={`border rounded-lg p-4 ${getItemTypeColor(item.type)}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  {getItemTypeIcon(item.type)}
                  <div>
                    <h5 className="font-semibold">{item.code} - {item.name}</h5>
                    <p className="text-xs opacity-75">
                      {item.type === 'provento' ? 'Provento' : 
                       item.type === 'desconto' ? 'Desconto' : 'Outros'}
                    </p>
                  </div>
                </div>
                {!item.legalType && (
                  <button
                    onClick={() => removeItem(index)}
                    className="p-1 text-red-500 hover:text-red-700 transition-colors"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">Quantidade</label>
                  <input
                    type="number"
                    value={item.quantity || 1}
                    onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 1)}
                    min="0"
                    step="0.01"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-abz-blue focus:border-transparent"
                    disabled={item.legalType !== undefined}
                  />
                </div>
                
                {item.calculationType !== 'legal' && (
                  <div>
                    <label className="block text-xs font-medium mb-1">
                      {item.calculationType === 'percentage' ? 'Percentual (%)' : 'Valor (R$)'}
                    </label>
                    <input
                      type="number"
                      value={item.value}
                      onChange={(e) => updateItem(index, 'value', parseFloat(e.target.value) || 0)}
                      min="0"
                      step="0.01"
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-abz-blue focus:border-transparent"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium mb-1">Valor de Referência</label>
                  <input
                    type="number"
                    value={item.referenceValue || employee.baseSalary}
                    onChange={(e) => updateItem(index, 'referenceValue', parseFloat(e.target.value) || 0)}
                    min="0"
                    step="0.01"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-abz-blue focus:border-transparent"
                    disabled={item.legalType !== undefined}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Resultado do Cálculo */}
        {result && (
          <div className="border-t border-gray-200 pt-6">
            <h4 className="text-lg font-semibold text-abz-text-dark mb-4">Resultado do Cálculo</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Plus className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-800">Total Proventos</span>
                </div>
                <p className="text-xl font-bold text-green-600">
                  {formatCurrency(result.totalEarnings)}
                </p>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Minus className="h-4 w-4 text-red-600" />
                  <span className="text-sm font-medium text-red-800">Total Descontos</span>
                </div>
                <p className="text-xl font-bold text-red-600">
                  {formatCurrency(result.totalDeductions)}
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <FileText className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-800">Outros</span>
                </div>
                <p className="text-xl font-bold text-blue-600">
                  {formatCurrency(result.totalOthers)}
                </p>
              </div>

              <div className="bg-abz-blue/10 border border-abz-blue/20 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <CheckCircle className="h-4 w-4 text-abz-blue" />
                  <span className="text-sm font-medium text-abz-blue">Líquido</span>
                </div>
                <p className="text-xl font-bold text-abz-blue">
                  {formatCurrency(result.netSalary)}
                </p>
              </div>
            </div>

            {/* Detalhes dos Descontos Legais */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h5 className="font-semibold text-gray-800 mb-3">Descontos Legais</h5>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="font-medium">INSS:</span>
                  <p>Base: {formatCurrency(result.inssBase)}</p>
                  <p>Valor: {formatCurrency(result.inssValue)}</p>
                </div>
                <div>
                  <span className="font-medium">IRRF:</span>
                  <p>Base: {formatCurrency(result.irrfBase)}</p>
                  <p>Valor: {formatCurrency(result.irrfValue)}</p>
                </div>
                <div>
                  <span className="font-medium">FGTS:</span>
                  <p>Base: {formatCurrency(result.fgtsBase)}</p>
                  <p>Valor: {formatCurrency(result.fgtsValue)}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
