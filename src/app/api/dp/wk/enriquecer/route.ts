import { NextRequest, NextResponse } from 'next/server';
import { garantirNivelPayroll } from '@/lib/payroll/payroll-auth';
import { ErroWkCredencial, WK_CANDIDATOS_FUNCIONARIOS, wkGetPaginado } from '@/lib/wkradar/api-client';
import {
  enriquecerPortalWk,
  type BackupPessoa,
  type FuncionarioApi,
} from '@/lib/wkradar/enriquecer';
import { lerCardJson, lerPessoasDeCards } from '@/lib/payroll/wk-backup';

export const dynamic = 'force-dynamic';

/**
 * POST /api/dp/wk/enriquecer
 * Completa VAZIOS em payroll_employees e gt_colaboradores com dados do WK
 * (nunca sobrescreve: position/pis/base_salary/department_id/matricula_esocial
 * só quando vazio; exceções confirmadas pelo DP ficam intactas).
 *
 * JSON  { aplicar?: boolean }                    → fonte RadarAPI ao vivo.
 * Multipart (fonte backup): campos arquivo       → cards DF/CRMINFP*.dat
 *   card_indicador, card_avisos?, card_custo?      extraídos do backup zip
 *   + aplicar                                      (o zip de 730MB não sobe).
 *
 * Dry-run por padrão (aplicar=true grava). Idempotente. Gate: nível payroll
 * 'edit' (mesmo gate do /api/dp/wk/sync).
 */

/** Chave de campo multipart → classe do card, por substring do nome. */
function classificarCard(nomeCampo: string): 'identidade' | 'custo' | null {
  const n = nomeCampo.toLowerCase();
  if (n.includes('custo')) return 'custo';
  if (n.includes('indicador') || n.includes('avisos')) return 'identidade';
  return null;
}

function textoParaUint8(buf: ArrayBuffer): Uint8Array {
  return new Uint8Array(buf);
}

export async function POST(request: NextRequest) {
  const gate = await garantirNivelPayroll(request, 'edit');
  if (!gate.ok) return gate.error;

  try {
    const contentType = request.headers.get('content-type') || '';
    let aplicar = false;
    let backupPorCpf: Map<string, BackupPessoa> | undefined;

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      aplicar = String(form.get('aplicar') || '') === 'true';

      const identidade: unknown[] = [];
      let custo: unknown = null;
      let recebeu = 0;
      for (const [campo, valor] of form.entries()) {
        if (typeof valor === 'string') continue;
        const classe = classificarCard(campo);
        if (!classe) continue;
        recebeu++;
        const bytes = textoParaUint8(await valor.arrayBuffer());
        // Os cards têm bytes de controle antes do JSON — mesmo parser do backup.
        const corpo = lerCardJson(bytes);
        if (classe === 'custo') custo = corpo;
        else identidade.push(corpo);
      }
      if (!recebeu) {
        return NextResponse.json(
          { success: false, error: 'Envie os cards .dat nos campos card_indicador (obrigatório), card_avisos e card_custo.' },
          { status: 400 },
        );
      }
      const pessoas = lerPessoasDeCards(identidade, custo);
      backupPorCpf = new Map<string, BackupPessoa>();
      for (const p of pessoas) {
        backupPorCpf.set(p.cpf, {
          pis: p.pis,
          nascimento: p.nascimento,
          moda: p.remuneracaoModa,
          estavel: p.remuneracaoEstavel,
        });
      }

      const relatorio = await enriquecerPortalWk({ backupPorCpf, aplicar });
      return NextResponse.json({ success: true, data: relatorio });
    }

    // Fonte API: { aplicar?: boolean }
    const corpo = await request.json().catch(() => ({}));
    aplicar = Boolean((corpo as { aplicar?: boolean }).aplicar);

    const linhas = await wkGetPaginado<Record<string, unknown>>(WK_CANDIDATOS_FUNCIONARIOS[0]);
    const funcionarios: FuncionarioApi[] = linhas.map((l) => ({
      id: Number(l.id),
      codigo: String(l.codigo ?? '').trim(),
      nome: String(l.nome ?? '').trim(),
      departamento: l.departamento == null ? null : String(l.departamento).trim(),
      cargo: l.cargo == null ? null : String(l.cargo).trim(),
    }));

    const relatorio = await enriquecerPortalWk({ funcionarios, aplicar });
    return NextResponse.json({ success: true, data: relatorio });
  } catch (erro) {
    if (erro instanceof ErroWkCredencial) {
      return NextResponse.json(
        { success: false, error: erro.message },
        { status: 400 },
      );
    }
    console.error('[WK enriquecer]', erro);
    return NextResponse.json(
      { success: false, error: erro instanceof Error ? erro.message : 'erro desconhecido' },
      { status: 500 },
    );
  }
}
