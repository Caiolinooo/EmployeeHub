import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { mapDbTipoToCodigo, normalizeCpf } from '@/lib/gestao-tripulantes/escala-tipos';
import {
    manScheduleCacheGeneration,
    manScheduleResultCache,
} from '@/lib/gestao-tripulantes/man-schedule-cache';

export const dynamic = 'force-dynamic';

interface ScheduleEntry {
    id: string;
    cpf: string;
    matricula?: string;
    centro_custo?: string;
    full_name: string;
    position: string;
    vessel: string;
    company: string;
    rotation_start: string | null;
    rotation_end: string | null;
    embarque_status: string | null;
    local_embarque: string;
    /** Stable schedule codigo: normal | fi | dba | stb | offc | custom */
    rotation_type: string;
    /** Explicit observations (local events); never mixed into embarque_status */
    observacoes: string | null;
    tipo_codigo: string;
    origem?: 'mio' | 'local';
    ativo?: boolean;
    exibir_dia_inicio?: boolean;
}

// ---------------------------------------------------------------------------
// Performance infrastructure
// ---------------------------------------------------------------------------

/** TTL of the in-memory computed-result cache (ms). */
const RESULT_CACHE_TTL_MS = 90_000;

/**
 * Janela presets: how far back / forward rotations are processed.
 * Default `90d` keeps past 45d + future 180d, which covers the rendered grid
 * without walking years of historical LGP records.
 */
const JANELA_PRESETS: Record<string, { pastDays: number; futureDays: number }> = {
    '30d': { pastDays: 15, futureDays: 60 },
    '90d': { pastDays: 45, futureDays: 180 },
    '180d': { pastDays: 90, futureDays: 360 },
    '365d': { pastDays: 180, futureDays: 540 },
    all: { pastDays: Number.POSITIVE_INFINITY, futureDays: Number.POSITIVE_INFINITY },
};
const DEFAULT_JANELA = '90d';

interface ResultCacheEntry {
    payload: Record<string, unknown>;
    /** Signature of gt_historico_embarques + colaboradores used to build the payload. */
    mioSignature: string;
    builtAt: number;
}

/** janela key -> computed payload cache (shared so POST embarques can bust). */
const resultCache = manScheduleResultCache() as Map<string, ResultCacheEntry>;

function colabEmbarcacaoNome(colab: {
    embarcacao_atual?: { nome?: string } | { nome?: string }[] | null;
}): string {
    const e = colab.embarcacao_atual;
    if (Array.isArray(e)) return (e[0]?.nome || '').trim();
    return (e?.nome || '').trim();
}

function parseDate(str: string | null): Date | null {
    if (!str || str.trim() === '') return null;
    const clean = str.trim().slice(0, 10);
    const parts = clean.split('-');
    if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        const parsed = new Date(y, m, d, 0, 0, 0, 0);
        if (!isNaN(parsed.getTime())) return parsed;
    }
    const fallback = new Date(str);
    return isNaN(fallback.getTime()) ? null : fallback;
}

/** Tolerant date parse for MIO values that may already include time/ISO info. */
function parseFlexibleDate(value: unknown): Date | null {
    if (!value || typeof value !== 'string' || value.trim() === '') return null;
    const str = value.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
        return parseDate(str.slice(0, 10));
    }
    const direct = new Date(str);
    if (!isNaN(direct.getTime())) return direct;
    return parseDate(str.slice(0, 10));
}

/** True when [start,end] overlaps the processing window (end fallback: start+90d). */
function rotationOverlapsWindow(
    startStr: string | null,
    endStr: string | null,
    windowStart: number,
    windowEnd: number
): boolean {
    if (!startStr && !endStr) return true; // undated entries always kept
    const start = startStr ? parseFlexibleDate(startStr)?.getTime() ?? windowEnd : windowEnd;
    let end = endStr ? parseFlexibleDate(endStr)?.getTime() ?? NaN : NaN;
    if (isNaN(end)) {
        end = isNaN(start) ? windowStart : start + 90 * 24 * 60 * 60 * 1000;
    }
    return start <= windowEnd && end >= windowStart;
}

/**
 * PostgREST devolve no máximo 1000 linhas por requisição (db-max-rows) e
 * trunca em silêncio — com 2800+ linhas vivas em gt_historico_embarques, as
 * mais recentes (toda marcação nova) ficavam de fora da resposta e o grid
 * apagava a célula 1s depois do save. Pagina até esgotar.
 */
type Paged<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

async function selectAllPaged<T>(
    // PromiseLike: PostgrestFilterBuilder é thenable (não expõe catch/finally),
    // então o builder pode ser passado direto sem `await` no callback.
    page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<{ data: T[]; error: { message: string } | null }> {
    const PAGE_SIZE = 1000;
    const MAX_PAGES = 20; // 20k linhas — folga além de qualquer janela atual
    const out: T[] = [];
    for (let i = 0; i < MAX_PAGES; i++) {
        const from = i * PAGE_SIZE;
        const { data, error } = await page(from, from + PAGE_SIZE - 1);
        if (error) return { data: out, error };
        if (data?.length) out.push(...data);
        if (!data || data.length < PAGE_SIZE) break;
    }
    return { data: out, error: null };
}

/** Linha de gt_colaboradores consumida pelo builder da escala. */
interface ColaboradorGtRow {
    id: string;
    cpf: string | null;
    nome_completo: string | null;
    ativo: boolean | null;
    matricula?: string | null;
    cargo?: { nome?: string } | null;
    empresa?: { nome?: string } | null;
    embarcacao_atual?: { nome?: string } | { nome?: string }[] | null;
    centro_custo?: { codigo?: string; nome?: string } | null;
    cargo_id?: string | null;
    empresa_id?: string | null;
    embarcacao_atual_id?: string | null;
    centro_custo_id?: string | null;
}

/**
 * Select de gt_colaboradores com embeds relacionais — mesmo padrão comprovado de
 * LIST_SELECT em src/lib/gestao-tripulantes/colaborador-get.ts. Se o embed
 * quebrar no PostgREST (relacionamento ausente/ambíguo), refaz o select plano e
 * enriquece com lookups separados nas tabelas de dimensão.
 */
const COLAB_SELECT_EMBED = `
    id, cpf, nome_completo, ativo, matricula,
    cargo:gt_cargos(nome),
    empresa:gt_empresas(nome),
    embarcacao_atual:gt_embarcacoes!embarcacao_atual_id(nome),
    centro_custo:gt_centros_custo(codigo, nome)
`.replace(/\s+/g, ' ').trim();

const COLAB_SELECT_FLAT = `
    id, cpf, nome_completo, ativo, matricula,
    cargo_id, empresa_id, embarcacao_atual_id, centro_custo_id
`.replace(/\s+/g, ' ').trim();

async function fetchColaboradoresGT(): Promise<{ data: ColaboradorGtRow[]; error: { message: string } | null }> {
    const embedded = await selectAllPaged<ColaboradorGtRow>((from, to) =>
        supabaseAdmin
            .from('gt_colaboradores')
            // Select computado (join de linhas): postgrest-js tipa string dinâmica
            // como GenericStringError[]; o cast repõe o tipo real da projeção.
            .select(COLAB_SELECT_EMBED)
            .is('deleted_at', null)
            .order('id')
            .range(from, to) as unknown as Paged<ColaboradorGtRow>
    );
    if (!embedded.error) return embedded;

    console.warn(
        '[ManSchedule] select de gt_colaboradores com embed falhou; refazendo sem embed:',
        embedded.error.message
    );
    const flat = await selectAllPaged<ColaboradorGtRow>((from, to) =>
        supabaseAdmin
            .from('gt_colaboradores')
            .select(COLAB_SELECT_FLAT)
            .is('deleted_at', null)
            .order('id')
            .range(from, to) as unknown as Paged<ColaboradorGtRow>
    );
    if (flat.error || flat.data.length === 0) return flat;

    // 4+ chamadas com o mesmo comportamento: ids únicos não-nulos por FK.
    // PostgREST rejeita .in('id', []) (400) — com nenhum id, pula a query.
    const uniqIds = (vals: Array<string | null | undefined>): string[] =>
        Array.from(new Set(vals.filter((v): v is string => typeof v === 'string' && v.length > 0)));
    const noRows = Promise.resolve({ data: [] as never[], error: null });
    const cargoIds = uniqIds(flat.data.map((c) => c.cargo_id));
    const empresaIds = uniqIds(flat.data.map((c) => c.empresa_id));
    const embarcacaoIds = uniqIds(flat.data.map((c) => c.embarcacao_atual_id));
    const centroIds = uniqIds(flat.data.map((c) => c.centro_custo_id));
    const [cargosRes, empresasRes, embarcacoesRes, centrosRes] = await Promise.all([
        cargoIds.length ? supabaseAdmin.from('gt_cargos').select('id, nome').in('id', cargoIds) : noRows,
        empresaIds.length ? supabaseAdmin.from('gt_empresas').select('id, nome').in('id', empresaIds) : noRows,
        embarcacaoIds.length ? supabaseAdmin.from('gt_embarcacoes').select('id, nome').in('id', embarcacaoIds) : noRows,
        centroIds.length ? supabaseAdmin.from('gt_centros_custo').select('id, codigo, nome').in('id', centroIds) : noRows,
    ]);
    const lookups: Array<[string, { error: { message: string } | null }]> = [
        ['cargos', cargosRes],
        ['empresas', empresasRes],
        ['embarcacoes', embarcacoesRes],
        ['centros_custo', centrosRes],
    ];
    for (const [label, res] of lookups) {
        if (res.error) console.error(`[ManSchedule] lookup ${label}:`, res.error.message);
    }
    const cargoById = new Map((cargosRes.data || []).map((r) => [r.id, r]));
    const empresaById = new Map((empresasRes.data || []).map((r) => [r.id, r]));
    const embarcacaoById = new Map((embarcacoesRes.data || []).map((r) => [r.id, r]));
    const centroById = new Map((centrosRes.data || []).map((r) => [r.id, r]));

    const data = flat.data.map((c) => ({
        ...c,
        cargo: (c.cargo_id ? cargoById.get(c.cargo_id) : null) || null,
        empresa: (c.empresa_id ? empresaById.get(c.empresa_id) : null) || null,
        embarcacao_atual: (c.embarcacao_atual_id ? embarcacaoById.get(c.embarcacao_atual_id) : null) || null,
        centro_custo: (c.centro_custo_id ? centroById.get(c.centro_custo_id) : null) || null,
    }));
    return { data, error: null };
}


export async function GET(request: NextRequest) {
    const t0 = Date.now();
    try {
        let token: string | null = null;
        const authHeader = request.headers.get('authorization') || undefined;
        if (authHeader) {
            token = extractTokenFromHeader(authHeader);
        }
        if (!token) {
            token = request.cookies.get('abzToken')?.value || request.cookies.get('token')?.value || null;
        }

        if (!token) {
            return NextResponse.json({ error: 'Token de autorização necessário' }, { status: 401 });
        }

        const payload = verifyToken(token);
        if (!payload) {
            return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
        }

        // ---- Janela filter (?janela=90d default; backward compatible when absent)
        const janelaParam = (request.nextUrl.searchParams.get('janela') || DEFAULT_JANELA).toLowerCase();
        const preset = JANELA_PRESETS[janelaParam] || JANELA_PRESETS[DEFAULT_JANELA];
        const nowMs = Date.now();
        const dayMs = 24 * 60 * 60 * 1000;
        const windowStart = nowMs - preset.pastDays * dayMs;
        const windowEnd = nowMs + preset.futureDays * dayMs;

        const timings: Record<string, number> = {};

        // ---- Stage 1: cheap freshness probe of gt_* (canonical, not mio_cache blobs)
        // Resiliente: coluna ausente (ex.: updated_at em gt_historico_embarques) ou
        // falha do probe NÃO derruba o endpoint — freshness fica 'unknown', o cache
        // é ignorado neste ciclo e segue o fetch completo.
        const probeStart = Date.now();
        let embCount: number | null = null;
        let colCount: number | null = null;
        let afastCount: number | null = null;
        let stampUpdated = 'unknown';
        let stampCreated = 'unknown';
        let stampAfast = 'unknown';
        let probeOk = true;
        try {
            const [embCountRes, embUpdatedRes, embCreatedRes, colCountRes, afastRes] = await Promise.all([
                supabaseAdmin
                    .from('gt_historico_embarques')
                    .select('id', { count: 'exact', head: true })
                    .is('deleted_at', null),
                supabaseAdmin
                    .from('gt_historico_embarques')
                    .select('updated_at, created_at')
                    .is('deleted_at', null)
                    .order('updated_at', { ascending: false, nullsFirst: false })
                    .limit(1),
                supabaseAdmin
                    .from('gt_historico_embarques')
                    .select('created_at')
                    .is('deleted_at', null)
                    .order('created_at', { ascending: false })
                    .limit(1),
                supabaseAdmin
                    .from('gt_colaboradores')
                    .select('id', { count: 'exact', head: true })
                    .is('deleted_at', null),
                supabaseAdmin
                    .from('gt_afastamentos')
                    .select('updated_at', { count: 'exact' })
                    .is('deleted_at', null)
                    .order('updated_at', { ascending: false, nullsFirst: false })
                    .limit(1),
            ]);
            embCount = embCountRes.count ?? null;
            colCount = colCountRes.count ?? null;
            afastCount = afastRes.count ?? null;
            if (embCountRes.error || colCountRes.error) {
                probeOk = false;
                console.warn('[ManSchedule] probe de contagens falhou:', embCountRes.error?.message || colCountRes.error?.message);
            }
            if (embUpdatedRes.error) {
                probeOk = false;
                console.warn('[ManSchedule] probe updated_at (embarques) falhou:', embUpdatedRes.error.message);
            } else {
                stampUpdated = embUpdatedRes.data?.[0]?.updated_at || embUpdatedRes.data?.[0]?.created_at || 'none';
            }
            if (embCreatedRes.error) {
                probeOk = false;
                console.warn('[ManSchedule] probe created_at (embarques) falhou:', embCreatedRes.error.message);
            } else {
                stampCreated = embCreatedRes.data?.[0]?.created_at || 'none';
            }
            if (afastRes.error) {
                probeOk = false;
                console.warn('[ManSchedule] probe updated_at (afastamentos) falhou:', afastRes.error.message);
            } else {
                stampAfast = afastRes.data?.[0]?.updated_at || 'none';
            }
        } catch (probeError) {
            probeOk = false;
            console.warn('[ManSchedule] probe de freshness falhou; seguindo sem cache:', probeError);
        }
        timings.probe = Date.now() - probeStart;
        const mioSignature = `gt_emb:${embCount ?? 0}:${stampUpdated}:${stampCreated}:g${manScheduleCacheGeneration()}|gt_col:${colCount ?? 0}|gt_afast:${afastCount ?? 0}:${stampAfast}`;

        // ---- Stage 2: in-memory cache (same TTL; lazy-load UI unchanged)
        const cachedEntry = resultCache.get(janelaParam);
        if (
            probeOk &&
            cachedEntry &&
            cachedEntry.mioSignature === mioSignature &&
            Date.now() - cachedEntry.builtAt < RESULT_CACHE_TTL_MS
        ) {
            timings.cacheRead = Date.now() - probeStart;
            const ageS = Math.round((Date.now() - cachedEntry.builtAt) / 1000);
            console.log(
                `[ManSchedule] CACHE HIT janela=${janelaParam} age=${ageS}s total=${timings.cacheRead}ms (probe ${timings.probe}ms)`
            );
            const hitPayload = {
                ...(cachedEntry.payload as Record<string, unknown>),
                meta: {
                    ...((cachedEntry.payload as { meta?: Record<string, unknown> }).meta || {}),
                    cached: true,
                    cache_age_s: ageS,
                    janela: janelaParam,
                    source: 'gt_historico_embarques',
                    timings_ms: { ...timings },
                },
            };
            return NextResponse.json(hitPayload);
        }
        timings.cacheMissCheck = Date.now() - probeStart;
        console.log(
            `[ManSchedule] Cache miss (janela=${janelaParam}, signature=${cachedEntry ? 'stale' : 'empty'}) — rebuilding from gt_*`
        );

        const isAllJanela = !Number.isFinite(preset.pastDays) || janelaParam === 'all' || janelaParam === 'full';
        const fromDate = isAllJanela ? '1990-01-01' : new Date(windowStart).toISOString().slice(0, 10);
        const toDate = isAllJanela ? '2099-12-31' : new Date(windowEnd).toISOString().slice(0, 10);
        const lookback = isAllJanela ? '1990-01-01' : new Date(windowStart - 180 * dayMs).toISOString().slice(0, 10);

        const blobStart = Date.now();
        const [{ data: colabs, error: colErr }, { data: embarques, error: embErr }, { data: afastamentosRows, error: afastErr }] = await Promise.all([
            fetchColaboradoresGT(),
            selectAllPaged((from, to) => {
                let embQuery = supabaseAdmin
                    .from('gt_historico_embarques')
                    .select(`
                        id, colaborador_id, tipo, data_embarque, data_desembarque,
                        data_prevista_desembarque, local_embarque, local_desembarque,
                        observacoes, origem, mio_embarque_id, exibir_dia_inicio
                    `)
                    .is('deleted_at', null)
                    .order('id');
                if (!isAllJanela) {
                    embQuery = embQuery.gte('data_embarque', lookback).lte('data_embarque', toDate);
                }
                return embQuery.range(from, to);
            }),
            selectAllPaged((from, to) =>
                supabaseAdmin
                    .from('gt_afastamentos')
                    .select('id, colaborador_id, tipo_afastamento, data_inicio, data_fim, data_prevista_retorno, motivo, observacoes')
                    .is('deleted_at', null)
                    .order('id')
                    .range(from, to)
            ),
        ]);
        timings.blobRead = Date.now() - blobStart;

        // Erro de query é falha, não sucesso vazio: colErr sempre 500 (sem
        // colaboradores o builder descarta todo o resto); embErr/afastErr 500
        // quando as outras fontes também estiverem vazias.
        if (colErr) {
            console.error('[ManSchedule] colaboradores:', colErr.message);
            return NextResponse.json(
                { success: false, error: `Falha ao ler gt_colaboradores: ${colErr.message}`, refreshing: false },
                { status: 500 }
            );
        }
        if (embErr) console.error('[ManSchedule] embarques:', embErr.message);
        if (afastErr) console.error('[ManSchedule] afastamentos:', afastErr.message);

        const colaboradores = colabs || [];
        const hist = embErr ? [] : (embarques || []);
        const afastamentos = afastErr ? [] : (afastamentosRows || []);
        if ((embErr || afastErr) && colaboradores.length === 0 && hist.length === 0 && afastamentos.length === 0) {
            const detalhe = (embErr || afastErr)?.message || 'erro desconhecido';
            return NextResponse.json(
                { success: false, error: `Falha ao ler dados da escala (gt_*): ${detalhe}`, refreshing: false },
                { status: 500 }
            );
        }
        if (colaboradores.length === 0 && hist.length === 0 && afastamentos.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Sem dados locais. Execute o pull admin /api/gestao-tripulantes/mio/sync.',
                    refreshing: false,
                },
                { status: 503 }
            );
        }

        const buildStart = Date.now();
        const colabById = new Map<string, (typeof colaboradores)[number]>();
        for (const c of colaboradores) colabById.set(c.id, c);

        const schedules: ScheduleEntry[] = [];
        const seenColabInWindow = new Set<string>();
        let lgpSkippedByWindow = 0;

        for (const entry of hist) {
            const start = entry.data_embarque;
            const end = entry.data_desembarque || entry.data_prevista_desembarque;
            if (!isAllJanela && !rotationOverlapsWindow(start, end, windowStart, windowEnd)) {
                lgpSkippedByWindow++;
                continue;
            }
            const colab = colabById.get(entry.colaborador_id);
            if (!colab) continue;
            seenColabInWindow.add(colab.id);
            const rotType = mapDbTipoToCodigo(entry.tipo);
            const cpfNorm = normalizeCpf(colab.cpf || '');
            const origem: 'mio' | 'local' = entry.origem === 'local' ? 'local' : 'mio';
            const ccObj = (colab as any).centro_custo;
            const ccNome = ccObj ? `${ccObj.codigo ? `${ccObj.codigo} - ` : ''}${ccObj.nome || ''}` : '';
            schedules.push({
                id: entry.id,
                cpf: cpfNorm,
                matricula: (colab as any).matricula || '',
                centro_custo: ccNome,
                full_name: (colab.nome_completo || '').toUpperCase().trim(),
                position: ((colab as { cargo?: { nome?: string } }).cargo?.nome || '').toUpperCase().trim(),
                vessel: (entry.local_desembarque || colabEmbarcacaoNome(colab)).trim(),
                company: ((colab as { empresa?: { nome?: string } }).empresa?.nome || '').trim(),
                rotation_start: start,
                rotation_end: end,
                embarque_status: origem === 'local' ? 'Manual' : null,
                local_embarque: (entry.local_embarque || '').trim(),
                rotation_type: rotType,
                observacoes: (entry.observacoes || '').trim() || null,
                tipo_codigo: rotType,
                origem,
                ativo: colab.ativo !== false,
                exibir_dia_inicio: Boolean((entry as { exibir_dia_inicio?: boolean }).exibir_dia_inicio),
            });
        }

        // Integrar afastamentos e férias no cronograma
        for (const af of afastamentos) {
            const start = af.data_inicio;
            const end = af.data_fim || af.data_prevista_retorno;
            if (!isAllJanela && !rotationOverlapsWindow(start, end, windowStart, windowEnd)) {
                continue;
            }
            const colab = colabById.get(af.colaborador_id);
            if (!colab) continue;
            seenColabInWindow.add(colab.id);
            const isFerias = String(af.tipo_afastamento || '').toLowerCase().includes('ferias') || String(af.tipo_afastamento || '').toLowerCase().includes('férias');
            const rotType = isFerias ? 'ferias' : 'afastamento';
            const cpfNorm = normalizeCpf(colab.cpf || '');
            const ccObj = (colab as any).centro_custo;
            const ccNome = ccObj ? `${ccObj.codigo ? `${ccObj.codigo} - ` : ''}${ccObj.nome || ''}` : '';
            schedules.push({
                id: af.id,
                cpf: cpfNorm,
                matricula: (colab as any).matricula || '',
                centro_custo: ccNome,
                full_name: (colab.nome_completo || '').toUpperCase().trim(),
                position: ((colab as { cargo?: { nome?: string } }).cargo?.nome || '').toUpperCase().trim(),
                vessel: colabEmbarcacaoNome(colab),
                company: ((colab as { empresa?: { nome?: string } }).empresa?.nome || '').trim(),
                rotation_start: start,
                rotation_end: end,
                embarque_status: isFerias ? 'Férias' : 'Afastado',
                local_embarque: '',
                rotation_type: rotType,
                observacoes: (af.motivo || af.observacoes || '').trim() || null,
                tipo_codigo: rotType,
                origem: 'local',
                ativo: colab.ativo !== false,
                exibir_dia_inicio: false,
            });
        }

        for (const colab of colaboradores) {
            if (seenColabInWindow.has(colab.id)) continue;
            const cpfNorm = normalizeCpf(colab.cpf || '');
            const ccObj = (colab as any).centro_custo;
            const ccNome = ccObj ? `${ccObj.codigo ? `${ccObj.codigo} - ` : ''}${ccObj.nome || ''}` : '';
            schedules.push({
                id: colab.id,
                cpf: cpfNorm,
                matricula: (colab as any).matricula || '',
                centro_custo: ccNome,
                full_name: (colab.nome_completo || '').toUpperCase().trim(),
                position: ((colab as { cargo?: { nome?: string } }).cargo?.nome || '').toUpperCase().trim(),
                vessel: colabEmbarcacaoNome(colab),
                company: ((colab as { empresa?: { nome?: string } }).empresa?.nome || '').trim(),
                rotation_start: null,
                rotation_end: null,
                embarque_status: null,
                local_embarque: '',
                rotation_type: 'normal',
                observacoes: null,
                tipo_codigo: 'normal',
                origem: 'mio',
                ativo: colab.ativo !== false,
                exibir_dia_inicio: false,
            });
        }
        timings.build = Date.now() - buildStart;
        timings.localMerge = 0;

        const vessels = Array.from(new Set(schedules.map((s) => s.vessel).filter(Boolean))).sort();
        const positions = Array.from(new Set(schedules.map((s) => s.position).filter(Boolean))).sort();
        const companies = Array.from(new Set(schedules.map((s) => s.company).filter(Boolean))).sort();

        const totalMs = Date.now() - t0;
        console.log(
            `[ManSchedule] gt_* (ms): probe=${timings.probe} read=${timings.blobRead} build=${timings.build} TOTAL=${totalMs}` +
                (lgpSkippedByWindow > 0 ? ` | fora da janela=${lgpSkippedByWindow}` : '')
        );

        const responseBody = {
            success: true,
            count: schedules.length,
            data: schedules,
            meta: {
                vessels,
                positions,
                companies,
                cached: false,
                janela: janelaParam,
                source: 'gt_historico_embarques',
                window: { from: fromDate, to: toDate },
                timings_ms: { ...timings, total: totalMs },
            },
        };

        // Com probe degradado (freshness 'unknown') não gravamos no cache: a
        // assinatura não reflete o estado real do banco.
        if (probeOk) {
            resultCache.set(janelaParam, {
                payload: responseBody,
                mioSignature,
                builtAt: Date.now(),
            });
        }

        return NextResponse.json(responseBody);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('[ManSchedule API error]', error);
        return NextResponse.json({
            success: false,
            error: 'Falha ao buscar escala local (gt_historico_embarques).',
            message,
        }, { status: 500 });
    }
}
