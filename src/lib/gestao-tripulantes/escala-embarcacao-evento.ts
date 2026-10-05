/**
 * Embarcação de cada evento na grade da escala (Man Schedule).
 *
 * A grade filtra POR EVENTO pela embarcação. O evento guarda a embarcação em
 * `local_desembarque`, mas um evento lançado em célula vazia nasce sem ela.
 * O fallback antigo era a `embarcacao_atual` do colaborador — que é volátil
 * (rotação que cobre HOJE; limpa quando a pessoa está de folga, ver
 * embarcacao-atual.ts). Resultado: os eventos sem embarcação sumiam da grade
 * filtrada assim que o colaborador desembarcava.
 *
 * Regra: evento sem embarcação herda a do evento mais próximo no tempo do
 * MESMO colaborador que tenha uma (sobreposição = distância 0; empate fica
 * com o anterior). Sem vizinho, o evento não entra no mapa e o chamador cai
 * no fallback de sempre.
 */

export interface EventoEmbarcacaoGrade {
  id: string;
  colaborador_id: string;
  data_embarque: string | null;
  data_desembarque?: string | null;
  local_desembarque?: string | null;
}

const DIA_MS = 86_400_000;

function diaNum(v: string | null | undefined): number | null {
  const s = String(v || '').slice(0, 10);
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  return Date.UTC(y, m - 1, d) / DIA_MS;
}

interface Intervalo {
  ini: number;
  fim: number;
}

function intervalo(ev: EventoEmbarcacaoGrade): Intervalo | null {
  const ini = diaNum(ev.data_embarque);
  if (ini === null) return null;
  return { ini, fim: diaNum(ev.data_desembarque) ?? Number.POSITIVE_INFINITY };
}

function distancia(a: Intervalo, b: Intervalo): number {
  return Math.max(0, b.ini - a.fim, a.ini - b.fim);
}

/** id do evento sem embarcação → embarcação herdada do vizinho mais próximo. */
export function embarcacaoHerdadaPorEvento(eventos: readonly EventoEmbarcacaoGrade[]): Map<string, string> {
  const porColab = new Map<string, { com: { iv: Intervalo; nome: string }[]; sem: { id: string; iv: Intervalo }[] }>();
  for (const ev of eventos) {
    const iv = intervalo(ev);
    if (!iv) continue;
    let grupo = porColab.get(ev.colaborador_id);
    if (!grupo) {
      grupo = { com: [], sem: [] };
      porColab.set(ev.colaborador_id, grupo);
    }
    const nome = (ev.local_desembarque || '').trim();
    if (nome) grupo.com.push({ iv, nome });
    else grupo.sem.push({ id: ev.id, iv });
  }

  const herdada = new Map<string, string>();
  for (const { com, sem } of porColab.values()) {
    if (com.length === 0) continue;
    for (const alvo of sem) {
      let melhor: { iv: Intervalo; nome: string } | null = null;
      let melhorDist = Number.POSITIVE_INFINITY;
      for (const fonte of com) {
        const d = distancia(alvo.iv, fonte.iv);
        if (d < melhorDist || (d === melhorDist && melhor !== null && fonte.iv.ini < melhor.iv.ini)) {
          melhor = fonte;
          melhorDist = d;
        }
      }
      if (melhor) herdada.set(alvo.id, melhor.nome);
    }
  }
  return herdada;
}
