// src/app/avaliacao/ver/[id]/page.tsx
'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import ViewEvaluationClient from './ViewEvaluationClient';
import { Evaluation, EvaluationCriterion, User } from '@/types';

interface PageProps {
  params: { id: string };
}

export default function ViewEvaluationPage({ params }: PageProps) {
  const router = useRouter();
  const { user, isAuthenticated } = useSupabaseAuth();
  const { id } = params;
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [criteria, setCriteria] = useState<EvaluationCriterion[]>([]);
  const [employee, setEmployee] = useState<User | null>(null);
  const [manager, setManager] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push(`/login?redirect=/avaliacao/ver/${id}`);
      return;
    }

    if (!id) return;

    const fetchEvaluationData = async () => {
      try {
        // Get token for API calls
        const token = document.cookie
          .split('; ')
          .find(row => row.startsWith('abzToken=') || row.startsWith('token='))
          ?.split('=')[1];

        const headers: HeadersInit = {
          'Content-Type': 'application/json',
        };

        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        // Fetch evaluation
        const evalResponse = await fetch(`/api/avaliacao/${id}`, { headers });
        
        if (!evalResponse.ok) {
          if (evalResponse.status === 401) {
            router.push(`/login?redirect=/avaliacao/ver/${id}`);
            return;
          }
          throw new Error('Failed to fetch evaluation');
        }

        const evalData = await evalResponse.json();
        
        if (!evalData.success || !evalData.data) {
          router.push('/avaliacao?error=evaluation_not_found');
          return;
        }

        setEvaluation(evalData.data);

        // Fetch criteria
        const criteriaResponse = await fetch('/api/avaliacao/criterios', { headers });
        const criteriaData = await criteriaResponse.json();
        
        if (criteriaData.success) {
          setCriteria(criteriaData.data);
        }

        // Fetch employee and manager
        const employeeId = evalData.data.funcionario_id;
        const managerId = evalData.data.avaliador_id;

        if (employeeId) {
          const empResponse = await fetch(`/api/users/${employeeId}`, { headers });
          const empData = await empResponse.json();
          if (empData.success) setEmployee(empData.data);
        }

        if (managerId) {
          const mgrResponse = await fetch(`/api/users/${managerId}`, { headers });
          const mgrData = await mgrResponse.json();
          if (mgrData.success) setManager(mgrData.data);
        }

        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch evaluation data:', err);
        setError('Erro ao carregar avaliação');
        setLoading(false);
      }
    };

    fetchEvaluationData();
  }, [id, router, isAuthenticated]);

  if (!isAuthenticated) {
    return null; // Redirecting...
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px', padding: '20px' }}>
        <div className="spinner" style={{ 
          border: '4px solid #f3f3f3', 
          borderTop: '4px solid #3498db', 
          borderRadius: '50%', 
          width: '40px', 
          height: '40px', 
          animation: 'spin 1s linear infinite' 
        }}></div>
        <p style={{ marginTop: '16px', color: '#666' }}>Carregando avaliação...</p>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error || !evaluation) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p style={{ color: '#e74c3c', fontSize: '18px' }}>{error || 'Avaliação não encontrada'}</p>
      </div>
    );
  }

  return (
    <ViewEvaluationClient
      evaluation={evaluation}
      criteria={criteria}
      employee={employee}
      manager={manager}
    />
  );
}
