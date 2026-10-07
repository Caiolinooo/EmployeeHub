import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  asoBloqueiaTrocaDeTipo,
  resolverTipoDocumentoEdicao,
  TIPOS_DOCUMENTO_VALIDOS,
} from './documento-tipos';
import {
  labelTipoDocumento,
  tipoInicialFormularioDocumento,
  TIPOS_DOCUMENTO_UPLOAD_ABA,
} from './documento-tipos-ui';

describe('labelTipoDocumento', () => {
  it('legado documento_pessoal aparece como Documentos Pessoais', () => {
    assert.equal(labelTipoDocumento('documento_pessoal'), 'Documentos Pessoais');
    assert.equal(labelTipoDocumento('outro'), 'Outro / Declaração');
    assert.equal(labelTipoDocumento('pessoal'), 'Documentos Pessoais');
  });
});

describe('resolverTipoDocumentoEdicao', () => {
  it('aceita o catálogo da aba Documentos e normaliza legado', () => {
    for (const opcao of TIPOS_DOCUMENTO_UPLOAD_ABA) {
      assert.ok((TIPOS_DOCUMENTO_VALIDOS as readonly string[]).includes(opcao.value));
      const resolved = resolverTipoDocumentoEdicao(opcao.value);
      assert.equal(resolved.ok, true);
      if (resolved.ok) assert.equal(resolved.tipo, opcao.value);
    }
    const legado = resolverTipoDocumentoEdicao('documento_pessoal');
    assert.equal(legado.ok, true);
    if (legado.ok) {
      assert.equal(legado.tipo, 'pessoal');
      assert.equal(legado.subtipo, undefined);
    }
    const alias = resolverTipoDocumentoEdicao('cnh');
    assert.equal(alias.ok, true);
    if (alias.ok) {
      assert.equal(alias.tipo, 'pessoal');
      assert.equal(alias.subtipo, 'cnh');
    }
  });

  it('rejeita tipo fora do CHECK', () => {
    const bad = resolverTipoDocumentoEdicao('foto_3x4');
    assert.equal(bad.ok, false);
    if (!bad.ok) {
      assert.match(bad.error, /inválido/);
      assert.ok(bad.tipos_aceitos.includes('pessoal'));
    }
    assert.equal(resolverTipoDocumentoEdicao(null).ok, false);
  });
});

describe('asoBloqueiaTrocaDeTipo', () => {
  it('bloqueia só ASO/laudo enviado ou processado quando o tipo muda', () => {
    assert.equal(asoBloqueiaTrocaDeTipo('aso', 'pessoal', 'enviado'), true);
    assert.equal(asoBloqueiaTrocaDeTipo('aso', 'pessoal', 'processado'), true);
    assert.equal(asoBloqueiaTrocaDeTipo('laudo', 'outro', 'enviado'), true);
    assert.equal(asoBloqueiaTrocaDeTipo('aso', 'aso', 'processado'), false);
    assert.equal(asoBloqueiaTrocaDeTipo('aso', 'pessoal', 'pendente'), false);
    assert.equal(asoBloqueiaTrocaDeTipo('aso', 'pessoal', 'nao_enviado'), false);
    assert.equal(asoBloqueiaTrocaDeTipo('pessoal', 'contratual', 'enviado'), false);
  });
});

describe('tipoInicialFormularioDocumento', () => {
  it('abre o select no mesmo option do upload', () => {
    assert.equal(tipoInicialFormularioDocumento('documento_pessoal'), 'pessoal');
    assert.equal(tipoInicialFormularioDocumento('contratual'), 'contratual');
    assert.equal(tipoInicialFormularioDocumento('contrato'), 'contratual');
    assert.equal(tipoInicialFormularioDocumento('certidao_casamento'), 'pessoal');
  });
});
