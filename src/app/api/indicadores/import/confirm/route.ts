import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { garantirNivelIndicadores, type AtorIndicadores } from '@/lib/indicadores/api-auth';
import { analisarWorkbook } from '@/lib/indicadores/xlsx-import';

export const dynamic = 'force-dynamic';

const CHUNK_INSERT = 500;

interface PayloadAba {
  nome: string;
  headerRow?: number;
}

interface ConfirmPayload {
  nome?: string;
  modo: 'criar' | 'substituir';
  planilhaId?: string;
  abas: PayloadAba[];
}

function parsePayload(raw: FormDataEntryValue | null): ConfirmPayload | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const p = JSON.parse(raw) as ConfirmPayload;
    if (!p || typeof p !== 'object') return null;
    if (p.modo !== 'criar' && p.modo !== 'substituir') return null;
    if (!Array.isArray(p.abas) || p.abas.length === 0) return null;
    if (p.abas.some((a) => !a || typeof a.nome !== 'string' || !a.nome.trim())) return null;
    if (p.modo === 'criar' && (typeof p.nome !== 'string' || !p.nome.trim())) return null;
    if (p.modo === 'substituir' && typeof p.planilhaId !== 'string') return null;
    return p;
  } catch {
    return null;
  }
}

function validarHeaderRow(v: unknown): number | undefined {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) return undefined;
  return v;
}

async function inserirLinhas(
  abaId: string,
  linhas: Record<string, unknown>[],
  ator: AtorIndicadores,
): Promise<string | null> {
  const rows = linhas.map((dados, i) => ({
    aba_id: abaId,
    dados,
    ordem: i + 1,
    criado_por: ator,
  }));
  for (let i = 0; i < rows.length; i += CHUNK_INSERT) {
    const { error } = await supabaseAdmin.from('rs_linhas').insert(rows.slice(i, i + CHUNK_INSERT));
    if (error) return error.message;
  }
  return null;
}

/**
 * POST /api/indicadores/import/confirm
 * FormData { arquivo, payload } — payload JSON: { nome, modo:
 * 'criar'|'substituir', planilhaId?, abas: [{ nome, headerRow? }] }.
 * Grava planilha/abas/linhas + auditoria em rs_importacoes.
 * modo 'substituir' apaga (cascade) as abas reimportadas e mantém as demais
 * abas do dataset. Gate: podeImportarIndicadores.
 */
export async function POST(request: NextRequest) {
  try {
    const gate = await garantirNivelIndicadores(request, 'import');
    if (gate.error) return gate.error;
    const ator = gate.ator!;

    const form = await request.formData();
    const arquivo = form.get('arquivo');
    if (!(arquivo instanceof File)) {
      return NextResponse.json(
        { success: false, error: 'Arquivo .xlsx é obrigatório (campo "arquivo")' },
        { status: 400 },
      );
    }
    const payload = parsePayload(form.get('payload'));
    if (!payload) {
      return NextResponse.json(
        { success: false, error: 'payload inválido: { nome, modo: criar|substituir, planilhaId?, abas: [{nome, headerRow?}] }' },
        { status: 400 },
      );
    }

    // Reparseia o MESMO arquivo com os overrides de cabeçalho recebidos.
    const headerRows: Record<string, number> = {};
    for (const aba of payload.abas) {
      const hr = validarHeaderRow(aba.headerRow);
      if (hr) headerRows[aba.nome] = hr;
    }
    const buffer = Buffer.from(await arquivo.arrayBuffer());
    const analise = analisarWorkbook(buffer, { arquivoNome: arquivo.name, headerRows });

    const nomesPedidos = payload.abas.map((a) => a.nome);
    const abasImportar = analise.abas.filter((a) => nomesPedidos.includes(a.nome));
    const ausentes = nomesPedidos.filter((n) => !abasImportar.some((a) => a.nome === n));
    if (ausentes.length > 0) {
      return NextResponse.json(
        { success: false, error: `Abas não encontradas/sem cabeçalho no arquivo: ${ausentes.join(', ')}` },
        { status: 400 },
      );
    }

    let planilhaId: string;
    if (payload.modo === 'substituir') {
      const { data: existente, error: errBusca } = await supabaseAdmin
        .from('rs_planilhas')
        .select('id')
        .eq('id', payload.planilhaId!)
        .maybeSingle();
      if (errBusca) {
        return NextResponse.json({ success: false, error: errBusca.message }, { status: 500 });
      }
      if (!existente) {
        return NextResponse.json({ success: false, error: 'Planilha não encontrada' }, { status: 404 });
      }
      planilhaId = existente.id as string;

      // Apaga SOMENTE as abas reimportadas (cascade remove as linhas delas).
      const { error: errDel } = await supabaseAdmin
        .from('rs_abas')
        .delete()
        .eq('planilha_id', planilhaId)
        .in('nome', nomesPedidos);
      if (errDel) {
        return NextResponse.json({ success: false, error: errDel.message }, { status: 500 });
      }
    } else {
      const { data: nova, error: errIns } = await supabaseAdmin
        .from('rs_planilhas')
        .insert({ nome: payload.nome!.trim(), arquivo_nome: arquivo.name, criado_por: ator })
        .select('id')
        .single();
      if (errIns || !nova) {
        return NextResponse.json(
          { success: false, error: errIns?.message || 'Falha ao criar planilha' },
          { status: 500 },
        );
      }
      planilhaId = nova.id as string;
    }

    const abasResposta: { id: string; nome: string; totalLinhas: number }[] = [];
    for (let i = 0; i < abasImportar.length; i += 1) {
      const aba = abasImportar[i];
      const { data: novaAba, error: errAba } = await supabaseAdmin
        .from('rs_abas')
        .insert({
          planilha_id: planilhaId,
          nome: aba.nome,
          linha_cabecalho: aba.headerRow,
          colunas: aba.colunas,
          ordem: i,
        })
        .select('id')
        .single();
      if (errAba || !novaAba) {
        return NextResponse.json(
          { success: false, error: errAba?.message || `Falha ao criar aba ${aba.nome}` },
          { status: 500 },
        );
      }
      const abaId = novaAba.id as string;
      const errLinhas = await inserirLinhas(abaId, aba.linhas, ator);
      if (errLinhas) {
        return NextResponse.json(
          { success: false, error: `Falha ao gravar linhas da aba ${aba.nome}: ${errLinhas}` },
          { status: 500 },
        );
      }
      abasResposta.push({ id: abaId, nome: aba.nome, totalLinhas: aba.totalLinhas });
    }

    // Auditoria da importação (best-effort — nunca falha o import).
    try {
      await supabaseAdmin.from('rs_importacoes').insert({
        planilha_id: planilhaId,
        arquivo_nome: arquivo.name,
        modo: payload.modo,
        abas: abasResposta,
        total_linhas: abasResposta.reduce((s, a) => s + a.totalLinhas, 0),
        ator,
      });
    } catch (errAudit) {
      console.error('[indicadores import/confirm] auditoria falhou (best-effort):', errAudit);
    }

    return NextResponse.json({ success: true, data: { planilhaId, abas: abasResposta } });
  } catch (error) {
    console.error('[indicadores import/confirm]', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro ao importar planilha' },
      { status: 500 },
    );
  }
}
