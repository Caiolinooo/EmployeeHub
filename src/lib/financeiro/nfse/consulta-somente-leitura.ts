/**
 * Consulta NFS-e SOMENTE-LEITURA (Macaé SPE / ABRASF 2.03).
 *
 * Não emite, não cancela, não substitui, não grava no webservice municipal.
 * Operações fora da whitelist lançam. Usado pelo script de adequação para
 * puxar notas já existentes e comparar o XML real com o nosso template.
 */
import https from 'https';
import { extractKeysFromPfx } from '@/lib/e-social/signing';
import {
  extrairBloco,
  extrairMensagensErro,
  extrairNfse,
  extrairTag,
  montarConsultarNfseServicoPrestado,
  montarEnvelopeAbrasfNacional,
} from './abrasf/templates';
import { MACAE_CONFIG } from './municipios/macae';
import { TAGS_RESPOSTA_MUNICIPAL } from './padrao-abz';

export const OPERACOES_LEITURA = [
  'ConsultarNfseServicoPrestado',
  'ConsultarNfsePorRps',
  'ConsultarNfseFaixa',
  'ConsultarLoteRps',
  'ConsultarSituacaoLoteRps',
  'ConsultarNfseServicoTomado',
] as const;

export type OperacaoLeituraNfse = (typeof OPERACOES_LEITURA)[number];

const BLOQUEADAS = /recepcionar|enviar|gerar|cancelar|substituir/i;

export function garantirOperacaoSomenteLeitura(operacao: string): asserts operacao is OperacaoLeituraNfse {
  if (BLOQUEADAS.test(operacao) || !(OPERACOES_LEITURA as readonly string[]).includes(operacao)) {
    throw new Error(
      `Operação '${operacao}' bloqueada: este módulo só consulta NFS-e (sem emitir, cancelar ou alterar dados).`,
    );
  }
}

export interface ConsultaPrestadoInput {
  cnpj: string;
  inscricaoMunicipal?: string;
  dataInicial: string;
  dataFinal: string;
  pagina?: number;
  numeroNfse?: string;
  ambiente?: 'homologacao' | 'producao';
}

export interface NfseLida {
  numeroNfse?: string;
  codigoVerificacao?: string;
  dataEmissao?: string;
  competencia?: string;
  rpsNumero?: string;
  rpsSerie?: string;
  tomadorNome?: string;
  tomadorDocumento?: string;
  tomadorExterior?: boolean;
  motivoNifNaoInformado?: string;
  valorServicos?: string;
  valorIss?: string;
  valorLiquido?: string;
  baseCalculo?: string;
  aliquota?: string;
  itemListaServico?: string;
  codigoTributacaoMunicipio?: string;
  codigoCnae?: string;
  codigoNbs?: string;
  codigoPais?: string;
  discriminacao?: string;
  exigibilidadeIss?: string;
  issRetido?: string;
  codigoMunicipioPrestacao?: string;
  municipioIncidencia?: string;
  chaveAdn?: string;
  cancelada?: boolean;
  optanteSimples?: string;
  tags: string[];
  tagsDeclaracao: string[];
}

export interface ResultadoConsultaLeitura {
  ok: boolean;
  operacao: OperacaoLeituraNfse;
  url: string;
  notas: NfseLida[];
  pagina?: string;
  erro?: { codigo: string; mensagem: string };
  xmlResposta: string;
}

export function inventariarTags(xml: string): string[] {
  const tags = new Set<string>();
  const re = /<\/?([A-Za-z][\w.-]*)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) tags.add(m[1]);
  return [...tags].sort();
}

export function parsearNotasCompNfse(xml: string): NfseLida[] {
  const blocos: string[] = xml.match(/<CompNfse\b[\s\S]*?<\/CompNfse>/gi)
    ?? xml.match(/<InfNfse\b[\s\S]*?<\/InfNfse>/gi)
    ?? [];
  if (blocos.length === 0 && /<InfNfse[\s>]/i.test(xml)) blocos.push(xml);
  return blocos.map((bloco) => {
    const nfse = extrairNfse(bloco);
    const decl = extrairBloco(bloco, 'InfDeclaracaoPrestacaoServico')
      ?? extrairBloco(bloco, 'DeclaracaoPrestacaoServico')
      ?? bloco;
    const tomador = extrairBloco(decl, 'Tomador') ?? extrairBloco(decl, 'TomadorServico') ?? '';
    const servico = extrairBloco(decl, 'Servico') ?? '';
    const identRps = extrairBloco(decl, 'IdentificacaoRps') ?? '';
    const valoresNfse = extrairBloco(bloco, 'ValoresNfse') ?? '';
    const exterior = /<(MotivoNifNaoInformado|CodigoPais)\b/i.test(tomador);
    return {
      numeroNfse: nfse.numeroNfse ?? extrairTag(bloco, 'Numero'),
      codigoVerificacao: nfse.codigoVerificacao,
      dataEmissao: extrairTag(bloco, 'DataEmissao'),
      competencia: extrairTag(decl, 'Competencia'),
      rpsNumero: extrairTag(identRps, 'Numero'),
      rpsSerie: extrairTag(identRps, 'Serie'),
      tomadorNome: extrairTag(tomador, 'RazaoSocial'),
      tomadorDocumento: extrairTag(tomador, 'Cnpj') ?? extrairTag(tomador, 'Cpf'),
      tomadorExterior: exterior,
      motivoNifNaoInformado: extrairTag(tomador, 'MotivoNifNaoInformado'),
      valorServicos: extrairTag(servico, 'ValorServicos'),
      valorIss: extrairTag(servico, 'ValorIss') ?? extrairTag(valoresNfse, 'ValorIss'),
      valorLiquido: extrairTag(valoresNfse, 'ValorLiquidoNfse'),
      baseCalculo: extrairTag(valoresNfse, 'BaseCalculo'),
      aliquota: extrairTag(servico, 'Aliquota') ?? extrairTag(valoresNfse, 'Aliquota'),
      itemListaServico: extrairTag(servico, 'ItemListaServico'),
      codigoTributacaoMunicipio: extrairTag(servico, 'CodigoTributacaoMunicipio'),
      codigoCnae: extrairTag(servico, 'CodigoCnae'),
      codigoNbs: extrairTag(servico, 'CodigoNbs'),
      codigoPais: extrairTag(servico, 'CodigoPais') ?? extrairTag(tomador, 'CodigoPais'),
      discriminacao: extrairTag(servico, 'Discriminacao'),
      exigibilidadeIss: extrairTag(servico, 'ExigibilidadeISS'),
      issRetido: extrairTag(servico, 'IssRetido'),
      codigoMunicipioPrestacao: extrairTag(servico, 'CodigoMunicipio'),
      municipioIncidencia: extrairTag(servico, 'MunicipioIncidencia'),
      chaveAdn: extrairTag(bloco, 'ChaveADN'),
      cancelada: /<NfseCancelamento\b/i.test(bloco),
      optanteSimples: extrairTag(decl, 'OptanteSimplesNacional'),
      tags: inventariarTags(bloco),
      tagsDeclaracao: inventariarTags(decl),
    };
  });
}

/** Tags que o RPS ABZ/SPE já emite (InfDeclaracaoPrestacaoServico). */
export const TAGS_TEMPLATE_NOSSO = [
  'Aliquota',
  'Bairro',
  'Cep',
  'ClassificacaoTributaria',
  'Cnpj',
  'CodigoCnae',
  'CodigoMunicipio',
  'CodigoNbs',
  'CodigoPais',
  'CodigoTributacaoMunicipio',
  'Competencia',
  'Complemento',
  'Contato',
  'CpfCnpj',
  'DataEmissao',
  'DescontoCondicionado',
  'DescontoIncondicionado',
  'Discriminacao',
  'Email',
  'Endereco',
  'ExigibilidadeISS',
  'IBSCBS',
  'IdentificacaoRps',
  'IdentificacaoTomador',
  'IncentivoFiscal',
  'InfDeclaracaoPrestacaoServico',
  'InscricaoMunicipal',
  'IssRetido',
  'ItemListaServico',
  'MotivoNifNaoInformado',
  'MunicipioIncidencia',
  'Numero',
  'Operacao',
  'OperacaoUsoConsumoPessoal',
  'OptanteSimplesNacional',
  'Prestador',
  'RazaoSocial',
  'Rps',
  'Serie',
  'Servico',
  'SituacaoTributaria',
  'SituacaoTributariaPISCOFINS',
  'Status',
  'Tipo',
  'Tomador',
  'Uf',
  'ValorCsll',
  'ValorIr',
  'ValorIss',
  'ValorServicos',
  'Valores',
  'ValoresTributos',
];

export function compararComTemplate(tagsReais: string[]): {
  noRealAusenteNoNosso: string[];
  noNossoAusenteNoReal: string[];
} {
  const nossos = new Set(TAGS_TEMPLATE_NOSSO);
  const ignorar = new Set<string>(TAGS_RESPOSTA_MUNICIPAL);
  return {
    noRealAusenteNoNosso: tagsReais.filter((t) => !nossos.has(t) && !ignorar.has(t)),
    noNossoAusenteNoReal: TAGS_TEMPLATE_NOSSO.filter((t) => !tagsReais.includes(t) && !ignorar.has(t)),
  };
}

/** SPE Macaé recusa período > 30 dias (X135). */
export const JANELA_MAXIMA_DIAS_SPE = 30;

export function partirPeriodoEmJanelas(dataInicial: string, dataFinal: string, dias = JANELA_MAXIMA_DIAS_SPE): { de: string; ate: string }[] {
  const ini = new Date(`${dataInicial}T00:00:00Z`);
  const fim = new Date(`${dataFinal}T00:00:00Z`);
  if (Number.isNaN(ini.getTime()) || Number.isNaN(fim.getTime()) || ini > fim) return [];
  const janelas: { de: string; ate: string }[] = [];
  let cursor = new Date(fim);
  while (cursor >= ini) {
    const ate = cursor.toISOString().slice(0, 10);
    const deDate = new Date(cursor);
    deDate.setUTCDate(deDate.getUTCDate() - (dias - 1));
    if (deDate < ini) deDate.setTime(ini.getTime());
    janelas.push({ de: deDate.toISOString().slice(0, 10), ate });
    cursor = new Date(deDate);
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return janelas;
}

export function urlSpeMacae(ambiente: 'homologacao' | 'producao' = 'producao'): string {
  return ambiente === 'producao' ? MACAE_CONFIG.urls.producao : MACAE_CONFIG.urls.homologacao;
}

export function montarDadosConsultaPrestado(input: ConsultaPrestadoInput): string {
  return montarConsultarNfseServicoPrestado({
    cnpj: input.cnpj.replace(/\D/g, ''),
    inscricaoMunicipal: input.inscricaoMunicipal,
    dataInicial: input.dataInicial,
    dataFinal: input.dataFinal,
    pagina: input.pagina,
    numeroNfse: input.numeroNfse,
  });
}

export function montarPedidoConsultaPrestado(input: ConsultaPrestadoInput): {
  operacao: OperacaoLeituraNfse;
  envelope: string;
} {
  const operacao: OperacaoLeituraNfse = 'ConsultarNfseServicoPrestado';
  garantirOperacaoSomenteLeitura(operacao);
  return { operacao, envelope: montarEnvelopeAbrasfNacional(operacao, montarDadosConsultaPrestado(input)) };
}

/** Envelope oficial do WSDL SPE — só-leitura. */
export function envelopesConsultaPrestado(input: ConsultaPrestadoInput): { nome: string; envelope: string; soapAction: string }[] {
  const operacao: OperacaoLeituraNfse = 'ConsultarNfseServicoPrestado';
  garantirOperacaoSomenteLeitura(operacao);
  const dados = montarDadosConsultaPrestado(input);
  return [
    { nome: 'wsdl-request', envelope: montarEnvelopeAbrasfNacional(operacao, dados), soapAction: `http://nfse.abrasf.org.br/${operacao}` },
  ];
}

export async function enviarSoapSomenteLeitura(opts: {
  url: string;
  operacao: string;
  envelope: string;
  pfx: Buffer;
  passphrase: string;
  soapAction?: string;
}): Promise<{ status: number; body: string }> {
  garantirOperacaoSomenteLeitura(opts.operacao);
  const url = new URL(opts.url);
  let key: string | undefined;
  let cert: string | undefined;
  try {
    const pem = extractKeysFromPfx(opts.pfx, opts.passphrase);
    key = pem.privateKeyPem;
    cert = pem.certPem;
  } catch {
    /* cai no pfx nativo */
  }
  const soapAction = opts.soapAction ?? `http://nfse.abrasf.org.br/${opts.operacao}`;
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          SOAPAction: `"${soapAction}"`,
          'Content-Length': Buffer.byteLength(opts.envelope, 'utf8'),
        },
        key,
        cert,
        pfx: key ? undefined : opts.pfx,
        passphrase: key ? undefined : opts.passphrase,
        rejectUnauthorized: true,
        minVersion: 'TLSv1.2',
      },
      (res) => {
        const pedacos: Buffer[] = [];
        res.on('data', (c) => pedacos.push(c));
        res.on('end', () => {
          resolve({ status: res.statusCode || 500, body: Buffer.concat(pedacos).toString('utf8') });
        });
      },
    );
    req.on('error', reject);
    req.setTimeout(30_000, () => req.destroy(new Error('timeout consulta NFS-e')));
    req.write(opts.envelope);
    req.end();
  });
}

export function decodificarOutputXml(soap: string): string {
  const output = extrairTag(soap, 'outputXML') ?? soap;
  return output
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

export async function consultarNfseServicoPrestado(
  input: ConsultaPrestadoInput,
  cert: { pfx: Buffer; passphrase: string },
): Promise<ResultadoConsultaLeitura> {
  const operacao: OperacaoLeituraNfse = 'ConsultarNfseServicoPrestado';
  garantirOperacaoSomenteLeitura(operacao);
  const url = urlSpeMacae(input.ambiente ?? 'producao');
  let ultimo: ResultadoConsultaLeitura | undefined;
  for (const tentativa of envelopesConsultaPrestado(input)) {
    const { status, body } = await enviarSoapSomenteLeitura({
      url,
      operacao,
      envelope: tentativa.envelope,
      pfx: cert.pfx,
      passphrase: cert.passphrase,
      soapAction: tentativa.soapAction,
    });
    const xml = decodificarOutputXml(body);
    const mensagens = extrairMensagensErro(xml);
    const notas = parsearNotasCompNfse(xml);
    const x186 = mensagens.some((m) => m.codigo === 'X186');
    const erro = mensagens[0]
      ? { codigo: mensagens[0].codigo, mensagem: `${mensagens[0].mensagem} [${tentativa.nome}]` }
      : status >= 400
        ? { codigo: `http_${status}`, mensagem: `HTTP ${status} na consulta (somente leitura).` }
        : undefined;
    const atual: ResultadoConsultaLeitura = {
      ok: !erro && (notas.length > 0 || /ListaNfse|CompNfse/i.test(xml)),
      operacao,
      url,
      notas,
      pagina: extrairTag(xml, 'Pagina'),
      erro,
      xmlResposta: xml,
    };
    if (erro?.codigo?.startsWith('http_') && ultimo) continue;
    ultimo = atual;
    if (!x186 && (atual.ok || (erro && erro.codigo !== 'X186'))) return atual;
  }
  return ultimo!;
}
