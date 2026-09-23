/**
 * Tipos TypeScript do módulo Financeiro — espelham o modelo de dados fin_*
 * (migrations 20260922_000001/000002) e o contrato das rotas /api/financeiro/**
 * (§2 e §6 do design financeiro, local://financeiro-design.md).
 *
 * Consumidores: rotas de API (dev-Back), src/lib/financeiro/api-client.ts (dev-Front),
 * componentes de UI. Contratos §3.1–3.3 vivem em src/lib/financeiro/{banks,nfse,invoice}/types.ts.
 */

// ============================================================
// Response wrappers (padrão do repo)
// ============================================================

export interface FinApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface FinPaginatedResponse<T> {
  success: boolean;
  data?: {
    items: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  error?: string;
}

// ============================================================
// Enumerações (CHECKs do banco)
// ============================================================

export type FinFaturaOrigem = 'folha' | 'medicao' | 'manual';
export type FinFaturaStatus = 'rascunho' | 'emitida' | 'nfse_emitida' | 'paga' | 'cancelada';
export type FinTemplateTipo = 'xlsx' | 'html';
export type FinIntegracaoAmbiente = 'sandbox' | 'producao';
export type FinIntegracaoStatus = 'configurando' | 'ativa' | 'erro' | 'desativada';
export type FinContaTipo = 'corrente' | 'investimento' | 'pagamento';
export type FinCobrancaTipo = 'boleto' | 'pix' | 'transferencia';
export type FinCobrancaStatus = 'pendente' | 'gerada' | 'liquidada' | 'expirada' | 'cancelada';
export type FinPagamentoOrigem = 'payroll_sheet' | 'manual';
export type FinPagamentoStatus = 'pendente' | 'enviado' | 'processado' | 'rejeitado' | 'cancelado';
export type FinConciliacaoTipo = 'credito' | 'debito';
export type FinConciliacaoOrigem = 'api' | 'csv' | 'manual';
export type FinConciliacaoStatus = 'nao_conciliado' | 'conciliado' | 'ignorado';
export type FinEventoEntidade = 'fatura' | 'nfse' | 'cobranca' | 'pagamento' | 'conciliacao' | 'integracao';
export type FinNfseProviderKey = 'abrasf202' | 'abrasf204' | 'nacional' | 'proprietario';
export type FinNfseAmbiente = 'homologacao' | 'producao';
export type FinNfseStatus = 'rps_gerado' | 'enviado' | 'autorizado' | 'rejeitado' | 'cancelado';

// ============================================================
// Entidades fin_* (linhas do banco; datas/campos JSONB conforme migration)
// ============================================================

export interface FinCliente {
  id: string;
  empresa_id: string;
  client_key: string;
  nome: string;
  documento?: string | null;
  email?: string | null;
  endereco?: Record<string, unknown> | null;
  moeda: string;
  condicao_pagamento?: string | null;
  categoria?: string | null;          // offshore | maritime | onshore
  subcategoria?: string | null;
  inscricao_municipal?: string | null;
  inscricao_estadual?: string | null;
  pais?: string;                      // ISO 3166-1 alpha-2; default 'BR'
  tax_id?: string | null;             // VAT/Tax ID alfanumérico (tomador exterior)
  default_template_id?: string | null;
  metadados?: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FinClienteForm {
  empresa_id: string;
  client_key: string;
  nome: string;
  documento?: string;
  email?: string;
  endereco?: Record<string, unknown>;
  moeda?: string;
  condicao_pagamento?: string;
  categoria?: string;
  subcategoria?: string;
  inscricao_municipal?: string;
  inscricao_estadual?: string;
  pais?: string;
  tax_id?: string;
  default_template_id?: string | null;
  metadados?: Record<string, unknown>;
  is_active?: boolean;
}

export interface FinFaturaTemplate {
  id: string;
  nome: string;
  tipo: FinTemplateTipo;
  storage_path: string;
  mapping: {
    celulas?: Record<string, string>;
    servicos?: { linhaInicial: number; linhaFinal: number;
                 colunas: { descricao: string; referencia: string; valor: string } };
    totais?: { celula: string };
    conta?: { secao?: string };
    [k: string]: unknown;
  };
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FinFatura {
  id: string;
  empresa_id: string;
  cliente_id?: string | null;
  numero: number;
  ano: number;
  competencia_mes?: number | null;
  competencia_ano?: number | null;
  origem_tipo: FinFaturaOrigem;
  payroll_sheet_id?: string | null;
  template_id?: string | null;
  moeda: string;
  valor_total: number;
  data_emissao?: string | null;
  data_vencimento?: string | null;
  condicao_pagamento?: string | null;
  call_off?: string | null;
  vessel_name?: string | null;        // embarcação (offshore/maritime)
  po_number?: string | null;          // purchase order do cliente
  cliente_snapshot?: Record<string, unknown> | null;
  observacoes?: string | null;
  status: FinFaturaStatus;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  cliente?: FinCliente | null;
  itens?: FinFaturaItem[];
}

export interface FinFaturaItem {
  id: string;
  fatura_id: string;
  ordem: number;
  descricao: string;
  referencia?: string | null;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  codigo_lc116?: string | null;       // LC 116/2003 por item; fallback config.codigo_lc116_padrao
  aliquota_iss?: number | null;       // % por item; fallback fin_nfse_config.aliquota_iss
  cnae?: string | null;
  origem: FinFaturaOrigem;
  created_at: string;
}

export interface FinFaturaItemInput {
  descricao: string;
  referencia?: string;
  quantidade?: number;
  valor_unitario: number;
  valor_total?: number;
  codigo_lc116?: string;
  aliquota_iss?: number;
  cnae?: string;
  origem?: FinFaturaOrigem;
}

export interface FinFaturaCreateInput {
  empresaId: string;
  clienteId?: string;
  origemTipo: FinFaturaOrigem;
  payrollSheetId?: string;
  competencia?: string;               // YYYY-MM
  templateId?: string;
  moeda?: string;
  dataVencimento?: string;
  callOff?: string;
  observacoes?: string;
  condicaoPagamento?: string;
  itens: FinFaturaItemInput[];
}

export interface FinFaturaUpdateInput {
  clienteId?: string;
  templateId?: string | null;
  moeda?: string;
  dataVencimento?: string | null;
  callOff?: string | null;
  observacoes?: string | null;
  condicao_pagamento?: string | null;
  competencia?: string | null;
  itens?: FinFaturaItemInput[];
}

export interface FinIntegracaoBanco {
  id: string;
  adapter_key: string;
  apelido: string;
  ambiente: FinIntegracaoAmbiente;
  certificado_path?: string | null;
  certificado_fingerprint?: string | null;
  certificado_validade?: string | null;
  status: FinIntegracaoStatus;
  ultima_testagem?: { em: string; ok: boolean; detalhe?: string } | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FinContaBancaria {
  id: string;
  empresa_id: string;
  integracao_id?: string | null;
  banco_codigo: string;
  banco_nome?: string | null;
  agencia?: string | null;
  conta?: string | null;
  digito?: string | null;
  tipo: FinContaTipo;
  titular_nome: string;
  titular_documento: string;
  swift_bic?: string | null;          // SWIFT/BIC (internacional)
  iban?: string | null;               // IBAN (Europa/UK)
  routing_number?: string | null;     // EUA (9 dígitos)
  sort_code?: string | null;          // UK (6 dígitos)
  moeda?: string;                     // default 'BRL'
  banco_correspondente?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FinContaBancariaForm {
  empresa_id: string;
  integracao_id?: string;
  banco_codigo: string;
  banco_nome?: string;
  agencia?: string;
  conta?: string;
  digito?: string;
  tipo?: FinContaTipo;
  titular_nome: string;
  titular_documento: string;
  swift_bic?: string;
  iban?: string;
  routing_number?: string;
  sort_code?: string;
  moeda?: string;
  banco_correspondente?: string;
  is_active?: boolean;
}

export interface FinCobranca {
  id: string;
  fatura_id: string;
  conta_bancaria_id: string;
  tipo: FinCobrancaTipo;
  valor: number;
  vencimento?: string | null;
  status: FinCobrancaStatus;
  id_externo?: string | null;
  nosso_numero?: string | null;
  linha_digitavel?: string | null;
  txid?: string | null;
  qr_code_emv?: string | null;
  resposta_adapter?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface FinCobrancaCreateInput {
  faturaId: string;
  contaBancariaId: string;
  tipo: 'boleto' | 'pix';
  vencimento?: string;
  valor?: number;
}

export interface FinPagamento {
  id: string;
  origem_tipo: FinPagamentoOrigem;
  origem_id?: string | null;
  conta_bancaria_id: string;
  favorecido: {
    nome: string;
    documento: string;
    banco?: string;
    agencia?: string;
    conta?: string;
    digito?: string;
    tipoConta?: 'cc' | 'p';
  };
  valor: number;
  data_prevista?: string | null;
  status: FinPagamentoStatus;
  lote_id_externo?: string | null;
  id_externo?: string | null;
  resposta_adapter?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface FinConciliacao {
  id: string;
  conta_bancaria_id: string;
  data_movimento: string;
  tipo: FinConciliacaoTipo;
  valor: number;
  descricao?: string | null;
  id_externo?: string | null;
  origem: FinConciliacaoOrigem;
  cobranca_id?: string | null;
  status: FinConciliacaoStatus;
  raw?: Record<string, unknown> | null;
  created_at: string;
}

export interface FinEvento {
  id: string;
  entidade: FinEventoEntidade;
  entidade_id?: string | null;
  tipo: string;
  payload?: Record<string, unknown> | null;
  ator_id?: string | null;
  ator_nome?: string | null;
  created_at: string;
}

export interface FinMunicipio {
  codigo_ibge: string;
  nome: string;
  uf: string;
  provider_sugerido?: FinNfseProviderKey | null;
  wsdl_url?: string | null;
  ambiente_urls?: { producao?: string; homologacao?: string } | null;
  atualizado_em: string;
}

export interface FinNfseConfig {
  id: string;
  empresa_id: string;
  municipio_id: string;
  municipio?: FinMunicipio | null;
  provider_key: FinNfseProviderKey;
  inscricao_municipal?: string | null;
  regime_especial?: string | null;
  optante_simples: boolean;
  incentivo_fiscal: boolean;
  aliquota_iss?: number | null;
  iss_retido_padrao: boolean;
  config: Record<string, unknown>;
  rps_serie: string;
  proximo_numero_rps: number;
  certificado_path?: string | null;
  certificado_fingerprint?: string | null;
  certificado_validade?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FinNfseConfigForm {
  empresa_id: string;
  municipio_id: string;
  provider_key: FinNfseProviderKey;
  inscricao_municipal?: string;
  regime_especial?: string;
  optante_simples?: boolean;
  incentivo_fiscal?: boolean;
  aliquota_iss?: number;
  iss_retido_padrao?: boolean;
  config?: Record<string, unknown>;
  rps_serie?: string;
  is_active?: boolean;
}

export interface FinNfseEmissao {
  id: string;
  fatura_id: string;
  nfse_config_id: string;
  provider_key: FinNfseProviderKey;
  ambiente: FinNfseAmbiente;
  status: FinNfseStatus;
  rps_numero: number;
  rps_serie: string;
  lote_id?: string | null;
  protocolo?: string | null;
  numero_nfse?: string | null;
  codigo_verificacao?: string | null;
  xml_rps?: string | null;
  xml_nfse?: string | null;
  xml_cancelamento?: string | null;
  resumo_tributos?: {
    valorServicos?: number;
    aliquotaIss?: number;
    valorIss?: number;
    issRetido?: boolean;
    baseCalculo?: number;
  } | null;
  mensagem_erro?: { codigo?: string; mensagem?: string } | null;
  tentativas: number;
  created_at: string;
  updated_at: string;
  fatura?: FinFatura | null;
}

// ============================================================
// Shapes específicos das rotas (§6)
// ============================================================

/** GET /api/financeiro/visao-geral */
export interface FinVisaoGeral {
  kpis: {
    faturasPorStatus: Record<string, number>;
    totalFaturas: number;
    nfsePorStatus: Record<string, number>;
    cobrancasAbertas: number;
    recebidoMes: number;
    folhasPorStatus: Record<string, number>;
  };
  competencias: { competencia: string; faturas: number; total: number }[];
}

/** GET /api/financeiro/bancos/integracoes/[id] — credenciais nunca voltam, só preenchidos */
export interface FinIntegracaoBancoComCredenciais extends FinIntegracaoBanco {
  preenchidos: Record<string, boolean>;
  credencialSchema?: unknown;
}

/** GET /api/financeiro/bancos/catalogo — metas do BANK_CATALOG */
export type FinBancoCatalogoItem = {
  key: string;
  nome: string;
  codigoFebraban: string;
  ambientes: string[];
  capacidades: string[];
  credentialSchema: { key: string; label: string; kind: 'text' | 'secret' | 'password'; required: boolean; help?: string }[];
  certificados: { key: string; label: string; required: boolean; help?: string }[];
  descricaoCredenciais: string;
};

/** POST /api/financeiro/bancos/integracoes/[id]/testar */
export interface FinBancoTestarResultado {
  ok: boolean;
  detalhe?: string;
  saldo?: { data: string; disponivel: number };
}

/** POST /api/financeiro/bancos/integracoes/[id]/certificados */
export interface FinCertificadoUploadResultado {
  fingerprint: string;
  validade?: string | null;
}


/** GET /api/financeiro/certificado-a1 — A1 unico da empresa (sem senha). */
export interface FinCertificadoA1Meta {
  id: string;
  nome: string;
  emissor: string | null;
  validoAte: string | null;
  ativo: boolean;
  fingerprint: string;
  subjectCn: string;
}

/** POST /api/financeiro/cobrancas — cobrança gerada */
export type FinCobrancaGeradaResponse = FinCobranca;

/** POST /api/financeiro/conciliacoes/importar e upload-csv */
export interface FinConciliacaoImportarResultado {
  importados: number;
  conciliadosAutomaticos: number;
}

/** POST /api/financeiro/pagamentos/lote */
export interface FinPagamentoLoteResponse {
  loteId: string | null;
  loteIdExterno?: string;
  itens: { idLocal: string; aceito: boolean; idExternoBanco?: string; erro?: string }[];
}

/** POST /api/financeiro/faturas/gerar-da-folha */
export interface FinGerarDaFolhaInput {
  sheetId: string;
  clienteId: string;
  templateId?: string;
}

/** GET /api/financeiro/nfse/municipios */
export interface FinMunicipiosResponse {
  itens: FinMunicipio[];
  total: number;
}

/** POST /api/financeiro/nfse/config/[id]/credenciais */
export interface FinNfseCredencialInput {
  campo: string;
  valor: string;
}

/** GET /api/financeiro/nfse/emissoes/[id]?xml=1 */
export interface FinNfseEmissaoDetalhe extends FinNfseEmissao {
  preenchidos: Record<string, boolean>;
}
