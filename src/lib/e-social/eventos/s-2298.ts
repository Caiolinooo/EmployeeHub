interface IdeEvento { indRetif?: number; nrRecibo?: string; tpAmb: number; procEmi: number; verProc: string; }
interface IdeEmpregador { tpInsc: number; nrInsc: string; }
interface IdeVinculo { cpfTrab: string; matricula: string; }
interface InfoReintegr { tpReint: number; nrProcJud?: string; nrLeiAnistia?: string; dtEfetRetorno: string; dtEfeito: string; }
export interface DadosS2298 { ideEvento: IdeEvento; ideEmpregador: IdeEmpregador; ideVinculo: IdeVinculo; infoReintegr: InfoReintegr; }

function xmlEncode(str: string): string { return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;'); }
function buildTag(tag: string, value: string | number | undefined | null, indent: number): string { if (value === undefined || value === null || value === '') return ''; const spaces = '  '.repeat(indent); return `${spaces}<${tag}>${xmlEncode(String(value))}</${tag}>\n`; }

export function gerarS2298(dados: DadosS2298): string {
  const { ideEvento, ideEmpregador, ideVinculo, infoReintegr } = dados;
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtReintegr/v_S_01_03_00">\n';
  xml += '  <evtReintegr>\n';
  xml += '    <ideEvento>\n';
  xml += buildTag('indRetif', ideEvento.indRetif ?? 1, 4);
  xml += buildTag('nrRecibo', ideEvento.nrRecibo, 4);
  xml += buildTag('tpAmb', ideEvento.tpAmb, 4);
  xml += buildTag('procEmi', ideEvento.procEmi, 4);
  xml += buildTag('verProc', ideEvento.verProc, 4);
  xml += '    </ideEvento>\n';
  xml += '    <ideEmpregador>\n';
  xml += buildTag('tpInsc', ideEmpregador.tpInsc, 4);
  xml += buildTag('nrInsc', ideEmpregador.tpInsc === 1 ? ideEmpregador.nrInsc.replace(/\D/g, '').substring(0, 8) : ideEmpregador.nrInsc, 4);
  xml += '    </ideEmpregador>\n';
  xml += '    <ideVinculo>\n';
  xml += buildTag('cpfTrab', ideVinculo.cpfTrab, 4);
  xml += buildTag('matricula', ideVinculo.matricula, 4);
  xml += '    </ideVinculo>\n';
  xml += '    <infoReintegr>\n';
  xml += buildTag('tpReint', infoReintegr.tpReint, 4);
  xml += buildTag('nrProcJud', infoReintegr.nrProcJud, 4);
  xml += buildTag('nrLeiAnistia', infoReintegr.nrLeiAnistia, 4);
  xml += buildTag('dtEfetRetorno', infoReintegr.dtEfetRetorno, 4);
  xml += buildTag('dtEfeito', infoReintegr.dtEfeito, 4);
  xml += '    </infoReintegr>\n';
  xml += '  </evtReintegr>\n';
  xml += '</eSocial>';
  return xml;
}
