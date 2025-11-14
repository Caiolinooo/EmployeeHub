'use client';

import { motion } from 'framer-motion';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell
} from 'recharts';

interface EvaluationChartsProps {
  respostas: Record<string, any>;
  questionarioData: Array<{ id: string; pergunta: string; tipo?: 'collaborator' | 'manager' }>;
  notasGerente?: Record<string, number>;
}

export default function EvaluationCharts({
  respostas,
  questionarioData,
  notasGerente = {}
}: EvaluationChartsProps) {
  // Filtrar questões por tipo
  const managerQuestions = questionarioData.filter(q => q.tipo === 'manager');
  const collaboratorQuestions = questionarioData.filter(q => q.tipo === 'collaborator');
  
  // Preparar dados para radar chart - QUESTÕES DO GERENTE
  const radarDataManager = managerQuestions
    .filter(q => respostas[q.id]?.nota)
    .map(q => ({
      subject: q.id,
      fullName: q.pergunta,
      value: respostas[q.id].nota,
      fullMark: 5,
      tipo: 'Avaliação Gerencial'
    }));

  // Preparar dados para radar chart - NOTAS DO GERENTE PARA QUESTÕES DO COLABORADOR
  const radarDataCollaborator = collaboratorQuestions
    .filter(q => notasGerente[q.id])
    .map(q => ({
      subject: q.id,
      fullName: q.pergunta,
      value: notasGerente[q.id],
      fullMark: 5,
      tipo: 'Nota do Gerente'
    }));

  const radarData = [...radarDataManager, ...radarDataCollaborator];

  // Dados para distribuição de scores - TODAS AS NOTAS
  const scoreDistribution = [
    { range: '1 Estrela', count: 0, color: '#ef4444' },
    { range: '2 Estrelas', count: 0, color: '#f97316' },
    { range: '3 Estrelas', count: 0, color: '#eab308' },
    { range: '4 Estrelas', count: 0, color: '#3b82f6' },
    { range: '5 Estrelas', count: 0, color: '#22c55e' }
  ];

  // Contar notas de questões do gerente
  managerQuestions.forEach((question) => {
    const resposta = respostas[question.id];
    if (resposta?.nota) {
      scoreDistribution[resposta.nota - 1].count++;
    }
  });

  // Contar notas do gerente para questões do colaborador
  collaboratorQuestions.forEach((question) => {
    const nota = notasGerente[question.id];
    if (nota) {
      scoreDistribution[nota - 1].count++;
    }
  });

  // Calcular média - TODAS AS NOTAS
  const managerResponses = managerQuestions
    .map(q => respostas[q.id])
    .filter((r: any) => r?.nota);

  const collaboratorNotes = collaboratorQuestions
    .map(q => notasGerente[q.id])
    .filter((n): n is number => typeof n === 'number' && n > 0);

  const allNotes = [
    ...managerResponses.map((r: any) => r.nota),
    ...collaboratorNotes
  ];
    
  const average = allNotes.length > 0
    ? allNotes.reduce((sum: number, n: number) => sum + n, 0) / allNotes.length
    : 0;

  const totalQuestions = managerQuestions.length + collaboratorQuestions.length;
  const answeredQuestions = managerResponses.length + collaboratorNotes.length;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 rounded-lg shadow-lg border-2 border-gray-200">
          <p className="font-semibold text-gray-900 mb-1">
            {payload[0].payload.fullName || payload[0].payload.range}
          </p>
          <p className="text-sm text-gray-600">
            Nota: <span className="font-bold text-blue-600">{payload[0].value}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8">
      {/* Estatísticas de resumo */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-6"
      >
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
          <p className="text-sm font-medium opacity-90 mb-2">Média Geral</p>
          <p className="text-4xl font-bold">{average.toFixed(1)}</p>
          <p className="text-sm opacity-75 mt-2">de 5.0 pontos</p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
          <p className="text-sm font-medium opacity-90 mb-2">Questões Avaliadas</p>
          <p className="text-4xl font-bold">{answeredQuestions}</p>
          <p className="text-sm opacity-75 mt-2">de {totalQuestions} questões totais</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
          <p className="text-sm font-medium opacity-90 mb-2">Progresso</p>
          <p className="text-4xl font-bold">
            {totalQuestions > 0 ? ((answeredQuestions / totalQuestions) * 100).toFixed(0) : 0}%
          </p>
          <p className="text-sm opacity-75 mt-2">completado</p>
        </div>
      </motion.div>

      {/* Gráficos lado a lado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Radar Chart */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-xl shadow-lg p-6 border-2 border-gray-200"
        >
          <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
            Desempenho por Competência
          </h3>
          {radarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#e5e7eb" />
                <PolarAngleAxis 
                  dataKey="subject" 
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                />
                <PolarRadiusAxis 
                  angle={90} 
                  domain={[0, 5]} 
                  tick={{ fill: '#6b7280' }}
                />
                <Radar
                  name="Avaliação"
                  dataKey="value"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.6}
                />
                <Tooltip content={<CustomTooltip />} />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400">
              <p>Nenhum dado disponível</p>
            </div>
          )}
        </motion.div>

        {/* Bar Chart */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-xl shadow-lg p-6 border-2 border-gray-200"
        >
          <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <span className="w-3 h-3 bg-green-500 rounded-full"></span>
            Distribuição de Notas
          </h3>
          {managerResponses.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={scoreDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="range" 
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  angle={-15}
                  textAnchor="end"
                  height={60}
                />
                <YAxis tick={{ fill: '#6b7280' }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                  {scoreDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400">
              <p>Nenhum dado disponível</p>
            </div>
          )}
        </motion.div>
      </div>

      {/* Score breakdown detalhado */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-white rounded-xl shadow-lg p-6 border-2 border-gray-200"
      >
        <h3 className="text-xl font-bold text-gray-900 mb-4">Detalhamento por Questão</h3>
        
        {/* Questões do Gerente */}
        {radarDataManager.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-purple-700 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
              Avaliação Gerencial (Q15-Q17)
            </h4>
            <div className="space-y-3">
              {radarDataManager.map((item, index) => (
                <div key={item.subject} className="flex items-center gap-4">
                  <div className="flex-shrink-0 w-16 text-center">
                    <span className="inline-block px-3 py-1 bg-purple-100 rounded-lg font-semibold text-sm text-purple-700">
                      {item.subject}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-gray-700 truncate">
                        {item.fullName}
                      </p>
                      <span className={`text-sm font-bold ${
                        item.value >= 4 ? 'text-green-600' :
                        item.value >= 3 ? 'text-blue-600' :
                        item.value >= 2 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {item.value.toFixed(1)}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(item.value / 5) * 100}%` }}
                        transition={{ delay: 0.5 + index * 0.05, duration: 0.5 }}
                        className={`h-full rounded-full ${
                          item.value >= 4 ? 'bg-green-500' :
                          item.value >= 3 ? 'bg-blue-500' :
                          item.value >= 2 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notas do Gerente para Questões do Colaborador */}
        {radarDataCollaborator.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-blue-700 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
              Notas do Gerente para Autoavaliação (Q11-Q14)
            </h4>
            <div className="space-y-3">
              {radarDataCollaborator.map((item, index) => (
                <div key={item.subject} className="flex items-center gap-4">
                  <div className="flex-shrink-0 w-16 text-center">
                    <span className="inline-block px-3 py-1 bg-blue-100 rounded-lg font-semibold text-sm text-blue-700">
                      {item.subject}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-gray-700 truncate">
                        {item.fullName}
                      </p>
                      <span className={`text-sm font-bold ${
                        item.value >= 4 ? 'text-green-600' :
                        item.value >= 3 ? 'text-blue-600' :
                        item.value >= 2 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {item.value.toFixed(1)}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(item.value / 5) * 100}%` }}
                        transition={{ delay: 0.5 + (radarDataManager.length + index) * 0.05, duration: 0.5 }}
                        className={`h-full rounded-full ${
                          item.value >= 4 ? 'bg-green-500' :
                          item.value >= 3 ? 'bg-blue-500' :
                          item.value >= 2 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
