// src/app/avaliacao/preencher/[id]/page.tsx
'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import FillEvaluationClient from './FillEvaluationClient';

interface PageProps {
  params: { id: string };
}

export default function FillEvaluationPage({ params }: PageProps) {
  const router = useRouter();
  const { id } = params; // Extrai ID diretamente
  const [evaluation, setEvaluation] = useState<any>(null);
  const [isManager, setIsManager] = useState(false);
  const [userId, setUserId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const fetchEvaluation = async () => {
      try {
        // Fetch evaluation data from API
        const response = await fetch(`/api/avaliacao/${id}`);
        
        if (!response.ok) {
          if (response.status === 401) {
            router.push(`/login?redirect=/avaliacao/preencher/${id}`);
            return;
          }
          throw new Error('Failed to fetch evaluation');
        }

        const data = await response.json();
        
        if (!data.success || !data.data) {
          router.push('/avaliacao?error=evaluation_not_found');
          return;
        }

        const evalData = data.data;
        const currentUserId = data.userId || '';

        // Check permissions
        const isCollab = evalData.funcionario_id === currentUserId;
        const isMgr = evalData.avaliador_id === currentUserId;

        if (!isCollab && !isMgr) {
          router.push('/avaliacao?error=unauthorized');
          return;
        }

        // Check status and role (usando status corretos do banco)
        const statusEditaveisColaborador = ['pendente', 'em_andamento', 'devolvida'];
        const statusEditaveisGerente = ['aguardando_aprovacao'];

        if (isMgr && !statusEditaveisGerente.includes(evalData.status)) {
          router.push(`/avaliacao/ver/${id}`);
          return;
        }

        if (isCollab && !statusEditaveisColaborador.includes(evalData.status)) {
          router.push(`/avaliacao/ver/${id}`);
          return;
        }

        setEvaluation(evalData);
        setIsManager(isMgr);
        setUserId(currentUserId);
        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch evaluation:', err);
        setError('Erro ao carregar avaliação');
        setLoading(false);
      }
    };

    fetchEvaluation();
  }, [id, router]);

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

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px', padding: '20px' }}>
        <p style={{ color: '#d32f2f', fontSize: '16px' }}>{error}</p>
      </div>
    );
  }

  if (!evaluation) return null;

  return (
    <FillEvaluationClient 
      evaluation={evaluation} 
      isManager={isManager}
      userId={userId}
    />
  );
}
