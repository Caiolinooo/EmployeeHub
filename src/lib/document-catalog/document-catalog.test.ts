import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isQhseRelatedText,
  isQhseCatalogDocument,
  isOccupationalExamTipo,
  qhseFlagsForGtTipo,
  restrictCatalogToQhse,
} from './qhse';
import { normalizePersonName } from './names';
import {
  CATALOG_COLAB_SELECT,
  CATALOG_USER_SELECT,
  catalogColabSelectIsSafe,
  catalogUserSelectIsSafe,
  digitsOrNull,
  flattenCatalogColabRow,
  phonesMatch,
  pickUniqueNameMatch,
  taxIdOrFilter,
} from './identity-match';
import {
  DOCUMENT_CATALOG_SOURCE_IDS,
  isDocumentCatalogSourceId,
  type CatalogDocument,
  type CatalogResolveResult,
} from './types';
import { canSeeQhseDocuments } from './permissions';

describe('document-catalog qhse hints', () => {
  it('detects EPI / QHSE attendance titles', () => {
    assert.equal(isQhseRelatedText('Treinamento de EPI e Uniformes'), true);
    assert.equal(isQhseRelatedText('Ficha de EPI — Taifeiro'), true);
    assert.equal(isQhseRelatedText('Reunião QHSE semanal'), true);
    assert.equal(isQhseRelatedText('Lista de presença DDS'), false);
  });

  it('does not treat ASO exam titles as QHSE attendance', () => {
    assert.equal(isQhseRelatedText('ASO periódico'), false);
    assert.equal(isQhseRelatedText('Atestado de Saúde Ocupacional'), false);
    assert.equal(isQhseRelatedText('Laudo ocupacional'), false);
  });
});

describe('document-catalog identity', () => {
  it('normalizes names for attendance matching', () => {
    assert.equal(normalizePersonName('José da Silva'), normalizePersonName('JOSE DA SILVA'));
    assert.equal(normalizePersonName('  Ana   Souza  '), 'ana souza');
  });

  it('never selects cpf / full_name / phone on users_unified', () => {
    assert.equal(catalogUserSelectIsSafe(CATALOG_USER_SELECT), true);
    assert.equal(catalogUserSelectIsSafe('id, email, cpf, tax_id'), false);
    assert.ok(CATALOG_USER_SELECT.includes('tax_id'));
    assert.ok(CATALOG_USER_SELECT.includes('phone_number'));
    assert.equal(/\bcpf\b/.test(CATALOG_USER_SELECT), false);
  });

  it('never selects view aliases like cargo_nome on gt_colaboradores', () => {
    assert.equal(catalogColabSelectIsSafe(CATALOG_COLAB_SELECT), true);
    assert.equal(
      catalogColabSelectIsSafe('id, nome_completo, cpf, email, telefone, user_id, cargo_nome'),
      false
    );
    assert.ok(CATALOG_COLAB_SELECT.includes('cargo:gt_cargos(nome)'));
    assert.equal(/\bcargo_nome\b/.test(CATALOG_COLAB_SELECT), false);
  });

  it('flattens cargo:gt_cargos(nome) into cargo_nome', () => {
    const flat = flattenCatalogColabRow({
      id: 'c1',
      nome_completo: 'Ana Souza',
      cpf: '12345678909',
      email: 'ana@example.com',
      telefone: '22999487751',
      user_id: 'u1',
      cargo: { nome: 'Taifeiro' },
    });
    assert.equal(flat.cargo_nome, 'Taifeiro');
    assert.equal(flat.id, 'c1');
    const fromArray = flattenCatalogColabRow({
      id: 'c2',
      cargo: [{ nome: 'Marinheiro' }],
    });
    assert.equal(fromArray.cargo_nome, 'Marinheiro');
  });

  it('matches tax_id in digits and masked form', () => {
    assert.equal(digitsOrNull('123.456.789-09'), '12345678909');
    assert.ok(taxIdOrFilter('12345678909').includes('tax_id.eq.12345678909'));
    assert.ok(taxIdOrFilter('12345678909').includes('tax_id.eq.123.456.789-09'));
  });

  it('matches phones by digits or last 8', () => {
    assert.equal(phonesMatch('22999487751', '(22) 99948-7751'), true);
    assert.equal(phonesMatch('22999487751', '999487751'), true);
    assert.equal(phonesMatch('22999487751', '1133334444'), false);
  });

  it('accepts a unique corroborated name and rejects ambiguous names', () => {
    const unique = pickUniqueNameMatch(
      [{ nome: 'Janaina Anjos da Silva' }, { nome: 'Maria Souza' }],
      (row) => row.nome,
      'Janaina Anjos'
    );
    assert.equal(unique?.nome, 'Janaina Anjos da Silva');

    const ambiguous = pickUniqueNameMatch(
      [{ nome: 'Janaina Anjos Lima' }, { nome: 'Janaina Anjos Costa' }],
      (row) => row.nome,
      'Janaina Anjos'
    );
    assert.equal(ambiguous, null);
  });
});

describe('document-catalog source ids', () => {
  it('accepts registered sources and rejects unknown', () => {
    assert.equal(isDocumentCatalogSourceId('epi'), true);
    assert.equal(isDocumentCatalogSourceId('lista_presenca'), true);
    assert.equal(isDocumentCatalogSourceId('unknown'), false);
    assert.ok(DOCUMENT_CATALOG_SOURCE_IDS.includes('gt'));
  });
});

describe('document-catalog qhse module gate', () => {
  it('allows USER with module epi and ADMIN without extra ACLs', () => {
    assert.equal(
      canSeeQhseDocuments({
        id: 'u1',
        role: 'USER',
        access_permissions: { modules: { epi: true } },
      }),
      true
    );
    assert.equal(canSeeQhseDocuments({ id: 'a1', role: 'ADMIN' }), true);
    assert.equal(canSeeQhseDocuments({ id: 'm1', role: 'MANAGER' }), true);
  });

  it('hides QHSE when module epi is off and does not require catalog ACLs', () => {
    assert.equal(
      canSeeQhseDocuments({
        id: 'u1',
        role: 'USER',
        access_permissions: {
          modules: { epi: false },
          features: { 'lista-presenca.manage': true, 'gestao-tripulantes.view': true },
        },
      }),
      false
    );
  });

  it('treats category qhse as a QHSE catalog document', () => {
    assert.equal(isQhseCatalogDocument({ qhseRelated: true, category: 'rh' }), true);
    assert.equal(isQhseCatalogDocument({ qhseRelated: false, category: 'qhse' }), true);
    assert.equal(isQhseCatalogDocument({ qhseRelated: false, category: 'gt' }), false);
  });

  it('never treats ASO/laudo as QHSE, even when a source mis-tags them', () => {
    assert.equal(isOccupationalExamTipo('aso'), true);
    assert.equal(isOccupationalExamTipo('laudo'), true);
    assert.equal(isOccupationalExamTipo('LAUDO'), true);
    assert.equal(isOccupationalExamTipo('epi'), false);
    assert.equal(isOccupationalExamTipo('certificado'), false);

    assert.equal(
      isQhseCatalogDocument({ qhseRelated: true, category: 'qhse', tipoDocumento: 'aso' }),
      false
    );
    assert.equal(
      isQhseCatalogDocument({ qhseRelated: true, category: 'qhse', tipoDocumento: 'laudo' }),
      false
    );
    assert.equal(
      isQhseCatalogDocument({ qhseRelated: false, category: 'aso', tipoDocumento: 'passaporte' }),
      false
    );
    assert.equal(
      isQhseCatalogDocument({ qhseRelated: true, category: 'qhse', tipoDocumento: 'epi' }),
      true
    );
  });

  it('tags GT ASO/laudo out of QHSE and GT EPI into QHSE', () => {
    assert.deepEqual(qhseFlagsForGtTipo('aso'), { qhseRelated: false, category: 'gt' });
    assert.deepEqual(qhseFlagsForGtTipo('laudo'), { qhseRelated: false, category: 'gt' });
    assert.deepEqual(qhseFlagsForGtTipo('certificado'), { qhseRelated: false, category: 'gt' });
    assert.deepEqual(qhseFlagsForGtTipo('ficha_epi'), { qhseRelated: true, category: 'qhse' });
  });

  it('restrictCatalogToQhse drops occupational exams from ?qhse=1', () => {
    const aso: CatalogDocument = {
      id: 'gt:aso',
      source: 'gt',
      sourceLabel: 'Gestão de Tripulantes',
      title: 'ASO periódico',
      category: 'qhse',
      signed: false,
      qhseRelated: true,
      tipoDocumento: 'aso',
      recordId: 'aso',
      downloadKind: 'none',
      matchBy: ['cpf'],
    };
    const epi: CatalogDocument = {
      id: 'epi:1',
      source: 'epi',
      sourceLabel: 'QHSE / EPI',
      title: 'Ficha de EPI / Uniformes (AN-HSE-005)',
      category: 'qhse',
      signed: true,
      qhseRelated: true,
      tipoDocumento: 'epi',
      recordId: 'ficha',
      downloadKind: 'api',
      matchBy: ['user_id'],
    };
    const input: CatalogResolveResult = {
      identity: {
        userId: 'u1',
        colaboradorId: 'c1',
        cpfDigits: null,
        email: null,
        emailLower: null,
        fullName: 'Teste',
        fullNameNormalized: 'teste',
        position: null,
        department: null,
        sectorId: null,
      },
      documents: [aso, epi],
      sources: [
        { id: 'gt', label: 'Gestão de Tripulantes', count: 1 },
        { id: 'epi', label: 'QHSE / Ficha de EPI', count: 1 },
      ],
      gaps: [],
    };
    const restricted = restrictCatalogToQhse(input);
    assert.equal(restricted.documents.length, 1);
    assert.equal(restricted.documents[0].id, 'epi:1');
    assert.equal(restricted.sources.some((s) => s.id === 'gt'), false);
  });
});
