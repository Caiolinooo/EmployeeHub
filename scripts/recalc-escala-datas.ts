/**
 * Recalcula as datas de escala gravadas em gt_colaboradores
 * (data_ultimo_embarque / data_ultimo_desembarque / data_proximo_embarque)
 * a partir dos eventos VIVOS de gt_historico_embarques — a fonte canônica.
 *
 * Por que isso existe: o pull MIO era o único escritor dessas colunas e foi
 * desligado na v5.77.0. Depois disso as colunas só eram recalculadas em
 * save/edição/exclusão local (`sincronizarDatasEscalaColaborador`), então
 * qualquer evento apagado FORA do portal (scripts de limpeza) deixava as
 * colunas congeladas/desalinhadas. Leitores reais dessas colunas:
 * Matriz de Conformidade (coluna "Próximo embarque"), lista da página
 * /department/gestao-tripulantes, senioridade do algoritmo de BACK e o
 * texto das notificações de embarque/desembarque.
 *
 * A regra de derivação NÃO é duplicada aqui: vive em
 * `src/lib/gestao-tripulantes/embarques-datas.ts` (+ embarcacao-atual.ts) e
 * os scripts de manutenção a reutilizam pelo core `scripts/lib/escala-manutencao`.
 *
 *   npx tsx scripts/recalc-escala-datas.ts            # dry-run (default)
 *   npx tsx scripts/recalc-escala-datas.ts --apply    # grava as divergências
 *   npx tsx scripts/recalc-escala-datas.ts --apply --only=uuid1,uuid2
 */
import {
  criarClientSupabase,
  listarColaboradoresEscala,
  listarEmbarcacoes,
  sincronizarDatasEscala,
} from './lib/escala-manutencao';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function brl(v: string | null | undefined): string {
  if (!v) return '—';
  const [y, m, d] = v.slice(0, 10).split('-');
  return `${d}/${m}/${y.slice(2)} ${MESES[Number(m) - 1]}`;
}

async function main(): Promise<void> {
  const aplicar = process.argv.includes('--apply');
  const somente = process.argv
    .find((a) => a.startsWith('--only='))
    ?.slice('--only='.length)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const sb = criarClientSupabase();
  const [colaboradores, embarcacoes] = await Promise.all([
    listarColaboradoresEscala(sb),
    listarEmbarcacoes(sb),
  ]);
  const ids = somente ? colaboradores.filter((c) => somente.includes(c.id)).map((c) => c.id) : colaboradores.map((c) => c.id);

  const divergentes = await sincronizarDatasEscala(sb, ids, { aplicar, embarcacoes });

  console.log(`colaboradores : ${ids.length}`);
  console.log(`divergentes   : ${divergentes.length}`);
  console.log(`modo          : ${aplicar ? 'APPLY' : 'DRY-RUN (nada gravado)'}`);
  console.log('');

  for (const { colaborador, patch } of divergentes.slice(0, 25)) {
    const partes = Object.entries(patch).map(([k, v]) => {
      if (k === 'embarcacao_atual_id') {
        return `embarcacao_atual: ${(colaborador.embarcacao_atual_id || 'null').slice(0, 8)} -> ${
          v === null ? 'null' : String(v).slice(0, 8)
        }`;
      }
      return `${k.replace('data_', '')}: ${brl(colaborador[k as keyof typeof colaborador] as string | null)} -> ${brl(
        v as string | null,
      )}`;
    });
    console.log(`  ${colaborador.nome_completo}: ${partes.join(' | ')}`);
  }
  if (divergentes.length > 25) console.log(`  … +${divergentes.length - 25} outro(s)`);

  if (aplicar) {
    console.log('');
    console.log(`gravados: ${divergentes.length}`);
    console.log('RECALC_ESCALA_DATAS_OK');
  } else {
    console.log('');
    console.log('dry-run: rode com --apply para gravar.');
  }
}

main().catch((err) => {
  console.error('RECALC_ESCALA_DATAS_FALHOU:', err);
  process.exit(1);
});
