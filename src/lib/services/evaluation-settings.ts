import { supabase } from '@/lib/supabase';

type CalculationMethod = 'simple_average' | 'weighted';

export interface EvaluationSettings {
  id: string;
  scope: 'global' | 'periodo';
  periodo_id?: string | null;
  calculo: {
    method: CalculationMethod;
    weights?: Record<string, number>; // por criterio_id ou categoria
    categoryMethods?: Record<string, CalculationMethod>;
  };
  obrigatoriedade?: {
    required_by_role?: Record<'collaborator' | 'manager', number[]>; // perguntas obrigatórias
    visibility_by_role?: Record<'collaborator' | 'manager', number[]>; // perguntas visíveis
  };
  ativo: boolean;
  created_at: string;
  updated_at?: string;
}

export const EvaluationSettingsService = {
  async getEffectiveSettings(periodoId?: string | null): Promise<EvaluationSettings | null> {
    // Primeiro tenta período específico ativo
    if (periodoId) {
      const { data: periodoSettings } = await supabase
        .from('avaliacao_settings')
        .select('*')
        .eq('scope', 'periodo')
        .eq('periodo_id', periodoId)
        .eq('ativo', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (periodoSettings) return periodoSettings as EvaluationSettings;
    }

    // Fallback para global
    const { data: globalSettings } = await supabase
      .from('avaliacao_settings')
      .select('*')
      .eq('scope', 'global')
      .eq('ativo', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return (globalSettings as EvaluationSettings) || null;
  },

  calculateScore(
    notas: { criterioId?: string; categoria?: string; valor: number; peso?: number }[],
    settings?: EvaluationSettings | null
  ): number {
    if (!notas || notas.length === 0) return 0;
    const method = settings?.calculo?.method || 'simple_average';

    if (method === 'weighted') {
      let somaPesos = 0;
      let somaPonderada = 0;
      for (const n of notas) {
        const basePeso = n.peso ?? 1;
        const confPeso = n.criterioId && settings?.calculo?.weights
          ? settings.calculo.weights[n.criterioId] ?? basePeso
          : basePeso;
        somaPesos += confPeso;
        somaPonderada += n.valor * confPeso;
      }
      return somaPesos > 0 ? Math.round((somaPonderada / somaPesos) * 10) / 10 : 0;
    }

    // simple_average
    const media = notas.reduce((acc, n) => acc + n.valor, 0) / notas.length;
    return Math.round(media * 10) / 10;
  }
};
