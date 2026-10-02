/**
 * Áreas do Financeiro + séries do painel.
 * Rodar: npx tsx --test src/components/financeiro/financeiro-nav.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { grupoDaArea, resolverAreaAtiva } from './financeiro-nav';
import { barrasCompetencia, fatiasStatus, variacaoContraMesAnterior } from './financeiro-dashboard';

describe('resolverAreaAtiva', () => {
  it('hub sem tab abre a visão geral', () => {
    assert.equal(resolverAreaAtiva('/folha-pagamento', null), 'visao-geral');
  });

  it('?tab= vence no hub e nos deep-links', () => {
    assert.equal(resolverAreaAtiva('/folha-pagamento', 'clientes'), 'clientes');
    assert.equal(resolverAreaAtiva('/folha-pagamento/faturas', 'nfse'), 'nfse');
    assert.equal(resolverAreaAtiva('/folha-pagamento/bancos', 'faturas'), 'faturas');
  });

  it('deep-link sem tab cai na área da rota', () => {
    assert.equal(resolverAreaAtiva('/folha-pagamento/faturas', null), 'faturas');
    assert.equal(resolverAreaAtiva('/folha-pagamento/nfse', null), 'nfse');
    assert.equal(resolverAreaAtiva('/folha-pagamento/bancos', null), 'bancos');
  });

  it('cadastros, folha e relatórios resolvem pelo path', () => {
    assert.equal(resolverAreaAtiva('/folha-pagamento/funcionarios', null), 'funcionarios');
    assert.equal(resolverAreaAtiva('/folha-pagamento/empresas', 'faturas'), 'empresas');
    assert.equal(resolverAreaAtiva('/folha-pagamento/configuracoes/codigos', null), 'rubricas');
    assert.equal(resolverAreaAtiva('/folha-pagamento/nova', null), 'nova');
    assert.equal(resolverAreaAtiva('/folha-pagamento/sheets', null), 'planilhas');
    assert.equal(resolverAreaAtiva('/folha-pagamento/relatorios/custos', null), 'rel-custos');
    assert.equal(grupoDaArea('rubricas')?.id, 'cadastros');
    assert.equal(grupoDaArea('bancos')?.id, 'contas');
    assert.equal(grupoDaArea('rel-guias')?.id, 'relatorios');
  });
});

describe('painel', () => {
  it('barras ficam em ordem cronológica e a maior ocupa 100%', () => {
    const barras = barrasCompetencia([
      { competencia: '2026-03', faturas: 2, total: 50 },
      { competencia: '2026-01', faturas: 1, total: 100 },
    ]);
    assert.deepEqual(barras.map((b) => b.competencia), ['2026-01', '2026-03']);
    assert.equal(barras[0].fracao, 1);
    assert.equal(barras[1].fracao, 0.5);
    assert.equal(barras[0].mes, 1);
  });

  it('variação usa o mês anterior presente na série', () => {
    const serie = [
      { competencia: '2026-01', total: 100 },
      { competencia: '2026-02', total: 150 },
    ];
    assert.equal(variacaoContraMesAnterior(serie, '2026-02'), 50);
    assert.equal(variacaoContraMesAnterior(serie, '2026-01'), null);
    assert.equal(variacaoContraMesAnterior([{ competencia: '2026-02', total: 10 }], '2026-02'), null);
  });

  it('fatias ignoram status zerado e mantêm a ordem do contrato', () => {
    const fatias = fatiasStatus({ paga: 2, rascunho: 0, emitida: 1, cancelada: 3 });
    assert.deepEqual(fatias.map((f) => f.status), ['emitida', 'paga', 'cancelada']);
  });
});
