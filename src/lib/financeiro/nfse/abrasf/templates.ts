/**
 * Montagem XML pura ABRASF NFS-e 2.02/2.04 (§5.1 do design) + helpers de
 * parsing de resposta. Funções PURAS (sem I/O) — testáveis com tsx --test.
 *
 * Estruturas:
 * - EnviarLoteRps (RecepcionarLoteRps), ConsultarSituacaoLoteRps,
 *   ConsultarNfsePorRps e CancelarNfse, com delta 2.02→2.04 no cancelamento
 *   (Pedido > InfPedidoCancelamento assinado) e no atributo versao do lote.
 * - Elementos assinados carregam atributo Id e declaram os namespaces no
 *   próprio documento do lote (assinatura enveloped XMLDSig via xml-sign.ts).
 */

export const ABRASF_NS = 'http://www.abrasf.org.br/nfse.xsd';
export const VERSOES = { 202: '2.02', 204: '2.04' } as const;
export type VersaoAbrasf = keyof typeof VERSOES;

export interface ErroMensagem {
  codigo: string;
  mensagem: string;
}

/* ------------------------------------------------------------------ */
/* Helpers de montagem                                                 */
/* ------------------------------------------------------------------ */

export function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function el(nome: string, valor: string | number | undefined | null): string {
  if (valor === undefined || valor === null || valor === '') return '';
  return `<${nome}>${xmlEscape(String(valor))}</${nome}>`;
}

/** Valor decimal com 2 casas e ponto (formato xs:decimal ABRASF). */
export function moeda(valor: number): string {
  return valor.toFixed(2);
}

/** UF pelo prefixo do código IBGE de 7 dígitos (ex. 3302403 → RJ). */
const UF_POR_PREFIXO: Record<string, string> = {
  '11': 'RO', '12': 'AC', '13': 'AM', '14': 'RR', '15': 'PA', '16': 'AP', '17': 'TO',
  '21': 'MA', '22': 'PI', '23': 'CE', '24': 'RN', '25': 'PB', '26': 'PE', '27': 'AL',
  '28': 'SE', '29': 'BA', '31': 'MG', '32': 'ES', '33': 'RJ', '35': 'SP', '41': 'PR',
  '42': 'SC', '43': 'RS', '50': 'MS', '51': 'MT', '52': 'GO', '53': 'DF',
};
export function ufPorCodigoIbge(codigoIbge: string): string {
  return UF_POR_PREFIXO[codigoIbge.slice(0, 2)] ?? 'EX';
}

/* ------------------------------------------------------------------ */
/* RPS                                                                 */
/* ------------------------------------------------------------------ */

export interface CtxAbrasfResumo {
  cnpj: string;
  razaoSocial: string;
  inscricaoMunicipal?: string;
  optanteSimples: boolean;
  incentivoFiscal: boolean;
  rpsSerie: string;
}

function prestadorXml(cnpj: string, inscricaoMunicipal?: string): string {
  return `<Prestador><CpfCnpj><Cnpj>${cnpj}</Cnpj></CpfCnpj>${el('InscricaoMunicipal', inscricaoMunicipal)}</Prestador>`;
}

function tomadorXml(input: { nome: string; documento: string; municipioIbge: string; inscricaoMunicipal?: string; email?: string; endereco?: NfseEndereco }): string {
  const dig = input.documento.length === 11 ? 'Cpf' : 'Cnpj';
  const uf = input.endereco?.uf ?? ufPorCodigoIbge(input.municipioIbge);
  const endereco = input.endereco
    ? `<Endereco>${el('Logradouro', input.endereco.logradouro)}${el('Numero', input.endereco.numero)}${el('Complemento', input.endereco.complemento)}${el('Bairro', input.endereco.bairro)}${el('CodigoMunicipio', input.municipioIbge)}${el('Uf', uf)}${el('Cep', input.endereco.cep)}</Endereco>`
    : '';
  const contato = input.email ? `<Contato><Email>${xmlEscape(input.email)}</Email></Contato>` : '';
  return `<Tomador><IdentificacaoTomador><CpfCnpj><${dig}>${input.documento}</${dig}></CpfCnpj></IdentificacaoTomador>${el('RazaoSocial', input.nome)}${endereco}${contato}</Tomador>`;
}

export interface NfseEndereco {
  logradouro: string; numero: string; complemento?: string;
  bairro: string; uf?: string; cep: string;
}

/** Monta o <Rps> 2.02/2.04 (com <InfDeclaracaoPrestacaoServico Id="rps{n}">). */
export function montarRps(
  versao: VersaoAbrasf,
  ctx: CtxAbrasfResumo,
  input: {
    rpsNumero: number; rpsSerie: string; dataEmissao: string; competencia: string;
    tomador: { nome: string; documento: string; municipioIbge: string; inscricaoMunicipal?: string; email?: string; endereco?: NfseEndereco };
    itens: Array<{ codigoLc116: string; descricao: string; quantidade: number; valorUnitario: number; tributavel: boolean; aliquotaIss?: number }>;
    valorServicos: number; descontosIncondicionais?: number; deducoes?: number;
    aliquotaIss: number; issRetido: boolean;
    discriminacao: string;
  },
): string {
  const valorIss = (input.valorServicos * input.aliquotaIss) / 100;
  return `<Rps><InfDeclaracaoPrestacaoServico Id="rps${input.rpsNumero}"><Rps><IdentificacaoRps><Numero>${input.rpsNumero}</Numero><Serie>${input.rpsSerie}</Serie><Tipo>1</Tipo></IdentificacaoRps><DataEmissao>${input.dataEmissao}</DataEmissao><Status>1</Status></Rps>${el('Competencia', input.competencia)}<Servico><Valores>${el('ValorServicos', moeda(input.valorServicos))}${el('ValorDeducoes', input.deducoes ? moeda(input.deducoes) : undefined)}${el('DescontosIncondicionados', input.descontosIncondicionais ? moeda(input.descontosIncondicionais) : undefined)}${el('Aliquota', input.aliquotaIss.toFixed(2))}${el('ValorIss', moeda(valorIss))}</Valores>${el('IssRetido', input.issRetido ? '1' : '2')}${el('ItemListaServico', input.itens[0]?.codigoLc116)}${el('Discriminacao', input.discriminacao)}${el('CodigoMunicipio', input.tomador.municipioIbge)}${el('ExigibilidadeISS', '1')}</Servico>${prestadorXml(ctx.cnpj, ctx.inscricaoMunicipal)}${tomadorXml(input.tomador)}${el('OptanteSimplesNacional', ctx.optanteSimples ? '1' : '2')}${el('IncentivoFiscal', ctx.incentivoFiscal ? '1' : '2')}</InfDeclaracaoPrestacaoServico></Rps>`;
}

/* ------------------------------------------------------------------ */
/* Lote e consultas                                                    */
/* ------------------------------------------------------------------ */

/** <EnviarLoteRpsEnvio> com o(s) RPS(s) — versao do atributo LoteRps por variante. */
export function montarLoteRps(
  versao: VersaoAbrasf,
  entrada: { loteNumero: number; cnpj: string; inscricaoMunicipal?: string; rpsXmls: string[] },
): string {
  return `<EnviarLoteRpsEnvio xmlns="${ABRASF_NS}"><LoteRps versao="${VERSOES[versao]}" Id="lote${entrada.loteNumero}"><NumeroLote>${entrada.loteNumero}</NumeroLote><CpfCnpj><Cnpj>${entrada.cnpj}</Cnpj></CpfCnpj>${el('InscricaoMunicipal', entrada.inscricaoMunicipal)}<QuantidadeRps>${entrada.rpsXmls.length}</QuantidadeRps><ListaRps>${entrada.rpsXmls.join('')}</ListaRps></LoteRps></EnviarLoteRpsEnvio>`;
}

export function montarConsultarSituacaoLoteRps(entrada: {
  cnpj: string; inscricaoMunicipal?: string; protocolo: string;
}): string {
  return `<ConsultarSituacaoLoteRpsEnvio xmlns="${ABRASF_NS}">${prestadorXml(entrada.cnpj, entrada.inscricaoMunicipal)}${el('Protocolo', entrada.protocolo)}</ConsultarSituacaoLoteRpsEnvio>`;
}

export function montarConsultarNfsePorRps(entrada: {
  cnpj: string; inscricaoMunicipal?: string; numero: number; serie: string;
}): string {
  return `<ConsultarNfseRpsEnvio xmlns="${ABRASF_NS}"><IdentificacaoRps><Numero>${entrada.numero}</Numero><Serie>${entrada.serie}</Serie><Tipo>1</Tipo></IdentificacaoRps>${prestadorXml(entrada.cnpj, entrada.inscricaoMunicipal)}</ConsultarNfseRpsEnvio>`;
}

export function montarConsultarLoteRps(entrada: {
  cnpj: string; inscricaoMunicipal?: string; protocolo: string;
}): string {
  return `<ConsultarLoteRpsEnvio xmlns="${ABRASF_NS}">${prestadorXml(entrada.cnpj, entrada.inscricaoMunicipal)}${el('Protocolo', entrada.protocolo)}</ConsultarLoteRpsEnvio>`;
}

/**
 * Código de cancelamento ABRASF quando o payload não o traz: tabela oficial
 * 1–9; '1' = erro na emissão (default operacional). Evita enviar
 * CodigoCancelamento vazio/ausente, que municipais rejeitam.
 */
export function resolverCodigoCancelamento(codigo?: string): string {
  const c = (codigo ?? '').trim();
  return c.length > 0 ? c : '1';
}

/**
 * CancelarNfse — 2.02 simples; 2.04 com <Pedido><InfPedidoCancelamento Id=…>
 * (que DEVE ser assinado antes do envio).
 */
export function montarCancelarNfse(
  versao: VersaoAbrasf,
  entrada: {
    cnpj: string; inscricaoMunicipal?: string; numeroNfse: string;
    codigoCancelamento: string; motivo?: string;
  },
): { xml: string; idAssinavel?: string } {
  if (versao === 202) {
    return {
      xml: `<CancelarNfseEnvio xmlns="${ABRASF_NS}">${prestadorXml(entrada.cnpj, entrada.inscricaoMunicipal)}${el('NumeroNfse', entrada.numeroNfse)}${el('CodigoCancelamento', entrada.codigoCancelamento)}</CancelarNfseEnvio>`,
    };
  }
  const idAssinavel = `canc${entrada.numeroNfse}`;
  return {
    idAssinavel,
    xml: `<CancelarNfseEnvio xmlns="${ABRASF_NS}"><Pedido><InfPedidoCancelamento Id="${idAssinavel}"><IdentificacaoNfse>${el('Numero', entrada.numeroNfse)}</IdentificacaoNfse>${prestadorXml(entrada.cnpj, entrada.inscricaoMunicipal)}${el('CodigoCancelamento', entrada.codigoCancelamento)}${el('MotivoCancelamento', entrada.motivo)}</InfPedidoCancelamento></Pedido></CancelarNfseEnvio>`,
  };
}

/* ------------------------------------------------------------------ */
/* SOAP                                                                */
/* ------------------------------------------------------------------ */

/** Envelope SOAP 1.1 com a operação no corpo (payload escabido ou cru). */
export function montarEnvelopeSoap(
  operacao: string,
  namespaceOperacao: string,
  payload: string,
  escapar: boolean,
): string {
  const corpo = escapar ? xmlEscape(payload) : payload;
  return `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><${operacao} xmlns="${namespaceOperacao}">${corpo}</${operacao}></soap:Body></soap:Envelope>`;
}

/* ------------------------------------------------------------------ */
/* Parsing de respostas (tolerante a variações municipais)             */
/* ------------------------------------------------------------------ */

/** Conteúdo da primeira ocorrência de <tag>…</tag> (sem aninhamento igual). */
export function extrairTag(xml: string, tag: string): string | undefined {
  const m = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i').exec(xml);
  return m ? m[1] : undefined;
}

/** Bloco MensagemRetorno (ou MensajeRetorno) → {codigo, mensagem}. */
export function extrairMensagensErro(xml: string): ErroMensagem[] {
  const mensagens: ErroMensagem[] = [];
  const blocos = xml.match(/<Mens[a]?gemRetorno>[\s\S]*?<\/Mens[a]?gemRetorno>/gi) ?? [];
  for (const bloco of blocos) {
    mensagens.push({
      codigo: extrairTag(bloco, 'Codigo') ?? '',
      mensagem: extrairTag(bloco, 'Mensagem') ?? extrairTag(bloco, 'Mensaje') ?? '',
    });
  }
  return mensagens;
}

/** Situação do lote: 1=nao finalizado, 2=finalizado com sucesso, 3=finalizado com erro. */
export function situacaoLote(xml: string): 'processando' | 'sucesso' | 'erro' {
  const codigo = extrairTag(xml, 'Codigo') ?? '';
  if (codigo === '2') return 'sucesso';
  if (codigo === '3') return 'erro';
  return 'processando';
}

/** Número da NFS-e + código de verificação em respostas (CompNfse/InfNfse etc.). */
export function extrairNfse(xml: string): { numeroNfse?: string; codigoVerificacao?: string } {
  const numero = extrairTag(xml, 'NumeroNfse') ?? extrairTag(xml, 'Numero');
  const cv = extrairTag(xml, 'CodigoVerificacao');
  return {
    ...(numero ? { numeroNfse: numero } : {}),
    ...(cv ? { codigoVerificacao: cv } : {}),
  };
}
