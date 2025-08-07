'use client';

import React from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import ProtectedRoute from '@/components/Auth/ProtectedRoute';
import RolePermissionsEditor from '@/components/admin/RolePermissionsEditor';
import RolePermissionsInitializer from '@/components/admin/RolePermissionsInitializer';
import { FiArrowLeft } from 'react-icons/fi';
import { useRouter } from 'next/navigation';

export default function RolePermissionsPage() {
  const { isAdmin } = useSupabaseAuth();
  const router = useRouter();

  return (
    <ProtectedRoute adminOnly>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => router.back()}
              className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
            >
              <FiArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </button>
            
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Permissões por Role</h1>
              <p className="mt-2 text-gray-600">
                Configure as permissões padrão para cada tipo de usuário (role). 
                As permissões individuais sempre têm prioridade sobre as permissões do role.
              </p>
            </div>
          </div>

          {/* Inicializador da Tabela */}
          <div className="mb-8">
            <RolePermissionsInitializer />
          </div>

          {/* Editor de Permissões */}
          <RolePermissionsEditor />

          {/* Informações Adicionais */}
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-lg font-medium text-blue-900 mb-2">Como Funciona o Sistema de Permissões</h3>
            <div className="text-sm text-blue-800 space-y-2">
              <p>
                <strong>1. Permissões por Role:</strong> Cada role (Administrador, Gerente, Usuário) tem um conjunto padrão de permissões.
              </p>
              <p>
                <strong>2. Permissões Individuais:</strong> Você pode sobrescrever as permissões padrão para usuários específicos.
              </p>
              <p>
                <strong>3. Prioridade:</strong> As permissões individuais sempre têm prioridade sobre as permissões do role.
              </p>
              <p>
                <strong>4. Administradores:</strong> Sempre têm acesso total, independente das configurações.
              </p>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
