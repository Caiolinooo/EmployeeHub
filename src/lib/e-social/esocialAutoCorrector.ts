import {
  CAMPOS_NOME_MEDICO,
  CAMPOS_NOME_PCMSO,
  CAMPOS_NOME_TRAB,
  coletarNomeMedico,
  coletarNomePcmso,
  sanitizeTsNome,
} from './ts-nome';

export interface Correcao {
  campo: string;
  de: string;
  para: string;
  descricao: string;
}

export interface ResultadoCorrecao {
  dadosCorrigidos: any;
  correcoes: Correcao[];
  xmlPrecisaRebuildar: boolean;
}

function deepClone(obj: any): any {
  return JSON.parse(JSON.stringify(obj));
}

function normalizarData(dataStr: string): string | null {
  if (!dataStr) return null;
  // Se for timestamp ISO ou similar (YYYY-MM-DDTHH:mm:ss)
  if (dataStr.includes('T')) {
    const parts = dataStr.split('T')[0];
    if (parts.length === 10) return parts;
  }
  // Se for DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dataStr)) {
    const [d, m, y] = dataStr.split('/');
    return `${y}-${m}-${d}`;
  }
  // Se for YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) {
    const parts = dataStr.split('-');
    // Inverter mês e dia se mês > 12 e dia <= 12
    if (parseInt(parts[1], 10) > 12 && parseInt(parts[2], 10) <= 12) {
      return `${parts[0]}-${parts[2]}-${parts[1]}`;
    }
    return dataStr;
  }
  return null;
}

function normalizarEnum(valor: any, map: Record<string, number>): number | null {
  if (typeof valor === 'number') return valor;
  if (!valor) return null;
  const normal = String(valor).toLowerCase().trim();
  return map[normal] !== undefined ? map[normal] : null;
}

const TIPO_EXAME_MAP: Record<string, number> = {
  'admissional': 0,
  'periodico': 1,
  'periódico': 1,
  'retorno': 2,
  'retorno ao trabalho': 2,
  'mudanca': 3,
  'mudança': 3,
  'mudanca de funcao': 3,
  'mudança de função': 3,
  'mudanca de risco': 3,
  'mudança de risco': 3,
  'pontual': 4,
  'monitoracao pontual': 4,
  'monitoração pontual': 4,
  'demissional': 9,
  '0': 0,
  '1': 1,
  '2': 2,
  '3': 3,
  '4': 4,
  '9': 9
};

const RESULTADO_ASO_MAP: Record<string, number> = {
  'apto': 1,
  'apto com restricao': 1,
  'apto com restrição': 1,
  'inapto': 2,
  '1': 1,
  '2': 2
};

const UFS_VALIDAS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];

export function autoCorrigirDadosEvento(codigoEvento: string, dadosEvento: any, tpAmbDefault: number = 2): ResultadoCorrecao {
  const dados = deepClone(dadosEvento || {});
  if (!dados.dadosEspecificos) dados.dadosEspecificos = {};
  
  const correcoes: Correcao[] = [];
  let xmlPrecisaRebuildar = false;

  const aplicarCorrecao = (obj: any, campo: string, novoValor: any, descricao: string) => {
    if (obj && obj[campo] !== undefined && obj[campo] !== novoValor) {
      correcoes.push({ campo, de: String(obj[campo]), para: String(novoValor), descricao });
      obj[campo] = novoValor;
      xmlPrecisaRebuildar = true;
    } else if (obj && obj[campo] === undefined) {
      correcoes.push({ campo, de: 'ausente', para: String(novoValor), descricao });
      obj[campo] = novoValor;
      xmlPrecisaRebuildar = true;
    }
  };

  const aplicarDuplo = (campo: string, novoValor: any, descricao: string) => {
    aplicarCorrecao(dados, campo, novoValor, descricao);
    if (!dados.dadosEspecificos) dados.dadosEspecificos = {};
    aplicarCorrecao(dados.dadosEspecificos, campo, novoValor, descricao);
  };

  // 1. Correção de CPF
  ['cpf', 'cpfTrab'].forEach(c => {
    const val = dados[c] || dados.dadosEspecificos[c];
    if (val && typeof val === 'string' && /\D/.test(val)) {
      const clean = val.replace(/\D/g, '').padStart(11, '0');
      aplicarDuplo(c, clean, 'Formatação de CPF');
    }
  });

  // 2. Correção de CNPJ
  const cnpjAtual = dados.cnpj || dados.nrInsc || dados.dadosEspecificos.cnpj || dados.dadosEspecificos.nrInsc;
  if (!cnpjAtual) {
    aplicarDuplo('cnpj', '17784306000189', 'CNPJ Padrão do Empregador');
    aplicarDuplo('nrInsc', '17784306000189', 'CNPJ Padrão do Empregador');
  } else {
    ['cnpj', 'nrInsc'].forEach(c => {
      const val = dados[c] || dados.dadosEspecificos[c];
      if (val && typeof val === 'string' && /\D/.test(val)) {
        const clean = val.replace(/\D/g, '');
        aplicarDuplo(c, clean, 'Formatação de CNPJ');
      }
    });
  }

  // 3. Correção de Datas
  const corrigirData = (obj: any, campo: string) => {
    if (obj && obj[campo]) {
      const norm = normalizarData(String(obj[campo]));
      if (norm && norm !== obj[campo]) {
        aplicarCorrecao(obj, campo, norm, 'Formatação de Data (YYYY-MM-DD)');
      }
    }
  };

  Object.keys(dados).forEach(k => {
    if (k.startsWith('dt') || k.toLowerCase().includes('data')) corrigirData(dados, k);
  });
  Object.keys(dados.dadosEspecificos).forEach(k => {
    if (k.startsWith('dt') || k.toLowerCase().includes('data')) corrigirData(dados.dadosEspecificos, k);
  });

  // 4. Correção tpAmb
  if (!dados.tpAmb) aplicarCorrecao(dados, 'tpAmb', tpAmbDefault, 'Ambiente Padrão');

  // 5. Correção procEmi e verProc
  if (!dados.procEmi) aplicarCorrecao(dados, 'procEmi', 1, 'Processo de Emissão Padrão');
  if (!dados.verProc) aplicarCorrecao(dados, 'verProc', '5.14.0', 'Versão do Processo Padrão');
  if (!dados.indRetif) aplicarCorrecao(dados, 'indRetif', 1, 'Indicativo de Retificação Padrão');

  // 6. Correção de UFs
  ['ufCRM', 'medico_uf', 'uf_pcmso', 'medico_pcmso_uf'].forEach(c => {
    const val = dados[c] || dados.dadosEspecificos[c];
    if (val && typeof val === 'string') {
      const clean = val.trim().toUpperCase();
      if (clean !== val && UFS_VALIDAS.includes(clean)) {
        aplicarDuplo(c, clean, 'Normalização de UF');
      }
    }
  });

  // 7. Correção de nrCRM
  ['nrCRM', 'medico_crm', 'crm', 'crm_pcmso', 'medico_pcmso_crm'].forEach(c => {
    const val = dados[c] || dados.dadosEspecificos[c];
    if (val && typeof val === 'string' && /\D/.test(val)) {
      const clean = val.replace(/\D/g, '');
      aplicarDuplo(c, clean, 'Remoção de letras do CRM');
    }
  });

  // 8. Sincronização de Matrícula
  const matSocial = dados.matricula_esocial || dados.dadosEspecificos.matricula_esocial;
  const mat = dados.matricula || dados.dadosEspecificos.matricula;
  if (matSocial && !mat) {
    aplicarDuplo('matricula', matSocial, 'Cópia de matricula_esocial para matricula');
  } else if (!matSocial && mat) {
    aplicarDuplo('matricula_esocial', mat, 'Cópia de matricula para matricula_esocial');
  }

  // 9. Nomes TS_nome (nmMed / nmResp / nmTrab) — OCR com cargo, quebra de linha e lixo
  const escreverNomeAninhado = (obj: any, campo: string, limpo: string, descricao: string) => {
    if (!obj || typeof obj !== 'object') return;
    if (obj[campo] !== undefined && obj[campo] !== limpo) {
      aplicarCorrecao(obj, campo, limpo, descricao);
    }
  };

  const aplicarAliasesNome = (aliases: readonly string[], limpo: string, descricao: string) => {
    for (const alias of aliases) {
      aplicarDuplo(alias, limpo, descricao);
    }
  };

  const nomeMedicoBruto = coletarNomeMedico(dados);
  const nomeMedicoLimpo = sanitizeTsNome(nomeMedicoBruto);
  if (nomeMedicoLimpo && nomeMedicoLimpo !== nomeMedicoBruto) {
    const descMed = 'Sanitização TS_nome do médico (OCR/XSD)';
    aplicarAliasesNome(CAMPOS_NOME_MEDICO, nomeMedicoLimpo, descMed);
    if (typeof dados.medico === 'string') aplicarCorrecao(dados, 'medico', nomeMedicoLimpo, descMed);
    if (typeof dados.dadosEspecificos.medico === 'string') {
      aplicarCorrecao(dados.dadosEspecificos, 'medico', nomeMedicoLimpo, descMed);
    }
    escreverNomeAninhado(dados.medico, 'nmMed', nomeMedicoLimpo, descMed);
    escreverNomeAninhado(dados.dadosEspecificos.medico, 'nmMed', nomeMedicoLimpo, descMed);
    escreverNomeAninhado(dados.aso?.medico, 'nmMed', nomeMedicoLimpo, descMed);
    escreverNomeAninhado(dados.dadosEspecificos.aso?.medico, 'nmMed', nomeMedicoLimpo, descMed);
    escreverNomeAninhado(dados.exMedOcup?.medico, 'nmMed', nomeMedicoLimpo, descMed);
    escreverNomeAninhado(dados.exMedOcup?.aso?.medico, 'nmMed', nomeMedicoLimpo, descMed);
    escreverNomeAninhado(dados.dadosEspecificos.exMedOcup?.medico, 'nmMed', nomeMedicoLimpo, descMed);
    escreverNomeAninhado(dados.dadosEspecificos.exMedOcup?.aso?.medico, 'nmMed', nomeMedicoLimpo, descMed);
  }

  const nomePcmsoBruto = coletarNomePcmso(dados);
  const nomePcmsoLimpo = sanitizeTsNome(nomePcmsoBruto);
  if (nomePcmsoLimpo && nomePcmsoLimpo !== nomePcmsoBruto) {
    const descPcmso = 'Sanitização TS_nome do responsável PCMSO (OCR/XSD)';
    aplicarAliasesNome(CAMPOS_NOME_PCMSO, nomePcmsoLimpo, descPcmso);
    escreverNomeAninhado(dados.respMonit, 'nmResp', nomePcmsoLimpo, descPcmso);
    escreverNomeAninhado(dados.dadosEspecificos.respMonit, 'nmResp', nomePcmsoLimpo, descPcmso);
    escreverNomeAninhado(dados.exMedOcup?.respMonit, 'nmResp', nomePcmsoLimpo, descPcmso);
  }

  for (const campo of CAMPOS_NOME_TRAB) {
    const bruto = dados[campo] || dados.dadosEspecificos[campo];
    if (typeof bruto === 'string') {
      const limpo = sanitizeTsNome(bruto);
      if (limpo && limpo !== bruto) aplicarDuplo(campo, limpo, 'Sanitização TS_nome do trabalhador');
    }
  }

  // 10. Correções específicas S-2220
  if (codigoEvento === 'S-2220') {
    const tpExame = dados.dadosEspecificos.tipoExame || dados.dadosEspecificos.tpExameOcup;
    if (tpExame && typeof tpExame === 'string') {
      const norm = normalizarEnum(tpExame, TIPO_EXAME_MAP);
      if (norm !== null) {
        aplicarCorrecao(dados.dadosEspecificos, dados.dadosEspecificos.tipoExame ? 'tipoExame' : 'tpExameOcup', norm, 'Conversão Tipo de Exame');
      }
    }

    const resAso = dados.dadosEspecificos.resultado || dados.dadosEspecificos.resAso;
    if (resAso && typeof resAso === 'string') {
      const norm = normalizarEnum(resAso, RESULTADO_ASO_MAP);
      if (norm !== null) {
        aplicarCorrecao(dados.dadosEspecificos, dados.dadosEspecificos.resultado ? 'resultado' : 'resAso', norm, 'Conversão Resultado ASO');
      }
    }
  }

  // 11. Correções específicas S-2200
  if (codigoEvento === 'S-2200') {
    const tipoAdm = dados.tipoAdmissao || dados.dadosEspecificos.tipoAdmissao;
    if (!tipoAdm) {
      aplicarDuplo('tipoAdmissao', '1', 'Tipo de Admissão Padrão (1 - Admissão)');
    }
    const cbo = dados.codCBO || dados.cbo || dados.dadosEspecificos.codCBO || dados.dadosEspecificos.cbo;
    if (!cbo) {
      aplicarDuplo('codCBO', '215105', 'CBO Padrão Marítimo (2151-05)');
    }
  }

  return {
    dadosCorrigidos: dados,
    correcoes,
    xmlPrecisaRebuildar
  };
}
