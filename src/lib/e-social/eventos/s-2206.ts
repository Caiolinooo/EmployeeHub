interface IdeEvento { indRetif?: number; nrRecibo?: string; tpAmb: number; procEmi: number; verProc: string; }
interface IdeEmpregador { tpInsc: number; nrInsc: string; }
interface IdeVinculo { cpfTrab: string; matricula: string; }
interface Cargo { codCargo?: string; nmCargo?: string; codCBO?: string; }
interface Salario { vrSalFx: number | string; undSalFixo: number; }
interface Duracao { tpContr: number; }
interface LocalTrab { locLotacao: { tpLotacao: number; codLotacao: string; }; }
interface Vinculo { cargo?: Cargo; salario?: Salario; duracao?: Duracao; localTrab?: LocalTrab; }
interface AltContratual { dtAlteracao: string; vinculo: Vinculo; }
export interface DadosS2206 { ideEvento: IdeEvento; ideEmpregador: IdeEmpregador; ideVinculo: IdeVinculo; altContratual: AltContratual; }

function xmlEncode(str: string): string { return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;'); }
function buildTag(tag: string, value: string | number | undefined | null, indent: number): string { if (value === undefined || value === null || value === '') return ''; const spaces = '  '.repeat(indent); return `${spaces}<${tag}>${xmlEncode(String(value))}</${tag}>\n`; }

export function gerarS2206(dados: DadosS2206): string {
  const { ideEvento, ideEmpregador, ideVinculo, altContratual } = dados;
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtAltContratual/v_S_01_03_00">\n';
  xml += '  <evtAltContratual>\n';
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
  xml += '    <altContratual>\n';
  xml += buildTag('dtAlteracao', altContratual.dtAlteracao, 4);
  xml += '      <vinculo>\n';
  if (altContratual.vinculo.cargo) {
    xml += '        <cargo>\n';
    xml += buildTag('codCargo', altContratual.vinculo.cargo.codCargo, 5);
    xml += buildTag('nmCargo', altContratual.vinculo.cargo.nmCargo, 5);
    xml += buildTag('codCBO', altContratual.vinculo.cargo.codCBO, 5);
    xml += '        </cargo>\n';
  }
  if (altContratual.vinculo.salario) {
    xml += '        <salario>\n';
    xml += buildTag('vrSalFx', altContratual.vinculo.salario.vrSalFx, 5);
    xml += buildTag('undSalFixo', altContratual.vinculo.salario.undSalFixo, 5);
    xml += '        </salario>\n';
  }
  if (altContratual.vinculo.duracao) {
    xml += '        <duracao>\n';
    xml += buildTag('tpContr', altContratual.vinculo.duracao.tpContr, 5);
    xml += '        </duracao>\n';
  }
  if (altContratual.vinculo.localTrab) {
    xml += '        <localTrab>\n';
    xml += '          <locLotacao>\n';
    xml += buildTag('tpLotacao', altContratual.vinculo.localTrab.locLotacao.tpLotacao, 6);
    xml += buildTag('codLotacao', altContratual.vinculo.localTrab.locLotacao.codLotacao, 6);
    xml += '          </locLotacao>\n';
    xml += '        </localTrab>\n';
  }
  xml += '      </vinculo>\n';
  xml += '    </altContratual>\n';
  xml += '  </evtAltContratual>\n';
  xml += '</eSocial>';
  return xml;
}
