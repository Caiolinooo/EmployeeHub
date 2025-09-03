'use client';

import React from 'react';
import { FiUsers, FiArrowLeft } from 'react-icons/fi';
import Link from 'next/link';
import EditorPermissionsManager from '@/components/admin/EditorPermissionsManager';

export default function EditorsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-4 mb-4">
            <Link
              href="/admin"
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <FiArrowLeft className="h-5 w-5" />
              <span>Voltar ao Admin</span>
            </Link>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="bg-blue-100 p-3 rounded-lg">
              <FiUsers className="h-8 w-8 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Gerenciar Editores</h1>
              <p className="text-gray-600 mt-1">
                Configure permissões de editores para Academy e Social/News
              </p>
            </div>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-blue-100 p-2 rounded-lg">
                <FiUsers className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">ABZ Academy</h3>
            </div>
            <div className="space-y-3 text-sm text-gray-600">
              <div>
                <strong className="text-blue-600">Editores:</strong> Podem criar, editar e publicar cursos
              </div>
              <div>
                <strong className="text-green-600">Moderadores:</strong> Podem moderar comentários e avaliações
              </div>
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-blue-800">
                  <strong>Dica:</strong> Editores automaticamente têm permissões de moderador
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-purple-100 p-2 rounded-lg">
                <FiUsers className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Social/News</h3>
            </div>
            <div className="space-y-3 text-sm text-gray-600">
              <div>
                <strong className="text-purple-600">Editores:</strong> Podem criar posts oficiais e gerenciar conteúdo
              </div>
              <div>
                <strong className="text-orange-600">Moderadores:</strong> Podem moderar posts e comentários
              </div>
              <div className="bg-purple-50 p-3 rounded-lg">
                <p className="text-purple-800">
                  <strong>Dica:</strong> Editores automaticamente têm permissões de moderador
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Component */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <EditorPermissionsManager />
        </div>

        {/* Help Section */}
        <div className="mt-8 bg-gray-100 border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Como usar este painel</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-gray-700">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Selecionando Editores:</h4>
              <ul className="space-y-1 list-disc list-inside">
                <li>Clique nos botões de check/X para ativar/desativar permissões</li>
                <li>Use os filtros para encontrar usuários específicos</li>
                <li>As mudanças são salvas automaticamente</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Hierarquia de Permissões:</h4>
              <ul className="space-y-1 list-disc list-inside">
                <li><strong>ADMIN:</strong> Tem todas as permissões por padrão</li>
                <li><strong>MANAGER:</strong> Pode ser moderador por padrão</li>
                <li><strong>USER:</strong> Precisa ser selecionado manualmente</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
