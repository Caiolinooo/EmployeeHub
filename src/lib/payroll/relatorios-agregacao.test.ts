import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  SEM_DEPARTAMENTO,
  agregarCustosPorDepartamento,
  agregarGuias,
  totalizarCustos,
  type LinhaCusto,
} from './relatorios-agregacao';

const linha = (parcial: Partial<LinhaCusto>): LinhaCusto => ({
  centroCusto: 'Embarcação A',
  bruto: 0,
  descontos: 0,
  liquido: 0,
  inss: 0,
  irrf: 0,
  fgts: 0,
  ...parcial,
});

describe('agregarCustosPorDepartamento', () => {
  it('agrupa por centro de custo e calcula custoTotal = bruto + fgts', () => {
    const deps = agregarCustosPorDepartamento([
      linha({ bruto: 5000, descontos: 500, liquido: 4500, inss: 400, irrf: 100, fgts: 400 }),
      linha({ bruto: 3000, descontos: 300, liquido: 2700, inss: 240, irrf: 60, fgts: 240 }),
      linha({ centroCusto: 'Base', bruto: 2000, fgts: 160 }),
    ]);

    assert.equal(deps.length, 2);
    const emb = deps.find((d) => d.departamento === 'Embarcação A');
    assert.ok(emb);
    assert.equal(emb.colaboradores, 2);
    assert.equal(emb.bruto, 8000);
    assert.equal(emb.inss, 640);
    assert.equal(emb.irrf, 160);
    assert.equal(emb.fgts, 640);
    assert.equal(emb.custoTotal, 8640);
    const base = deps.find((d) => d.departamento === 'Base');
    assert.ok(base);
    assert.equal(base.custoTotal, 2160);
  });

  it('linha sem centro de custo cai no grupo SEM_DEPARTAMENTO', () => {
    const deps = agregarCustosPorDepartamento([linha({ centroCusto: '', bruto: 100 })]);
    assert.equal(deps.length, 1);
    assert.equal(deps[0].departamento, SEM_DEPARTAMENTO);
  });

  it('ordena por custoTotal desc e arredonda em 2 casas', () => {
    const deps = agregarCustosPorDepartamento([
      linha({ centroCusto: 'B', bruto: 100.005, fgts: 8 }),
      linha({ centroCusto: 'A', bruto: 10, fgts: 0.8 }),
    ]);
    assert.equal(deps[0].departamento, 'B');
    assert.equal(deps[0].bruto, 100.01);
    assert.equal(deps[0].custoTotal, 108.01);
  });
});

describe('totalizarCustos', () => {
  it('soma os blocos na linha TOTAL', () => {
    const deps = agregarCustosPorDepartamento([
      linha({ centroCusto: 'A', bruto: 1000, descontos: 100, liquido: 900, inss: 80, fgts: 80 }),
      linha({ centroCusto: 'B', bruto: 2000, descontos: 200, liquido: 1800, irrf: 50, fgts: 160 }),
    ]);
    const total = totalizarCustos(deps);
    assert.equal(total.departamento, 'TOTAL');
    assert.equal(total.colaboradores, 2);
    assert.equal(total.bruto, 3000);
    assert.equal(total.descontos, 300);
    assert.equal(total.liquido, 2700);
    assert.equal(total.inss, 80);
    assert.equal(total.irrf, 50);
    assert.equal(total.fgts, 240);
    assert.equal(total.custoTotal, 3240);
  });

  it('lista vazia zera os totais', () => {
    const total = totalizarCustos([]);
    assert.equal(total.colaboradores, 0);
    assert.equal(total.custoTotal, 0);
  });
});

describe('agregarGuias', () => {
  it('consolida provisões de INSS, IRRF e FGTS', () => {
    const resumo = agregarGuias([
      linha({ bruto: 5000, inss: 500, irrf: 250, fgts: 400 }),
      linha({ bruto: 2500, inss: 200, irrf: 0, fgts: 200 }),
    ]);
    assert.equal(resumo.contribuintes, 2);
    assert.equal(resumo.folhaBruta, 7500);
    const porTributo = Object.fromEntries(resumo.guias.map((g) => [g.tributo, g.valor]));
    assert.equal(porTributo.INSS, 700);
    assert.equal(porTributo.IRRF, 250);
    assert.equal(porTributo.FGTS, 600);
    assert.equal(resumo.total, 1550);
  });

  it('sem linhas: guias zeradas', () => {
    const resumo = agregarGuias([]);
    assert.equal(resumo.contribuintes, 0);
    assert.equal(resumo.total, 0);
    assert.equal(resumo.guias.length, 3);
  });
});
