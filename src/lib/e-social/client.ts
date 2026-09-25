import https from 'https';
import { supabaseAdmin } from '@/lib/supabase';
import { signESocialXml, extractKeysFromPfx } from './signing';
import { carregarCertificadoA1 } from '@/lib/certificado-a1';
import { buildEsocialHttpsTlsOptions } from './tls';

const ESOCIAL_PRODUCTION = {
  envio: 'https://webservices.envio.esocial.gov.br/servicos/empregador/enviarloteeventos/WsEnviarLoteEventos.svc',
  consulta: 'https://webservices.consulta.esocial.gov.br/servicos/empregador/consultarloteeventos/WsConsultarLoteEventos.svc',
};

const ESOCIAL_HOMOLOGACAO = {
  envio: 'https://webservices.producaorestrita.esocial.gov.br/servicos/empregador/enviarloteeventos/WsEnviarLoteEventos.svc',
  consulta: 'https://webservices.producaorestrita.esocial.gov.br/servicos/empregador/consultarloteeventos/WsConsultarLoteEventos.svc',
};

const SOAP_ACTIONS = {
  ENVIAR: 'http://www.esocial.gov.br/servicos/empregador/lote/eventos/envio/v1_1_0/ServicoEnviarLoteEventos/EnviarLoteEventos',
  CONSULTAR: 'http://www.esocial.gov.br/servicos/empregador/lote/eventos/envio/consulta/retornoProcessamento/v1_1_0/ServicoConsultarLoteEventos/ConsultarLoteEventos'
};

export interface EnvioParams {
  xml: string;
  codigoEvento: string;
  certificadoId?: string;
  cnpjEmpregador?: string;
}

export interface EnvioResult {
  sucesso: boolean;
  protocolo?: string;
  dataEnvio: string;
  codigoEvento: string;
  erros: string[];
  numeroRecibo?: string;
}

export interface ProtocoloResult {
  protocolo: string;
  situacao: 'RECEBIDO' | 'PROCESSANDO' | 'PROCESSADO' | 'ERRO' | 'REJEITADO';
  codigoEvento: string;
  dataConsulta: string;
  xmlEnviado?: string;
  xmlRetorno?: string;
  erros: string[];
  numeroRecibo?: string;
}

async function getConfig() {
  const { data } = await supabaseAdmin
    .from('esocial_configuracoes')
    .select('valor')
    .eq('chave', 'geral')
    .maybeSingle();

  const geral = data?.valor || { ambiente: 'homologacao' };

  const { data: wsData } = await supabaseAdmin
    .from('esocial_configuracoes')
    .select('valor')
    .eq('chave', 'webservice')
    .maybeSingle();

  const ws = wsData?.valor || {};

  return {
    ambiente: geral.ambiente || 'homologacao',
    ws,
  };
}

function getGrupoByCodigoEvento(codigoEvento: string): string {
  if (codigoEvento.startsWith('S-10')) {
    return '1';
  }
  if (
    codigoEvento.startsWith('S-12') ||
    codigoEvento.startsWith('S-13') ||
    codigoEvento.startsWith('S-25') ||
    codigoEvento.startsWith('S-3000')
  ) {
    return '3';
  }
  return '2';
}

function buildSoapEnvelope(xml: string, cnpj: string, codigoEvento: string): string {
  // O XML do evento (já assinado) pode conter uma declaração <?xml ...?>
  // Como ele será embutido dentro de um lote, não pode ter declaração própria.
  const xmlSemDeclaracao = xml.replace(/<\?xml[^>]*\?>\s*/i, '');
  
  // Extrair o Id do evento do XML
  const idMatch = xml.match(/Id="([^"]+)"/);
  const eventoId = idMatch ? idMatch[1] : 'ID_DESCONHECIDO';
  
  const grupo = getGrupoByCodigoEvento(codigoEvento);
  
  const cnpjLimpo = cnpj.replace(/\D/g, '');
  const cnpjBase = cnpjLimpo.substring(0, 8); // 8-digit base CNPJ for ideEmpregador at lot level
  const cnpjTransmissor = cnpjLimpo; // 14-digit full CNPJ for ideTransmissor (certificate owner)
  
  return `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Body>
    <EnviarLoteEventos xmlns="http://www.esocial.gov.br/servicos/empregador/lote/eventos/envio/v1_1_1">
      <loteEventos>
        <eSocial xmlns="http://www.esocial.gov.br/schema/lote/eventos/envio/v1_1_1">
          <envioLoteEventos grupo="${grupo}">
            <ideEmpregador>
              <tpInsc>1</tpInsc>
              <nrInsc>${cnpjBase}</nrInsc>
            </ideEmpregador>
            <ideTransmissor>
              <tpInsc>1</tpInsc>
              <nrInsc>${cnpjTransmissor}</nrInsc>
            </ideTransmissor>
            <eventos>
              <evento Id="${eventoId}">
                ${xmlSemDeclaracao}
              </evento>
            </eventos>
          </envioLoteEventos>
        </eSocial>
      </loteEventos>
    </EnviarLoteEventos>
  </soap:Body>
</soap:Envelope>`;
}

function buildConsultaSoapEnvelope(protocolo: string): string {
  return `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Body>
    <ConsultarLoteEventos xmlns="http://www.esocial.gov.br/servicos/empregador/lote/eventos/consulta/v1_1_1">
      <consulta>
        <eSocial xmlns="http://www.esocial.gov.br/schema/lote/eventos/envio/consulta/retornoProcessamento/v1_0_0">
          <consultaLoteEventos>
            <protocoloEnvio>${protocolo}</protocoloEnvio>
          </consultaLoteEventos>
        </eSocial>
      </consulta>
    </ConsultarLoteEventos>
  </soap:Body>
</soap:Envelope>`;
}

async function loadCert(certificadoId?: string): Promise<{ pfx: Buffer; passphrase: string } | null> {
  try {
    const loaded = await carregarCertificadoA1(certificadoId ? { id: certificadoId } : {});
    return { pfx: loaded.pfx, passphrase: loaded.passphrase };
  } catch (err) {
    console.error('[eSocialClient] Falha ao carregar o A1 unico da empresa:', err);
    return null;
  }
}

function makeSoapRequest(url: string, soapXml: string, soapAction: string, certificado?: { pfx: Buffer; passphrase: string }): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options: https.RequestOptions = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': soapAction,
        'Content-Length': Buffer.byteLength(soapXml, 'utf8'),
      },
      ...buildEsocialHttpsTlsOptions(),
    };

    if (certificado) {
      try {
        const { privateKeyPem, certPem } = extractKeysFromPfx(certificado.pfx, certificado.passphrase);
        options.key = privateKeyPem;
        options.cert = certPem;
        console.log(`[eSocialClient] Usando certificado cliente (PEM extraído do PFX via node-forge) para ${urlObj.hostname}`);
      } catch (err: any) {
        console.error(`[eSocialClient] Falha ao extrair PEM do PFX para TLS, usando fallback PFX nativo:`, err.message || err);
        options.pfx = certificado.pfx;
        options.passphrase = certificado.passphrase;
      }
    } else {
      console.warn(`[eSocialClient] Chamada para ${urlObj.hostname} SEM certificado cliente`);
    }

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          console.error(`[eSocialClient] Erro HTTP ${res.statusCode} de ${urlObj.hostname}.`);
          console.error(`[eSocialClient] Response Body: ${body}`);
        }
        resolve({ statusCode: res.statusCode || 500, body });
      });
    });

    req.on('error', (err) => {
      console.error(`[eSocialClient] Erro de rede em ${urlObj.hostname}:`, err);
      reject(err);
    });
    
    req.write(soapXml);
    req.end();
  });
}

function extractProtocolo(soapResponse: string): string | null {
  const match = soapResponse.match(/<protocoloEnvio[^>]*>([^<]+)<\/protocoloEnvio>/i);
  return match ? match[1] : null;
}

function extractRecibo(soapResponse: string): string | null {
  const match = soapResponse.match(/<nrRecibo[^>]*>([^<]+)<\/nrRecibo>/i);
  return match ? match[1] : null;
}

function extractErros(soapResponse: string): string[] {
  const erros: string[] = [];
  
  // Buscar tags de erro <mensagem> ou <descResposta> no retorno do lote
  const regexMensagem = /<(?:mensagem|descResposta)[^>]*>([^<]+)<\/(?:mensagem|descResposta)>/ig;
  let match;
  while ((match = regexMensagem.exec(soapResponse)) !== null) {
    const msg = match[1] ? match[1].trim() : '';
    if (msg && msg !== 'Lote Recebido com Sucesso.' && msg !== 'Lote processado com sucesso.') {
      erros.push(msg);
    }
  }

  // Buscar tags de descrição <descricao> no retorno das ocorrencias do evento
  const regexDescricao = /<descricao[^>]*>([^<]+)<\/descricao>/ig;
  while ((match = regexDescricao.exec(soapResponse)) !== null) {
    const desc = match[1] ? match[1].trim() : '';
    if (desc && !erros.includes(desc)) {
      erros.push(desc);
    }
  }

  // Se houver um SOAP Fault
  const faultMatch = soapResponse.match(/<faultstring[^>]*>([^<]+)<\/faultstring>/i);
  if (faultMatch) {
    erros.push(faultMatch[1]);
  }
  
  // Extrair detalhes de exceção WCF se existirem
  const detailMatch = soapResponse.match(/<ExceptionDetail[^>]*>[\s\S]*?<Message[^>]*>([^<]+)<\/Message>/i);
  if (detailMatch) {
    erros.push(`Detail: ${detailMatch[1]}`);
  }

  return erros;
}

export async function enviarEvento(params: EnvioParams): Promise<EnvioResult> {
  const erros: string[] = [];

  if (!params.xml || params.xml.trim().length === 0) {
    erros.push('XML do evento está vazio');
  }

  if (!params.codigoEvento) {
    erros.push('Código do evento não informado');
  }

  if (!params.xml?.includes('<?xml')) {
    erros.push('XML inválido: declaração XML não encontrada');
  }

  if (!params.xml?.includes('<eSocial')) {
    erros.push('XML inválido: tag <eSocial> não encontrada');
  }

  if (erros.length > 0) {
    return {
      sucesso: false,
      dataEnvio: new Date().toISOString(),
      codigoEvento: params.codigoEvento,
      erros,
    };
  }

  try {
    const config = await getConfig();
    const isProducao = config.ambiente === 'producao';
    const url = isProducao ? ESOCIAL_PRODUCTION.envio : ESOCIAL_HOMOLOGACAO.envio;

    const urlCustom = isProducao
      ? (config as any).ws?.url_producao
      : (config as any).ws?.url_homologacao;

    const endpointUrl = urlCustom || url;
    const certLoaded = await loadCert(params.certificadoId);
    
    if (!certLoaded) {
      return {
        sucesso: false,
        dataEnvio: new Date().toISOString(),
        codigoEvento: params.codigoEvento,
        erros: ['Certificado digital não pôde ser carregado'],
      };
    }

    // Assinar o XML do evento (Mandatório para e-Social)
    let xmlAssinado = params.xml;
    try {
      xmlAssinado = signESocialXml(params.xml, certLoaded.pfx, certLoaded.passphrase);
      console.log(`[eSocialClient] XML assinado com sucesso para o evento ${params.codigoEvento}`);
    } catch (signErr: any) {
      console.error(`[eSocialClient] Erro ao assinar XML:`, signErr);
      return {
        sucesso: false,
        dataEnvio: new Date().toISOString(),
        codigoEvento: params.codigoEvento,
        erros: [`Erro na assinatura digital: ${signErr.message || signErr}`],
      };
    }

    // Determinar o CNPJ de 14 dígitos para o envelope SOAP (ideEmpregador e ideTransmissor do Lote)
    let cnpj = (params.cnpjEmpregador || '').replace(/\D/g, '');
    if (!cnpj) {
      const cnpjMatch = params.xml.match(/<nrInsc>([^<]+)<\/nrInsc>/);
      cnpj = cnpjMatch ? cnpjMatch[1] : '17784306000189';
    }
    if (cnpj.length < 14) {
      if (cnpj.startsWith('17784306')) {
        cnpj = '17784306000189';
      } else {
        cnpj = cnpj.padEnd(14, '0');
      }
    }

    const soapXml = buildSoapEnvelope(xmlAssinado, cnpj, params.codigoEvento);
    const response = await makeSoapRequest(endpointUrl, soapXml, SOAP_ACTIONS.ENVIAR, certLoaded);

    console.log(`[eSocialClient] SOAP Response Status: ${response.statusCode}`);
    console.log(`[eSocialClient] SOAP Response Body:`);
    console.log(response.body);

    if (response.statusCode >= 200 && response.statusCode < 300) {
      const protocolo = extractProtocolo(response.body);
      const reciboMatch = params.xml.match(/<nrRecibo>([^<]+)<\/nrRecibo>/);
      const numeroRecibo = reciboMatch ? reciboMatch[1] : undefined;

      return {
        sucesso: !!protocolo,
        protocolo: protocolo || undefined,
        dataEnvio: new Date().toISOString(),
        codigoEvento: params.codigoEvento,
        erros: extractErros(response.body),
        numeroRecibo,
      };
    }

    const errosRetorno = extractErros(response.body);
    return {
      sucesso: false,
      dataEnvio: new Date().toISOString(),
      codigoEvento: params.codigoEvento,
      erros: errosRetorno.length > 0 ? errosRetorno : [`Erro HTTP ${response.statusCode} na comunicação com o webservice`],
    };
  } catch (error) {
    return {
      sucesso: false,
      dataEnvio: new Date().toISOString(),
      codigoEvento: params.codigoEvento,
      erros: [error instanceof Error ? error.message : 'Erro na comunicação com o webservice do e-Social'],
    };
  }
}

export async function consultarProtocolo(protocolo: string): Promise<ProtocoloResult> {
  if (!protocolo || protocolo.trim().length === 0) {
    throw new Error('Protocolo não informado');
  }

  try {
    const config = await getConfig();
    const isProducao = config.ambiente === 'producao';
    const url = isProducao ? ESOCIAL_PRODUCTION.consulta : ESOCIAL_HOMOLOGACAO.consulta;

    const certLoaded = await loadCert();
    const soapXml = buildConsultaSoapEnvelope(protocolo);
    const response = await makeSoapRequest(url, soapXml, SOAP_ACTIONS.CONSULTAR, certLoaded || undefined);

    if (response.statusCode >= 200 && response.statusCode < 300) {
      const erros = extractErros(response.body);

      let situacao: ProtocoloResult['situacao'] = 'PROCESSANDO';
      const processamentoMatch = response.body.match(/<processamento>([\s\S]*?)<\/processamento>/i);
      if (processamentoMatch) {
        const procContent = processamentoMatch[1];
        const eventCdResposta = procContent.match(/<cdResposta>([^<]+)<\/cdResposta>/i);
        if (eventCdResposta) {
          const code = eventCdResposta[1];
          if (code === '201' || code === '202') {
            situacao = 'PROCESSADO';
          } else {
            situacao = 'ERRO';
          }
        }
      } else {
        const statusMatch = response.body.match(/<status>([\s\S]*?)<\/status>/i);
        if (statusMatch) {
          const statusContent = statusMatch[1];
          const batchCdResposta = statusContent.match(/<cdResposta>([^<]+)<\/cdResposta>/i);
          if (batchCdResposta) {
            const code = batchCdResposta[1];
            if (code === '101') {
              situacao = 'PROCESSANDO';
            } else if (code === '201') {
              situacao = 'RECEBIDO';
            } else {
              situacao = 'ERRO';
            }
          }
        }
      }

      const reciboMatch = response.body.match(/<nrRecibo>([^<]+)<\/nrRecibo>/);
      const numeroRecibo = reciboMatch ? reciboMatch[1] : undefined;

      return {
        protocolo,
        situacao,
        codigoEvento: 'S-2220',
        dataConsulta: new Date().toISOString(),
        xmlEnviado: undefined,
        xmlRetorno: response.body,
        erros,
        numeroRecibo,
      };
    }

    return {
      protocolo,
      situacao: 'ERRO',
      codigoEvento: 'S-2220',
      dataConsulta: new Date().toISOString(),
      erros: [`Erro HTTP ${response.statusCode} na consulta do protocolo`],
    };
  } catch (error) {
    return {
      protocolo,
      situacao: 'ERRO',
      codigoEvento: 'S-2220',
      dataConsulta: new Date().toISOString(),
      erros: [error instanceof Error ? error.message : 'Erro na consulta do protocolo'],
    };
  }
}
