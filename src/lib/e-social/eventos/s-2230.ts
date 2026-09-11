interface IdeEvento { indRetif?: number; nrRecibo?: string; tpAmb: number; procEmi: number; verProc: string; }
interface IdeEmpregador { tpInsc: number; nrInsc: string; }
interface IdeVinculo { cpfTrab: string; matricula: string; }
interface IniAfastamento { dtIniAfast: string; codMotAfast: string; infoMesmoMtv?: 'S' | 'N'; tpAcidTransito?: number; observacao?: string; }
interface FimAfastamento { dtTermAfast: string; }
interface InfoAfastamento { iniAfastamento?: IniAfastamento; fimAfastamento?: FimAfastamento; }
export interface DadosS2230 { ideEvento: IdeEvento; ideEmpregador: IdeEmpregador; ideVinculo: IdeVinculo; infoAfastamento: InfoAfastamento; }

function xmlEncode(str: string): string { return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;'); }
function buildTag(tag: string, value: string | number | undefined | null, indent: number): string { if (value === undefined || value === null || value === '') return ''; const spaces = '  '.repeat(indent); return `${spaces}<${tag}>${xmlEncode(String(value))}</${tag}>\n`; }

export function gerarS2230(dados: DadosS2230): string {
  const { ideEvento, ideEmpregador, ideVinculo, infoAfastamento } = dados;
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtAfastTemp/v_S_01_03_00">\n';
  xml += '  <evtAfastTemp>\n';
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
  xml += '    <infoAfastamento>\n';
  if (infoAfastamento.iniAfastamento) {
    xml += '      <iniAfastamento>\n';
    xml += buildTag('dtIniAfast', infoAfastamento.iniAfastamento.dtIniAfast, 5);
    xml += buildTag('codMotAfast', infoAfastamento.iniAfastamento.codMotAfast, 5);
    xml += buildTag('infoMesmoMtv', infoAfastamento.iniAfastamento.infoMesmoMtv, 5);
    xml += buildTag('tpAcidTransito', infoAfastamento.iniAfastamento.tpAcidTransito, 5);
    xml += buildTag('observacao', infoAfastamento.iniAfastamento.observacao, 5);
    xml += '      </iniAfastamento>\n';
  } else if (infoAfastamento.fimAfastamento) {
    xml += '      <fimAfastamento>\n';
    xml += buildTag('dtTermAfast', infoAfastamento.fimAfastamento.dtTermAfast, 5);
    xml += '      </fimAfastamento>\n';
  }
  xml += '    </infoAfastamento>\n';
  xml += '  </evtAfastTemp>\n';
  xml += '</eSocial>';
  return xml;
}
