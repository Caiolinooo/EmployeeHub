/**
 * Padrão fiscal ABZ extraído das NFS-e reais da SPE Macaé (somente leitura).
 *
 * Fonte: ConsultarNfseServicoPrestado em produção (janelas 2026-07 e 2026-08).
 * Não emite, não cancela, não grava no município — só descreve o XML que a
 * prefeitura já autorizou para a empresa.
 *
 * Nacional (tomador BR): ExigibilidadeISS=1, IdentificacaoTomador, IBSCBS,
 * MunicipioIncidencia, NBS 114011300, PIS/COFINS 01.
 * Exterior (sem CPF/CNPJ): ExigibilidadeISS=4, MotivoNifNaoInformado,
 * Endereco+CodigoPais, ValorIss=0, NBS 114011900, sem IBSCBS.
 */
export const MACAE_IBGE = '3302403';

export const PADRAO_ABZ = {
  itemListaServico: '17.01',
  codigoTributacaoMunicipio: '17.01',
  codigoCnae: '7020400',
  codigoNbsExportacao: '114011900',
  codigoNbsNacional: '114011300',
  aliquotaIss: 3.75,
  exigibilidadeExportacao: '4',
  exigibilidadeNacional: '1',
  situacaoTributariaPisCofins: '01',
  motivoNifPadrao: '1',
  bairroExterior: 'EXTERIOR',
  numeroExteriorPadrao: '0',
  ibscbs: {
    operacao: '100301',
    operacaoUsoConsumoPessoal: '0',
    situacaoTributaria: '0',
    classificacaoTributaria: '1',
  },
} as const;

export interface TomadorFiscal {
  documento?: string;
  municipioIbge?: string;
  codigoPais?: string;
  motivoNifNaoInformado?: string;
  endereco?: { codigoPais?: string };
}

export interface IbscbsCampos {
  operacao: string;
  operacaoUsoConsumoPessoal: string;
  situacaoTributaria: string;
  classificacaoTributaria: string;
}

export interface CamposFiscaisAbz {
  exterior: boolean;
  padraoAbz: boolean;
  competencia: string;
  itemListaServico: string;
  codigoTributacaoMunicipio: string;
  codigoCnae?: string;
  codigoNbs?: string;
  exigibilidadeIss: string;
  codigoMunicipioPrestacao: string;
  codigoPaisServico?: string;
  municipioIncidencia?: string;
  motivoNifNaoInformado?: string;
  situacaoTributariaPisCofins?: string;
  ibscbs?: IbscbsCampos;
  valorIss: number;
}

/** LC 116 no formato SPE (`17.01`). `1701`/`0107` viram `17.01`/`01.07`. */
export function formatarItemLc116(codigo?: string): string {
  const cru = (codigo ?? '').trim();
  if (!cru) return '';
  if (/^\d{1,2}\.\d{2}$/.test(cru)) return cru;
  const d = cru.replace(/\D/g, '');
  if (d.length === 4) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length === 3) return `${d.slice(0, 1)}.${d.slice(1)}`;
  return cru;
}

/** SPE usa competência em YYYY-MM-DD (não YYYY-MM). */
export function competenciaAbrasf(competencia: string, dataEmissao: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(competencia)) return competencia;
  const diaEmissao = /^\d{4}-\d{2}-\d{2}/.test(dataEmissao) ? dataEmissao.slice(0, 10) : '';
  if (/^\d{4}-\d{2}$/.test(competencia)) {
    if (diaEmissao.startsWith(competencia)) return diaEmissao;
    return `${competencia}-01`;
  }
  return diaEmissao || competencia;
}

export function documentoBrasileiro(documento?: string): boolean {
  const d = (documento ?? '').replace(/\D/g, '');
  return d.length === 11 || d.length === 14;
}

export function tomadorEhExterior(tomador: TomadorFiscal): boolean {
  if (tomador.motivoNifNaoInformado) return true;
  if (tomador.codigoPais || tomador.endereco?.codigoPais) return true;
  return !documentoBrasileiro(tomador.documento);
}

export function usarPadraoAbz(municipioIbge?: string, flag?: boolean): boolean {
  if (flag === true) return true;
  if (flag === false) return false;
  return municipioIbge === MACAE_IBGE;
}

export function resolverCamposFiscaisAbz(opts: {
  municipioIbgePrestador?: string;
  municipioIbgeTomador?: string;
  padraoAbz?: boolean;
  competencia: string;
  dataEmissao: string;
  tomador: TomadorFiscal;
  itemLc116?: string;
  valorServicos: number;
  aliquotaIss: number;
  exigibilidadeIss?: string;
  codigoCnae?: string;
  codigoNbs?: string;
  codigoTributacaoMunicipio?: string;
  codigoPaisServico?: string;
  municipioIncidencia?: string;
  situacaoTributariaPisCofins?: string;
  ibscbs?: Partial<IbscbsCampos>;
}): CamposFiscaisAbz {
  const padraoAbz = usarPadraoAbz(opts.municipioIbgePrestador, opts.padraoAbz);
  const exterior = tomadorEhExterior(opts.tomador);
  const item = formatarItemLc116(opts.itemLc116)
    || (padraoAbz ? PADRAO_ABZ.itemListaServico : '');
  const trib = formatarItemLc116(opts.codigoTributacaoMunicipio) || item;
  const exigibilidade = opts.exigibilidadeIss
    || (padraoAbz
      ? (exterior ? PADRAO_ABZ.exigibilidadeExportacao : PADRAO_ABZ.exigibilidadeNacional)
      : '1');
  const exportacao = exigibilidade === PADRAO_ABZ.exigibilidadeExportacao || exterior;
  const valorIss = exportacao ? 0 : (opts.valorServicos * opts.aliquotaIss) / 100;
  const codigoMunicipioPrestacao = padraoAbz
    ? (opts.municipioIbgePrestador || MACAE_IBGE)
    : (opts.municipioIbgeTomador || opts.municipioIbgePrestador || '');

  const campos: CamposFiscaisAbz = {
    exterior: exportacao,
    padraoAbz,
    competencia: competenciaAbrasf(opts.competencia, opts.dataEmissao),
    itemListaServico: item,
    codigoTributacaoMunicipio: trib,
    exigibilidadeIss: exigibilidade,
    codigoMunicipioPrestacao,
    valorIss,
  };

  const cnae = opts.codigoCnae || (padraoAbz ? PADRAO_ABZ.codigoCnae : undefined);
  const nbs = opts.codigoNbs
    || (padraoAbz ? (exportacao ? PADRAO_ABZ.codigoNbsExportacao : PADRAO_ABZ.codigoNbsNacional) : undefined);
  if (cnae) campos.codigoCnae = cnae;
  if (nbs) campos.codigoNbs = nbs;

  const pais = opts.codigoPaisServico || opts.tomador.codigoPais || opts.tomador.endereco?.codigoPais;
  if (exportacao && pais) campos.codigoPaisServico = pais;
  if (exportacao) {
    campos.motivoNifNaoInformado = opts.tomador.motivoNifNaoInformado || PADRAO_ABZ.motivoNifPadrao;
  } else {
    campos.municipioIncidencia = opts.municipioIncidencia || codigoMunicipioPrestacao;
    if (padraoAbz || opts.situacaoTributariaPisCofins) {
      campos.situacaoTributariaPisCofins = opts.situacaoTributariaPisCofins
        || PADRAO_ABZ.situacaoTributariaPisCofins;
    }
    if (padraoAbz || opts.ibscbs) {
      campos.ibscbs = {
        operacao: opts.ibscbs?.operacao || PADRAO_ABZ.ibscbs.operacao,
        operacaoUsoConsumoPessoal: opts.ibscbs?.operacaoUsoConsumoPessoal
          || PADRAO_ABZ.ibscbs.operacaoUsoConsumoPessoal,
        situacaoTributaria: opts.ibscbs?.situacaoTributaria || PADRAO_ABZ.ibscbs.situacaoTributaria,
        classificacaoTributaria: opts.ibscbs?.classificacaoTributaria
          || PADRAO_ABZ.ibscbs.classificacaoTributaria,
      };
    }
  }
  return campos;
}

/** Tags geradas pelo município na resposta — não entram no RPS. */
export const TAGS_RESPOSTA_MUNICIPAL = [
  'BaseCalculo',
  'CanonicalizationMethod',
  'ChaveADN',
  'CodigoCancelamento',
  'CodigoVerificacao',
  'CompNfse',
  'Confirmacao',
  'DataHora',
  'DeclaracaoPrestacaoServico',
  'DigestMethod',
  'DigestValue',
  'IdentificacaoNfse',
  'IdentificacaoPrestador',
  'InfNfse',
  'InfPedidoCancelamento',
  'KeyInfo',
  'ListaNfse',
  'Nfse',
  'NfseCancelamento',
  'NomeFantasia',
  'OrgaoGerador',
  'Pedido',
  'PrestadorServico',
  'Reference',
  'Signature',
  'SignatureMethod',
  'SignatureValue',
  'SignedInfo',
  'Transform',
  'Transforms',
  'ValorCredito',
  'ValorLiquidoNfse',
  'ValoresNfse',
  'X509Certificate',
  'X509Data',
] as const;
