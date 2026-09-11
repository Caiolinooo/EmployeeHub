interface IdeEvento { indRetif?: number; nrRecibo?: string; tpAmb: number; procEmi: number; verProc: string; }
interface IdeEmpregador { tpInsc: number; nrInsc: string; }
interface IdeVinculo { cpfTrab: string; matricula: string; }
interface DetVerbas { codRubr: string; ideTabRubr: string; qtdRubr?: number; fatorRubr?: number; vrRubr: number; indApurIR?: number; }
interface DmDev { ideDmDev: string; indRRA?: 'S' | 'N'; infoRRA?: any; infoPerApur?: { ideEstabLot: { tpInsc: number; nrInsc: string; codLotacao: string; detVerbas: DetVerbas[]; }; } }
interface VerbasResc { dmDev: DmDev[]; }
interface InfoDeslig {
  mtvDeslig: string; dtDeslig: string; indPagtoAPI?: 'S' | 'N'; dtProjFimAPI?: string;
  pensAlim?: number; percAliment?: number; vrAlim?: number; observacoes?: string; verbasResc?: VerbasResc;
}
export interface DadosS2299 { ideEvento: IdeEvento; ideEmpregador: IdeEmpregador; ideVinculo: IdeVinculo; infoDeslig: InfoDeslig; }

function xmlEncode(str: string): string { return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;'); }
function buildTag(tag: string, value: string | number | undefined | null, indent: number): string { if (value === undefined || value === null || value === '') return ''; const spaces = '  '.repeat(indent); return `${spaces}<${tag}>${xmlEncode(String(value))}</${tag}>\n`; }

export function gerarS2299(dados: DadosS2299): string {
  const { ideEvento, ideEmpregador, ideVinculo, infoDeslig } = dados;
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtDeslig/v_S_01_03_00">\n';
  xml += '  <evtDeslig>\n';
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
  xml += '    <infoDeslig>\n';
  xml += buildTag('mtvDeslig', infoDeslig.mtvDeslig, 4);
  xml += buildTag('dtDeslig', infoDeslig.dtDeslig, 4);
  xml += buildTag('indPagtoAPI', infoDeslig.indPagtoAPI, 4);
  xml += buildTag('dtProjFimAPI', infoDeslig.dtProjFimAPI, 4);
  xml += buildTag('pensAlim', infoDeslig.pensAlim, 4);
  xml += buildTag('percAliment', infoDeslig.percAliment, 4);
  xml += buildTag('vrAlim', infoDeslig.vrAlim, 4);
  xml += buildTag('observacoes', infoDeslig.observacoes, 4);
  if (infoDeslig.verbasResc && infoDeslig.verbasResc.dmDev) {
    xml += '      <verbasResc>\n';
    for (const dm of infoDeslig.verbasResc.dmDev) {
      xml += '        <dmDev>\n';
      xml += buildTag('ideDmDev', dm.ideDmDev, 6);
      xml += buildTag('indRRA', dm.indRRA, 6);
      if (dm.infoPerApur) {
        xml += '          <infoPerApur>\n';
        xml += '            <ideEstabLot>\n';
        xml += buildTag('tpInsc', dm.infoPerApur.ideEstabLot.tpInsc, 8);
        xml += buildTag('nrInsc', dm.infoPerApur.ideEstabLot.nrInsc, 8);
        xml += buildTag('codLotacao', dm.infoPerApur.ideEstabLot.codLotacao, 8);
        if (dm.infoPerApur.ideEstabLot.detVerbas) {
          for (const verba of dm.infoPerApur.ideEstabLot.detVerbas) {
            xml += '              <detVerbas>\n';
            xml += buildTag('codRubr', verba.codRubr, 10);
            xml += buildTag('ideTabRubr', verba.ideTabRubr, 10);
            xml += buildTag('qtdRubr', verba.qtdRubr, 10);
            xml += buildTag('fatorRubr', verba.fatorRubr, 10);
            xml += buildTag('vrRubr', verba.vrRubr, 10);
            xml += buildTag('indApurIR', verba.indApurIR, 10);
            xml += '              </detVerbas>\n';
          }
        }
        xml += '            </ideEstabLot>\n';
        xml += '          </infoPerApur>\n';
      }
      xml += '        </dmDev>\n';
    }
    xml += '      </verbasResc>\n';
  }
  xml += '    </infoDeslig>\n';
  xml += '  </evtDeslig>\n';
  xml += '</eSocial>';
  return xml;
}
