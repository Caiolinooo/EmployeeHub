/**
 * Fila de assinatura: um item da API é um campo (solicitação), não um PDF.
 * A tela contava queue.length como "arquivos" e pintava só o PDF do índice ativo.
 */

export type SignatureQueueItem = {
    id?: string;
    status?: string;
    tipo?: string | null;
    obrigatorio?: boolean | null;
    external_signer_email?: string | null;
    colaborador_id?: string | null;
    colaborador?: { email?: string | null } | null;
    documento?: { id?: string | null; titulo?: string | null } | null;
    pdf_url?: string | null;
    valor_preenchido?: string | null;
};

export function normalizeSignerEmail(value?: string | null): string {
    return (value || '').trim().toLowerCase();
}

/** Mesma pessoa: id interno OU e-mail (externo ou do cadastro), sem diferenciar maiúsculas. */
export function sameSigner(
    ref: { colaborador_id?: string | null; external_signer_email?: string | null; colaborador?: { email?: string | null } | null },
    row: { colaborador_id?: string | null; external_signer_email?: string | null; colaborador?: { email?: string | null } | null },
): boolean {
    const refEmails = [
        normalizeSignerEmail(ref.external_signer_email),
        normalizeSignerEmail(ref.colaborador?.email),
    ].filter(Boolean);
    const rowEmails = [
        normalizeSignerEmail(row.external_signer_email),
        normalizeSignerEmail(row.colaborador?.email),
    ].filter(Boolean);
    if (ref.colaborador_id && row.colaborador_id && ref.colaborador_id === row.colaborador_id) {
        return true;
    }
    return refEmails.some((email) => rowEmails.includes(email));
}

export function isFieldRequired(field: { obrigatorio?: boolean | null; tipo?: string | null }): boolean {
    if (field.obrigatorio === false) return false;
    return true;
}

/** Texto vazio ou checkbox desmarcado bloqueiam a assinatura só quando o campo é obrigatório. */
export function missingRequiredFieldValue(
    field: { id?: string; tipo?: string | null; obrigatorio?: boolean | null; valor_preenchido?: string | null },
    filled: Record<string, string | undefined>,
): boolean {
    if (!isFieldRequired(field)) return false;
    const raw = field.id && filled[field.id] !== undefined ? filled[field.id] : field.valor_preenchido;
    if (field.tipo === 'texto') return !String(raw ?? '').trim();
    if (field.tipo === 'checkbox') return String(raw ?? '') !== 'true';
    return false;
}

/**
 * PDFs distintos da fila. Cópia (observador) não é arquivo para assinar.
 * Dois campos no mesmo documento contam como 1 arquivo.
 */
export function uniqueSignatureDocuments<T extends SignatureQueueItem>(queue: T[]): T[] {
    const seen = new Set<string>();
    const docs: T[] = [];
    for (const item of queue) {
        if (item.tipo === 'copia') continue;
        const id = item.documento?.id;
        if (!id || seen.has(id)) continue;
        seen.add(id);
        docs.push(item);
    }
    return docs;
}
