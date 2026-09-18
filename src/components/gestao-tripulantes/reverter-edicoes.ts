import { fetchWithToken } from '@/lib/tokenStorage';

export interface ReversaoEmCadeiaResultado {
    /** Edições revertidas com sucesso antes de parar (se parou). */
    revertidas: number;
    /** Total solicitado. */
    total: number;
    /** Mensagem do servidor do primeiro erro (409 rollback obsoleto, 403 etc.). */
    erro?: string;
}

export interface ReverterEdicoesOpcoes {
    /**
     * POST/PUT de embarque: a 1ª edição da trilha é o create/update do EVENTO
     * SALVO e as demais são efeitos de recorte em sobrepostos same-type
     * (delete/update da original + creates de fragmentos head/tail). Reverter
     * o evento salvo PRIMEIRO — e só então os efeitos em ordem reversa — é
     * obrigatório: em LIFO puro o un-delete da original encontra o evento
     * salvo ainda vivo e a guarda de sobreposição de reverterEdicaoEscala
     * recusa com 409 no meio da cadeia (estado ≠ pré-salvo). NÃO usar no
     * DELETE ('completo'/'periodo'): lá não existe linha do evento salvo —
     * LIFO puro é o correto (fragmentos morrem antes do un-delete da própria
     * linha recortada).
     */
    salvarEventoPrimeiro?: boolean;
}

/**
 * Desfazer (ação do toast): reverte as edições gravadas por uma ação de escala
 * (POST/PUT/DELETE /embarques devolve `edicoes: string[]`) na ordem de
 * desfazer adequada ao fluxo — LIFO puro (default, DELETE) ou evento salvo na
 * frente da fila (`salvarEventoPrimeiro`, POST/PUT; ver ReverterEdicoesOpcoes).
 * Para no primeiro erro e devolve a mensagem do servidor para o toast.
 */
export async function reverterEdicoesEmCadeia(
    ids: string[],
    motivo: string,
    opcoes?: ReverterEdicoesOpcoes
): Promise<ReversaoEmCadeiaResultado> {
    if (ids.length === 0) return { revertidas: 0, total: 0 };
    const lista = opcoes?.salvarEventoPrimeiro === true
        ? [ids[0], ...ids.slice(1).reverse()]
        : [...ids].reverse();
    let revertidas = 0;
    for (const id of lista) {
        try {
            const res = await fetchWithToken(
                `/api/gestao-tripulantes/escala-edicoes/${id}/reverter`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ motivo }),
                }
            );
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                const msg = typeof (data as { error?: unknown })?.error === 'string'
                    ? (data as { error: string }).error
                    : undefined;
                return { revertidas, total: lista.length, erro: msg };
            }
            revertidas += 1;
        } catch (err: unknown) {
            return {
                revertidas,
                total: lista.length,
                erro: err instanceof Error ? err.message : undefined,
            };
        }
    }
    return { revertidas, total: lista.length };
}
