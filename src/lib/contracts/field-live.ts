/**
 * Edição ao vivo de campos de contrato.
 * O PDF não pode ser trocado só porque a query da URL assinada mudou.
 * Um save antigo não pode repor posição que o usuário já moveu de novo.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const COMPARE_KEYS = [
    'posicao_x',
    'posicao_y',
    'largura_assinatura',
    'altura_assinatura',
    'obrigatorio',
    'tipo',
    'ordem',
    'pagina_assinatura',
] as const;

export function isPersistedFieldId(id: unknown): id is string {
    return typeof id === 'string' && UUID_RE.test(id);
}

export function patchFields<T extends { id: string }>(
    fields: T[],
    updates: Array<Partial<T> & { id: string }>,
): T[] {
    if (updates.length === 0) return fields;
    const byId = new Map(updates.map((row) => [row.id, row]));
    return fields.map((field) => {
        const update = byId.get(field.id);
        if (!update) return field;
        return { ...field, ...update, id: field.id };
    });
}

/** Reverte só o campo que ainda está no valor otimista. Gesto mais novo fica. */
export function revertIfUnchanged<T extends { id: string }>(
    current: T[],
    optimistic: Array<Partial<T> & { id: string }>,
    snapshots: T[],
): T[] {
    const expected = new Map(optimistic.map((row) => [row.id, row]));
    const previous = new Map(snapshots.map((row) => [row.id, row]));
    return current.map((field) => {
        const next = expected.get(field.id);
        const snap = previous.get(field.id);
        if (!next || !snap) return field;
        const stillThere = COMPARE_KEYS.every((key) => {
            if (!Object.prototype.hasOwnProperty.call(next, key)) return true;
            return (field as Record<string, unknown>)[key] === (next as Record<string, unknown>)[key];
        });
        return stillThere ? snap : field;
    });
}

export function removeFields<T extends { id: string }>(fields: T[], ids: string[]): T[] {
    if (ids.length === 0) return fields;
    const drop = new Set(ids);
    return fields.filter((field) => !drop.has(field.id));
}

export function restoreRemoved<T extends { id: string }>(current: T[], snapshots: T[]): T[] {
    const ids = new Set(current.map((field) => field.id));
    const missing = snapshots.filter((field) => field.id && !ids.has(field.id));
    if (missing.length === 0) return current;
    return [...current, ...missing];
}

export function insertFields<T extends { id: string }>(fields: T[], created: T[]): T[] {
    const ids = new Set(fields.map((field) => field.id));
    const fresh = created.filter((field) => field.id && !ids.has(field.id));
    if (fresh.length === 0) return fields;
    return [...fields, ...fresh];
}

export function swapFieldId<T extends { id: string }>(fields: T[], fromId: string, toId: string): T[] {
    if (!fromId || !toId || fromId === toId) return fields;
    return fields.map((field) => (field.id === fromId ? { ...field, id: toId } : field));
}

/** Caminho do arquivo, sem o token da URL assinada. */
export function fileIdentity(url?: string | null): string {
    if (!url) return '';
    return url.split('?')[0];
}

export function keepStableFileUrl(previous?: string | null, incoming?: string | null): string | null {
    if (!incoming) return previous ?? null;
    if (!previous) return incoming;
    if (fileIdentity(previous) === fileIdentity(incoming)) return previous;
    return incoming;
}

export function mergeDocumentFileUrls<T extends { id: string; arquivo_url?: string | null }>(
    previous: T[],
    incoming: T[],
): T[] {
    const prevById = new Map(previous.map((doc) => [doc.id, doc.arquivo_url]));
    return incoming.map((doc) => ({
        ...doc,
        arquivo_url: keepStableFileUrl(prevById.get(doc.id), doc.arquivo_url),
    }));
}

export type AdoptedFieldId = { id: string; client_id?: string | null };

/** Troca id temporário pelo id do banco. Não mexe em posição nem em campo que o save não devolveu. */
export function adoptServerIds<T extends { id: string }>(current: T[], returned: AdoptedFieldId[]): T[] {
    const map = new Map<string, string>();
    for (const row of returned) {
        if (row.client_id && row.id && row.client_id !== row.id) map.set(row.client_id, row.id);
    }
    if (map.size === 0) return current;
    return current.map((field) => {
        const next = map.get(field.id);
        return next ? { ...field, id: next } : field;
    });
}

export function remapIds(ids: string[], returned: AdoptedFieldId[]): string[] {
    const map = new Map<string, string>();
    for (const row of returned) {
        if (row.client_id && row.id) map.set(row.client_id, row.id);
    }
    return ids.map((id) => map.get(id) || id);
}

export function isStaleLiveSave(startedEpoch: number, currentEpoch: number): boolean {
    return startedEpoch !== currentEpoch;
}
