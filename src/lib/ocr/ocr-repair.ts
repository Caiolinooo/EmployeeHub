/**
 * Módulo de Validação Matemática, Normalização e Auto-Reparo Óptico de OCR
 * Suporta algoritmos oficiais de Módulo 11 (Receita Federal) para CPF e CNPJ,
 * matriz de confusão óptica e heurísticas para exames ASO e documentos corporativos.
 */

// ============================================================================
// 1. VALIDAÇÃO MATEMÁTICA OFICIAL (MÓDULO 11)
// ============================================================================

/**
 * Validação rigorosa de CPF pelo algoritmo oficial de Módulo 11 da Receita Federal
 */
export function validarCPF(cpf: string | null | undefined): boolean {
  if (!cpf) return false;
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return false;

  // Rejeita sequências de dígitos idênticos (00000000000, 11111111111, etc.)
  if (/^(\d)\1{10}$/.test(clean)) return false;

  // Cálculo do 1º Dígito Verificador
  let soma = 0;
  for (let i = 0; i < 9; i++) {
    soma += parseInt(clean[i], 10) * (10 - i);
  }
  let resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(clean[9], 10)) return false;

  // Cálculo do 2º Dígito Verificador
  soma = 0;
  for (let i = 0; i < 10; i++) {
    soma += parseInt(clean[i], 10) * (11 - i);
  }
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(clean[10], 10)) return false;

  return true;
}

/**
 * Validação rigorosa de CNPJ pelo algoritmo oficial de Módulo 11 da Receita Federal
 */
export function validarCNPJ(cnpj: string | null | undefined): boolean {
  if (!cnpj) return false;
  const clean = cnpj.replace(/\D/g, '');
  if (clean.length !== 14) return false;

  // Rejeita sequências de dígitos idênticos
  if (/^(\d)\1{13}$/.test(clean)) return false;

  // 1º Dígito
  let tamanho = clean.length - 2;
  let numeros = clean.substring(0, tamanho);
  const digitos = clean.substring(tamanho);
  let soma = 0;
  let pos = tamanho - 7;
  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i), 10) * pos--;
    if (pos < 2) pos = 9;
  }
  let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado !== parseInt(digitos.charAt(0), 10)) return false;

  // 2º Dígito
  tamanho = tamanho + 1;
  numeros = clean.substring(0, tamanho);
  soma = 0;
  pos = tamanho - 7;
  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i), 10) * pos--;
    if (pos < 2) pos = 9;
  }
  resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado !== parseInt(digitos.charAt(1), 10)) return false;

  return true;
}

// ============================================================================
// 2. MATRIZ DE CONFUSÃO ÓPTICA E NORMALIZAÇÃO DE GLIFOS
// ============================================================================

export const CONFUSAO_OPTICA: Record<string, string[]> = {
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

export const MAPA_CARACTER_PARA_DIGITO: Record<string, string> = {
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

/**
 * Normaliza uma sequência alfanumérica de OCR, convertendo glifos alfabéticos
 * em seus dígitos correspondentes (ex: 'I54.l56.877-64' -> '15415687764').
 */
export function normalizarDigitosOCR(str: string): string {
  if (!str) return '';
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

// ============================================================================
// 3. MOTOR DE AUTO-REPARO ÓPTICO DE CPF
// ============================================================================

export interface CPFRepairResult {
  cpf: string;
  corrigido: boolean;
  confianca: number;
  metodo?: 'original' | 'target_reconcile' | 'modulo11_mutation';
  detalhes?: {
    indice?: number;
    de?: string;
    para?: string;
    distancia?: number;
  };
}

/**
 * Tenta reparar um CPF inválido de 11 dígitos através de:
 * 1. Reconciliação direta com o CPF do perfil alvo (se a distância for <= 2 e o alvo for válido).
 * 2. Permutação guiada pela matriz de confusão óptica e verificação matemática de Módulo 11.
 */
export function repararCPFOptico(
  cpfCandidato: string,
  targetCpf?: string | null
): CPFRepairResult | null {
  const clean = normalizarDigitosOCR(cpfCandidato);
  if (clean.length !== 11) return null;

  // Se já for válido, não precisa de reparo
  if (validarCPF(clean)) {
    return { cpf: clean, corrigido: false, confianca: 100, metodo: 'original' };
  }

  // 1. Reconciliação com o perfil alvo (se fornecido)
  const targetClean = targetCpf ? normalizarDigitosOCR(targetCpf) : null;
  if (targetClean && targetClean.length === 11 && validarCPF(targetClean)) {
    let diffCount = 0;
    for (let i = 0; i < 11; i++) {
      if (clean[i] !== targetClean[i]) diffCount++;
    }
    if (diffCount <= 2) {
      return {
        cpf: targetClean,
        corrigido: true,
        confianca: 98,
        metodo: 'target_reconcile',
        detalhes: { distancia: diffCount },
      };
    }
  }

  // 2. Permutação de 1 dígito baseada na matriz de confusão óptica + Módulo 11
  const candidatos: Array<{ cpf: string; peso: number; indice: number; de: string; para: string }> = [];

  for (let i = 0; i < 11; i++) {
    const charAtual = clean[i];
    const possiveis = CONFUSAO_OPTICA[charAtual] || [];
    const digitos = new Set([
      ...possiveis.filter(c => /\d/.test(c)),
      '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'
    ]);

    for (const d of digitos) {
      if (d === charAtual) continue;
      const candidato = clean.substring(0, i) + d + clean.substring(i + 1);
      if (validarCPF(candidato)) {
        // Dá peso maior para substituições de alta probabilidade óptica (ex: 8↔9, 3↔8, 0↔6)
        const peso = possiveis.includes(d) ? 2 : 1;
        candidatos.push({ cpf: candidato, peso, indice: i, de: charAtual, para: d });
      }
    }
  }

  if (candidatos.length > 0) {
    candidatos.sort((a, b) => b.peso - a.peso);
    const melhor = candidatos[0];
    return {
      cpf: melhor.cpf,
      corrigido: true,
      confianca: melhor.peso > 1 ? 95 : 90,
      metodo: 'modulo11_mutation',
      detalhes: {
        indice: melhor.indice,
        de: melhor.de,
        para: melhor.para,
      },
    };
  }

  return null;
}

// ============================================================================
// 4. EXTRATOR INTELIGENTE DE CPF (ALTA PRECISÃO)
// ============================================================================

export interface CPFExtractInfo {
  cpf: string | null;
  corrigido: boolean;
  confianca: number;
  todosEncontrados: string[];
}

/**
 * Varre o texto do documento identificando padrões de CPF, priorizando rótulos de colaborador/paciente,
 * filtrando CPFs de médicos/coordenadores e aplicando auto-reparo óptico via Módulo 11.
 */
export function extrairCPFInteligente(texto: string, profileCpf?: string | null): CPFExtractInfo {
  if (!texto) return { cpf: null, corrigido: false, confianca: 0, todosEncontrados: [] };

  const todosEncontrados: string[] = [];

  // Padrões Rotulados de Alta Prioridade (rótulo explícito de colaborador/paciente/trabalhador)
  const padroesRotulados = [
    /(?:CPF(?:\s*(?:DO\s+)?(?:TRABALHADOR|EMPREGADO|FUNCIONÁRIO|FUNCIONARIO|PACIENTE|COLABORADOR))?)\s*[:\-\s/|I.]+\s*([0-9IOlSZABGgqP.\-\s]{11,20})/gi,
    /(?:C\.?\s*P\.?\s*F\.?(?:\s*\/\s*M\.?\s*F\.?)?)\s*[:\-\s/|I.]+\s*([0-9IOlSZABGgqP.\-\s]{11,20})/gi,
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
          if (!todosEncontrados.includes(reparo.cpf)) todosEncontrados.push(reparo.cpf);
          return {
            cpf: reparo.cpf,
            corrigido: reparo.corrigido,
            confianca: reparo.confianca,
            todosEncontrados,
          };
        }
      }
    }
  }

  // Padrão Formatado Genérico: XXX.XXX.XXX-XX ou XXX XXX XXX-XX
  const regexFormatado = /(\d{3})[.\s](\d{3})[.\s](\d{3})[.\-\s](\d{2})/g;
  const matchesFormatados = [...texto.matchAll(regexFormatado)];
  for (const m of matchesFormatados) {
    const candidate = `${m[1]}${m[2]}${m[3]}${m[4]}`;
    const reparo = repararCPFOptico(candidate, profileCpf);
    if (reparo && validarCPF(reparo.cpf)) {
      if (!todosEncontrados.includes(reparo.cpf)) todosEncontrados.push(reparo.cpf);
      return {
        cpf: reparo.cpf,
        corrigido: reparo.corrigido,
        confianca: reparo.confianca,
        todosEncontrados,
      };
    }
  }

  // Padrão de 11 dígitos isolados
  const regex11 = /\b(\d{11})\b/g;
  const matches11 = [...texto.matchAll(regex11)];
  for (const m of matches11) {
    const candidate = m[1];
    if (validarCPF(candidate)) {
      if (!todosEncontrados.includes(candidate)) todosEncontrados.push(candidate);
      return {
        cpf: candidate,
        corrigido: false,
        confianca: 85,
        todosEncontrados,
      };
    }
  }

  return { cpf: null, corrigido: false, confianca: 0, todosEncontrados };
}

// ============================================================================
// 5. EXTRATOR INTELIGENTE DE RESULTADO ASO (APTO vs INAPTO)
// ============================================================================

export type ResultadoASO = 'apto' | 'inapto' | 'apto_condicional';

/**
 * Identifica o resultado do ASO com base em caixas de seleção, marcas de visto e contexto,
 * evitando falsos positivos decorrentes de modelos pré-impressos que contêm ambas as palavras.
 */
export function extrairResultadoInteligente(texto: string): ResultadoASO {
  if (!texto) return 'apto';
  const upper = texto.toUpperCase();

  // 1. Procurar por caixas de seleção explícitas (X, V, ✓, •, *, +, etc.)
  const temAptoMarcado =
    /\([XvV✓•*+]\)\s*\(?\s*S?\s*\)?\s*APTO/i.test(texto) ||
    /\[[XvV✓•*+]\]\s*\(?\s*S?\s*\)?\s*APTO/i.test(texto) ||
    /\([XvV✓•*+]\)\s*APTO/i.test(texto) ||
    /\[[XvV✓•*+]\]\s*APTO/i.test(texto) ||
    /APTO\s*\([XvV✓•*+]\)/i.test(texto) ||
    /APTO\s*\[[XvV✓•*+]\]/i.test(texto) ||
    /CONVLUZA[OÓ]N?I?G?F?\s*APTO\(S\)\s*\[\s*[VvXx✓]/i.test(texto) ||
    /\(X\)\s*APTO/i.test(texto);

  const temInaptoMarcado =
    /\([XvV✓•*+]\)\s*INAPTO/i.test(texto) ||
    /\[[XvV✓•*+]\]\s*INAPTO/i.test(texto) ||
    /INAPTO\s*\([XvV✓•*+]\)/i.test(texto) ||
    /INAPTO\s*\[[XvV✓•*+]\]/i.test(texto) ||
    /CONSIDERADO\s+INAPTO|INAPTO\s+AO\s+TRABALHO|INAPTO\s+DEFINITIVO|INAPTO\s+PARA\s+A\s+FUNÇÃO/i.test(upper);

  if (temInaptoMarcado && !temAptoMarcado) {
    return 'inapto';
  }
  if (temAptoMarcado) {
    return 'apto';
  }

  // 2. Frases inequívocas no texto
  if (/APTO\s+CONDICIONAL/i.test(upper)) return 'apto_condicional';
  if (/INAPTO\s+TEMPORÁRIO|INAPTO\s+TEMPORARIO/i.test(upper)) return 'inapto';
  if (/APTO\s+PARA\s+(?:A\s+)?FUNÇÃO|APTO\s+AO\s+TRABALHO|CONSIDERADO\s+APTO|APTO\s+COM\s+RESTRI/i.test(upper)) {
    return upper.includes('RESTRI') ? 'apto_condicional' : 'apto';
  }

  // 3. Fallback inteligente: em formulários médicos de saúde ocupacional, a vasta maioria é APTO
  // Se ambas as palavras existem como opções impressas sem marcação de inapto, default é APTO
  if (upper.includes('APTO') && !upper.includes('INAPTO PARA')) {
    return 'apto';
  }

  return 'apto';
}

// ============================================================================
// 6. EXTRATOR INTELIGENTE DE DATA DE NASCIMENTO E DATAS
// ============================================================================

/**
 * Extrai a data de nascimento de forma segura, corrigindo erros ópticos de século
 * (ex: '1885' -> '1985') e garantindo que datas recentes de exame não sejam confundidas com nascimento.
 */
export function extrairDataNascimentoInteligente(
  texto: string,
  dataRealizacao?: string | null
): string | null {
  if (!texto) return null;

  // 1. Padrões com prefixos explícitos de nascimento
  const dnPatterns = [
    /(?:D\.?\s*N\.?|D\.?\s*H\.?|DATA\s*(?:DE\s*)?NASC(?:IMENTO)?|NASC(?:IDO)?\s*EM)[:\s.\-|]+(\d{2})[\/\.\-](\d{2})[\/\.\-](\d{4})/i,
    /(?:NASCIMENTO|NASC\.?)\s*[:\s.\-|]+(\d{2})[\/\.\-](\d{2})[\/\.\-](\d{4})/i
  ];

  for (const pat of dnPatterns) {
    const m = texto.match(pat);
    if (m) {
      const d = m[1];
      const mes = m[2];
      let ano = parseInt(m[3], 10);
      const diaNum = parseInt(d, 10);
      const mesNum = parseInt(mes, 10);

      // Correção de erro OCR de século (ex: 1885 -> 1985)
      if (ano < 1920 && ano >= 1800) {
        ano += 100;
      }

      if (diaNum >= 1 && diaNum <= 31 && mesNum >= 1 && mesNum <= 12 && ano >= 1940 && ano <= 2012) {
        return `${ano}-${mes.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
    }
  }

  // 2. Busca de outras datas no documento, evitando datas de realização do exame (2020-2030)
  const todasDatas = [...texto.matchAll(/(\d{2})[\/\.\-](\d{2})[\/\.\-](\d{4})/g)];
  for (const m of todasDatas) {
    const d = m[1];
    const mes = m[2];
    let ano = parseInt(m[3], 10);
    const diaNum = parseInt(d, 10);
    const mesNum = parseInt(mes, 10);

    if (ano < 1920 && ano >= 1800) ano += 100;

    if (diaNum >= 1 && diaNum <= 31 && mesNum >= 1 && mesNum <= 12 && ano >= 1940 && ano <= 2010) {
      const candidate = `${ano}-${mes.padStart(2, '0')}-${d.padStart(2, '0')}`;
      if (!dataRealizacao || !dataRealizacao.includes(String(ano))) {
        return candidate;
      }
    }
  }

  return null;
}

// ============================================================================
// 7. EXTRATOR INTELIGENTE DE RG (SEM COLIDIR COM CPF)
// ============================================================================

/**
 * Extrai o número de RG evitando sobreposição ou captura indevida de partes do CPF
 */
export function extrairRGInteligente(texto: string, cpfExtraido?: string | null): string | null {
  if (!texto) return null;

  // Busca padrão rotulado específico
  const rgPattern = /(?:RG\s*\/?\s*ORG[AÃ]O|RG|IDENTIDADE|REGISTRO\s*GERAL)[:\s.\-|]+([0-9A-Za-z.\-,\s]{5,20})/i;
  const m = texto.match(rgPattern);
  if (m) {
    let raw = m[1].trim();
    // Pega somente a primeira parte numérica/alfanumérica antes de quebras de linha ou palavras como DIC, SSP, DETRAN, etc.
    const tokenMatch = raw.match(/^([0-9.\-,]+(?:-[0-9Xx])?)/);
    if (tokenMatch) {
      raw = tokenMatch[1].replace(/[^0-9A-Za-z]/g, '');
    } else {
      raw = raw.replace(/[^0-9A-Za-z]/g, '');
    }

    const cleanCpf = cpfExtraido ? cpfExtraido.replace(/\D/g, '') : '';
    if (raw.length >= 5 && raw.length <= 15 && (!cleanCpf || !cleanCpf.includes(raw))) {
      return raw;
    }
  }

  return null;
}

// ============================================================================
// 8. EXTRATOR DE MÉDICO, CRM E UF
// ============================================================================

export interface MedicoCRMInfo {
  medicoExaminador?: {
    nome?: string;
    crm?: string;
    uf?: string;
  };
  medicoPcmso?: {
    nome?: string;
    crm?: string;
    uf?: string;
  };
}

export function extrairMedicoECRMInteligente(texto: string): MedicoCRMInfo {
  const result: MedicoCRMInfo = {};
  if (!texto) return result;

  // 1. Médico Examinador com captura de CRM próximo
  const examinadorBloco = texto.match(
    /(?:M[eé]dico\s+Examinador|Examinador)[\s:,\.\-|]+(?:Dr[aª]?\.?|Dra\.?|Dr\.?)?\s*([A-Za-zÀ-ÖØ-öø-ÿ\s]{4,60})(?:[\s\n\r]*CRM(?:\s*-\s*([A-Z]{2}))?\s*[:\s.\-|]+([\d\s.\-]{4,12}))?/i
  );
  if (examinadorBloco) {
    const nomeLimpo = examinadorBloco[1].trim().replace(/\s+(?:CRM|RQE|Av|Tel|Telefone).*$/i, '').trim();
    const uf = examinadorBloco[2] || 'RJ';
    const crmNum = examinadorBloco[3] ? examinadorBloco[3].replace(/\D/g, '') : undefined;
    result.medicoExaminador = {
      nome: nomeLimpo,
      ...(crmNum && crmNum.length >= 4 ? { crm: crmNum, uf } : {}),
    };
  }

  // 2. Médico Responsável pelo PCMSO / Coordenador com captura de CRM próximo
  const pcmsoBloco = texto.match(
    /(?:M[eé]dico\s+Respons[aá]vel\s+pel[ao]\s+PCMSO|Coordenador\s+do\s+PCMSO|Respons[aá]vel\s+pel[ao]\s+PCMSO)[\s:,\.\-|]+(?:Dr[aª]?\.?|Dra\.?|Dr\.?)?\s*([A-Za-zÀ-ÖØ-öø-ÿ\s]{4,60})(?:[\s\n\r]*CRM(?:\s*-\s*([A-Z]{2}))?\s*[:\s.\-|]+([\d\s.\-]{4,12}))?/i
  );
  if (pcmsoBloco) {
    const nomeLimpo = pcmsoBloco[1].trim().replace(/\s+(?:CRM|RQE|Av|Tel|Telefone).*$/i, '').trim();
    const uf = pcmsoBloco[2] || 'RJ';
    const crmNum = pcmsoBloco[3] ? pcmsoBloco[3].replace(/\D/g, '') : undefined;
    result.medicoPcmso = {
      nome: nomeLimpo,
      ...(crmNum && crmNum.length >= 4 ? { crm: crmNum, uf } : {}),
    };
  }

  // 3. Fallback inteligente para CRMs listados no texto
  const crmAll = [...texto.matchAll(/CRM(?:\s*-\s*([A-Z]{2}))?\s*[:\s.\-|]+([\d\s.\-]{4,12})/gi)];
  if (crmAll.length > 0) {
    if (!result.medicoExaminador?.crm) {
      const first = crmAll[0];
      const uf = first[1] || 'RJ';
      const crmNum = first[2].replace(/\D/g, '');
      if (crmNum.length >= 4) {
        if (!result.medicoExaminador) result.medicoExaminador = {};
        result.medicoExaminador.crm = crmNum;
        result.medicoExaminador.uf = uf;
      }
    }
    if (crmAll.length > 1 && (!result.medicoPcmso || !result.medicoPcmso.crm)) {
      const second = crmAll[1];
      const uf2 = second[1] || 'RJ';
      const crmNum2 = second[2].replace(/\D/g, '');
      if (crmNum2.length >= 4) {
        if (!result.medicoPcmso) result.medicoPcmso = {};
        result.medicoPcmso.crm = crmNum2;
        result.medicoPcmso.uf = uf2;
      }
    }
  }

  return result;
}

// ============================================================================
// 9. EXTRATOR INTELIGENTE DE CNPJ DE CLÍNICA
// ============================================================================

export function extrairCNPJInteligente(texto: string): string | null {
  if (!texto) return null;

  // Procura padrão CNPJ rotulado
  const cnpjRegex = /(?:CNPJ|C\.N\.P\.J|SNPJ)\s*[:|I\s.\-]*\s*([0-9OIlSZABGgqP.\s\/\-]{14,22})/gi;
  const matches = [...texto.matchAll(cnpjRegex)];

  for (const m of matches) {
    const normalized = normalizarDigitosOCR(m[1]);
    if (normalized.length >= 14) {
      const candidate = normalized.slice(0, 14);
      if (validarCNPJ(candidate)) {
        return candidate;
      }
    }
  }

  // Fallback para qualquer CNPJ válido formatado no documento
  const formatadoRegex = /\b(\d{2})[.\s](\d{3})[.\s](\d{3})[\/\s](\d{4})[.\-\s](\d{2})\b/g;
  const matchesFormatados = [...texto.matchAll(formatadoRegex)];
  for (const m of matchesFormatados) {
    const candidate = `${m[1]}${m[2]}${m[3]}${m[4]}${m[5]}`;
    if (validarCNPJ(candidate)) {
      return candidate;
    }
  }

  return null;
}
