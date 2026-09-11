import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  agruparDocumentosPorTipo,
  chaveAgrupamentoDocumento,
  contarDocsPorStatusPrimario,
  idsComPrimarioVencido,
  isDeclaracaoDocumento,
  somarDocsPorStatusPrimario,
} from './documento-historico';

const HOJE = '2026-09-01';

describe('chaveAgrupamentoDocumento', () => {
  it('groups CBSP by code, title phrase and mixed titles', () => {
    const a = chaveAgrupamentoDocumento({
      id: '1',
      tipo_documento: 'treinamento',
      subtipo: 'CBSP',
      titulo: 'Curso básico de segurança de plataforma - CBSP',
    });
    const b = chaveAgrupamentoDocumento({
      id: '2',
      tipo_documento: 'treinamento',
      titulo: 'Curso básico de segurança de plataforma',
    });
    const c = chaveAgrupamentoDocumento({
      id: '3',
      tipo_documento: 'treinamento',
      titulo: 'CBSP',
    });
    const d = chaveAgrupamentoDocumento({
      id: '4',
      tipo_documento: 'treinamento',
      titulo: 'Declaração CBSP',
    });
    assert.equal(a, 'treinamento:CBSP');
    assert.equal(b, a);
    assert.equal(c, a);
    assert.equal(d, a);
  });

  it('does not collapse different courses', () => {
    const cbsp = chaveAgrupamentoDocumento({
      id: '1',
      tipo_documento: 'treinamento',
      titulo: 'CBSP',
    });
    const huet = chaveAgrupamentoDocumento({
      id: '2',
      tipo_documento: 'treinamento',
      titulo: 'T-HUET',
    });
    assert.notEqual(cbsp, huet);
  });
});

describe('agruparDocumentosPorTipo', () => {
  it('picks valid CBSP as primary and keeps expired as history', () => {
    const groups = agruparDocumentosPorTipo(
      [
        {
          id: 'old',
          tipo_documento: 'treinamento',
          titulo: 'Curso básico de segurança de plataforma',
          data_emissao: '2021-10-23',
          data_validade: '2023-10-22',
          status_validacao: 'vencido',
        },
        {
          id: 'new',
          tipo_documento: 'treinamento',
          subtipo: 'CBSP',
          titulo: 'Curso básico de segurança de plataforma - CBSP',
          data_emissao: '2023-10-23',
          data_validade: '2026-10-23',
          status_validacao: 'valido',
        },
      ],
      HOJE,
    );

    assert.equal(groups.length, 1);
    assert.equal(groups[0].primary.id, 'new');
    assert.equal(groups[0].historico.length, 1);
    assert.equal(groups[0].historico[0].id, 'old');
  });

  it('prefers real certificate over declaração when both are valid', () => {
    assert.equal(isDeclaracaoDocumento({ id: 'd', titulo: 'Declaração de CBSP' }), true);
    const groups = agruparDocumentosPorTipo(
      [
        {
          id: 'decl',
          tipo_documento: 'treinamento',
          titulo: 'Declaração de CBSP',
          data_emissao: '2025-01-01',
          data_validade: '2027-01-01',
          status_validacao: 'valido',
        },
        {
          id: 'cert',
          tipo_documento: 'treinamento',
          titulo: 'CBSP',
          data_emissao: '2024-10-23',
          data_validade: '2026-10-23',
          status_validacao: 'valido',
        },
      ],
      HOJE,
    );
    assert.equal(groups[0].primary.id, 'cert');
    assert.equal(groups[0].historico[0].id, 'decl');
  });
});

describe('contarDocsPorStatusPrimario', () => {
  it('does not count obsolete expired CBSP as vencido when a valid one exists', () => {
    const counts = contarDocsPorStatusPrimario(
      [
        {
          id: 'old',
          tipo_documento: 'treinamento',
          titulo: 'CBSP',
          data_validade: '2023-10-22',
          status_validacao: 'vencido',
        },
        {
          id: 'new',
          tipo_documento: 'treinamento',
          titulo: 'CBSP',
          data_validade: '2026-10-23',
          status_validacao: 'valido',
        },
        {
          id: 'perm',
          tipo_documento: 'treinamento',
          titulo: 'TEC INST. TUBULAÇÃO',
          subtipo: 'T-INS-TUB',
          data_validade: null,
          status_validacao: 'valido',
        },
      ],
      HOJE,
    );
    assert.equal(counts.total_grupos, 2);
    assert.equal(counts.qtd_docs_vencidos, 0);
    assert.equal(counts.qtd_docs_validos, 2);
    assert.equal(counts.permanentes, 1);
  });
});

describe('idsComPrimarioVencido', () => {
  it('excludes colaborador whose only expired doc is superseded', () => {
    const ids = idsComPrimarioVencido(
      [
        {
          id: 'old',
          colaborador_id: 'c1',
          tipo_documento: 'treinamento',
          titulo: 'CBSP',
          data_validade: '2023-10-22',
        },
        {
          id: 'new',
          colaborador_id: 'c1',
          tipo_documento: 'treinamento',
          titulo: 'CBSP',
          data_validade: '2026-10-23',
        },
        {
          id: 'expired-other',
          colaborador_id: 'c2',
          tipo_documento: 'treinamento',
          titulo: 'T-HUET',
          data_validade: '2024-01-01',
        },
      ],
      HOJE,
    );
    assert.equal(ids.has('c1'), false);
    assert.equal(ids.has('c2'), true);
  });
});

describe('somarDocsPorStatusPrimario', () => {
  it('sums only primaries so a superseded CBSP does not inflate the KPI', () => {
    const sum = somarDocsPorStatusPrimario(
      [
        {
          id: 'old',
          colaborador_id: 'c1',
          tipo_documento: 'treinamento',
          titulo: 'CBSP',
          data_validade: '2023-10-22',
        },
        {
          id: 'new',
          colaborador_id: 'c1',
          tipo_documento: 'treinamento',
          titulo: 'CBSP',
          data_validade: '2026-10-23',
        },
        {
          id: 'huet',
          colaborador_id: 'c2',
          tipo_documento: 'treinamento',
          titulo: 'T-HUET',
          data_validade: '2024-01-01',
        },
      ],
      HOJE,
    );
    assert.equal(sum.vencidos, 1);
    assert.equal(sum.validos, 1);
  });
});
