/**
 * Provider NFS-e ABRASF 2.02 (§5.1 do design).
 *
 * Ciclo SOAP: RecepcionarLoteRps (lote com RPS assinado XMLDSig) →
 * ConsultarSituacaoLoteRps → ConsultarNfsePorRps/ConsultarLoteRps →
 * CancelarNfse (2.02 sem assinatura do pedido).
 *
 * URL por município: ctx.config.configExtra.wsdl_url (override por empresa)
 * ou configExtra.ambiente_urls {homologacao, producao} (§5.1).
 * Este arquivo também abriga a fábrica compartilhada do ciclo SOAP usada
 * pela variante 2.04 (nfse/abrasf/abrasf204.ts).
 */
import * as fs from 'node:fs';
import type {
  NfseContext,
  NfseEmissaoResultado,
  NfseConsultaResultado,
  NfseCancelamentoResultado,
  NfseProvider,
  NfseRpsInput,
} from '../types';
import { clienteHttp, apagarPfxTemporario, type HttpClient } from '../../banks/http-mtls';
import { extrairDePfx, assinarXml, assinarVarios } from '../xml-sign';
import {
  ABRASF_NS,
  montarRps,
  montarLoteRps,
  montarConsultarSituacaoLoteRps,
  montarConsultarLoteRps,
  montarConsultarNfsePorRps,
  montarCancelarNfse,
  montarEnvelopeSoap,
  extrairTag,
  extrairMensagensErro,
  situacaoLote,
  extrairNfse,
  resolverCodigoCancelamento,
} from './templates';

export const ABRASF202_META: NfseProvider['meta'] = {
  descricao: 'Webservice municipal padrão ABRASF 2.02 (SOAP, lote RPS assinado XMLDSig).',
  exigeCertificadoA1: true,
  loteMaximo: 1,
};

/* ------------------------------------------------------------------ */
/* Config da variante                                                  */
/* ------------------------------------------------------------------ */

export interface OpcoesAbrasf {
  versao: 202 | 204;
}

/* ------------------------------------------------------------------ */
/* Helpers de contexto                                                 */
/* ------------------------------------------------------------------ */

/** URL do webservice: configExtra.wsdl_url (override empresa) senão ambiente_urls. */
export function resolverUrlWebservice(ctx: NfseContext, chaveUrl = 'wsdl_url'): string {
  const extra = ctx.config.configExtra;
  const direta = extra[chaveUrl];
  if (typeof direta === 'string' && direta.length > 0) return direta;
  const porAmbiente = extra.ambiente_urls;
  if (porAmbiente && typeof porAmbiente === 'object') {
    const mapa = porAmbiente as Record<string, unknown>;
    const url = mapa[ctx.config.ambiente === 'producao' ? 'producao' : 'homologacao'];
    if (typeof url === 'string' && url.length > 0) return url;
  }
  throw new Error(
    `URL do webservice NFS-e ausente: defina '${chaveUrl}' ou 'ambiente_urls' na configuração.`,
  );
}

function resumoCtx(ctx: NfseContext) {
  return {
    cnpj: ctx.config.cnpj,
    razaoSocial: ctx.config.razaoSocial,
    inscricaoMunicipal: ctx.config.inscricaoMunicipal,
    optanteSimples: ctx.config.optanteSimples,
    incentivoFiscal: ctx.config.incentivoFiscal,
    rpsSerie: ctx.config.rpsSerie,
  };
}

function mapearErros(xml: string): { codigo: string; mensagem: string } | undefined {
  const mensagens = extrairMensagensErro(xml);
  const primeira = mensagens.find((m) => m.codigo || m.mensagem);
  if (!primeira) return undefined;
  return { codigo: primeira.codigo || 'sem_codigo', mensagem: primeira.mensagem };
}

/** Carrega o .pfx do caminho local e devolve PEMs (o service baixa do bucket). */
function chavesDoCtx(ctx: NfseContext) {
  if (!ctx.certificado) {
    throw new Error('Certificado A1 (.pfx) não configurado para emissão NFS-e.');
  }
  return extrairDePfx(fs.readFileSync(ctx.certificado.pfxPath), ctx.certificado.pfxPassphrase);
}

/* ------------------------------------------------------------------ */
/* Fábrica compartilhada do ciclo SOAP ABRASF                          */
/* ------------------------------------------------------------------ */

export interface DepsAbrasf {
  http?: HttpClient;
}

/**
 * Ciclo completo parametrizado pela versão. A 2.04 sobrescreve:
 * - assinatura do InfPedidoCancelamento no cancelar;
 * - confirmação de cancelamento lida de <Sucesso> dentro de <Confirmacao>.
 */
export function criarAbrasf(opcoes: OpcoesAbrasf, deps: DepsAbrasf = {}): NfseProvider {
  const { versao } = opcoes;

  const enviarSoap = async (
    ctx: NfseContext,
    operacao: string,
    payload: string,
  ): Promise<string> => {
    const http = clienteHttp({ certificado: ctx.certificado }, deps.http);
    const extra = ctx.config.configExtra;
    const namespace = typeof extra.soap_namespace === 'string' ? extra.soap_namespace : ABRASF_NS;
    const escapar = extra.soap_escapar !== false;
    const url = resolverUrlWebservice(ctx);
    const soapActionPrefix = typeof extra.soap_action_prefix === 'string' ? extra.soap_action_prefix : '';
    const res = await http(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml;charset=utf-8',
        ...(soapActionPrefix ? { SOAPAction: `${soapActionPrefix}${operacao}` } : {}),
      },
      body: montarEnvelopeSoap(operacao, namespace, payload, escapar),
    });
    if (!res.ok) {
      throw new Error(`NFS-e ABRASF: falha HTTP ${res.status} em ${operacao}.`);
    }
    return res.texto;
  };

  return {
    key: versao === 204 ? 'abrasf204' : 'abrasf202',
    meta: { ...ABRASF202_META, descricao: ABRASF202_META.descricao.replace('2.02', versao === 204 ? '2.04' : '2.02') },

    /** Emitir: monta lote → assina RPS(s) → RecepcionarLoteRps → protocolo. */
    async emitirRps(ctx, input: NfseRpsInput): Promise<NfseEmissaoResultado> {
      try {
        const rps = montarRps(versao, resumoCtx(ctx), input);
        let lote = montarLoteRps(versao, {
          loteNumero: input.rpsNumero,
          cnpj: ctx.config.cnpj,
          inscricaoMunicipal: ctx.config.inscricaoMunicipal,
          rpsXmls: [rps],
        });
        if (ctx.certificado) {
          const chaves = chavesDoCtx(ctx);
          try {
            lote = assinarVarios(
              lote,
              chaves,
              [{ xpathAlvo: "//*[@Id='rps" + input.rpsNumero + "']", uri: `#rps${input.rpsNumero}` }],
            );
          } finally {
            apagarPfxTemporario(ctx.certificado.pfxPath);
          }
        } else {
          return { ok: false, erro: { codigo: 'certificado_ausente', mensagem: 'Certificado A1 não configurado.' } };
        }
        const resposta = await enviarSoap(ctx, 'RecepcionarLoteRps', lote);
        const protocolo = extrairTag(resposta, 'Protocolo');
        const erro = mapearErros(resposta);
        if (!protocolo) {
          return {
            ok: false,
            erro: erro ?? { codigo: 'sem_protocolo', mensagem: 'Webservice não devolveu protocolo.' },
            raw: resposta,
          };
        }
        return { ok: true, protocolo, raw: resposta };
      } catch (e) {
        return { ok: false, erro: { codigo: 'falha_envio', mensagem: e instanceof Error ? e.message : String(e) } };
      }
    },

    /** Consultar: protocolo → SituacaoLote → (sucesso) Nfse por RPS/lote. */
    async consultar(ctx, ref): Promise<NfseConsultaResultado> {
      try {
        const temProtocolo = Boolean(ref.protocolo);
        if (temProtocolo) {
          const xmlSituacao = montarConsultarSituacaoLoteRps({
            cnpj: ctx.config.cnpj,
            inscricaoMunicipal: ctx.config.inscricaoMunicipal,
            protocolo: ref.protocolo as string,
          });
          const respostaSituacao = await enviarSoap(ctx, 'ConsultarSituacaoLoteRps', xmlSituacao);
          const situacaoLoteRes = situacaoLote(respostaSituacao);
          if (situacaoLoteRes === 'processando') {
            return { ok: true, situacao: 'nao_encontrado', raw: respostaSituacao };
          }
          if (situacaoLoteRes === 'erro') {
            return {
              ok: true,
              situacao: 'rejeitado',
              erro: mapearErros(respostaSituacao),
              raw: respostaSituacao,
            };
          }
        }
        // Finalizado com sucesso → busca a NFS-e da RPS (ou do lote).
        if (ref.rpsNumero) {
          const xmlPorRps = montarConsultarNfsePorRps({
            cnpj: ctx.config.cnpj,
            inscricaoMunicipal: ctx.config.inscricaoMunicipal,
            numero: ref.rpsNumero,
            serie: ref.rpsSerie ?? ctx.config.rpsSerie,
          });
          const resposta = await enviarSoap(ctx, 'ConsultarNfsePorRps', xmlPorRps);
          const nfse = extrairNfse(resposta);
          const erro = mapearErros(resposta);
          if (!nfse.numeroNfse) {
            return { ok: true, situacao: 'nao_encontrado', erro, raw: resposta };
          }
          return {
            ok: true,
            situacao: extrairTag(resposta, 'Cancelamento') !== undefined ? 'cancelado' : 'autorizado',
            ...nfse,
            raw: resposta,
          };
        }
        if (ref.protocolo) {
          const xmlLote = montarConsultarLoteRps({
            cnpj: ctx.config.cnpj,
            inscricaoMunicipal: ctx.config.inscricaoMunicipal,
            protocolo: ref.protocolo,
          });
          const resposta = await enviarSoap(ctx, 'ConsultarLoteRps', xmlLote);
          const nfse = extrairNfse(resposta);
          if (!nfse.numeroNfse) {
            return { ok: true, situacao: 'rejeitado', erro: mapearErros(resposta), raw: resposta };
          }
          return { ok: true, situacao: 'autorizado', ...nfse, raw: resposta };
        }
        return { ok: false, erro: { codigo: 'referencia_ausente', mensagem: 'Informe protocolo ou RPS para consultar.' } };
      } catch (e) {
        return { ok: false, erro: { codigo: 'falha_consulta', mensagem: e instanceof Error ? e.message : String(e) } };
      }
    },

    /** Cancelar: 2.02 sem assinatura; 2.04 assina o InfPedidoCancelamento. */
    async cancelar(ctx, ref): Promise<NfseCancelamentoResultado> {
      try {
        const { xml, idAssinavel } = montarCancelarNfse(versao, {
          cnpj: ctx.config.cnpj,
          inscricaoMunicipal: ctx.config.inscricaoMunicipal,
          numeroNfse: ref.numeroNfse,
          codigoCancelamento: resolverCodigoCancelamento(ref.codigoCancelamento),
          motivo: ref.motivo,
        });
        let pedido = xml;
        if (idAssinavel) {
          // 2.04 exige assinatura do InfPedidoCancelamento — sem cert é erro.
          if (!ctx.certificado) {
            return { ok: false, erro: { codigo: 'certificado_ausente', mensagem: 'Certificado A1 não configurado para cancelamento 2.04.' } };
          }
          const chaves = chavesDoCtx(ctx);
          try {
            pedido = assinarXml(pedido, chaves, {
              xpathAlvo: `//*[@Id='${idAssinavel}']`,
              uri: `#${idAssinavel}`,
            });
          } finally {
            apagarPfxTemporario(ctx.certificado.pfxPath);
          }
        }
        const resposta = await enviarSoap(ctx, 'CancelarNfse', pedido);
        const sucesso = extrairTag(resposta, 'Sucesso') === '1';
        const erro = mapearErros(resposta);
        if (!sucesso) {
          return { ok: false, erro: erro ?? { codigo: 'cancelamento_recusado', mensagem: 'Webservice não confirmou o cancelamento.' }, raw: resposta };
        }
        return { ok: true, xmlCancelamento: pedido, raw: resposta };
      } catch (e) {
        return { ok: false, erro: { codigo: 'falha_cancelamento', mensagem: e instanceof Error ? e.message : String(e) } };
      }
    },
  };
}

/** Instância padrão 2.02 usada pelo registry. */
export const abrasf202: NfseProvider = criarAbrasf({ versao: 202 });

/** Fábrica 2.02 (testes com HTTP mock). */
export function criarAbrasf202(deps: DepsAbrasf = {}): NfseProvider {
  return criarAbrasf({ versao: 202 }, deps);
}
