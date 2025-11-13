'use client';

import React, { useState } from 'react';
import { createManagerMapping, deleteManagerMapping } from '@/services/evaluationService';
import { User, EvaluationPeriod } from '@/types';
import { useRouter } from 'next/navigation';

interface ManageManagersClientProps {
  initialMappings: any[];
  initialEmployees: User[];
  initialPeriods: EvaluationPeriod[];
}

export default function ManageManagersClient({
  initialMappings,
  initialEmployees,
  initialPeriods,
}: ManageManagersClientProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedManager, setSelectedManager] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('');

  const handleAddMapping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee || !selectedManager) {
      setError('Funcionário e Gerente são obrigatórios.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await createManagerMapping(selectedEmployee, selectedManager, selectedPeriod || undefined);
      setSelectedEmployee('');
      setSelectedManager('');
      setSelectedPeriod('');
      router.refresh();
    } catch (err) {
      setError('Falha ao adicionar mapeamento.');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteMapping = async (id: string) => {
    if (window.confirm('Tem certeza que deseja remover este mapeamento?')) {
      try {
        await deleteManagerMapping(id);
        router.refresh();
      } catch (err) {
        setError('Falha ao remover mapeamento.');
        console.error(err);
      }
    }
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Gerenciar Mapeamento de Gerentes</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Mapeamentos Atuais</h2>
            {error && <div className="alert alert-error mb-4">{error}</div>}
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th>Colaborador</th>
                    <th>Gerente</th>
                    <th>Período Específico</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {initialMappings.map(m => (
                    <tr key={m.id}>
                      <td>{m.colaborador?.name || 'N/A'}</td>
                      <td>{m.gerente?.name || 'N/A'}</td>
                      <td>{m.periodo?.nome || 'Global'}</td>
                      <td>
                        <button
                          onClick={() => handleDeleteMapping(m.id)}
                          className="btn btn-sm btn-error"
                        >
                          Remover
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Adicionar Novo Mapeamento</h2>
            <form onSubmit={handleAddMapping}>
              <div className="form-control">
                <label className="label">Colaborador</label>
                <select
                  className="select select-bordered w-full"
                  value={selectedEmployee}
                  onChange={e => setSelectedEmployee(e.target.value)}
                  disabled={isSubmitting}
                >
                  <option value="">Selecione</option>
                  {initialEmployees
                    .filter(u => u.role === 'user')
                    .map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                </select>
              </div>
              <div className="form-control mt-4">
                <label className="label">Gerente</label>
                <select
                  className="select select-bordered w-full"
                  value={selectedManager}
                  onChange={e => setSelectedManager(e.target.value)}
                  disabled={isSubmitting}
                >
                  <option value="">Selecione</option>
                  {initialEmployees
                    .filter(u => u.role === 'manager')
                    .map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                </select>
              </div>
              <div className="form-control mt-4">
                <label className="label">Período (Opcional)</label>
                <select
                  className="select select-bordered w-full"
                  value={selectedPeriod}
                  onChange={e => setSelectedPeriod(e.target.value)}
                  disabled={isSubmitting}
                >
                  <option value="">Global (todos os períodos)</option>
                  {initialPeriods.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="btn btn-primary w-full mt-6"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Adicionando...' : 'Adicionar'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
