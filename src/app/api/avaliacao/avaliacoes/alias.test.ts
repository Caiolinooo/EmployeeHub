import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { delegateAvaliacaoById, isAvaliacaoUuid } from './[id]/alias';

describe('avaliacao alias (no self-fetch)', () => {
  it('rejects a non-UUID without calling the delegate', async () => {
    let called = false;
    const result = await delegateAvaliacaoById('not-a-uuid', async () => {
      called = true;
      return { ok: true };
    });
    assert.equal(called, false);
    assert.equal(result.delegated, false);
    if (!result.delegated) {
      assert.equal(result.body.success, false);
      assert.match(result.body.error, /UUID/);
    }
  });

  it('delegates a valid UUID to the underlying handler (no fetch)', async () => {
    const id = '11111111-1111-1111-1111-111111111111';
    assert.equal(isAvaliacaoUuid(id), true);
    const result = await delegateAvaliacaoById(id, async () => ({ status: 200, id }));
    assert.equal(result.delegated, true);
    if (result.delegated) {
      assert.deepEqual(result.value, { status: 200, id });
    }
  });
});
