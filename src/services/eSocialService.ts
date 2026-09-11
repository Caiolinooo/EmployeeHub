import { supabaseAdmin } from '@/lib/supabase';
import { alinharDataExamePtBr, normalizeEsocialDate } from '@/lib/e-social/esocial-date';
import { sanitizeTsNome } from '@/lib/e-social/ts-nome';

export interface ESocialEvento {
  id: string;
  evento_codigo: string;
  evento_nome?: string;
  cpf_trabalhador?: string;
  cnpj_empregador?: string;
  matricula?: string;
  dados_evento: any;
  xml_gerado?: string;
  modulo_origem: string;
  entidade_origem_id?: string;
  entidade_origem_tipo?: string;
  status: string;
  revisado_por?: string;
  revisado_em?: string;
  comentario_revisao?: string;
  protocolo_envio?: string;
  numero_recibo?: string;
  data_envio?: string;
  data_processamento?: string;
  retorno_completo?: any;
  erros_processamento?: any;
  tentativas_envio?: number;
  ultimo_erro?: string;
  created_at: string;
  updated_at: string;
}

export interface ESocialCatalogoEvento {
  id: string;
  codigo_evento: string;
  nome: string;
  descricao?: string;
  grupo?: string;
  versao_leiaute?: string;
  prazo_envio_dias?: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface ESocialCertificado {
  id: string;
  nome: string;
  emissor?: string;
  valido_ate?: string;
  arquivo_path?: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface ESocialConfiguracao {
  chave: string;
  valor: any;
  descricao?: string;
  updated_at: string;
}

export interface ESocialEnvioLog {
  id: string;
  evento_id: string;
  acao: 'envio' | 'consulta' | 'retorno' | 'cancelamento' | 'geracao_xml';
  request_body?: string;
  response_body?: string;
  status_code?: number;
  sucesso: boolean;
  mensagem_erro?: string;
  created_at: string;
}

export const STATUS_EVENTO = {
  RASCUNHO: 'rascunho',
  PENDENTE_REVISAO: 'pendente_revisao',
  REVISAO_APROVADO: 'revisao_aprovado',
  REVISAO_REJEITADO: 'revisao_rejeitado',
  FILA_ENVIO: 'fila_envio',
  ENVIANDO: 'enviando',
  ENVIADO: 'enviado',
  PROCESSADO: 'processado',
  ERRO: 'erro',
  DEVOLVIDO: 'devolvido',
} as const;

export async function listEventos(filters?: {
  status?: string;
  codigo?: string;
  modulo_origem?: string;
  cpf_trabalhador?: string;
  cnpj_empregador?: string;
}): Promise<{ eventos: ESocialEvento[]; total: number }> {
  let query = supabaseAdmin
    .from('esocial_eventos')
    .select('*, esocial_eventos_catalogo!evento_codigo(nome)', { count: 'exact' });

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.codigo) {
    query = query.eq('evento_codigo', filters.codigo);
  }
  if (filters?.modulo_origem) {
    query = query.eq('modulo_origem', filters.modulo_origem);
  }
  if (filters?.cpf_trabalhador) {
    query = query.eq('cpf_trabalhador', filters.cpf_trabalhador);
  }
  if (filters?.cnpj_empregador) {
    query = query.eq('cnpj_empregador', filters.cnpj_empregador);
  }

  query = query.order('created_at', { ascending: false });

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Erro ao listar eventos: ${error.message}`);
  }

  const eventos = (data || []).map((item: any) => ({
    ...item,
    evento_nome: item.esocial_eventos_catalogo?.nome || null,
  }));

  return { eventos, total: count || 0 };
}

export async function getEventoById(id: string): Promise<ESocialEvento | null> {
  const { data, error } = await supabaseAdmin
    .from('esocial_eventos')
    .select('*, esocial_eventos_catalogo!evento_codigo(*)')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao buscar evento: ${error.message}`);
  }

  return data;
}

export async function createEvento(evento: {
  evento_codigo: string;
  cpf_trabalhador?: string;
  cnpj_empregador?: string;
  matricula?: string;
  dados_evento: any;
  status?: string;
  modulo_origem?: string;
  entidade_origem_id?: string;
  entidade_origem_tipo?: string;
  protocolo_envio?: string | null;
  numero_recibo?: string | null;
}): Promise<ESocialEvento> {
  const { data, error } = await supabaseAdmin
    .from('esocial_eventos')
    .insert({
      evento_codigo: evento.evento_codigo,
      cpf_trabalhador: evento.cpf_trabalhador || null,
      cnpj_empregador: evento.cnpj_empregador || null,
      matricula: evento.matricula || null,
      dados_evento: evento.dados_evento,
      status: evento.status || STATUS_EVENTO.RASCUNHO,
      modulo_origem: evento.modulo_origem || 'manual',
      entidade_origem_id: evento.entidade_origem_id || null,
      entidade_origem_tipo: evento.entidade_origem_tipo || null,
      protocolo_envio: evento.protocolo_envio || null,
      numero_recibo: evento.numero_recibo || null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao criar evento: ${error.message}`);
  }

  return data;
}

export async function updateEvento(id: string, updates: {
  dados_evento?: any;
  status?: string;
  xml_gerado?: string;
  protocolo_envio?: string;
  numero_recibo?: string;
  erros_processamento?: any;
  ultimo_erro?: string;
  revisado_por?: string;
  revisado_em?: string;
  enviado_em?: string;
  comentario_revisao?: string;
  matricula?: string;
  updated_at?: string;
}): Promise<ESocialEvento> {
  const updateData: any = { updated_at: updates.updated_at || new Date().toISOString() };

  if (updates.dados_evento !== undefined) updateData.dados_evento = updates.dados_evento;
  if (updates.status !== undefined) updateData.status = updates.status;
  if (updates.xml_gerado !== undefined) updateData.xml_gerado = updates.xml_gerado;
  if (updates.protocolo_envio !== undefined) updateData.protocolo_envio = updates.protocolo_envio;
  if (updates.numero_recibo !== undefined) updateData.numero_recibo = updates.numero_recibo;
  if (updates.erros_processamento !== undefined) updateData.erros_processamento = updates.erros_processamento;
  if (updates.ultimo_erro !== undefined) updateData.ultimo_erro = updates.ultimo_erro;
  if (updates.revisado_por !== undefined) updateData.revisado_por = updates.revisado_por;
  if (updates.revisado_em !== undefined) updateData.revisado_em = updates.revisado_em;
  if (updates.enviado_em !== undefined) updateData.enviado_em = updates.enviado_em;
  if (updates.comentario_revisao !== undefined) updateData.comentario_revisao = updates.comentario_revisao;
  if (updates.matricula !== undefined) updateData.matricula = updates.matricula;

  const { data, error } = await supabaseAdmin
    .from('esocial_eventos')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao atualizar evento: ${error.message}`);
  }

  return data;
}

export async function deleteEvento(id: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('esocial_eventos')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Erro ao deletar evento: ${error.message}`);
  }
}

export async function listCatalogo(): Promise<ESocialCatalogoEvento[]> {
  const { data, error } = await supabaseAdmin
    .from('esocial_eventos_catalogo')
    .select('*')
    .eq('ativo', true)
    .order('codigo_evento', { ascending: true });

  if (error) {
    throw new Error(`Erro ao listar catálogo: ${error.message}`);
  }

  return data || [];
}

export async function listCertificados(): Promise<ESocialCertificado[]> {
  const { data, error } = await supabaseAdmin
    .from('esocial_certificados')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Erro ao listar certificados: ${error.message}`);
  }

  return data || [];
}

export async function createCertificado(certificado: {
  nome: string;
  emissor?: string;
  valido_ate?: string;
  arquivo_path?: string;
  senha?: string;
}): Promise<ESocialCertificado> {
  const { data, error } = await supabaseAdmin
    .from('esocial_certificados')
    .insert({
      nome: certificado.nome,
      emissor: certificado.emissor || null,
      valido_ate: certificado.valido_ate || null,
      arquivo_path: certificado.arquivo_path || null,
      ativo: false,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao criar certificado: ${error.message}`);
  }

  return data;
}

export async function getActiveCertificate(): Promise<ESocialCertificado | null> {
  const { data, error } = await supabaseAdmin
    .from('esocial_certificados')
    .select('*')
    .eq('ativo', true)
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao buscar certificado ativo: ${error.message}`);
  }

  return data;
}

export async function getConfiguracoes(): Promise<ESocialConfiguracao[]> {
  const { data, error } = await supabaseAdmin
    .from('esocial_configuracoes')
    .select('*')
    .order('chave', { ascending: true });

  if (error) {
    throw new Error(`Erro ao buscar configurações: ${error.message}`);
  }

  return data || [];
}

export async function upsertConfiguracao(chave: string, valor: any, descricao?: string): Promise<ESocialConfiguracao> {
  const { data, error } = await supabaseAdmin
    .from('esocial_configuracoes')
    .upsert({
      chave,
      valor,
      descricao: descricao || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'chave' })
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao salvar configuração: ${error.message}`);
  }

  return data;
}

export async function upsertConfiguracoes(configs: { chave: string; valor: any; descricao?: string }[]): Promise<ESocialConfiguracao[]> {
  const records = configs.map(c => ({
    chave: c.chave,
    valor: c.valor,
    descricao: c.descricao || null,
    updated_at: new Date().toISOString(),
  }));

  const { data, error } = await supabaseAdmin
    .from('esocial_configuracoes')
    .upsert(records, { onConflict: 'chave' })
    .select();

  if (error) {
    throw new Error(`Erro ao salvar configurações: ${error.message}`);
  }

  return data || [];
}

export async function logEnvio(log: {
  evento_id: string;
  acao: 'envio' | 'consulta' | 'retorno' | 'cancelamento' | 'geracao_xml' | 'validacao_api' | 'correcao_campos';
  request_body?: string;
  response_body?: string;
  status_code?: number;
  sucesso?: boolean;
  mensagem_erro?: string;
}): Promise<void> {
  const { error } = await supabaseAdmin
    .from('esocial_envios_log')
    .insert({
      evento_id: log.evento_id,
      acao: log.acao,
      request_body: log.request_body || null,
      response_body: log.response_body || null,
      status_code: log.status_code || null,
      sucesso: log.sucesso || false,
      mensagem_erro: log.mensagem_erro || null,
    });

  if (error) {
    console.error('Erro ao registrar log de envio:', error);
  }
}

function e(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function getEsp(dadosEvento: any): any {
  if (dadosEvento && dadosEvento.dadosEspecificos) {
    return { ...dadosEvento, ...dadosEvento.dadosEspecificos };
  }
  return dadosEvento || {};
}

function tag(t: string, content: string, indent = 0): string {
  const sp = '  '.repeat(indent);
  if (!content) return '';
  return `${sp}<${t}>${content}</${t}>\n`;
}

function block(t: string, inner: string, indent = 0): string {
  const sp = '  '.repeat(indent);
  if (!inner.trim()) return '';
  return `${sp}<${t}>\n${inner}${sp}</${t}>\n`;
}

function optTag(t: string, val: any, indent = 0): string {
  if (val === undefined || val === null || val === '') return '';
  return tag(t, e(String(val)), indent);
}

function normalizeDate(raw: string | undefined | null, ancora?: string): string {
  return ancora ? alinharDataExamePtBr(raw, ancora) : normalizeEsocialDate(raw);
}

export function generateEventXML(eventoCodigo: string, dadosEvento: any): string {
  const esp = getEsp(dadosEvento);
  let cnpj = (dadosEvento.cnpj || dadosEvento.cnpj_empregador || '').replace(/\D/g, '');
  if (!cnpj || cnpj.length < 8) {
    cnpj = '17784306000189'; // Default ABZ CNPJ fallback se faltar
  }
  const cpf = (dadosEvento.cpf || dadosEvento.cpf_trabalhador || '').replace(/\D/g, '');
  const indRetif = dadosEvento.indRetif || 1;
  const nrRecibo = dadosEvento.nrRecibo || '';
  const tpAmb = dadosEvento.tpAmb || 2;

  const tagMap: Record<string, string> = {
    'S-1000': 'evtInfoEmpregador',
    'S-2200': 'evtAdmissao',
    'S-2205': 'evtAltCadastral',
    'S-2206': 'evtAltContratual',
    'S-2210': 'evtCAT',
    'S-2220': 'evtMonit',
    'S-2230': 'evtAfastTemp',
    'S-2240': 'evtExpRisco',
    'S-2298': 'evtReintegr',
    'S-2299': 'evtDeslig',
    'S-2300': 'evtTSVInicio',
    'S-2399': 'evtTSVTermino',
    'S-3000': 'evtExclusao',
  };
  const evtTag = tagMap[eventoCodigo] || `evt${eventoCodigo.replace('-', '')}`;

  const header = `<?xml version="1.0" encoding="UTF-8"?>\n<eSocial xmlns="http://www.esocial.gov.br/schema/evt/${evtTag}/v_S_01_03_00">`;

  const ideEvento = block('ideEvento', 
    optTag('indRetif', indRetif, 2) +
    optTag('nrRecibo', nrRecibo, 2) +
    optTag('tpAmb', tpAmb, 2) +
    optTag('procEmi', 1, 2) +
    optTag('verProc', '5.14.0', 2), 1);

  const ideEmpregador = block('ideEmpregador',
    optTag('tpInsc', 1, 2) +
    optTag('nrInsc', cnpj.substring(0, 8), 2), 1);

  const eventsWithIdeVinculo = ['S-2206', 'S-2210', 'S-2220', 'S-2230', 'S-2240', 'S-2298', 'S-2299'];
  const useIdeVinculo = eventsWithIdeVinculo.includes(eventoCodigo);
  const matricula = esp.matricula_esocial || dadosEvento.matricula_esocial || esp.matricula || dadosEvento.matricula || '';

  const workerBlock = useIdeVinculo
    ? block('ideVinculo',
        optTag('cpfTrab', cpf, 2) +
        optTag('matricula', matricula, 2), 1)
    : block('ideTrabalhador',
        optTag('cpfTrab', cpf, 2) +
        optTag('nmTrab', sanitizeTsNome(esp.nome || esp.nmTrab || ''), 2) +
        optTag('nisTrab', esp.nis || esp.nisTrab, 2), 1);

  let corpo = '';

  switch (eventoCodigo) {
    case 'S-2200': {
      const matricula = esp.matricula_esocial || dadosEvento.matricula_esocial || esp.matricula || dadosEvento.matricula || '';
      const dataAdmissao = esp.dataAdmissao || '';
      const tipoAdmissao = esp.tipoAdmissao || '';
      const tpRegJorn = esp.tpRegJorn || esp.tipoJornada || 1;
      const natAtividade = esp.natAtividade || 1;
      const cnpjSind = esp.cnpjSind || cnpj;

      const cadInicial = block('cadInicial',
        optTag('dtAdmissao', dataAdmissao, 3) +
        optTag('tpAdmissao', tipoAdmissao, 3) +
        optTag('tpRegJorn', tpRegJorn, 3) +
        optTag('natAtividade', natAtividade, 3) +
        optTag('dtBase', esp.dtBase || 1, 3) +
        optTag('cnpjSind', cnpjSind, 3), 2);

      const cargo = block('cargo',
        optTag('codCargo', esp.codCargo || '001', 4) +
        optTag('nmCargo', esp.cargo || esp.nmCargo || '', 4) +
        optTag('codCBO', esp.codCBO || esp.cbo || '', 4), 3);

      const salario = block('salario',
        optTag('vrSalFx', esp.salario || esp.vrSalFx || '0', 4) +
        optTag('undSalFixo', esp.undSalFixo || 7, 4), 3);

      const duracao = block('duracao',
        optTag('tpContr', esp.tpContr || 1, 4), 3);

      const localTrab = block('localTrab',
        block('locLotacao',
          optTag('tpLotacao', esp.tpLotacao || 1, 5) +
          optTag('codLotacao', esp.codLotacao || '001', 5), 4), 3);

      const infoContrato = block('infoContrato', cargo + salario + duracao + localTrab, 2);

      corpo = block('dados2200',
        optTag('matricula', matricula, 2) +
        cadInicial +
        infoContrato, 1);
      break;
    }

    case 'S-2220': {
      let tpExameNum = typeof esp.tipoExame === 'number' ? esp.tipoExame : 1;
      if (typeof esp.tipoExame === 'string') {
        const t = esp.tipoExame.toLowerCase();
        if (t.includes('admiss')) tpExameNum = 0;
        else if (t.includes('period') || t.includes('períod')) tpExameNum = 1;
        else if (t.includes('retorno')) tpExameNum = 2;
        else if (t.includes('mudan')) tpExameNum = 3;
        else if (t.includes('demiss')) tpExameNum = 4;
      }

      let resAsoNum = typeof esp.resultado === 'number' ? esp.resultado : 1;
      if (typeof esp.resultado === 'string') {
        const r = esp.resultado.toLowerCase();
        if (r.includes('inapto')) resAsoNum = 2;
        else if (r.includes('apto')) resAsoNum = 1;
      }

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

      const isAdmissional = (() => {
        if (typeof esp.tipoExame === 'number') {
          return esp.tipoExame === 0 || esp.tipoExame === 1;
        }
        if (typeof esp.tipoExame === 'string') {
          return esp.tipoExame.toLowerCase().includes('admiss');
        }
        return false;
      })();
      const calculatedOrdExame = isAdmissional ? 1 : 2;

      let examesXml = '';
      const listExames = esp.exames_realizados || esp.exames || [];
      const rawDefaultDate = esp.data_realizacao || esp.dataRealizacao || esp.dtExame || esp.dtAso || esp.data_aso || esp.dataAso || '';
      const defaultDate = normalizeDate(rawDefaultDate);
      
      if (Array.isArray(listExames) && listExames.length > 0) {
        const uniqueExames = new Map<string, any>();
        
        for (const ex of listExames) {
          const cod = ex.codProc || ex.procRealizado || getCodProcFromNome(ex.nome);
          const dt = normalizeDate(ex.data || ex.dtExm || defaultDate, defaultDate);
          const key = `${dt}-${cod}`;
          
          let ordExameVal = calculatedOrdExame;
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
          
          if (!uniqueExames.has(key)) {
            uniqueExames.set(key, { dt, cod, obs: ex.obs || ex.obsExm || '', ordExame: ordExameVal });
          } else {
            // Append observation if there's any, to not lose data
            const existing = uniqueExames.get(key);
            const currentObs = ex.obs || ex.obsExm || '';
            if (currentObs && !existing.obs.includes(currentObs)) {
              existing.obs = existing.obs ? `${existing.obs} / ${currentObs}` : currentObs;
            }
          }
        }
        
        for (const ex of Array.from(uniqueExames.values())) {
          examesXml += block('exame',
            optTag('dtExm', ex.dt, 4) +
            optTag('procRealizado', ex.cod, 4) +
            optTag('obsProc', ex.obs || 'Procedimento realizado conforme protocolo medico', 4) +
            optTag('ordExame', ex.ordExame, 4), 3);
        }
      } else {
        examesXml = block('exame',
          optTag('dtExm', defaultDate, 4) +
          optTag('procRealizado', esp.codProc || '0999', 4) +
          optTag('obsProc', 'Procedimento realizado conforme protocolo medico', 4) +
          optTag('ordExame', calculatedOrdExame, 4), 3);
      }

      const medicoPcmsoNome = esp.medico_pcmso_nome || esp.medicoPcmsoNome;
      const medicoPcmsoCrm = esp.medico_pcmso_crm || esp.medicoPcmsoCrm;
      const medicoPcmsoUf = esp.medico_pcmso_uf || esp.medicoPcmsoUf || 'RJ';

      const dtAsoFinal = defaultDate || normalizeDate(esp.dtAso || esp.data_aso || esp.dataAso) || new Date().toISOString().split('T')[0];
      const asoBlock = block('aso',
        optTag('dtAso', dtAsoFinal, 3) +
        optTag('resAso', resAsoNum, 3) +
        examesXml +
        block('medico',
          optTag('nmMed', sanitizeTsNome(
            (typeof esp.medico === 'string' ? esp.medico : '')
            || esp.medico_nome
            || esp.nmMed
            || esp.medicoNome
            || (esp.medico && typeof esp.medico === 'object' ? esp.medico.nmMed : '')
            || '',
          ), 4) +
          optTag('nrCRM', String(esp.crm || esp.medico_crm || esp.nrCRM || '').replace(/\D/g, ''), 4) +
          optTag('ufCRM', String(esp.uf || esp.medico_uf || esp.ufCRM || '').trim().toUpperCase(), 4), 3), 2);

      const respMonitBlock = medicoPcmsoNome ? block('respMonit',
        optTag('nmResp', sanitizeTsNome(medicoPcmsoNome), 3) +
        optTag('nrCRM', medicoPcmsoCrm, 3) +
        optTag('ufCRM', medicoPcmsoUf, 3), 2) : '';

      corpo = block('exMedOcup',
        optTag('tpExameOcup', tpExameNum, 2) +
        asoBlock +
        respMonitBlock, 1);
      break;
    }

    case 'S-2240': {
      const dtIniCondicao = esp.dtIniCondicao || new Date().toISOString().split('T')[0];
      const localAmb = esp.localAmb || '1';
      const dscAmb = esp.dscAmb || 'Ambiente Geral de Trabalho';
      const dscAtivDes = esp.dscAtivDes || esp.condicoesAmbiente || '';
      
      const tpInscAmb = 1; // 1 = CNPJ
      const nrInscAmb = cnpj; 
      
      const infoAmbXml = block('infoAmb',
        optTag('localAmb', localAmb, 3) +
        optTag('dscAmb', dscAmb, 3) +
        optTag('tpInsc', tpInscAmb, 3) +
        optTag('nrInsc', nrInscAmb, 3), 2);

      const infoAtivXml = block('infoAtiv',
        optTag('dscAtivDes', dscAtivDes, 3), 2);

      let agNocXml = '';
      const listRiscos = esp.riscos || [];
      if (Array.isArray(listRiscos) && listRiscos.length > 0) {
        for (const risco of listRiscos) {
          const codAgNoc = risco.codAgNoc || '09.01.001';
          const tpAval = risco.tpAval || '1';
          
          let epcEpiXml = '';
          if (codAgNoc !== '09.01.001') {
            const utilizEPC = risco.utilizEPC || '0';
            const eficEpc = utilizEPC === '2' ? (risco.eficEpc || 'S') : undefined;
            const utilizEPI = risco.utilizEPI || '0';
            const eficEpi = utilizEPI === '2' ? (risco.eficEpi || 'S') : undefined;
            
            let epiXml = '';
            if (utilizEPI === '2' && risco.caEPI) {
              epiXml = block('epi',
                optTag('docAval', risco.caEPI, 5), 4);
            }

            epcEpiXml = block('epcEpi',
              optTag('utilizEPC', utilizEPC, 4) +
              optTag('eficEpc', eficEpc, 4) +
              optTag('utilizEPI', utilizEPI, 4) +
              optTag('eficEpi', eficEpi, 4) +
              epiXml, 3);
          }

          agNocXml += block('agNoc',
            optTag('codAgNoc', codAgNoc, 3) +
            optTag('tpAval', tpAval, 3) +
            epcEpiXml, 2);
        }
      } else {
        const codAgNoc = esp.fatorRisco || esp.codFatRisco || '09.01.001';
        let epcEpiXml = '';
        if (codAgNoc !== '09.01.001') {
          const epiEficaz = esp.epiEficaz || 'NA';
          const utilizEPI = epiEficaz === 'NA' ? '0' : '2';
          const eficEpi = epiEficaz === 'S' ? 'S' : (epiEficaz === 'N' ? 'N' : undefined);
          
          epcEpiXml = block('epcEpi',
            optTag('utilizEPC', '0', 4) +
            optTag('utilizEPI', utilizEPI, 4) +
            optTag('eficEpi', eficEpi, 4), 3);
        }

        agNocXml = block('agNoc',
          optTag('codAgNoc', codAgNoc, 3) +
          optTag('tpAval', '1', 3) +
          epcEpiXml, 2);
      }

      let respRegXml = '';
      const r = esp.respReg;
      if (r && r.cpfResp) {
        respRegXml = block('respReg',
          optTag('cpfResp', r.cpfResp, 3) +
          optTag('ideOC', r.ideOC, 3) +
          optTag('nrOC', r.nrOC, 3) +
          optTag('ufOC', r.ufOC, 3), 2);
      } else {
        respRegXml = block('respReg',
          optTag('cpfResp', '00000000000', 3) +
          optTag('ideOC', '1', 3) +
          optTag('nrOC', '00000', 3) +
          optTag('ufOC', 'RJ', 3), 2);
      }

      corpo = block('infoExpRisco',
        optTag('dtIniCondicao', dtIniCondicao, 2) +
        infoAmbXml +
        infoAtivXml +
        agNocXml +
        respRegXml, 1);
      break;
    }

    case 'S-2205': {
      const dtAlteracao = esp.dtAlteracao || esp.dataAlteracao || new Date().toISOString().split('T')[0];
      const nmTrab = esp.nome || esp.nmTrab || '';
      const sexo = esp.sexo || '';
      const racaCor = esp.racaCor || '';
      const estCiv = esp.estCiv || '';
      const grauInstr = esp.grauInstr || '';
      const dtNascto = esp.dtNascto || esp.data_nascimento || '';
      
      const dadosAlteracao = block('alteracao',
        optTag('dtAlteracao', dtAlteracao, 2) +
        block('dadosTrabalhador',
          optTag('nmTrab', nmTrab, 3) +
          optTag('sexo', sexo, 3) +
          optTag('racaCor', racaCor, 3) +
          optTag('estCiv', estCiv, 3) +
          optTag('grauInstr', grauInstr, 3) +
          optTag('dtNascto', dtNascto, 3), 2), 1);

      corpo = dadosAlteracao;
      break;
    }

    case 'S-2206': {
      const dtAlteracao = esp.dtAlteracao || esp.dataAlteracao || new Date().toISOString().split('T')[0];

      const cargo = block('cargo',
        optTag('codCargo', esp.codCargo || '001', 4) +
        optTag('nmCargo', esp.cargo || esp.nmCargo || '', 4) +
        optTag('codCBO', esp.codCBO || esp.cbo || '', 4), 3);

      const salario = block('salario',
        optTag('vrSalFx', esp.salario || esp.vrSalFx || '0', 4) +
        optTag('undSalFixo', esp.undSalFixo || 7, 4), 3);

      const infoContrato = block('infoContrato', cargo + salario, 2);

      corpo = block('altContratual',
        optTag('dtAlteracao', dtAlteracao, 2) +
        infoContrato, 1);
      break;
    }

    case 'S-2210': {
      const dtAcid = esp.dtAcid || esp.dataAcidente || '';
      const tpAcid = esp.tpAcid || esp.tipoAcidente || '';
      const tpCat = esp.tpCat || esp.tipoCat || '1';
      
      let localAcidXml = '';
      const local = esp.localAcidente || {};
      if (local.dscLograd || local.uf) {
        localAcidXml = block('localAcidente',
          optTag('tpLograd', local.tpLograd || 'R', 3) +
          optTag('dscLograd', local.dscLograd, 3) +
          optTag('nrLograd', local.nrLograd, 3) +
          optTag('bairro', local.bairro, 3) +
          optTag('cep', local.cep, 3) +
          optTag('codMunic', local.codMunic, 3) +
          optTag('uf', local.uf, 3) +
          optTag('pais', local.pais || '105', 3), 2);
      }

      const parteAtingida = block('parteAtingida',
        optTag('codParteAting', esp.parteAtingidaCod || '799990000', 3) +
        optTag('lateralidade', esp.parteAtingidaLateralidade || '1', 3), 2);

      const agenteCausador = block('agenteCausador',
        optTag('codAgntCausador', esp.agenteCausadorCod || '999990000', 3), 2);

      corpo = block('cat',
        optTag('dtAcid', dtAcid, 2) +
        optTag('hrAcid', esp.hrAcid || esp.horaAcidente, 2) +
        optTag('tpAcid', tpAcid, 2) +
        optTag('tpCat', tpCat, 2) +
        optTag('dtObito', esp.dtObito, 2) +
        optTag('hrsTrabAntesAcid', esp.hrsTrabAntes, 2) +
        optTag('tpLocal', esp.tpLocal, 2) +
        optTag('dscLocal', esp.dscLocal, 2) +
        optTag('codSitGeradora', esp.codSitGeradora, 2) +
        optTag('iniciatCAT', esp.iniciatCat || '1', 2) +
        optTag('obsCAT', esp.obsCat, 2) +
        optTag('ultDiaTrab', esp.ultDiaTrab, 2) +
        optTag('houveAfast', esp.houveAfast ? 'S' : 'N', 2) +
        optTag('dtIniAfast', esp.dtIniAfast, 2) +
        localAcidXml +
        parteAtingida +
        agenteCausador, 1);
      break;
    }

    case 'S-2230': {
      const dtIniAfast = esp.dtIniAfast || esp.dataInicioAfastamento;
      const dtTermAfast = esp.dtTermAfast || esp.dataFimAfastamento;

      if (dtIniAfast && !dtTermAfast) {
        corpo = block('infoAfastamento',
          block('iniAfastamento',
            optTag('dtIniAfast', dtIniAfast, 3) +
            optTag('codMotAfast', esp.codMotAfast || esp.motivoAfastamento || '01', 3) +
            optTag('infoMesmoMtv', esp.infoMesmoMtv, 3) +
            optTag('tpAcidTransito', esp.tpAcidTransito, 3) +
            optTag('observacao', esp.observacao || esp.observacoes, 3), 2), 1);
      } else if (dtTermAfast) {
        corpo = block('infoAfastamento',
          block('fimAfastamento',
            optTag('dtTermAfast', dtTermAfast, 3), 2), 1);
      }
      break;
    }

    case 'S-2298': {
      const tpReint = esp.tpReint || esp.tipoReintegracao || '1';
      const dtEfetRetorno = esp.dtEfetRetorno || esp.dataRetorno || '';
      const dtEfeito = esp.dtEfeito || esp.dataEfeito || dtEfetRetorno;

      corpo = block('infoReintegr',
        optTag('tpReint', tpReint, 2) +
        optTag('nrProcJud', esp.nrProcJud, 2) +
        optTag('nrLeiAnistia', esp.nrLeiAnistia, 2) +
        optTag('dtEfetRetorno', dtEfetRetorno, 2) +
        optTag('dtEfeito', dtEfeito, 2), 1);
      break;
    }

    case 'S-2299': {
      const mtvDeslig = esp.mtvDeslig || esp.motivoDesligamento || '10';
      const dtDeslig = esp.dtDeslig || esp.dataDesligamento || '';

      corpo = block('infoDeslig',
        optTag('mtvDeslig', mtvDeslig, 2) +
        optTag('dtDeslig', dtDeslig, 2) +
        optTag('indPagtoAPI', esp.indPagtoAPI, 2) +
        optTag('dtProjFimAPI', esp.dtProjFimAPI, 2) +
        optTag('pensAlim', esp.pensAlim || '0', 2) +
        optTag('observacao', esp.observacao || esp.observacoes, 2), 1);
      break;
    }

    case 'S-3000': {
      corpo = block('dadosRemocao',
        optTag('tpEv', esp.eventoExcluir || esp.tpEv || '', 2) +
        optTag('nrRecibo', esp.reciboExcluir || esp.nrRecibo || '', 2), 1);
      break;
    }

    default: {
      corpo = block(`dados${eventoCodigo.replace('-', '')}`, '', 1);
    }
  }

  const cnpjLimpo = cnpj.replace(/\D/g, '');
  const cnpjIdPart = cnpjLimpo.substring(0, 8).padEnd(14, '0');
  const eventId = `ID1${cnpjIdPart}${new Date().toISOString().replace(/[-:T.Z]/g, '').substring(0, 14)}${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`;
  
  const footer = `</eSocial>`;

  return header + '\n' + 
    `  <${evtTag} Id="${eventId}">\n` + 
    ideEvento + ideEmpregador + workerBlock + corpo + 
    `  </${evtTag}>\n` + 
    footer;
}

export function validateEventXML(xml: string): { valido: boolean; erros: string[] } {
  const validador = require('@/lib/e-social/esocialValidator');
  const codigoEventoMatch = xml.match(/<evt(\w+)(\s|>)/);
  const codigoEvento = codigoEventoMatch ? `S-${codigoEventoMatch[1]}` : 'Desconhecido';
  
  const resultado = validador.validarXMLGerado(xml, codigoEvento);
  
  return {
    valido: resultado.valido,
    erros: resultado.erros.map((e: any) => e.mensagem)
  };
}

function getField(obj: any, field: string): any {
  if (obj[field] !== undefined && obj[field] !== null && obj[field] !== '') return obj[field];
  if (obj.dadosEspecificos?.[field] !== undefined && obj.dadosEspecificos?.[field] !== null && obj.dadosEspecificos?.[field] !== '') return obj.dadosEspecificos[field];
  return undefined;
}

export function validateEventData(eventoCodigo: string, dadosEvento: any): { valido: boolean; erros: string[] } {
  // Importação estática aqui para evitar circular dependency caso haja
  const validador = require('@/lib/e-social/esocialValidator');
  const resultado = validador.validarDadosEvento(eventoCodigo, dadosEvento);
  
  return {
    valido: resultado.valido && resultado.camposPendentes.length === 0,
    erros: [
      ...resultado.erros.map((e: any) => e.mensagem),
      ...resultado.camposPendentes.map((c: any) => `Campo pendente: ${c.label}`)
    ]
  };
}
