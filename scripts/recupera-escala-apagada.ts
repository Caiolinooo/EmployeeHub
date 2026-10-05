/**
 * Recupera eventos de gt_historico_embarques que foram apagados (soft-delete)
 * FORA do portal — sem trilha em gt_escala_edicoes — e que devolvem escala
 * perdida: uma rotação sem conflito que ALARGA a cobertura do colaborador
 * além do que ele já tem vivo.
 *
 * Contexto (bug relatado pela logística em 05/10/2026): "as escalas não estão
 * sendo atualizadas e perdemos as escalas que estavam marcadas". A trilha de
 * auditoria só existe a partir de 17/09/2026 e o pull MIO (único escritor das
 * colunas de escala) foi desligado na v5.77.0. Scripts de limpeza rodados no
 * banco (limpa-sobrepostos / dedupe / corte MIO) soft-deletaram em lote sem
 * registrar trilha: as linhas saíram do grid, da Matriz e do fechamento sem
 * deixar rastro e sem reversão pela Fila de Revisão.
 *
 * O que este script faz:
 *   1. lista todo soft-delete SEM trilha em gt_escala_edicoes;
 *   2. classifica cada um contra os eventos VIVOS do mesmo colaborador usando
 *      a MESMA regra de substituição do portal (escala-overlap.ts: só colide
 *      com evento vivo do mesmo tipo normalizado) e o mesmo teste de período
 *      de escala-contagem.ts;
 *   3. restaura apenas as ROTAÇÕES sem conflito que avançam a cobertura —
 *      as outras três classes ficam no relatório, para decisão humana:
 *        · histórico: rotação sem conflito, porém de período já coberto;
 *        · marcador  : DBA/FI/STB/OFF-C — restaurá-los mexe no fechamento;
 *        · conflito  : colide com evento vivo do mesmo tipo (duplicaria);
 *   4. grava uma linha 'restore' em gt_escala_edicoes por item restaurado,
 *      com before/after e hash no mesmo formato do portal → a recuperação
 *      entra na Fila de Revisão e pode ser revertida como qualquer edição;
 *   5. rederiva as datas de escala dos colaboradores afetados.
 *
 *   npx tsx scripts/recupera-escala-apagada.ts           # relatório (dry-run)
 *   npx tsx scripts/recupera-escala-apagada.ts --apply   # restaura as rotações
 *   npx tsx scripts/recupera-escala-apagada.ts --apply --incluir-marcadores
 */
import { rotationOverlapsPeriod } from '../src/lib/gestao-tripulantes/escala-contagem';
import { isTipoRotacao, normalizarTipoEscala } from '../src/lib/gestao-tripulantes/escala-overlap';
import { paginarSelect } from '../src/lib/gestao-tripulantes/supabase-paginacao';
import {
  criarClientSupabase,
  gravarTrilhas,
  listarEmbarcacoes,
  listarEventos,
  montarSnapshot,
  restaurarLote,
  sincronizarDatasEscala,
  type EventoManutencao,
} from './lib/escala-manutencao';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const GRUPOS = ['restauravel', 'historico', 'marcador', 'conflito', 'sem-data'] as const;
type Grupo = (typeof GRUPOS)[number];

function brl(v: string | null | undefined): string {
  if (!v) return '—';
  const [y, m, d] = v.slice(0, 10).split('-');
  return `${d}/${m}/${y.slice(2)} ${MESES[Number(m) - 1]}`;
}

function iso(v: string | null | undefined): string {
  return v ? v.slice(0, 10) : '';
}

function dataLocalCivil(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseCivil(v: string | null | undefined): Date | null {
  if (!v) return null;
  const [y, m, d] = v.slice(0, 10).split('-').map((n) => Number(n));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/** Fim da cobertura do evento; evento aberto (data_desembarque NULL) vale 90 dias. */
function fimCobertura(ev: EventoManutencao): string {
  if (iso(ev.data_desembarque)) return iso(ev.data_desembarque);
  const ini = parseCivil(ev.data_embarque);
  if (!ini) return '';
  ini.setDate(ini.getDate() + 90);
  return dataLocalCivil(ini);
}

function maiorFim(eventos: EventoManutencao[]): string {
  return eventos.reduce<string>((max, e) => {
    const fim = fimCobertura(e);
    return fim > max ? fim : max;
  }, '');
}

function haSobreposicao(candidato: EventoManutencao, vivos: EventoManutencao[]): boolean {
  const ini = parseCivil(candidato.data_embarque);
  const fim = parseCivil(candidato.data_desembarque || candidato.data_embarque);
  if (!ini || !fim) return false;
  const tipoAlvo = normalizarTipoEscala(candidato.tipo);
  return vivos.some((vivo) => {
    if (normalizarTipoEscala(vivo.tipo) !== tipoAlvo) return false;
    return rotationOverlapsPeriod(
      { start: vivo.data_embarque, end: vivo.data_desembarque, type: String(vivo.tipo || 'normal') },
      ini,
      fim,
    );
  });
}

async function main(): Promise<void> {
  const aplicar = process.argv.includes('--apply');
  const incluirMarcadores = process.argv.includes('--incluir-marcadores');

  const sb = criarClientSupabase();
  const [embarcacoes, trilha, eventos] = await Promise.all([
    listarEmbarcacoes(sb),
    paginarSelect<{ embarque_id: string | null }>(async (from, to) => {
      const r = await sb.from('gt_escala_edicoes').select('embarque_id').order('id').range(from, to);
      return { data: r.data as { embarque_id: string | null }[] | null, error: r.error };
    }),
    listarEventos(sb),
  ]);
  if (trilha.error) throw new Error(`gt_escala_edicoes: ${trilha.error}`);

  const colaboradores = await paginarSelect<{ id: string; nome_completo: string }>(async (from, to) => {
    const r = await sb
      .from('gt_colaboradores')
      .select('id, nome_completo')
      .order('id')
      .range(from, to);
    return { data: r.data as { id: string; nome_completo: string }[] | null, error: r.error };
  });
  if (colaboradores.error) throw new Error(`gt_colaboradores: ${colaboradores.error}`);
  const nomePorId = new Map(colaboradores.rows.map((c) => [c.id, c.nome_completo]));

  const comTrilha = new Set(
    trilha.rows.map((t) => t.embarque_id).filter((v): v is string => Boolean(v)),
  );

  const vivosPorColaborador = new Map<string, EventoManutencao[]>();
  for (const ev of eventos) {
    if (ev.deleted_at) continue;
    const lista = vivosPorColaborador.get(ev.colaborador_id);
    if (lista) lista.push(ev);
    else vivosPorColaborador.set(ev.colaborador_id, [ev]);
  }
  const fimVivoPorColaborador = new Map<string, string>();
  for (const [colabId, lista] of vivosPorColaborador) fimVivoPorColaborador.set(colabId, maiorFim(lista));

  const deletadasSemTrilha = eventos.filter((ev) => ev.deleted_at && !comTrilha.has(ev.id));
  const grupos: Record<Grupo, EventoManutencao[]> = {
    restauravel: [],
    historico: [],
    marcador: [],
    conflito: [],
    'sem-data': [],
  };

  for (const ev of deletadasSemTrilha) {
    if (!iso(ev.data_embarque)) {
      grupos['sem-data'].push(ev);
      continue;
    }
    const vivos = vivosPorColaborador.get(ev.colaborador_id) || [];
    if (haSobreposicao(ev, vivos)) {
      grupos.conflito.push(ev);
      continue;
    }
    if (!isTipoRotacao(ev.tipo)) {
      grupos.marcador.push(ev);
      continue;
    }
    // Só volta o que ALARGA a escala: evento que não passa do fim da cobertura
    // viva é histórico (período já fechado) — fica no relatório, não no banco.
    const fimVivo = fimVivoPorColaborador.get(ev.colaborador_id) || '';
    if (fimCobertura(ev) > fimVivo) grupos.restauravel.push(ev);
    else grupos.historico.push(ev);
  }

  console.log(`eventos lidos (paginado)      : ${eventos.length}`);
  console.log(`soft-deletes SEM trilha       : ${deletadasSemTrilha.length}`);
  console.log(`  rotação que ALARGA a escala : ${grupos.restauravel.length}   <- restaurável`);
  console.log(`  rotação histórica (lacuna)  : ${grupos.historico.length}   <- só relatório (período já fechado)`);
  console.log(`  marcador sem conflito       : ${grupos.marcador.length}   <- só relatório (mexe no fechamento)`);
  console.log(`  em conflito com evento vivo : ${grupos.conflito.length}   <- só relatório (duplicaria)`);
  console.log(`  sem data_embarque           : ${grupos['sem-data'].length}`);
  console.log(`modo                          : ${aplicar ? 'APPLY' : 'DRY-RUN (nada gravado)'}`);
  console.log('');

  for (const grupo of GRUPOS) {
    if (grupos[grupo].length === 0) continue;
    console.log(`--- ${grupo} (${grupos[grupo].length}) ---`);
    for (const ev of grupos[grupo].sort((a, b) => a.id.localeCompare(b.id))) {
      const nome = nomePorId.get(ev.colaborador_id) || ev.colaborador_id.slice(0, 8);
      console.log(
        `  ${nome} | ${String(normalizarTipoEscala(ev.tipo)).padEnd(6)} | ${ev.origem || '?'} | ` +
          `${brl(ev.data_embarque)}->${brl(ev.data_desembarque)} | apagado ${brl(ev.deleted_at)}`,
      );
    }
    console.log('');
  }

  if (grupos.restauravel.length > 0) {
    console.log('--- efeito na escala (rotações restauráveis) ---');
    const porColaborador = new Map<string, EventoManutencao[]>();
    for (const ev of grupos.restauravel) {
      const lista = porColaborador.get(ev.colaborador_id);
      if (lista) lista.push(ev);
      else porColaborador.set(ev.colaborador_id, [ev]);
    }
    for (const [colabId, lista] of porColaborador) {
      const nome = nomePorId.get(colabId) || colabId.slice(0, 8);
      console.log(
        `  ${nome}: escala viva até ${brl(fimVivoPorColaborador.get(colabId) || '')} ` +
          `-> passa a cobrir até ${brl(maiorFim(lista))} (${lista.length} evento(s))`,
      );
    }
    console.log('');
  }

  if (!aplicar) {
    console.log('dry-run: rode com --apply para restaurar as rotações.');
    return;
  }

  const agora = new Date().toISOString();
  const alvos = grupos.restauravel.concat(incluirMarcadores ? grupos.marcador : []);
  const restaurados = await restaurarLote(
    sb,
    alvos.map((e) => e.id),
    agora,
  );
  const trilhaGravada = await gravarTrilhas(
    sb,
    alvos.map((ev) => ({
      ev,
      operacao: 'restore' as const,
      antes: montarSnapshot(ev),
      depois: { ...montarSnapshot(ev), deleted_at: null, updated_at: agora },
      motivo: 'Recuperação de evento apagado fora do portal (sem trilha)',
      atorNome: 'script:recupera-escala-apagada',
    })),
    agora,
  );
  const resync = await sincronizarDatasEscala(
    sb,
    [...new Set(alvos.map((e) => e.colaborador_id))],
    { aplicar: true, embarcacoes },
  );

  console.log('');
  console.log(
    `restaurados: ${restaurados}/${alvos.length} | trilha: ${trilhaGravada} | colaboradores resincronizados: ${resync.length}`,
  );
  console.log('RECUPERA_ESCALA_APAGADA_OK');
}

main().catch((err) => {
  console.error('RECUPERA_ESCALA_APAGADA_FALHOU:', err);
  process.exit(1);
});
