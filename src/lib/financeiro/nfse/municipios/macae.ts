/**
 * Configuração concreta do provider 'proprietário' para Macaé/RJ (IBGE 3302403)
 * — §5.1 do design: primeiro caso real, registrado como configuração DEFAULT
 * do provider proprietário para este município.
 *
 * Nenhum segredo aqui: usuário/token/senha vêm de app_secrets
 * (fin_nfse_<configId>_<campo>) via NfseContext.credenciais.
 */

export const MACAE_CODIGO_IBGE = '3302403';

export interface ConfiguracaoMunicipioProprietario {
  municipioIbge: string;
  nomeMunicipio: string;
  /** URLs por ambiente quando configExtra não trouxer override. */
  urls: { homologacao: string; producao: string };
  authTipo: 'none' | 'basic' | 'token';
  /** Nome do header quando authTipo='token' (credencial 'token'). */
  authHeaderToken: string;
  /** Prefixo do valor do header (ex. 'Bearer '); vazio = valor cru. */
  authPrefixoToken: string;
  /** Content-Type do webservice municipal. */
  contentType: 'application/xml' | 'text/xml;charset=utf-8' | 'application/json';
  /** Escapar o XML da operação dentro do envelope SOAP (padrão ABRASF-escape). */
  escaparXml: boolean;
  /** Caminhos/paths das operações anexados à URL base. */
  operacoes: { emitir: string; consultar: string; cancelar: string };
  /** Templates de corpo (placeholders {{chave}} renderizados pelo provider). */
  templates: { emitir: string; consultar: string; cancelar: string };
}

const TEMPLATE_EMISSAO_MACAE = `<?xml version="1.0" encoding="UTF-8"?>
<Rps xmlns="http://www.abrasf.org.br/nfse.xsd">
  <InfDeclaracaoPrestacaoServico Id="rps{{rps_numero}}">
    <Rps>
      <IdentificacaoRps><Numero>{{rps_numero}}</Numero><Serie>{{rps_serie}}</Serie><Tipo>1</Tipo></IdentificacaoRps>
      <DataEmissao>{{data_emissao}}</DataEmissao>
      <Status>1</Status>
    </Rps>
    <Competencia>{{competencia}}</Competencia>
    <Servico>
      <Valores>
        <ValorServicos>{{valor_servicos}}</ValorServicos>
        <Aliquota>{{aliquota}}</Aliquota>
        <ValorIss>{{valor_iss}}</ValorIss>
      </Valores>
      <IssRetido>{{iss_retido}}</IssRetido>
      <ItemListaServico>{{codigo_lc116}}</ItemListaServico>
      <Discriminacao>{{discriminacao}}</Discriminacao>
      <CodigoMunicipio>{{municipio_prestacao}}</CodigoMunicipio>
      <ExigibilidadeISS>1</ExigibilidadeISS>
    </Servico>
    <Prestador>
      <CpfCnpj><Cnpj>{{prestador_cnpj}}</Cnpj></CpfCnpj>
      <InscricaoMunicipal>{{prestador_im}}</InscricaoMunicipal>
    </Prestador>
    <Tomador>
      <IdentificacaoTomador><CpfCnpj><{{tomador_doc_tag}}>{{tomador_documento}}</{{tomador_doc_tag}}></CpfCnpj></IdentificacaoTomador>
      <RazaoSocial>{{tomador_nome}}</RazaoSocial>
    </Tomador>
    <OptanteSimplesNacional>{{optante_simples}}</OptanteSimplesNacional>
    <IncentivoFiscal>{{incentivo_fiscal}}</IncentivoFiscal>
  </InfDeclaracaoPrestacaoServico>
</Rps>`;

const TEMPLATE_CONSULTA_MACAE = `<?xml version="1.0" encoding="UTF-8"?>
<ConsultarNfseRpsEnvio xmlns="http://www.abrasf.org.br/nfse.xsd">
  <IdentificacaoRps><Numero>{{rps_numero}}</Numero><Serie>{{rps_serie}}</Serie><Tipo>1</Tipo></IdentificacaoRps>
  <Prestador>
    <CpfCnpj><Cnpj>{{prestador_cnpj}}</Cnpj></CpfCnpj>
    <InscricaoMunicipal>{{prestador_im}}</InscricaoMunicipal>
  </Prestador>
</ConsultarNfseRpsEnvio>`;

const TEMPLATE_CANCELAMENTO_MACAE = `<?xml version="1.0" encoding="UTF-8"?>
<CancelarNfseEnvio xmlns="http://www.abrasf.org.br/nfse.xsd">
  <Prestador>
    <CpfCnpj><Cnpj>{{prestador_cnpj}}</Cnpj></CpfCnpj>
    <InscricaoMunicipal>{{prestador_im}}</InscricaoMunicipal>
  </Prestador>
  <NumeroNfse>{{numero_nfse}}</NumeroNfse>
  <CodigoCancelamento>{{codigo_cancelamento}}</CodigoCancelamento>
</CancelarNfseEnvio>`;

/** Config default do provider proprietário para Macaé (3302403). */
export const MACAE_CONFIG: ConfiguracaoMunicipioProprietario = {
  municipioIbge: MACAE_CODIGO_IBGE,
  nomeMunicipio: 'Macaé',
  // Webservice municipal — confirmar host/versão com a prefeitura na ativação;
  // configExtra.wsdl_url / ambiente_urls da empresa SEMPRE sobrepõem estes valores.
  urls: {
    homologacao: 'https://nfse-homologacao.macae.rj.gov.br/ws/nfse',
    producao: 'https://nfse.macae.rj.gov.br/ws/nfse',
  },
  authTipo: 'basic', // usuário/senha do portal da prefeitura (app_secrets)
  authHeaderToken: 'Authorization',
  authPrefixoToken: '',
  contentType: 'application/xml',
  escaparXml: false,
  operacoes: { emitir: '', consultar: '', cancelar: '' },
  templates: {
    emitir: TEMPLATE_EMISSAO_MACAE,
    consultar: TEMPLATE_CONSULTA_MACAE,
    cancelar: TEMPLATE_CANCELAMENTO_MACAE,
  },
};
