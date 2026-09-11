'use client';

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { FiDownload, FiSearch, FiMessageSquare, FiMove, FiCheckSquare } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { useI18n } from '@/contexts/I18nContext';
import { fetchWithToken } from '@/lib/tokenStorage';
import ModalAprovacaoFechamento from '@/components/gestao-tripulantes/ModalAprovacaoFechamento';
import SearchableCreatableSelect from '@/components/gestao-tripulantes/SearchableCreatableSelect';
import ScheduleDateFilterInput from '@/components/gestao-tripulantes/ScheduleDateFilterInput';
import ManScheduleTimelineNav from '@/components/gestao-tripulantes/ManScheduleTimelineNav';
import {
    MAN_SCHEDULE_SCROLL_CLASS,
    MAN_SCHEDULE_STICKY_EDGE_CLASS,
    MAN_SCHEDULE_STICKY_NAME_CLASS,
    MAN_SCHEDULE_TABLE_CLASS,
    MAN_SCHEDULE_THEAD_CLASS,
    MAN_SCHEDULE_TOP_SCROLL_CLASS,
} from '@/components/gestao-tripulantes/man-schedule-grid-classes';
import { useManScheduleScrollSync } from '@/components/gestao-tripulantes/use-man-schedule-scroll-sync';
import {
    DEFAULT_TIPOS_EVENTO_ESCALA,
    hexToRgbNoHash,
    normalizeCpf,
    type GTTipoEventoEscala,
} from '@/lib/gestao-tripulantes/escala-tipos';
import { pickOverlappingRotation } from '@/lib/gestao-tripulantes/escala-contagem';
import {
    civilTodayYmd,
    countPobOnCivilDay,
    isEmbarcadoPobDayCode,
    isRotacaoPrevista,
    scheduleDisplayCode,
    type GtDashboardKpi,
} from '@/lib/gestao-tripulantes/embarque-status';
import {
    adjacentColumnIndex,
    readVisibleColumnIndex,
    scrollScheduleColumnIntoView,
} from '@/lib/gestao-tripulantes/man-schedule-nav';
import {
    buildScheduleColumns,
    civilReferenceMonth,
    clampReferenceMonth,
    columnPeriod,
    focusColumnIndex,
    formatReferenceMonthLabel,
    indexOfCivilDay,
    isSameReferenceMonth,
    persistReferenceMonthPreference,
    readReferenceMonthPreference,
    parseCivilYmd,
    shiftReferenceMonth,
    type ReferenceMonth,
    type ScheduleViewport,
} from '@/lib/gestao-tripulantes/man-schedule-reference-month';
import {
    parseCompleteFilterDate,
} from '@/lib/gestao-tripulantes/filter-date';

interface CrewSchedule {
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
    rotation_type: string;
    observacoes?: string | null;
    tipo_codigo?: string;
    origem?: 'mio' | 'local';
    ativo?: boolean;
    exibir_dia_inicio?: boolean;
}

interface RotationCell {
    id: string;
    start: string | null;
    end: string | null;
    type: string;
    vessel: string;
    observacoes?: string | null;
    local_embarque?: string;
    exibir_dia_inicio?: boolean;
    origem?: 'mio' | 'local';
}

interface Props {
    onColabClick: (colaborador: any) => void;
    kpiFilter?: GtDashboardKpi | '';
}

const POSITION_ORDER: string[] = [
    'CHEF MANAGER',
    'DAY / NIGHT CHEF',
    'DAY/NIGHT CHEF',
    'ASST. COOK',
    'ASST.COOK',
    'BAKER',
    'LEAD STEWARD',
    'STEWARD',
    'LAUNDRY',
    'GALLEY HAND',
];

function normalizePosition(pos: string): string {
    return pos.toUpperCase().replace(/\s+/g, ' ').trim();
}

function getPositionSortKey(pos: string): number {
    const norm = normalizePosition(pos);
    const idx = POSITION_ORDER.findIndex((p) => norm.includes(p) || p.includes(norm));
    return idx >= 0 ? idx : 999;
}

function isUuid(id: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function sameCpf(a?: string | null, b?: string | null): boolean {
    const left = normalizeCpf(a || '');
    const right = normalizeCpf(b || '');
    return left.length === 11 && left === right;
}

/** allSchedules is a flat list of rotations — never write `row.rotations`. */
function applyRotationRow(
    prev: CrewSchedule[],
    cpf: string,
    rot: RotationCell,
    mode: 'upsert' | 'delete',
    replaceId?: string | null,
): CrewSchedule[] {
    const digits = normalizeCpf(cpf);

    if (mode === 'delete' && replaceId) {
        const next = prev.filter((row) => row.id !== replaceId);
        if (next.some((row) => sameCpf(row.cpf, digits))) return next;
        const template = prev.find((row) => sameCpf(row.cpf, digits));
        if (!template) return next;
        return [
            ...next,
            {
                ...template,
                id: template.id || digits,
                rotation_start: null,
                rotation_end: null,
                embarque_status: null,
                observacoes: null,
            },
        ];
    }

    const template = prev.find((row) => sameCpf(row.cpf, digits));
    const payload = (base?: CrewSchedule): CrewSchedule => ({
        id: rot.id,
        cpf: digits || base?.cpf || '',
        matricula: base?.matricula,
        centro_custo: base?.centro_custo,
        full_name: base?.full_name || '',
        position: base?.position || '',
        vessel: rot.vessel || base?.vessel || '',
        company: base?.company || '',
        rotation_start: rot.start,
        rotation_end: rot.end,
        embarque_status: 'Manual',
        local_embarque: rot.local_embarque || '',
        rotation_type: rot.type,
        observacoes: rot.observacoes || null,
        tipo_codigo: rot.type,
        origem: 'local',
        ativo: base?.ativo !== false,
        exibir_dia_inicio: rot.exibir_dia_inicio,
    });

    if (replaceId) {
        let found = false;
        const mapped = prev.map((row) => {
            if (row.id !== replaceId) return row;
            found = true;
            return payload(row);
        });
        if (found) return mapped;
    }

    if (prev.some((row) => row.id === rot.id)) {
        return prev.map((row) => (row.id === rot.id ? payload(row) : row));
    }

    const stubIdx = prev.findIndex(
        (row) => sameCpf(row.cpf, digits) && !row.rotation_start && !row.rotation_end
    );
    if (stubIdx >= 0) {
        return prev.map((row, i) => (i === stubIdx ? payload(row) : row));
    }

    return [...prev, payload(template)];
}

const VIEWPORT_STORAGE_KEY = 'gt-man-schedule-viewport-day';

function readViewportDayPreference(): boolean {
    if (typeof window === 'undefined') return false;
    try {
        return window.localStorage.getItem(VIEWPORT_STORAGE_KEY) === '1';
    } catch {
        return false;
    }
}

function persistViewportDayPreference(checked: boolean): void {
    try {
        window.localStorage.setItem(VIEWPORT_STORAGE_KEY, checked ? '1' : '0');
    } catch {
        // private mode / quota
    }
}

function formatLocalYmd(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function cellPeriodTooltip(viewport: ScheduleViewport, formattedDate: string): string {
    switch (viewport) {
        case 'day':
            return `no dia ${formattedDate}`;
        case 'week':
            return `na semana de ${formattedDate}`;
        default: {
            const _never: never = viewport;
            return _never;
        }
    }
}

const SCHEDULE_CACHE_TTL_MS = 60_000;
let scheduleCache: { fetchedAt: number; data: CrewSchedule[] } | null = null;
let scheduleInflight: Promise<CrewSchedule[]> | null = null;

async function loadScheduleRows(force = false): Promise<CrewSchedule[]> {
    if (force) {
        scheduleCache = null;
    }
    if (!force && scheduleCache && Date.now() - scheduleCache.fetchedAt < SCHEDULE_CACHE_TTL_MS) {
        return scheduleCache.data;
    }
    if (scheduleInflight) return scheduleInflight;
    scheduleInflight = (async () => {
        const res = await fetchWithToken('/api/man-schedule/realtime?janela=all');
        if (!res.ok) {
            if (res.status === 503) {
                throw new Error('Cache MIO indisponível. Por favor, atualize o cache no painel administrativo.');
            }
            throw new Error('Erro ao buscar dados da escala.');
        }
        const result = await res.json();
        if (!result.success) throw new Error(result.error || 'Erro na API');
        const data = (result.data || []) as CrewSchedule[];
        scheduleCache = { fetchedAt: Date.now(), data };
        return data;
    })().finally(() => {
        scheduleInflight = null;
    });
    return scheduleInflight;
}

// ---------------------------------------------------------------------------
// Module-level date formatters (shared by header cells and memoized rows)
// ---------------------------------------------------------------------------

const formatHeaderDate = (d: Date, locale: string) => {
    const dayStr = d.getDate().toString().padStart(2, '0');
    const monthStr = d.toLocaleString(locale === 'en-US' ? 'en-US' : 'pt-BR', { month: 'short' });
    const yearStr = d.getFullYear().toString().substring(2);
    const capitalizedMonth = monthStr.charAt(0).toUpperCase() + monthStr.slice(1).replace('.', '');
    return `${dayStr}-${capitalizedMonth}-${yearStr}`;
};

const getDayAbbr = (d: Date, locale: string) => {
    return d.toLocaleString(locale === 'en-US' ? 'en-US' : 'pt-BR', { weekday: 'short' }).replace('.', '');
};

// ---------------------------------------------------------------------------
// Memoized schedule row: pre-computes all cell metas once per (rotations x
// weeks) change instead of re-scanning every rotation on every parent render.
// ---------------------------------------------------------------------------

interface HoveredCommentData {
    x: number;
    y: number;
    name: string;
    status: string;
    style: { bg: string; text: string } | null;
    observacoes: string;
    startFormatted: string;
    vessel: string;
    weekDate: string;
}

interface ScheduleRowProps {
    member: { name: string; cpf: string; rotations: RotationCell[] };
    position: string;
    groupCount: number | string;
    groupBg: string;
    weeks: { date: Date }[];
    viewport: ScheduleViewport;
    currentWeekKey: string | null;
    isOpening: boolean;
    locale: string;
    onNameClick: (cpf: string, name: string) => void;
    onCellClick: (cpf: string, name: string, date: Date, status: string, rotations: RotationCell[]) => void;
    onHoverComment: (data: HoveredCommentData) => void;
    onLeaveComment: () => void;
    getWeekRotationMeta: (
        weekDate: Date,
        rotations: RotationCell[]
    ) => {
        status: string;
        observacoes: string | null;
        type?: string;
        startDay: number | null;
        startFormatted: string;
        vessel: string;
        exibir_dia_inicio?: boolean;
    };
    getCellStyle: (rotationType: string) => { bg: string; text: string };
}

const ScheduleRow = React.memo(function ScheduleRow({
    member,
    position,
    groupCount,
    groupBg,
    weeks,
    viewport,
    currentWeekKey,
    isOpening,
    locale,
    onNameClick,
    onCellClick,
    onHoverComment,
    onLeaveComment,
    getWeekRotationMeta,
    getCellStyle,
}: ScheduleRowProps) {
    const cellMetas = useMemo(
        () =>
            weeks.map((week) => {
                const meta = getWeekRotationMeta(week.date, member.rotations);
                const status = meta.status;
                const hasComment = !!(meta.observacoes && String(meta.observacoes).trim());
                const isCurrentWeek =
                    currentWeekKey !== null && new Date(week.date).toDateString() === currentWeekKey;
                const style = status ? getCellStyle(status === 'ON*' ? 'ON*' : (meta.type || status)) : null;
                const headerDate = formatHeaderDate(week.date, locale);

                const tooltipParts = [
                    `Clique para gerenciar escala de ${member.name} ${cellPeriodTooltip(viewport, headerDate)}`,
                ];
                if (meta.startFormatted) {
                    tooltipParts.push(`Início do evento: ${meta.startFormatted}`);
                }
                if (hasComment) {
                    tooltipParts.push(`Observações: ${meta.observacoes}`);
                }

                return {
                    status,
                    startDay: meta.startDay,
                    startFormatted: meta.startFormatted,
                    vessel: meta.vessel,
                    observacoes: meta.observacoes,
                    exibir_dia_inicio: meta.exibir_dia_inicio,
                    hasComment,
                    isCurrentWeek,
                    style,
                    tooltip: tooltipParts.join('\n\n'),
                };
            }),
        [weeks, viewport, member.rotations, member.name, getWeekRotationMeta, getCellStyle, currentWeekKey, locale]
    );

    const counts = useMemo(() => {
        let on = 0, dba = 0, fi = 0, tre = 0;
        for (const c of cellMetas) {
            const st = (c.status || '').toUpperCase();
            if (st === 'ON') on++;
            else if (st === 'DBA') dba++;
            else if (st === 'FI') fi++;
            else if (st === 'TRE') tre++;
        }
        return { on, dba, fi, tre };
    }, [cellMetas]);

    return (
        <tr className="hover:bg-slate-50/50">
            <td
                onClick={() => onNameClick(member.cpf, member.name)}
                className={`${MAN_SCHEDULE_STICKY_NAME_CLASS} bg-white text-blue-600 hover:text-blue-800 hover:underline font-bold px-3 py-1.5 border-r border-b border-black whitespace-nowrap overflow-hidden text-ellipsis sticky left-0 z-20 uppercase cursor-pointer transition-colors min-w-[260px] w-[260px] max-w-[260px] ${
                    isOpening ? 'opacity-50 animate-pulse' : ''
                }`}
                title={member.name}
            >
                {member.name || '\u00A0'}
            </td>
            <td className={`${groupBg} text-black font-bold text-center border-r border-b border-black sticky left-[260px] z-20 min-w-[70px] w-[70px] max-w-[70px]`}>
                {groupCount}
            </td>
            <td className={`${groupBg} ${MAN_SCHEDULE_STICKY_EDGE_CLASS} text-black font-bold px-2 py-1.5 border-r border-b border-black uppercase sticky left-[330px] z-20 min-w-[170px] w-[170px] max-w-[170px] text-ellipsis overflow-hidden whitespace-nowrap`} title={position}>
                {position}
            </td>
            <td className="bg-emerald-50/50 text-emerald-800 font-bold text-center border-r border-b border-black px-1 min-w-[36px] w-[36px] text-[11px]" title="Total ON">
                {counts.on || '-'}
            </td>
            <td className="bg-amber-50/50 text-amber-800 font-bold text-center border-r border-b border-black px-1 min-w-[36px] w-[36px] text-[11px]" title="Total DBA">
                {counts.dba || '-'}
            </td>
            <td className="bg-blue-50/50 text-blue-800 font-bold text-center border-r border-b border-black px-1 min-w-[36px] w-[36px] text-[11px]" title="Total FI">
                {counts.fi || '-'}
            </td>
            <td className="bg-purple-50/50 text-purple-800 font-bold text-center border-r border-b border-black px-1 min-w-[36px] w-[36px] text-[11px]" title="Total TRE">
                {counts.tre || '-'}
            </td>
            {cellMetas.map((cell, wIdx) => (
                <td
                    key={`cell-${wIdx}`}
                    onClick={() => onCellClick(member.cpf, member.name, weeks[wIdx].date, cell.status, member.rotations)}
                    onMouseEnter={(e) => {
                        if (cell.hasComment) {
                            const rect = e.currentTarget.getBoundingClientRect();
                            onHoverComment({
                                x: rect.left + rect.width / 2,
                                y: rect.top,
                                name: member.name,
                                status: cell.status || 'EVENTO',
                                style: cell.style,
                                observacoes: cell.observacoes || '',
                                startFormatted: cell.startFormatted,
                                vessel: cell.vessel,
                                weekDate: formatHeaderDate(weeks[wIdx].date, locale),
                            });
                        }
                    }}
                    onMouseLeave={() => {
                        if (cell.hasComment) {
                            onLeaveComment();
                        }
                    }}
                    className={`border-r border-b text-center cursor-pointer hover:brightness-95 hover:ring-2 hover:ring-blue-400 transition-all relative select-none ${
                        cell.isCurrentWeek ? '!border-yellow-500 !border-2' : 'border-black'
                    }`}
                    style={{
                        width: '36px',
                        minWidth: '36px',
                        maxWidth: '36px',
                        height: '38px',
                        backgroundColor: cell.isCurrentWeek ? '#fef9c3' : cell.style?.bg || '#ffffff',
                        color: cell.style?.text || '#9ca3af',
                    }}
                    title={cell.hasComment ? undefined : cell.tooltip}
                >
                    {cell.status ? (
                        <div className="flex flex-col items-center justify-center h-full w-full py-0.5 leading-tight">
                            <span className="font-bold text-[9px] tracking-tight truncate max-w-full px-0.5">
                                {cell.status}
                            </span>
                            {cell.exibir_dia_inicio && cell.startDay !== null && (
                                <span
                                    className="text-[7.5px] font-bold px-1 rounded-xs bg-black/15 text-current leading-none tracking-tighter mt-0.5 shadow-2xs"
                                    title={`Início em: ${cell.startFormatted || cell.startDay}`}
                                >
                                    d.{cell.startDay}
                                </span>
                            )}
                            {cell.hasComment && (
                                <div className="absolute top-0.5 right-0.5 flex items-center justify-center pointer-events-none">
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-600"></span>
                                    </span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <span className="text-gray-300 text-[9px]">-</span>
                    )}
                </td>
            ))}
        </tr>
    );
});

export default function GTManScheduleTab({ onColabClick, kpiFilter = '' }: Props) {
    const { t, locale } = useI18n();
    const [allSchedules, setAllSchedules] = useState<CrewSchedule[]>([]);
    const [tipos, setTipos] = useState<GTTipoEventoEscala[]>(
        DEFAULT_TIPOS_EVENTO_ESCALA.map((tipo, i) => ({ ...tipo, id: `default-${i}` }))
    );
    const [loading, setLoading] = useState(true);
    const [openingColab, setOpeningColab] = useState<string | null>(null);

    const [selectedCell, setSelectedCell] = useState<{
        cpf: string;
        name: string;
        date: Date;
        status: string;
        rotationId?: string;
        rotationType?: string;
        vessel: string;
    } | null>(null);
    const [formTipo, setFormTipo] = useState('normal');
    const [formStart, setFormStart] = useState('');
    const [formEnd, setFormEnd] = useState('');
    const [formVessel, setFormVessel] = useState('');
    const [formLocalEmb, setFormLocalEmb] = useState('');
    const [formObs, setFormObs] = useState('');
    const [formExibirDia, setFormExibirDia] = useState(false);
    const [submittingEvent, setSubmittingEvent] = useState(false);

    const [filterStatusAtivo, setFilterStatusAtivo] = useState<'ativos' | 'inativos' | 'todos'>('ativos');
    const [isFechamentoOpen, setIsFechamentoOpen] = useState(false);

    const [hoveredComment, setHoveredComment] = useState<HoveredCommentData | null>(null);

    const handleHoverComment = useCallback((data: HoveredCommentData) => {
        setHoveredComment(data);
    }, []);

    const handleLeaveComment = useCallback(() => {
        setHoveredComment(null);
    }, []);

    const [modalPos, setModalPos] = useState<{ x: number; y: number } | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const dragRef = useRef<{ startX: number; startY: number; posX: number; posY: number }>({
        startX: 0,
        startY: 0,
        posX: 0,
        posY: 0,
    });

    const [searchName, setSearchName] = useState('');
    const [filterVessel, setFilterVessel] = useState('');
    const [filterCompany, setFilterCompany] = useState('');
    const [filterPosition, setFilterPosition] = useState('');
    const [filterDateStart, setFilterDateStart] = useState('');
    const [filterDateEnd, setFilterDateEnd] = useState('');
    const [viewportDay, setViewportDay] = useState(false);
    const [referenceMonth, setReferenceMonth] = useState<ReferenceMonth>(() => civilReferenceMonth());

    useEffect(() => {
        setViewportDay(readViewportDayPreference());
        const storedMonth = readReferenceMonthPreference();
        if (storedMonth) setReferenceMonth(storedMonth);
    }, []);

    const viewport: ScheduleViewport = viewportDay ? 'day' : 'week';

    const applyReferenceMonth = useCallback((next: ReferenceMonth) => {
        const clamped = clampReferenceMonth(next);
        setReferenceMonth(clamped);
        persistReferenceMonthPreference(clamped);
    }, []);

    const handleViewportDayChange = (checked: boolean) => {
        setViewportDay(checked);
        persistViewportDayPreference(checked);
    };

    const handleDragStart = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('button, input, select, textarea, a')) {
            return;
        }
        e.preventDefault();
        setIsDragging(true);
        const currentX = modalPos?.x ?? (typeof window !== 'undefined' ? Math.max(20, window.innerWidth - 440) : 40);
        const currentY = modalPos?.y ?? 110;
        dragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            posX: currentX,
            posY: currentY,
        };
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        if ((e.target as HTMLElement).closest('button, input, select, textarea, a')) return;
        const touch = e.touches[0];
        setIsDragging(true);
        const currentX = modalPos?.x ?? (typeof window !== 'undefined' ? Math.max(20, window.innerWidth - 440) : 40);
        const currentY = modalPos?.y ?? 110;
        dragRef.current = {
            startX: touch.clientX,
            startY: touch.clientY,
            posX: currentX,
            posY: currentY,
        };
    };

    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e: MouseEvent) => {
            const dx = e.clientX - dragRef.current.startX;
            const dy = e.clientY - dragRef.current.startY;
            const maxX = Math.max(10, window.innerWidth - 420);
            const maxY = Math.max(10, window.innerHeight - 200);
            const newX = Math.max(10, Math.min(maxX, dragRef.current.posX + dx));
            const newY = Math.max(10, Math.min(maxY, dragRef.current.posY + dy));
            setModalPos({ x: newX, y: newY });
        };

        const handleTouchMove = (e: TouchEvent) => {
            const touch = e.touches[0];
            const dx = touch.clientX - dragRef.current.startX;
            const dy = touch.clientY - dragRef.current.startY;
            const maxX = Math.max(10, window.innerWidth - 420);
            const maxY = Math.max(10, window.innerHeight - 200);
            const newX = Math.max(10, Math.min(maxX, dragRef.current.posX + dx));
            const newY = Math.max(10, Math.min(maxY, dragRef.current.posY + dy));
            setModalPos({ x: newX, y: newY });
        };

        const handleDragEnd = () => {
            setIsDragging(false);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleDragEnd);
        window.addEventListener('touchmove', handleTouchMove, { passive: false });
        window.addEventListener('touchend', handleDragEnd);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleDragEnd);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleDragEnd);
        };
    }, [isDragging]);

    const tipoByCodigo = useMemo(() => {
        const map = new Map<string, GTTipoEventoEscala>();
        for (const tipo of tipos) {
            map.set(tipo.codigo.toLowerCase(), tipo);
            map.set(tipo.display_code.toUpperCase(), tipo);
        }
        return map;
    }, [tipos]);

    const resolveTipo = useCallback(
        (codigoOrDisplay: string | null | undefined): GTTipoEventoEscala | undefined => {
            if (!codigoOrDisplay) return undefined;
            return (
                tipoByCodigo.get(codigoOrDisplay.toLowerCase()) ||
                tipoByCodigo.get(codigoOrDisplay.toUpperCase())
            );
        },
        [tipoByCodigo]
    );

    const getDisplayCode = useCallback(
        (rotationType: string, observacoes?: string | null): string => {
            if (isRotacaoPrevista(rotationType, observacoes)) return 'ON*';
            const tipo = resolveTipo(rotationType);
            if (tipo) return tipo.display_code;
            return scheduleDisplayCode(rotationType, observacoes);
        },
        [resolveTipo]
    );

    const getCellStyle = useCallback(
        (rotationType: string): { bg: string; text: string } => {
            if (rotationType === 'ON*' || isRotacaoPrevista(rotationType)) {
                const previstoTipo = resolveTipo('previsto') || resolveTipo('ON*');
                if (previstoTipo) return { bg: previstoTipo.bg_color, text: previstoTipo.text_color };
                return { bg: '#c6d9f0', text: '#1f4e79' };
            }
            const tipo = resolveTipo(rotationType);
            if (tipo) return { bg: tipo.bg_color, text: tipo.text_color };
            const display = getDisplayCode(rotationType);
            if (display === 'OFF-C' || display === 'STB') return { bg: '#f4cccc', text: '#cc0000' };
            return { bg: '#e2efda', text: '#00b050' };
        },
        [resolveTipo, getDisplayCode]
    );

    const fetchTipos = useCallback(async () => {
        try {
            const res = await fetchWithToken('/api/gestao-tripulantes/tipos-evento');
            if (!res.ok) return;
            const result = await res.json();
            if (result.success && Array.isArray(result.data) && result.data.length > 0) {
                setTipos(result.data);
            }
        } catch (err) {
            console.warn('Falha ao carregar tipos de evento; usando defaults.', err);
        }
    }, []);

    const fetchSchedules = useCallback(async (force = false, silent = false) => {
        try {
            if (!silent && !scheduleCache) setLoading(true);
            const data = await loadScheduleRows(force);
            setAllSchedules(data);
        } catch (error: unknown) {
            console.error('Error fetching schedules:', error);
            if (!silent) toast.error(error instanceof Error ? error.message : 'Erro ao carregar escala do MIO.');
        } finally {
            if (!silent) setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTipos();
        fetchSchedules();
    }, [fetchTipos, fetchSchedules]);

function parseLocalDate(str: string | null | undefined): Date | null {
    if (!str || typeof str !== 'string' || str.trim() === '') return null;
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

    const getWeekRotation = useCallback((weekDate: Date, rotations: RotationCell[]) => {
        const { start: wStart, end: wEnd } = columnPeriod(weekDate, viewport);
        return pickOverlappingRotation(rotations, wStart, wEnd) as RotationCell | null;
    }, [viewport]);

    const handleCellClick = (cpf: string, name: string, date: Date, status: string, rotations: RotationCell[]) => {
        const matchingRotation = getWeekRotation(date, rotations);
        const rotId = matchingRotation?.id || '';
        const currentVessel = matchingRotation?.vessel || '';
        const formattedDate = formatLocalYmd(date);

        const defaultEnd = new Date(date);
        defaultEnd.setDate(defaultEnd.getDate() + 14);
        const formattedEnd = formatLocalYmd(defaultEnd);

        const mappedTipo = matchingRotation?.type || (status ? resolveTipo(status)?.codigo : null) || 'normal';

        setSelectedCell({ cpf, name, date, status, rotationId: rotId, rotationType: mappedTipo || undefined, vessel: currentVessel });

        if (!modalPos && typeof window !== 'undefined') {
            setModalPos({
                x: Math.max(20, window.innerWidth - 440),
                y: 110,
            });
        }

        setFormTipo(mappedTipo);
        setFormExibirDia(matchingRotation?.exibir_dia_inicio !== undefined ? Boolean(matchingRotation.exibir_dia_inicio) : true);

        if (matchingRotation?.start && matchingRotation?.end && isUuid(rotId)) {
            setFormStart(matchingRotation.start.slice(0, 10));
            setFormEnd(matchingRotation.end.slice(0, 10));
            setFormLocalEmb(matchingRotation.local_embarque || '');
            setFormObs(matchingRotation.observacoes || '');
        } else {
            setFormStart(formattedDate);
            setFormEnd(formattedEnd);
            setFormLocalEmb(matchingRotation?.local_embarque || '');
            setFormObs(matchingRotation?.observacoes || '');
        }
        setFormVessel(currentVessel || '');
    };

    const handleSaveEvent = async () => {
        if (!selectedCell) return;
        // Férias/afastamentos vêm de gt_afastamentos — não são linhas de embarque;
        // PUT/DELETE /embarques/<id> daria 404. São gerenciados no módulo de Férias/DP.
        if (selectedCell.rotationType === 'ferias' || selectedCell.rotationType === 'afastamento') {
            toast.error('Férias e afastamentos são gerenciados pelo módulo de Férias/DP e não podem ser editados na grade.');
            setSelectedCell(null);
            return;
        }
        const editingId = selectedCell.rotationId && isUuid(selectedCell.rotationId)
            ? selectedCell.rotationId
            : null;

        const optimisticId = editingId || `temp-${Date.now()}`;
        const cellCpf = selectedCell.cpf;
        const updatedRot: RotationCell = {
            id: optimisticId,
            start: formStart,
            end: formEnd,
            type: formTipo,
            vessel: formVessel,
            local_embarque: formLocalEmb,
            observacoes: formObs,
            exibir_dia_inicio: formExibirDia,
        };

        setAllSchedules((prev) => applyRotationRow(prev, cellCpf, updatedRot, 'upsert', editingId));
        setSelectedCell(null);

        try {
            setSubmittingEvent(true);
            const payload = {
                colaborador_cpf: cellCpf,
                tipo: formTipo,
                data_embarque: formStart,
                data_desembarque: formEnd,
                local_embarque: formLocalEmb,
                local_desembarque: formVessel,
                observacoes: formObs,
                exibir_dia_inicio: formExibirDia,
            };

            const res = editingId
                ? await fetchWithToken(`/api/gestao-tripulantes/embarques/${editingId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                })
                : await fetchWithToken('/api/gestao-tripulantes/embarques', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.error || 'Erro ao salvar escala.');
            }

            const savedId = data?.data?.id as string | undefined;
            if (savedId && savedId !== optimisticId) {
                setAllSchedules((prev) =>
                    applyRotationRow(prev, cellCpf, { ...updatedRot, id: savedId }, 'upsert', optimisticId)
                );
            }

            toast.success(editingId ? 'Evento de escala atualizado!' : 'Evento de escala inserido com sucesso!');
            // Sobreposições: o grid mostra 1 evento por semana (ganha o início
            // mais recente) — sem este aviso parece que a marcação "não pegou".
            const conflitos = (data?.conflitos || []) as Array<{ tipo: string; data_embarque: string; data_desembarque: string }>;
            for (const c of conflitos.slice(0, 2)) {
                toast.error(
                    `Atenção: existe ${c.tipo?.toUpperCase()} ${c.data_embarque}→${c.data_desembarque} sobreposto. Ele aparece nas semanas em que começa depois deste evento.`,
                    { duration: 8000 }
                );
            }

            fetchSchedules(true, true);
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Falha ao salvar evento.');
            fetchSchedules(true, true);
        } finally {
            setSubmittingEvent(false);
        }
    };

    const handleDeleteEvent = async () => {
        if (!selectedCell?.rotationId) return;
        if (selectedCell.rotationType === 'ferias' || selectedCell.rotationType === 'afastamento') {
            toast.error('Férias e afastamentos são gerenciados pelo módulo de Férias/DP e não podem ser excluídos na grade.');
            setSelectedCell(null);
            return;
        }
        const rotIdToDelete = selectedCell.rotationId;
        const cellCpf = selectedCell.cpf;

        setAllSchedules((prev) =>
            applyRotationRow(
                prev,
                cellCpf,
                { id: rotIdToDelete, start: null, end: null, type: 'normal', vessel: '' },
                'delete',
                rotIdToDelete,
            )
        );

        setSelectedCell(null);

        try {
            setSubmittingEvent(true);
            const res = await fetchWithToken(`/api/gestao-tripulantes/embarques/${rotIdToDelete}`, {
                method: 'DELETE',
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Erro ao excluir evento.');
            }

            toast.success('Evento de escala removido com sucesso!');
            // Sincronização silenciosa em background
            fetchSchedules(true, true);
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Falha ao remover evento.');
            fetchSchedules(true, true);
        } finally {
            setSubmittingEvent(false);
        }
    };

    const handleNameClick = async (cpf: string, fullName: string) => {
        if (!cpf) return;
        try {
            const cleanCpf = cpf.replace(/\D/g, '');
            if (!cleanCpf) return;

            setOpeningColab(cpf);
            const res = await fetchWithToken(
                `/api/gestao-tripulantes/colaboradores?cpf=${encodeURIComponent(cleanCpf)}&limit=1&lite=1`
            );
            if (!res.ok) throw new Error();
            const json = await res.json();
            const colab = json.data?.[0];

            if (colab?.id) {
                onColabClick(colab);
            } else {
                toast.error(`Colaborador "${fullName}" não está cadastrado na base local de tripulantes.`);
            }
        } catch {
            toast.error('Erro ao abrir ficha do colaborador.');
        } finally {
            setOpeningColab(null);
        }
    };

    const filteredSchedules = useMemo(() => {
        const sName = searchName.trim().toLowerCase();
        const fVes = filterVessel.trim().toLowerCase();
        const fComp = filterCompany.trim().toLowerCase();
        const fPos = filterPosition.trim().toLowerCase();

        return allSchedules.filter((s) => {
            const matchName =
                !sName ||
                s.full_name?.toLowerCase().includes(sName) ||
                s.cpf?.includes(sName) ||
                (s.matricula && s.matricula.toLowerCase().includes(sName));
            const matchVessel = !fVes || (s.vessel || '').trim().toLowerCase() === fVes;
            const matchCompany = !fComp || (s.company || '').trim().toLowerCase() === fComp;
            const matchPosition = !fPos || (s.position || '').trim().toLowerCase() === fPos;
            const matchAtivo =
                filterStatusAtivo === 'todos'
                    ? true
                    : filterStatusAtivo === 'inativos'
                    ? s.ativo === false
                    : s.ativo !== false;
            return matchName && matchVessel && matchCompany && matchPosition && matchAtivo;
        });
    }, [allSchedules, searchName, filterVessel, filterCompany, filterPosition, filterStatusAtivo]);

    const availableCompanies = useMemo(() => {
        const fVes = filterVessel.trim().toLowerCase();
        const fPos = filterPosition.trim().toLowerCase();
        const valid = allSchedules
            .filter(
                (s) =>
                    (!fVes || (s.vessel || '').trim().toLowerCase() === fVes) &&
                    (!fPos || (s.position || '').trim().toLowerCase() === fPos) &&
                    (filterStatusAtivo === 'todos'
                        ? true
                        : filterStatusAtivo === 'inativos'
                        ? s.ativo === false
                        : s.ativo !== false)
            )
            .map((s) => (s.company || '').trim())
            .filter(Boolean);
        return Array.from(new Set(valid)).sort();
    }, [allSchedules, filterVessel, filterPosition, filterStatusAtivo]);

    const availableVessels = useMemo(() => {
        const fComp = filterCompany.trim().toLowerCase();
        const fPos = filterPosition.trim().toLowerCase();
        const valid = allSchedules
            .filter(
                (s) =>
                    (!fComp || (s.company || '').trim().toLowerCase() === fComp) &&
                    (!fPos || (s.position || '').trim().toLowerCase() === fPos) &&
                    (filterStatusAtivo === 'todos'
                        ? true
                        : filterStatusAtivo === 'inativos'
                        ? s.ativo === false
                        : s.ativo !== false)
            )
            .map((s) => (s.vessel || '').trim())
            .filter(Boolean);
        return Array.from(new Set(valid)).sort();
    }, [allSchedules, filterCompany, filterPosition, filterStatusAtivo]);

    const availablePositions = useMemo(() => {
        const fComp = filterCompany.trim().toLowerCase();
        const fVes = filterVessel.trim().toLowerCase();
        const valid = allSchedules
            .filter(
                (s) =>
                    (!fComp || (s.company || '').trim().toLowerCase() === fComp) &&
                    (!fVes || (s.vessel || '').trim().toLowerCase() === fVes) &&
                    (filterStatusAtivo === 'todos'
                        ? true
                        : filterStatusAtivo === 'inativos'
                        ? s.ativo === false
                        : s.ativo !== false)
            )
            .map((s) => (s.position || '').trim())
            .filter(Boolean);
        return Array.from(new Set(valid)).sort();
    }, [allSchedules, filterCompany, filterVessel, filterStatusAtivo]);

    const positionGroups = useMemo(() => {
        const byPosition: Record<string, { name: string; cpf: string; rotations: RotationCell[] }[]> = {};

        for (const s of filteredSchedules) {
            const pos = normalizePosition(s.position) || 'SEM CARGO';
            if (!byPosition[pos]) byPosition[pos] = [];

            const rotType = s.tipo_codigo || s.rotation_type || 'normal';
            const rotation: RotationCell = {
                id: s.id,
                start: s.rotation_start,
                end: s.rotation_end,
                type: rotType,
                vessel: s.vessel,
                observacoes: s.observacoes || null,
                local_embarque: s.local_embarque || '',
                exibir_dia_inicio: Boolean(s.exibir_dia_inicio),
                origem: s.origem,
            };

            const existing = byPosition[pos].find((c) => c.cpf === s.cpf);
            if (existing) {
                if (s.rotation_start || s.rotation_end) {
                    existing.rotations.push(rotation);
                }
            } else {
                byPosition[pos].push({
                    name: s.full_name,
                    cpf: s.cpf,
                    rotations: s.rotation_start || s.rotation_end ? [rotation] : [],
                });
            }
        }

        return Object.entries(byPosition)
            .sort(([a], [b]) => getPositionSortKey(a) - getPositionSortKey(b) || a.localeCompare(b))
            .map(([position, members]) => ({ position, members, count: members.length }));
    }, [filteredSchedules]);

    const weeks = useMemo(() => {
        const rotationDates: Date[] = [];
        for (const group of positionGroups) {
            for (const m of group.members) {
                for (const r of m.rotations) {
                    const start = parseLocalDate(r.start);
                    const end = parseLocalDate(r.end);
                    if (start) rotationDates.push(start);
                    if (end) rotationDates.push(end);
                }
            }
        }

        return buildScheduleColumns({
            viewport,
            referenceMonth,
            rotationDates,
            filterStart: parseCompleteFilterDate(filterDateStart),
            filterEnd: parseCompleteFilterDate(filterDateEnd),
        });
    }, [positionGroups, filterDateStart, filterDateEnd, viewport, referenceMonth]);

    const filteredWeeks = useMemo(() => {
        const startDate = parseCompleteFilterDate(filterDateStart);
        const endDate = parseCompleteFilterDate(filterDateEnd);
        if (!startDate && !endDate) return weeks;

        return weeks.filter((w) => {
            const { start: colStart, end: colEnd } = columnPeriod(w.date, viewport);
            if (startDate && endDate) {
                return colEnd >= startDate && colStart <= endDate;
            }
            if (startDate) {
                return colEnd >= startDate;
            }
            if (endDate) {
                return colStart <= endDate;
            }
            return true;
        });
    }, [weeks, filterDateStart, filterDateEnd, viewport]);

    const {
        tableContainerRef,
        topScrollRef,
        tableScrollWidth,
        handleTopScroll,
        handleTableScroll,
    } = useManScheduleScrollSync(filteredWeeks.length);

    const todayYmd = civilTodayYmd();
    const todayColumnIndex = useMemo(
        () => indexOfCivilDay(filteredWeeks, todayYmd, viewport),
        [filteredWeeks, todayYmd, viewport],
    );
    const currentWeekKey = useMemo(
        () =>
            todayColumnIndex >= 0 && filteredWeeks[todayColumnIndex]?.date
                ? new Date(filteredWeeks[todayColumnIndex].date).toDateString()
                : null,
        [filteredWeeks, todayColumnIndex],
    );
    const isCurrentMonth = isSameReferenceMonth(referenceMonth, civilReferenceMonth());
    const focusIndex = useMemo(
        () => focusColumnIndex(filteredWeeks, referenceMonth, viewport, todayYmd),
        [filteredWeeks, referenceMonth, viewport, todayYmd],
    );

    const scrollToColumn = useCallback((index: number) => {
        const root = tableContainerRef.current;
        if (!root) return;
        const clamped = adjacentColumnIndex(index, 0, filteredWeeks.length);
        scrollScheduleColumnIntoView(root, clamped);
    }, [filteredWeeks.length]);

    const scrollByColumns = useCallback((delta: number) => {
        const root = tableContainerRef.current;
        if (!root) return;
        const visible = readVisibleColumnIndex(root);
        scrollToColumn(adjacentColumnIndex(visible, delta, filteredWeeks.length));
    }, [filteredWeeks.length, scrollToColumn]);

    const goToToday = useCallback(() => {
        const current = civilReferenceMonth();
        if (!isSameReferenceMonth(referenceMonth, current)) {
            applyReferenceMonth(current);
            return;
        }
        scrollToColumn(focusIndex);
    }, [applyReferenceMonth, focusIndex, referenceMonth, scrollToColumn]);

    useEffect(() => {
        if (!loading && filteredWeeks.length > 0) {
            const timer = setTimeout(() => scrollToColumn(focusIndex), 120);
            return () => clearTimeout(timer);
        }
    }, [loading, filteredWeeks.length, focusIndex, referenceMonth.year, referenceMonth.month, viewport, scrollToColumn]);

    const getWeekStatus = useCallback(
        (weekDate: Date, rotations: RotationCell[]): string => {
            const rot = getWeekRotation(weekDate, rotations);
            return rot ? getDisplayCode(rot.type || 'normal', rot.observacoes) : '';
        },
        [getWeekRotation, getDisplayCode]
    );

    const getWeekRotationMeta = useCallback(
        (weekDate: Date, rotations: RotationCell[]) => {
            const rot = getWeekRotation(weekDate, rotations);
            if (!rot) {
                return {
                    status: '',
                    observacoes: null as string | null,
                    type: undefined,
                    startDay: null,
                    startFormatted: '',
                    vessel: '',
                    exibir_dia_inicio: false,
                };
            }

            let startDay: number | null = null;
            let startFormatted = '';
            let isStartWeek = false;

            if (rot.start) {
                const parsed = parseLocalDate(rot.start);
                if (parsed) {
                    startDay = parsed.getDate();
                    const dStr = String(parsed.getDate()).padStart(2, '0');
                    const mStr = String(parsed.getMonth() + 1).padStart(2, '0');
                    const yStr = parsed.getFullYear();
                    startFormatted = `${dStr}/${mStr}/${yStr}`;

                    const wStart = new Date(weekDate);
                    wStart.setHours(0, 0, 0, 0);
                    const wEnd = new Date(wStart);
                    wEnd.setDate(wEnd.getDate() + 6);
                    wEnd.setHours(23, 59, 59, 999);

                    // 1. Data de início cai dentro desta semana (sábado a sexta)
                    const directlyInWeek = parsed >= wStart && parsed <= wEnd;

                    // 2. Se a semana anterior não exibia este evento, esta é a primeira semana visível dele
                    const prevWeek = new Date(wStart);
                    prevWeek.setDate(prevWeek.getDate() - 7);
                    const prevRot = getWeekRotation(prevWeek, rotations);
                    const isFirstDisplayedWeek = !prevRot || (prevRot.id ? prevRot.id !== rot.id : prevRot.type !== rot.type);

                    isStartWeek = directlyInWeek || isFirstDisplayedWeek;
                }
            }

            return {
                status: getDisplayCode(rot.type || 'normal', rot.observacoes),
                observacoes: rot.observacoes || null,
                type: rot.type,
                startDay,
                startFormatted,
                vessel: rot.vessel || '',
                exibir_dia_inicio: Boolean(rot.exibir_dia_inicio && isStartWeek),
            };
        },
        [getWeekRotation, getDisplayCode]
    );

    const vesselDisplayName =
        filterVessel && filterCompany
            ? `${filterCompany.toUpperCase()} - ${filterVessel.toUpperCase()}`
            : filterVessel
                ? filterVessel.toUpperCase()
                : filterCompany
                    ? filterCompany.toUpperCase()
                    : t('manSchedule.allVessels', 'Todas as Embarcações');

    const presentStatuses = useMemo(() => {
        const statuses = new Set<string>();
        for (const group of positionGroups) {
            for (const member of group.members) {
                for (const week of filteredWeeks) {
                    const s = getWeekStatus(week.date, member.rotations);
                    if (s) statuses.add(s);
                }
            }
        }
        return statuses;
    }, [positionGroups, filteredWeeks, getWeekStatus]);

    const todayColumnDate = parseCivilYmd(todayYmd);

    const todayPobCount = useMemo(() => {
        return countPobOnCivilDay(
            positionGroups.flatMap((group) => group.members),
            todayYmd,
        );
    }, [positionGroups, todayYmd]);

    const visibleGroups = useMemo(() => {
        if (kpiFilter !== 'embarcados' && kpiFilter !== 'disponiveis') return positionGroups;
        const colDate = todayColumnDate;
        if (!colDate) return positionGroups;
        return positionGroups
            .map((group) => {
                const members = group.members.filter((member) => {
                    const code = getWeekStatus(colDate, member.rotations);
                    if (kpiFilter === 'embarcados') return isEmbarcadoPobDayCode(code);
                    return code.toUpperCase() === 'STB';
                });
                return { ...group, members, count: members.length };
            })
            .filter((group) => group.members.length > 0);
    }, [positionGroups, kpiFilter, todayColumnDate, getWeekStatus]);

    const legendItems = useMemo(() => {
        const active = tipos.filter((tipo) => tipo.ativo);
        const fromDb = active
            .filter((tipo) => presentStatuses.has(tipo.display_code))
            .map((tipo) => ({
                code: tipo.display_code,
                color: tipo.bg_color,
                textColor: tipo.text_color,
                label: tipo.label,
            }));

        // Include any status present in grid but missing from tipos config
        const known = new Set(fromDb.map((i) => i.code));
        for (const code of presentStatuses) {
            if (!known.has(code)) {
                const style = getCellStyle(code);
                fromDb.push({
                    code,
                    color: style.bg,
                    textColor: style.text,
                    label: code,
                });
            }
        }
        return fromDb;
    }, [tipos, presentStatuses, getCellStyle]);

    const exportToExcel = async () => {
        const table = document.getElementById('man-schedule-table');
        if (!table) return;
        const xlsxMod = await import('xlsx-js-style') as { utils?: unknown; default?: { utils?: unknown } };
        const XLSX = (xlsxMod.utils ? xlsxMod : xlsxMod.default) as typeof import('xlsx-js-style');
        const wb = XLSX.utils.table_to_book(table, { sheet: 'Schedule' });
        const ws = wb.Sheets['Schedule'];

        const colWidths = [
            { wch: 35 },
            { wch: 8 },
            { wch: 25 },
            { wch: 8 }, // ON
            { wch: 8 }, // DBA
            { wch: 8 }, // FI
            { wch: 8 }, // TRE
            ...filteredWeeks.map(() => ({ wch: 12 })),
        ];
        ws['!cols'] = colWidths;

        const colorByCode: Record<string, { bg: string; text: string }> = {};
        for (const item of legendItems) {
            colorByCode[item.code] = {
                bg: hexToRgbNoHash(item.color),
                text: hexToRgbNoHash(item.textColor, '00B050'),
            };
        }

        const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:Z100');
        for (let R = range.s.r; R <= range.e.r; ++R) {
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cell_address = { c: C, r: R };
                const cell_ref = XLSX.utils.encode_cell(cell_address);
                const cell = ws[cell_ref];

                if (!cell) continue;

                const defaultBorder = {
                    top: { style: 'thin', color: { rgb: '000000' } },
                    bottom: { style: 'thin', color: { rgb: '000000' } },
                    left: { style: 'thin', color: { rgb: '000000' } },
                    right: { style: 'thin', color: { rgb: '000000' } },
                };

                const cellStyle: any = {
                    alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
                };

                if (typeof cell.v === 'string') {
                    cell.v = cell.v.replace(/\n|&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
                }

                if (R === 0) {
                    cellStyle.font = { bold: true, color: { rgb: C < 7 ? 'FFFFFF' : '002060' }, sz: 12 };
                    cellStyle.fill = { fgColor: { rgb: C < 7 ? '002060' : 'E2EFDA' } };
                    cellStyle.border = defaultBorder;
                } else if (R === 1 || R === 2) {
                    cellStyle.font = { bold: true, color: { rgb: '000000' }, sz: 10 };
                    if (C >= 3 && C <= 6) {
                        if (C === 3) { cellStyle.fill = { fgColor: { rgb: 'E2EFDA' } }; cellStyle.font.color = { rgb: '00B050' }; }
                        else if (C === 4) { cellStyle.fill = { fgColor: { rgb: 'FCE4D6' } }; cellStyle.font.color = { rgb: 'C65911' }; }
                        else if (C === 5) { cellStyle.fill = { fgColor: { rgb: 'D9E1F2' } }; cellStyle.font.color = { rgb: '203764' }; }
                        else if (C === 6) { cellStyle.fill = { fgColor: { rgb: 'EDEDED' } }; cellStyle.font.color = { rgb: '3B3838' }; }
                    }
                    cellStyle.border = defaultBorder;
                } else {
                    if (C >= 3 && C <= 6) {
                        cellStyle.font = { bold: true, sz: 10 };
                        if (C === 3) { cellStyle.fill = { fgColor: { rgb: 'E2EFDA' } }; cellStyle.font.color = { rgb: '00B050' }; }
                        else if (C === 4) { cellStyle.fill = { fgColor: { rgb: 'FCE4D6' } }; cellStyle.font.color = { rgb: 'C65911' }; }
                        else if (C === 5) { cellStyle.fill = { fgColor: { rgb: 'D9E1F2' } }; cellStyle.font.color = { rgb: '203764' }; }
                        else if (C === 6) { cellStyle.fill = { fgColor: { rgb: 'EDEDED' } }; cellStyle.font.color = { rgb: '3B3838' }; }
                        cellStyle.border = defaultBorder;
                    } else {
                        const rawVal = typeof cell.v === 'string' ? cell.v.replace(/\s*💬\s*$/, '').trim() : '';
                        const match = rawVal.match(/^([A-Za-z0-9\-_]+)(?:\s+(d\.\d+))?$/i);
                        const baseCode = match ? match[1].toUpperCase() : rawVal;
                        const daySuffix = match && match[2] ? match[2] : '';

                        if (baseCode && colorByCode[baseCode]) {
                            cellStyle.fill = { fgColor: { rgb: colorByCode[baseCode].bg } };
                            cellStyle.font = { color: { rgb: colorByCode[baseCode].text }, bold: true, sz: 10 };
                            cellStyle.border = defaultBorder;
                            cell.v = daySuffix ? `${baseCode}\n${daySuffix}` : baseCode;
                        } else if (cell.v) {
                            cellStyle.font = { color: { rgb: C === 0 ? '002060' : '000000' }, bold: C < 3, sz: 10 };
                            if (C === 1 || C === 2) cellStyle.fill = { fgColor: { rgb: 'E7E6E6' } };
                            cellStyle.alignment.horizontal = C === 0 ? 'left' : 'center';
                            cellStyle.border = defaultBorder;
                        }
                    }
                }

                cell.s = cellStyle;
            }
        }

        const lastRow = range.e.r + 3;
        let legendCol = 0;
        for (const item of legendItems) {
            const codeCellRef = XLSX.utils.encode_cell({ c: legendCol, r: lastRow });
            const labelCellRef = XLSX.utils.encode_cell({ c: legendCol + 1, r: lastRow });

            ws[codeCellRef] = {
                v: item.code,
                s: {
                    fill: { fgColor: { rgb: hexToRgbNoHash(item.color) } },
                    font: { bold: true, color: { rgb: hexToRgbNoHash(item.textColor, '00B050') }, sz: 10 },
                    alignment: { horizontal: 'center', vertical: 'center' },
                    border: {
                        top: { style: 'thin', color: { rgb: '000000' } },
                        bottom: { style: 'thin', color: { rgb: '000000' } },
                        left: { style: 'thin', color: { rgb: '000000' } },
                        right: { style: 'thin', color: { rgb: '000000' } },
                    },
                },
            };
            ws[labelCellRef] = {
                v: item.label,
                s: {
                    font: { bold: true, sz: 10 },
                    alignment: { horizontal: 'left', vertical: 'center' },
                },
            };
            legendCol += 3;
        }

        ws['!ref'] = XLSX.utils.encode_range({
            s: { r: 0, c: 0 },
            e: { r: lastRow, c: Math.max(range.e.c, legendCol) },
        });

        const safeName = (filterVessel || 'All_Vessels').replace(/[^a-zA-Z0-9_\-\s]/g, '').replace(/\s+/g, '_');
        XLSX.writeFile(wb, `Man_Schedule_${safeName}.xlsx`);
        toast.success(t('manSchedule.exportedSuccess', 'Planilha exportada com sucesso!'));
    };

    const groupColors = ['bg-[#d9e1f2]', 'bg-[#b4c6e7]'];
    const activeTiposForSelect = tipos.filter((tipo) => tipo.ativo);
    const editingLocal = !!(selectedCell?.rotationId && isUuid(selectedCell.rotationId));

    return (
        <div className="flex flex-col h-full min-h-0 min-w-0 w-full border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
            <div className="bg-gray-50/90 px-3 py-2 border-b border-gray-200 shrink-0">
                <div className="flex items-end gap-2.5 w-full flex-wrap">
                    <div className="min-w-[160px] flex-shrink-0 flex-1 md:flex-initial">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">{t('manSchedule.searchLabel', 'Buscar')}</label>
                        <div className="relative">
                            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder={t('manSchedule.search', 'Buscar tripulante...')}
                                className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white transition-all"
                                value={searchName}
                                onChange={(e) => setSearchName(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="min-w-[140px] flex-shrink-0">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">{t('manSchedule.companyLabel', 'Empresa')}</label>
                        <SearchableCreatableSelect
                            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                            options={availableCompanies.map((comp) => ({ id: comp, label: comp }))}
                            value={filterCompany}
                            onChange={setFilterCompany}
                            placeholder={t('manSchedule.allCompanies', 'Todas')}
                            emptyLabel={t('manSchedule.allCompanies', 'Todas')}
                            allowCreate={false}
                        />
                    </div>

                    <div className="min-w-[140px] flex-shrink-0">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">{t('manSchedule.vesselLabel', 'Embarcação')}</label>
                        <SearchableCreatableSelect
                            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                            options={availableVessels.map((v) => ({ id: v, label: v }))}
                            value={filterVessel}
                            onChange={setFilterVessel}
                            placeholder={t('manSchedule.allVessels', 'Todas')}
                            emptyLabel={t('manSchedule.allVessels', 'Todas')}
                            allowCreate={false}
                        />
                    </div>

                    <div className="min-w-[140px] flex-shrink-0">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">{t('manSchedule.positionLabel', 'Cargo')}</label>
                        <SearchableCreatableSelect
                            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                            options={availablePositions.map((p) => ({ id: p, label: p }))}
                            value={filterPosition}
                            onChange={setFilterPosition}
                            placeholder={t('manSchedule.allPositions', 'Todos')}
                            emptyLabel={t('manSchedule.allPositions', 'Todos')}
                            allowCreate={false}
                        />
                    </div>

                    <div className="min-w-[130px] flex-shrink-0">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
                        <select
                            className="w-full px-2 py-1.5 border border-blue-200 bg-blue-50/50 text-blue-900 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 truncate transition-all"
                            value={filterStatusAtivo}
                            onChange={(e) => setFilterStatusAtivo(e.target.value as 'ativos' | 'inativos' | 'todos')}
                        >
                            <option value="ativos">Apenas Ativos</option>
                            <option value="inativos">Apenas Inativos</option>
                            <option value="todos">Todos (Ativos + Inativos)</option>
                        </select>
                    </div>

                    <div className="min-w-[120px] flex-shrink-0">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">{t('manSchedule.dateStart', 'Data Inicio')}</label>
                        <ScheduleDateFilterInput
                            aria-label={t('manSchedule.dateStart', 'Data Inicio')}
                            value={filterDateStart}
                            onCommit={setFilterDateStart}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white transition-all"
                        />
                    </div>

                    <div className="min-w-[120px] flex-shrink-0">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">{t('manSchedule.dateEnd', 'Data Fim')}</label>
                        <ScheduleDateFilterInput
                            aria-label={t('manSchedule.dateEnd', 'Data Fim')}
                            value={filterDateEnd}
                            onCommit={setFilterDateEnd}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white transition-all"
                        />
                    </div>

                    <label className="flex items-center gap-1.5 self-end h-[34px] px-2 border border-blue-200 bg-blue-50/60 rounded-lg cursor-pointer select-none">
                        <input
                            type="checkbox"
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            checked={viewportDay}
                            onChange={(e) => handleViewportDayChange(e.target.checked)}
                        />
                        <span className="text-xs font-semibold text-blue-900 whitespace-nowrap">
                            {t('manSchedule.viewByDay', 'Visualizar por dia')}
                        </span>
                    </label>

                    <ManScheduleTimelineNav
                        loading={loading}
                        pobCount={todayPobCount}
                        viewport={viewport}
                        onPrev={() => scrollByColumns(-1)}
                        onNext={() => scrollByColumns(1)}
                        onToday={goToToday}
                        referenceMonthLabel={formatReferenceMonthLabel(referenceMonth, locale)}
                        onPrevMonth={() => applyReferenceMonth(shiftReferenceMonth(referenceMonth, -1))}
                        onNextMonth={() => applyReferenceMonth(shiftReferenceMonth(referenceMonth, 1))}
                        disablePrevMonth={isSameReferenceMonth(referenceMonth, shiftReferenceMonth(referenceMonth, -1))}
                        disableNextMonth={isSameReferenceMonth(referenceMonth, shiftReferenceMonth(referenceMonth, 1))}
                        isCurrentMonth={isCurrentMonth}
                    />

                    <div className="flex items-center gap-2 ml-auto self-end">
                        <button
                            onClick={() => setIsFechamentoOpen(true)}
                            disabled={loading || allSchedules.length === 0}
                            className="flex items-center gap-2 bg-abz-blue text-white px-3.5 py-1.5 rounded-lg shadow-sm hover:bg-blue-800 disabled:opacity-50 disabled:pointer-events-none transition font-semibold text-xs flex-shrink-0 h-[34px]"
                            title="Revisão, aprovação e despacho oficial para o Departamento Pessoal"
                        >
                            <FiCheckSquare className="w-3.5 h-3.5" />
                            Fechamento DP
                        </button>

                        <button
                            onClick={exportToExcel}
                            disabled={loading || allSchedules.length === 0}
                            className="flex items-center gap-2 bg-emerald-600 text-white px-3.5 py-1.5 rounded-lg shadow-sm hover:bg-emerald-700 disabled:opacity-50 disabled:pointer-events-none transition font-semibold text-xs flex-shrink-0 h-[34px]"
                        >
                            <FiDownload />
                            {t('manSchedule.exportXLSX', 'Exportar XLSX')}
                        </button>
                    </div>
                </div>
            </div>

            {/* Barra de rolagem horizontal superior sincronizada para fácil navegação */}
            <div
                ref={topScrollRef}
                onScroll={handleTopScroll}
                className={MAN_SCHEDULE_TOP_SCROLL_CLASS}
                style={{ height: '14px' }}
                title="Barra de rolagem horizontal rápida do Man Schedule"
            >
                <div style={{ width: `${tableScrollWidth || 3000}px`, height: '1px' }} />
            </div>

            <div
                ref={tableContainerRef}
                onScroll={handleTableScroll}
                data-testid="man-schedule-scroll"
                className={MAN_SCHEDULE_SCROLL_CLASS}
            >
                <table id="man-schedule-table" className={MAN_SCHEDULE_TABLE_CLASS}>
                    <thead className={MAN_SCHEDULE_THEAD_CLASS}>
                        <tr>
                            <th
                                colSpan={7}
                                className="bg-[#002060] text-white text-left px-3 py-2.5 font-bold border-r border-b border-black align-middle sticky left-0 z-30 min-w-[500px] w-[500px]"
                                style={{ fontSize: '12px' }}
                            >
                                {vesselDisplayName}
                            </th>
                            <th
                                colSpan={filteredWeeks.length}
                                className="bg-[#e2efda] text-center border-b border-black p-2 font-bold uppercase text-[#002060]"
                                style={{ fontSize: '10px' }}
                            >
                                {t('manSchedule.timeline', 'CRONOGRAMA DE ESCALAS')}
                            </th>
                        </tr>

                        <tr>
                            <th className={`${MAN_SCHEDULE_STICKY_NAME_CLASS} bg-slate-50 text-slate-700 font-bold text-center border-r border-b border-black sticky left-0 z-30 min-w-[260px] w-[260px] max-w-[260px] px-2 py-2`}>
                                {t('manSchedule.tableHeaders.name', 'NOME')}
                            </th>
                            <th
                                className="bg-slate-50 text-slate-700 font-bold text-center border-r border-b border-black sticky left-[260px] z-30 px-2 py-2 min-w-[70px] w-[70px] max-w-[70px]"
                                title="Tripulantes neste cargo (não é quantidade de embarques)"
                            >
                                {t('manSchedule.tableHeaders.reqOnboard', "QTD.\nEMBARC").split('\n').map((line, i, arr) => (
                                    <React.Fragment key={i}>
                                        {line}{i !== arr.length - 1 && <br />}
                                    </React.Fragment>
                                ))}
                            </th>
                            <th
                                className={`bg-slate-50 ${MAN_SCHEDULE_STICKY_EDGE_CLASS} text-slate-700 font-bold text-center border-r border-b border-black sticky left-[330px] z-30 px-3 py-2 min-w-[170px] w-[170px] max-w-[170px]`}
                                data-man-schedule-sticky-end=""
                            >
                                {t('manSchedule.tableHeaders.rank', 'CARGO')}
                            </th>
                            <th className="bg-[#e2efda] text-[#00b050] font-bold text-center border-r border-b border-black px-1 py-1 min-w-[36px] w-[36px] text-[10px]" title="Total ON (A bordo)">
                                ON
                            </th>
                            <th className="bg-[#fce4d6] text-[#c65911] font-bold text-center border-r border-b border-black px-1 py-1 min-w-[36px] w-[36px] text-[10px]" title="Total DBA (Dobra)">
                                DBA
                            </th>
                            <th className="bg-[#d9e1f2] text-[#203764] font-bold text-center border-r border-b border-black px-1 py-1 min-w-[36px] w-[36px] text-[10px]" title="Total FI (Folga Indenizada)">
                                FI
                            </th>
                            <th className="bg-[#ededed] text-[#3b3838] font-bold text-center border-r border-b border-black px-1 py-1 min-w-[36px] w-[36px] text-[10px]" title="Total TRE (Treinamento)">
                                TRE
                            </th>
                            {filteredWeeks.map((week, idx) => {
                                const isCurrentWeek =
                                    currentWeekKey !== null &&
                                    new Date(week.date).toDateString() === currentWeekKey;
                                return (
                                    <th
                                        key={`date-${idx}`}
                                        data-man-schedule-col={idx}
                                        data-man-schedule-today={isCurrentWeek ? '1' : undefined}
                                        className={`text-center border-r border-b align-bottom pt-2 pb-1 ${
                                            isCurrentWeek
                                                ? 'bg-yellow-100 text-yellow-850 font-bold border-yellow-500 border-2'
                                                : 'bg-[#e2efda] text-[#00b050] font-bold border-black'
                                        }`}
                                        style={{ height: '90px', width: '36px', minWidth: '36px', maxWidth: '36px' }}
                                    >
                                        <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', display: 'inline-block', letterSpacing: '0.5px', fontSize: '10px' }}>
                                            {formatHeaderDate(week.date, locale)}
                                        </div>
                                    </th>
                                );
                            })}
                        </tr>

                        <tr>
                            <th className={`${MAN_SCHEDULE_STICKY_NAME_CLASS} bg-slate-50 border-r border-b border-black sticky left-0 z-30`}></th>
                            <th className="bg-slate-50 border-r border-b border-black sticky left-[260px] z-30"></th>
                            <th className={`bg-slate-50 ${MAN_SCHEDULE_STICKY_EDGE_CLASS} border-r border-b border-black sticky left-[330px] z-30`}></th>
                            <th className="bg-[#e2efda] border-r border-b border-black"></th>
                            <th className="bg-[#fce4d6] border-r border-b border-black"></th>
                            <th className="bg-[#d9e1f2] border-r border-b border-black"></th>
                            <th className="bg-[#ededed] border-r border-b border-black"></th>
                            {filteredWeeks.map((week, idx) => {
                                const isCurrentWeek =
                                    currentWeekKey !== null &&
                                    new Date(week.date).toDateString() === currentWeekKey;
                                return (
                                    <th
                                        key={`day-${idx}`}
                                        className={`text-center border-r border-b py-0.5 ${
                                            isCurrentWeek
                                                ? 'bg-yellow-100 text-yellow-800 font-bold border-yellow-500 border-2'
                                                : 'bg-[#e2efda] text-[#00b050] font-bold border-black'
                                        }`}
                                        style={{ fontSize: '10px', width: '36px', minWidth: '36px', maxWidth: '36px' }}
                                    >
                                        {getDayAbbr(week.date, locale)}
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={7 + filteredWeeks.length} className="px-4 py-8 text-center text-gray-500 bg-white">
                                    <div className="flex items-center justify-center gap-2">
                                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                        <span>{t('manSchedule.loading', 'Carregando dados do MIO...')}</span>
                                    </div>
                                </td>
                            </tr>
                        ) : visibleGroups.length === 0 ? (
                            <tr>
                                <td colSpan={7 + filteredWeeks.length} className="px-4 py-8 text-center text-gray-400 bg-white">
                                    {t('manSchedule.empty', 'Nenhum tripulante encontrado para os filtros selecionados.')}
                                </td>
                            </tr>
                        ) : (
                            visibleGroups.map((group, gIdx) => {
                                const bg = groupColors[gIdx % groupColors.length];
                                return (
                                    <React.Fragment key={`group-${gIdx}`}>
                                        {group.members.map((member, mIdx) => (
                                            <ScheduleRow
                                                key={`row-${gIdx}-${mIdx}-${member.cpf}`}
                                                member={member}
                                                position={group.position}
                                                groupCount={mIdx === 0 ? group.count : ''}
                                                groupBg={bg}
                                                weeks={filteredWeeks}
                                                viewport={viewport}
                                                currentWeekKey={currentWeekKey}
                                                isOpening={openingColab === member.cpf}
                                                locale={locale}
                                                onNameClick={handleNameClick}
                                                onCellClick={handleCellClick}
                                                onHoverComment={handleHoverComment}
                                                onLeaveComment={handleLeaveComment}
                                                getWeekRotationMeta={getWeekRotationMeta}
                                                getCellStyle={getCellStyle}
                                            />
                                        ))}

                                        {gIdx < positionGroups.length - 1 && (
                                            <tr key={`div-${gIdx}`}>
                                                <td colSpan={7 + filteredWeeks.length} className="bg-white h-2 border-b border-black"></td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            <div className="flex items-center gap-3 text-xs px-3 py-1.5 border-t border-gray-200 shrink-0 bg-slate-50 overflow-x-auto">
                {legendItems.map((item) => (
                    <div key={item.code} className="flex items-center gap-1.5 flex-shrink-0">
                        <span
                            className="inline-block text-center font-bold px-1.5 py-0.5 border border-black text-[10px]"
                            style={{ backgroundColor: item.color, color: item.textColor, minWidth: '38px' }}
                        >
                            {item.code}
                        </span>
                        <span className="text-slate-600 font-semibold text-xs whitespace-nowrap">{item.label}</span>
                    </div>
                ))}
                <div className="flex items-center gap-1.5 flex-shrink-0 bg-slate-200/80 text-slate-700 font-semibold text-[10px] px-2 py-0.5 rounded-md ml-1">
                    <span className="font-mono font-bold">d.X</span>
                    <span className="font-normal text-slate-600">= Dia inicial do evento</span>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0 text-slate-600 ml-auto">
                    <span className="relative flex h-2 w-2 mr-0.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-600"></span>
                    </span>
                    <FiMessageSquare className="w-3 h-3 text-blue-600" />
                    <span className="text-[10px] font-medium text-slate-700">= observação (passe o mouse)</span>
                </div>
            </div>

            {/* Animated Floating Speech Bubble for Observações / Comments */}
            {hoveredComment && (
                <div
                    className="fixed z-50 pointer-events-none transition-all duration-200 ease-out transform -translate-x-1/2 -translate-y-full mb-2"
                    style={{
                        left: `${hoveredComment.x}px`,
                        top: `${Math.max(65, hoveredComment.y - 6)}px`,
                        width: '280px',
                    }}
                >
                    <div className="bg-slate-900/95 text-white rounded-2xl p-3 shadow-2xl ring-1 ring-white/20 backdrop-blur-md border border-slate-700/80 animate-in fade-in zoom-in-95 duration-150 relative drop-shadow-2xl">
                        {/* Header */}
                        <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2 mb-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                                <span
                                    className="px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 border border-black/40 shadow-xs"
                                    style={{
                                        backgroundColor: hoveredComment.style?.bg || '#3b82f6',
                                        color: hoveredComment.style?.text || '#ffffff',
                                    }}
                                >
                                    {hoveredComment.status}
                                </span>
                                <span className="text-[11px] font-bold text-slate-100 uppercase truncate">
                                    {hoveredComment.name}
                                </span>
                            </div>
                        </div>

                        {/* Event info tags */}
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-2 flex-wrap">
                            {hoveredComment.startFormatted && (
                                <span className="bg-slate-800 px-2 py-0.5 rounded-md font-mono text-emerald-300 font-semibold border border-slate-700/60">
                                    📅 Início: {hoveredComment.startFormatted}
                                </span>
                            )}
                            {hoveredComment.vessel && (
                                <span className="bg-slate-800 px-2 py-0.5 rounded-md text-sky-300 font-medium border border-slate-700/60 truncate max-w-[130px]">
                                    🚢 {hoveredComment.vessel}
                                </span>
                            )}
                        </div>

                        {/* Comment Body */}
                        <div className="bg-slate-800/80 rounded-xl p-2.5 border border-slate-700/60 flex items-start gap-2">
                            <FiMessageSquare className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                            <p className="text-xs text-slate-100 font-normal leading-relaxed break-words whitespace-pre-wrap">
                                {hoveredComment.observacoes}
                            </p>
                        </div>

                        {/* Footer */}
                        <div className="mt-2 pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[9px] text-slate-400">
                            <span className="text-blue-300 font-semibold">Semana {hoveredComment.weekDate}</span>
                            <span className="text-slate-400">Clique na célula para editar</span>
                        </div>

                        {/* Speech Bubble Arrow */}
                        <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-900/95 border-b border-r border-slate-700/80 transform rotate-45" />
                    </div>
                </div>
            )}

            {selectedCell && (
                <div
                    className="fixed z-50 pointer-events-auto"
                    style={{
                        left: `${modalPos?.x ?? (typeof window !== 'undefined' ? Math.max(20, window.innerWidth - 440) : 40)}px`,
                        top: `${modalPos?.y ?? 110}px`,
                        width: '420px',
                        maxWidth: 'calc(100vw - 32px)',
                    }}
                >
                    <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col transition-shadow duration-200 ring-1 ring-black/10">
                        {/* Draggable Header */}
                        <div
                            onMouseDown={handleDragStart}
                            onTouchStart={handleTouchStart}
                            className="bg-slate-100/90 px-4 py-3 border-b border-slate-200 flex items-center justify-between cursor-move select-none group"
                        >
                            <div className="flex items-center gap-2">
                                <div className="p-1 rounded bg-slate-200 text-slate-600 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                                    <FiMove className="w-3.5 h-3.5" />
                                </div>
                                <div>
                                    <h3 className="text-xs font-bold text-slate-800 tracking-tight flex items-center gap-1.5">
                                        {editingLocal ? 'Editar Evento de Escala' : 'Novo Evento de Escala'}
                                        {editingLocal && (
                                            <span className="px-1.5 py-0.5 rounded text-[9px] bg-amber-100 text-amber-800 font-bold uppercase">
                                                Local
                                            </span>
                                        )}
                                    </h3>
                                    <p className="text-[10px] text-slate-500 font-normal">Arraste para mover o painel</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedCell(null)}
                                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors font-bold text-base"
                                title="Fechar"
                            >
                                &times;
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-4 flex flex-col gap-3 max-h-[calc(100vh-200px)] overflow-y-auto">
                            {/* Tripulante Details Card */}
                            <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100 flex items-center justify-between">
                                <div className="truncate mr-2">
                                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Tripulante</span>
                                    <p className="text-xs font-bold text-slate-900 uppercase truncate">{selectedCell.name}</p>
                                </div>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-mono font-medium shrink-0">
                                    {selectedCell.cpf}
                                </span>
                            </div>

                            {/* Event Type & Vessel */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Tipo de Evento</label>
                                    <select
                                        value={formTipo}
                                        onChange={(e) => setFormTipo(e.target.value)}
                                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                                    >
                                        {activeTiposForSelect.map((tipo) => (
                                            <option key={tipo.id} value={tipo.codigo}>
                                                {tipo.label} ({tipo.display_code})
                                            </option>
                                        ))}
                                    </select>
                                    {resolveTipo(formTipo) && (
                                        <div className="mt-1.5 flex items-center gap-1.5">
                                            <span
                                                className="inline-block min-w-[36px] text-center font-bold px-1.5 py-0.5 border border-black/80 rounded-sm text-[10px]"
                                                style={{
                                                    backgroundColor: resolveTipo(formTipo)!.bg_color,
                                                    color: resolveTipo(formTipo)!.text_color,
                                                }}
                                            >
                                                {resolveTipo(formTipo)!.display_code}
                                            </span>
                                            <span className="text-[10px] text-slate-500 truncate">{resolveTipo(formTipo)!.label}</span>
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Embarcação / Destino</label>
                                    <input
                                        type="text"
                                        value={formVessel}
                                        onChange={(e) => setFormVessel(e.target.value)}
                                        placeholder="Ex: NORMAND..."
                                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                                    />
                                </div>
                            </div>

                            {/* Dates */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Data Início</label>
                                    <input
                                        type="date"
                                        value={formStart}
                                        onChange={(e) => setFormStart(e.target.value)}
                                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Data Fim</label>
                                    <input
                                        type="date"
                                        value={formEnd}
                                        onChange={(e) => setFormEnd(e.target.value)}
                                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                                    />
                                </div>
                            </div>

                            {/* Toggle Indicação do Dia de Início */}
                            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition-colors">
                                <div className="pr-3">
                                    <label htmlFor="exibir-dia-toggle" className="text-xs font-semibold text-slate-800 cursor-pointer block">
                                        Indicar dia de início na célula (d.X)
                                    </label>
                                    <p className="text-[11px] text-slate-500 mt-0.5">
                                        Exibe o dia de início ({formStart ? `d.${parseInt(formStart.split('-')[2] || '0', 10)}` : 'd.X'}) na célula da escala
                                    </p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                                    <input
                                        id="exibir-dia-toggle"
                                        type="checkbox"
                                        checked={formExibirDia}
                                        onChange={(e) => setFormExibirDia(e.target.checked)}
                                        className="sr-only peer"
                                    />
                                    <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                                </label>
                            </div>

                            {/* Origin / Local Embarque */}
                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">Local de Embarque (Origem)</label>
                                <input
                                    type="text"
                                    value={formLocalEmb}
                                    onChange={(e) => setFormLocalEmb(e.target.value)}
                                    placeholder="Cidade, Aeroporto ou Base"
                                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                                />
                            </div>

                            {/* Observations */}
                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">Observações / Comentários</label>
                                <textarea
                                    value={formObs}
                                    onChange={(e) => setFormObs(e.target.value)}
                                    placeholder="Informações adicionais..."
                                    rows={2}
                                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white resize-none"
                                />
                            </div>

                            {/* Actions Footer */}
                            <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-200 mt-1">
                                {editingLocal ? (
                                    <button
                                        onClick={handleDeleteEvent}
                                        disabled={submittingEvent}
                                        className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 disabled:opacity-50 transition-colors shadow-sm"
                                    >
                                        Excluir Evento
                                    </button>
                                ) : (
                                    <div />
                                )}
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setSelectedCell(null)}
                                        className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-100 transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleSaveEvent}
                                        disabled={submittingEvent}
                                        className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm flex items-center gap-1.5"
                                    >
                                        {submittingEvent ? (
                                            <>
                                                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                Salvando...
                                            </>
                                        ) : (
                                            'Salvar'
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Fechamento Mensal DP & Aprovação Digital */}
            <ModalAprovacaoFechamento
                isOpen={isFechamentoOpen}
                onClose={() => setIsFechamentoOpen(false)}
                filters={{
                    empresa: filterCompany,
                    embarcacao: filterVessel,
                    cargo: filterPosition,
                    statusAtivo: filterStatusAtivo,
                    busca: searchName,
                    dataInicio: filterDateStart,
                    dataFim: filterDateEnd,
                }}
            />
        </div>
    );
}
