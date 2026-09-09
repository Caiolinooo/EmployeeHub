import { sanitizeTsNome } from '../ts-nome';

interface IdeEvento {
  indRetif?: number;
  nrRecibo?: string;
  tpAmb?: number;
  procEmi?: number;
  verProc?: string;
}

interface IdeEmpregador {
  tpInsc?: number;
  nrInsc: string;
}

interface IdeVinculo {
  cpfTrab: string;
  matricula?: string;
}

interface Medico {
  nmMed: string;
  nrCRM: string;
  ufCRM: string;
}

interface ExameRealizado {
  dtExm: string;
  procRealizado: string;
  obsExm?: string;
  obsProc?: string;
  ordExame?: number | string;
  ordem?: number | string;
}

interface ASO {
  dtAso: string;
  resAso: number | string;
  exames?: ExameRealizado[];
  exames_realizados?: ExameRealizado[];
  medico?: Medico;
}

interface RespMonit {
  cpfResp?: string;
  nmResp: string;
  nrCRM: string;
  ufCRM: string;
}

interface ExMedOcup {
  tpExameOcup?: number | string;
  tipoExame?: number | string;
  aso: ASO;
  medico?: Medico;
  respMonit?: RespMonit;
}

export interface DadosS2220 {
  ideEvento?: IdeEvento;
  ideEmpregador?: IdeEmpregador;
  ideVinculo?: IdeVinculo;
  ideTrabalhador?: { cpfTrab: string; nmTrab?: string; nisTrab?: string };
  exMedOcup?: ExMedOcup;
  exameOcupacional?: any;
  // Flat properties support
  cpf?: string;
  cpfTrab?: string;
  matricula?: string;
  matricula_esocial?: string;
  cnpj?: string;
  nrInsc?: string;
  tipoExame?: any;
  tpExameOcup?: any;
  resultado?: any;
  resAso?: any;
  dataRealizacao?: string;
  data_realizacao?: string;
  dtAso?: string;
  medico_nome?: string;
  nmMed?: string;
  medico_crm?: string;
  nrCRM?: string;
  medico_uf?: string;
  ufCRM?: string;
  medico_pcmso_nome?: string;
  medico_pcmso_crm?: string;
  medico_pcmso_uf?: string;
  exames?: ExameRealizado[];
  exames_realizados?: ExameRealizado[];
  [key: string]: any;
}

function xmlEncode(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildTag(tag: string, value: string | number | undefined | null, indent: number): string {
  if (value === undefined || value === null || value === '') return '';
  const spaces = '  '.repeat(indent);
  return `${spaces}<${tag}>${xmlEncode(String(value))}</${tag}>\n`;
}

function normalizeDate(raw: string | undefined | null): string {
  if (!raw) return '';
  const s = String(raw).trim();
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    if (Number(m) >= 1 && Number(m) <= 12 && Number(d) >= 1 && Number(d) <= 31) return `${y}-${m}-${d}`;
    if (Number(d) >= 1 && Number(d) <= 12 && Number(m) >= 1 && Number(m) <= 31) return `${y}-${d}-${m}`;
    return '';
  }
  const brMatch = s.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})/);
  if (brMatch) {
    const [, d, m, y] = brMatch;
    if (Number(m) >= 1 && Number(m) <= 12 && Number(d) >= 1 && Number(d) <= 31) return `${y}-${m}-${d}`;
    return '';
  }
  const tsMatch = s.match(/^(\d{4}-\d{2}-\d{2})T/);
  if (tsMatch) return normalizeDate(tsMatch[1]);
  return '';
}

export function gerarS2220(dados: DadosS2220): string {
  const d: any = dados || {};
  const esp = d.dadosEspecificos || d;

  const ideEvento = d.ideEvento || {};
  const ideEmpregador = d.ideEmpregador || {};
  const exMed = d.exMedOcup || d.exameOcupacional || {};
  const aso = exMed.aso || {};

  const cnpj = (d.cnpj || ideEmpregador.nrInsc || d.cnpj_empregador || '17784306000189').replace(/\D/g, '');
  const nrInscFormatted = (ideEmpregador.tpInsc ?? 1) === 1 ? cnpj.substring(0, 8) : cnpj;
  const cpfTrab = (d.cpf || d.cpfTrab || d.cpf_trabalhador || d.ideVinculo?.cpfTrab || d.ideTrabalhador?.cpfTrab || '').replace(/\D/g, '');
  const matricula = d.matricula || d.matricula_esocial || d.ideVinculo?.matricula || esp.matricula || esp.matricula_esocial || '';

  // tpExameOcup mapping
  let tpExameVal = exMed.tpExameOcup ?? exMed.tpExame ?? esp.tipoExame ?? esp.tpExameOcup ?? 1;
  if (typeof tpExameVal === 'string') {
    const t = tpExameVal.toLowerCase().trim();
    if (t.includes('admiss')) tpExameVal = 0;
    else if (t.includes('period') || t.includes('períod')) tpExameVal = 1;
    else if (t.includes('retorno')) tpExameVal = 2;
    else if (t.includes('mudan')) tpExameVal = 3;
    else if (t.includes('pontual') || t.includes('monitor')) tpExameVal = 4;
    else if (t.includes('demiss')) tpExameVal = 9;
    else {
      const parsed = parseInt(tpExameVal, 10);
      tpExameVal = !isNaN(parsed) ? parsed : 1;
    }
  }

  // resAso mapping
  let resAsoVal = aso.resAso ?? esp.resultado ?? esp.resAso ?? 1;
  if (typeof resAsoVal === 'string') {
    const r = resAsoVal.toLowerCase().trim();
    if (r.includes('inapto') || r === '2') resAsoVal = 2;
    else resAsoVal = 1;
  }

  const dtAsoRaw = aso.dtAso || esp.data_realizacao || esp.dataRealizacao || esp.dtAso || esp.data_aso || esp.dataAso || new Date().toISOString().split('T')[0];
  const dtAsoFinal = normalizeDate(dtAsoRaw) || new Date().toISOString().split('T')[0];

  const cnpjIdPart = cnpj.substring(0, 8).padEnd(14, '0');
  const eventId = `ID1${cnpjIdPart}${new Date().toISOString().replace(/[-:T.Z]/g, '').substring(0, 14)}${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`;

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtMonit/v_S_01_03_00">\n';
  xml += `  <evtMonit Id="${eventId}">\n`;

  // ideEvento
  xml += '    <ideEvento>\n';
  xml += buildTag('indRetif', ideEvento.indRetif ?? d.indRetif ?? 1, 3);
  if (ideEvento.nrRecibo || d.nrRecibo) xml += buildTag('nrRecibo', ideEvento.nrRecibo || d.nrRecibo, 3);
  xml += buildTag('tpAmb', ideEvento.tpAmb ?? d.tpAmb ?? 2, 3);
  xml += buildTag('procEmi', ideEvento.procEmi ?? 1, 3);
  xml += buildTag('verProc', ideEvento.verProc ?? '5.14.0', 3);
  xml += '    </ideEvento>\n';

  // ideEmpregador
  xml += '    <ideEmpregador>\n';
  xml += buildTag('tpInsc', ideEmpregador.tpInsc ?? 1, 3);
  xml += buildTag('nrInsc', nrInscFormatted, 3);
  xml += '    </ideEmpregador>\n';

  // ideVinculo
  xml += '    <ideVinculo>\n';
  xml += buildTag('cpfTrab', cpfTrab, 3);
  if (matricula) {
    xml += buildTag('matricula', matricula, 3);
  }
  xml += '    </ideVinculo>\n';

  // exMedOcup
  xml += '    <exMedOcup>\n';
  xml += buildTag('tpExameOcup', tpExameVal, 3);

  // aso
  xml += '      <aso>\n';
  xml += buildTag('dtAso', dtAsoFinal, 4);
  xml += buildTag('resAso', resAsoVal, 4);

  const isAdmissional = tpExameVal === 0;
  const calculatedOrdExame = isAdmissional ? 1 : 2;

  const rawExames = aso.exames || aso.exames_realizados || esp.exames_realizados || esp.exames || exMed.exames || [];
  const getCodProcFromNome = (nome: string): string => {
    const n = (nome || '').toUpperCase().trim();
    if (n.includes('ACUIDADE')) return '0281';
    if (n.includes('AUDIOMETRIA')) return '0054';
    if (n.includes('ELETROCARDIOGRAMA') || n.includes('ECG')) return '0295';
    if (n.includes('ELETROENCEFALOGRAMA') || n.includes('EEG')) return '0317';
    if (n.includes('ESPIROMETRIA')) return '0216';
    if (n.includes('GLICOSE')) return '1406';
    if (n.includes('HEMOGRAMA')) return '1475';
    if (n.includes('RAIO X') || n.includes('RX')) return '0626';
    if (n.includes('TIPO E FATOR RH') || n.includes('FATOR RH')) return '1481';
    return '0999';
  };

  if (Array.isArray(rawExames) && rawExames.length > 0) {
    const seenExames = new Set<string>();
    for (const exame of rawExames) {
      const cod = (exame.codProc || exame.procRealizado || getCodProcFromNome(exame.nome || ''));
      const dt = normalizeDate(exame.data || exame.dtExm || dtAsoFinal) || dtAsoFinal;
      const key = `${dt}-${cod}`;
      if (!seenExames.has(key)) {
        seenExames.add(key);

        let ordExameVal = calculatedOrdExame;
        const ex = exame as any;
        if (ex.ordExame !== undefined && ex.ordExame !== null) {
          if (typeof ex.ordExame === 'string') {
            const ordStr = ex.ordExame.toLowerCase();
            if (ordStr.includes('inicial') || ordStr === '1') ordExameVal = 1;
            else if (ordStr.includes('sequencial') || ordStr === '2') ordExameVal = 2;
          } else if (typeof ex.ordExame === 'number') {
            ordExameVal = ex.ordExame;
          }
        } else if (ex.ordem !== undefined && ex.ordem !== null) {
          if (typeof ex.ordem === 'string') {
            const ordStr = ex.ordem.toLowerCase();
            if (ordStr.includes('inicial') || ordStr === '1') ordExameVal = 1;
            else if (ordStr.includes('sequencial') || ordStr === '2') ordExameVal = 2;
          } else if (typeof ex.ordem === 'number') {
            ordExameVal = ex.ordem;
          }
        }

        xml += '        <exame>\n';
        xml += buildTag('dtExm', dt, 5);
        xml += buildTag('procRealizado', cod, 5);
        xml += buildTag('obsProc', ex.obs || ex.obsExm || ex.obsProc || 'Procedimento realizado conforme protocolo medico', 5);
        xml += buildTag('ordExame', ordExameVal, 5);
        xml += '        </exame>\n';
      }
    }
  } else {
    xml += '        <exame>\n';
    xml += buildTag('dtExm', dtAsoFinal, 5);
    xml += buildTag('procRealizado', esp.codProc || '0999', 5);
    xml += buildTag('obsProc', 'Procedimento realizado conforme protocolo medico', 5);
    xml += buildTag('ordExame', calculatedOrdExame, 5);
    xml += '        </exame>\n';
  }

  // medico
  const medicoObj = aso.medico || exMed.medico || {};
  const nmMedBruto = medicoObj.nmMed
    || (typeof esp.medico === 'string' ? esp.medico : '')
    || esp.medico_nome
    || esp.nmMed
    || esp.medicoNome
    || '';
  const nmMed = sanitizeTsNome(String(nmMedBruto || ''));
  const nrCRM = String(medicoObj.nrCRM || esp.crm || esp.medico_crm || esp.nrCRM || '').replace(/\D/g, '');
  const ufCRM = String(medicoObj.ufCRM || esp.uf || esp.medico_uf || esp.ufCRM || 'RJ').trim().toUpperCase();

  xml += '        <medico>\n';
  xml += buildTag('nmMed', nmMed, 5);
  xml += buildTag('nrCRM', nrCRM, 5);
  xml += buildTag('ufCRM', ufCRM, 5);
  xml += '        </medico>\n';

  xml += '      </aso>\n';

  // respMonit (opcional)
  const resp = exMed.respMonit || {};
  const nmResp = sanitizeTsNome(String(resp.nmResp || esp.medico_pcmso_nome || esp.medicoPcmsoNome || ''));
  if (nmResp) {
    const nrCrmResp = String(resp.nrCRM || esp.medico_pcmso_crm || esp.medicoPcmsoCrm || '').replace(/\D/g, '');
    const ufCrmResp = String(resp.ufCRM || esp.medico_pcmso_uf || esp.medicoPcmsoUf || 'RJ').trim().toUpperCase();
    const cpfResp = resp.cpfResp ? String(resp.cpfResp).replace(/\D/g, '') : undefined;

    xml += '      <respMonit>\n';
    if (cpfResp) xml += buildTag('cpfResp', cpfResp, 4);
    xml += buildTag('nmResp', nmResp, 4);
    xml += buildTag('nrCRM', nrCrmResp, 4);
    xml += buildTag('ufCRM', ufCrmResp, 4);
    xml += '      </respMonit>\n';
  }

  xml += '    </exMedOcup>\n';
  xml += '  </evtMonit>\n';
  xml += '</eSocial>';

  return xml;
}
