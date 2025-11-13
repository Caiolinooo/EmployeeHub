// src/app/avaliacao/gerenciar/page.tsx
import React from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getManagerMappings, getEmployees, getEvaluationPeriods } from '@/services/evaluationService';
import ManageManagersClient from './ManageManagersClient';

export default async function ManageManagersPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('abzToken')?.value || cookieStore.get('token')?.value;

  if (!token) {
    redirect('/login?redirect=/avaliacao/gerenciar');
  }

  try {
    const [mappings, employees, periods] = await Promise.all([
      getManagerMappings(),
      getEmployees(),
      getEvaluationPeriods(),
    ]);

    return (
      <ManageManagersClient
        initialMappings={mappings}
        initialEmployees={employees}
        initialPeriods={periods}
      />
    );
  } catch (error) {
    console.error('Failed to fetch manager mappings data:', error);
    return (
      <div className="container mx-auto p-6">
        <div className="alert alert-error">
          Erro ao carregar dados. Por favor, tente novamente.
        </div>
      </div>
    );
  }
}
