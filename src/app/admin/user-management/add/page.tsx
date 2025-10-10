'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { FiArrowLeft, FiUserPlus, FiSave, FiX } from 'react-icons/fi';
import Link from 'next/link';
import { useI18n } from '@/contexts/I18nContext';
import UserEditor from '@/components/admin/UserEditor';

export default function AddUserPage() {
  const { isAdmin, isAuthenticated, isLoading } = useSupabaseAuth();
  const router = useRouter();
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Redirecionar se não for administrador
  useEffect(() => {
    if (!isLoading && !isAdmin) {
      router.push('/dashboard');
    }
  }, [isAdmin, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-abz-blue"></div>
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return null;
  }

  const handleSaveUser = async (userData: any, password?: string) => {
    try {
      setError(null);
      const token = localStorage.getItem('token') || localStorage.getItem('abzToken');

      if (!token) {
        throw new Error({t('admin.naoAutorizado')});
      }

      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...userData,
          password
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || t('admin.erroAoCriarUsuario'));
      }

      setSuccess({t('admin.usuarioCriadoComSucesso')});
      
      // Redirecionar após 2 segundos
      setTimeout(() => {
        router.push('/admin/user-management');
      }, 2000);
    } catch (error) {
      console.error(t('admin.erroAoSalvarUsuario'), error);
      setError({t('admin.erroAoSalvarUsuarioErrorInstanceofErrorErrormessag')}Erro desconhecido'}`);
    }
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex items-center mb-6">
        <Link 
          href="/admin/user-management" 
          className="mr-4 p-2 rounded-full hover:bg-gray-100"
        >
          <FiArrowLeft className="h-5 w-5 text-gray-600" />
        </Link>
        <h1 className="text-2xl font-bold text-abz-blue flex items-center">
          <FiUserPlus className="mr-2" />
          {t('admin.addUser')}
        </h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4 flex items-center">
          <FiX className="mr-2" />
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md mb-4 flex items-center">
          <FiSave className="mr-2" />
          {success}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-6">
        <UserEditor 
          onSave={handleSaveUser}
          onCancel={() => router.push('/admin/user-management')}
          isNewUser={true}
        />
      </div>
    </div>
  );
}
