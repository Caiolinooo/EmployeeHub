// Algoritmo de validação de CPF (Módulo 11 oficial da Receita Federal)
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

// Tabela de confusão óptica típica de OCR
const CONFUSAO_OPTICA = {
  '0': ['O', 'o', 'Q', 'D', '8', '6'],
  '1': ['I', 'l', '|', '!', ']', '[', '7', 'T', '/'],
  '2': ['Z', 'z'],
  '3': ['8', 'E', 'B'],
  '4': ['A'],
  '5': ['S', 's', '$', '6', '8'],
  '6': ['G', 'b', '8', '5', '0'],
  '7': ['1', 'T', '/', 'I'],
  '8': ['B', '9', '3', '0', '6'],
  '9': ['8', 'g', 'q', '0', 'P'],
};

// Inverso da tabela para mapear caracteres alfabéticos/símbolos de volta a dígitos
const MAPA_CARACTER_PARA_DIGITO = {
  'O': '0', 'o': '0', 'Q': '0', 'D': '0',
  'I': '1', 'l': '1', '|': '1', '!': '1', ']': '1', '[': '1', 'T': '7', '/': '7',
  'Z': '2', 'z': '2',
  'E': '3',
  'A': '4',
  'S': '5', 's': '5', '$': '5',
  'G': '6', 'b': '6',
  'B': '8',
  'g': '9', 'q': '9'
};

/**
 * Corrige uma string candidata a CPF que pode conter caracteres alfanuméricos trocados por OCR
 */
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

/**
 * Tenta reparar um CPF inválido de 11 dígitos através de 1 correção óptica
 */
function repararCPFOptico(cpfInvalido, targetCpf = null) {
  const clean = normalizarDigitosOCR(cpfInvalido);
  if (clean.length !== 11) return null;

  // Se já for válido, retorna ele mesmo
  if (validarCPF(clean)) return clean;

  const targetClean = targetCpf ? normalizarDigitosOCR(targetCpf) : null;
  const candidatosValidos = [];

  // Se temos um CPF de perfil alvo válido, e a distância é de 1 dígito, verifica se é uma substituição óptica plausível
  if (targetClean && targetClean.length === 11 && validarCPF(targetClean)) {
    let diffCount = 0;
    for (let i = 0; i < 11; i++) {
      if (clean[i] !== targetClean[i]) diffCount++;
    }
    if (diffCount === 1) {
      console.log(`[OCR/Reparar] Alvo fornecido coincide com distância 1: ${clean} -> ${targetClean}`);
      return targetClean;
    }
  }

  // Tenta substituição de 1 dígito com base na tabela de confusão óptica
  for (let i = 0; i < 11; i++) {
    const charAtual = clean[i];
    const possiveis = CONFUSAO_OPTICA[charAtual] || [];
    
    // Adiciona todos os dígitos de 0-9 para testar se é erro de 1 único dígito
    const digitosParaTestar = new Set([...possiveis.filter(c => /\d/.test(c)), '0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);

    for (const d of digitosParaTestar) {
      if (d === charAtual) continue;
      const candidato = clean.substring(0, i) + d + clean.substring(i + 1);
      if (validarCPF(candidato)) {
        // Prioridade se o caractere estava na lista de confusão direta
        const peso = possiveis.includes(d) ? 2 : 1;
        candidatosValidos.push({ cpf: candidato, peso, indice: i, de: charAtual, para: d });
      }
    }
  }

  if (candidatosValidos.length > 0) {
    // Ordena por maior peso
    candidatosValidos.sort((a, b) => b.peso - a.peso);
    console.log('[OCR/Reparar] Candidatos válidos encontrados para', clean, ':', candidatosValidos);
    return candidatosValidos[0].cpf;
  }

  return null;
}

// Teste com o texto real do ASO do Caio:
const textoASO = `Médico Responsável pela PCMSO Dr Heloana Antunes Sabino da Azevado NE A CRM-RJ: 52 80456-4 1 RQE: 27590 FER Re Sn Av. Nossa Senhora da Glória, nº 2067 - 304 mm Em fika Gavaloiros - Macaé! RJ Telefone: 122) 8717-1170 I Ú ATESTADO DE SAUDE OCUPACIONAL 622769 ' NOME; CAIO VALERIO GOULART CORREIA a, [AGUAS BRASILEIRAS SERVICOS E CONSULTORIA EM ATIVIDADES ! I " EMPRESA: ; é IDS/00081.85 MARITIMAS LTDA SNPJ: 17.784 3OS/0001-8 FUNÇÃO. - ANALISTADE SUPORTE ! SETOR: AÉZ BASE i , CPF: 154 15687764 ' RG/ORGÃO: 28.356,467-2 DIC D.h: 11/12/1885`;

console.log('=== TESTE DE REPARO ===');
const extraidoErrado = '15415687764';
const reparadoSemTarget = repararCPFOptico(extraidoErrado);
console.log('Sem target:', reparadoSemTarget, 'Válido:', validarCPF(reparadoSemTarget));

const reparadoComTarget = repararCPFOptico(extraidoErrado, '154.156.977-64');
console.log('Com target:', reparadoComTarget, 'Válido:', validarCPF(reparadoComTarget));
