/**
 * Limpeza retroativa de SOBREPOSIÇÕES em gt_historico_embarques, type-aware.
 *
 * Por colaborador, percorre os eventos do mais recente para o mais antigo; um
 * evento substitui as linhas mantidas do MESMO tipo normalizado que ele
 * sobrepõe (regra do `escala-overlap.ts`, v5.76.1/v5.79): rotação substitui
 * rotação, marcador substitui o mesmo marcador, e tipos diferentes COEXISTEM
 * (DBA dentro do ON é o caso do Rômulo — nunca derruba a rotação).
 *
 * A versão anterior deste script (legado, `.js`) tinha três defeitos que
 * produziram a perda de escala relatada pela logística em 05/10/2026:
 *   1. leitura SEM paginação — o PostgREST trunca em 1000 linhas e o script
 *      decidia sobreposições sobre um subconjunto arbitrário das ~2.900 vivas;
 *   2. sem distinguishing de tipo — um marcador sobreposto derrubava a rotação;
 *   3. soft-delete em lote SEM trilha em gt_escala_edicoes e SEM resincronizar
 *      data_ultimo_embarque/data_proximo_embarque de gt_colaboradores.
 *
 *   npx tsx scripts/limpa-sobrepostos-embarques.ts           # dry-run (default)
 *   npx tsx scripts/limpa-sobrepostos-embarques.ts --apply   # aplica + trilha + resync
 */
import { rotationOverlapsPeriod } from '../src/lib/gestao-tripulantes/escala-contagem';
import { normalizarTipoEscala } from '../src/lib/gestao-tripulantes/escala-overlap';
import {
  criarClientSupabase,
  gravarTrilhas,
  listarEmbarcacoes,
  listarEventos,
  montarSnapshot,
  softDeletarLote,
  sincronizarDatasEscala,
  type EventoManutencao,
} from './lib/escala-manutencao';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function brl(v: string | null | undefined): string {
  if (!v) return '—';
  const [y, m, d] = v.slice(0, 10).split('-');
  return `${d}/${m}/${y.slice(2)} ${MESES[Number(m) - 1]}`;
}

function iso(v: string | null | undefined): string {
  return v ? v.slice(0, 10) : '';
}

function parseCivil(v: string | null | undefined): Date | null {
  if (!v) return null;
  const [y, m, d] = v.slice(0, 10).split('-').map((n) => Number(n));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function substitui(novo: EventoManutencao, mantido: EventoManutencao): boolean {
  if (normalizarTipoEscala(mantido.tipo) !== normalizarTipoEscala(novo.tipo)) return false;
  const ini = parseCivil(novo.data_embarque);
  const fim = parseCivil(novo.data_desembarque || novo.data_embarque);
  if (!ini || !fim) return false;
  return rotationOverlapsPeriod(
    { start: mantido.data_embarque, end: mantido.data_desembarque, type: String(mantido.tipo || 'normal') },
    ini,
    fim,
  );
}

async function main(): Promise<void> {
  const aplicar = process.argv.includes('--apply');
  const sb = criarClientSupabase();
  const embarcacoes = await listarEmbarcacoes(sb);

  const eventos = (await listarEventos(sb, { somenteVivos: true })).sort((a, b) =>
    String(b.created_at).localeCompare(String(a.created_at)),
  );

  const porColaborador = new Map<string, EventoManutencao[]>();
  for (const ev of eventos) {
    const lista = porColaborador.get(ev.colaborador_id);
    if (lista) lista.push(ev);
    else porColaborador.set(ev.colaborador_id, [ev]);
  }

  const aDeletar: EventoManutencao[] = [];
  // Vítima que cobria período MAIOR que a linha que a substitui: remover
  // encurta a escala. A regra do portal é "mais recente vence", mas num
  // lote legado isso come dias de ON — por isso o script conta e avisa.
  let encurtaCobertura = 0;

  for (const lista of porColaborador.values()) {
    let mantidos: EventoManutencao[] = [];
    for (const ev of lista) {
      const vitimas = mantidos.filter((k) => substitui(ev, k));
      if (vitimas.length > 0) {
        aDeletar.push(...vitimas);
        encurtaCobertura += vitimas.filter(
          (v) => iso(v.data_desembarque) > iso(ev.data_desembarque),
        ).length;
        const idsVitima = new Set(vitimas.map((v) => v.id));
        mantidos = mantidos.filter((k) => !idsVitima.has(k.id));
      }
      mantidos.push(ev);
    }
  }

  console.log(`eventos vivos lidos (paginado) : ${eventos.length}`);
  console.log(`colaboradores com eventos     : ${porColaborador.size}`);
  console.log(`linhas sobrepostas a remover  : ${aDeletar.length}`);
  console.log(`  das quais encurtam escala   : ${encurtaCobertura}   <- a linha removida cobria período MAIOR`);
  console.log(`modo                          : ${aplicar ? 'APPLY' : 'DRY-RUN (nada gravado)'}`);
  console.log('');

  for (const ev of aDeletar) {
    console.log(
      `  ${ev.colaborador_id.slice(0, 8)} | ${String(normalizarTipoEscala(ev.tipo)).padEnd(6)} | ${ev.origem || '?'} | ` +
        `${brl(ev.data_embarque)}->${brl(ev.data_desembarque)} | criado ${brl(ev.created_at)}`,
    );
  }

  if (aDeletar.length === 0) {
    console.log('NOTHING_TO_DELETE');
    return;
  }
  if (!aplicar) {
    console.log('dry-run: rode com --apply para remover (com trilha e resync das datas).');
    return;
  }

  const agora = new Date().toISOString();
  const deletados = await softDeletarLote(
    sb,
    aDeletar.map((e) => e.id),
    agora,
  );
  const trilha = await gravarTrilhas(
    sb,
    aDeletar.map((ev) => ({
      ev,
      operacao: 'delete' as const,
      antes: montarSnapshot(ev),
      depois: { ...montarSnapshot(ev), deleted_at: agora, updated_at: agora },
      motivo: 'Limpeza retroativa de sobreposições (type-aware)',
      atorNome: 'script:limpa-sobrepostos-embarques',
    })),
    agora,
  );
  const resync = await sincronizarDatasEscala(
    sb,
    [...new Set(aDeletar.map((e) => e.colaborador_id))],
    { aplicar: true, embarcacoes },
  );

  console.log('');
  console.log(`soft-deleted: ${deletados} | trilha: ${trilha} | colaboradores resincronizados: ${resync.length}`);
  console.log('LIMPA_SOBREPOSTOS_OK');
}


main().catch((err) => {
  console.error('LIMPA_SOBREPOSTOS_FALHOU:', err);
  process.exit(1);
});
