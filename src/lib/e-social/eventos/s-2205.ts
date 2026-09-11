interface IdeEvento { indRetif?: number; nrRecibo?: string; tpAmb: number; procEmi: number; verProc: string; }
interface IdeEmpregador { tpInsc: number; nrInsc: string; }
interface IdeTrabalhador { cpfTrab: string; }
interface Endereco { brasil?: { tpLograd?: string; dscLograd: string; nrLograd: string; complemento?: string; bairro: string; cep: string; codMunic: string; uf: string; }; exterior?: { paisResid: string; dscLograd: string; nrLograd: string; complemento?: string; bairro?: string; nmCid: string; codPostal?: string; }; }
interface DadosTrabalhador { nmTrab: string; sexo: string; racaCor: number; estCiv?: number; grauInstr: string; nmSoc?: string; dtNascto: string; paisNac: string; endereco?: Endereco; }
interface Alteracao { dtAlteracao: string; dadosTrabalhador: DadosTrabalhador; }
export interface DadosS2205 { ideEvento: IdeEvento; ideEmpregador: IdeEmpregador; ideTrabalhador: IdeTrabalhador; alteracao: Alteracao; }

function xmlEncode(str: string): string { return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;'); }
function buildTag(tag: string, value: string | number | undefined | null, indent: number): string { if (value === undefined || value === null || value === '') return ''; const spaces = '  '.repeat(indent); return `${spaces}<${tag}>${xmlEncode(String(value))}</${tag}>\n`; }

export function gerarS2205(dados: DadosS2205): string {
  const { ideEvento, ideEmpregador, ideTrabalhador, alteracao } = dados;
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtAltCadastral/v_S_01_03_00">\n';
  xml += '  <evtAltCadastral>\n';
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
  xml += '    <ideTrabalhador>\n';
  xml += buildTag('cpfTrab', ideTrabalhador.cpfTrab, 4);
  xml += '    </ideTrabalhador>\n';
  xml += '    <alteracao>\n';
  xml += buildTag('dtAlteracao', alteracao.dtAlteracao, 4);
  xml += '      <dadosTrabalhador>\n';
  xml += buildTag('nmTrab', alteracao.dadosTrabalhador.nmTrab, 6);
  xml += buildTag('sexo', alteracao.dadosTrabalhador.sexo, 6);
  xml += buildTag('racaCor', alteracao.dadosTrabalhador.racaCor, 6);
  xml += buildTag('estCiv', alteracao.dadosTrabalhador.estCiv, 6);
  xml += buildTag('grauInstr', alteracao.dadosTrabalhador.grauInstr, 6);
  xml += buildTag('nmSoc', alteracao.dadosTrabalhador.nmSoc, 6);
  xml += buildTag('dtNascto', alteracao.dadosTrabalhador.dtNascto, 6);
  xml += buildTag('paisNac', alteracao.dadosTrabalhador.paisNac, 6);
  if (alteracao.dadosTrabalhador.endereco) {
    xml += '        <endereco>\n';
    if (alteracao.dadosTrabalhador.endereco.brasil) {
      xml += '          <brasil>\n';
      xml += buildTag('tpLograd', alteracao.dadosTrabalhador.endereco.brasil.tpLograd, 6);
      xml += buildTag('dscLograd', alteracao.dadosTrabalhador.endereco.brasil.dscLograd, 6);
      xml += buildTag('nrLograd', alteracao.dadosTrabalhador.endereco.brasil.nrLograd, 6);
      xml += buildTag('complemento', alteracao.dadosTrabalhador.endereco.brasil.complemento, 6);
      xml += buildTag('bairro', alteracao.dadosTrabalhador.endereco.brasil.bairro, 6);
      xml += buildTag('cep', alteracao.dadosTrabalhador.endereco.brasil.cep, 6);
      xml += buildTag('codMunic', alteracao.dadosTrabalhador.endereco.brasil.codMunic, 6);
      xml += buildTag('uf', alteracao.dadosTrabalhador.endereco.brasil.uf, 6);
      xml += '          </brasil>\n';
    } else if (alteracao.dadosTrabalhador.endereco.exterior) {
      xml += '          <exterior>\n';
      xml += buildTag('paisResid', alteracao.dadosTrabalhador.endereco.exterior.paisResid, 6);
      xml += buildTag('dscLograd', alteracao.dadosTrabalhador.endereco.exterior.dscLograd, 6);
      xml += buildTag('nrLograd', alteracao.dadosTrabalhador.endereco.exterior.nrLograd, 6);
      xml += buildTag('complemento', alteracao.dadosTrabalhador.endereco.exterior.complemento, 6);
      xml += buildTag('bairro', alteracao.dadosTrabalhador.endereco.exterior.bairro, 6);
      xml += buildTag('nmCid', alteracao.dadosTrabalhador.endereco.exterior.nmCid, 6);
      xml += buildTag('codPostal', alteracao.dadosTrabalhador.endereco.exterior.codPostal, 6);
      xml += '          </exterior>\n';
    }
    xml += '        </endereco>\n';
  }
  xml += '      </dadosTrabalhador>\n';
  xml += '    </alteracao>\n';
  xml += '  </evtAltCadastral>\n';
  xml += '</eSocial>';
  return xml;
}
