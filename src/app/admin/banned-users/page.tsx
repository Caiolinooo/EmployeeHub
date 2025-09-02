'use client';

import React from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import ProtectedRoute from '@/components/Auth/ProtectedRoute';
import BannedUsersManager from '@/components/admin/BannedUsersManager';
import { FiArrowLeft } from 'react-icons/fi';
import { useRouter } from 'next/navigation';

export default function BannedUsersPage() {
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
          </div>

          {/* Componente de gerenciamento */}
          <BannedUsersManager />
        </div>
      </div>
    </ProtectedRoute>
  );
}
