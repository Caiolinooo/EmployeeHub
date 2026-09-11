/**
 * Pure-function checks for civil validity + current-vs-history grouping.
 * Run: npx tsx scripts/verify-docs-alertas.ts
 */
import {
  abaParaTipoDocumento,
  chaveConformidade,
  classificarValidadeCivil,
  contarAlertasVigentes,
  documentoPertenceAba,
  marcarPapeisConformidade,
} from '../src/lib/gestao-tripulantes/validade-civil';
import { montarItensAlerta } from '../src/lib/gestao-tripulantes/documentos-alertas-core';

function assert(cond: unknown, msg: string) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
}

const hoje = '2026-08-31';

assert(classificarValidadeCivil('2026-08-30', hoje) === 'vencido', 'yesterday is expired');
assert(classificarValidadeCivil('2026-08-31', hoje) === 'vencendo', 'today is expiring window');
assert(classificarValidadeCivil('2026-09-30', hoje) === 'vencendo', 'hoje+30 is expiring');
assert(classificarValidadeCivil('2026-10-01', hoje) === 'valido', 'hoje+31 is valid');
assert(classificarValidadeCivil(null, hoje) === 'sem_validade', 'null has no validity');

const sameCourse = marcarPapeisConformidade([
  {
    id: 'old',
    colaborador_id: 'c1',
    tipo_documento: 'treinamento',
    titulo: 'CIR',
    subtipo: 'CIR',
    data_validade: '2024-01-01',
    data_emissao: '2022-01-01',
  },
  {
    id: 'new',
    colaborador_id: 'c1',
    tipo_documento: 'treinamento',
    titulo: 'CIR',
    subtipo: 'CIR',
    data_validade: '2027-01-01',
    data_emissao: '2025-01-01',
  },
]);
assert(sameCourse.find((d) => d.id === 'new')?.papel === 'vigente', 'newer CIR is current');
assert(sameCourse.find((d) => d.id === 'old')?.papel === 'historico', 'older CIR is history');
assert(
  chaveConformidade(sameCourse[0]) === chaveConformidade(sameCourse[1]),
  'same course shares slot',
);

const counts = contarAlertasVigentes(sameCourse, hoje);
assert(counts.vencidos === 0, 'historical expired CIR must not count as KPI');
assert(counts.validos === 1, 'current CIR counts as valid');

const asos = marcarPapeisConformidade([
  {
    id: 'aso-old',
    colaborador_id: 'c1',
    tipo_documento: 'aso',
    titulo: 'Periódico 2023',
    data_validade: '2024-06-01',
    data_emissao: '2023-06-01',
  },
  {
    id: 'aso-new',
    colaborador_id: 'c1',
    tipo_documento: 'aso',
    titulo: 'Periódico 2026',
    data_validade: '2027-06-01',
    data_emissao: '2026-06-01',
  },
]);
assert(asos.find((d) => d.id === 'aso-new')?.papel === 'vigente', 'latest ASO is current');
assert(contarAlertasVigentes(asos, hoje).vencidos === 0, 'old ASO does not inflate KPI');

const vigenteExpired = marcarPapeisConformidade([
  {
    id: 'cnh',
    colaborador_id: 'c1',
    tipo_documento: 'cnh',
    titulo: 'CNH',
    data_validade: '2025-01-01',
  },
]);
assert(contarAlertasVigentes(vigenteExpired, hoje).vencidos === 1, 'current expired CNH counts');

const items = montarItensAlerta(
  [
    {
      id: 'old',
      colaborador_id: 'c1',
      tipo_documento: 'treinamento',
      subtipo: 'CIR',
      titulo: 'CIR',
      numero_documento: null,
      numero_rastreio: null,
      data_emissao: '2022-01-01',
      data_validade: '2024-01-01',
      status_validacao: 'valido',
      origem: 'mio',
      created_at: '2022-01-01',
    },
    {
      id: 'new',
      colaborador_id: 'c1',
      tipo_documento: 'treinamento',
      subtipo: 'CIR',
      titulo: 'CIR',
      numero_documento: null,
      numero_rastreio: null,
      data_emissao: '2025-01-01',
      data_validade: '2027-01-01',
      status_validacao: 'valido',
      origem: 'mio',
      created_at: '2025-01-01',
    },
    {
      id: 'cnh',
      colaborador_id: 'c1',
      tipo_documento: 'cnh',
      subtipo: null,
      titulo: 'CNH',
      numero_documento: '123',
      numero_rastreio: null,
      data_emissao: '2020-01-01',
      data_validade: '2025-01-01',
      status_validacao: 'valido',
      origem: 'upload',
      created_at: '2020-01-01',
    },
  ],
  { c1: { nome: 'ANDERSON', matricula: '670', cpf: '000' } },
  hoje,
);
const hist = items.find((i) => i.id === 'old');
const cnh = items.find((i) => i.id === 'cnh');
assert(hist?.papel === 'historico' && hist.status_stale, 'old CIR listed as stale history');
assert(cnh?.papel === 'vigente' && cnh.aba === 'documentos', 'CNH routes to documentos tab');
assert(hist?.aba === 'treinamentos', 'CIR routes to treinamentos tab');

assert(abaParaTipoDocumento('certificado') === 'treinamentos', 'certificado opens treinamentos');
assert(abaParaTipoDocumento('laudo') === 'aso', 'laudo opens aso');
assert(documentoPertenceAba('cnh', 'documentos'), 'cnh stays in documentos');
assert(!documentoPertenceAba('certificado', 'documentos'), 'certificado is not hidden in documentos leftover');

console.log('DOCS_ALERTAS_VERIFY_OK');
