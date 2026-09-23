/**
 * Provider NFS-e — Padrão Nacional / ADN (§5.1 do design).
 *
 * REST/JSON sobre HTTPS com mTLS A1 (cert do bucket). Base URLs conforme o
 * design; nomes exatos de operações/leiaute DPS conforme a spec oficial do
 * Padrão Nacional (https://www.gov.br/nfse) — manter em CONSTANTES no topo
 * e ajustar em um único lugar na homologação de integração.
 */
import type {
  NfseContext,
  NfseEmissaoResultado,
  NfseConsultaResultado,
  NfseCancelamentoResultado,
  NfseProvider,
  NfseRpsInput,
} from './types';
import { clienteHttp, sanitizarRaw, type HttpClient } from '../banks/http-mtls';
import { resolverCodigoCancelamento } from './abrasf/templates';

/* Constantes ADN — spec oficial (design §5.1): */
const BASE_PRODUCAO = 'https://adn.nfse.gov.br';
const BASE_HOMOLOGACAO = 'https://adn.tst.nfse.gov.br';
/* Operações (confirmar nomes finais na spec oficial antes de produção): */
const EP_EMITIR = '/api/dps';                    // POST — envio do DPS (emissão)
const EP_CONSULTAR_RECIBO = '/api/nfse/recibos';  // GET ?recibo= — consulta por recibo
const EP_CONSULTAR_DPS = '/api/nfse';             // GET ?nDps=&serie=&cnpjPrestador=
const EP_CANCELAR = '/api/nfse/cancelamento';     // POST — pedido de cancelamento

export const NACIONAL_META: NfseProvider['meta'] = {
  descricao: 'Padrão Nacional NFS-e (ADN): REST/JSON com mTLS A1 (DPS → recibo → NFS-e).',
  exigeCertificadoA1: true,
  loteMaximo: 1, // um DPS por requisição nesta implementação
};

export interface DepsNacional {
  http?: HttpClient;
}

/* ------------------------------------------------------------------ */
/* Montagem do DPS (leiaute JSON nacional)                             */
/* ------------------------------------------------------------------ */

/** Converte NfseRpsInput no corpo JSON do DPS (leiaute DPS nacional). */
export function montarDps(ctx: NfseContext, input: NfseRpsInput): Record<string, unknown> {
  const valorIss = (input.valorServicos * input.aliquotaIss) / 100;
  const primeiroItem = input.itens[0];
  return {
    dps: {
      tpAmb: ctx.config.ambiente === 'producao' ? '1' : '2',
      verAplic: 'painel-abz',
      serie: input.rpsSerie,
      nDps: input.rpsNumero,
      dCompet: input.competencia,
      dhEmi: `${input.dataEmissao}T00:00:00-03:00`,
      prest: {
        CNPJ: ctx.config.cnpj,
        IM: ctx.config.inscricaoMunicipal,
      },
      toma: {
        [input.tomador.documento.length === 11 ? 'CPF' : 'CNPJ']: input.tomador.documento,
        xNome: input.tomador.nome,
        IM: input.tomador.inscricaoMunicipal,
        email: input.tomador.email,
        end: input.tomador.endereco
          ? {
              xLgr: input.tomador.endereco.logradouro,
              nro: input.tomador.endereco.numero,
              xCpl: input.tomador.endereco.complemento,
              xBairro: input.tomador.endereco.bairro,
              cMun: input.tomador.municipioIbge,
              CEP: input.tomador.endereco.cep.replace(/\D/g, ''),
            }
          : undefined,
      },
      serv: {
        locPrest: { cMunPrestacao: ctx.config.municipioIbge },
        cServ: {
          cTribNac: primeiroItem?.codigoLc116,
          xDescServ: input.discriminacao.slice(0, 2000),
        },
        iss: {
          tribISS: input.issRetido ? '1' : '4', // 1 retido; 4 não retido (código ISSQN)
        },
      },
      valores: {
        vServP: input.valorServicos,
        vDedRed: input.deducoes ?? 0,
        vDescIncond: input.descontosIncondicionais ?? 0,
        pAliq: input.aliquotaIss,
        vISS: valorIss,
        vISSRet: input.issRetido ? valorIss : 0,
      },
    },
  };
}

/* ------------------------------------------------------------------ */
/* Provider                                                            */
/* ------------------------------------------------------------------ */

export function criarNacionalProvider(deps: DepsNacional = {}): NfseProvider {
  const chamar = async (
    ctx: NfseContext,
    metodo: 'GET' | 'POST',
    caminho: string,
    corpo?: Record<string, unknown>,
    query?: Record<string, string>,
  ): Promise<{ status: number; ok: boolean; json: Record<string, unknown> }> => {
    if (!ctx.certificado) {
      throw new Error('Certificado A1 (.pfx) não configurado para o Padrão Nacional.');
    }
    const http = clienteHttp({ certificado: ctx.certificado }, deps.http);
    const base = ctx.config.ambiente === 'producao' ? BASE_PRODUCAO : BASE_HOMOLOGACAO;
    const override = ctx.config.configExtra.base_url;
    const url = new URL(
      caminho,
      typeof override === 'string' && override ? override : base,
    );
    for (const [k, v] of Object.entries(query ?? {})) url.searchParams.set(k, v);
    const res = await http(url.toString(), {
      method: metodo,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(ctx.credenciais.token
          ? { Authorization: `Bearer ${ctx.credenciais.token}` }
          : {}),
      },
      ...(corpo ? { body: JSON.stringify(corpo) } : {}),
    });
    let json: Record<string, unknown> = {};
    try {
      json = JSON.parse(res.texto) as Record<string, unknown>;
    } catch {
      json = { _texto: res.texto.slice(0, 2000) };
    }
    return { status: res.status, ok: res.ok, json };
  };

  const primeiro = (json: Record<string, unknown>, chaves: string[]): unknown => {
    for (const c of chaves) {
      const v = json[c];
      if (v !== undefined && v !== null && v !== '') return v;
    }
    return undefined;
  };

  return {
    key: 'nacional',
    meta: NACIONAL_META,

    async emitirRps(ctx, input): Promise<NfseEmissaoResultado> {
      try {
        const { status, json } = await chamar(ctx, 'POST', EP_EMITIR, montarDps(ctx, input));
        const erroTexto = primeiro(json, ['mensagem', 'erro', 'detail']) as string | undefined;
        if (status >= 400 || (erroTexto && !json.recibo && !json.numero)) {
          return {
            ok: false,
            erro: {
              codigo: String(primeiro(json, ['codigo', 'code']) ?? status),
              mensagem: erroTexto ?? 'Emissão DPS recusada pelo ADN.',
            },
            raw: sanitizarRaw(json),
          };
        }
        const recibo = primeiro(json, ['recibo', 'nRec', 'numeroRecibo']);
        const numero = primeiro(json, ['numero', 'numeroNfse', 'nNfse']);
        return {
          ok: true,
          ...(recibo !== undefined ? { protocolo: String(recibo) } : {}),
          ...(numero !== undefined ? { numeroNfse: String(numero) } : {}),
          ...(primeiro(json, ['codigoVerificacao', 'cVerif']) !== undefined
            ? { codigoVerificacao: String(primeiro(json, ['codigoVerificacao', 'cVerif'])) }
            : {}),
          raw: sanitizarRaw(json),
        };
      } catch (e) {
        return { ok: false, erro: { codigo: 'falha_envio', mensagem: e instanceof Error ? e.message : String(e) } };
      }
    },

    async consultar(ctx, ref): Promise<NfseConsultaResultado> {
      try {
        const caminho = ref.protocolo ? EP_CONSULTAR_RECIBO : EP_CONSULTAR_DPS;
        const query: Record<string, string> = ref.protocolo
          ? { recibo: ref.protocolo }
          : {
              nDps: String(ref.rpsNumero ?? ''),
              serie: ref.rpsSerie ?? ctx.config.rpsSerie,
              cnpjPrestador: ctx.config.cnpj,
            };
        const { status, json } = await chamar(ctx, 'GET', caminho, undefined, query);
        if (status === 404) return { ok: true, situacao: 'nao_encontrado', raw: sanitizarRaw(json) };
        const situacaoBruta = String(primeiro(json, ['situacao', 'status', 'cSitNfse']) ?? '').toLowerCase();
        const erroTexto = primeiro(json, ['mensagem', 'erro', 'detail']) as string | undefined;
        const numero = primeiro(json, ['numero', 'numeroNfse', 'nNfse']);
        if (status >= 400 || erroTexto) {
          return {
            ok: true,
            situacao: 'rejeitado',
            ...(erroTexto
              ? { erro: { codigo: String(primeiro(json, ['codigo', 'code']) ?? status), mensagem: erroTexto } }
              : {}),
            raw: sanitizarRaw(json),
          };
        }
        return {
          ok: true,
          situacao: situacaoBruta.includes('cancel')
            ? 'cancelado'
            : numero
              ? 'autorizado'
              : 'nao_encontrado',
          ...(numero !== undefined ? { numeroNfse: String(numero) } : {}),
          ...(primeiro(json, ['codigoVerificacao', 'cVerif']) !== undefined
            ? { codigoVerificacao: String(primeiro(json, ['codigoVerificacao', 'cVerif'])) }
            : {}),
          raw: sanitizarRaw(json),
        };
      } catch (e) {
        return { ok: false, erro: { codigo: 'falha_consulta', mensagem: e instanceof Error ? e.message : String(e) } };
      }
    },

    async cancelar(ctx, ref): Promise<NfseCancelamentoResultado> {
      try {
        const { status, json } = await chamar(ctx, 'POST', EP_CANCELAR, {
          cancelamento: {
            numeroNfse: ref.numeroNfse,
            codigoCancelamento: resolverCodigoCancelamento(ref.codigoCancelamento),
            motivo: ref.motivo,
            cnpjPrestador: ctx.config.cnpj,
          },
        });
        const erroTexto = primeiro(json, ['mensagem', 'erro', 'detail']) as string | undefined;
        if (status >= 400 || erroTexto) {
          return {
            ok: false,
            erro: {
              codigo: String(primeiro(json, ['codigo', 'code']) ?? status),
              mensagem: erroTexto ?? 'Cancelamento recusado pelo ADN.',
            },
            raw: sanitizarRaw(json),
          };
        }
        return { ok: true, raw: sanitizarRaw(json) };
      } catch (e) {
        return { ok: false, erro: { codigo: 'falha_cancelamento', mensagem: e instanceof Error ? e.message : String(e) } };
      }
    },
  };
}

/** Instância padrão usada pelo registry. */
export const nacionalProvider: NfseProvider = criarNacionalProvider();
