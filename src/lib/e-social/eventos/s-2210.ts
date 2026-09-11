interface IdeEvento { indRetif?: number; nrRecibo?: string; tpAmb: number; procEmi: number; verProc: string; }
interface IdeEmpregador { tpInsc: number; nrInsc: string; }
interface IdeVinculo { cpfTrab: string; matricula: string; }
interface LocalAcid { tpLograd?: string; dscLograd: string; nrLograd: string; bairro?: string; cep?: string; codMunic?: string; uf?: string; pais?: string; }
interface ParteAtingida { codParteAting: string; lateralidade: number; }
interface AgenteCausador { codAgntCausador: string; }
interface CatOrigem { nrRecCatOrig: string; }
interface Cat {
  dtAcid: string; hrAcid?: string; tpAcid: number; tpCat: number; dtObito?: string;
  hrsTrabAntesAcid?: string; tpLocal: number; dscLocal: string; codSitGeradora: string;
  iniciatCAT: number; obsCAT?: string; ultDiaTrab?: string; houveAfast: 'S' | 'N'; dtIniAfast?: string;
  localAcid: LocalAcid; parteAtingida: ParteAtingida; agenteCausador: AgenteCausador;
  catOrigem?: CatOrigem;
}
export interface DadosS2210 { ideEvento: IdeEvento; ideEmpregador: IdeEmpregador; ideVinculo: IdeVinculo; cat: Cat; }

function xmlEncode(str: string): string { return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;'); }
function buildTag(tag: string, value: string | number | undefined | null, indent: number): string { if (value === undefined || value === null || value === '') return ''; const spaces = '  '.repeat(indent); return `${spaces}<${tag}>${xmlEncode(String(value))}</${tag}>\n`; }

export function gerarS2210(dados: DadosS2210): string {
  const { ideEvento, ideEmpregador, ideVinculo, cat } = dados;
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtCAT/v_S_01_03_00">\n';
  xml += '  <evtCAT>\n';
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
  xml += '    <cat>\n';
  xml += buildTag('dtAcid', cat.dtAcid, 4);
  xml += buildTag('hrAcid', cat.hrAcid, 4);
  xml += buildTag('tpAcid', cat.tpAcid, 4);
  xml += buildTag('tpCat', cat.tpCat, 4);
  xml += buildTag('dtObito', cat.dtObito, 4);
  xml += buildTag('hrsTrabAntesAcid', cat.hrsTrabAntesAcid, 4);
  xml += buildTag('tpLocal', cat.tpLocal, 4);
  xml += buildTag('dscLocal', cat.dscLocal, 4);
  xml += buildTag('codSitGeradora', cat.codSitGeradora, 4);
  xml += buildTag('iniciatCAT', cat.iniciatCAT, 4);
  xml += buildTag('obsCAT', cat.obsCAT, 4);
  xml += buildTag('ultDiaTrab', cat.ultDiaTrab, 4);
  xml += buildTag('houveAfast', cat.houveAfast, 4);
  xml += buildTag('dtIniAfast', cat.dtIniAfast, 4);
  xml += '      <localAcid>\n';
  xml += buildTag('tpLograd', cat.localAcid.tpLograd, 5);
  xml += buildTag('dscLograd', cat.localAcid.dscLograd, 5);
  xml += buildTag('nrLograd', cat.localAcid.nrLograd, 5);
  xml += buildTag('bairro', cat.localAcid.bairro, 5);
  xml += buildTag('cep', cat.localAcid.cep, 5);
  xml += buildTag('codMunic', cat.localAcid.codMunic, 5);
  xml += buildTag('uf', cat.localAcid.uf, 5);
  xml += buildTag('pais', cat.localAcid.pais, 5);
  xml += '      </localAcid>\n';
  xml += '      <parteAtingida>\n';
  xml += buildTag('codParteAting', cat.parteAtingida.codParteAting, 5);
  xml += buildTag('lateralidade', cat.parteAtingida.lateralidade, 5);
  xml += '      </parteAtingida>\n';
  xml += '      <agenteCausador>\n';
  xml += buildTag('codAgntCausador', cat.agenteCausador.codAgntCausador, 5);
  xml += '      </agenteCausador>\n';
  if (cat.catOrigem) {
    xml += '      <catOrigem>\n';
    xml += buildTag('nrRecCatOrig', cat.catOrigem.nrRecCatOrig, 5);
    xml += '      </catOrigem>\n';
  }
  xml += '    </cat>\n';
  xml += '  </evtCAT>\n';
  xml += '</eSocial>';
  return xml;
}
