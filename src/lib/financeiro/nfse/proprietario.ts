/**
 * Provider NFS-e 'proprietário' (§5.1 do design) — genérico config-driven para
 * webservices próprios de prefeituras (fora do padrão ABRASF/Nacional).
 *
 * Config (tudo por ctx.config.configExtra; segredos em app_secrets via ctx.credenciais):
 * - wsdl_url / ambiente_urls {homologacao, producao}: URLs do webservice;
 * - authTipo: 'none' | 'basic' | 'token' (credenciais: usuario/senha | token);
 * - soap_namespace / soap_operacoes {emitir,consultar,cancelar}: envelope SOAP;
 * - templates {emitir, consultar, cancelar}: corpos XML com placeholders {{chave}}.
 *
 * Municípios sem template próprio caem no genérico; Macaé (3302403) usa a
 * configuração default concreta de municipios/macae.ts (§5.1).
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
import { MACAE_CODIGO_IBGE, MACAE_CONFIG, type ConfiguracaoMunicipioProprietario } from './municipios/macae';
import { montarRps, resolverCodigoCancelamento } from './abrasf/templates';
import { formatarItemLc116 } from './padrao-abz';

export const PROPRIETARIO_META: NfseProvider['meta'] = {
  descricao:
    'Webservice próprio da prefeitura (config-driven): auth none/basic/token, ' +
    'templates XML configuráveis; Macaé (3302403) pré-configurada.',
  exigeCertificadoA1: false, // depende do município
  loteMaximo: 1,
};

export interface DepsProprietario {
  http?: HttpClient;
}

/* ------------------------------------------------------------------ */
/* Config e placeholders                                               */
/* ------------------------------------------------------------------ */

/** Resolve a configuração concreta do município (Macaé default; resto genérico). */
export function resolverConfigMunicipio(ctx: NfseContext): ConfiguracaoMunicipioProprietario {
  const extra = ctx.config.configExtra;
  const base = ctx.config.municipioIbge === MACAE_CONFIG.municipioIbge ? MACAE_CONFIG : undefined;
  const authTipo = (extra.authTipo as ConfiguracaoMunicipioProprietario['authTipo']) ?? base?.authTipo ?? 'none';
  const templates = (extra.templates as ConfiguracaoMunicipioProprietario['templates']) ?? base?.templates;
  const urlsProprias = (extra.ambiente_urls as ConfiguracaoMunicipioProprietario['urls']) ?? base?.urls;
  if (!templates) {
    throw new Error(
      `Provider proprietário sem templates para o município ${ctx.config.municipioIbge}: defina configExtra.templates.`,
    );
  }
  return {
    municipioIbge: ctx.config.municipioIbge,
    nomeMunicipio: base?.nomeMunicipio ?? ctx.config.municipioIbge,
    urls: urlsProprias ?? { homologacao: '', producao: '' },
    authTipo,
    authHeaderToken: (extra.auth_header_token as string) ?? base?.authHeaderToken ?? 'Authorization',
    authPrefixoToken: (extra.auth_prefixo_token as string) ?? base?.authPrefixoToken ?? '',
    contentType: (extra.content_type as ConfiguracaoMunicipioProprietario['contentType']) ?? base?.contentType ?? 'application/xml',
    escaparXml: extra.escapar_xml === true,
    operacoes: (extra.soap_operacoes as ConfiguracaoMunicipioProprietario['operacoes']) ?? base?.operacoes ?? { emitir: '', consultar: '', cancelar: '' },
    templates,
  };
}

/** Cabeçalhos de autenticação conforme authTipo do município. */
export function cabecalhosAutenticacao(cfg: ConfiguracaoMunicipioProprietario, credenciais: Record<string, string>): Record<string, string> {
  if (cfg.authTipo === 'basic') {
    const usuario = credenciais.usuario ?? '';
    const senha = credenciais.senha ?? '';
    if (!usuario || !senha) throw new Error('Autenticação basic: credenciais usuario/senha ausentes.');
    const b64 = Buffer.from(`${usuario}:${senha}`).toString('base64');
    return { Authorization: `Basic ${b64}` };
  }
  if (cfg.authTipo === 'token') {
    const token = credenciais.token ?? '';
    if (!token) throw new Error('Autenticação token: credencial token ausente.');
    return { [cfg.authHeaderToken]: `${cfg.authPrefixoToken}${token}` };
  }
  return {};
}

function urlOperacao(ctx: NfseContext, cfg: ConfiguracaoMunicipioProprietario, operacao: keyof ConfiguracaoMunicipioProprietario['operacoes']): string {
  const extra = ctx.config.configExtra;
  const direta = extra.wsdl_url;
  if (typeof direta === 'string' && direta.length > 0) return direta;
  const ambiente = ctx.config.ambiente === 'producao' ? 'producao' : 'homologacao';
  const base = cfg.urls[ambiente];
  if (!base) throw new Error(`URL do webservice do município ausente para ambiente '${ambiente}'.`);
  const caminho = cfg.operacoes[operacao];
  return caminho ? `${base.replace(/\/$/, '')}/${caminho}` : base;
}

/** Renderiza placeholders {{chave}} (valores ausentes viram string vazia). */
export function renderTemplate(template: string, vars: Record<string, string | number | undefined>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, chave: string) => {
    const v = vars[chave];
    return v === undefined || v === null ? '' : String(v);
  });
}

/* ------------------------------------------------------------------ */
/* Variáveis e interpretação de resposta                               */
/* ------------------------------------------------------------------ */

function varsComuns(ctx: NfseContext, input: NfseRpsInput): Record<string, string | number | undefined> {
  const primeiroItem = input.itens[0];
  const valorIss = (input.valorServicos * input.aliquotaIss) / 100;
  const rpsXml = montarRps(204, {
    cnpj: ctx.config.cnpj,
    razaoSocial: ctx.config.razaoSocial,
    inscricaoMunicipal: ctx.config.inscricaoMunicipal,
    optanteSimples: ctx.config.optanteSimples,
    incentivoFiscal: ctx.config.incentivoFiscal,
    rpsSerie: ctx.config.rpsSerie,
    municipioIbge: ctx.config.municipioIbge,
    padraoAbz: ctx.config.municipioIbge === MACAE_CODIGO_IBGE,
  }, input);
  return {
    rps_xml: rpsXml,
    rps_numero: input.rpsNumero,
    rps_serie: input.rpsSerie,
    data_emissao: input.dataEmissao,
    competencia: input.competencia,
    prestador_cnpj: ctx.config.cnpj,
    prestador_im: ctx.config.inscricaoMunicipal,
    tomador_documento: input.tomador.documento,
    tomador_doc_tag: input.tomador.documento.length === 11 ? 'Cpf' : 'Cnpj',
    tomador_nome: input.tomador.nome,
    tomador_email: input.tomador.email,
    municipio_prestacao: ctx.config.municipioIbge,
    valor_servicos: input.valorServicos.toFixed(2),
    aliquota: input.aliquotaIss.toFixed(2),
    valor_iss: valorIss.toFixed(2),
    iss_retido: input.issRetido ? '1' : '2',
    optante_simples: ctx.config.optanteSimples ? '1' : '2',
    incentivo_fiscal: ctx.config.incentivoFiscal ? '1' : '2',
    codigo_lc116: formatarItemLc116(primeiroItem?.codigoLc116),
    codigo_tributacao_municipio: formatarItemLc116(String(ctx.config.configExtra.codigo_tributacao_municipio || primeiroItem?.codigoLc116 || '')),
    exigibilidade_iss: String(ctx.config.configExtra.exigibilidade_iss || '1'),
    tomador_logradouro: input.tomador.endereco?.logradouro,
    tomador_numero: input.tomador.endereco?.numero,
    tomador_complemento: input.tomador.endereco?.complemento,
    tomador_bairro: input.tomador.endereco?.bairro,
    tomador_ibge: input.tomador.municipioIbge,
    tomador_uf: input.tomador.endereco?.uf,
    tomador_cep: input.tomador.endereco?.cep,
    discriminacao: input.discriminacao,
    itens: input.itens
      .map(
        (it) =>
          `<Item><CodigoLc116>${it.codigoLc116}</CodigoLc116><Descricao>${it.descricao}</Descricao><Quantidade>${it.quantidade}</Quantidade><ValorUnitario>${it.valorUnitario.toFixed(2)}</ValorUnitario><Tributavel>${it.tributavel ? '1' : '0'}</Tributavel></Item>`,
      )
      .join(''),
    fatura_numero: input.faturaNumero,
  };
}

/** Primeira tag cujo nome casa com os apelidos (tolerante a variações municipais). */
function tagPorApelidos(xml: string, apelidos: string[]): string | undefined {
  for (const a of apelidos) {
    const m = new RegExp(`<${a}(?:\\s[^>]*)?>([\\s\\S]*?)</${a}>`, 'i').exec(xml);
    if (m && m[1].trim()) return m[1].trim();
  }
  return undefined;
}

/** Tenta JSON; senão extrai campos genéricos de XML municipais. */
export function interpretarResposta(texto: string): {
  numeroNfse?: string;
  codigoVerificacao?: string;
  protocolo?: string;
  situacao?: string;
  erro?: { codigo: string; mensagem: string };
} {
  const textoTrim = texto.trim();
  let json: Record<string, unknown> | undefined;
  if (textoTrim.startsWith('{') || textoTrim.startsWith('[')) {
    try {
      const parsed = JSON.parse(textoTrim) as Record<string, unknown>;
      json = Array.isArray(parsed) ? (parsed[0] as Record<string, unknown>) : parsed;
    } catch {
      json = undefined;
    }
  }
  const pega = (apelidos: string[]): string | undefined => {
    if (json) {
      for (const a of apelidos) {
        const v = json[a];
        if (v !== undefined && v !== null && String(v).trim() !== '') return String(v);
      }
      return undefined;
    }
    return tagPorApelidos(textoTrim, apelidos);
  };
  const numeroNfse = pega(['numero_nfse', 'numeroNfse', 'NumeroNfse', 'numero']);
  const codigoVerificacao = pega(['codigo_verificacao', 'codigoVerificacao', 'CodigoVerificacao']);
  const protocolo = pega(['protocolo', 'Protocolo', 'numero_protocolo']);
  const situacao = pega(['situacao', 'Situacao', 'status', 'Status']);
  const codigoErro = pega(['codigo_erro', 'codigoErro', 'CodigoErro', 'Codigo']);
  const mensagemErro = pega(['mensagem_erro', 'mensagemErro', 'mensagem', 'Mensagem', 'Motivo', 'MensagemRetorno']);
  return {
    ...(numeroNfse ? { numeroNfse } : {}),
    ...(codigoVerificacao ? { codigoVerificacao } : {}),
    ...(protocolo ? { protocolo } : {}),
    ...(situacao ? { situacao } : {}),
    ...(mensagemErro
      ? { erro: { codigo: codigoErro ?? 'erro_municipio', mensagem: mensagemErro } }
      : {}),
  };
}

/* ------------------------------------------------------------------ */
/* Provider                                                            */
/* ------------------------------------------------------------------ */

export function criarProprietario(deps: DepsProprietario = {}): NfseProvider {
  const enviar = async (
    ctx: NfseContext,
    cfg: ConfiguracaoMunicipioProprietario,
    operacao: keyof ConfiguracaoMunicipioProprietario['operacoes'],
    corpo: string,
  ): Promise<string> => {
    const http = clienteHttp(ctx, deps.http);
    const extra = ctx.config.configExtra;
    const url = urlOperacao(ctx, cfg, operacao);
    const namespace = typeof extra.soap_namespace === 'string' ? extra.soap_namespace : null;
    const corpoFinal = namespace
      ? montarSoapNamespace(operacao, namespace, corpo, cfg.escaparXml)
      : corpo;
    const res = await http(url, {
      method: 'POST',
      headers: {
        'Content-Type': cfg.contentType,
        ...cabecalhosAutenticacao(cfg, ctx.credenciais),
      },
      body: corpoFinal,
    });
    if (!res.ok) throw new Error(`Webservice do município respondeu HTTP ${res.status} em ${operacao}.`);
    return res.texto;
  };

  return {
    key: 'proprietario',
    meta: PROPRIETARIO_META,

    async emitirRps(ctx, input): Promise<NfseEmissaoResultado> {
      try {
        const cfg = resolverConfigMunicipio(ctx);
        const corpo = renderTemplate(cfg.templates.emitir, varsComuns(ctx, input));
        const resposta = await enviar(ctx, cfg, 'emitir', corpo);
        const campos = interpretarResposta(resposta);
        if (campos.erro || (!campos.numeroNfse && !campos.protocolo)) {
          return {
            ok: false,
            erro: campos.erro ?? { codigo: 'sem_resposta', mensagem: 'Webservice não devolveu número nem protocolo.' },
            raw: sanitizarRaw(resposta),
          };
        }
        return {
          ok: true,
          ...(campos.protocolo ? { protocolo: campos.protocolo } : {}),
          ...(campos.numeroNfse ? { numeroNfse: campos.numeroNfse } : {}),
          ...(campos.codigoVerificacao ? { codigoVerificacao: campos.codigoVerificacao } : {}),
          raw: sanitizarRaw(resposta),
        };
      } catch (e) {
        return { ok: false, erro: { codigo: 'falha_envio', mensagem: e instanceof Error ? e.message : String(e) } };
      }
    },

    async consultar(ctx, ref): Promise<NfseConsultaResultado> {
      try {
        const cfg = resolverConfigMunicipio(ctx);
        const corpo = renderTemplate(cfg.templates.consultar, {
          rps_numero: ref.rpsNumero,
          rps_serie: ref.rpsSerie ?? ctx.config.rpsSerie,
          numero_nfse: ref.numeroNfse,
          protocolo: ref.protocolo,
          prestador_cnpj: ctx.config.cnpj,
          prestador_im: ctx.config.inscricaoMunicipal,
        });
        const resposta = await enviar(ctx, cfg, 'consultar', corpo);
        const campos = interpretarResposta(resposta);
        const situacaoBruta = (campos.situacao ?? '').toLowerCase();
        let situacao: NfseConsultaResultado['situacao'];
        if (campos.erro && !campos.numeroNfse) situacao = 'rejeitado';
        else if (situacaoBruta.includes('cancel')) situacao = 'cancelado';
        else if (situacaoBruta.includes('rejeit') || situacaoBruta.includes('recus')) situacao = 'rejeitado';
        else if (campos.numeroNfse) situacao = 'autorizado';
        else situacao = 'nao_encontrado';
        return {
          ok: true,
          situacao,
          ...(campos.numeroNfse ? { numeroNfse: campos.numeroNfse } : {}),
          ...(campos.codigoVerificacao ? { codigoVerificacao: campos.codigoVerificacao } : {}),
          ...(campos.erro ? { erro: campos.erro } : {}),
          raw: sanitizarRaw(resposta),
        };
      } catch (e) {
        return { ok: false, erro: { codigo: 'falha_consulta', mensagem: e instanceof Error ? e.message : String(e) } };
      }
    },

    async cancelar(ctx, ref): Promise<NfseCancelamentoResultado> {
      try {
        const cfg = resolverConfigMunicipio(ctx);
        const corpo = renderTemplate(cfg.templates.cancelar, {
          numero_nfse: ref.numeroNfse,
          codigo_cancelamento: resolverCodigoCancelamento(ref.codigoCancelamento),
          motivo: ref.motivo,
          prestador_cnpj: ctx.config.cnpj,
          prestador_im: ctx.config.inscricaoMunicipal,
        });
        const resposta = await enviar(ctx, cfg, 'cancelar', corpo);
        const campos = interpretarResposta(resposta);
        const confirmado = tagOuJsonConfirmado(resposta, campos.situacao);
        if (!confirmado) {
          return {
            ok: false,
            erro: campos.erro ?? { codigo: 'cancelamento_recusado', mensagem: 'Webservice não confirmou o cancelamento.' },
            raw: sanitizarRaw(resposta),
          };
        }
        return { ok: true, xmlCancelamento: corpo, raw: sanitizarRaw(resposta) };
      } catch (e) {
        return { ok: false, erro: { codigo: 'falha_cancelamento', mensagem: e instanceof Error ? e.message : String(e) } };
      }
    },
  };
}

function tagOuJsonConfirmado(resposta: string, situacao?: string): boolean {
  const s = (situacao ?? '').toLowerCase();
  if (s.includes('cancel')) return true;
  return /<(Sucesso|Confirmado)[^>]*>\s*(1|true)\s*<\/(Sucesso|Confirmado)>/i.test(resposta);
}

function montarSoapNamespace(
  operacao: string,
  namespace: string,
  corpo: string,
  escapar: boolean,
): string {
  const interno = escapar
    ? corpo.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    : corpo;
  return `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><${operacao} xmlns="${namespace}">${interno}</${operacao}></soap:Body></soap:Envelope>`;
}

/** Instância padrão usada pelo registry. */
export const proprietarioProvider: NfseProvider = criarProprietario();
