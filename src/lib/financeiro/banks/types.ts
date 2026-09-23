/**
 * CONTRATO FECHADO — §3.1 do design financeiro (local://financeiro-design.md).
 * Fonte de verdade: financeiro-design.md v1.0. Mudança só por revisão do design.
 * Registry (getBankAdapter/BANK_CATALOG): ./registry.ts.
 * Adapters são stateless (tudo via BankContext); raw devolvido NUNCA contém
 * segredos; timeout de rede 30s; método opcional ausente → CapacidadeNaoSuportadaError.
 */

export type BankAdapterKey = 'itau' | 'xp' | 'bb' | 'santander' | 'bradesco';
export type BankCapability = 'cobranca_boleto' | 'cobranca_pix' | 'pagamento_lote' | 'conciliacao';
export type BankAmbiente = 'sandbox' | 'producao';

export interface BankCredentialField {
  key: string;                    // ex 'client_id' → app_secrets fin_banco_<id>_client_id
  label: string;                  // pt-BR técnico (UI renderiza direto)
  kind: 'text' | 'secret' | 'password';
  required: boolean;
  help?: string;                  // ex 'Emitido no DevPortal Itaú, bound ao CNPJ'
}
export interface CertField { key: 'pfx'; label: string; required: boolean; help?: string }

export interface BankAdapterMeta {
  key: BankAdapterKey;
  nome: string;                                   // 'Itaú Unibanco'
  codigoFebraban: string;                         // '341'
  ambientes: BankAmbiente[];
  capacidades: BankCapability[];
  credentialSchema: BankCredentialField[];
  certificados: CertField[];
  descricaoCredenciais: string;                   // o que o banco exige de credencial real
}

/** Contexto montado pelo service (credenciais já decifradas de app_secrets). */
export interface BankContext {
  integracaoId: string;
  ambiente: BankAmbiente;
  credenciais: Record<string, string>;
  certificado?: { pfxPath: string; pfxPassphrase: string; fingerprint: string };
  conta: { bancoCodigo: string; agencia: string; conta: string; digito: string;
           titularNome: string; titularDocumento: string };
}

export interface ConciliacaoMovimento {
  idExterno: string; data: string;                // YYYY-MM-DD
  tipo: 'credito' | 'debito'; valor: number;      // > 0
  descricao: string; nossoNumero?: string; txid?: string; raw?: Record<string, unknown>;
}
export interface Pagador { nome: string; documento: string; email?: string; }
export interface CobrancaBoletoInput {
  valor: number; vencimento: string; pagador: Pagador; descricao: string;
  nossoNumero?: string; faturaId?: string;
}
export interface CobrancaPixInput {
  valor: number; txid?: string; expiracaoSegundos?: number;
  pagador?: Pagador; descricao?: string; faturaId?: string;
}
export interface CobrancaGerada {
  idExterno: string; linhaDigitavel?: string; qrCodeEmv?: string; txid?: string;
  pdfUrl?: string; raw: Record<string, unknown>;
}
export interface PagamentoLoteItem {
  idLocal: string;                                // fin_pagamentos.id
  favorecido: { nome: string; documento: string; tipoConta: 'cc' | 'p';
                banco: string; agencia: string; conta: string; digitoConta: string };
  valor: number; dataPrevista: string; descricao: string;
}
export interface PagamentoLoteResultado {
  loteIdExterno?: string;
  itens: { idLocal: string; aceito: boolean; idExternoBanco?: string; erro?: string }[];
  raw?: Record<string, unknown>;
}
export interface BankStatusResultado {
  ok: boolean; detalhe?: string;
  saldo?: { data: string; disponivel: number };
}

export interface BankAdapter {
  meta: BankAdapterMeta;
  listarConciliacao(ctx: BankContext, input: { de: string; ate: string }): Promise<ConciliacaoMovimento[]>;
  gerarCobrancaBoleto?(ctx: BankContext, input: CobrancaBoletoInput): Promise<CobrancaGerada>;
  gerarCobrancaPix?(ctx: BankContext, input: CobrancaPixInput): Promise<CobrancaGerada>;
  enviarPagamentoLote?(ctx: BankContext, itens: PagamentoLoteItem[]): Promise<PagamentoLoteResultado>;
  status(ctx: BankContext): Promise<BankStatusResultado>;
}

/** Adapter ausente/capacidade ausente → Error tipado (§3.1). */
export class CapacidadeNaoSuportadaError extends Error {
  constructor(capacidade: string, banco: string) {
    super(`Capacidade '${capacidade}' não suportada pelo adapter '${banco}'.`);
    this.name = 'CapacidadeNaoSuportadaError';
  }
}
