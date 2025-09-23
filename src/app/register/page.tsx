'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useI18n } from '@/contexts/I18nContext';
import { toast, Toaster } from 'react-hot-toast';
import { FaUser, FaEnvelope, FaPhone, FaBriefcase, FaBuilding, FaIdCard } from 'react-icons/fa';
import Image from 'next/image';
import Link from 'next/link';
import LanguageSelector from '@/components/LanguageSelector';
import EmailVerificationPrompt from '@/components/Auth/EmailVerificationPrompt';
import NameValidationInput from '@/components/Auth/NameValidationInput';

export default function RegisterPage() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Obter o e-mail e telefone da URL se disponíveis
  const emailFromUrl = searchParams?.get('email') || '';
  const phoneFromUrl = searchParams?.get('phone') || '';
  const inviteCodeFromUrl = searchParams?.get('invite') || '';

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: emailFromUrl,
    phoneNumber: phoneFromUrl,
    position: '',
    department: '',
    cpf: '',
    inviteCode: inviteCodeFromUrl,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [protocol, setProtocol] = useState('');
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [accountActive, setAccountActive] = useState(false);
  const [showEmailVerification, setShowEmailVerification] = useState(false);
  const [emailToVerify, setEmailToVerify] = useState('');

  // Função para formatar CPF/CNPJ
  const formatCpfCnpj = (value: string) => {
    // Remove tudo que não é dígito
    const numbers = value.replace(/\D/g, '');

    // Se tem 11 dígitos ou menos, formata como CPF
    if (numbers.length <= 11) {
      return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    // Se tem mais de 11 dígitos, formata como CNPJ
    else {
      return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    // Formatação especial para o número de telefone
    if (name === 'phoneNumber') {
      // Permitir apenas números, +, parênteses, traços e espaços
      const sanitizedValue = value.replace(/[^0-9+\s\(\)\-]/g, '');
      setFormData(prev => ({ ...prev, [name]: sanitizedValue }));
    }
    // Formatação especial para CPF/CNPJ
    else if (name === 'cpf') {
      const formatted = formatCpfCnpj(value);
      setFormData(prev => ({ ...prev, [name]: formatted }));
    }
    else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validação básica
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.phoneNumber) {
      toast.error(t('register.error.requiredFields'));
      return;
    }

    // Formatar o número de telefone para o formato internacional
    let formattedPhone = formData.phoneNumber.replace(/\s/g, '').replace(/[\(\)\-]/g, '');

    // Se não começar com +, adicionar +55 (Brasil)
    if (!formattedPhone.startsWith('+')) {
      // Remover o 0 inicial se existir
      formattedPhone = formattedPhone.replace(/^0/, '');

      // Se começar com DDD (2 dígitos), adicionar +55
      if (/^[1-9][0-9]/.test(formattedPhone)) {
        formattedPhone = '+55' + formattedPhone;
      } else {
        // Se não tiver DDD, assumir DDD 22 (Campos dos Goytacazes)
        formattedPhone = '+5522' + formattedPhone;
      }
    }

    // Atualizar o formData com o telefone formatado
    setFormData(prev => ({ ...prev, phoneNumber: formattedPhone }));

    setIsLoading(true);

    try {
      // Preparar os dados para envio
      const dataToSend = {
        ...formData,
        // Incluir o código de convite se disponível
        inviteCode: formData.inviteCode || undefined
      };

      console.log('Enviando dados de registro:', dataToSend);

      const response = await fetch('/api/auth/register-supabase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToSend),
      });

      const data = await response.json();
      console.log('Resposta da API de registro:', { status: response.status, data });

      if (response.ok && data.success) {
        setProtocol(data.protocol);
        setRegistrationComplete(true);
        setAccountActive(data.accountActive || false);

        // Verificar se é um reenvio de verificação
        if (data.emailVerificationRequired) {
          // Mostrar prompt de verificação em vez de apenas toast
          setEmailToVerify(formData.email);
          setShowEmailVerification(true);
          toast.success('E-mail de verificação enviado! Verifique sua caixa de entrada para ativar sua conta.');
        } else {
          toast.success(t('register.success'));
        }
      } else {
        // Tratamento específico para diferentes tipos de erro
        console.log('Tratando erro:', { status: response.status, code: data.code, error: data.error });
        if (response.status === 409) {
          if (data.code === 'EMAIL_EXISTS_VERIFIED') {
            console.log('Mostrando toast para EMAIL_EXISTS_VERIFIED');
            toast.error('Este e-mail já está cadastrado e verificado. Use a opção "Faça login" ou "Esqueci minha senha".');
          } else if (data.code === 'PHONE_EXISTS') {
            console.log('Mostrando toast para PHONE_EXISTS');
            toast.error('Este telefone já está cadastrado para outra conta. Use um número diferente.');
          } else {
            console.log('Mostrando toast para erro 409 genérico');
            toast.error(data.error || 'E-mail ou telefone já cadastrado. Verifique seus dados.');
          }
        } else if (response.status === 403 && data.banned) {
          toast.error('Usuário banido. Entre em contato com o administrador.');
        } else {
          toast.error(data.error || t('register.error.generic'));
        }
      }
    } catch (error) {
      console.error('Erro ao registrar:', error);
      toast.error(t('register.error.generic'));
    } finally {
      setIsLoading(false);
    }
  };

  if (registrationComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
          <div className="text-center mb-6">
            <Image
              src="/images/logo.png"
              alt="ABZ Group"
              width={150}
              height={50}
              className="mx-auto mb-4"
            />
            <h1 className="text-2xl font-bold text-blue-600">{t('register.success')}</h1>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg mb-6">
            <p className="text-center font-medium">{t('register.protocolNumber')}</p>
            <p className="text-center text-xl font-bold text-blue-700">{protocol}</p>
          </div>

          <div className="mb-6">
            <p className="text-gray-700 mb-4">
              {accountActive
                ? t('register.successMessageActive', 'Seu registro foi concluído com sucesso e sua conta já está ativa.')
                : t('register.successMessage')}
            </p>
            {accountActive ? (
              <p className="text-gray-700">
                {t('register.loginNow', 'Você já pode fazer login imediatamente com seu e-mail ou telefone.')}
              </p>
            ) : (
              <p className="text-gray-700">
                {t('register.checkEmail')}
              </p>
            )}
          </div>

          <div className="text-center">
            <Link
              href="/login"
              className="inline-block bg-blue-600 text-white px-6 py-2 rounded-md font-medium hover:bg-blue-700 transition-colors"
            >
              {t('register.backToLogin')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md relative">
        {/* Language Selector */}
        <div className="absolute top-4 right-4">
          <LanguageSelector variant="dropdown" />
        </div>

        <div className="text-center mb-6">
          <Image
            src="/images/logo.png"
            alt="ABZ Group"
            width={150}
            height={50}
            className="mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold text-blue-600">{t('register.title')}</h1>
          <p className="text-gray-600">{t('register.subtitle')}</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="col-span-1">
              <NameValidationInput
                label={t('register.firstName')}
                value={formData.firstName}
                onChange={(value) => setFormData(prev => ({ ...prev, firstName: value }))}
                placeholder={t('register.firstNamePlaceholder')}
                email={formData.email}
                required
                id="firstName"
                name="firstName"
              />
            </div>

            <div className="col-span-1">
              <NameValidationInput
                label={t('register.lastName')}
                value={formData.lastName}
                onChange={(value) => setFormData(prev => ({ ...prev, lastName: value }))}
                placeholder={t('register.lastNamePlaceholder')}
                email={formData.email}
                required
                id="lastName"
                name="lastName"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-medium mb-1" htmlFor="email">
              {t('register.email')}*
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FaEnvelope className="text-gray-400" />
              </div>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="pl-10 w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={t('register.emailPlaceholder')}
                required
                readOnly={!!emailFromUrl}
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-medium mb-1" htmlFor="phoneNumber">
              {t('register.phone')}*
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FaPhone className="text-gray-400" />
              </div>
              <input
                type="tel"
                id="phoneNumber"
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={handleChange}
                className="pl-10 w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={t('register.phonePlaceholder')}
                required
                readOnly={!!phoneFromUrl}
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-medium mb-1" htmlFor="cpf">
              {t('register.cpf')}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FaIdCard className="text-gray-400" />
              </div>
              <input
                type="text"
                id="cpf"
                name="cpf"
                value={formData.cpf}
                onChange={handleChange}
                className="pl-10 w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={t('register.cpfPlaceholder')}
                maxLength={14}
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-medium mb-1" htmlFor="position">
              {t('register.position')}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FaBriefcase className="text-gray-400" />
              </div>
              <input
                type="text"
                id="position"
                name="position"
                value={formData.position}
                onChange={handleChange}
                className="pl-10 w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={t('register.positionPlaceholder')}
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-medium mb-1" htmlFor="department">
              {t('register.department')}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FaBuilding className="text-gray-400" />
              </div>
              <input
                type="text"
                id="department"
                name="department"
                value={formData.department}
                onChange={handleChange}
                className="pl-10 w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={t('register.departmentPlaceholder')}
              />
            </div>
          </div>

          <div className="mb-6">
            <p className="text-sm text-gray-600">
              {t('register.requiredFields')}
            </p>
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 text-white p-2 rounded-md font-medium hover:bg-blue-700 transition-colors disabled:bg-blue-300"
            disabled={isLoading}
          >
            {isLoading ? t('register.loading') : t('register.submit')}
          </button>
        </form>

        <div className="mt-4 text-center">
          <p className="text-sm text-gray-600">
            {t('register.alreadyHaveAccount')}{' '}
            <Link href="/login" className="text-blue-600 hover:underline">
              {t('register.login')}
            </Link>
          </p>
        </div>
      </div>

      {/* Modal de verificação de email */}
      {showEmailVerification && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <EmailVerificationPrompt
              email={emailToVerify}
              onVerificationSent={() => {
                toast.success('Novo e-mail de verificação enviado!');
              }}
              onClose={() => setShowEmailVerification(false)}
            />
          </div>
        </div>
      )}

      <Toaster position="top-right" />
    </div>
  );
}
