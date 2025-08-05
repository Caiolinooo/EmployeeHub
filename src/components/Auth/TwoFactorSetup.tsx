'use client';

import React, { useState, useEffect } from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { FiShield, FiCheck, FiX, FiAlertTriangle, FiLock } from 'react-icons/fi';
import Image from 'next/image';

export default function TwoFactorSetup() {
  const { isAuthenticated } = useSupabaseAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [is2faEnabled, setIs2faEnabled] = useState(false);
  const [is2faConfigured, setIs2faConfigured] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [showSetup, setShowSetup] = useState(false);

  // Verificar status do 2FA ao carregar o componente
  useEffect(() => {
    if (isAuthenticated) {
      checkStatus();
    }
  }, [isAuthenticated]);

  // Função para verificar o status do 2FA
  const checkStatus = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('abzToken');
      
      if (!token) {
        throw new Error('Não autorizado');
      }
      
      const response = await fetch('/api/auth/2fa', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Erro ao verificar status do 2FA');
      }
      
      const data = await response.json();
      setIs2faEnabled(data.enabled);
      setIs2faConfigured(data.configured);
    } catch (error) {
      console.error('Erro ao verificar status do 2FA:', error);
      setError('Erro ao verificar status do 2FA. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Função para gerar um novo segredo 2FA
  const generateSecret = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('abzToken');
      
      if (!token) {
        throw new Error('Não autorizado');
      }
      
      const response = await fetch('/api/auth/2fa', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Erro ao gerar segredo 2FA');
      }
      
      const data = await response.json();
      setQrCode(data.qrCode);
      setSecret(data.secret);
      setShowSetup(true);
    } catch (error) {
      console.error('Erro ao gerar segredo 2FA:', error);
      setError('Erro ao gerar segredo 2FA. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Função para verificar e ativar 2FA
  const verifyAndEnable = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('abzToken');
      
      if (!token) {
        throw new Error('Não autorizado');
      }
      
      const response = await fetch('/api/auth/2fa', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code: verificationCode,
          enabled: true
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao verificar código');
      }
      
      const data = await response.json();
      setSuccess(data.message);
      setIs2faEnabled(true);
      setIs2faConfigured(true);
      setShowSetup(false);
      setVerificationCode('');
    } catch (error) {
      console.error('Erro ao verificar código 2FA:', error);
      setError(`Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setLoading(false);
    }
  };

  // Função para desativar 2FA
  const disable2fa = async () => {
    if (!confirm('Tem certeza que deseja desativar a autenticação de dois fatores? Isso reduzirá a segurança da sua conta.')) {
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('abzToken');
      
      if (!token) {
        throw new Error('Não autorizado');
      }
      
      const response = await fetch('/api/auth/2fa', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          enabled: false
        })
      });
      
      if (!response.ok) {
        throw new Error('Erro ao desativar 2FA');
      }
      
      const data = await response.json();
      setSuccess(data.message);
      setIs2faEnabled(false);
    } catch (error) {
      console.error('Erro ao desativar 2FA:', error);
      setError('Erro ao desativar 2FA. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !showSetup) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-abz-blue"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center mb-4">
        <FiShield className="text-abz-blue text-xl mr-2" />
        <h2 className="text-xl font-semibold">Autenticação de Dois Fatores</h2>
      </div>
      
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
      
      {!showSetup ? (
        <div>
          <p className="mb-4 text-gray-700">
            A autenticação de dois fatores adiciona uma camada extra de segurança à sua conta, exigindo um código gerado pelo seu dispositivo móvel além da sua senha.
          </p>
          
          <div className="bg-gray-100 p-4 rounded-md mb-6">
            <div className="flex items-center">
              <div className={`rounded-full p-2 mr-3 ${is2faEnabled ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'}`}>
                <FiLock className="text-xl" />
              </div>
              <div>
                <p className="font-semibold">Status: {is2faEnabled ? 'Ativado' : 'Desativado'}</p>
                <p className="text-sm text-gray-600">
                  {is2faEnabled 
                    ? 'Sua conta está protegida com autenticação de dois fatores.' 
                    : 'Recomendamos ativar a autenticação de dois fatores para aumentar a segurança da sua conta.'}
                </p>
              </div>
            </div>
          </div>
          
          {is2faEnabled ? (
            <button
              onClick={disable2fa}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              disabled={loading}
            >
              {loading ? 'Processando...' : 'Desativar 2FA'}
            </button>
          ) : (
            <button
              onClick={generateSecret}
              className="px-4 py-2 bg-abz-blue text-white rounded-md hover:bg-abz-blue-dark transition-colors"
              disabled={loading}
            >
              {loading ? 'Processando...' : 'Configurar Autenticação de Dois Fatores'}
            </button>
          )}
        </div>
      ) : (
        <div>
          <p className="mb-4 text-gray-700">
            Siga os passos abaixo para configurar a autenticação de dois fatores:
          </p>
          
          <ol className="list-decimal pl-5 mb-6 space-y-4">
            <li>
              <p className="font-semibold">Instale um aplicativo autenticador</p>
              <p className="text-sm text-gray-600">
                Baixe e instale um aplicativo autenticador como Google Authenticator, Microsoft Authenticator ou Authy no seu dispositivo móvel.
              </p>
            </li>
            
            <li>
              <p className="font-semibold">Escaneie o código QR</p>
              <p className="text-sm text-gray-600 mb-2">
                Abra o aplicativo autenticador e escaneie o código QR abaixo.
              </p>
              
              {qrCode && (
                <div className="flex justify-center mb-2">
                  <div className="border border-gray-300 p-2 rounded-md bg-white">
                    <img src={qrCode} alt="QR Code para 2FA" width={200} height={200} />
                  </div>
                </div>
              )}
              
              {secret && (
                <div className="bg-gray-100 p-3 rounded-md text-center mb-2">
                  <p className="text-sm text-gray-600 mb-1">Se não conseguir escanear o código, insira esta chave manualmente:</p>
                  <p className="font-mono font-semibold tracking-wider">{secret}</p>
                </div>
              )}
            </li>
            
            <li>
              <p className="font-semibold">Insira o código de verificação</p>
              <p className="text-sm text-gray-600 mb-2">
                Digite o código de 6 dígitos gerado pelo aplicativo autenticador.
              </p>
              
              <div className="mb-4">
                <input
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').substring(0, 6))}
                  placeholder="Código de 6 dígitos"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-abz-blue"
                  maxLength={6}
                />
              </div>
            </li>
          </ol>
          
          <div className="flex space-x-3">
            <button
              onClick={() => {
                setShowSetup(false);
                setQrCode(null);
                setSecret(null);
                setVerificationCode('');
              }}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-100 transition-colors"
              disabled={loading}
            >
              Cancelar
            </button>
            
            <button
              onClick={verifyAndEnable}
              className="px-4 py-2 bg-abz-blue text-white rounded-md hover:bg-abz-blue-dark transition-colors"
              disabled={loading || verificationCode.length !== 6}
            >
              {loading ? 'Verificando...' : 'Ativar 2FA'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
