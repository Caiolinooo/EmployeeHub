'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useI18n } from '@/contexts/I18nContext';
import { toast } from 'react-hot-toast';
import { FaUser, FaEnvelope, FaPhone, FaBriefcase, FaBuilding } from 'react-icons/fa';
import Image from 'next/image';
import Link from 'next/link';

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
    inviteCode: inviteCodeFromUrl,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [protocol, setProtocol] = useState('');
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [accountActive, setAccountActive] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    // Formatação especial para o número de telefone
    if (name === 'phoneNumber') {
      // Permitir apenas números, +, parênteses, traços e espaços
      const sanitizedValue = value.replace(/[^0-9+\s\(\)\-]/g, '');
      setFormData(prev => ({ ...prev, [name]: sanitizedValue }));
    } else {
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

      if (response.ok && data.success) {
        setProtocol(data.protocol);
        setRegistrationComplete(true);
        setAccountActive(data.accountActive || false);
        toast.success(t('register.success'));
      } else {
        toast.error(data.error || t('register.error.generic'));
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
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
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
              <label className="block text-gray-700 text-sm font-medium mb-1" htmlFor="firstName">
                {t('register.firstName')}*
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FaUser className="text-gray-400" />
                </div>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  className="pl-10 w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={t('register.firstNamePlaceholder')}
                  required
                />
              </div>
            </div>

            <div className="col-span-1">
              <label className="block text-gray-700 text-sm font-medium mb-1" htmlFor="lastName">
                {t('register.lastName')}*
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FaUser className="text-gray-400" />
                </div>
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  className="pl-10 w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={t('register.lastNamePlaceholder')}
                  required
                />
              </div>
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
    </div>
  );
}
