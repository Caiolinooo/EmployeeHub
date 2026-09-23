/**
 * Adapters placeholder — Banco do Brasil, Santander e Bradesco (§4 do design).
 * meta + credentialSchema COMPLETOS conforme exigências reais de cada banco;
 * TODOS os métodos lançam CapacidadeNaoSuportadaError até a implementação real.
 */
import type {
  BankAdapter,
  BankAdapterMeta,
  BankStatusResultado,
  CobrancaGerada,
  ConciliacaoMovimento,
  PagamentoLoteResultado,
} from './types';
import { CapacidadeNaoSuportadaError } from './types';

const SENHA_PFX = {
  key: 'pfx_senha',
  label: 'Senha do certificado .pfx',
  kind: 'password' as const,
  required: true,
  help: 'Senha do arquivo .pfx (mTLS); armazenada em app_secrets.',
};

function metodosPlaceholder(meta: BankAdapterMeta): BankAdapter {
  const negar = (metodo: string): never => {
    throw new CapacidadeNaoSuportadaError(metodo, meta.key);
  };
  return {
    meta,
    async listarConciliacao(): Promise<ConciliacaoMovimento[]> {
      return negar('conciliacao');
    },
    async gerarCobrancaBoleto(): Promise<CobrancaGerada> {
      return negar('cobranca_boleto');
    },
    async gerarCobrancaPix(): Promise<CobrancaGerada> {
      return negar('cobranca_pix');
    },
    async enviarPagamentoLote(): Promise<PagamentoLoteResultado> {
      return negar('pagamento_lote');
    },
    async status(): Promise<BankStatusResultado> {
      return negar('status');
    },
  };
}

/* ------------------------------------------------------------------ */
/* Banco do Brasil (FEBRABAN 001)                                      */
/* ------------------------------------------------------------------ */

export const BB_META: BankAdapterMeta = {
  key: 'bb',
  nome: 'Banco do Brasil',
  codigoFebraban: '001',
  ambientes: ['sandbox', 'producao'],
  capacidades: [],
  credentialSchema: [
    {
      key: 'client_id',
      label: 'Client ID',
      kind: 'text',
      required: true,
      help: 'Aplicação no portal gw-dev-exp (developers.bb.com.br), bound ao CNPJ.',
    },
    { key: 'client_secret', label: 'Client Secret', kind: 'secret', required: true },
    {
      key: 'api_key',
      label: 'API Key (gw-dev-exp)',
      kind: 'secret',
      required: true,
      help: 'Chave da aplicação no gateway gw-dev-exp.',
    },
    SENHA_PFX,
  ],
  certificados: [
    {
      key: 'pfx',
      label: 'Certificado mTLS Extranet (.pfx)',
      required: true,
      help: 'Certificado emitido via Extranet BB para mTLS.',
    },
  ],
  descricaoCredenciais:
    'Conecta BB: client_id/client_secret (OAuth2), api_key do gateway gw-dev-exp e ' +
    'certificado mTLS do Extranet (.pfx) + senha.',
};

export const bbAdapter: BankAdapter = metodosPlaceholder(BB_META);

/* ------------------------------------------------------------------ */
/* Santander (FEBRABAN 033)                                            */
/* ------------------------------------------------------------------ */

export const SANTANDER_META: BankAdapterMeta = {
  key: 'santander',
  nome: 'Santander',
  codigoFebraban: '033',
  ambientes: ['sandbox', 'producao'],
  capacidades: [],
  credentialSchema: [
    {
      key: 'client_id',
      label: 'Client ID',
      kind: 'text',
      required: true,
      help: 'Aplicação no Santander DevBank (developer.santander.br.com).',
    },
    { key: 'client_secret', label: 'Client Secret', kind: 'secret', required: true },
    SENHA_PFX,
  ],
  certificados: [
    {
      key: 'pfx',
      label: 'Certificado mTLS (.pfx)',
      required: true,
      help: 'Certificado Open Banking/Santander para mTLS.',
    },
  ],
  descricaoCredenciais:
    'Open Banking/Santander DevBank: client_id/client_secret (OAuth2) e certificado ' +
    'mTLS .pfx + senha.',
};

export const santanderAdapter: BankAdapter = metodosPlaceholder(SANTANDER_META);

/* ------------------------------------------------------------------ */
/* Bradesco (FEBRABAN 237)                                             */
/* ------------------------------------------------------------------ */

export const BRADESCO_META: BankAdapterMeta = {
  key: 'bradesco',
  nome: 'Bradesco',
  codigoFebraban: '237',
  ambientes: ['sandbox', 'producao'],
  capacidades: [],
  credentialSchema: [
    {
      key: 'client_id',
      label: 'Client ID',
      kind: 'text',
      required: true,
      help: 'Aplicação no portal de APIs Bradesco (API Pix/Boleto).',
    },
    { key: 'client_secret', label: 'Client Secret', kind: 'secret', required: true },
    {
      key: 'chave_pix',
      label: 'Chave Pix',
      kind: 'text',
      required: true,
      help: 'Chave Pix do recebedor cadastrada no Bradesco.',
    },
    SENHA_PFX,
  ],
  certificados: [
    {
      key: 'pfx',
      label: 'Certificado mTLS (.pfx)',
      required: true,
      help: 'Certificado Bradesco para mTLS.',
    },
  ],
  descricaoCredenciais:
    'API Pix/Boleto Bradesco: client_id/client_secret (OAuth2), chave Pix e ' +
    'certificado .pfx + senha.',
};

export const bradescoAdapter: BankAdapter = metodosPlaceholder(BRADESCO_META);

/* ------------------------------------------------------------------ */
/* Catálogo FEBRABAN — novas integrações via admin (§7.2)              */
/* ------------------------------------------------------------------ */

/** Metas de todos os adapters placeholder, na ordem de exibição (§4). */
export const PLACEHOLDER_METAS: ReadonlyArray<BankAdapterMeta> = [
  BB_META,
  SANTANDER_META,
  BRADESCO_META,
];
