// src/app/avaliacao/page.tsx
import React from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { 
  getEvaluations, 
  getEvaluationPeriods, 
  getEmployees, 
  getAvailablePeriods,
  getMyEvaluationForPeriod 
} from '@/services/evaluationService';
import { verifyToken } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import EvaluationListClient from './EvaluationListClient';

export default async function EvaluationPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('abzToken')?.value || cookieStore.get('token')?.value;

  if (!token) {
    redirect('/login?redirect=/avaliacao');
  }

  try {
    // Decodificar token para pegar userId
    const decoded = await verifyToken(token);
    const userId = decoded?.userId;

    if (!userId) {
      redirect('/login?redirect=/avaliacao');
    }

    // Buscar informações do usuário para determinar papel
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users_unified')
      .select('id, role, name, email')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      redirect('/login?redirect=/avaliacao');
    }

    const [evaluations, periods, employees, availablePeriods] = await Promise.all([
      // A lógica de gerente é interna ao serviço, baseada em avaliacao_colaborador_gerente
      getEvaluations({ userId }),
      getEvaluationPeriods(),
      getEmployees(),
      getAvailablePeriods(userId)
    ]);

    // Para cada período disponível, verificar se já existe avaliação
    const activePeriodsWithEvaluations = await Promise.all(
      availablePeriods.active.map(async (period) => {
        const evaluation = await getMyEvaluationForPeriod(userId, period.id);
        return {
          period,
          existingEvaluationId: evaluation?.id || null,
          evaluationStatus: evaluation?.status || null
        };
      })
    );

    const upcomingPeriodsWithEvaluations = await Promise.all(
      availablePeriods.upcoming.map(async (period) => {
        const evaluation = await getMyEvaluationForPeriod(userId, period.id);
        return {
          period,
          existingEvaluationId: evaluation?.id || null,
          evaluationStatus: evaluation?.status || null
        };
      })
    );

    return (
      <EvaluationListClient
        initialEvaluations={evaluations}
        initialPeriods={periods}
        initialEmployees={employees}
        activePeriods={activePeriodsWithEvaluations}
        upcomingPeriods={upcomingPeriodsWithEvaluations}
        currentUser={userData}
      />
    );
  } catch (error) {
    console.error('Failed to fetch evaluation data:', error);
    return (
      <div className="container mx-auto p-6">
        <div className="alert alert-error">
          Erro ao carregar dados de avaliação. Por favor, tente novamente.
        </div>
      </div>
    );
  }
}
