import { NextRequest, NextResponse } from 'next/server';
import { garantirNivelPayroll } from '@/lib/payroll/payroll-auth';
import { ErroFolhaBloqueada, sincronizarModulosInternos } from '@/lib/payroll/fontes-dp';
import {
  ErroWkCodigosNaoMapeados,
  ErroWkCredencial,
  ErroWkFolhaBloqueada,
  sincronizarWk,
  type CompetenciaWk,
} from '@/lib/wkradar/sync';

export const dynamic = 'force-dynamic';

/**
 * POST /api/dp/wk/sync
 * Corpo JSON (fonte 'api'): { competencia: { mes, ano } | 'MM/YYYY' | 'YYYY-MM',
 * companyId, departmentId? } — puxa da Radar.API.
 * Multipart (fonte 'arquivo'): campos arquivo (File .xlsx), competencia
 * (JSON/'MM/YYYY'/'YYYY-MM' ou mes+ano soltos), companyId, departmentId?.
 *
 * APÓS sincronizarWk executa sincronizarModulosInternos (módulos do portal →
 * itens origem='gt') e devolve os dois resultados.
 * 422 → codigosNaoMapeados; 400 → credenciais ausentes; 409 → folha fechada.
 */

/** Parse tolerante da competência: {mes,ano}, 'MM/YYYY', 'YYYY-MM'. */
function parsearCompetencia(valor: unknown): CompetenciaWk | null {
  if (valor && typeof valor === 'object' && !Array.isArray(valor)) {
    const rec = valor as Record<string, unknown>;
    const mes = Number(rec.mes);
    const ano = Number(rec.ano);
    if (Number.isInteger(mes) && Number.isInteger(ano)) return { mes, ano };
    return null;
  }
  if (typeof valor === 'string') {
    const br = /^(\d{1,2})\/(\d{4})$/.exec(valor.trim()); // MM/YYYY
    if (br) return { mes: Number(br[1]), ano: Number(br[2]) };
    const iso = /^(\d{4})-(\d{1,2})$/.exec(valor.trim()); // YYYY-MM
    if (iso) return { mes: Number(iso[2]), ano: Number(iso[1]) };
  }
  return null;
}

function competenciaInvalida(comp: CompetenciaWk | null): string | null {
  if (!comp) return 'competencia inválida — envie { mes, ano }, "MM/YYYY" ou "YYYY-MM"';
  if (!Number.isInteger(comp.mes) || comp.mes < 1 || comp.mes > 12) {
    return 'competencia.mes deve estar entre 1 e 12';
  }
  if (!Number.isInteger(comp.ano) || comp.ano < 2024) return 'competencia.ano deve ser >= 2024';
  return null;
}

export async function POST(request: NextRequest) {
  const gate = await garantirNivelPayroll(request, 'edit');
  if (!gate.ok) return gate.error;

  try {
    const contentType = request.headers.get('content-type') || '';
    let competencia: CompetenciaWk | null = null;
    let companyId = '';
    let departmentId: string | null = null;
    let fonte: 'api' | 'arquivo' = 'api';
    let planilha: Buffer | undefined;
    let nomeArquivo: string | undefined;

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      const arquivo = form.get('arquivo');
      if (!(arquivo instanceof File)) {
        return NextResponse.json(
          { success: false, error: 'Envie o campo "arquivo" com a planilha exportada do WK Radar (.xlsx)' },
          { status: 400 },
        );
      }
      const mes = Number(form.get('mes'));
      const ano = Number(form.get('ano'));
      competencia = parsearCompetencia(form.get('competencia')) ?? (mes && ano ? { mes, ano } : null);
      companyId = String(form.get('companyId') || '').trim();
      departmentId = String(form.get('departmentId') || '').trim() || null;
      planilha = Buffer.from(await arquivo.arrayBuffer());
      nomeArquivo = arquivo.name || undefined;
      fonte = 'arquivo';
    } else {
      const corpo = (await request.json().catch(() => null)) as Record<string, unknown> | null;
      if (!corpo) {
        return NextResponse.json({ success: false, error: 'Corpo JSON inválido' }, { status: 400 });
      }
      competencia = parsearCompetencia(corpo.competencia);
      companyId = String(corpo.companyId || '').trim();
      departmentId = String(corpo.departmentId || '').trim() || null;
      if (corpo.fonte === 'arquivo' && typeof corpo.planilhaBase64 === 'string') {
        planilha = Buffer.from(corpo.planilhaBase64, 'base64');
        nomeArquivo = typeof corpo.nomeArquivo === 'string' ? corpo.nomeArquivo : undefined;
        fonte = 'arquivo';
      }
    }

    const erroComp = competenciaInvalida(competencia);
    if (erroComp || !competencia) {
      return NextResponse.json({ success: false, error: erroComp || 'competencia inválida' }, { status: 400 });
    }
    if (!companyId) {
      return NextResponse.json({ success: false, error: 'companyId é obrigatório' }, { status: 400 });
    }

    const entradaWk =
      fonte === 'arquivo' && planilha
        ? {
            fonte: 'arquivo' as const,
            competencia,
            companyId,
            departmentId,
            planilha,
            nomeArquivo,
            usuarioId: gate.user.userId,
          }
        : { fonte: 'api' as const, competencia, companyId, departmentId, usuarioId: gate.user.userId };
    const wk = await sincronizarWk(entradaWk);

    let modulos;
    try {
      modulos = await sincronizarModulosInternos({
        competencia,
        companyId,
        departmentId,
        usuarioId: gate.user.userId,
      });
    } catch (erroModulos) {
      if (erroModulos instanceof ErroFolhaBloqueada) {
        return NextResponse.json(
          { success: false, error: erroModulos.message, data: { wk } },
          { status: 409 },
        );
      }
      console.error('[dp/wk/sync] falha na consolidação dos módulos internos:', erroModulos);
      return NextResponse.json(
        {
          success: false,
          error: `Sincronização WK concluída, mas a consolidação dos módulos internos falhou: ${
            erroModulos instanceof Error ? erroModulos.message : String(erroModulos)
          }`,
          data: { wk },
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, data: { wk, modulos } });
  } catch (erro) {
    if (erro instanceof ErroWkCredencial) {
      return NextResponse.json({ success: false, error: erro.message }, { status: 400 });
    }
    if (erro instanceof ErroWkCodigosNaoMapeados) {
      return NextResponse.json(
        { success: false, error: erro.message, data: { codigosNaoMapeados: erro.codigosNaoMapeados } },
        { status: 422 },
      );
    }
    if (erro instanceof ErroWkFolhaBloqueada) {
      return NextResponse.json({ success: false, error: erro.message }, { status: 409 });
    }
    console.error('[dp/wk/sync] erro inesperado:', erro);
    return NextResponse.json(
      { success: false, error: erro instanceof Error ? erro.message : 'Erro na sincronização WK' },
      { status: 500 },
    );
  }
}
