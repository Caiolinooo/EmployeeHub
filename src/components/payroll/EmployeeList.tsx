'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Filter, 
  Plus, 
  Edit, 
  Trash2, 
  Building2,
  Phone,
  Mail,
  Calendar
} from 'lucide-react';
import { PayrollEmployee, PayrollEmployeeFilter } from '@/types/payroll';

interface EmployeeListProps {
  companyId?: string;
  departmentId?: string;
  onEmployeeSelect?: (employee: PayrollEmployee) => void;
  selectable?: boolean;
}

/**
 * Lista de funcionários da folha de pagamento
 * Mantém o design system do Painel ABZ
 */
export default function EmployeeList({ 
  companyId, 
  departmentId, 
  onEmployeeSelect, 
  selectable = false 
}: EmployeeListProps) {
  const [employees, setEmployees] = useState<PayrollEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<PayrollEmployeeFilter>({
    companyId,
    departmentId
  });
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);

  useEffect(() => {
    loadEmployees();
  }, [filter]);

  const loadEmployees = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams();
      if (filter.companyId) params.append('companyId', filter.companyId);
      if (filter.departmentId) params.append('departmentId', filter.departmentId);
      if (filter.name) params.append('name', filter.name);
      if (filter.position) params.append('position', filter.position);
      if (filter.status) params.append('status', filter.status);

      const response = await fetch(`/api/payroll/employees?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setEmployees(data.data);
      } else {
        console.error('Erro ao carregar funcionários:', data.error);
      }
    } catch (error) {
      console.error('Erro ao carregar funcionários:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    setFilter(prev => ({ ...prev, name: term }));
  };

  const handleEmployeeClick = (employee: PayrollEmployee) => {
    if (selectable && onEmployeeSelect) {
      onEmployeeSelect(employee);
    }
  };

  const toggleEmployeeSelection = (employeeId: string) => {
    setSelectedEmployees(prev => 
      prev.includes(employeeId) 
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('pt-BR');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-yellow-100 text-yellow-800';
      case 'terminated':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return 'Ativo';
      case 'inactive':
        return 'Inativo';
      case 'terminated':
        return 'Desligado';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md border border-gray-200">
        <div className="p-6">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-300 rounded w-1/4 mb-4"></div>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-300 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-abz-blue/10 rounded-lg">
              <Users className="h-5 w-5 text-abz-blue" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-abz-text-dark">
                Funcionários
              </h3>
              <p className="text-sm text-gray-600">
                {employees.length} funcionário{employees.length !== 1 ? 's' : ''} encontrado{employees.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button className="bg-abz-blue text-white px-4 py-2 rounded-md hover:bg-abz-blue-dark transition-colors flex items-center space-x-2">
            <Plus className="h-4 w-4" />
            <span>Novo Funcionário</span>
          </button>
        </div>

        {/* Filtros */}
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar funcionários..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-abz-blue focus:border-transparent"
            />
          </div>
          <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
            <Filter className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Lista de Funcionários */}
      <div className="p-6">
        {employees.length === 0 ? (
          <div className="text-center py-8">
            <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Nenhum funcionário encontrado</p>
            <button className="mt-4 bg-abz-blue text-white px-4 py-2 rounded-md hover:bg-abz-blue-dark transition-colors">
              Adicionar primeiro funcionário
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {employees.map((employee) => (
              <div
                key={employee.id}
                className={`border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow ${
                  selectable ? 'cursor-pointer hover:border-abz-blue' : ''
                } ${
                  selectedEmployees.includes(employee.id) ? 'border-abz-blue bg-abz-blue/5' : ''
                }`}
                onClick={() => handleEmployeeClick(employee)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    {selectable && (
                      <input
                        type="checkbox"
                        checked={selectedEmployees.includes(employee.id)}
                        onChange={() => toggleEmployeeSelection(employee.id)}
                        className="h-4 w-4 text-abz-blue focus:ring-abz-blue border-gray-300 rounded"
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                    
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h4 className="text-lg font-semibold text-abz-text-dark">
                          {employee.name}
                        </h4>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(employee.status)}`}>
                          {getStatusText(employee.status)}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-gray-600">
                        <div className="flex items-center space-x-2">
                          <Building2 className="h-4 w-4" />
                          <span>{employee.position || 'Cargo não informado'}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">Matrícula:</span>
                          <span>{employee.registrationNumber || 'N/A'}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">Salário:</span>
                          <span className="text-abz-blue font-semibold">
                            {formatCurrency(employee.baseSalary)}
                          </span>
                        </div>
                        {employee.admissionDate && (
                          <div className="flex items-center space-x-2">
                            <Calendar className="h-4 w-4" />
                            <span>Admissão: {formatDate(employee.admissionDate)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {!selectable && (
                    <div className="flex items-center space-x-2">
                      <button className="p-2 text-gray-400 hover:text-abz-blue transition-colors">
                        <Edit className="h-4 w-4" />
                      </button>
                      <button className="p-2 text-gray-400 hover:text-red-600 transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer com ações em lote */}
      {selectable && selectedEmployees.length > 0 && (
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 rounded-b-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">
              {selectedEmployees.length} funcionário{selectedEmployees.length !== 1 ? 's' : ''} selecionado{selectedEmployees.length !== 1 ? 's' : ''}
            </span>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setSelectedEmployees([])}
                className="text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                Limpar seleção
              </button>
              <button className="bg-abz-blue text-white px-4 py-2 rounded-md hover:bg-abz-blue-dark transition-colors text-sm">
                Ações em lote
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
