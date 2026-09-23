/**
 * Adapter Itaú Unibanco (FEBRABAN 341) — §4 do design financeiro.
 *
 * Autenticação: OAuth2 client_credentials (Basic) + header x-itau-apikey +
 * mTLS obrigatório com .pfx emitido pela AC Itaú (bound ao CNPJ), senha em
 * app_secrets (fin_banco_<integracaoId>_pfx_senha).
 *
 * Endpoints de referência — CONFIRMAR VERSÃO no DevPortal Itaú
 * (https://devportal.itau.com.br). Sandbox por padrão (host trocado pelo
 * ambiente do ctx). Nomes finais de campos dos corpos podem variar por
 * versão da API: o mapeamento está centralizado nas funções puras
 * (corpoBoleto/corpoPix/corpoLotePagamento/mapearMovimento) para ajuste único.
 */
import type {
  BankAdapter,
  BankAdapterMeta,
  BankContext,
  CobrancaBoletoInput,
  CobrancaPixInput,
  ConciliacaoMovimento,
  PagamentoLoteItem,
  BankStatusResultado,
} from './types';
import { clienteHttp, obterTokenOAuth2, sanitizarRaw, type HttpClient } from './http-mtls';

/* Hosts (sandbox por padrão; produção via ctx.ambiente) */
const ITAU_HOST_SANDBOX = 'https://sandbox.devportal.itau.com.br';
const ITAU_HOST_PRODUCAO = 'https://api.itau.com.br';
/* Operações — referências do DevPortal (ajustar versão na ativação): */
const EP_TOKEN = '/api/oauth/token';
const EP_BOLETOS = '/itau-ep9-gat-cnab/v1/boletos';             // Cobrança boleto (ep9 CNAB)
const EP_PIX_RECEIPTS = '/cash-management/v1/receipts';         // Pix recebimentos
const EP_PAGAMENTOS_LOTE = '/pagamentos/v1/lotes';              // Pagamentos em lote (CNAB)
const EP_EXTRATO = '/banking/v1/extratos';                      // Conciliação (extrato)
const EP_SALDO = '/banking/v1/saldos';                          // Teste de conexão

export const ITAU_META: BankAdapterMeta = {
  key: 'itau',
  nome: 'Itaú Unibanco',
  codigoFebraban: '341',
  ambientes: ['sandbox', 'producao'],
  capacidades: ['cobranca_boleto', 'cobranca_pix', 'pagamento_lote', 'conciliacao'],
  credentialSchema: [
    {
      key: 'client_id',
      label: 'Client ID',
      kind: 'text',
      required: true,
      help: 'Aplicação no DevPortal Itaú, bound ao CNPJ do beneficiário.',
    },
    { key: 'client_secret', label: 'Client Secret', kind: 'secret', required: true },
    {
      key: 'api_key',
      label: 'x-itau-apikey',
      kind: 'secret',
      required: true,
      help: 'API key da aplicação (header x-itau-apikey de todas as chamadas).',
    },
    {
      key: 'pfx_senha',
      label: 'Senha do certificado .pfx',
      kind: 'password',
      required: true,
      help: 'Senha do arquivo .pfx emitido pela AC Itaú (mTLS obrigatório).',
    },
  ],
  certificados: [
    {
      key: 'pfx',
      label: 'Certificado mTLS (.pfx)',
      required: true,
      help: 'Emitido pela AC Itaú, bound ao CNPJ; armazenado no bucket financeiro-certificados.',
    },
  ],
  descricaoCredenciais:
    'OAuth2 client_credentials (client_id/client_secret), header x-itau-apikey e ' +
    'mTLS obrigatório com certificado .pfx da AC Itaú bound ao CNPJ + senha do pfx.',
};

function host(ambiente: BankContext['ambiente']): string {
  return ambiente === 'producao' ? ITAU_HOST_PRODUCAO : ITAU_HOST_SANDBOX;
}

/* ------------------------------------------------------------------ */
/* Mapeamentos puros (testáveis)                                       */
/* ------------------------------------------------------------------ */

const TP_AMB: Record<BankContext['ambiente'], string> = { sandbox: 'T', producao: 'P' };

/** Corpo de criação de boleto (shape ep9-gat-cnab; nomes finais por versão do DevPortal). */
export function corpoBoleto(ctx: BankContext, input: CobrancaBoletoInput): Record<string, unknown> {
  return {
    tpamb: TP_AMB[ctx.ambiente],
    beneficiario: {
      agencia: ctx.conta.agencia,
      conta: ctx.conta.conta,
      digito: ctx.conta.digito,
      cnpj: ctx.conta.titularDocumento,
      nome: ctx.conta.titularNome,
    },
    boleto: {
      valorNominal: input.valor.toFixed(2),
      dataVencimento: input.vencimento,
      descricao: input.descricao,
      ...(input.nossoNumero ? { nossoNumero: input.nossoNumero } : {}),
      ...(input.faturaId ? { seuNumero: input.faturaId } : {}),
    },
    pagador: {
      nome: input.pagador.nome,
      documento: input.pagador.documento,
      ...(input.pagador.email ? { email: input.pagador.email } : {}),
    },
  };
}

/** Corpo de cobrança Pix (cash-management receipts). */
export function corpoPix(ctx: BankContext, input: CobrancaPixInput): Record<string, unknown> {
  return {
    tpamb: TP_AMB[ctx.ambiente],
    chave: ctx.conta.titularDocumento,
    valor: { original: input.valor.toFixed(2) },
    ...(input.txid ? { txid: input.txid } : {}),
    ...(input.expiracaoSegundos ? { calendario: { expiracao: input.expiracaoSegundos } } : {}),
    ...(input.descricao ? { solicitacaoPagador: input.descricao.slice(0, 140) } : {}),
  };
}

/** Corpo do lote de pagamentos (CNAB; favores por item). */
export function corpoLotePagamento(
  ctx: BankContext,
  itens: PagamentoLoteItem[],
): Record<string, unknown> {
  return {
    tpamb: TP_AMB[ctx.ambiente],
    debitada: {
      agencia: ctx.conta.agencia,
      conta: ctx.conta.conta,
      digito: ctx.conta.digito,
    },
    pagamentos: itens.map((it) => ({
      idLocal: it.idLocal,
      favorecido: {
        nome: it.favorecido.nome,
        documento: it.favorecido.documento,
        tipoConta: it.favorecido.tipoConta,
        banco: it.favorecido.banco,
        agencia: it.favorecido.agencia,
        conta: it.favorecido.conta,
        digito: it.favorecido.digitoConta,
      },
      valor: it.valor.toFixed(2),
      dataPrevista: it.dataPrevista,
      descricao: it.descricao,
    })),
  };
}

/** Primeiro campo presente entre apelidos conhecidos (respostas variam por versão). */
function primeiroCampo(json: Record<string, unknown>, apelidos: string[]): unknown {
  for (const a of apelidos) {
    const v = json[a];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return undefined;
}

/** Lançamento do extrato → ConciliacaoMovimento (tolerante a apelidos de campo). */
export function mapearMovimento(l: Record<string, unknown>): ConciliacaoMovimento {
  const dataBruta = String(primeiroCampo(l, ['dataMovimento', 'data', 'dataLancamento']) ?? '');
  const valorBruto = primeiroCampo(l, ['valorLancamento', 'valor', 'valorMovimento']) ?? 0;
  const valor = typeof valorBruto === 'number' ? valorBruto : Number(String(valorBruto).replace(',', '.'));
  const tipoBruto = String(primeiroCampo(l, ['tipoLancamento', 'tipo', 'dc']) ?? '').toLowerCase();
  const tipo: 'credito' | 'debito' =
    tipoBruto.startsWith('c') || (!tipoBruto && valor >= 0) ? 'credito' : 'debito';
  const descricao = String(primeiroCampo(l, ['descricao', 'historico', 'descricaoLancamento']) ?? '');
  const txid = primeiroCampo(l, ['txid', 'identificadorPix']);
  const nosso = primeiroCampo(l, ['nossoNumero', 'seuNumero']);
  return {
    idExterno: String(primeiroCampo(l, ['idTransacao', 'id', 'nsu', 'autenticacao']) ?? ''),
    data: dataBruta.slice(0, 10),
    tipo,
    valor: Math.abs(valor),
    descricao,
    ...(nosso !== undefined ? { nossoNumero: String(nosso) } : {}),
    ...(txid !== undefined ? { txid: String(txid) } : {}),
    raw: sanitizarRaw(l),
  };
}

/* ------------------------------------------------------------------ */
/* Adapter                                                             */
/* ------------------------------------------------------------------ */

export interface DepsItau {
  /** HTTP injetado para testes (mock); ausente → cliente mTLS compartilhado. */
  http?: HttpClient;
}

export function criarItauAdapter(deps: DepsItau = {}): BankAdapter {
  const chamar = async (
    ctx: BankContext,
    caminho: string,
    metodo: string,
    corpo?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> => {
    const http = clienteHttp(ctx, deps.http);
    const token = await obterTokenOAuth2(
      ctx,
      {
        tokenUrl: `${host(ctx.ambiente)}${EP_TOKEN}`,
        escopo: undefined, // escopo conforme produto no DevPortal
        cabecalhosExtras: { 'x-itau-apikey': ctx.credenciais.api_key ?? '' },
      },
      http,
    );
    const res = await http(`${host(ctx.ambiente)}${caminho}`, {
      method: metodo,
      headers: {
        Authorization: `Bearer ${token}`,
        'x-itau-apikey': ctx.credenciais.api_key ?? '',
        'Content-Type': 'application/json',
      },
      ...(corpo !== undefined ? { body: JSON.stringify(corpo) } : {}),
    });
    if (!res.ok) {
      throw new Error(`Itaú: falha em ${caminho} (HTTP ${res.status}).`);
    }
    try {
      return JSON.parse(res.texto) as Record<string, unknown>;
    } catch {
      throw new Error(`Itaú: resposta não-JSON em ${caminho}.`);
    }
  };

  return {
    meta: ITAU_META,

    async listarConciliacao(ctx, input) {
      const qs = new URLSearchParams({
        dataInicio: input.de,
        dataFim: input.ate,
        agencia: ctx.conta.agencia,
        conta: ctx.conta.conta,
      });
      const json = await chamar(ctx, `${EP_EXTRATO}?${qs.toString()}`, 'GET');
      const lancamentos = (json.movimentos ?? json.lancamentos ?? json.extrato) as
        | Record<string, unknown>[]
        | undefined;
      if (!Array.isArray(lancamentos)) return [];
      return lancamentos.map(mapearMovimento);
    },

    async gerarCobrancaBoleto(ctx, input) {
      const json = await chamar(ctx, EP_BOLETOS, 'POST', corpoBoleto(ctx, input));
      const idExterno = primeiroCampo(json, ['idBoleto', 'id', 'numeroBoleto', 'nossoNumero']);
      if (!idExterno) throw new Error('Itaú: resposta de boleto sem identificador.');
      const linha = primeiroCampo(json, ['codigoLinhaDigitavel', 'linhaDigitavel', 'linha_digitavel']);
      const pdf = primeiroCampo(json, ['urlPdf', 'pdfUrl']);
      return {
        idExterno: String(idExterno),
        ...(linha !== undefined ? { linhaDigitavel: String(linha) } : {}),
        ...(pdf !== undefined ? { pdfUrl: String(pdf) } : {}),
        raw: sanitizarRaw(json),
      };
    },

    async gerarCobrancaPix(ctx, input) {
      const json = await chamar(ctx, EP_PIX_RECEIPTS, 'POST', corpoPix(ctx, input));
      const idExterno = primeiroCampo(json, ['txid', 'id', 'reciboId']);
      if (!idExterno) throw new Error('Itaú: resposta de Pix sem txid.');
      const emv = primeiroCampo(json, ['pixCopiaECola', 'qrCodeEmv', 'pix_copia_e_cola']);
      return {
        idExterno: String(idExterno),
        ...(input.txid ? { txid: input.txid } : {}),
        ...(emv !== undefined ? { qrCodeEmv: String(emv) } : {}),
        raw: sanitizarRaw(json),
      };
    },

    async enviarPagamentoLote(ctx, itens) {
      const json = await chamar(ctx, EP_PAGAMENTOS_LOTE, 'POST', corpoLotePagamento(ctx, itens));
      const brutos = (json.pagamentos ?? json.itens) as Record<string, unknown>[] | undefined;
      const devolvidos = new Map<string, Record<string, unknown>>();
      for (const p of Array.isArray(brutos) ? brutos : []) {
        const idLocal = String(primeiroCampo(p, ['idLocal', 'seuNumero', 'id']) ?? '');
        if (idLocal) devolvidos.set(idLocal, p);
      }
      return {
        loteIdExterno: primeiroCampo(json, ['idLote', 'loteId', 'id'])
          ? String(primeiroCampo(json, ['idLote', 'loteId', 'id']))
          : undefined,
        itens: itens.map((it) => {
          const p = devolvidos.get(it.idLocal);
          const aceito = p ? Boolean(primeiroCampo(p, ['aceito', 'ok', 'processado']) ?? true) : false;
          return {
            idLocal: it.idLocal,
            aceito,
            ...(p && primeiroCampo(p, ['idExternoBanco', 'idTransacao'])
              ? { idExternoBanco: String(primeiroCampo(p, ['idExternoBanco', 'idTransacao'])) }
              : {}),
            ...(p && primeiroCampo(p, ['erro', 'motivoErro', 'mensagemErro'])
              ? { erro: String(primeiroCampo(p, ['erro', 'motivoErro', 'mensagemErro'])) }
              : {}),
          };
        }),
        raw: sanitizarRaw(json),
      };
    },

    async status(ctx): Promise<BankStatusResultado> {
      try {
        const qs = new URLSearchParams({
          data: new Date().toISOString().slice(0, 10),
          agencia: ctx.conta.agencia,
          conta: ctx.conta.conta,
        });
        const json = await chamar(ctx, `${EP_SALDO}?${qs.toString()}`, 'GET');
        const disponivel = primeiroCampo(json, ['disponivel', 'saldoDisponivel', 'valor']);
        const dataSaldo = String(primeiroCampo(json, ['data', 'dataSaldo']) ?? new Date().toISOString().slice(0, 10));
        return {
          ok: true,
          detalhe: 'Conexão Itaú OK (token OAuth2 + mTLS).',
          ...(disponivel !== undefined
            ? { saldo: { data: dataSaldo.slice(0, 10), disponivel: Number(disponivel) } }
            : {}),
        };
      } catch (e) {
        return { ok: false, detalhe: e instanceof Error ? e.message : String(e) };
      }
    },
  };
}

/** Instância padrão usada pelo registry. */
export const itauAdapter: BankAdapter = criarItauAdapter();
