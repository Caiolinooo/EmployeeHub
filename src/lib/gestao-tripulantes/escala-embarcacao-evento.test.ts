import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { embarcacaoHerdadaPorEvento, type EventoEmbarcacaoGrade } from './escala-embarcacao-evento';

const ev = (
  id: string,
  ini: string,
  fim: string | null,
  local: string | null,
  colaborador_id = 'c1',
): EventoEmbarcacaoGrade => ({ id, colaborador_id, data_embarque: ini, data_desembarque: fim, local_desembarque: local });

describe('embarcacaoHerdadaPorEvento — evento sem embarcação herda do vizinho do mesmo colaborador', () => {
  it('caso RENAN: ON lançado em célula vazia (sem embarcação) fica na embarcação do STB seguinte', () => {
    const mapa = embarcacaoHerdadaPorEvento([
      ev('on-12', '2026-09-12', '2026-09-13', ''),
      ev('on-14', '2026-09-14', '2026-09-16', ''),
      ev('stb', '2026-09-17', '2026-09-25', 'MATRIX -INT'),
    ]);
    assert.equal(mapa.get('on-12'), 'MATRIX -INT');
    assert.equal(mapa.get('on-14'), 'MATRIX -INT');
    assert.equal(mapa.has('stb'), false, 'evento com embarcação própria não entra no mapa');
  });

  it('herda do evento MAIS PRÓXIMO no tempo quando o colaborador trocou de embarcação', () => {
    const mapa = embarcacaoHerdadaPorEvento([
      ev('a', '2026-01-01', '2026-01-14', 'NAVIO A'),
      ev('b', '2026-06-01', '2026-06-14', 'NAVIO B'),
      ev('x', '2026-05-20', '2026-05-25', null),
      ev('y', '2026-01-20', '2026-01-22', '  '),
    ]);
    assert.equal(mapa.get('x'), 'NAVIO B');
    assert.equal(mapa.get('y'), 'NAVIO A');
  });

  it('sobreposição conta como distância zero; empate de distância prefere o anterior', () => {
    const mapa = embarcacaoHerdadaPorEvento([
      ev('antes', '2026-03-01', '2026-03-09', 'NAVIO A'),
      ev('depois', '2026-03-21', '2026-03-30', 'NAVIO B'),
      ev('meio', '2026-03-10', '2026-03-20', ''),
      ev('dentro', '2026-03-25', '2026-03-26', ''),
    ]);
    assert.equal(mapa.get('meio'), 'NAVIO A');
    assert.equal(mapa.get('dentro'), 'NAVIO B');
  });

  it('nunca herda de outro colaborador; sem vizinho com embarcação não entra no mapa', () => {
    const mapa = embarcacaoHerdadaPorEvento([
      ev('c1-sem', '2026-09-12', '2026-09-13', '', 'c1'),
      ev('c2-com', '2026-09-12', '2026-09-20', 'NAVIO C', 'c2'),
    ]);
    assert.equal(mapa.has('c1-sem'), false);
  });

  it('evento aberto (sem desembarque) e datas com hora são tratados por dia civil', () => {
    const mapa = embarcacaoHerdadaPorEvento([
      ev('aberto', '2026-09-01T00:00:00', null, 'NAVIO A'),
      ev('x', '2027-01-10', '2027-01-12', ''),
      ev('longe', '2026-01-01', '2026-01-05', 'NAVIO B'),
    ]);
    assert.equal(mapa.get('x'), 'NAVIO A');
  });
});
