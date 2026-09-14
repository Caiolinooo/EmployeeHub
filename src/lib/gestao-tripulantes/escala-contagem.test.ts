import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { pickOverlappingRotation, type RotationLike } from './escala-contagem';

const week = (start: string, end: string): [Date, Date] => [new Date(`${start}T00:00:00`), new Date(`${end}T23:59:59.999`)];

const rot = (over: Partial<RotationLike>): RotationLike => ({
  start: '2026-10-17',
  end: '2026-10-31',
  type: 'normal',
  ...over,
});

describe('pickOverlappingRotation — portal é a única verdade', () => {
  const [ws, we] = week('2026-10-17', '2026-10-23');

  it('lançamento local vence MIO que começa DEPOIS (bug do desempate ×10 vs +6)', () => {
    const local = rot({ id: 'local-1', origem: 'local', start: '2026-10-17', type: 'offc' });
    const mio = rot({ id: 'mio-1', origem: 'mio', start: '2026-10-18', end: '2026-11-05' });
    assert.equal(pickOverlappingRotation([mio, local], ws, we)?.id, 'local-1');
  });

  it('lançamento local vence MIO aberto (end NULL) no mesmo período', () => {
    const local = rot({ id: 'local-2', origem: 'local' });
    const mioAberta = rot({ id: 'mio-2', origem: 'mio', end: null });
    assert.equal(pickOverlappingRotation([mioAberta, local], ws, we)?.id, 'local-2');
  });

  it('entre duas locais, vence a que começa na coluna / mais recente (comportamento original preservado)', () => {
    const antiga = rot({ id: 'local-a', origem: 'local', start: '2026-10-10', end: '2026-10-30' });
    const nova = rot({ id: 'local-b', origem: 'local', start: '2026-10-18' });
    assert.equal(pickOverlappingRotation([antiga, nova], ws, we)?.id, 'local-b');
  });

  it('entre duas MIO, vence a de início mais recente (sem local na disputa)', () => {
    const a = rot({ id: 'mio-a', origem: 'mio', start: '2026-10-17' });
    const b = rot({ id: 'mio-b', origem: 'mio', start: '2026-10-19' });
    assert.equal(pickOverlappingRotation([a, b], ws, we)?.id, 'mio-b');
  });

  it('local vence MIO mesmo começando ANTES dentro da coluna', () => {
    const localCedo = rot({ id: 'local-3', origem: 'local', start: '2026-10-15', end: '2026-11-10' });
    const mioTarde = rot({ id: 'mio-3', origem: 'mio', start: '2026-10-20', end: '2026-11-05' });
    assert.equal(pickOverlappingRotation([mioTarde, localCedo], ws, we)?.id, 'local-3');
  });
});
