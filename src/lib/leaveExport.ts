/**
 * Export helpers for leave (férias) requests — XLSX / CSV.
 */
import * as XLSX from 'xlsx-js-style';

export type LeaveExportRow = {
  id: string;
  user_id?: string;
  start_date: string;
  end_date: string;
  status: string;
  justification?: string | null;
  rejection_reason?: string | null;
  pecuniary_allowance?: boolean | null;
  advance_13th_salary?: boolean | null;
  created_at?: string;
  updated_at?: string;
  periods?: Array<{ start_date: string; end_date: string; duration?: number }> | null;
  user?: {
    name?: string | null;
    email?: string | null;
    sector?: { name?: string | null } | null;
  } | null;
};

const STATUS_LABELS: Record<string, string> = {
  PENDING_LEADER: 'Aguardando Líder',
  PENDING_MANAGER: 'Aguardando Gerente',
  APPROVED: 'Aprovado',
  REJECTED: 'Rejeitado',
  CANCELLED: 'Cancelado',
};

function formatPeriods(
  periods?: Array<{ start_date: string; end_date: string; duration?: number }> | null
): string {
  if (!periods || periods.length === 0) return '';
  return periods
    .map((p, i) => {
      const days = p.duration != null ? ` (${p.duration}d)` : '';
      return `${i + 1}: ${p.start_date}→${p.end_date}${days}`;
    })
    .join(' | ');
}

function calcDays(start: string, end: string): number {
  try {
    const s = new Date(start + 'T12:00:00');
    const e = new Date(end + 'T12:00:00');
    return Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  } catch {
    return 0;
  }
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('pt-BR');
  } catch {
    return iso;
  }
}

/** Build AOA for Excel/CSV from leave request records. */
export function buildLeaveExportAoa(
  rows: LeaveExportRow[],
  options?: { includeCollaborator?: boolean }
): (string | number | boolean)[][] {
  const includeCollaborator = options?.includeCollaborator !== false;
  const headers = [
    ...(includeCollaborator ? ['Colaborador', 'E-mail', 'Setor'] : []),
    'Data Início',
    'Data Fim',
    'Dias',
    'Períodos',
    'Status',
    'Status (código)',
    'Abono Pecuniário',
    'Adiantamento 13º',
    'Observações',
    'Motivo Rejeição',
    'Criado em',
    'Atualizado em',
    'ID',
  ];

  const data = rows.map((r) => {
    const base: (string | number | boolean)[] = [];
    if (includeCollaborator) {
      base.push(
        r.user?.name || '',
        r.user?.email || '',
        r.user?.sector?.name || ''
      );
    }
    base.push(
      r.start_date || '',
      r.end_date || '',
      calcDays(r.start_date, r.end_date),
      formatPeriods(r.periods),
      STATUS_LABELS[r.status] || r.status,
      r.status,
      r.pecuniary_allowance ? 'Sim' : 'Não',
      r.advance_13th_salary ? 'Sim' : 'Não',
      r.justification || '',
      r.rejection_reason || '',
      formatDateTime(r.created_at),
      formatDateTime(r.updated_at),
      r.id
    );
    return base;
  });

  return [headers, ...data];
}

export function downloadLeaveExcel(
  rows: LeaveExportRow[],
  filenamePrefix: string,
  options?: { includeCollaborator?: boolean }
): void {
  const aoa = buildLeaveExportAoa(rows, options);
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let C = range.s.c; C <= range.e.c; C++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c: C });
    if (!ws[addr]) continue;
    ws[addr].s = {
      font: { name: 'Calibri', sz: 11, bold: true },
      fill: { fgColor: { rgb: 'E8EDF5' } },
      alignment: { vertical: 'center', wrapText: true },
    };
  }
  ws['!cols'] = aoa[0].map((_, i) => ({
    wch: i === 0 && options?.includeCollaborator !== false ? 28 : 16,
  }));
  XLSX.utils.book_append_sheet(wb, ws, 'Férias');
  XLSX.writeFile(wb, `${filenamePrefix}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function downloadLeaveCsv(
  rows: LeaveExportRow[],
  filenamePrefix: string,
  options?: { includeCollaborator?: boolean }
): void {
  const aoa = buildLeaveExportAoa(rows, options);
  const escape = (v: string | number | boolean) => {
    const s = String(v ?? '');
    if (/[",;\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const csv = aoa.map((row) => row.map(escape).join(';')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filenamePrefix}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Years present in a leave list (from start_date), descending. */
export function extractLeaveYears(rows: Array<{ start_date?: string }>): number[] {
  const years = new Set<number>();
  const current = new Date().getFullYear();
  years.add(current);
  years.add(current - 1);
  for (const r of rows) {
    if (!r.start_date) continue;
    const y = Number(r.start_date.slice(0, 4));
    if (y >= 2000 && y <= 2100) years.add(y);
  }
  return Array.from(years).sort((a, b) => b - a);
}

export function filterLeavesByYearAndStatus<T extends { start_date?: string; status: string }>(
  rows: T[],
  year: string | number | 'ALL',
  status: string | 'ALL'
): T[] {
  return rows.filter((r) => {
    if (status && status !== 'ALL' && r.status !== status) return false;
    if (year && year !== 'ALL') {
      const y = String(year);
      if (!r.start_date?.startsWith(y)) return false;
    }
    return true;
  });
}

/** Normalize IA/UI status aliases to DB codes. */
export function normalizeLeaveStatus(status?: string | null): string | undefined {
  if (!status) return undefined;
  const s = status.trim().toUpperCase().replace(/[\s-]+/g, '_');
  const aliases: Record<string, string> = {
    PENDING: 'PENDING_LEADER',
    PENDENTE: 'PENDING_LEADER',
    PENDING_LEADER: 'PENDING_LEADER',
    PENDING_MANAGER: 'PENDING_MANAGER',
    APPROVED: 'APPROVED',
    APROVADO: 'APPROVED',
    APROVADA: 'APPROVED',
    REJECTED: 'REJECTED',
    REJEITADO: 'REJECTED',
    REPROVADO: 'REJECTED',
    CANCELLED: 'CANCELLED',
    CANCELADO: 'CANCELLED',
  };
  return aliases[s] || status;
}
