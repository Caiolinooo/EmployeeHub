'use client';

import { useState } from 'react';
import { toast } from 'react-hot-toast';

export default function TestUsersPage() {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleCleanup = async (type: 'email' | 'phone') => {
    if (type === 'email' && !email.trim()) {
      toast.error('Digite um email para limpar');
      return;
    }
    
    if (type === 'phone' && !phone.trim()) {
      toast.error('Digite um telefone para limpar');
      return;
    }

    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (type === 'email') {
        params.append('email', email.trim());
      } else {
        params.append('phone', phone.trim());
      }

      const response = await fetch(`/api/admin/cleanup-test-users?${params}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success(data.message);
        setEmail('');
        setPhone('');
      } else {
        toast.error(data.error || 'Erro ao limpar usuários');
      }
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao limpar usuários');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <div className="bg-white shadow rounded-lg p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            Limpeza de Usuários de Teste
          </h1>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Limpar por Email
              </label>
              <div className="flex space-x-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => handleCleanup('email')}
                  disabled={isLoading}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  Limpar
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Limpar por Telefone
              </label>
              <div className="flex space-x-2">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+5511999999999"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => handleCleanup('phone')}
                  disabled={isLoading}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  Limpar
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-sm text-yellow-800">
              <strong>Atenção:</strong> Esta funcionalidade só funciona em ambiente de desenvolvimento 
              e remove permanentemente os usuários do banco de dados.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
