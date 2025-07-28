'use client';

import React, { useState } from 'react';
import { FiPlus, FiTrash2, FiDollarSign } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import { InputField, TextArea, SelectField } from './FormFields';
import CurrencyInput from './CurrencyInput';
import FileUploader, { UploadedFile } from './FileUploader';

interface Expense {
  id: string;
  tipoReembolso: string;
  descricao: string;
  valor: string;
  comprovantes: UploadedFile[];
}

interface MultipleExpensesProps {
  expenses: Expense[];
  onChange: (expenses: Expense[]) => void;
  currency: string;
  onCurrencyChange?: (currency: string) => void;
  errors?: Record<string, any>;
}

const MultipleExpenses: React.FC<MultipleExpensesProps> = ({
  expenses,
  onChange,
  currency,
  onCurrencyChange,
  errors = {}
}) => {
  const { t } = useI18n();

  const addExpense = () => {
    const newExpense: Expense = {
      id: Math.random().toString(36).substr(2, 9),
      tipoReembolso: 'alimentacao',
      descricao: '',
      valor: '0,00',
      comprovantes: []
    };
    onChange([...expenses, newExpense]);
  };

  const removeExpense = (id: string) => {
    if (expenses.length > 1) {
      onChange(expenses.filter(expense => expense.id !== id));
    }
  };

  const updateExpense = (id: string, field: keyof Expense, value: any) => {
    onChange(expenses.map(expense => 
      expense.id === id ? { ...expense, [field]: value } : expense
    ));
  };

  const getTotalValue = () => {
    return expenses.reduce((total, expense) => {
      const value = parseFloat(expense.valor.replace(/\./g, '').replace(',', '.')) || 0;
      return total + value;
    }, 0);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency || 'BRL'
    }).format(value);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-800">
          {t('reimbursement.form.expenses', 'Despesas')}
        </h3>
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-600">
            Total: <span className="font-semibold">{formatCurrency(getTotalValue())}</span>
          </div>
          <button
            type="button"
            onClick={addExpense}
            className="flex items-center px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <FiPlus className="mr-1" />
            {t('common.add', 'Adicionar')}
          </button>
        </div>
      </div>

      {expenses.map((expense, index) => (
        <div
          key={expense.id}
          className="bg-gray-50 p-4 rounded-lg border border-gray-200"
          style={{ opacity: 1, visibility: 'visible' }}
        >
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-md font-medium text-gray-700 flex items-center">
                <FiDollarSign className="mr-2" />
                {t('reimbursement.form.expense', 'Despesa')} {index + 1}
              </h4>
              {expenses.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeExpense(expense.id)}
                  className="flex items-center px-2 py-1 text-sm text-red-600 hover:text-red-800 transition-colors"
                >
                  <FiTrash2 className="mr-1" />
                  {t('common.remove', 'Remover')}
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SelectField
                id={`tipoReembolso-${expense.id}`}
                label={t('reimbursement.form.expenseType')}
                value={expense.tipoReembolso}
                onChange={(e) => {
                  updateExpense(expense.id, 'tipoReembolso', e.target.value);
                }}
                options={[
                  { value: 'alimentacao', label: t('locale.code') === 'en-US' ? 'Food' : 'Alimentação' },
                  { value: 'transporte', label: t('locale.code') === 'en-US' ? 'Transportation' : 'Transporte' },
                  { value: 'hospedagem', label: t('locale.code') === 'en-US' ? 'Accommodation' : 'Hospedagem' },
                  { value: 'combustivel', label: t('locale.code') === 'en-US' ? 'Fuel' : 'Combustível' },
                  { value: 'material', label: t('locale.code') === 'en-US' ? 'Materials' : 'Material de Escritório' },
                  { value: 'outros', label: t('locale.code') === 'en-US' ? 'Others' : 'Outros' }
                ]}
                error={errors[`expenses.${index}.tipoReembolso`]?.message}
                required
              />

              <CurrencyInput
                id={`valor-${expense.id}`}
                label={t('reimbursement.form.amount')}
                value={expense.valor}
                onChange={(value) => updateExpense(expense.id, 'valor', value)}
                currency={currency as any}
                onCurrencyChange={onCurrencyChange}
                error={errors[`expenses.${index}.valor`]?.message}
                required
              />
            </div>

            <div className="mt-4">
              <TextArea
                id={`descricao-${expense.id}`}
                label={t('reimbursement.form.description')}
                value={expense.descricao}
                onChange={(e) => {
                  updateExpense(expense.id, 'descricao', e.target.value);
                }}
                placeholder={t('reimbursement.form.descriptionPlaceholder')}
                error={errors[`expenses.${index}.descricao`]?.message}
                required
                rows={3}
              />
            </div>

            <div className="mt-4">
              <FileUploader
                files={expense.comprovantes}
                onFilesChange={(files) => updateExpense(expense.id, 'comprovantes', files)}
                maxFiles={5}
                maxSizeInMB={10}
                acceptedFileTypes={['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']}
              />
            </div>
          </div>
        ))}
    </div>
  );
};

export default MultipleExpenses;
