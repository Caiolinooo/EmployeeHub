import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  coletarTagsDataXml,
  valorDentroDaTag,
  xmlAsoSemDtAsoAntesDeRes,
  xmlTemTagsVazias,
} from './xml-linear';

function assertFast(fn: () => void, limitMs = 100): void {
  const t0 = performance.now();
  fn();
  const dt = performance.now() - t0;
  assert.ok(dt < limitMs, `pathological input took ${dt.toFixed(1)}ms (limit ${limitMs}ms)`);
}

const XML_MISTO = `<?xml version="1.0" encoding="UTF-8"?>
<eSocial>
  <aso>
    <dtAso>2026-08-10</dtAso>
    <resAso>1</resAso>
    <exame>
      <dtExm>2026-10-08</dtExm>
    </exame>
  </aso>
  <dtBase>8</dtBase>
  <dataDesligamento>2026-01-01</dataDesligamento>
</eSocial>`;

describe('xml-linear characterization', () => {
  it('collects the same date tags as the old unbounded regex', () => {
    const tags = coletarTagsDataXml(XML_MISTO);
    assert.deepEqual(tags, [
      '<dtAso>2026-08-10</',
      '<dtExm>2026-10-08</',
      '<dtBase>8</',
      '<dataDesligamento>2026-01-01</',
    ]);
    assert.equal(valorDentroDaTag(tags[0]!), '2026-08-10');
  });

  it('flags empty tags the same way', () => {
    assert.equal(xmlTemTagsVazias('<foo></foo>'), true);
    assert.equal(xmlTemTagsVazias('<foo>  </bar>'), true);
    assert.equal(xmlTemTagsVazias('<nmMed>Joao</nmMed>'), false);
    assert.equal(xmlTemTagsVazias('<dtAso>2026-08-10</dtAso>'), false);
  });

  it('detects <aso> immediately followed by <resAso>', () => {
    assert.equal(xmlAsoSemDtAsoAntesDeRes('<aso><resAso>1</resAso></aso>'), true);
    assert.equal(xmlAsoSemDtAsoAntesDeRes('<aso>\n  <resAso>'), true);
    assert.equal(xmlAsoSemDtAsoAntesDeRes('<aso><dtAso>x</dtAso><resAso>'), false);
  });

  it('scans 50k-a after < in under 100ms', () => {
    const pathological = `<${'a'.repeat(50_000)}`;
    assertFast(() => {
      assert.equal(xmlTemTagsVazias(pathological), false);
      assert.deepEqual(coletarTagsDataXml(pathological), []);
    });
  });
});
