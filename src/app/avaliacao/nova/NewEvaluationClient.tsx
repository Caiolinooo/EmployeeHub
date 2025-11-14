'use client';

import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { createEvaluation } from '@/services/evaluationService';
import { EvaluationPeriod, User } from '@/types';
import { useRouter } from 'next/navigation';

const evaluationSchema = z.object({
  funcionario_id: z.string().min(1, "Funcionário é obrigatório"),
  periodo_id: z.string().min(1, "Período é obrigatório"),
  data_inicio: z.string().min(1, "Data de início é obrigatória"),
  data_fim: z.string().min(1, "Data de fim é obrigatória"),
});

type EvaluationFormData = z.infer<typeof evaluationSchema>;

interface NewEvaluationClientProps {
  periods: EvaluationPeriod[];
  employees: User[];
}

export default function NewEvaluationClient({ periods, employees }: NewEvaluationClientProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { control, handleSubmit, formState: { errors } } = useForm<EvaluationFormData>({
    resolver: zodResolver(evaluationSchema),
  });

  const onSubmit = async (data: EvaluationFormData) => {
    try {
      setIsSubmitting(true);
      setError(null);
      await createEvaluation({
        ...data,
        status: 'pendente_autoavaliacao',
      });
      router.push('/avaliacao');
      router.refresh();
    } catch (err) {
      setError('Falha ao criar avaliação.');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Criar Nova Avaliação</h1>
      {error && <div className="alert alert-error mb-4">{error}</div>}
      <form onSubmit={handleSubmit(onSubmit)} className="bg-white p-8 rounded-lg shadow-md">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="label">Funcionário</label>
            <Controller
              name="funcionario_id"
              control={control}
              render={({ field }) => (
                <select {...field} className="select select-bordered w-full">
                  <option value="">Selecione um funcionário</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              )}
            />
            {errors.funcionario_id && <p className="text-red-500 mt-1">{errors.funcionario_id.message}</p>}
          </div>

          <div>
            <label className="label">Período de Avaliação</label>
            <Controller
              name="periodo_id"
              control={control}
              render={({ field }) => (
                <select {...field} className="select select-bordered w-full">
                  <option value="">Selecione um período</option>
                  {periods.map(p => (
                    <option key={p.id} value={p.id}>{p.nome}</option>
                  ))}
                </select>
              )}
            />
            {errors.periodo_id && <p className="text-red-500 mt-1">{errors.periodo_id.message}</p>}
          </div>

          <div>
            <label className="label">Data de Início</label>
            <Controller
              name="data_inicio"
              control={control}
              render={({ field }) => <input type="date" {...field} className="input input-bordered w-full" />}
            />
            {errors.data_inicio && <p className="text-red-500 mt-1">{errors.data_inicio.message}</p>}
          </div>

          <div>
            <label className="label">Data de Fim</label>
            <Controller
              name="data_fim"
              control={control}
              render={({ field }) => <input type="date" {...field} className="input input-bordered w-full" />}
            />
            {errors.data_fim && <p className="text-red-500 mt-1">{errors.data_fim.message}</p>}
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-4">
          <button 
            type="button" 
            onClick={() => router.back()} 
            className="btn btn-ghost"
            disabled={isSubmitting}
          >
            Cancelar
          </button>
          <button 
            type="submit" 
            className="btn btn-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Salvando...' : 'Salvar Avaliação'}
          </button>
        </div>
      </form>
    </div>
  );
}
