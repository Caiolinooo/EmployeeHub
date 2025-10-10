'use client';

import React, { useState } from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { FiCheck, FiAlertTriangle, FiEye, FiEyeOff } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';

export default function PasswordChange() {
  const { t } = useI18n();

  const { updatePassword } = useSupabaseAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Validação de senha
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [passwordFeedback, setPasswordFeedback] = useState<string[]>([]);

  // Função para validar a força da senha
  const validatePassword = (password: string) => {
    let strength = 0;
    const feedback = [];

    if (password.length >= 8) {
      strength += 1;
    } else {
      feedback.push('A senha deve ter pelo menos 8 caracteres');
    }

    if (/[A-Z]/.test(password)) {
      strength += 1;
    } else {
      feedback.push(t('components.incluaPeloMenosUmaLetraMaiuscula'));
    }

    if (/[a-z]/.test(password)) {
      strength += 1;
    } else {
      feedback.push(t('components.incluaPeloMenosUmaLetraMinuscula'));
    }

    if (/[0-9]/.test(password)) {
      strength += 1;
    } else {
      feedback.push(t('components.incluaPeloMenosUmNumero'));
    }

    if (/[^A-Za-z0-9]/.test(password)) {
      strength += 1;
    } else {
      feedback.push('Inclua pelo menos um caractere especial');
    }

    setPasswordStrength(strength);
    setPasswordFeedback(feedback);

    return strength >= 3;
  };

  // Atualizar a validação quando a senha mudar
  React.useEffect(() => {
    if (newPassword) {
      validatePassword(newPassword);
    } else {
      setPasswordStrength(0);
      setPasswordFeedback([]);
    }
  }, [newPassword]);

  // Função para alterar a senha
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validar senhas
    if (newPassword !== confirmPassword) {
      setError(t('components.asSenhasNaoCoincidem'));
      return;
    }

    if (passwordStrength < 3) {
      setError(t('components.aSenhaNaoEForteOSuficiente'));
      return;
    }

    setLoading(true);

    try {
      // Verificar senha atual
      const token = localStorage.getItem('token') || localStorage.getItem('abzToken');
      
      if (!token) {
        throw new Error(t('components.naoAutorizado'));
      }
      
      const verifyResponse = await fetch('/api/auth/verify-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          password: currentPassword
        })
      });
      
      if (!verifyResponse.ok) {
        const errorData = await verifyResponse.json();
        throw new Error(errorData.error || 'Senha atual incorreta');
      }
      
      // Alterar senha
      const success = await updatePassword(newPassword);
      
      if (!success) {
        throw new Error('Erro ao atualizar senha');
      }
      
      setSuccess('Senha alterada com sucesso');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Erro ao alterar senha:', error);
      setError(`Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md mb-4 flex items-center">
          <FiAlertTriangle className="mr-2" />
          <span>{error}</span>
        </div>
      )}
      
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-md mb-4 flex items-center">
          <FiCheck className="mr-2" />
          <span>{success}</span>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-1">
            Senha Atual
          </label>
          <div className="relative">
            <input
              type={showCurrentPassword ? 'text' : 'password'}
              id="currentPassword"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-abz-blue pr-10"
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500"
              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
            >
              {showCurrentPassword ? <FiEyeOff /> : <FiEye />}
            </button>
          </div>
        </div>
        
        <div>
          <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
            Nova Senha
          </label>
          <div className="relative">
            <input
              type={showNewPassword ? 'text' : 'password'}
              id="newPassword"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-abz-blue pr-10"
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500"
              onClick={() => setShowNewPassword(!showNewPassword)}
            >
              {showNewPassword ? <FiEyeOff /> : <FiEye />}
            </button>
          </div>
          
          {newPassword && (
            <div className="mt-2">
              <div className="flex items-center mb-1">
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className={`h-2.5 rounded-full ${
                      passwordStrength === 0 ? 'bg-gray-300' :
                      passwordStrength === 1 ? 'bg-red-500' :
                      passwordStrength === 2 ? 'bg-orange-500' :
                      passwordStrength === 3 ? 'bg-yellow-500' :
                      passwordStrength === 4 ? 'bg-green-500' :
                      'bg-green-600'
                    }`}
                    style={{ width: `${passwordStrength * 20}%` }}
                  ></div>
                </div>
                <span className="ml-2 text-xs text-gray-500">
                  {passwordStrength === 0 ? 'Muito fraca' :
                   passwordStrength === 1 ? 'Fraca' :
                   passwordStrength === 2 ? t('components.razoavel') :
                   passwordStrength === 3 ? 'Boa' :
                   passwordStrength === 4 ? 'Forte' :
                   'Muito forte'}
                </span>
              </div>
              
              {passwordFeedback.length > 0 && (
                <ul className="text-xs text-gray-600 mt-1 space-y-1">
                  {passwordFeedback.map((feedback, index) => (
                    <li key={index} className="flex items-center">
                      <FiAlertTriangle className="text-yellow-500 mr-1" />
                      {feedback}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        
        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
            Confirmar Nova Senha
          </label>
          <div className="relative">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-abz-blue pr-10 ${
                confirmPassword && newPassword !== confirmPassword
                  ? 'border-red-500'
                  : 'border-gray-300'
              }`}
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              {showConfirmPassword ? <FiEyeOff /> : <FiEye />}
            </button>
          </div>
          {confirmPassword && newPassword !== confirmPassword && (
            <p className="text-red-500 text-xs mt-1">As senhas não coincidem</p>
          )}
        </div>
        
        <div>
          <button
            type="submit"
            className="w-full px-4 py-2 bg-abz-blue text-white rounded-md hover:bg-abz-blue-dark transition-colors disabled:bg-gray-400"
            disabled={loading || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword || passwordStrength < 3}
          >
            {loading ? 'Alterando...' : 'Alterar Senha'}
          </button>
        </div>
      </form>
    </div>
  );
}
