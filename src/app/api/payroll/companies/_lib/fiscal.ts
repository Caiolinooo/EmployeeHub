/**
 * Campos fiscais/cadastrais estruturados de payroll_companies
 * (migration 20260923_000001_cadastros_fiscais.sql — design §1).
 * Compartilhado entre POST /api/payroll/companies e PUT /api/payroll/companies/[id].
 */

export const CAMPOS_FISCAIS_EMPRESA = [
  'razao_social',
  'nome_fantasia',
  'inscricao_estadual',
  'inscricao_municipal',
  'logradouro',
  'numero',
  'complemento',
  'bairro',
  'cep',
  'municipio',
  'uf',
  'municipio_ibge',
  'cnae_principal',
] as const;

export type CampoFiscalEmpresa = (typeof CAMPOS_FISCAIS_EMPRESA)[number];

/** Extrai os campos fiscais do body (snake_case) como string trimada ou null. */
export function extrairCamposFiscaisEmpresa(body: Record<string, unknown>): Record<CampoFiscalEmpresa, string | null> {
  const saida = {} as Record<CampoFiscalEmpresa, string | null>;
  for (const campo of CAMPOS_FISCAIS_EMPRESA) {
    const bruto = body[campo];
    const texto = typeof bruto === 'string' ? bruto.trim() : '';
    saida[campo] = texto || null;
  }
  if (saida.uf) saida.uf = saida.uf.toUpperCase().slice(0, 2);
  return saida;
}
