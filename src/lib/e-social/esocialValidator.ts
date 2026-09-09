import { isValidTsNome, nomesTsDoXml, sanitizeTsNome } from './ts-nome';

export interface ErroValidacao {
  campo: string;
  mensagem: string;
  tipo: 'obrigatorio' | 'formato' | 'valor_invalido' | 'estrutura';
  autocorrigivel: boolean;
}

export interface CampoPendente {
  campo: string;
  label: string;
  tipo: 'text' | 'select' | 'date';
  opcoes?: { valor: string; label: string }[];
  dica?: string;
}

export interface ResultadoValidacao {
  valido: boolean;
  erros: ErroValidacao[];
  camposPendentes: CampoPendente[];
}

const UFS_VALIDAS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];

function getField(dados: any, campo: string): any {
  if (!dados) return undefined;
  if (dados.dadosEspecificos && dados.dadosEspecificos[campo] !== undefined) {
    return dados.dadosEspecificos[campo];
  }
  return dados[campo];
}

function validarCamposComuns(dados: any, erros: ErroValidacao[], camposPendentes: CampoPendente[]) {
  const tpAmb = getField(dados, 'tpAmb');
  if (!tpAmb) {
    erros.push({ campo: 'tpAmb', mensagem: 'Ambiente (tpAmb) obrigatório', tipo: 'obrigatorio', autocorrigivel: true });
  } else if (tpAmb !== 1 && tpAmb !== 2) {
    erros.push({ campo: 'tpAmb', mensagem: 'Ambiente deve ser 1 ou 2', tipo: 'valor_invalido', autocorrigivel: true });
  }

  const nrInsc = getField(dados, 'nrInsc') || getField(dados, 'cnpj') || getField(dados, 'cnpj_empregador');
  if (!nrInsc) {
    erros.push({ campo: 'nrInsc', mensagem: 'CNPJ do Empregador (nrInsc) obrigatório', tipo: 'obrigatorio', autocorrigivel: true });
    camposPendentes.push({ campo: 'cnpj', label: 'CNPJ do Empregador', tipo: 'text', dica: '14 dígitos' });
  } else if (String(nrInsc).replace(/\D/g, '').length < 8) {
    erros.push({ campo: 'nrInsc', mensagem: 'CNPJ do Empregador incompleto', tipo: 'formato', autocorrigivel: true });
  }
}

export function validarDadosEvento(codigoEvento: string, dadosEvento: any): ResultadoValidacao {
  const erros: ErroValidacao[] = [];
  const camposPendentes: CampoPendente[] = [];

  validarCamposComuns(dadosEvento, erros, camposPendentes);

  const cpf = getField(dadosEvento, 'cpf') || getField(dadosEvento, 'cpfTrab');
  const needsCpf = !['S-1000', 'S-3000'].includes(codigoEvento);

  if (needsCpf) {
    if (!cpf) {
      erros.push({ campo: 'cpf', mensagem: 'CPF obrigatório', tipo: 'obrigatorio', autocorrigivel: true });
      camposPendentes.push({ campo: 'cpf', label: 'CPF do Trabalhador', tipo: 'text', dica: 'Apenas números' });
    } else if (String(cpf).replace(/\D/g, '').length !== 11) {
      erros.push({ campo: 'cpf', mensagem: 'CPF deve conter 11 dígitos', tipo: 'formato', autocorrigivel: true });
    }
  }

  switch (codigoEvento) {
    case 'S-2200': {
      const matricula = getField(dadosEvento, 'matricula') || getField(dadosEvento, 'matricula_esocial');
      if (!matricula) {
        erros.push({ campo: 'matricula', mensagem: 'Matrícula e-Social obrigatória', tipo: 'obrigatorio', autocorrigivel: false });
        camposPendentes.push({ campo: 'matricula', label: 'Matrícula e-Social', tipo: 'text' });
      }
      const dataAdmissao = getField(dadosEvento, 'dataAdmissao') || getField(dadosEvento, 'data_admissao') || getField(dadosEvento, 'dtAdm') || getField(dadosEvento, 'dtAdmissao');
      if (!dataAdmissao) {
        erros.push({ campo: 'dataAdmissao', mensagem: 'Data de Admissão obrigatória', tipo: 'obrigatorio', autocorrigivel: true });
        camposPendentes.push({ campo: 'dataAdmissao', label: 'Data de Admissão', tipo: 'date' });
      }
      const tipoAdmissao = getField(dadosEvento, 'tipoAdmissao') || getField(dadosEvento, 'tpAdmissao') || '1';
      if (!tipoAdmissao) {
        erros.push({ campo: 'tipoAdmissao', mensagem: 'Tipo de Admissão obrigatório', tipo: 'obrigatorio', autocorrigivel: false });
        camposPendentes.push({ campo: 'tipoAdmissao', label: 'Tipo de Admissão', tipo: 'select', opcoes: [{valor:'1', label:'Admissão'}, {valor:'2', label:'Transferência'}, {valor:'3', label:'Readaptação'}] });
      }
      const cargo = getField(dadosEvento, 'cargo') || getField(dadosEvento, 'cargo_nome') || getField(dadosEvento, 'funcao');
      if (!cargo) {
        erros.push({ campo: 'cargo', mensagem: 'Cargo obrigatório', tipo: 'obrigatorio', autocorrigivel: false });
        camposPendentes.push({ campo: 'cargo', label: 'Cargo', tipo: 'text' });
      }
      const cbo = getField(dadosEvento, 'codCBO') || getField(dadosEvento, 'cbo') || getField(dadosEvento, 'cargo_cbo');
      if (!cbo) {
        erros.push({ campo: 'codCBO', mensagem: 'CBO obrigatório', tipo: 'obrigatorio', autocorrigivel: false });
        camposPendentes.push({ campo: 'codCBO', label: 'CBO', tipo: 'text' });
      }
      break;
    }
    case 'S-2220': {
      const matricula = getField(dadosEvento, 'matricula') || getField(dadosEvento, 'matricula_esocial');
      if (!matricula) {
        erros.push({ campo: 'matricula', mensagem: 'Matrícula e-Social obrigatória', tipo: 'obrigatorio', autocorrigivel: false });
        camposPendentes.push({ campo: 'matricula', label: 'Matrícula e-Social', tipo: 'text' });
      }
      
      const tipoExame = getField(dadosEvento, 'tipoExame') || getField(dadosEvento, 'tpExameOcup');
      if (tipoExame === undefined || tipoExame === null || tipoExame === '') {
        erros.push({ campo: 'tipoExame', mensagem: 'Tipo de Exame obrigatório', tipo: 'obrigatorio', autocorrigivel: true });
        camposPendentes.push({ 
          campo: 'tipoExame', label: 'Tipo de Exame', tipo: 'select', 
          opcoes: [{valor:'0', label:'Admissional'}, {valor:'1', label:'Periódico'}, {valor:'2', label:'Retorno'}, {valor:'3', label:'Mudança'}, {valor:'4', label:'Demissional'}] 
        });
      }

      const dtAso = getField(dadosEvento, 'dtAso') || getField(dadosEvento, 'dataRealizacao') || getField(dadosEvento, 'data_realizacao') || getField(dadosEvento, 'dtExame') || getField(dadosEvento, 'data_aso') || getField(dadosEvento, 'dataAso');
      if (!dtAso) {
        erros.push({ campo: 'dataRealizacao', mensagem: 'Data do ASO obrigatória', tipo: 'obrigatorio', autocorrigivel: true });
        camposPendentes.push({ campo: 'dataRealizacao', label: 'Data do ASO', tipo: 'date' });
      }

      const resAso = getField(dadosEvento, 'resultado') || getField(dadosEvento, 'resAso');
      if (!resAso) {
        erros.push({ campo: 'resultado', mensagem: 'Resultado do ASO obrigatório', tipo: 'obrigatorio', autocorrigivel: true });
        camposPendentes.push({ campo: 'resultado', label: 'Resultado do ASO', tipo: 'select', opcoes: [{valor:'1', label:'Apto'}, {valor:'2', label:'Inapto'}] });
      }

      const nmMedRaw = getField(dadosEvento, 'medico_nome') || getField(dadosEvento, 'nmMed') || getField(dadosEvento, 'medicoNome') || getField(dadosEvento, 'medico');
      const nmMed = typeof nmMedRaw === 'string' ? nmMedRaw : (nmMedRaw?.nmMed || '');
      if (!nmMed) {
        erros.push({ campo: 'medico_nome', mensagem: 'Nome do Médico obrigatório', tipo: 'obrigatorio', autocorrigivel: false });
        camposPendentes.push({ campo: 'medico_nome', label: 'Nome do Médico (ASO)', tipo: 'text' });
      } else if (!isValidTsNome(nmMed)) {
        const limpo = sanitizeTsNome(nmMed);
        erros.push({
          campo: 'medico_nome',
          mensagem: `Nome do médico fora do TS_nome: "${String(nmMed).replace(/\s+/g, ' ').trim()}"`,
          tipo: 'formato',
          autocorrigivel: Boolean(limpo) && isValidTsNome(limpo),
        });
        if (!limpo || !isValidTsNome(limpo)) {
          camposPendentes.push({ campo: 'medico_nome', label: 'Nome do Médico (ASO)', tipo: 'text', dica: 'Somente nome, sem cargo nem quebra de linha' });
        }
      }

      const nrCRM = getField(dadosEvento, 'medico_crm') || getField(dadosEvento, 'nrCRM') || getField(dadosEvento, 'crm');
      if (!nrCRM) {
        erros.push({ campo: 'medico_crm', mensagem: 'CRM do Médico obrigatório', tipo: 'obrigatorio', autocorrigivel: true });
        camposPendentes.push({ campo: 'medico_crm', label: 'CRM do Médico', tipo: 'text' });
      }

      const ufCRM = getField(dadosEvento, 'medico_uf') || getField(dadosEvento, 'ufCRM') || getField(dadosEvento, 'uf');
      if (!ufCRM) {
        erros.push({ campo: 'medico_uf', mensagem: 'UF do CRM obrigatória', tipo: 'obrigatorio', autocorrigivel: true });
        camposPendentes.push({ campo: 'medico_uf', label: 'UF do CRM', tipo: 'text' });
      } else if (!UFS_VALIDAS.includes(String(ufCRM).toUpperCase())) {
        erros.push({ campo: 'medico_uf', mensagem: 'UF do CRM inválida', tipo: 'valor_invalido', autocorrigivel: true });
      }
      break;
    }
    case 'S-2240': {
      const matricula = getField(dadosEvento, 'matricula') || getField(dadosEvento, 'matricula_esocial');
      if (!matricula) {
        erros.push({ campo: 'matricula', mensagem: 'Matrícula e-Social obrigatória', tipo: 'obrigatorio', autocorrigivel: false });
        camposPendentes.push({ campo: 'matricula', label: 'Matrícula e-Social', tipo: 'text' });
      }
      const dtIniCondicao = getField(dadosEvento, 'dtIniCondicao') || getField(dadosEvento, 'dataRealizacao');
      if (!dtIniCondicao) {
        erros.push({ campo: 'dtIniCondicao', mensagem: 'Data Inicial da Condição obrigatória', tipo: 'obrigatorio', autocorrigivel: true });
        camposPendentes.push({ campo: 'dtIniCondicao', label: 'Data Início Condição', tipo: 'date' });
      }
      const desc = getField(dadosEvento, 'condicoesAmbiente') || getField(dadosEvento, 'dscAtivDes');
      if (!desc) {
        erros.push({ campo: 'condicoesAmbiente', mensagem: 'Descrição das Atividades obrigatória', tipo: 'obrigatorio', autocorrigivel: false });
        camposPendentes.push({ campo: 'condicoesAmbiente', label: 'Descrição Atividades', tipo: 'text' });
      }
      break;
    }
    case 'S-2205': {
      const dtAlteracao = getField(dadosEvento, 'dtAlteracao') || getField(dadosEvento, 'dataAlteracao');
      if (!dtAlteracao) {
        erros.push({ campo: 'dtAlteracao', mensagem: 'Data de Alteração obrigatória', tipo: 'obrigatorio', autocorrigivel: true });
        camposPendentes.push({ campo: 'dtAlteracao', label: 'Data de Alteração', tipo: 'date' });
      }
      const nmTrab = getField(dadosEvento, 'nmTrab') || getField(dadosEvento, 'nome');
      if (!nmTrab) {
        erros.push({ campo: 'nmTrab', mensagem: 'Nome do Trabalhador obrigatório', tipo: 'obrigatorio', autocorrigivel: true });
        camposPendentes.push({ campo: 'nmTrab', label: 'Nome do Trabalhador', tipo: 'text' });
      }
      break;
    }
    case 'S-2206': {
      const matricula = getField(dadosEvento, 'matricula') || getField(dadosEvento, 'matricula_esocial');
      if (!matricula) {
        erros.push({ campo: 'matricula', mensagem: 'Matrícula e-Social obrigatória', tipo: 'obrigatorio', autocorrigivel: false });
        camposPendentes.push({ campo: 'matricula', label: 'Matrícula e-Social', tipo: 'text' });
      }
      const dtAlteracao = getField(dadosEvento, 'dtAlteracao') || getField(dadosEvento, 'dataAlteracao');
      if (!dtAlteracao) {
        erros.push({ campo: 'dtAlteracao', mensagem: 'Data de Alteração obrigatória', tipo: 'obrigatorio', autocorrigivel: true });
        camposPendentes.push({ campo: 'dtAlteracao', label: 'Data de Alteração', tipo: 'date' });
      }
      break;
    }
    case 'S-2210': {
      const matricula = getField(dadosEvento, 'matricula') || getField(dadosEvento, 'matricula_esocial');
      if (!matricula) {
        erros.push({ campo: 'matricula', mensagem: 'Matrícula e-Social obrigatória', tipo: 'obrigatorio', autocorrigivel: false });
        camposPendentes.push({ campo: 'matricula', label: 'Matrícula e-Social', tipo: 'text' });
      }
      const dtAcid = getField(dadosEvento, 'dtAcid') || getField(dadosEvento, 'dataAcidente');
      if (!dtAcid) {
        erros.push({ campo: 'dtAcid', mensagem: 'Data do Acidente obrigatória', tipo: 'obrigatorio', autocorrigivel: true });
        camposPendentes.push({ campo: 'dtAcid', label: 'Data do Acidente', tipo: 'date' });
      }
      const tpAcid = getField(dadosEvento, 'tpAcid') || getField(dadosEvento, 'tipoAcidente');
      if (!tpAcid) {
        erros.push({ campo: 'tpAcid', mensagem: 'Tipo de Acidente obrigatório', tipo: 'obrigatorio', autocorrigivel: false });
        camposPendentes.push({ campo: 'tpAcid', label: 'Tipo de Acidente', tipo: 'select', opcoes: [{valor:'1', label:'Típico'}, {valor:'2', label:'Doença'}, {valor:'3', label:'Trajeto'}] });
      }
      const tpCat = getField(dadosEvento, 'tpCat') || getField(dadosEvento, 'tipoCat');
      if (!tpCat) {
        erros.push({ campo: 'tpCat', mensagem: 'Tipo de CAT obrigatório', tipo: 'obrigatorio', autocorrigivel: false });
        camposPendentes.push({ campo: 'tpCat', label: 'Tipo de CAT', tipo: 'select', opcoes: [{valor:'1', label:'Inicial'}, {valor:'2', label:'Reabertura'}, {valor:'3', label:'Comunicação de Óbito'}] });
      }
      break;
    }
    case 'S-2230': {
      const matricula = getField(dadosEvento, 'matricula') || getField(dadosEvento, 'matricula_esocial');
      if (!matricula) {
        erros.push({ campo: 'matricula', mensagem: 'Matrícula e-Social obrigatória', tipo: 'obrigatorio', autocorrigivel: false });
        camposPendentes.push({ campo: 'matricula', label: 'Matrícula e-Social', tipo: 'text' });
      }
      const dtIniAfast = getField(dadosEvento, 'dtIniAfast') || getField(dadosEvento, 'dataInicioAfastamento');
      const dtTermAfast = getField(dadosEvento, 'dtTermAfast') || getField(dadosEvento, 'dataFimAfastamento');
      if (!dtIniAfast && !dtTermAfast) {
        erros.push({ campo: 'dtIniAfast', mensagem: 'Data de início ou término do afastamento obrigatória', tipo: 'obrigatorio', autocorrigivel: true });
        camposPendentes.push({ campo: 'dtIniAfast', label: 'Data Início Afastamento', tipo: 'date' });
      }
      if (dtIniAfast) {
        const codMotAfast = getField(dadosEvento, 'codMotAfast') || getField(dadosEvento, 'motivoAfastamento');
        if (!codMotAfast) {
          erros.push({ campo: 'codMotAfast', mensagem: 'Código do Motivo de Afastamento obrigatório', tipo: 'obrigatorio', autocorrigivel: false });
          camposPendentes.push({ campo: 'codMotAfast', label: 'Motivo do Afastamento', tipo: 'select', opcoes: [
            {valor:'01', label:'Doença não profissional'},
            {valor:'03', label:'Licença maternidade'},
            {valor:'06', label:'Acidente de trabalho típico'},
            {valor:'15', label:'Férias'},
            {valor:'21', label:'Licença remunerada'},
            {valor:'31', label:'Aposentadoria por invalidez'}
          ]});
        }
      }
      break;
    }
    case 'S-2300': {
      if (!getField(dadosEvento, 'tpRegPrev')) {
        erros.push({ campo: 'tpRegPrev', mensagem: 'Tipo de Regime Previdenciário obrigatório', tipo: 'obrigatorio', autocorrigivel: false });
        camposPendentes.push({ campo: 'tpRegPrev', label: 'Regime Previdenciário', tipo: 'select', opcoes: [{valor:'1', label:'RGPS'}, {valor:'2', label:'RPPS'}, {valor:'3', label:'RPPE'}] });
      }
      break;
    }
    case 'S-2298': {
      const dataReintegracao = getField(dadosEvento, 'dataReintegracao') || getField(dadosEvento, 'dtReint');
      if (!dataReintegracao) {
        erros.push({ campo: 'dataReintegracao', mensagem: 'Data de Reintegração obrigatória', tipo: 'obrigatorio', autocorrigivel: true });
        camposPendentes.push({ campo: 'dataReintegracao', label: 'Data de Reintegração', tipo: 'date' });
      }
      break;
    }
    case 'S-2299': {
      const dataDesligamento = getField(dadosEvento, 'dataDesligamento') || getField(dadosEvento, 'dtDeslig');
      if (!dataDesligamento) {
        erros.push({ campo: 'dataDesligamento', mensagem: 'Data de Desligamento obrigatória', tipo: 'obrigatorio', autocorrigivel: true });
        camposPendentes.push({ campo: 'dataDesligamento', label: 'Data de Desligamento', tipo: 'date' });
      }
      break;
    }
    case 'S-2399': {
      const dtTerm = getField(dadosEvento, 'dtTerm') || getField(dadosEvento, 'dataDesligamento');
      if (!dtTerm) {
        erros.push({ campo: 'dtTerm', mensagem: 'Data de Desligamento obrigatória', tipo: 'obrigatorio', autocorrigivel: true });
        camposPendentes.push({ campo: 'dtTerm', label: 'Data de Desligamento', tipo: 'date' });
      }
      break;
    }
    case 'S-3000': {
      if (!getField(dadosEvento, 'tpEv')) {
        erros.push({ campo: 'tpEv', mensagem: 'Tipo de Evento Excluído obrigatório', tipo: 'obrigatorio', autocorrigivel: false });
      }
      if (!getField(dadosEvento, 'nrRecibo')) {
        erros.push({ campo: 'nrRecibo', mensagem: 'Número do Recibo obrigatório', tipo: 'obrigatorio', autocorrigivel: false });
      }
      break;
    }
  }

  return {
    valido: erros.filter(e => !e.autocorrigivel).length === 0 && camposPendentes.length === 0,
    erros,
    camposPendentes
  };
}

export function validarXMLGerado(xml: string, codigoEvento: string): ResultadoValidacao {
  const erros: ErroValidacao[] = [];
  
  if (!xml || xml.trim().length === 0) {
    erros.push({ campo: 'xml', mensagem: 'XML está vazio', tipo: 'estrutura', autocorrigivel: false });
    return { valido: false, erros, camposPendentes: [] };
  }

  if (!xml.includes('<?xml')) erros.push({ campo: 'xml', mensagem: 'Falta declaração <?xml', tipo: 'estrutura', autocorrigivel: false });
  if (!xml.includes('<eSocial')) erros.push({ campo: 'xml', mensagem: 'Falta tag <eSocial>', tipo: 'estrutura', autocorrigivel: false });
  if (!xml.includes('</eSocial>')) erros.push({ campo: 'xml', mensagem: 'Falta tag </eSocial>', tipo: 'estrutura', autocorrigivel: false });

  if (!/<ideEvento>/.test(xml) || !/<tpAmb>/.test(xml) || !/<procEmi>/.test(xml) || !/<verProc>/.test(xml)) {
    erros.push({ campo: 'ideEvento', mensagem: 'Grupo <ideEvento> incompleto (falta tpAmb, procEmi ou verProc)', tipo: 'estrutura', autocorrigivel: true });
  }

  if (!/<ideEmpregador>/.test(xml) || !/<tpInsc>/.test(xml) || !/<nrInsc>/.test(xml)) {
    erros.push({ campo: 'ideEmpregador', mensagem: 'Grupo <ideEmpregador> incompleto', tipo: 'estrutura', autocorrigivel: false });
  }

  // Check valid dates format YYYY-MM-DD (excluding dtBase which is a month number 1-12)
  const dateTags = xml.match(/<(dt[A-Z][a-zA-Z0-9]+|data[a-zA-Z0-9]+)>([^<]+)<\//g) || [];
  for (const tag of dateTags) {
    if (tag.startsWith('<dtBase>')) continue;
    const valueMatch = tag.match(/>([^<]+)</);
    if (valueMatch && valueMatch[1]) {
      const val = valueMatch[1];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) {
         erros.push({ campo: 'datas', mensagem: `Data inválida no XML: ${val}. Formato esperado YYYY-MM-DD`, tipo: 'formato', autocorrigivel: true });
      } else {
         const parts = val.split('-');
         if (parseInt(parts[1], 10) > 12) {
           erros.push({ campo: 'datas', mensagem: `Mês inválido na data: ${val}`, tipo: 'valor_invalido', autocorrigivel: true });
         }
      }
    }
  }

  // Check empty required tags like <tag></tag>
  if (/<[a-zA-Z0-9]+>\s*<\/[a-zA-Z0-9]+>/.test(xml)) {
     erros.push({ campo: 'xml', mensagem: 'XML contém tags vazias', tipo: 'estrutura', autocorrigivel: true });
  }

  if (codigoEvento === 'S-2220') {
    if (!/<cpfTrab>/.test(xml)) erros.push({ campo: 'cpfTrab', mensagem: 'Falta CPF do Trabalhador', tipo: 'estrutura', autocorrigivel: false });
    if (!/<matricula>/.test(xml)) erros.push({ campo: 'matricula', mensagem: 'Falta Matrícula', tipo: 'estrutura', autocorrigivel: false });
    if (!/<exMedOcup>/.test(xml)) erros.push({ campo: 'exMedOcup', mensagem: 'Falta grupo <exMedOcup>', tipo: 'estrutura', autocorrigivel: false });
    if (!/<aso>/.test(xml)) erros.push({ campo: 'aso', mensagem: 'Falta grupo <aso>', tipo: 'estrutura', autocorrigivel: false });
    if (!/<medico>/.test(xml)) erros.push({ campo: 'medico', mensagem: 'Falta grupo <medico>', tipo: 'estrutura', autocorrigivel: false });
    if (!/<dtExm>/.test(xml)) erros.push({ campo: 'dtExm', mensagem: 'Falta tag <dtExm> dentro de exames', tipo: 'estrutura', autocorrigivel: false });
    if (!/<nmMed>/.test(xml)) erros.push({ campo: 'nmMed', mensagem: 'Falta tag <nmMed> no XML', tipo: 'estrutura', autocorrigivel: false });

    for (const { tag, valor } of nomesTsDoXml(xml)) {
      if (!isValidTsNome(valor)) {
        erros.push({
          campo: tag,
          mensagem: `<${tag}> inválido para TS_nome: "${valor.replace(/\s+/g, ' ').trim()}"`,
          tipo: 'formato',
          autocorrigivel: true,
        });
      }
    }
    
    // Bug histórico do S-2220
    if (/<aso>\s*<resAso>/.test(xml)) {
      erros.push({ campo: 'aso', mensagem: '<dtAso> deve vir antes de <resAso> em <aso>', tipo: 'estrutura', autocorrigivel: true });
    }
  } else if (codigoEvento === 'S-2240') {
    if (!/<cpfTrab>/.test(xml)) erros.push({ campo: 'cpfTrab', mensagem: 'Falta CPF', tipo: 'estrutura', autocorrigivel: false });
    if (!/<infoExpRisco>/.test(xml)) erros.push({ campo: 'infoExpRisco', mensagem: 'Falta grupo <infoExpRisco>', tipo: 'estrutura', autocorrigivel: false });
  }

  return {
    valido: erros.length === 0,
    erros,
    camposPendentes: []
  };
}
