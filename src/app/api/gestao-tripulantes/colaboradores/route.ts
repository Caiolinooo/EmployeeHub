import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { autoGenerateESocialEvents } from '@/services/eSocialAutoService';
import { findColaboradorByCpf } from '@/lib/gestao-tripulantes/cpf-lookup';
import { flattenColaboradorRow, LIST_SELECT } from '@/lib/gestao-tripulantes/colaborador-get';
import { normalizeCpf } from '@/lib/gestao-tripulantes/cpf';
import { montarItensAlerta, resumoVencidosVigentes } from '@/lib/gestao-tripulantes/documentos-alertas';
import {
  listarIdsComStatusEscalaHoje,
  listarIdsEmbarcadosHoje,
  listarIdsStandbyHoje,
  overlayStatusEscalaHoje,
} from '@/lib/gestao-tripulantes/dashboard-service';
import { dataLocalISO } from '@/lib/gestao-tripulantes/aso-vencimentos';
import {
  coerceStatusEmbarqueLive,
  parseGtDashboardKpi,
} from '@/lib/gestao-tripulantes/embarque-status';
import {
  contarDocsPorStatusPrimario,
  idsComPrimarioVencido,
  type DocumentoAgrupavel,
} from '@/lib/gestao-tripulantes/documento-historico';
import { montarPayloadCadastro } from '@/lib/gestao-tripulantes/colaborador-cadastro';
import {
  MENSAGEM_CADASTRO_NEGADO,
  podeMutarCadastroColaborador,
} from '@/lib/gestao-tripulantes/colaborador-cadastro-auth';

const DOC_PENDENCY_SELECT =
  'id, colaborador_id, tipo_documento, subtipo, titulo, descricao, origem, numero_documento, numero_rastreio, data_emissao, data_validade, status_validacao, created_at';

type DocPendencyRow = DocumentoAgrupavel & {
  colaborador_id: string;
  numero_documento?: string | null;
  numero_rastreio?: string | null;
};

async function fetchDocumentosAgrupaveis(colaboradorIds: string[]): Promise<DocPendencyRow[]> {
  if (colaboradorIds.length === 0) return [];
  const docRows: DocPendencyRow[] = [];
  const docPageSize = 1000;
  let docFrom = 0;
  while (true) {
    const { data: pageDocs } = await supabaseAdmin
      .from('gt_documentos')
      .select(DOC_PENDENCY_SELECT)
      .in('colaborador_id', colaboradorIds)
      .is('deleted_at', null)
      .range(docFrom, docFrom + docPageSize - 1);
    const page = (pageDocs || []) as DocPendencyRow[];
    docRows.push(...page);
    if (page.length < docPageSize) break;
    docFrom += docPageSize;
  }
  return docRows;
}

export const dynamic = 'force-dynamic';

async function resolveNomeToId(table: string, nome: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from(table)
    .select('id')
    .eq('nome', nome)
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

/**
 * R8: resolve NOMES → ids paginado (db-max-rows=1000 trunca select sem range()).
 * Usado por `?embarcacoes=a,b,c` (filtro multi da Matriz). Contrato values-as-NAMES.
 */
async function resolveNomesToIds(table: string, nomes: string[]): Promise<string[] | { error: true }> {
  const found = new Set<string>();
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select('id')
      .in('nome', nomes)
      .range(from, from + pageSize - 1);
    if (error) {
      console.error(`Erro ao resolver nomes em ${table}:`, error);
      return { error: true };
    }
    const rows = (data || []) as { id?: string | null }[];
    for (const r of rows) {
      if (r?.id) found.add(String(r.id));
    }
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return Array.from(found);
}

export async function GET(request: NextRequest) {
  const t0 = Date.now();
  try {
    const authHeader = request.headers.get('authorization') || undefined;
    const token = extractTokenFromHeader(authHeader);
    if (!token) {
      return NextResponse.json({ error: 'Token de autorização necessário' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const cpfParam = searchParams.get('cpf');
    const lite = searchParams.get('lite') === '1';
    const empresa = searchParams.get('empresa');
    const embarcacao = searchParams.get('embarcacao');
    // R8: multi-embarcação (CSV de nomes). Compat: `embarcacao` (único) continua válido.
    const embarcacoesParam = searchParams.get('embarcacoes');
    const cargo = searchParams.get('cargo');
    const centroCusto = searchParams.get('centro_custo');
    const status = searchParams.get('status');
    const standby = searchParams.get('standby');
    const ativo = searchParams.get('ativo');
    const onlyVencidos = searchParams.get('onlyVencidos');
    const kpi = parseGtDashboardKpi(searchParams.get('kpi'));
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    const cpfLookup = cpfParam || (search && normalizeCpf(search).length === 11 ? search : null);
    let cpfMatchId: string | null = null;
    if (cpfLookup) {
      const found = await findColaboradorByCpf(cpfLookup);
      if (!found) {
        return NextResponse.json({
          success: true,
          data: [],
          pagination: { page: 1, limit, total: 0, totalPages: 0 },
        });
      }
      if (lite) {
        console.log(`[GT GET /colaboradores?cpf=lite] ${Date.now() - t0}ms`);
        return NextResponse.json({
          success: true,
          data: [{ id: found.id, nome_completo: found.nome_completo, cpf: found.cpf }],
          pagination: { page: 1, limit: 1, total: 1, totalPages: 1 },
        });
      }
      cpfMatchId = found.id;
    }

    const [empresaId, embarcacaoId, cargoId, centroId] = await Promise.all([
      empresa ? resolveNomeToId('gt_empresas', empresa) : Promise.resolve(null),
      embarcacao ? resolveNomeToId('gt_embarcacoes', embarcacao) : Promise.resolve(null),
      cargo ? resolveNomeToId('gt_cargos', cargo) : Promise.resolve(null),
      centroCusto ? resolveNomeToId('gt_centros_custo', centroCusto) : Promise.resolve(null),
    ]);

    if (empresa && !empresaId) {
      return NextResponse.json({ success: true, data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
    }

    let embarcacaoIds: string[] | null = null;
    if (embarcacoesParam !== null) {
      const nomes = Array.from(new Set(
        embarcacoesParam.split(',').map(s => s.trim()).filter(Boolean)
      ));
      if (nomes.length > 0) {
        const resolved = await resolveNomesToIds('gt_embarcacoes', nomes);
        if (!Array.isArray(resolved)) {
          return NextResponse.json({ error: 'Erro ao listar colaboradores' }, { status: 500 });
        }
        embarcacaoIds = resolved;
        if (embarcacaoIds.length === 0) {
          return NextResponse.json({ success: true, data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
        }
      }
    }

    let vencidoIds: string[] | null = null;
    if (onlyVencidos === 'true') {
      const hoje = dataLocalISO();
      const candidatoSet = new Set<string>();
      const pageSize = 1000;
      let from = 0;
      while (true) {
        const { data: vencidos, error: vencidosErr } = await supabaseAdmin
          .from('gt_documentos')
          .select('colaborador_id')
          .is('deleted_at', null)
          .not('data_validade', 'is', null)
          .lt('data_validade', hoje)
          .not('colaborador_id', 'is', null)
          .range(from, from + pageSize - 1);
        if (vencidosErr) {
          console.error('Erro ao filtrar documentos vencidos:', vencidosErr);
          return NextResponse.json({ error: 'Erro ao listar colaboradores' }, { status: 500 });
        }
        const rows = vencidos || [];
        for (const d of rows) {
          if (d.colaborador_id) candidatoSet.add(d.colaborador_id as string);
        }
        if (rows.length < pageSize) break;
        from += pageSize;
      }
      const candidatos = Array.from(candidatoSet);
      if (candidatos.length === 0) {
        return NextResponse.json({ success: true, data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
      }
      const docsCandidatos = await fetchDocumentosAgrupaveis(candidatos);
      vencidoIds = Array.from(idsComPrimarioVencido(docsCandidatos, hoje));
      if (vencidoIds.length === 0) {
        return NextResponse.json({ success: true, data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
      }
    }

    let query = supabaseAdmin
      .from('gt_colaboradores')
      .select(LIST_SELECT, { count: 'exact' })
      .is('deleted_at', null);

    if (cpfMatchId) {
      query = query.eq('id', cpfMatchId);
    } else if (search) {
      query = query.or(
        `nome_completo.ilike.%${search}%,matricula.ilike.%${search}%,cpf.ilike.%${search}%,email.ilike.%${search}%`
      );
    }

    if (empresaId) query = query.eq('empresa_id', empresaId);
    // R8: single (compat) AND multi — quando ambos vierem, interseção (AND).
    if (embarcacaoId) query = query.eq('embarcacao_atual_id', embarcacaoId);
    if (embarcacaoIds && embarcacaoIds.length > 0) query = query.in('embarcacao_atual_id', embarcacaoIds);
    if (cargoId) query = query.eq('cargo_id', cargoId);
    if (centroId) query = query.eq('centro_custo_id', centroId);
    // Legados com ativo NULL contam como ativos (equivale ao default true).
    if (ativo === 'true' || ativo === 'ativos' || ativo === 'ativo') query = query.or('ativo.eq.true,ativo.is.null');
    if (ativo === 'false' || ativo === 'inativos' || ativo === 'inativo') query = query.eq('ativo', false);

    let idFilter = vencidoIds;
    if (kpi === 'embarcados') {
      const pob = await listarIdsEmbarcadosHoje();
      if (pob.error) {
        console.error('Erro ao filtrar embarcados POB:', pob.error);
        return NextResponse.json({ error: 'Erro ao listar colaboradores' }, { status: 500 });
      }
      if (pob.ids.length === 0) {
        return NextResponse.json({ success: true, data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
      }
      if (idFilter) {
        const allowed = new Set(idFilter);
        idFilter = pob.ids.filter((id) => allowed.has(id));
      } else {
        idFilter = pob.ids;
      }
      if (idFilter.length === 0) {
        return NextResponse.json({ success: true, data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
      }
    }
    if (kpi === 'disponiveis' || standby === 'true') {
      const stb = await listarIdsStandbyHoje();
      if (stb.error) {
        console.error('Erro ao filtrar standby de hoje:', stb.error);
        return NextResponse.json({ error: 'Erro ao listar colaboradores' }, { status: 500 });
      }
      if (stb.ids.length === 0) {
        return NextResponse.json({ success: true, data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
      }
      if (idFilter) {
        const allowed = new Set(idFilter);
        idFilter = stb.ids.filter((id) => allowed.has(id));
      } else {
        idFilter = stb.ids;
      }
      if (idFilter.length === 0) {
        return NextResponse.json({ success: true, data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
      }
    } else if (standby === 'false') {
      const stb = await listarIdsStandbyHoje();
      if (stb.error) {
        console.error('Erro ao filtrar standby de hoje:', stb.error);
        return NextResponse.json({ error: 'Erro ao listar colaboradores' }, { status: 500 });
      }
      const stbSet = new Set(stb.ids);
      if (idFilter) {
        idFilter = idFilter.filter((id) => !stbSet.has(id));
        if (idFilter.length === 0) {
          return NextResponse.json({ success: true, data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
        }
      } else if (stb.ids.length > 0) {
        query = query.not('id', 'in', `(${stb.ids.join(',')})`);
      }
    }
    if (status && kpi !== 'embarcados' && kpi !== 'disponiveis') {
      const wanted = coerceStatusEmbarqueLive(status);
      if (wanted !== status.trim().toLowerCase()) {
        return NextResponse.json({ success: true, data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
      }
      const liveStatus = await listarIdsComStatusEscalaHoje(wanted);
      if (liveStatus.error) {
        console.error('Erro ao filtrar status de escala de hoje:', liveStatus.error);
        return NextResponse.json({ error: 'Erro ao listar colaboradores' }, { status: 500 });
      }
      if (liveStatus.ids.length === 0) {
        return NextResponse.json({ success: true, data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
      }
      if (idFilter) {
        const allowed = new Set(idFilter);
        idFilter = liveStatus.ids.filter((id) => allowed.has(id));
      } else {
        idFilter = liveStatus.ids;
      }
      if (idFilter.length === 0) {
        return NextResponse.json({ success: true, data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
      }
    }
    if (idFilter) query = query.in('id', idFilter);

    const { data: rows, error, count } = await query
      .order('nome_completo', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Erro ao listar colaboradores:', error);
      return NextResponse.json({ error: 'Erro ao listar colaboradores' }, { status: 500 });
    }

    const flattened = (rows || []).map((row) => flattenColaboradorRow(row as unknown as Record<string, unknown>));
    const ids = flattened.map((c) => c.id as string).filter(Boolean);

    const countsById: Record<string, { qtd_docs_vencidos: number; qtd_docs_vencendo: number; qtd_docs_validos: number }> = {};
    const docRows: DocPendencyRow[] = [];
    if (ids.length > 0) {
      const fetchedDocs = await fetchDocumentosAgrupaveis(ids);
      docRows.push(...fetchedDocs);
      const hoje = dataLocalISO();
      const byColab = new Map<string, DocPendencyRow[]>();
      for (const id of ids) {
        countsById[id] = { qtd_docs_vencidos: 0, qtd_docs_vencendo: 0, qtd_docs_validos: 0 };
        byColab.set(id, []);
      }
      for (const d of fetchedDocs) {
        byColab.get(d.colaborador_id)?.push(d);
      }
      for (const [id, list] of byColab) {
        const counts = contarDocsPorStatusPrimario(list, hoje);
        countsById[id] = {
          qtd_docs_vencidos: counts.qtd_docs_vencidos,
          qtd_docs_vencendo: counts.qtd_docs_vencendo,
          qtd_docs_validos: counts.qtd_docs_validos,
        };
      }
    }

    const nomes: Record<string, { nome: string | null; matricula: string | null; cpf: string | null }> = {};
    for (const c of flattened) {
      nomes[c.id as string] = {
        nome: (c.nome_completo as string) || null,
        matricula: (c.matricula as string) || null,
        cpf: (c.cpf as string) || null,
      };
    }
    const resumoVencidos = resumoVencidosVigentes(montarItensAlerta(docRows, nomes));

    const colaboradores = flattened.map((c) => ({
      ...c,
      id: c.id as string,
      ...(countsById[c.id as string] || { qtd_docs_vencidos: 0, qtd_docs_vencendo: 0, qtd_docs_validos: 0 }),
      docs_vencidos_resumo: resumoVencidos[c.id as string] || [],
    }));

    const overlay = await overlayStatusEscalaHoje(colaboradores);
    if (overlay.error) {
      console.error('Erro ao resolver status de escala de hoje:', overlay.error);
      return NextResponse.json({ error: 'Erro ao listar colaboradores' }, { status: 500 });
    }

    console.log(`[GT GET /colaboradores list] ${Date.now() - t0}ms n=${overlay.rows.length}`);

    return NextResponse.json({
      success: true,
      data: overlay.rows,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (error) {
    console.error('Erro na API colaboradores:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || undefined;
    const token = extractTokenFromHeader(authHeader);
    if (!token) {
      return NextResponse.json({ error: 'Token de autorização necessário' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const podeMutar = await podeMutarCadastroColaborador(payload.userId, payload.role);
    if (!podeMutar) {
      return NextResponse.json({ error: MENSAGEM_CADASTRO_NEGADO }, { status: 403 });
    }

    const body = await request.json();
    const montado = montarPayloadCadastro(body as Record<string, unknown>, 'create');
    if (!montado.ok) {
      return NextResponse.json({ error: montado.error }, { status: montado.status });
    }

    const existing = await findColaboradorByCpf(String(montado.data.cpf));
    if (existing) {
      return NextResponse.json({ error: 'CPF já cadastrado para outro colaborador' }, { status: 409 });
    }

    const { data: newColaborador, error: createError } = await supabaseAdmin
      .from('gt_colaboradores')
      .insert(montado.data)
      .select('*')
      .single();

    if (createError) {
      console.error('Erro ao criar colaborador:', createError);
      if (createError.code === '23505') {
        return NextResponse.json({ error: 'CPF já cadastrado para outro colaborador' }, { status: 409 });
      }
      return NextResponse.json({ error: createError.message || 'Erro ao criar colaborador' }, { status: 500 });
    }

    if (newColaborador && newColaborador.id) {
      // Enrich with MIO data in background
      const rawCpf = newColaborador.cpf || '';
      const cleanCpf = rawCpf.replace(/\D/g, '');

      if (cleanCpf) {
        enrichComMIOData(newColaborador.id, cleanCpf).catch(err => {
          console.error('[MIO Enrich] Failed:', err);
        });
      }

      // Run auto event generation in background
      autoGenerateESocialEvents(newColaborador.id).catch(err => {
        console.error('[eSocialAuto] Failed in background execution:', err);
      });
    }

    return NextResponse.json({
      success: true,
      data: newColaborador
    }, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar colaborador:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

async function enrichComMIOData(colaboradorId: string, cleanCpf: string): Promise<void> {
  try {
    // 1. Check mio_cache first
    let mioData: any = null;
    const { data: cacheRow } = await supabaseAdmin
      .from('mio_cache')
      .select('dados, atualizado_em')
      .eq('tipo', 'integrantes')
      .maybeSingle();

    const cacheData = cacheRow?.dados;
    if (Array.isArray(cacheData)) {
      mioData = cacheData.find((i: any) => {
        const c = (i.cpf || i.cpf_numero || '').replace(/\D/g, '');
        return c === cleanCpf;
      });
    }

    // 2. Local-only: never live-GET MIO on the request path.
    if (!mioData) {
      console.log(`[MIO Enrich] CPF ${cleanCpf} not in mio_cache. Runtime stays local; run admin MIO pull to refresh cache.`);
    }

    if (!mioData) {
      console.log(`[MIO Enrich] CPF ${cleanCpf} not found in MIO. Storing as manual-only.`);
      return;
    }

    // 3. Update collaborator with MIO data
    const updateFields: Record<string, any> = {
      origem: 'mio',
      mio_id: mioData.id ? String(mioData.id) : undefined,
      mio_data: mioData,
      matricula: mioData.matricula || undefined,
      email: mioData.email || undefined,
      telefone: mioData.celular || mioData.telefone || undefined,
      data_nascimento: mioData.data_nascimento || undefined,
      nome_mae: mioData.nome_mae || undefined,
      nome_pai: mioData.nome_pai || undefined,
      data_admissao: mioData.data_admissao || undefined,
      data_demissao: mioData.data_demissao || undefined,
      dados_bancarios: mioData.dados_bancarios || undefined,
      updated_at: new Date().toISOString(),
    };

    Object.keys(updateFields).forEach(k => {
      if (updateFields[k] === undefined) delete updateFields[k];
    });

    await supabaseAdmin
      .from('gt_colaboradores')
      .update(updateFields)
      .eq('id', colaboradorId);

    console.log(`[MIO Enrich] Collaborator ${colaboradorId} enriched with MIO data (ID: ${mioData.id})`);
  } catch (err) {
    console.error(`[MIO Enrich] Error enriching collaborator ${colaboradorId}:`, err);
  }
}
