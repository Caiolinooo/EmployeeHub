import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseASOsFromHTML } from './poliweb-html';

describe('parseASOsFromHTML', () => {
  it('reads plain table cells', () => {
    const html = `
      <table>
        <tr>
          <td>123.456.789-00</td>
          <td>Ana Souza</td>
          <td>Periodico</td>
          <td>01/02/2026</td>
          <td>01/02/2027</td>
          <td>Apto</td>
        </tr>
      </table>
    `;
    const rows = parseASOsFromHTML(html);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].colaboradorNome, 'Ana Souza');
    assert.equal(rows[0].tipoExame, 'Periodico');
  });

  it('strips nested split tags inside cells', () => {
    const html = `
      <tr>
        <td>123.456.789-00</td>
        <td><scr<script>ipt>Ana</td>
        <td>Admissional</td>
        <td>01/02/2026</td>
        <td>01/02/2027</td>
        <td>Apto</td>
      </tr>
    `;
    const rows = parseASOsFromHTML(html);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].colaboradorNome.includes('<script'), false);
    assert.equal(rows[0].colaboradorNome.includes('<scr'), false);
  });
});
