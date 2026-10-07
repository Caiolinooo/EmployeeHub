/**
 * Catálogo do select de tipo na aba Documentos (upload e Editar).
 * Client-safe. Valores canônicos de `TIPOS_DOCUMENTO_VALIDOS`.
 */

import { normalizarTipoDocumento } from './documento-tipos';

export const TIPOS_DOCUMENTO_UPLOAD_ABA = [
  { value: 'pessoal', label: 'Documentos Pessoais' },
  { value: 'contratual', label: 'Documentos Contratuais (Admissão)' },
  { value: 'demissional', label: 'Documentos Demissionais (Desligamento)' },
  { value: 'ferias', label: 'Férias' },
  { value: 'ponto', label: 'Ponto' },
  { value: 'outro', label: 'Outro / Declaração' },
] as const;

const LABEL_TIPO: Record<string, string> = {
  pessoal: 'Documentos Pessoais',
  documento_pessoal: 'Documentos Pessoais',
  cnh: 'Documentos Pessoais',
  ctps: 'Documentos Pessoais',
  reservista: 'Documentos Pessoais',
  titulo_eleitor: 'Documentos Pessoais',
  certidao_nascimento: 'Documentos Pessoais',
  certidao_casamento: 'Documentos Pessoais',
  rg: 'Documentos Pessoais',
  visto: 'Documentos Pessoais',
  ctm: 'Documentos Pessoais',
  habilitacao: 'Documentos Pessoais',
  contratual: 'Documentos Contratuais',
  contrato: 'Documentos Contratuais',
  demissional: 'Documentos Demissionais',
  ferias: 'Férias',
  ponto: 'Ponto',
  outro: 'Outro / Declaração',
  declaracao: 'Outro / Declaração',
  aso: 'ASO',
  laudo: 'Laudo',
  treinamento: 'Treinamento',
  certificado: 'Certificado',
  passaporte: 'Passaporte',
};

/** Rótulo da categoria no card. Legado (`documento_pessoal`) não aparece cru. */
export function labelTipoDocumento(tipo: string | null | undefined): string {
  const raw = (tipo || '').trim().toLowerCase();
  if (!raw) return 'Documento';
  if (LABEL_TIPO[raw]) return LABEL_TIPO[raw];
  const norm = normalizarTipoDocumento(raw);
  if (norm.tipo && LABEL_TIPO[norm.tipo]) return LABEL_TIPO[norm.tipo];
  return raw.replace(/_/g, ' ');
}

export type TipoDocumentoUploadAba = (typeof TIPOS_DOCUMENTO_UPLOAD_ABA)[number]['value'];

/** Valor inicial do select. Legado (`documento_pessoal`) abre na opção canônica. */
export function tipoInicialFormularioDocumento(tipo: string | null | undefined): string {
  const raw = (tipo || '').trim().toLowerCase();
  if (!raw) return 'pessoal';
  const norm = normalizarTipoDocumento(raw);
  const canon = norm.tipo || raw;
  if (TIPOS_DOCUMENTO_UPLOAD_ABA.some((opcao) => opcao.value === canon)) return canon;
  return raw;
}
