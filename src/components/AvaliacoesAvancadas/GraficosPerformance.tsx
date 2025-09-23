'use client';

import React, { useEffect, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  RadialLinearScale,
} from 'chart.js';
import { Line, Bar, Doughnut, Radar } from 'react-chartjs-2';
import { FiTrendingUp, FiBarChart2, FiPieChart, FiActivity } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import { TendenciaAvaliacao, AnaliseComparativa } from '@/types/avaliacoes-avancadas';

// Registrar componentes do Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  RadialLinearScale
);

interface GraficosPerformanceProps {
  tendencias: TendenciaAvaliacao[];
  comparacoes?: AnaliseComparativa;
  loading: boolean;
}

export default function GraficosPerformance({ 
  tendencias, 
  comparacoes, 
  loading 
}: GraficosPerformanceProps) {
  const { t } = useI18n();

  // Configurações padrão dos gráficos
  const defaultOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
      },
      y: {
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
        beginAtZero: true,
      },
    },
  };

  // Dados para gráfico de tendências
  const tendenciasData = {
    labels: tendencias.map(t => {
      const date = new Date(t.data);
      return date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
    }),
    datasets: [
      {
        label: t('avaliacoes.media_pontuacao', 'Média de Pontuação'),
        data: tendencias.map(t => t.media_pontuacao),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
      },
      {
        label: t('avaliacoes.satisfacao_media', 'Satisfação Média'),
        data: tendencias.map(t => t.satisfacao_media),
        borderColor: 'rgb(16, 185, 129)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
        tension: 0.4,
      },
    ],
  };

  // Dados para gráfico de departamentos
  const departamentosData = comparacoes ? {
    labels: comparacoes.departamentos.map(d => d.nome),
    datasets: [
      {
        label: t('avaliacoes.media_pontuacao', 'Média de Pontuação'),
        data: comparacoes.departamentos.map(d => d.media_pontuacao),
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(245, 158, 11, 0.8)',
          'rgba(239, 68, 68, 0.8)',
          'rgba(139, 92, 246, 0.8)',
          'rgba(236, 72, 153, 0.8)',
        ],
        borderColor: [
          'rgb(59, 130, 246)',
          'rgb(16, 185, 129)',
          'rgb(245, 158, 11)',
          'rgb(239, 68, 68)',
          'rgb(139, 92, 246)',
          'rgb(236, 72, 153)',
        ],
        borderWidth: 2,
      },
    ],
  } : null;

  // Dados para gráfico de cargos
  const cargosData = comparacoes ? {
    labels: comparacoes.cargos.slice(0, 6).map(c => c.nome), // Limitar a 6 para melhor visualização
    datasets: [
      {
        label: t('avaliacoes.media_pontuacao', 'Média de Pontuação'),
        data: comparacoes.cargos.slice(0, 6).map(c => c.media_pontuacao),
        backgroundColor: 'rgba(59, 130, 246, 0.6)',
        borderColor: 'rgb(59, 130, 246)',
        borderWidth: 2,
      },
    ],
  } : null;

  // Dados para gráfico radar de critérios
  const criteriosData = comparacoes ? {
    labels: comparacoes.criterios.map(c => c.nome),
    datasets: [
      {
        label: t('avaliacoes.performance_criterios', 'Performance por Critério'),
        data: comparacoes.criterios.map(c => c.media_pontuacao),
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        borderColor: 'rgb(59, 130, 246)',
        borderWidth: 2,
        pointBackgroundColor: 'rgb(59, 130, 246)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgb(59, 130, 246)',
      },
    ],
  } : null;

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(4)].map((_, index) => (
          <div key={index} className="bg-white rounded-lg shadow-sm border p-6 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          {t('avaliacoes.graficos_performance', 'Gráficos de Performance')}
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de Tendências */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center mb-4">
            <FiTrendingUp className="h-5 w-5 text-blue-600 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">
              {t('avaliacoes.tendencias_tempo', 'Tendências ao Longo do Tempo')}
            </h3>
          </div>
          <div className="h-64">
            {tendencias.length > 0 ? (
              <Line data={tendenciasData} options={defaultOptions} />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                {t('avaliacoes.sem_dados_tendencias', 'Sem dados de tendências disponíveis')}
              </div>
            )}
          </div>
        </div>

        {/* Gráfico de Departamentos */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center mb-4">
            <FiBarChart2 className="h-5 w-5 text-green-600 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">
              {t('avaliacoes.performance_departamentos', 'Performance por Departamento')}
            </h3>
          </div>
          <div className="h-64">
            {departamentosData ? (
              <Bar data={departamentosData} options={defaultOptions} />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                {t('avaliacoes.sem_dados_departamentos', 'Sem dados de departamentos disponíveis')}
              </div>
            )}
          </div>
        </div>

        {/* Gráfico de Cargos */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center mb-4">
            <FiPieChart className="h-5 w-5 text-yellow-600 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">
              {t('avaliacoes.performance_cargos', 'Performance por Cargo')}
            </h3>
          </div>
          <div className="h-64">
            {cargosData ? (
              <Doughnut 
                data={cargosData} 
                options={{
                  ...defaultOptions,
                  scales: undefined, // Remover scales para gráfico de pizza
                }}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                {t('avaliacoes.sem_dados_cargos', 'Sem dados de cargos disponíveis')}
              </div>
            )}
          </div>
        </div>

        {/* Gráfico Radar de Critérios */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center mb-4">
            <FiActivity className="h-5 w-5 text-purple-600 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">
              {t('avaliacoes.performance_criterios', 'Performance por Critério')}
            </h3>
          </div>
          <div className="h-64">
            {criteriosData ? (
              <Radar 
                data={criteriosData} 
                options={{
                  ...defaultOptions,
                  scales: {
                    r: {
                      beginAtZero: true,
                      max: 10,
                      ticks: {
                        stepSize: 2,
                      },
                      grid: {
                        color: 'rgba(0, 0, 0, 0.1)',
                      },
                    },
                  },
                }}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                {t('avaliacoes.sem_dados_criterios', 'Sem dados de critérios disponíveis')}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Insights e Recomendações */}
      {comparacoes && (
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-6 border border-purple-200">
          <h3 className="text-lg font-semibold text-purple-900 mb-4">
            {t('avaliacoes.insights_automaticos', 'Insights Automáticos')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="bg-white rounded-lg p-4 border border-purple-100">
              <div className="font-medium text-purple-800 mb-2">
                {t('avaliacoes.melhor_departamento', 'Melhor Departamento')}
              </div>
              <div className="text-purple-600">
                {comparacoes.departamentos.length > 0 && 
                  comparacoes.departamentos.reduce((prev, current) => 
                    prev.media_pontuacao > current.media_pontuacao ? prev : current
                  ).nome
                }
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-purple-100">
              <div className="font-medium text-purple-800 mb-2">
                {t('avaliacoes.melhor_cargo', 'Melhor Cargo')}
              </div>
              <div className="text-purple-600">
                {comparacoes.cargos.length > 0 && 
                  comparacoes.cargos.reduce((prev, current) => 
                    prev.media_pontuacao > current.media_pontuacao ? prev : current
                  ).nome
                }
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-purple-100">
              <div className="font-medium text-purple-800 mb-2">
                {t('avaliacoes.criterio_destaque', 'Critério Destaque')}
              </div>
              <div className="text-purple-600">
                {comparacoes.criterios.length > 0 && 
                  comparacoes.criterios.reduce((prev, current) => 
                    prev.media_pontuacao > current.media_pontuacao ? prev : current
                  ).nome
                }
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
