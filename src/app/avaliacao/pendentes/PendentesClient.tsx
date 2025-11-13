'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FiClock, FiUser, FiCalendar, FiEye } from 'react-icons/fi';

interface AvaliacaoPendente {
  id: string;
  funcionario_nome: string;
  funcionario_cargo: string;
  periodo: string;
  data_autoavaliacao: string;
  data_fim: string;
  pontuacao_total: number;
}

export default function PendentesClient() {
  const router = useRouter();
  const [avaliacoes, setAvaliacoes] = useState<AvaliacaoPendente[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPendentes();
  }, []);

  const fetchPendentes = async () => {
    try {
      const token = document.cookie.split('; ').find(row => row.startsWith('abzToken='))?.split('=')[1];
      const response = await fetch('/api/avaliacao-desempenho/avaliacoes/pending-review', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setAvaliacoes(data.data);
      }
    } catch (error) {
      console.error('Erro ao buscar pendentes:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex justify-center items-center h-64">
          <div className="loading loading-spinner loading-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
          Avaliações Pendentes de Revisão
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          {avaliacoes.length} avaliação(ões) aguardando sua aprovação
        </p>
      </div>

      {avaliacoes.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
          <FiClock className="mx-auto text-6xl text-gray-400 mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Nenhuma avaliação pendente
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            Todas as avaliações foram revisadas!
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {avaliacoes.map((avaliacao) => (
            <div
              key={avaliacao.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow p-6"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <FiUser className="text-blue-600 text-xl" />
                    <h3 className="text-xl font-semibold text-gray-800 dark:text-white">
                      {avaliacao.funcionario_nome}
                    </h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Cargo</p>
                      <p className="font-medium text-gray-700 dark:text-gray-300">
                        {avaliacao.funcionario_cargo || 'Não informado'}
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Período</p>
                      <p className="font-medium text-gray-700 dark:text-gray-300">
                        {avaliacao.periodo}
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Submetida em</p>
                      <p className="font-medium text-gray-700 dark:text-gray-300">
                        {new Date(avaliacao.data_autoavaliacao).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => router.push(`/avaliacao/ver/${avaliacao.id}`)}
                  className="btn btn-primary gap-2"
                >
                  <FiEye />
                  Revisar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
