import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  avisoDefaultParaTipo,
  isTipoRescisao,
  mtvDesligParaTipo,
  prazoPagamentoRescisao,
  seguroDesempregoElegivel,
  sugerirAvisoPrevioDias,
  verbasParaRescisao,
} from './desligamento';

describe('mtvDesligParaTipo', () => {
  it('maps CLT types to e-Social Tabela 19', () => {
    assert.equal(mtvDesligParaTipo('sem_justa_causa'), '02');
    assert.equal(mtvDesligParaTipo('pedido_demissao'), '07');
    assert.equal(mtvDesligParaTipo('justa_causa'), '01');
    assert.equal(mtvDesligParaTipo('acordo_mutuo'), '25');
    assert.equal(mtvDesligParaTipo('termino_contrato'), '06');
    assert.equal(mtvDesligParaTipo('rescisao_indireta'), '02');
  });

  it('accepts a two-digit override and ignores invalid ones', () => {
    assert.equal(mtvDesligParaTipo('sem_justa_causa', '08'), '08');
    assert.equal(mtvDesligParaTipo('sem_justa_causa', 'abc'), '02');
    assert.equal(mtvDesligParaTipo('sem_justa_causa', '2'), '02');
  });
});

describe('verbasParaRescisao', () => {
  it('sem justa causa / indireta: saldo + 13º + férias + aviso indenizado + multa 40%', () => {
    const codes = verbasParaRescisao('sem_justa_causa', 'indenizado').map((v) => v.code);
    assert.deepEqual(codes, ['303', '304', '305', '306', '301', '302']);
    assert.deepEqual(
      verbasParaRescisao('rescisao_indireta', 'indenizado').map((v) => v.code),
      codes,
    );
  });

  it('pedido de demissão: sem aviso indenizado e sem multa FGTS', () => {
    const codes = verbasParaRescisao('pedido_demissao', 'trabalhado').map((v) => v.code);
    assert.deepEqual(codes, ['303', '304', '305', '306']);
  });

  it('justa causa: só saldo e férias vencidas', () => {
    const codes = verbasParaRescisao('justa_causa', 'nao_aplicavel').map((v) => v.code);
    assert.deepEqual(codes, ['303', '306']);
  });

  it('acordo mútuo: multa 20% e aviso 50% quando indenizado', () => {
    const verbas = verbasParaRescisao('acordo_mutuo', 'indenizado');
    const codes = verbas.map((v) => v.code);
    assert.ok(codes.includes('307'));
    assert.ok(!codes.includes('302'));
    assert.ok(verbas.some((v) => v.code === '301' && /metade/i.test(v.observation)));
  });

  it('término de contrato: sem aviso e sem multa', () => {
    const codes = verbasParaRescisao('termino_contrato', 'nao_aplicavel').map((v) => v.code);
    assert.deepEqual(codes, ['303', '304', '305', '306']);
  });

  it('omits aviso 301 when not indenizado', () => {
    const codes = verbasParaRescisao('sem_justa_causa', 'trabalhado').map((v) => v.code);
    assert.ok(!codes.includes('301'));
    assert.ok(codes.includes('302'));
  });
});

describe('aviso e prazo', () => {
  it('defaults aviso by tipo', () => {
    assert.equal(avisoDefaultParaTipo('sem_justa_causa'), 'indenizado');
    assert.equal(avisoDefaultParaTipo('pedido_demissao'), 'trabalhado');
    assert.equal(avisoDefaultParaTipo('justa_causa'), 'nao_aplicavel');
  });

  it('computes 10 calendar days for payment (Lei 13.467/2017)', () => {
    assert.equal(prazoPagamentoRescisao('2026-09-02'), '2026-09-12');
    assert.equal(prazoPagamentoRescisao('2026-12-25'), '2027-01-04');
  });

  it('suggests aviso days 30 + 3/year capped at 90', () => {
    assert.equal(sugerirAvisoPrevioDias('2025-09-02', '2026-09-02'), 33);
    assert.equal(sugerirAvisoPrevioDias('2000-01-01', '2026-09-02'), 90);
    assert.equal(sugerirAvisoPrevioDias(null, '2026-09-02'), 30);
  });

  it('seguro-desemprego only when employer-initiated without cause / indireta / termino', () => {
    assert.equal(seguroDesempregoElegivel('sem_justa_causa'), true);
    assert.equal(seguroDesempregoElegivel('rescisao_indireta'), true);
    assert.equal(seguroDesempregoElegivel('pedido_demissao'), false);
    assert.equal(seguroDesempregoElegivel('acordo_mutuo'), false);
    assert.equal(seguroDesempregoElegivel('justa_causa'), false);
  });

  it('guards tipo_rescisao', () => {
    assert.equal(isTipoRescisao('sem_justa_causa'), true);
    assert.equal(isTipoRescisao('outro'), false);
  });
});
