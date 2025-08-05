'use client';

import { useState } from 'react';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { useI18n } from '@/contexts/I18nContext';

export default function LoginTest() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      // Usar o wrapper de fetch para tratar erros de parsing JSON
      const response = await fetchWrapper.post('/api/auth/login', {
        email,
        password
      });

      console.log('Resposta do login:', response);
      
      if (response.token) {
        setMessage(t('auth.loginSuccess', 'Login realizado com sucesso!'));
        // Armazenar o token e os dados do usuário
        localStorage.setItem('auth', 'true');
        localStorage.setItem('token', response.token);
        localStorage.setItem('user', JSON.stringify(response.user));
      } else {
        setMessage(t('auth.tokenNotFound', 'Erro: Token não encontrado na resposta'));
      }
    } catch (error: any) {
      console.error('Erro ao fazer login:', error);
      setMessage(`${t('common.error', 'Erro')}: ${error.message || t('errors.unknown', 'Erro desconhecido')}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-white p-8 rounded-lg shadow-md">
        <h1 className="text-2xl font-bold mb-6 text-center">{t('auth.loginTest', 'Teste de Login')}</h1>

        {message && (
          <div className={`p-4 mb-4 rounded-md ${message.includes(t('common.error', 'Erro')) ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
            {message}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              {t('common.email', 'Email')}
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder={t('auth.emailPlaceholder', 'seu@email.com')}
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              {t('auth.password', 'Senha')}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="********"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? t('common.loading', 'Carregando...') : t('auth.login', 'Entrar')}
          </button>
        </form>

        <div className="mt-4">
          <p className="text-sm text-gray-600">
            {t('auth.testCredentials', 'Use o email caio.correia@groupabz.com e senha Caio@2122@ para testar.')}
          </p>
        </div>
      </div>
    </div>
  );
}
