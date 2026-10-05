/**
 * Dedup de gt_historico_embarques origem='local': mantém a linha mais nova de
 * cada (colaborador_id, data_embarque, data_desembarque) e soft-deleta as
 * demais. Nasceu do bug de marcação invisível — o operador reenviava um save
 * que já tinha gravado e as cópias inflavam a contagem do fechamento.
 *
 * A versão anterior (legado, `.js`) lia SEM paginação (o PostgREST trunca em
 * 1000 linhas: com ~2.900 linhas vivas o script via metade da base), deletava
 * em lote SEM trilha em gt_escala_edicoes e SEM resincronizar as datas de
 * gt_colaboradores — foi assim que escalas sumiram sem reversão possível.
 *
 *   npx tsx scripts/dedupe-embarques-locais.ts           # dry-run (default)
 *   npx tsx scripts/dedupe-embarques-locais.ts --apply   # aplica + trilha + resync
 */
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

function brl(v: string | null | undefined): string {
  if (!v) return v ? v.slice(0, 10) : '—';
  return v;
}

async function main(): Promise<void> {
  const aplicar = process.argv.includes('--apply');
  const sb = criarClientSupabase();
  const embarcacoes = await listarEmbarcacoes(sb);

  const eventos = (await listarEventos(sb, { somenteVivos: true, origem: 'local' })).sort((a, b) =>
    String(a.created_at).localeCompare(String(b.created_at)),
  );

  const grupos = new Map<string, EventoManutencao[]>();
  for (const ev of eventos) {
    const chave = `${ev.colaborador_id}|${ev.data_embarque}|${ev.data_desembarque}`;
    const lista = grupos.get(chave);
    if (lista) lista.push(ev);
    else grupos.set(chave, [ev]);
  }

  const aDeletar: EventoManutencao[] = [];
  let gruposDuplicados = 0;

  for (const lista of grupos.values()) {
    if (lista.length < 2) continue;
    gruposDuplicados += 1;
    const mantido = lista[lista.length - 1];
    const sts = lista.slice(0, -1);
    aDeletar.push(...sts);
    const tipos = [...new Set(lista.map((r) => String(r.tipo)))].join(',');
    console.log(
      `DUP x${lista.length} ${tipos.padEnd(16)} ${brl(lista[0].data_embarque)}->${brl(lista[0].data_desembarque)} ` +
        `keep=${mantido.id.slice(0, 8)} (${brl(mantido.created_at)}) | remove ${sts.map((s) => s.id.slice(0, 8)).join(', ')}`,
    );
  }

  console.log('');
  console.log(`eventos locais vivos (paginado): ${eventos.length}`);
  console.log(`grupos duplicados              : ${gruposDuplicados}`);
  console.log(`linhas a soft-deletar          : ${aDeletar.length}`);
  console.log(`modo                           : ${aplicar ? 'APPLY' : 'DRY-RUN (nada gravado)'}`);

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
      motivo: 'Dedup de embarques locais duplicados',
      atorNome: 'script:dedupe-embarques-locais',
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
  console.log('DEDUPE_EMBARQUES_LOCAIS_OK');
}

main().catch((err) => {
  console.error('DEDUPE_EMBARQUES_LOCAIS_FALHOU:', err);
  process.exit(1);
});
