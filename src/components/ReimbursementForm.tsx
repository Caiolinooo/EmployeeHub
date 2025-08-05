'use client';

import React, { useState, useEffect } from 'react';
import { useForm, Controller, SubmitHandler, Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion, AnimatePresence } from 'framer-motion';
import { FiSend, FiDownload, FiMessageSquare } from 'react-icons/fi';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Currency } from '@/lib/currencyConverter';
import { useI18n } from '@/contexts/I18nContext';
import { UserProfile } from '@/contexts/SupabaseAuthContext';

import type { FormValues } from '@/lib/schema';
import { refinedFormSchema, validatePixKey } from '@/lib/schema';
import { formatCurrency, formatPhone, formatCPF } from '@/lib/utils';
import { InputField, TextArea, SelectField } from './FormFields';
import PaymentMethodRadio from './PaymentMethodRadio';
import DescriptionField from './DescriptionField';
import CurrencyInput from './CurrencyInput';
import { fetchWithAuth, getAuthToken } from '@/lib/authUtils';

import FileUploader from './FileUploader';
import PdfViewer from './PdfViewer';
import MultipleExpenses from './MultipleExpenses';
import ThankYouModal from './ThankYouModal';
import ContactPopup from './ContactPopup';

// Animation variants
const formContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      when: 'beforeChildren',
      staggerChildren: 0.1,
      duration: 0.3
    }
  }
};

const sectionVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5 }
  }
};

interface ReimbursementFormProps {
  profile?: UserProfile | null;
}

export default function ReimbursementForm({ profile }: ReimbursementFormProps) {
  const { t } = useI18n();
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [protocol, setProtocol] = useState('');
  const [showPdfViewer, setShowPdfViewer] = useState(true);
  const [showThankYou, setShowThankYou] = useState(false);
  const [showContactPopup, setShowContactPopup] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>('BRL');
  const [fieldsPopulated, setFieldsPopulated] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  // Verificar autenticação quando o componente carrega
  useEffect(() => {
    const checkAuthentication = async () => {
      try {
        console.log('🔍 ReimbursementForm - Verificando status de autenticação...');

        // Verificar múltiplas fontes de token
        let token = null;

        // 1. Tentar getAuthToken primeiro
        try {
          token = await getAuthToken();
          if (token) {
            console.log('✅ Token encontrado via getAuthToken');
          }
        } catch (authError) {
          console.warn('Erro ao usar getAuthToken:', authError);
        }

        // 2. Se não encontrou, verificar localStorage diretamente
        if (!token && typeof window !== 'undefined') {
          token = localStorage.getItem('token') ||
                  localStorage.getItem('abzToken') ||
                  localStorage.getItem('auth-token');

          if (token) {
            console.log('✅ Token encontrado no localStorage');
          }
        }

        // 3. Verificar se há uma sessão ativa
        if (!token) {
          try {
            const response = await fetch('/api/auth/session', {
              method: 'GET',
              credentials: 'include'
            });

            if (response.ok) {
              const sessionData = await response.json();
              if (sessionData.data?.session?.access_token) {
                token = sessionData.data.session.access_token;
                console.log('✅ Token encontrado na sessão');
              }
            }
          } catch (sessionError) {
            console.warn('Erro ao verificar sessão:', sessionError);
          }
        }

        setIsAuthenticated(!!token);
        console.log(token ? '✅ Usuário autenticado para reembolso' : '❌ Usuário não autenticado para reembolso');

        // Se autenticado, tentar carregar dados do perfil
        if (token && !profile) {
          try {
            const profileResponse = await fetch('/api/users-unified/profile', {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });

            if (profileResponse.ok) {
              const profileData = await profileResponse.json();
              console.log('✅ Dados do perfil carregados para o formulário');
              // Aqui você pode usar os dados do perfil se necessário
            }
          } catch (profileError) {
            console.warn('Erro ao carregar perfil:', profileError);
          }
        }

      } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
        setIsAuthenticated(false);
      }
    };

    checkAuthentication();
  }, [profile]);

  // Função para determinar centro de custo baseado no CPF
  const getCostCenterByCPF = (cpf: string): string => {
    // Remove formatação do CPF
    const cleanCPF = cpf.replace(/\D/g, '');

    // Lógica para determinar centro de custo baseado no CPF
    // Por enquanto, vamos usar ABZ como padrão
    // Você pode implementar uma lógica mais específica aqui
    return 'abz';
  };

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    setValue,
    trigger,
    reset,
    setError,
    clearErrors
  } = useForm<FormValues>({
    resolver: zodResolver(refinedFormSchema) as Resolver<FormValues>,
    defaultValues: {
      nome: '',
      email: '',
      telefone: '',
      data: new Date().toISOString().split('T')[0],
      expenses: [{
        id: Math.random().toString(36).substr(2, 9),
        tipoReembolso: 'alimentacao',
        descricao: '',
        valor: '0,00',
        comprovantes: []
      }],
      tipoReembolso: 'alimentacao',
      descricao: '',
      valorTotal: '',
      moeda: 'BRL' as Currency,
      metodoPagamento: 'deposito',
      banco: null,
      agencia: null,
      conta: null,
      pixTipo: null,
      pixChave: null,
      observacoes: null,
      cargo: '',
      centroCusto: 'abz',
      cpf: ''
    }
  });

  // Watch values for conditional rendering with fallbacks for undefined values
  const metodoPagamento = watch('metodoPagamento') || 'deposito';
  const pixTipo = watch('pixTipo') || null;
  const tipoReembolso = watch('tipoReembolso') || 'alimentacao';
  const expenses = watch('expenses') || [];

  // Auto-populate form fields with user profile data
  useEffect(() => {
    if (profile && !fieldsPopulated) {
      console.log('Auto-populating form fields with user profile data');

      // Map profile fields to form fields
      if (profile.first_name && profile.last_name) {
        const fullName = `${profile.first_name} ${profile.last_name}`.trim();
        setValue('nome', fullName);
        console.log('Auto-populated name:', fullName);
      }

      if (profile.email) {
        setValue('email', profile.email);
        console.log('Auto-populated email:', profile.email);
      }

      if (profile.phone_number) {
        const formattedPhone = formatPhone(profile.phone_number);
        setValue('telefone', formattedPhone);
        console.log('Auto-populated phone:', formattedPhone);
      }

      if (profile.position) {
        setValue('cargo', profile.position);
        console.log('Auto-populated position:', profile.position);
      }

      if (profile.department) {
        // Map department to a cost center if possible
        let costCenter = '';
        const department = profile.department.toLowerCase();

        if (department.includes('luz') || department.includes('maritima')) {
          costCenter = 'luz_maritima';
        } else if (department.includes('fms')) {
          costCenter = 'fms';
        } else if (department.includes('msi')) {
          costCenter = 'msi';
        } else if (department.includes('omega')) {
          costCenter = 'omega';
        } else if (department.includes('constellation')) {
          costCenter = 'constellation';
        } else if (department.includes('sentinel')) {
          costCenter = 'sentinel';
        } else if (department.includes('ahk')) {
          costCenter = 'ahk';
        }

        if (costCenter) {
          setValue('centroCusto', costCenter);
          console.log('Auto-populated cost center from department:', costCenter);
        } else {
          // Se não conseguir mapear o departamento, usar ABZ como padrão
          setValue('centroCusto', 'abz');
          console.log('Auto-populated cost center as default: abz');
        }
      } else {
        // Se não há departamento, usar ABZ como padrão
        setValue('centroCusto', 'abz');
        console.log('Auto-populated cost center as default (no department): abz');
      }

      // Mark fields as populated to prevent re-population on re-renders
      setFieldsPopulated(true);
    }
  }, [profile, fieldsPopulated, setValue]);

  const onSubmit: SubmitHandler<FormValues> = async (data) => {
    try {
      console.log('🚀 onSubmit CHAMADO!');
      console.log('📋 Dados recebidos:', data);
      setSubmitting(true);
      console.log('Iniciando envio do formulário de reembolso...');

      // Verificar se o usuário está autenticado antes de enviar
      console.log('🔍 Verificando autenticação...');
      const token = await getAuthToken();

      if (!token) {
        console.error('❌ Usuário não autenticado');
        toast.error(t('reimbursement.form.authStatus.redirectingToLogin', 'Você precisa estar logado para enviar um reembolso. Redirecionando para login...'));

        // Redirecionar para login após 2 segundos
        setTimeout(() => {
          window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname);
        }, 2000);

        setSubmitting(false);
        return;
      }

      console.log('✅ Usuário autenticado, prosseguindo com envio...');

      // Validar se há pelo menos uma despesa
      if (!data.expenses || data.expenses.length === 0) {
        toast.error('É necessário adicionar pelo menos uma despesa.');
        setSubmitting(false);
        return;
      }

      // Calcular valor total das despesas
      const totalValue = data.expenses.reduce((total, expense) => {
        const value = parseFloat(expense.valor.replace(/\./g, '').replace(',', '.')) || 0;
        return total + value;
      }, 0);

      console.log(`Valor total calculado: ${totalValue}`);

      // Verificar se todas as despesas têm comprovantes
      const expensesWithoutReceipts = data.expenses.filter(expense =>
        !expense.comprovantes || expense.comprovantes.length === 0
      );

      if (expensesWithoutReceipts.length > 0) {
        toast.error('Todas as despesas devem ter pelo menos um comprovante.');
        setSubmitting(false);
        return;
      }

      if (!data.centroCusto || data.centroCusto.trim() === '') {
        console.error('Centro de custo não informado:', data.centroCusto);
        setError('centroCusto', { type: 'manual', message: t('reimbursement.form.costCenterRequired') });
        toast.error('Por favor, selecione um centro de custo.');
        setSubmitting(false);
        return;
      }

      // Processar múltiplas despesas
      const processedExpenses = data.expenses.map(expense => ({
        ...expense,
        valor: expense.valor.replace(/\./g, '').replace(',', '.'),
        comprovantes: expense.comprovantes.map((file: any) => {
          const isLocalFile = file.isLocalFile === true;
          let base64Buffer = null;

          if (file.buffer) {
            try {
              if (typeof file.buffer === 'string' && file.buffer.startsWith('data:')) {
                base64Buffer = file.buffer;
                console.log(`Arquivo ${file.name} já tem DataURL (${base64Buffer.length} caracteres)`);
              } else if (file.buffer instanceof ArrayBuffer) {
                const bytes = new Uint8Array(file.buffer);
                const len = bytes.byteLength;
                let binary = '';
                for (let i = 0; i < len; i++) {
                  binary += String.fromCharCode(bytes[i]);
                }
                base64Buffer = btoa(binary);
                console.log(`Buffer do arquivo ${file.name} convertido para base64 (${base64Buffer.length} caracteres)`);
              } else {
                console.log(`Tipo de buffer não reconhecido para ${file.name}: ${typeof file.buffer}`);
              }
            } catch (bufferError) {
              console.error(`Erro ao processar buffer: ${file.name}`, bufferError);
            }
          }

          return {
            nome: file.name,
            url: file.id,
            tipo: file.type,
            tamanho: file.size,
            publicUrl: file.url,
            isLocalFile,
            file: isLocalFile ? file.file : undefined,
            buffer: base64Buffer,
            dados: base64Buffer
          };
        })
      }));

      // Para compatibilidade com o backend, usar a primeira despesa como principal
      const mainExpense = processedExpenses[0];

      // Garantir que centroCusto tenha um valor válido
      const centroCusto = data.centroCusto && data.centroCusto.trim() !== '' ? data.centroCusto : 'abz';

      const formData = {
        ...data,
        centroCusto: centroCusto,
        expenses: processedExpenses,
        valorTotal: totalValue.toString(),
        moeda: selectedCurrency, // Usar a moeda selecionada no componente
        tipoReembolso: mainExpense.tipoReembolso,
        descricao: processedExpenses.map(exp => `${exp.tipoReembolso}: ${exp.descricao}`).join('; '),
        comprovantes: processedExpenses.flatMap(exp => exp.comprovantes)
      };

      console.log('Moeda selecionada:', selectedCurrency);
      console.log('Valor total:', totalValue);
      console.log('FormData moeda:', formData.moeda);

      console.log('Enviando dados para a API de criação de reembolso...');
      console.log('Centro de custo no formData:', formData.centroCusto);
      console.log('FormData completo:', formData);

      const response = await fetchWithAuth('/api/reembolso/create', {
        method: 'POST',
        body: JSON.stringify(formData),
      });

      console.log(`Resposta da API: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Erro retornado pela API:', errorData);
        throw new Error(errorData.error || 'Erro ao enviar formulário');
      }

      const result = await response.json();
      console.log('Resultado do envio:', result);

      setProtocol(result.protocolo);
      console.log(`Protocolo gerado: ${result.protocolo}`);

      toast.success('Formulário enviado com sucesso!');
      setSubmitSuccess(true);
      setShowThankYou(true);

      reset();
    } catch (error) {
      console.error('Error submitting form:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao enviar formulário. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCurrencyChange = (value: string) => {
    setValue('valorTotal', value);
  };

  const handleCurrencyTypeChange = (currency: Currency) => {
    setValue('moeda', currency);
    setSelectedCurrency(currency);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue('telefone', formatPhone(e.target.value));
  };

  const handleCPFChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue('cpf', formatCPF(e.target.value));
  };

  const validatePixKeyField = () => {
    const pixTipoValue = watch('pixTipo');
    const pixChaveValue = watch('pixChave');

    if (pixTipoValue && pixChaveValue) {
      const isValid = validatePixKey(pixTipoValue, pixChaveValue);

      if (!isValid) {
        setError('pixChave', {
          type: 'manual',
          message: t('locale.code') === 'en-US'
            ? `Invalid PIX key for type ${pixTipoValue === 'cpf' ? 'TAX ID' : pixTipoValue}`
            : `Chave PIX inválida para o tipo ${pixTipoValue}`
        });
      } else {
        clearErrors('pixChave');
      }
    }
  };

  return (
    <>
      <AnimatePresence mode="wait">
        {showPdfViewer && (
          <PdfViewer
            onClose={() => setShowPdfViewer(false)}
            onUnderstand={() => setShowPdfViewer(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {showThankYou && (
          <ThankYouModal
            protocol={protocol}
            onClose={() => setShowThankYou(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {showContactPopup && (
          <ContactPopup onClose={() => setShowContactPopup(false)} />
        )}
      </AnimatePresence>

      <div
        className="bg-white rounded-lg shadow-lg p-6 md:p-8"
        style={{ opacity: 1, visibility: 'visible' }}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">{t('reimbursement.form.title')}</h2>
          <button
            type="button"
            onClick={() => setShowContactPopup(true)}
            className="flex items-center text-blue-600 hover:text-blue-800"
          >
            <FiMessageSquare className="mr-1" />
            <span className="text-sm">{t('common.help')}</span>
          </button>
        </div>

        {/* Banner de Status de Autenticação */}
        {isAuthenticated === false && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  {t('reimbursement.form.authStatus.loginRequired', 'Login necessário')}
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>
                    {t('reimbursement.form.authStatus.loginRequiredMessage', 'Você precisa estar logado para enviar um reembolso.')}
                    <button
                      onClick={() => window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname)}
                      className="font-medium underline hover:text-yellow-600 ml-1"
                    >
                      {t('reimbursement.form.authStatus.loginLink', 'Clique aqui para fazer login')}
                    </button>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {isAuthenticated === true && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-green-800">
                  ✅ {t('reimbursement.form.authStatus.authenticated', 'Você está logado e pode enviar reembolsos')}
                </p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          <div className="bg-gray-50 p-5 rounded-lg" style={{ opacity: 1, visibility: 'visible' }}>
            <h3 className="text-lg font-medium text-gray-800 mb-4">{t('reimbursement.form.personalInfo')}</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Controller
                name="nome"
                control={control}
                render={({ field }) => (
                  <InputField
                    id="nome"
                    label={t('reimbursement.form.fullName')}
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.nome?.message}
                    required
                  />
                )}
              />

              <Controller
                name="email"
                control={control}
                render={({ field }) => (
                  <InputField
                    id="email"
                    label={t('reimbursement.form.email')}
                    type="email"
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.email?.message}
                    required
                    disabled={!!profile?.email} // Bloquear edição se o usuário estiver logado
                    placeholder={profile?.email ? t('reimbursement.form.emailLocked') : undefined}
                  />
                )}
              />

              <Controller
                name="telefone"
                control={control}
                render={({ field }) => (
                  <InputField
                    id="telefone"
                    label={t('reimbursement.form.phone')}
                    value={field.value}
                    onChange={(e) => {
                      handlePhoneChange(e);
                      field.onChange(e);
                    }}
                    error={errors.telefone?.message}
                    required
                  />
                )}
              />

              <Controller
                name="cpf"
                control={control}
                render={({ field }) => (
                  <InputField
                    id="cpf"
                    label={t('reimbursement.form.cpf')}
                    value={field.value}
                    onChange={(e) => {
                      handleCPFChange(e);
                      field.onChange(e);
                    }}
                    error={errors.cpf?.message}
                    required
                  />
                )}
              />

              <Controller
                name="cargo"
                control={control}
                render={({ field }) => (
                  <InputField
                    id="cargo"
                    label={t('reimbursement.form.position')}
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.cargo?.message}
                    required
                  />
                )}
              />

              <Controller
                name="centroCusto"
                control={control}
                render={({ field }) => (
                  <SelectField
                    id="centroCusto"
                    label={t('reimbursement.form.costCenter')}
                    value={field.value || 'abz'}
                    onChange={(e) => {
                      console.log('Centro de custo selecionado:', e.target.value);
                      field.onChange(e);
                    }}
                    options={[
                      { value: 'abz', label: 'ABZ' },
                      { value: 'luz_maritima', label: 'Luz Marítima' },
                      { value: 'fms', label: 'FMS' },
                      { value: 'msi', label: 'MSI' },
                      { value: 'omega', label: 'Omega' },
                      { value: 'constellation', label: 'Constellation' },
                      { value: 'sentinel', label: 'Sentinel' },
                      { value: 'ahk', label: 'AHK' }
                    ]}
                    error={errors.centroCusto?.message}
                    required
                  />
                )}
              />
            </div>
          </div>

          {/* Seção de Múltiplas Despesas */}
          <div className="bg-gray-50 p-5 rounded-lg" style={{ opacity: 1, visibility: 'visible' }}>
            <Controller
              name="expenses"
              control={control}
              render={({ field }) => (
                <MultipleExpenses
                  expenses={field.value || []}
                  onChange={field.onChange}
                  currency={selectedCurrency}
                  onCurrencyChange={(currency) => {
                    console.log('Moeda mudou no MultipleExpenses:', currency);
                    setSelectedCurrency(currency as any);
                    setValue('moeda', currency as any);
                  }}
                  errors={errors.expenses}
                />
              )}
            />
          </div>

          {/* Seção de Informações de Pagamento */}
          <div className="bg-gray-50 p-5 rounded-lg" style={{ opacity: 1, visibility: 'visible' }}>
            <h3 className="text-lg font-medium text-gray-800 mb-4">{t('reimbursement.form.paymentInfo', 'Informações de Pagamento')}</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Controller
                name="data"
                control={control}
                render={({ field }) => (
                  <InputField
                    id="data"
                    label={t('reimbursement.form.expenseDate')}
                    type="date"
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.data?.message}
                    required
                  />
                )}
              />

              <Controller
                name="metodoPagamento"
                control={control}
                render={({ field }) => (
                  <PaymentMethodRadio
                    id="metodoPagamento"
                    label={t('reimbursement.form.bankInfo')}
                    value={field.value}
                    onChange={(value) => {
                      console.log('Payment method changed to:', value);
                      if (value === 'deposito') {
                        setValue('pixTipo', null);
                        setValue('pixChave', null);
                        console.log('Cleared PIX fields');
                      } else if (value === 'pix') {
                        setValue('banco', null);
                        setValue('agencia', null);
                        setValue('conta', null);
                        console.log('Cleared bank fields');
                      } else {
                        setValue('banco', null);
                        setValue('agencia', null);
                        setValue('conta', null);
                        setValue('pixTipo', null);
                        setValue('pixChave', null);
                        console.log('Cleared all payment fields');
                      }
                      field.onChange(value);
                      console.log('Current metodoPagamento after change:', value);
                    }}
                    options={[
                      { value: 'deposito', label: t('locale.code') === 'en-US' ? 'Bank Deposit' : 'Depósito Bancário' },
                      { value: 'pix', label: 'PIX' },
                      { value: 'agente', label: t('locale.code') === 'en-US' ? 'Financial Agent (Cash)' : 'Agente Financeiro (Dinheiro)' }
                    ]}
                    error={errors.metodoPagamento?.message}
                    required
                  />
                )}
              />
            </div>

            {/* Campos condicionais para depósito bancário */}
            {(() => {
              console.log('Rendering bank fields check - metodoPagamento:', metodoPagamento);
              return metodoPagamento === 'deposito';
            })() && (
              <div
                className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 border-t border-gray-200 pt-4"
                style={{ opacity: 1, visibility: 'visible', display: 'grid' }}
              >
                  <Controller
                    name="banco"
                    control={control}
                    render={({ field }) => (
                      <InputField
                        id="banco"
                        label={t('reimbursement.form.bankName')}
                        value={field.value || ''}
                        onChange={field.onChange}
                        error={errors.banco?.message}
                        required
                      />
                    )}
                  />

                  <Controller
                    name="agencia"
                    control={control}
                    render={({ field }) => (
                      <InputField
                        id="agencia"
                        label={t('reimbursement.form.agency')}
                        value={field.value || ''}
                        onChange={field.onChange}
                        error={errors.agencia?.message}
                        required
                      />
                    )}
                  />

                  <Controller
                    name="conta"
                    control={control}
                    render={({ field }) => (
                      <InputField
                        id="conta"
                        label={t('reimbursement.form.account')}
                        value={field.value || ''}
                        onChange={field.onChange}
                        error={errors.conta?.message}
                        required
                      />
                    )}
                  />
              </div>
            )}

            {/* Campos condicionais para PIX */}
            {(() => {
              console.log('Rendering PIX fields check - metodoPagamento:', metodoPagamento);
              return metodoPagamento === 'pix';
            })() && (
              <div
                className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 border-t border-gray-200 pt-4"
                style={{ opacity: 1, visibility: 'visible', display: 'grid' }}
              >
                  <Controller
                    name="pixTipo"
                    control={control}
                    render={({ field }) => (
                      <SelectField
                        id="pixTipo"
                        label={t('reimbursement.form.pixKeyType')}
                        value={field.value || ''}
                        onChange={(e) => {
                          field.onChange(e);
                          setValue('pixChave', '');
                          clearErrors('pixChave');
                        }}
                        options={[
                          { value: 'cpf', label: t('locale.code') === 'en-US' ? 'TAX ID' : 'CPF' },
                          { value: 'email', label: 'Email' },
                          { value: 'telefone', label: t('locale.code') === 'en-US' ? 'Phone' : 'Telefone' },
                          { value: 'aleatoria', label: t('locale.code') === 'en-US' ? 'Random Key' : 'Chave Aleatória' }
                        ]}
                        error={errors.pixTipo?.message}
                        required
                      />
                    )}
                  />

                  <Controller
                    name="pixChave"
                    control={control}
                    render={({ field }) => {
                      let inputType = 'text';
                      let placeholder = t('reimbursement.form.pixKeyPlaceholder');
                      let mask = undefined;

                      if (pixTipo) {
                        switch(pixTipo) {
                          case 'cpf':
                            placeholder = t('reimbursement.form.pixCpfPlaceholder');
                            mask = formatCPF;
                            break;
                          case 'email':
                            inputType = 'email';
                            placeholder = t('reimbursement.form.pixEmailPlaceholder');
                            break;
                          case 'telefone':
                            placeholder = t('reimbursement.form.pixPhonePlaceholder');
                            mask = formatPhone;
                            break;
                          case 'aleatoria':
                            placeholder = t('reimbursement.form.pixRandomPlaceholder');
                            break;
                        }
                      }

                      return (
                        <InputField
                          id="pixChave"
                          label={t('reimbursement.form.pixKey')}
                          type={inputType}
                          value={field.value || ''}
                          onChange={(e) => {
                            if (mask && typeof e.target.value === 'string') {
                              field.onChange(mask(e.target.value));
                            } else {
                              field.onChange(e);
                            }
                          }}
                          onBlur={validatePixKeyField}
                          placeholder={placeholder}
                          error={errors.pixChave?.message}
                          required
                        />
                      );
                    }}
                  />
              </div>
            )}



            <Controller
              name="observacoes"
              control={control}
              render={({ field }) => (
                <TextArea
                  id="observacoes"
                  label={t('reimbursement.form.notes')}
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  error={errors.observacoes?.message}
                  rows={3}
                />
              )}
            />
          </div>

          {/* Botões de Ação */}
          <div className="flex flex-col md:flex-row justify-end space-y-3 md:space-y-0 md:space-x-3" style={{ opacity: 1, visibility: 'visible' }}>
            <button
              type="button"
              onClick={() => setShowPdfViewer(true)}
              className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <FiDownload className="mr-2" />
              {t('reimbursement.form.viewPolicy')}
            </button>

            <button
              type="submit"
              disabled={isSubmitting || submitting || isAuthenticated === false}
              onClick={() => {
                console.log('Submit button clicked');
                console.log('Form errors:', errors);
                console.log('Is submitting:', isSubmitting || submitting);
                console.log('Is authenticated:', isAuthenticated);
              }}
              className={`flex items-center justify-center px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                isAuthenticated === false
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
              } ${
                (isSubmitting || submitting) ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              {(isSubmitting || submitting) ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {t('reimbursement.form.submitting')}
                  </>
                ) : isAuthenticated === false ? (
                  <>
                    <svg className="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    {t('reimbursement.form.authStatus.loginRequired', 'Faça login para enviar')}
                  </>
                ) : (
                  <>
                    <FiSend className="mr-2"/>
                    {t('reimbursement.form.submit')}
                  </>
                )}
              </button>
            </div>
        </form>
      </div>
    </>
  );
}
