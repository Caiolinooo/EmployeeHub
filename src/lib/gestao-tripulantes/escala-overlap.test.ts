import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  filtrarSubstitutiveis,
  isTipoRotacao,
  normalizarTipoEscala,
  type EmbarqueOverlapRow,
} from './escala-overlap';

const row = (id: string, tipo: string, ini: string, fim: string | null): EmbarqueOverlapRow => ({
  id,
  tipo,
  data_embarque: ini,
  data_desembarque: fim,
});

const ids = (rows: EmbarqueOverlapRow[]): Array<string | undefined> =>
  rows.map((r) => r.id).sort();

/**
 * Composição exata das rotas POST/PUT /embarques: o match "keep" de range
 * exato roda ANTES do filtro (re-marcar a mesma faixa atualiza in place,
 * qualquer tipo); o filtro decide só o que é soft-deletado como substituição.
 */
function substituicaoDaRota(
  novoTipo: string,
  rows: EmbarqueOverlapRow[],
  ini: string,
  fim: string,
): { keep: EmbarqueOverlapRow | null; substituir: EmbarqueOverlapRow[] } {
  const keep =
    rows.find((r) => r.data_embarque === ini && r.data_desembarque === fim) || null;
  return {
    keep,
    substituir: filtrarSubstitutiveis(novoTipo, rows.filter((r) => r.id !== keep?.id)),
  };
}

// Caso Rômulo: a bordo (ON aberto, desembarque NULL) + ciclo fechado 01→20/09.
const ON_ABERTO = row('on-aberto', 'normal', '2026-09-01', null);
const ON_FECHADO = row('on-fechado', 'normal', '2026-09-01', '2026-09-20');
const ROMULO = [ON_ABERTO, ON_FECHADO];

describe('filtrarSubstitutiveis — substituição type-aware (fix Rômulo)', () => {
  it('BUG DO RÔMULO: DBA 11→11 NÃO apaga ON aberto nem ON fechado 01→20 (marcador coexiste com a rotação)', () => {
    const substituir = filtrarSubstitutiveis('dba', ROMULO);
    assert.deepEqual(ids(substituir), []);
  });

  it('novo ON 05→15 substitui SOMENTE as duas rotações (normal); DBA 11→11 sobrevive', () => {
    const dba = row('dba-11', 'dba', '2026-09-11', '2026-09-11');
    const substituir = filtrarSubstitutiveis('normal', [...ROMULO, dba]);
    assert.deepEqual(ids(substituir), ['on-aberto', 'on-fechado']);
  });

  it('re-marcar o mesmo marcador substitui a marca anterior (idempotente): DBA novo × DBA 11→11 existente', () => {
    const dbaAntigo = row('dba-antigo', 'dba', '2026-09-11', '2026-09-11');
    const substituir = filtrarSubstitutiveis('dba', [ON_ABERTO, dbaAntigo]);
    assert.deepEqual(ids(substituir), ['dba-antigo']);
  });

  it('marcador NUNCA apaga outro tipo: DBA novo × [ON aberto, FI, STB] → nada sai', () => {
    const fi = row('fi-10-12', 'fi', '2026-09-10', '2026-09-12');
    const stb = row('stb-11', 'stb', '2026-09-11', '2026-09-11');
    const substituir = filtrarSubstitutiveis('dba', [ON_ABERTO, fi, stb]);
    assert.deepEqual(ids(substituir), []);
  });

  it('OFF-C novo × [OFF-C, ON aberto] → substitui só o OFF-C', () => {
    const offcAntigo = row('offc-antigo', 'offc', '2026-09-10', '2026-09-12');
    const substituir = filtrarSubstitutiveis('offc', [offcAntigo, ON_ABERTO]);
    assert.deepEqual(ids(substituir), ['offc-antigo']);
  });

  it('tipo customizado: só substitui o mesmo custom (qualquer tipo além da semente é marcador)', () => {
    const customA = row('custom-a', 'curso_interno', '2026-09-11', '2026-09-11');
    const substituir = filtrarSubstitutiveis('curso_interno', [customA, ON_ABERTO]);
    assert.deepEqual(ids(substituir), ['custom-a']);
    assert.deepEqual(ids(filtrarSubstitutiveis('outro_custom', [customA])), []);
  });

  it('keep de range exato roda ANTES do filtro: DBA 11→11 sobre STB 11→11 atualiza in place (merged), não apaga o ON', () => {
    const stbExato = row('stb-exato', 'stb', '2026-09-11', '2026-09-11');
    const { keep, substituir } = substituicaoDaRota('dba', [ON_ABERTO, stbExato], '2026-09-11', '2026-09-11');
    assert.equal(keep?.id, 'stb-exato'); // match de range exato independe do tipo
    assert.deepEqual(ids(substituir), []); // nada é tombado — caminho merged:true
  });

  it('keep + substituição combinados: DBA 11→11 com DBA 12→14 e ON aberto → só o DBA 12→14 sai', () => {
    const dbaExato = row('dba-exato', 'dba', '2026-09-11', '2026-09-11');
    const dbaDepois = row('dba-depois', 'dba', '2026-09-12', '2026-09-14');
    const { keep, substituir } = substituicaoDaRota('dba', [ON_ABERTO, dbaExato, dbaDepois], '2026-09-11', '2026-09-11');
    assert.equal(keep?.id, 'dba-exato');
    assert.deepEqual(ids(substituir), ['dba-depois']); // ON aberto intocado
  });

  it('legado do banco: dobra≡dba (re-mark substitui) e standby≠dba (não sai)', () => {
    const dobraLegada = row('dobra-legada', 'dobra', '2026-09-11', '2026-09-11');
    const stbLegada = row('stb-legada', 'standby', '2026-09-11', '2026-09-11');
    assert.deepEqual(ids(filtrarSubstitutiveis('dba', [dobraLegada, stbLegada])), ['dobra-legada']);
  });

  it('código MIO maiúsculo (ON) lê como rotação: novo ON substitui', () => {
    const mioOn = row('mio-on', 'ON', '2026-09-05', '2026-09-15');
    assert.deepEqual(ids(filtrarSubstitutiveis('normal', [mioOn])), ['mio-on']);
  });

  it('tipo ausente/não-string lê como rotação: marcador novo não toca; rotação nova substitui (legado preservado)', () => {
    const semTipo = row('sem-tipo', '', '2026-09-05', '2026-09-15');
    const tipoNulo = row('tipo-nulo', null as unknown as string, '2026-09-05', '2026-09-15');
    assert.deepEqual(ids(filtrarSubstitutiveis('dba', [semTipo, tipoNulo])), []);
    assert.deepEqual(ids(filtrarSubstitutiveis('normal', [semTipo, tipoNulo])), ['sem-tipo', 'tipo-nulo']);
  });

  it('lista vazia/undefined → vazio (defensivo)', () => {
    assert.deepEqual(filtrarSubstitutiveis('normal', []), []);
    assert.deepEqual(filtrarSubstitutiveis('normal', null), []);
    assert.deepEqual(filtrarSubstitutiveis('normal', undefined), []);
  });
});

describe('normalizarTipoEscala / isTipoRotacao — só normal é rotação', () => {
  it('rotação: normal | on | ON | vazio/null (desconhecido → conservador)', () => {
    assert.equal(isTipoRotacao('normal'), true);
    assert.equal(isTipoRotacao('on'), true);
    assert.equal(isTipoRotacao('ON'), true);
    assert.equal(isTipoRotacao(null), true);
    assert.equal(isTipoRotacao(undefined), true);
  });

  it('marcadores: previsto (ON*) | fi | dba | stb | offc | ferias | afastamento | custom', () => {
    for (const tipo of ['previsto', 'on*', 'fi', 'folga_indenizada', 'dba', 'dobra', 'stb', 'standby', 'offc', 'ferias', 'afastamento', 'curso_interno']) {
      assert.equal(isTipoRotacao(tipo), false, `${tipo} deveria ser marcador`);
    }
  });

  it('normalizarTipoEscala espelha mapCodigoToDbTipo das rotas', () => {
    assert.equal(normalizarTipoEscala('normal'), 'normal');
    assert.equal(normalizarTipoEscala('on'), 'normal');
    assert.equal(normalizarTipoEscala('previsto'), 'previsto');
    assert.equal(normalizarTipoEscala('fi'), 'fi');
    assert.equal(normalizarTipoEscala('dba'), 'dba');
    assert.equal(normalizarTipoEscala('stb'), 'stb');
    assert.equal(normalizarTipoEscala('offc'), 'offc');
    assert.equal(normalizarTipoEscala('folga_indenizada'), 'fi');
    assert.equal(normalizarTipoEscala('dobra'), 'dba');
    assert.equal(normalizarTipoEscala('standby'), 'stb');
  });
});
