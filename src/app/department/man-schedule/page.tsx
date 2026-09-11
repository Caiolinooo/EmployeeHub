'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { FiDownload, FiSearch } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx-js-style';
import { useI18n } from '@/contexts/I18nContext';
import { fetchWithToken } from '@/lib/tokenStorage';
import ScheduleDateFilterInput from '@/components/gestao-tripulantes/ScheduleDateFilterInput';
import ManScheduleTimelineNav from '@/components/gestao-tripulantes/ManScheduleTimelineNav';
import GtPageShell from '@/components/gestao-tripulantes/GtPageShell';
import {
    MAN_SCHEDULE_SCROLL_CLASS,
    MAN_SCHEDULE_STICKY_EDGE_CLASS,
    MAN_SCHEDULE_STICKY_NAME_CLASS,
    MAN_SCHEDULE_TABLE_CLASS,
    MAN_SCHEDULE_THEAD_CLASS,
    MAN_SCHEDULE_TOP_SCROLL_CLASS,
} from '@/components/gestao-tripulantes/man-schedule-grid-classes';
import { useManScheduleScrollSync } from '@/components/gestao-tripulantes/use-man-schedule-scroll-sync';
import { parseCompleteFilterDate } from '@/lib/gestao-tripulantes/filter-date';
import { civilTodayYmd, countPobOnCivilDay, scheduleDisplayCode } from '@/lib/gestao-tripulantes/embarque-status';
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
    realtimeJanelaForReferenceMonth,
    shiftReferenceMonth,
    type ReferenceMonth,
} from '@/lib/gestao-tripulantes/man-schedule-reference-month';
import { pickOverlappingRotation, type RotationLike } from '@/lib/gestao-tripulantes/escala-contagem';

interface CrewSchedule {
    id: string;
    cpf: string;
    full_name: string;
    position: string;
    vessel: string;
    company: string;
    rotation_start: string | null;
    rotation_end: string | null;
    embarque_status: string | null;
    local_embarque: string;
    rotation_type: string;
    origem?: 'mio' | 'local';
}

type ScheduleRotation = RotationLike & {
    exibir_dia_inicio?: boolean;
};

interface ApiMeta {
    vessels: string[];
    positions: string[];
    companies: string[];
}

// Position display order — positions not listed here go to the end, sorted alphabetically
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
    const idx = POSITION_ORDER.findIndex(p => norm.includes(p) || p.includes(norm));
    return idx >= 0 ? idx : 999;
}

export default function ManSchedulePage() {
    const { t, locale } = useI18n();
    const [allSchedules, setAllSchedules] = useState<CrewSchedule[]>([]);
    const [meta, setMeta] = useState<ApiMeta>({ vessels: [], positions: [], companies: [] });
    const [loading, setLoading] = useState(true);

    // Filters
    const [searchName, setSearchName] = useState('');
    const [filterVessel, setFilterVessel] = useState('');
    const [filterCompany, setFilterCompany] = useState('');
    const [filterPosition, setFilterPosition] = useState('');
    const [filterDateStart, setFilterDateStart] = useState('');
    const [filterDateEnd, setFilterDateEnd] = useState('');
    const [referenceMonth, setReferenceMonth] = useState<ReferenceMonth>(() => civilReferenceMonth());

    useEffect(() => {
        const stored = readReferenceMonthPreference();
        if (stored) setReferenceMonth(stored);
    }, []);

    const applyReferenceMonth = useCallback((next: ReferenceMonth) => {
        const clamped = clampReferenceMonth(next);
        setReferenceMonth(clamped);
        persistReferenceMonthPreference(clamped);
    }, []);

    const janela = useMemo(
        () => realtimeJanelaForReferenceMonth(referenceMonth),
        [referenceMonth],
    );

    const fetchSchedules = useCallback(async () => {
        try {
            const qs = janela === '90d' ? '' : `?janela=${janela}`;
            const res = await fetchWithToken(`/api/man-schedule/realtime${qs}`);
            if (!res.ok) {
                if (res.status === 503) {
                    throw new Error('Cache MIO indisponível. Por favor, atualize o cache no painel administrativo.');
                }
                throw new Error('Erro ao buscar dados da escala.');
            }
            const result = await res.json();
            if (!result.success) throw new Error(result.error || 'Erro na API');
            setAllSchedules(result.data || []);
            if (result.meta) setMeta(result.meta);
        } catch (error: any) {
            console.error('Error fetching schedules:', error);
            toast.error(error.message || t('common.error', 'Erro ao carregar escala do MIO.'));
        } finally {
            setLoading(false);
        }
    }, [t, janela]);

    useEffect(() => { fetchSchedules(); }, [fetchSchedules]);

    // ─── Filtered data & Cascading Dropdowns ───
    const filteredSchedules = useMemo(() => {
        const sName = searchName.trim().toLowerCase();
        const fVes = filterVessel.trim().toLowerCase();
        const fComp = filterCompany.trim().toLowerCase();
        const fPos = filterPosition.trim().toLowerCase();

        return allSchedules.filter(s => {
            const matchName = !sName || s.full_name?.toLowerCase().includes(sName);
            const matchVessel = !fVes || (s.vessel || '').trim().toLowerCase() === fVes;
            const matchCompany = !fComp || (s.company || '').trim().toLowerCase() === fComp;
            const matchPosition = !fPos || (s.position || '').trim().toLowerCase() === fPos;
            return matchName && matchVessel && matchCompany && matchPosition;
        });
    }, [allSchedules, searchName, filterVessel, filterCompany, filterPosition]);

    const availableCompanies = useMemo(() => {
        const fVes = filterVessel.trim().toLowerCase();
        const fPos = filterPosition.trim().toLowerCase();
        const valid = allSchedules.filter(s => 
            (!fVes || (s.vessel || '').trim().toLowerCase() === fVes) &&
            (!fPos || (s.position || '').trim().toLowerCase() === fPos)
        ).map(s => (s.company || '').trim()).filter(Boolean);
        return Array.from(new Set(valid)).sort();
    }, [allSchedules, filterVessel, filterPosition]);

    const availableVessels = useMemo(() => {
        const fComp = filterCompany.trim().toLowerCase();
        const fPos = filterPosition.trim().toLowerCase();
        const valid = allSchedules.filter(s => 
            (!fComp || (s.company || '').trim().toLowerCase() === fComp) &&
            (!fPos || (s.position || '').trim().toLowerCase() === fPos)
        ).map(s => (s.vessel || '').trim()).filter(Boolean);
        return Array.from(new Set(valid)).sort();
    }, [allSchedules, filterCompany, filterPosition]);

    const availablePositions = useMemo(() => {
        const fComp = filterCompany.trim().toLowerCase();
        const fVes = filterVessel.trim().toLowerCase();
        const valid = allSchedules.filter(s => 
            (!fComp || (s.company || '').trim().toLowerCase() === fComp) &&
            (!fVes || (s.vessel || '').trim().toLowerCase() === fVes)
        ).map(s => (s.position || '').trim()).filter(Boolean);
        return Array.from(new Set(valid)).sort();
    }, [allSchedules, filterCompany, filterVessel]);

    // ─── Build dynamic rows grouped by position ───
    const positionGroups = useMemo(() => {
        const byPosition: Record<string, { name: string; cpf: string; rotations: ScheduleRotation[] }[]> = {};

        for (const s of filteredSchedules) {
            const pos = normalizePosition(s.position) || 'SEM CARGO';
            if (!byPosition[pos]) byPosition[pos] = [];

            const existing = byPosition[pos].find(c => c.cpf === s.cpf);
            if (existing) {
                if (s.rotation_start || s.rotation_end) {
                    existing.rotations.push({ start: s.rotation_start, end: s.rotation_end, type: s.rotation_type || 'normal', exibir_dia_inicio: (s as any).exibir_dia_inicio, origem: (s as any).origem });
                }
            } else {
                byPosition[pos].push({
                    name: s.full_name,
                    cpf: s.cpf,
                    rotations: (s.rotation_start || s.rotation_end)
                        ? [{ start: s.rotation_start, end: s.rotation_end, type: s.rotation_type || 'normal', exibir_dia_inicio: (s as any).exibir_dia_inicio, origem: (s as any).origem }]
                        : []
                });
            }
        }

        return Object.entries(byPosition)
            .sort(([a], [b]) => getPositionSortKey(a) - getPositionSortKey(b) || a.localeCompare(b))
            .map(([position, members]) => ({ position, members, count: members.length }));
    }, [filteredSchedules]);

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
            viewport: 'week',
            referenceMonth,
            rotationDates,
            filterStart: parseCompleteFilterDate(filterDateStart),
            filterEnd: parseCompleteFilterDate(filterDateEnd),
        });
    }, [positionGroups, referenceMonth, filterDateStart, filterDateEnd]);

    const filteredWeeks = useMemo(() => {
        const startDate = parseCompleteFilterDate(filterDateStart);
        const endDate = parseCompleteFilterDate(filterDateEnd);
        if (!startDate && !endDate) return weeks;

        return weeks.filter((w) => {
            const { start: colStart, end: colEnd } = columnPeriod(w.date, 'week');
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
    }, [weeks, filterDateStart, filterDateEnd]);

    const {
        tableContainerRef,
        topScrollRef,
        tableScrollWidth,
        handleTopScroll,
        handleTableScroll,
    } = useManScheduleScrollSync(filteredWeeks.length);

    const todayYmd = civilTodayYmd();
    const todayColumnIndex = useMemo(
        () => indexOfCivilDay(filteredWeeks, todayYmd, 'week'),
        [filteredWeeks, todayYmd],
    );
    const isCurrentMonth = isSameReferenceMonth(referenceMonth, civilReferenceMonth());
    const focusIndex = useMemo(
        () => focusColumnIndex(filteredWeeks, referenceMonth, 'week', todayYmd),
        [filteredWeeks, referenceMonth, todayYmd],
    );

    const todayPobCount = useMemo(() => {
        return countPobOnCivilDay(
            positionGroups.flatMap((group) => group.members),
            todayYmd,
        );
    }, [positionGroups, todayYmd]);

    const scrollToColumn = useCallback((index: number) => {
        const root = tableContainerRef.current;
        if (!root) return;
        scrollScheduleColumnIntoView(root, adjacentColumnIndex(index, 0, filteredWeeks.length));
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
    }, [loading, filteredWeeks.length, focusIndex, referenceMonth.year, referenceMonth.month, scrollToColumn]);

    // ─── Format helpers ───
    const formatHeaderDate = (d: Date) => {
        const dayStr = d.getDate().toString().padStart(2, '0');
        const monthStr = d.toLocaleString(locale === 'en-US' ? 'en-US' : 'pt-BR', { month: 'short' });
        const yearStr = d.getFullYear().toString().substring(2);
        const capitalizedMonth = monthStr.charAt(0).toUpperCase() + monthStr.slice(1).replace('.', '');
        return `${dayStr}-${capitalizedMonth}-${yearStr}`;
    };

    const getDayAbbr = (d: Date) => {
        return d.toLocaleString(locale === 'en-US' ? 'en-US' : 'pt-BR', { weekday: 'short' }).replace('.', '');
    };

    // ─── Check exact rotation status for the week ───
    const getWeekRotationMeta = (weekDate: Date, rotations: ScheduleRotation[]): { status: string; dayLabel?: string } => {
        const wStart = new Date(weekDate);
        wStart.setHours(0, 0, 0, 0);
        const wEnd = new Date(wStart);
        wEnd.setDate(wEnd.getDate() + 6);
        wEnd.setHours(23, 59, 59, 999);

        // Mesma regra da aba GT: início na coluna, início mais recente,
        // tipo específico e lançamento manual (origem='local') vencem empates.
        const bestRot = pickOverlappingRotation(rotations, wStart, wEnd) as ScheduleRotation | null;

        if (!bestRot) return { status: '' };

        let dayLabel: string | undefined = undefined;
        if (bestRot.exibir_dia_inicio && bestRot.start) {
            const parsed = parseLocalDate(bestRot.start);
            if (parsed) {
                const directlyInWeek = parsed >= wStart && parsed <= wEnd;
                if (directlyInWeek) {
                    dayLabel = `d.${parsed.getDate()}`;
                } else {
                    // Se começou antes mas é a primeira semana visível
                    const prevWeek = new Date(wStart);
                    prevWeek.setDate(prevWeek.getDate() - 7);
                    const prevMeta = getWeekRotationMeta(prevWeek, rotations);
                    // Compara códigos de exibição (ON/OFF-C/...), nunca tipo cru vs display.
                    const isFirstWeek = !prevMeta.status || prevMeta.status !== scheduleDisplayCode(bestRot.type || 'normal');
                    if (isFirstWeek) {
                        dayLabel = `d.${parsed.getDate()}`;
                    }
                }
            }
        }

        const status = scheduleDisplayCode(bestRot.type || 'normal');
        return { status, dayLabel };
    };

    const getWeekStatus = (weekDate: Date, rotations: ScheduleRotation[]) => {
        return getWeekRotationMeta(weekDate, rotations).status;
    };

    // ─── Vessel display name ───
    const vesselDisplayName = filterVessel && filterCompany
        ? `${filterCompany.toUpperCase()} - ${filterVessel.toUpperCase()}`
        : filterVessel 
            ? filterVessel.toUpperCase()
            : filterCompany
                ? filterCompany.toUpperCase()
                : t('manSchedule.allVessels', 'Todas as Embarcações');

    // ─── Export ───
    const exportToExcel = () => {
        const table = document.getElementById('man-schedule-table');
        if (!table) return;
        const wb = XLSX.utils.table_to_book(table, { sheet: 'Schedule' });
        const ws = wb.Sheets['Schedule'];
        
        const colWidths = [
            { wch: 35 }, 
            { wch: 8 },  
            { wch: 25 }, 
            ...filteredWeeks.map(() => ({ wch: 12 }))
        ];
        ws['!cols'] = colWidths;

        const range = XLSX.utils.decode_range(ws['!ref'] || "A1:Z100");
        for (let R = range.s.r; R <= range.e.r; ++R) {
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cell_address = { c: C, r: R };
                const cell_ref = XLSX.utils.encode_cell(cell_address);
                const cell = ws[cell_ref];
                
                if (!cell) continue;

                const defaultBorder = { 
                    top: { style: "thin", color: { rgb: "000000" } }, 
                    bottom: { style: "thin", color: { rgb: "000000" } }, 
                    left: { style: "thin", color: { rgb: "000000" } }, 
                    right: { style: "thin", color: { rgb: "000000" } } 
                };

                const cellStyle: any = {
                    alignment: { vertical: "center", horizontal: "center", wrapText: true }
                };

                if (typeof cell.v === 'string') {
                    cell.v = cell.v.replace(/\n|&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
                }

                if (R === 0) {
                    cellStyle.font = { bold: true, color: { rgb: C < 3 ? "FFFFFF" : "002060" }, sz: 12 };
                    cellStyle.fill = { fgColor: { rgb: C < 3 ? "002060" : "E2EFDA" } };
                    cellStyle.border = defaultBorder;
                } else if (R === 1 || R === 2) {
                    cellStyle.font = { bold: true, color: { rgb: "000000" }, sz: 10 };
                    cellStyle.border = defaultBorder;
                } else {
                    const rawVal = typeof cell.v === 'string' ? cell.v.trim() : '';
                    const match = rawVal.match(/^([A-Za-z0-9\-_]+)(?:\s+(d\.\d+))?$/i);
                    const baseCode = match ? match[1].toUpperCase() : rawVal;
                    const daySuffix = match && match[2] ? match[2] : '';

                    if (baseCode === 'ON*' || baseCode === '*') {
                        cellStyle.fill = { fgColor: { rgb: "C6D9F0" } };
                        cellStyle.font = { color: { rgb: "1F4E79" }, bold: true, sz: 10 };
                        cellStyle.border = defaultBorder;
                        cell.v = daySuffix ? `${baseCode}\n${daySuffix}` : baseCode;
                    } else if (baseCode === 'ON' || baseCode === 'FI' || baseCode === 'DBA') {
                        cellStyle.fill = { fgColor: { rgb: "E2EFDA" } };
                        cellStyle.font = { color: { rgb: "00B050" }, bold: true, sz: 10 };
                        cellStyle.border = defaultBorder;
                        cell.v = daySuffix ? `${baseCode}\n${daySuffix}` : baseCode;
                    } else if (baseCode === 'OFF-C' || baseCode === 'STB') {
                        cellStyle.fill = { fgColor: { rgb: "F4CCCC" } };
                        cellStyle.font = { color: { rgb: "CC0000" }, bold: true, sz: 10 };
                        cellStyle.border = defaultBorder;
                        cell.v = daySuffix ? `${baseCode}\n${daySuffix}` : baseCode;
                    } else if (cell.v) {
                        cellStyle.font = { color: { rgb: C === 0 ? "002060" : "000000" }, bold: C < 3, sz: 10 };
                        if (C === 1 || C === 2) cellStyle.fill = { fgColor: { rgb: "E7E6E6" } };
                        cellStyle.alignment.horizontal = C === 0 ? "left" : "center";
                        cellStyle.border = defaultBorder;
                    }
                }
                
                cell.s = cellStyle;
            }
        }

        // Add legend rows after the table data
        const lastRow = range.e.r + 3;
        const legendLabels: Record<string, string> = {
            'ON': t('manSchedule.legendOn', 'Embarcado'),
            'OFF-C': t('manSchedule.legendOffC', 'Troca de Turma'),
            'FI': t('manSchedule.legendFi', 'Folga Indenizada'),
            'DBA': t('manSchedule.legendDba', 'Dobra'),
            'STB': t('manSchedule.legendStb', 'StandBy'),
        };
        const legendColors: Record<string, string> = {
            'ON': 'E2EFDA', 'OFF-C': 'F4CCCC', 'FI': 'E2EFDA', 'DBA': 'E2EFDA', 'STB': 'F4CCCC'
        };
        const legendTextColors: Record<string, string> = {
            'ON': '00B050', 'OFF-C': 'CC0000', 'FI': '00B050', 'DBA': '00B050', 'STB': 'CC0000'
        };

        let legendCol = 0;
        for (const item of legendItems) {
            const codeCellRef = XLSX.utils.encode_cell({ c: legendCol, r: lastRow });
            const labelCellRef = XLSX.utils.encode_cell({ c: legendCol + 1, r: lastRow });
            
            ws[codeCellRef] = {
                v: item.code,
                s: {
                    fill: { fgColor: { rgb: legendColors[item.code] } },
                    font: { bold: true, color: { rgb: legendTextColors[item.code] }, sz: 10 },
                    alignment: { horizontal: "center", vertical: "center" },
                    border: {
                        top: { style: "thin", color: { rgb: "000000" } },
                        bottom: { style: "thin", color: { rgb: "000000" } },
                        left: { style: "thin", color: { rgb: "000000" } },
                        right: { style: "thin", color: { rgb: "000000" } }
                    }
                }
            };
            ws[labelCellRef] = {
                v: item.label,
                s: {
                    font: { bold: true, sz: 10 },
                    alignment: { horizontal: "left", vertical: "center" }
                }
            };
            legendCol += 3;
        }

        ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: lastRow, c: Math.max(range.e.c, legendCol) } });

        const safeName = (filterVessel || 'All_Vessels').replace(/[^a-zA-Z0-9_\-\s]/g, '').replace(/\s+/g, '_');
        XLSX.writeFile(wb, `Man_Schedule_${safeName}.xlsx`);
        toast.success(t('manSchedule.exportedSuccess', 'Planilha exportada com sucesso!'));
    };

    // ─── Alternating group background colors ───
    const groupColors = ['bg-[#d9e1f2]', 'bg-[#b4c6e7]'];

    // ─── Compute which statuses are present in the current view ───
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
    }, [positionGroups, filteredWeeks]);

    // ─── Legend definitions with i18n ───
    const legendItems = useMemo(() => {
        const allItems = [
            { code: 'ON', color: '#e2efda', textColor: '#00b050', label: t('manSchedule.legendOn', 'Embarcado') },
            { code: 'OFF-C', color: '#f4cccc', textColor: '#cc0000', label: t('manSchedule.legendOffC', 'Troca de Turma') },
            { code: 'FI', color: '#e2efda', textColor: '#00b050', label: t('manSchedule.legendFi', 'Folga Indenizada') },
            { code: 'DBA', color: '#e2efda', textColor: '#00b050', label: t('manSchedule.legendDba', 'Dobra') },
            { code: 'STB', color: '#f4cccc', textColor: '#cc0000', label: t('manSchedule.legendStb', 'StandBy') },
        ];
        return allItems.filter(item => presentStatuses.has(item.code));
    }, [presentStatuses, t]);

    return (
        <GtPageShell flush>
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center px-4 py-3 shrink-0 border-b border-gray-200 gap-3">
                <div>
                    <h1 className="text-xl font-bold text-gray-800">{t('manSchedule.title', 'Visualização de Matriz - Man Schedule')}</h1>
                    <p className="text-gray-500 text-sm">{t('manSchedule.subtitle', 'Representação exata da planilha matricial de escalas.')}</p>
                </div>
            </div>

            {/* Filters - Always visible */}
            <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 shrink-0">
                <div className="flex items-end gap-3 w-full flex-wrap">
                    <div className="min-w-[180px] flex-shrink-0">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">{t('manSchedule.searchLabel', 'Buscar')}</label>
                        <div className="relative">
                            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder={t('manSchedule.search', 'Buscar tripulante...')}
                                className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                                value={searchName}
                                onChange={(e) => setSearchName(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="min-w-[130px] flex-shrink-0">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">{t('manSchedule.companyLabel', 'Empresa')}</label>
                        <select
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white truncate"
                            value={filterCompany}
                            onChange={(e) => setFilterCompany(e.target.value)}
                        >
                            <option value="">{t('manSchedule.allCompanies', 'Todas')}</option>
                            {availableCompanies.map((comp, idx) => (
                                <option key={idx} value={comp}>{comp}</option>
                            ))}
                        </select>
                    </div>

                    <div className="min-w-[130px] flex-shrink-0">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">{t('manSchedule.vesselLabel', 'Embarcação')}</label>
                        <select
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white truncate"
                            value={filterVessel}
                            onChange={(e) => setFilterVessel(e.target.value)}
                        >
                            <option value="">{t('manSchedule.allVessels', 'Todas')}</option>
                            {availableVessels.map((v, idx) => (
                                <option key={idx} value={v}>{v}</option>
                            ))}
                        </select>
                    </div>

                    <div className="min-w-[130px] flex-shrink-0">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">{t('manSchedule.positionLabel', 'Cargo')}</label>
                        <select
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white truncate"
                            value={filterPosition}
                            onChange={(e) => setFilterPosition(e.target.value)}
                        >
                            <option value="">{t('manSchedule.allPositions', 'Todos')}</option>
                            {availablePositions.map((p, idx) => (
                                <option key={idx} value={p}>{p}</option>
                            ))}
                        </select>
                    </div>

                    <div className="min-w-[140px] flex-shrink-0">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">{t('manSchedule.dateStart', 'Data Inicio')}</label>
                        <ScheduleDateFilterInput
                            aria-label={t('manSchedule.dateStart', 'Data Inicio')}
                            value={filterDateStart}
                            onCommit={setFilterDateStart}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                        />
                    </div>

                    <div className="min-w-[140px] flex-shrink-0">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">{t('manSchedule.dateEnd', 'Data Fim')}</label>
                        <ScheduleDateFilterInput
                            aria-label={t('manSchedule.dateEnd', 'Data Fim')}
                            value={filterDateEnd}
                            onCommit={setFilterDateEnd}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                        />
                    </div>

                    <ManScheduleTimelineNav
                        loading={loading}
                        pobCount={todayPobCount}
                        viewport="week"
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

                    <button
                        type="button"
                        onClick={exportToExcel}
                        className="flex items-center gap-2 bg-green-600 text-white px-4 py-1.5 rounded shadow hover:bg-green-700 transition font-medium text-sm flex-shrink-0 self-end"
                    >
                        <FiDownload />
                        {t('manSchedule.exportXLSX', 'Exportar XLSX')}
                    </button>
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

            {/* Matrix Table - Scrollable area */}
            <div
                ref={tableContainerRef}
                onScroll={handleTableScroll}
                data-testid="man-schedule-scroll"
                className={MAN_SCHEDULE_SCROLL_CLASS}
            >
                <table id="man-schedule-table" className={MAN_SCHEDULE_TABLE_CLASS}>
                    <thead className={MAN_SCHEDULE_THEAD_CLASS}>
                        {/* Row 1: Vessel name */}
                        <tr>
                            <th
                                colSpan={3}
                                className="bg-[#002060] text-white text-left px-2 py-4 font-bold border-r border-b border-black align-top sticky left-0 z-30"
                                style={{ fontSize: '14px', minWidth: '300px' }}
                            >
                                {vesselDisplayName}
                            </th>
                            <th
                                colSpan={filteredWeeks.length}
                                className="bg-[#e2efda] text-center border-b border-black p-2 font-bold uppercase text-[#002060]"
                                style={{ fontSize: '11px' }}
                            >
                                {t('manSchedule.timeline', 'CRONOGRAMA DE ESCALAS')}
                            </th>
                        </tr>

                        {/* Row 2: Column headers + dates (vertical) */}
                        <tr>
                            <th className={`${MAN_SCHEDULE_STICKY_NAME_CLASS} bg-white text-black font-bold text-center border-r border-b border-black sticky left-0 z-30 min-w-[300px] w-[300px] px-2 py-2`}>
                                {t('manSchedule.tableHeaders.name', 'NOME')}
                            </th>
                            <th className="bg-white text-black font-bold text-center border-r border-b border-black sticky left-[300px] z-30 px-2 py-2 w-[80px] min-w-[80px]">
                                {t('manSchedule.tableHeaders.reqOnboard', "QTD.\nEMBARC").split('\n').map((line, i, arr) => (
                                    <React.Fragment key={i}>
                                        {line}{i !== arr.length - 1 && <br />}
                                    </React.Fragment>
                                ))}
                            </th>
                            <th
                                className={`bg-white ${MAN_SCHEDULE_STICKY_EDGE_CLASS} text-black font-bold text-center border-r border-b border-black sticky left-[380px] z-30 px-4 py-2 min-w-[150px] w-[150px]`}
                                data-man-schedule-sticky-end=""
                            >
                                {t('manSchedule.tableHeaders.rank', 'CARGO')}
                            </th>
                            {filteredWeeks.map((week, idx) => {
                                const isCurrentWeek = todayColumnIndex >= 0 && idx === todayColumnIndex;
                                return (
                                <th
                                    key={`date-${idx}`}
                                    data-man-schedule-col={idx}
                                    data-man-schedule-today={isCurrentWeek ? '1' : undefined}
                                    className={`text-center border-r border-b align-bottom pt-2 pb-1 ${
                                        isCurrentWeek 
                                            ? 'bg-yellow-100 text-yellow-800 font-bold border-yellow-500 border-2' 
                                            : 'bg-[#e2efda] text-[#00b050] font-bold border-black'
                                    }`}
                                    style={{ height: '90px' }}
                                >
                                    <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', display: 'inline-block', letterSpacing: '0.5px', fontSize: '11px' }}>
                                        {formatHeaderDate(week.date)}
                                    </div>
                                </th>
                                );
                            })}
                        </tr>

                        {/* Row 3: Day of week */}
                        <tr>
                            <th className={`${MAN_SCHEDULE_STICKY_NAME_CLASS} bg-white border-r border-b border-black sticky left-0 z-30`}></th>
                            <th className="bg-white border-r border-b border-black sticky left-[300px] z-30"></th>
                            <th className={`bg-white ${MAN_SCHEDULE_STICKY_EDGE_CLASS} border-r border-b border-black sticky left-[380px] z-30`}></th>
                            {filteredWeeks.map((week, idx) => {
                                const isCurrentWeek = todayColumnIndex >= 0 && idx === todayColumnIndex;
                                return (
                                <th
                                    key={`day-${idx}`}
                                    className={`text-center border-r border-b py-0.5 ${
                                        isCurrentWeek 
                                            ? 'bg-yellow-100 text-yellow-800 font-bold border-yellow-500 border-2' 
                                            : 'bg-[#e2efda] text-[#00b050] font-bold border-black'
                                    }`}
                                    style={{ fontSize: '11px' }}
                                >
                                    {getDayAbbr(week.date)}
                                </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={3 + filteredWeeks.length} className="px-4 py-8 text-center text-gray-500 bg-white">
                                    {t('manSchedule.loading', 'Carregando dados do MIO...')}
                                </td>
                            </tr>
                        ) : positionGroups.length === 0 ? (
                            <tr>
                                <td colSpan={3 + filteredWeeks.length} className="px-4 py-8 text-center text-gray-400 bg-white">
                                    {t('manSchedule.empty', 'Nenhum tripulante encontrado para os filtros selecionados.')}
                                </td>
                            </tr>
                        ) : (
                            positionGroups.map((group, gIdx) => {
                                const bg = groupColors[gIdx % groupColors.length];
                                return (
                                    <React.Fragment key={`group-${gIdx}`}>
                                        {/* Position group rows */}
                                        {group.members.map((member, mIdx) => (
                                            <tr key={`row-${gIdx}-${mIdx}`}>
                                                {/* NAME */}
                                                <td className={`${MAN_SCHEDULE_STICKY_NAME_CLASS} bg-white text-blue-900 font-bold px-2 py-1 border-r border-b border-black whitespace-nowrap overflow-hidden sticky left-0 z-20 uppercase`}>
                                                    {member.name || '\u00A0'}
                                                </td>
                                                {/* QTD (show only on first row of the group) */}
                                                <td className={`${bg} text-black font-bold text-center border-r border-b border-black sticky left-[300px] z-20`}>
                                                    {mIdx === 0 ? group.count : ''}
                                                </td>
                                                {/* POSITION */}
                                                <td className={`${bg} ${MAN_SCHEDULE_STICKY_EDGE_CLASS} text-black font-bold px-2 py-1 border-r border-b border-black uppercase sticky left-[380px] z-20`}>
                                                    {group.position}
                                                </td>
                                                {/* Timeline cells */}
                                                 {filteredWeeks.map((week, wIdx) => {
                                                    const meta = getWeekRotationMeta(week.date, member.rotations);
                                                    const status = meta.status;
                                                    const dayLabel = meta.dayLabel;
                                                    const isCurrentWeek = todayColumnIndex >= 0 && wIdx === todayColumnIndex;
                                                    let cellClass = 'bg-white border-[#d1d5db]';
                                                    if (status === 'ON*') cellClass = 'bg-[#c6d9f0] text-[#1f4e79] font-bold border-black';
                                                    else if (status === 'ON' || status === 'FI' || status === 'DBA') cellClass = 'bg-[#e2efda] text-[#00b050] font-bold border-black';
                                                    else if (status === 'OFF-C' || status === 'STB') cellClass = 'bg-[#f4cccc] text-[#cc0000] font-bold border-black';
                                                    
                                                    if (isCurrentWeek) {
                                                        cellClass = `${cellClass} !bg-yellow-100 !border-yellow-500 !border-2`;
                                                    }

                                                    return (
                                                        <td
                                                            key={`cell-${gIdx}-${mIdx}-${wIdx}`}
                                                            className={`${cellClass} border-r border-b text-center`}
                                                            style={{ width: '24px', minWidth: '24px', fontSize: '9px' }}
                                                        >
                                                            <div className="flex flex-col items-center justify-center leading-none py-0.5">
                                                                <span>{status === 'FI' ? 'FI' : status === 'DBA' ? 'DBA' : status === 'STB' ? 'STB' : status === 'OFF-C' ? 'OFF-C' : status || '-'}</span>
                                                                {dayLabel && (
                                                                    <span className="text-[7.5px] opacity-75 font-normal tracking-tighter mt-0.5">{dayLabel}</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}

                                        {/* Divider between groups */}
                                        {gIdx < positionGroups.length - 1 && (
                                            <tr key={`div-${gIdx}`}>
                                                <td colSpan={3 + filteredWeeks.length} className="bg-white h-2 border-b border-black"></td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Legend - Always visible at bottom */}
            <div className="flex items-center gap-4 text-xs px-4 py-1.5 border-t border-gray-200 shrink-0 bg-white overflow-x-auto">
                {legendItems.map(item => (
                    <div key={item.code} className="flex items-center gap-1.5 flex-shrink-0">
                        <span
                            className="inline-block text-center font-bold px-1.5 py-0.5 border border-black text-xs"
                            style={{ backgroundColor: item.color, color: item.textColor, minWidth: '40px' }}
                        >
                            {item.code}
                        </span>
                        <span className="text-gray-700 font-semibold whitespace-nowrap">{item.label}</span>
                    </div>
                ))}
                <div className="flex items-center gap-1.5 flex-shrink-0 text-slate-600 font-semibold text-xs whitespace-nowrap ml-2">
                    <span className="font-mono text-[9px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded border border-slate-300 font-bold">d.X</span>
                    <span className="text-[11px] text-slate-600">= Dia inicial do evento</span>
                </div>
            </div>
        </GtPageShell>
    );
}
