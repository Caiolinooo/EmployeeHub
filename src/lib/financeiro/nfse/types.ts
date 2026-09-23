/**
 * CONTRATO FECHADO — §3.2 do design financeiro (local://financeiro-design.md).
 * Fonte de verdade: financeiro-design.md v1.0. Mudança só por revisão do design.
 * Registry (getNfseProvider/NFSE_PROVIDERS): ./registry.ts.
 * raw devolvido NUNCA contém segredos (logs em fin_eventos).
 */

export type NfseProviderKey = 'abrasf202' | 'abrasf204' | 'nacional' | 'proprietario';
export type NfseAmbiente = 'homologacao' | 'producao';

export interface NfseContext {
  config: {
    nfseConfigId: string; empresaId: string; municipioIbge: string; providerKey: NfseProviderKey;
    cnpj: string; razaoSocial: string; inscricaoMunicipal?: string;
    regimeEspecial?: string; optanteSimples: boolean; incentivoFiscal: boolean;
    aliquotaIss?: number; issRetidoPadrao: boolean;
    rpsSerie: string; ambiente: NfseAmbiente;
    configExtra: Record<string, unknown>;         // urls proprietárias etc. (sem segredos)
  };
  credenciais: Record<string, string>;            // app_secrets decifrados (senha do pfx, token...)
  certificado?: { pfxPath: string; pfxPassphrase: string; fingerprint: string };
}

export interface NfseItemInput {
  codigoLc116: string; descricao: string;
  quantidade: number; valorUnitario: number;
  tributavel: boolean; aliquotaIss?: number;
}
export interface NfseTomador {
  nome: string; documento: string;                // CPF (11) ou CNPJ (14), dígitos
  email?: string; municipioIbge: string; inscricaoMunicipal?: string;
  endereco?: { logradouro: string; numero: string; complemento?: string;
               bairro: string; cep: string };
}
export interface NfseRpsInput {
  rpsNumero: number; rpsSerie: string;            // alocados pelo service (contador transacional)
  dataEmissao: string;                            // YYYY-MM-DD
  competencia: string;                            // YYYY-MM
  tomador: NfseTomador;
  itens: NfseItemInput[];
  valorServicos: number; descontosIncondicionais?: number; deducoes?: number;
  aliquotaIss: number; issRetido: boolean;
  discriminacao: string;                          // texto livre (referência à fatura)
  faturaId?: string; faturaNumero?: number;
}
export interface NfseErro { codigo: string; mensagem: string }
export interface NfseEmissaoResultado {
  ok: boolean; protocolo?: string; numeroNfse?: string; codigoVerificacao?: string;
  dataAutorizacao?: string; xmlNfse?: string; pdfUrl?: string;
  erro?: NfseErro; raw?: unknown;                 // raw SEM segredos (logs em fin_eventos)
}
export interface NfseConsultaResultado {
  ok: boolean; situacao?: 'autorizado' | 'rejeitado' | 'cancelado' | 'nao_encontrado';
  numeroNfse?: string; codigoVerificacao?: string; xmlNfse?: string; erro?: NfseErro; raw?: unknown;
}
export interface NfseCancelamentoResultado {
  ok: boolean; xmlCancelamento?: string; erro?: NfseErro; raw?: unknown;
}

export interface NfseProvider {
  key: NfseProviderKey;
  meta: { descricao: string; exigeCertificadoA1: boolean; loteMaximo: number };
  emitirRps(ctx: NfseContext, input: NfseRpsInput): Promise<NfseEmissaoResultado>;
  consultar(ctx: NfseContext, ref: { protocolo?: string; numeroNfse?: string;
             rpsNumero?: number; rpsSerie?: string }): Promise<NfseConsultaResultado>;
  cancelar(ctx: NfseContext, ref: { numeroNfse: string; codigoCancelamento: string;
             motivo?: string }): Promise<NfseCancelamentoResultado>;
}
