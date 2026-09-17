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
        const probeStart = Date.now();
        const [{ count: embCount }, { data: embUpdated }, { data: embCreated }, { count: colCount }, { count: afastCount, data: afastUpdated }] = await Promise.all([
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
        timings.probe = Date.now() - probeStart;
        const stampUpdated = embUpdated?.[0]?.updated_at || embUpdated?.[0]?.created_at || 'none';
        const stampCreated = embCreated?.[0]?.created_at || 'none';
        const stampAfast = afastUpdated?.[0]?.updated_at || 'none';
        const mioSignature = `gt_emb:${embCount ?? 0}:${stampUpdated}:${stampCreated}:g${manScheduleCacheGeneration()}|gt_col:${colCount ?? 0}|gt_afast:${afastCount ?? 0}:${stampAfast}`;

        // ---- Stage 2: in-memory cache (same TTL; lazy-load UI unchanged)
        const cachedEntry = resultCache.get(janelaParam);
        if (
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
            selectAllPaged((from, to) =>
                supabaseAdmin
                    .from('gt_colaboradores')
                    .select(`
                        id, cpf, nome_completo, ativo, matricula,
                        cargo:gt_cargos(nome),
                        empresa:gt_empresas(nome),
                        embarcacao_atual:gt_embarcacoes!embarcacao_atual_id(nome),
                        centro_custo:gt_centros_custo(codigo, nome)
                    `)
                    .is('deleted_at', null)
                    .order('id')
                    .range(from, to)
            ),
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

        if (colErr) console.error('[ManSchedule] colaboradores:', colErr.message);
        if (embErr) console.error('[ManSchedule] embarques:', embErr.message);
        if (afastErr) console.error('[ManSchedule] afastamentos:', afastErr.message);

        const colaboradores = colabs || [];
        const hist = embarques || [];
        const afastamentos = afastamentosRows || [];
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

        resultCache.set(janelaParam, {
            payload: responseBody,
            mioSignature,
            builtAt: Date.now(),
        });

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
