/**
 * Paginação defensiva para `.select()` no Supabase/PostgREST.
 *
 * O PostgREST deste projeto trunca respostas em 1000 linhas (db-max-rows=1000);
 * um `.select()` sem paginação explícita devolve um subconjunto arbitrário e
 * silencioso das linhas (ver commit 61f1983e). Sempre acompanhe o uso deste
 * helper com `.order()` por coluna estável (ex.: `id`) para que as páginas
 * sejam determinísticas — sem ORDER BY, LIMIT/OFFSET pode duplicar ou pular
 * linhas entre páginas.
 */

export const PAGE_SIZE = 1000;

export type PaginarSelectPage<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

export async function paginarSelect<T>(
  fetchPage: (from: number, to: number) => Promise<PaginarSelectPage<T>>,
): Promise<{ rows: T[]; error?: string }> {
  const rows: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);
    if (error) return { rows, error: error.message };
    const page = data || [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return { rows };
}
