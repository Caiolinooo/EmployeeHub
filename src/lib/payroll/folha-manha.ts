/**
 * Atualização diária da folha.
 * 1. Espelha empresa e centro de custo do GT.
 * 2. Recalcula a competência civil atual (BRT) de cada empresa ativa,
 *    com embarque, dobra, folga e férias já registrados.
 *
 * Não mexe em folha aprovada, paga ou com assinatura em andamento.
 */
import { supabaseAdmin } from '@/lib/supabase';
import { mesAnoAtualBRT } from '@/components/gestao-tripulantes/fechamento/fechamentoV2';
import { ErroFolhaBloqueada } from '@/lib/payroll/fontes-dp';
import { gerarRelatorioOperacional } from '@/lib/payroll/relatorio-operacional';
import { sincronizarEstruturaGt, type ResultadoSyncEstrutura } from '@/lib/payroll/sync-estrutura-gt';

export interface FolhaManhaEmpresa {
  companyId: string;
  name: string;
  status: 'calculada' | 'pulada' | 'erro';
  sheetId?: string;
  colaboradores?: number;
  bruto?: number;
  liquido?: number;
  pendencias?: number;
  motivo?: string;
}

export interface ResultadoFolhaManha {
  competencia: { mes: number; ano: number };
  estrutura: ResultadoSyncEstrutura;
  folhas: FolhaManhaEmpresa[];
}

function competenciaAtual(): { mes: number; ano: number } {
  const [ano, mes] = mesAnoAtualBRT().split('-').map(Number);
  return { mes, ano };
}

function assinaturaEmAndamento(aprovacao: unknown): boolean {
  if (!aprovacao || typeof aprovacao !== 'object' || Array.isArray(aprovacao)) return false;
  const registro = aprovacao as { assinaturas?: unknown; rejeicao?: unknown };
  if (registro.rejeicao) return false;
  return Array.isArray(registro.assinaturas) && registro.assinaturas.length > 0;
}

export async function atualizarFolhaDaManha(): Promise<ResultadoFolhaManha> {
  const estrutura = await sincronizarEstruturaGt(supabaseAdmin);
  const competencia = competenciaAtual();

  const { data: empresas, error } = await supabaseAdmin
    .from('payroll_companies')
    .select('id, name')
    .eq('is_active', true);
  if (error) throw new Error(`payroll_companies: ${error.message}`);

  const folhas: FolhaManhaEmpresa[] = [];
  for (const emp of empresas || []) {
    const { data: sheet, error: sheetError } = await supabaseAdmin
      .from('payroll_sheets')
      .select('id, status, aprovacao')
      .eq('company_id', emp.id)
      .eq('reference_month', competencia.mes)
      .eq('reference_year', competencia.ano)
      .is('department_id', null)
      .maybeSingle();
    if (sheetError) {
      folhas.push({ companyId: emp.id, name: emp.name, status: 'erro', motivo: sheetError.message });
      continue;
    }
    if (sheet && (sheet.status === 'approved' || sheet.status === 'paid')) {
      folhas.push({
        companyId: emp.id,
        name: emp.name,
        status: 'pulada',
        sheetId: sheet.id,
        motivo: `Folha ${sheet.status} — não recalculada`,
      });
      continue;
    }
    if (sheet && assinaturaEmAndamento(sheet.aprovacao)) {
      folhas.push({
        companyId: emp.id,
        name: emp.name,
        status: 'pulada',
        sheetId: sheet.id,
        motivo: 'Aprovação em andamento — não recalculada',
      });
      continue;
    }

    try {
      const rel = await gerarRelatorioOperacional({ competencia, companyId: emp.id });
      folhas.push({
        companyId: emp.id,
        name: emp.name,
        status: 'calculada',
        sheetId: rel.sheetId,
        colaboradores: rel.totais.colaboradores,
        bruto: rel.totais.bruto,
        liquido: rel.totais.liquido,
        pendencias: rel.pendencias.length,
      });
      await supabaseAdmin.from('payroll_audit_log').insert({
        table_name: 'payroll_sheets',
        record_id: rel.sheetId,
        action: 'UPDATE',
        new_values: {
          origem_evento: 'cron_manha',
          competencia,
          colaboradores: rel.totais.colaboradores,
          bruto: rel.totais.bruto,
          liquido: rel.totais.liquido,
          pendencias: rel.pendencias.length,
        },
      });
    } catch (causa) {
      if (causa instanceof ErroFolhaBloqueada) {
        folhas.push({
          companyId: emp.id,
          name: emp.name,
          status: 'pulada',
          sheetId: causa.sheetId,
          motivo: causa.message,
        });
        continue;
      }
      folhas.push({
        companyId: emp.id,
        name: emp.name,
        status: 'erro',
        motivo: causa instanceof Error ? causa.message : 'Erro ao calcular a folha',
      });
    }
  }

  return { competencia, estrutura, folhas };
}
