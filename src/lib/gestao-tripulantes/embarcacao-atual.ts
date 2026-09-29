/**
 * Embarcação atual do colaborador = rotação que a logística lançou na escala
 * e que cobre o dia de hoje. O DP não digita este campo.
 */

export interface EventoEmbarcacaoAtual {
  tipo?: string | null;
  data_embarque?: string | null;
  data_desembarque?: string | null;
  local_desembarque?: string | null;
}

export interface EmbarcacaoCatalogo {
  id: string;
  nome: string;
}

/** Marcadores (DBA/FI/STB/folga) não definem a embarcação. Rotação sim. */
const TIPOS_IGNORADOS = new Set([
  'dba', 'fi', 'stb', 'off', 'offc', 'folga', 'ferias', 'treinamento', 'afastado',
]);

export type AcaoEmbarcacaoAtual =
  | { acao: 'definir'; embarcacaoId: string }
  | { acao: 'limpar' }
  | { acao: 'manter' };

function dia(v: string | null | undefined): string {
  return String(v || '').slice(0, 10);
}

function norm(v: string): string {
  return v
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function cobreHoje(evento: EventoEmbarcacaoAtual, hoje: string): boolean {
  const ini = dia(evento.data_embarque);
  if (!ini || ini > hoje) return false;
  const fim = dia(evento.data_desembarque);
  if (!fim) return true;
  return fim >= hoje;
}

function acharId(texto: string, catalogo: EmbarcacaoCatalogo[]): string | null {
  const alvo = norm(texto);
  if (alvo.length < 2) return null;
  const exato = catalogo.find((e) => norm(e.nome) === alvo);
  if (exato) return exato.id;
  const contem = catalogo
    .filter((e) => {
      const nome = norm(e.nome);
      return nome.length >= 3 && (alvo.includes(nome) || nome.includes(alvo));
    })
    .sort((a, b) => norm(b.nome).length - norm(a.nome).length);
  return contem[0]?.id ?? null;
}

export function resolverEmbarcacaoAtual(
  eventos: EventoEmbarcacaoAtual[],
  catalogo: EmbarcacaoCatalogo[],
  hoje: string,
): AcaoEmbarcacaoAtual {
  const diaHoje = dia(hoje);
  const rotacoes = eventos
    .filter((e) => !TIPOS_IGNORADOS.has(norm(String(e.tipo || 'normal')).toLowerCase()))
    .filter((e) => cobreHoje(e, diaHoje))
    .sort((a, b) => dia(b.data_embarque).localeCompare(dia(a.data_embarque)));

  if (rotacoes.length === 0) return { acao: 'limpar' };

  for (const evento of rotacoes) {
    const id = acharId(String(evento.local_desembarque || ''), catalogo);
    if (id) return { acao: 'definir', embarcacaoId: id };
  }
  return { acao: 'manter' };
}
