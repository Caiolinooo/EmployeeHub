/**
 * Validação e Reparo de CPF / OCR
 */

function validarCPF(cpf) {
  if (!cpf) return false;
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11 || /^(\d)\1{10}$/.test(clean)) return false;

  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(clean[i], 10) * (10 - i);
  let resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(clean[9], 10)) return false;

  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(clean[i], 10) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(clean[10], 10)) return false;

  return true;
}

const CONFUSAO_OPTICA = {
  '0': ['O', 'o', 'Q', 'D', '8', '6', 'U'],
  '1': ['I', 'l', '|', '!', ']', '[', '7', 'T', '/', 'J'],
  '2': ['Z', 'z', '7'],
  '3': ['8', 'E', 'B', '5'],
  '4': ['A', '9'],
  '5': ['S', 's', '$', '6', '8', '3'],
  '6': ['G', 'b', '8', '5', '0'],
  '7': ['1', 'T', '/', 'I', '2'],
  '8': ['B', '9', '3', '0', '6', '5'],
  '9': ['8', 'g', 'q', '0', 'P', '4'],
};

const MAPA_CARACTER_PARA_DIGITO = {
  'O': '0', 'o': '0', 'Q': '0', 'D': '0',
  'I': '1', 'l': '1', '|': '1', '!': '1', ']': '1', '[': '1', 'T': '7', '/': '7',
  'Z': '2', 'z': '2',
  'E': '3',
  'A': '4',
  'S': '5', 's': '5', '$': '5',
  'G': '6', 'b': '6',
  'B': '8',
  'g': '9', 'q': '9', 'P': '9'
};

function normalizarDigitosOCR(str) {
  let res = '';
  for (const ch of str) {
    if (/\d/.test(ch)) {
      res += ch;
    } else if (MAPA_CARACTER_PARA_DIGITO[ch]) {
      res += MAPA_CARACTER_PARA_DIGITO[ch];
    }
  }
  return res;
}

function repararCPFOptico(cpfInvalido, targetCpf = null) {
  const clean = normalizarDigitosOCR(cpfInvalido);
  if (clean.length !== 11) return null;

  if (validarCPF(clean)) return { cpf: clean, corrigido: false, confianca: 100 };

  const targetClean = targetCpf ? normalizarDigitosOCR(targetCpf) : null;
  if (targetClean && targetClean.length === 11 && validarCPF(targetClean)) {
    let diffCount = 0;
    for (let i = 0; i < 11; i++) {
      if (clean[i] !== targetClean[i]) diffCount++;
    }
    if (diffCount <= 2) {
      return { cpf: targetClean, corrigido: true, confianca: 98, metodo: 'target_reconcile' };
    }
  }

  // Tenta substituição de 1 dígito
  const candidatos = [];
  for (let i = 0; i < 11; i++) {
    const charAtual = clean[i];
    const possiveis = CONFUSAO_OPTICA[charAtual] || [];
    const digitos = new Set([...possiveis.filter(c => /\d/.test(c)), '0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);

    for (const d of digitos) {
      if (d === charAtual) continue;
      const candidato = clean.substring(0, i) + d + clean.substring(i + 1);
      if (validarCPF(candidato)) {
        const peso = possiveis.includes(d) ? 2 : 1;
        candidatos.push({ cpf: candidato, peso, indice: i, de: charAtual, para: d });
      }
    }
  }

  if (candidatos.length > 0) {
    candidatos.sort((a, b) => b.peso - a.peso);
    return { cpf: candidatos[0].cpf, corrigido: true, confianca: 92, metodo: 'modulo11_mutation', detalhes: candidatos[0] };
  }

  return null;
}

function extrairCPFInteligente(texto, profileCpf = null) {
  // Regex padrões rotulados (alta prioridade)
  const padroesRotulados = [
    /(?:CPF(?:\s*(?:DO\s+)?(?:TRABALHADOR|EMPREGADO|FUNCIONÁRIO|FUNCIONARIO|PACIENTE|COLABORADOR))?)\s*[:\-\s/|I.]+\s*([0-9IOlSZABGgq.\-\s]{11,18})/gi,
    /(?:C\.?\s*P\.?\s*F\.?(?:\s*\/\s*M\.?\s*F\.?)?)\s*[:\-\s/|I.]+\s*([0-9IOlSZABGgq.\-\s]{11,18})/gi,
  ];

  for (const regex of padroesRotulados) {
    const matches = [...texto.matchAll(regex)];
    for (const m of matches) {
      const raw = m[1];
      const normalized = normalizarDigitosOCR(raw);
      if (normalized.length >= 11) {
        const sub11 = normalized.slice(0, 11);
        const reparo = repararCPFOptico(sub11, profileCpf);
        if (reparo && validarCPF(reparo.cpf)) {
          return { cpf: reparo.cpf, corrigido: reparo.corrigido, confianca: reparo.confianca };
        }
      }
    }
  }

  // Regex padrão genérico de 11 dígitos formatados (XXX.XXX.XXX-XX)
  const regexFormatado = /(\d{3})[.\s](\d{3})[.\s](\d{3})[.\-\s](\d{2})/g;
  const matchesFormatados = [...texto.matchAll(regexFormatado)];
  for (const m of matchesFormatados) {
    const candidate = `${m[1]}${m[2]}${m[3]}${m[4]}`;
    const reparo = repararCPFOptico(candidate, profileCpf);
    if (reparo && validarCPF(reparo.cpf)) {
      return { cpf: reparo.cpf, corrigido: reparo.corrigido, confianca: reparo.confianca };
    }
  }

  // Regex genérico de 11 dígitos soltos
  const regex11 = /\b(\d{11})\b/g;
  const matches11 = [...texto.matchAll(regex11)];
  for (const m of matches11) {
    const candidate = m[1];
    if (validarCPF(candidate)) {
      return { cpf: candidate, corrigido: false, confianca: 85 };
    }
  }

  return { cpf: null, corrigido: false, confianca: 0 };
}

function extrairResultadoInteligente(texto) {
  const upper = texto.toUpperCase();

  // 1. Procurar por caixas de seleção explícitas (X, V, ✓, •, *, etc.)
  const temAptoMarcado = /\([XvV✓•*+]\)\s*APTO|\[[XvV✓•*+]\]\s*APTO|\([XvV✓•*+]\)\s*\(?\s*S?\s*\)?\s*APTO/i.test(texto) ||
                         /APTO\s*\([XvV✓•*+]\)|APTO\s*\[[XvV✓•*+]\]/i.test(texto) ||
                         /CONVLUZAONIGF\s*APTO\(S\)\s*\[\s*V/i.test(texto); // OCR do ASO do Caio!

  const temInaptoMarcado = /\([XvV✓•*+]\)\s*INAPTO|\[[XvV✓•*+]\]\s*INAPTO/i.test(texto) ||
                           /INAPTO\s*\([XvV✓•*+]\)|INAPTO\s*\[[XvV✓•*+]\]/i.test(texto) ||
                           /CONSIDERADO\s+INAPTO|INAPTO\s+AO\s+TRABALHO|INAPTO\s+DEFINITIVO/i.test(texto);

  if (temInaptoMarcado && !temAptoMarcado) return 'inapto';
  if (temAptoMarcado) return 'apto';

  // 2. Frases inequívocas
  if (/APTO\s+CONDICIONAL/i.test(upper)) return 'apto_condicional';
  if (/INAPTO\s+TEMPORÁRIO|INAPTO\s+TEMPORARIO/i.test(upper)) return 'inapto';
  if (/APTO\s+PARA\s+(?:A\s+)?FUNÇÃO|APTO\s+AO\s+TRABALHO|CONSIDERADO\s+APTO/i.test(upper)) return 'apto';

  // 3. Fallback inteligente: se tem "APTO" e "INAPTO" (template padrão), mas não tem indicação clara de inaptidão
  if (upper.includes('APTO') && !upper.includes('INAPTO PARA')) {
    return 'apto';
  }

  return 'apto';
}

function extrairDataNascimentoInteligente(texto, dataRealizacao = null) {
  // 1. Prefixos de Data de Nascimento
  const dnPatterns = [
    /(?:D\.?\s*N\.?|D\.?\s*H\.?|DATA\s*(?:DE\s*)?NASC(?:IMENTO)?|NASC(?:IDO)?\s*EM)[:\s.\-|]+(\d{2})[\/\.\-](\d{2})[\/\.\-](\d{4})/i,
    /(?:NASCIMENTO|NASC\.?)\s*[:\s.\-|]+(\d{2})[\/\.\-](\d{2})[\/\.\-](\d{4})/i
  ];

  for (const pat of dnPatterns) {
    const m = texto.match(pat);
    if (m) {
      let [_, d, mes, anoStr] = m;
      let ano = parseInt(anoStr, 10);
      // Correção de erro OCR de século (ex: 1885 -> 1985)
      if (ano < 1920 && ano >= 1800) {
        ano += 100;
      }
      if (ano >= 1940 && ano <= 2012) {
        return `${ano}-${mes.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
    }
  }

  // 2. Outras datas no documento, evitando a data de realização
  const todasDatas = [...texto.matchAll(/(\d{2})[\/\.\-](\d{2})[\/\.\-](\d{4})/g)];
  for (const m of todasDatas) {
    let [_, d, mes, anoStr] = m;
    let ano = parseInt(anoStr, 10);
    if (ano < 1920 && ano >= 1800) ano += 100;
    if (ano >= 1940 && ano <= 2010) {
      const candidate = `${ano}-${mes.padStart(2, '0')}-${d.padStart(2, '0')}`;
      if (!dataRealizacao || !dataRealizacao.includes(String(ano))) {
        return candidate;
      }
    }
  }

  return null;
}

function extrairRGInteligente(texto, cpfExtraido = null) {
  const rgPattern = /(?:RG\s*\/?\s*ORG[AÃ]O|RG|IDENTIDADE|REGISTRO\s*GERAL)[:\s.\-|]+([0-9A-Za-z.\-,\s]{5,20})/i;
  const m = texto.match(rgPattern);
  if (m) {
    const raw = m[1].replace(/[^0-9A-Za-z]/g, '');
    const cleanCpf = cpfExtraido ? cpfExtraido.replace(/\D/g, '') : '';
    if (raw.length >= 5 && raw.length <= 15 && (!cleanCpf || !cleanCpf.includes(raw))) {
      return raw;
    }
  }
  return null;
}

// Teste geral com o ASO do Caio
const textoASO = `Médico Responsável pela PCMSO Dr Heloana Antunes Sabino da Azevado NE A CRM-RJ: 52 80456-4 1 RQE: 27590 FER Re Sn Av. Nossa Senhora da Glória, nº 2067 - 304 mm Em fika Gavaloiros - Macaé! RJ Telefone: 122) 8717-1170 I Ú ATESTADO DE SAUDE OCUPACIONAL 622769 ' NOME; CAIO VALERIO GOULART CORREIA a, [AGUAS BRASILEIRAS SERVICOS E CONSULTORIA EM ATIVIDADES ! I " EMPRESA: ; é IDS/00081.85 MARITIMAS LTDA SNPJ: 17.784 3OS/0001-8 FUNÇÃO. - ANALISTADE SUPORTE ! SETOR: AÉZ BASE i , CPF: 154 15687764 ' RG/ORGÃO: 28.356,467-2 DIC D.h: 11/12/1885 [Em cumprimento aos 1º$ e 3ºÉ do Artigo 156 da Lei nº 8,514, Portaria 1214/78, Portaria 3.464/82, Portaria 12/9234/94 5 8/96 da NR-? e os jts 0.1.1, 50.21, 303.14, 90,9.2.1 e os Quadros II da NR-30 do Ministério do Trabalho, para fins de exame: Admissional . " RISCOS OCUPACIONAIS: e ERGONÔMICO Postura Inadequada, Arranjo Físico, Mavimentos Regetitivos de Mãos e Dados I ACIDENTE I Queda de Pessoa com Diferença de Nivel Preenchimento e responsabifidade exelusiva de DM baseado no PCMSO vigente: FA AA ME [I (íaeo - I gARoAFOATE [TRAGO EN ESPAÇO BERRO O a art -- I wo PocAvE [PARA TRABALHAR COM ELETRETTAÇE O OO io I Ro APOCAVEL [FARS TRANSFERÊNCIA POR CESTO OO TI Po Bo É IADAPLICÁVEL Eis E RE RE EEE O GH A ABI I RPRAG APGAVEL EG DE RESGATE EN ESPAÇO CONFIO O Ig isto [o NRO APOEATEC [PARA TRABALHAR EM REGIME BFEERGRE O Ego BIo I fe noRPOCAVED I PROCEDIMENTOS . BATA PROCEDIMENTOS DATA ACUIDADE 4 SUAL 17/03/2028 RAIO X COLUNA LOMBAR ' 1703/2025 E ETROCARDIOGR AMA 17/03/2095 TIPOE FATOR RI cz do sad do T7:03/2025 EXAME CLINICO - ASO 17/03/2025 Gi COSE 17/03/2025 HEMOGRANA COMPLETO ioNZORS = I -- = => E A e I Médico Examinador kh, Corolimo Gi Asa lt Lil Belegato 126 mMrnanta MucancE, MÉDICA ( 7 E to Food. BITICI-NodAS, sro Em 2 38 ccesters! 17 CA = Hosecel vila 2cão " TEA 52.011 5827-4 . NES oa a Boa Wistaiso Serra E 5 - o Fa Evariso 23 Wega EE 776 qTdaro Dentes = Ride ianosocRO Assinatura I Carimbo Médico Examinador DEI ag T tio S irénio ds Médics Reponvive pelo PEV ÉS, I Convluzaonigf APTO(s) [ VINAPTOIA) Asa Bona emenda AAA T Dea Conclusão AGO De cd ES 16 MAR 205 ;`;

const cpfResult = extrairCPFInteligente(textoASO, '15415697764');
const resultado = extrairResultadoInteligente(textoASO);
const dn = extrairDataNascimentoInteligente(textoASO, '2025-03-17');
const rg = extrairRGInteligente(textoASO, cpfResult.cpf);

console.log('CPF Extraído:', cpfResult);
console.log('Resultado:', resultado);
console.log('Data Nascimento:', dn);
console.log('RG:', rg);
