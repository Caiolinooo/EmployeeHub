import { gerarS2220, DadosS2220 } from './eventos/s-2220';
import { generateEventXML } from '@/services/eSocialService';

type TipoAso = 'ADMISSIONAL' | 'PERIODICO' | 'RETORNO' | 'MUDANCA' | 'DEMISSIONAL';
type ResultadoAso = 'APTO' | 'APTO_COM_RESTRICAO' | 'INAPTO';

export function getTipoAso(tipo: TipoAso): number {
  const mapa: Record<TipoAso, number> = {
    ADMISSIONAL: 0,
    PERIODICO: 1,
    RETORNO: 2,
    MUDANCA: 3,
    DEMISSIONAL: 9,
  };
  return mapa[tipo] ?? 1;
}

export function getResultadoAso(resultado: ResultadoAso): number {
  const mapa: Record<ResultadoAso, number> = {
    APTO: 1,
    APTO_COM_RESTRICAO: 1,
    INAPTO: 2,
  };
  return mapa[resultado] ?? 1;
}

export function gerarXMLEvento(codigoEvento: string, dados: Record<string, unknown>): string {
  if (codigoEvento === 'S-2220') {
    return gerarS2220(dados as unknown as DadosS2220);
  }
  return generateEventXML(codigoEvento, dados);
}

interface DadosS2200 {
  ideEvento: Record<string, unknown>;
  ideEmpregador: { tpInsc: number; nrInsc: string };
  ideTrabalhador: { cpfTrab: string; nmTrab?: string };
}

function gerarS2200(dados: Record<string, unknown>): string {
  const d = dados as unknown as DadosS2200;
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<eSocial>\n  <evtAdmissao>\n';
  xml += '    <ideEvento>\n';
  if (d.ideEvento?.tpAmb !== undefined) xml += `      <tpAmb>${d.ideEvento.tpAmb}</tpAmb>\n`;
  if (d.ideEvento?.procEmi !== undefined) xml += `      <procEmi>${d.ideEvento.procEmi}</procEmi>\n`;
  if (d.ideEvento?.verProc) xml += `      <verProc>${d.ideEvento.verProc}</verProc>\n`;
  xml += '    </ideEvento>\n';
  xml += '    <ideEmpregador>\n';
  xml += `      <tpInsc>${d.ideEmpregador?.tpInsc ?? 1}</tpInsc>\n`;
  const nrInscFormatted = (d.ideEmpregador?.tpInsc ?? 1) === 1
    ? (d.ideEmpregador?.nrInsc ?? '').replace(/\D/g, '').substring(0, 8)
    : (d.ideEmpregador?.nrInsc ?? '');
  xml += `      <nrInsc>${nrInscFormatted}</nrInsc>\n`;
  xml += '    </ideEmpregador>\n';
  xml += '    <ideTrabalhador>\n';
  xml += `      <cpfTrab>${d.ideTrabalhador?.cpfTrab ?? ''}</cpfTrab>\n`;
  if (d.ideTrabalhador?.nmTrab) xml += `      <nmTrab>${d.ideTrabalhador.nmTrab}</nmTrab>\n`;
  xml += '    </ideTrabalhador>\n';
  xml += '  </evtAdmissao>\n</eSocial>';
  return xml;
}

interface DadosS2300 {
  cpfTrab: string;
  cnpjTerceiro?: string;
}

function gerarS2300(dados: Record<string, unknown>): string {
  const d = dados as unknown as DadosS2300;
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<eSocial>\n  <evtTSVInicio>\n';
  xml += '    <ideTrabalhador>\n';
  xml += `      <cpfTrab>${d.cpfTrab ?? ''}</cpfTrab>\n`;
  xml += '    </ideTrabalhador>\n';
  if (d.cnpjTerceiro) {
    xml += '    <infoTerceiro>\n';
    xml += `      <cnpjTerc>${d.cnpjTerceiro}</cnpjTerc>\n`;
    xml += '    </infoTerceiro>\n';
  }
  xml += '  </evtTSVInicio>\n</eSocial>';
  return xml;
}

interface DadosS2399 {
  cpfTrab: string;
  dtDeslig: string;
}

function gerarS2399(dados: Record<string, unknown>): string {
  const d = dados as unknown as DadosS2399;
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<eSocial>\n  <evtTSVTermino>\n';
  xml += '    <ideTrabalhador>\n';
  xml += `      <cpfTrab>${d.cpfTrab ?? ''}</cpfTrab>\n`;
  xml += '    </ideTrabalhador>\n';
  if (d.dtDeslig) {
    xml += '    <infoTSVTermino>\n';
    xml += `      <dtTerm>${d.dtDeslig}</dtTerm>\n`;
    xml += '    </infoTSVTermino>\n';
  }
  xml += '  </evtTSVTermino>\n</eSocial>';
  return xml;
}

interface DadosS3000 {
  nrRecibo: string;
  tpEv: string;
}

function gerarS3000(dados: Record<string, unknown>): string {
  const d = dados as unknown as DadosS3000;
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<eSocial>\n  <evtRemocao>\n';
  xml += '    <ideEvento>\n';
  if (d.nrRecibo) xml += `      <nrRecibo>${d.nrRecibo}</nrRecibo>\n`;
  xml += '    </ideEvento>\n';
  if (d.tpEv) xml += `    <infoRemocao><tpEv>${d.tpEv}</tpEv></infoRemocao>\n`;
  xml += '  </evtRemocao>\n</eSocial>';
  return xml;
}

function gerarS2240(dados: Record<string, unknown>): string {
  const d = dados as any;
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtExpRisco/v_S_01_03_00">\n';
  xml += '  <evtExpRisco>\n';

  xml += '    <ideEvento>\n';
  xml += `      <indRetif>${d.ideEvento?.indRetif ?? 1}</indRetif>\n`;
  if (d.ideEvento?.nrRecibo) xml += `      <nrRecibo>${d.ideEvento.nrRecibo}</nrRecibo>\n`;
  xml += `      <tpAmb>${d.ideEvento?.tpAmb ?? 2}</tpAmb>\n`;
  xml += `      <procEmi>${d.ideEvento?.procEmi ?? 1}</procEmi>\n`;
  xml += `      <verProc>${d.ideEvento?.verProc ?? '1.0.0'}</verProc>\n`;
  xml += '    </ideEvento>\n';

  xml += '    <ideEmpregador>\n';
  xml += `      <tpInsc>${d.ideEmpregador?.tpInsc ?? 1}</tpInsc>\n`;
  const nrInscFormatted = (d.ideEmpregador?.nrInsc ?? '').replace(/\D/g, '').substring(0, 8);
  xml += `      <nrInsc>${nrInscFormatted}</nrInsc>\n`;
  xml += '    </ideEmpregador>\n';

  xml += '    <ideVinculo>\n';
  xml += `      <cpfTrab>${d.ideTrabalhador?.cpfTrab || d.cpfTrab || ''}</cpfTrab>\n`;
  const matriculaVal = d.matricula_esocial || d.ideTrabalhador?.matricula_esocial || d.matricula || d.ideTrabalhador?.matricula;
  if (matriculaVal) {
    xml += `      <matricula>${matriculaVal}</matricula>\n`;
  }
  xml += '    </ideVinculo>\n';

  xml += '    <infoExpRisco>\n';
  xml += `      <dtIniCondicao>${d.dtIniCondicao || new Date().toISOString().split('T')[0]}</dtIniCondicao>\n`;
  
  xml += '      <infoAmb>\n';
  xml += `        <localAmb>${d.localAmb ?? 1}</localAmb>\n`;
  xml += `        <dscAmb>${d.dscAmb || 'Ambiente Geral'}</dscAmb>\n`;
  xml += `        <tpInsc>1</tpInsc>\n`;
  xml += `        <nrInsc>${(d.ideEmpregador?.nrInsc || d.cnpj || '').replace(/\D/g, '')}</nrInsc>\n`;
  xml += '      </infoAmb>\n';

  xml += '      <infoAtiv>\n';
  xml += `        <dscAtivDes>${d.dscAtivDes || d.condicoesAmbiente || ''}</dscAtivDes>\n`;
  xml += '      </infoAtiv>\n';

  const riscos = d.riscos || [];
  if (riscos.length > 0) {
    for (const r of riscos) {
      xml += '      <agNoc>\n';
      xml += `        <codAgNoc>${r.codAgNoc}</codAgNoc>\n`;
      xml += `        <tpAval>${r.tpAval || 1}</tpAval>\n`;
      if (r.codAgNoc !== '09.01.001') {
        xml += '        <epcEpi>\n';
        xml += `          <utilizEPC>${r.utilizEPC || 0}</utilizEPC>\n`;
        if (r.utilizEPC === '2') {
          xml += `          <eficEpc>${r.eficEpc || 'S'}</eficEpc>\n`;
        }
        xml += `          <utilizEPI>${r.utilizEPI || 0}</utilizEPI>\n`;
        if (r.utilizEPI === '2') {
          xml += `          <eficEpi>${r.eficEpi || 'S'}</eficEpi>\n`;
          if (r.caEPI) {
            xml += '          <epi>\n';
            xml += `            <docAval>${r.caEPI}</docAval>\n`;
            xml += '          </epi>\n';
          }
        }
        xml += '        </epcEpi>\n';
      }
      xml += '      </agNoc>\n';
    }
  } else {
    const cod = d.codFatRisco || d.codAgNoc || '09.01.001';
    xml += '      <agNoc>\n';
    xml += `        <codAgNoc>${cod}</codAgNoc>\n`;
    xml += `        <tpAval>1</tpAval>\n`;
    if (cod !== '09.01.001') {
      const epiEficaz = d.epiEficaz || 'NA';
      const utilEpi = epiEficaz === 'NA' ? 0 : 2;
      xml += '        <epcEpi>\n';
      xml += `          <utilizEPC>0</utilizEPC>\n`;
      xml += `          <utilizEPI>${utilEpi}</utilizEPI>\n`;
      if (utilEpi === 2) {
        xml += `          <eficEpi>${epiEficaz === 'S' ? 'S' : 'N'}</eficEpi>\n`;
      }
      xml += '        </epcEpi>\n';
    }
    xml += '      </agNoc>\n';
  }

  const r = d.respReg;
  if (r && r.cpfResp) {
    xml += '      <respReg>\n';
    xml += `        <cpfResp>${r.cpfResp}</cpfResp>\n`;
    xml += `        <ideOC>${r.ideOC}</ideOC>\n`;
    xml += `        <nrOC>${r.nrOC}</nrOC>\n`;
    xml += `        <ufOC>${r.ufOC}</ufOC>\n`;
    xml += '      </respReg>\n';
  } else {
    xml += '      <respReg>\n';
    xml += `        <cpfResp>00000000000</cpfResp>\n`;
    xml += `        <ideOC>1</ideOC>\n`;
    xml += `        <nrOC>00000</nrOC>\n`;
    xml += `        <ufOC>RJ</ufOC>\n`;
    xml += '      </respReg>\n';
  }

  xml += '    </infoExpRisco>\n';
  xml += '  </evtExpRisco>\n';
  xml += '</eSocial>';
  return xml;
}
