import {
  processarDocumentoOCR as processarDocumentoOCRGlobal,
  validarCPF,
  validarCNPJ,
  repararCPFOptico,
  extrairCPFInteligente,
  extrairResultadoInteligente,
  extrairDataNascimentoInteligente,
  extrairRGInteligente,
  extrairMedicoECRMInteligente,
  extrairCNPJInteligente,
} from '@/lib/ocr';
import { supabaseAdmin } from '@/lib/supabase';
import { buscarCodigoExame } from '@/lib/e-social/codigos';
import { alinharDataExamePtBr, normalizeEsocialDate } from '@/lib/e-social/esocial-date';
import { sanitizeTsNome } from '@/lib/e-social/ts-nome';
import {
  cpfsMatch,
  isEsocialQueuedOrBeyond,
  normalizeCpf,
  type AsoIdentityMatch,
} from '@/lib/gestao-tripulantes/cpf';
import { findColaboradorByCpf, getColaboradorCpfNormalized } from '@/lib/gestao-tripulantes/cpf-lookup';
import { calcularStatusValidacaoPorValidade } from '@/lib/gestao-tripulantes/documento-integrity';
import type { TipoDocumento } from '@/types/gestao-tripulantes';
import type { OCRExtractResult, OCRTipoDocumento } from '@/types/ocr';
import {
  CLINICA_OCR_RE,
  CNPJ_OCR_RE,
  crmComUfRe,
  crmSemUfRe,
  MEDICO_NOME_RE,
  MEDICO_PREFIXO_INICIO_RE,
  MEDICO_PREFIXO_MEIO_RE,
  extrairNumeroDocumentoDoTexto,
  isTabelaHeaderLinha,
  stripCrmPrefix,
  tokenValidoComoNumeroDocumento,
} from './ocr-linear';

export { extrairNumeroDocumentoDoTexto, tokenValidoComoNumeroDocumento } from './ocr-linear';

export type { OCRExtractResult };

export async function processarDocumentoOCR(
  arquivoUrl: string,
  tipoDocumento: TipoDocumento,
  profileCpf?: string | null
): Promise<OCRExtractResult> {
  return processarDocumentoOCRGlobal(arquivoUrl, tipoDocumento as OCRTipoDocumento, profileCpf);
}

const PALAVRAS_DATA_PROXIMA = [
  'conclusao', 'conclusão', 'realizacao', 'realização',
  'realizado', 'realizada', 'data', 'exame', 'clinico', 'clínico',
  'aso', 'procedimentos', 'procedimento', 'emissao', 'emissão',
];

function converterDataTexto(dia: string, mesStr: string, ano: string): string | null {
  const converted = normalizeEsocialDate(`${dia} ${mesStr} ${ano}`);
  return converted || null;
}

function extrairDataDoTexto(texto: string): string | null {
  const linhas = texto.split('\n');

  // Pass 1: buscar data em linhas que contêm palavras-chave de data
  for (const linha of linhas) {
    if (PALAVRAS_DATA_PROXIMA.some(p => linha.toLowerCase().includes(p))) {
      // dd/mm/aaaa
      const m1 = linha.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (m1) {
        const iso = normalizeEsocialDate(m1[0]);
        if (iso) return iso;
      }
      // dd de MÊS de aaaa / dd MÊS aaaa
      const m2 = linha.match(/(\d{1,2})\s*(?:DE\s+)?([A-Za-zÀ-ÖØ-öø-ÿçãõ]+)\.?\s*(?:DE\s+)?(\d{4})/i);
      if (m2) {
        const converted = converterDataTexto(m2[1], m2[2], m2[3]);
        if (converted) return converted;
      }
    }
  }

  // Pass 2: any dd/mm/aaaa in the text, prefer the most recent
  const dataNumerica = [...texto.matchAll(/(\d{2})\/(\d{2})\/(\d{4})/g)];
  if (dataNumerica.length > 0) {
    const validas = dataNumerica
      .map(m => ({ d: parseInt(m[1]), mes: parseInt(m[2]), a: parseInt(m[3]), raw: m }))
      .filter(x => x.d >= 1 && x.d <= 31 && x.mes >= 1 && x.mes <= 12 && x.a >= 2020 && x.a <= 2030);

    if (validas.length > 0) {
      validas.sort((a, b) => b.a - a.a || b.mes - a.mes || b.d - a.d);
      const best = validas[0];
      return normalizeEsocialDate(`${best.d.toString().padStart(2, '0')}/${best.mes.toString().padStart(2, '0')}/${best.a}`)
        || `${best.a}-${best.mes.toString().padStart(2, '0')}-${best.d.toString().padStart(2, '0')}`;
    }
  }

  // Pass 3: text-based date anywhere (e.g., "18 MAR 2025")
  const dataTexto = [...texto.matchAll(/(\d{1,2})\s*(?:DE\s+)?([A-Za-zÀ-ÖØ-öø-ÿçãõ]+)\.?\s*(?:DE\s+)?(\d{4})/gi)];
  if (dataTexto.length > 0) {
    for (const m of dataTexto) {
      const converted = converterDataTexto(m[1], m[2], m[3]);
      if (converted && parseInt(m[3]) >= 2020 && parseInt(m[3]) <= 2030) return converted;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Número próprio do documento → numero_rastreio
//
// REGRA (ver AGENTS.md do módulo): `numero_rastreio` é o NÚMERO PRÓPRIO do
// documento impresso no arquivo — nº do ASO no laudo, nº do passaporte,
// nº do certificado/treinamento. O código interno `GT-<TIPO>-...` é apenas
// FALLBACK para documentos sem numeração intrínseca.
// ---------------------------------------------------------------------------

// Número próprio do documento: `extrairNumeroDocumentoDoTexto` / `tokenValidoComoNumeroDocumento` em ocr-linear.ts

const FALLBACK_RASTREIO_RE = /^GT-/;

/**
 * Persiste o número próprio extraído como `numero_rastreio` do documento.
 * Só sobrescreve quando o valor atual é fallback interno (`GT-...`) ou vazio —
 * nunca substitui um número próprio já salvo (OCR anterior ou edição manual).
 */
export async function persistirNumeroProprioRastreio(
  documentoId: string,
  numeroProprio: string | null | undefined
): Promise<boolean> {
  const token = tokenValidoComoNumeroDocumento(String(numeroProprio || ''));
  if (!token) return false;

  const { data: doc } = await supabaseAdmin
    .from('gt_documentos')
    .select('numero_rastreio')
    .eq('id', documentoId)
    .maybeSingle();

  const atual = (doc?.numero_rastreio || '').trim();
  // Número próprio já gravado (ou editado manualmente): não mexe.
  if (atual && !FALLBACK_RASTREIO_RE.test(atual)) return false;

  const { data: conflito } = await supabaseAdmin
    .from('gt_documentos')
    .select('id')
    .eq('numero_rastreio', token)
    .neq('id', documentoId)
    .limit(1)
    .maybeSingle();
  if (conflito) {
    console.warn(
      `[OCR/Rastreio] ${documentoId}: número próprio ${token} já usado em ${conflito.id}. Mantém fallback.`
    );
    return false;
  }

  const { error } = await supabaseAdmin
    .from('gt_documentos')
    .update({ numero_rastreio: token, updated_at: new Date().toISOString() })
    .eq('id', documentoId);
  if (error) {
    console.error('[OCR/Rastreio] falha ao salvar número próprio:', error.message);
    return false;
  }
  console.log(`[OCR/Rastreio] ${documentoId}: numero_rastreio ← ${token} (número próprio do documento)`);
  return true;
}

function toIsoDateOcr(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  return normalizeEsocialDate(s) || null;
}

/**
 * Copies OCR-extracted fields onto gt_documentos without overwriting
 * values already filled (manual edit or previous OCR).
 */
export async function persistirCamposOcrDocumento(
  documentoId: string,
  tipoDocumento: string | null | undefined,
  dados: Record<string, any> | null | undefined,
  texto?: string
): Promise<void> {
  const { data: atual } = await supabaseAdmin
    .from('gt_documentos')
    .select('numero_documento, orgao_emissor, data_emissao, data_validade, tipo_documento')
    .eq('id', documentoId)
    .maybeSingle();
  if (!atual) return;

  const tipo = String(tipoDocumento || atual.tipo_documento || '').toLowerCase();
  const d = dados || {};
  let numero =
    d.numero_documento || d.numero_passaporte || d.numero_cnh || null;
  if (!numero && texto) {
    numero = extrairNumeroDocumentoDoTexto(texto, tipo);
  }
  const orgao = d.orgao_emissor || d.authority || d.pais_emissor || d.instituicao || null;
  const emissao = toIsoDateOcr(d.data_emissao || d.data_realizacao || d.date_of_issue);
  const validade = toIsoDateOcr(d.data_validade || d.date_of_expiry || d.validade);

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (!atual.numero_documento && numero) {
    update.numero_documento = String(numero).trim();
  }
  if (!atual.orgao_emissor && orgao) {
    update.orgao_emissor = String(orgao).trim().slice(0, 80);
  }
  if (!atual.data_emissao && emissao) update.data_emissao = emissao;
  if (!atual.data_validade && validade) update.data_validade = validade;

  const validadeFinal = (update.data_validade as string | undefined) ?? atual.data_validade;
  update.status_validacao = calcularStatusValidacaoPorValidade(validadeFinal, { tipoDocumento: tipo });

  if (Object.keys(update).length <= 2 && !update.numero_documento && !update.orgao_emissor) {
    // only updated_at + status — still persist status if validade already existed
    if (!validadeFinal) return;
  }

  const { error } = await supabaseAdmin
    .from('gt_documentos')
    .update(update)
    .eq('id', documentoId);
  if (error) {
    console.warn('[OCR] falha ao persistir campos extraídos:', error.message);
  }
}

function normalizarCRM(raw: string): string {
  let crm = raw.trim();
  crm = crm.replace(/\s+/g, '');
  crm = crm.replace(/[I|l|]/g, '1').trim();

  // Clean trailing .0 that OCR may produce instead of -9 or similar
  crm = crm.replace(/\.0$/, '');
  crm = crm.replace(/[^\d]/g, '');

  if (crm.length >= 4 && crm.length <= 15) {
    return crm;
  }

  return crm;
}

function extrairCRMsDoTexto(texto: string): { crm: string; uf: string; contexto: string; indice: number }[] {
  const crmPatterns = [
    crmComUfRe(),
    crmSemUfRe(),
  ];

  const resultados: { crm: string; uf: string; contexto: string; indice: number }[] = [];

  for (const pattern of crmPatterns) {
    const matches = [...texto.matchAll(pattern)];
    for (const m of matches) {
      const uf = m[1] ? m[1].toUpperCase() : '';
      const crmRaw = m[2] || m[1] || stripCrmPrefix(m[0]);
      const crmNormalizado = normalizarCRM(crmRaw);
      if (crmNormalizado.length < 4) continue;

      const start = Math.max(0, (m.index || 0) - 150);
      const end = Math.min(texto.length, (m.index || 0) + (m[0]?.length || 0) + 150);
      const contexto = texto.substring(start, end).replace(/\n/g, ' ').trim();

      resultados.push({
        crm: crmNormalizado,
        uf,
        contexto,
        indice: m.index || 0,
      });
    }
  }

  return resultados;
}

function obterUFDoContexto(contexto: string): string {
  const ctxUpper = contexto.toUpperCase();
  const m = ctxUpper.match(/CRM\s*[-/]?\s*([A-Z]{2})/);
  if (m) return m[1];
  
  const ufs = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
  for (const uf of ufs) {
    const reg = new RegExp(`\\b${uf}\\b`);
    if (reg.test(ctxUpper)) {
      return uf;
    }
  }
  return 'RJ';
}

function extrairNomeMedicoDoContexto(texto: string, crmIndice: number, tipo: 'pcmso' | 'examinador'): string {
  const lines = texto.split('\n');
  const crmLineIdx = texto.substring(0, crmIndice).split('\n').length - 1;
  
  const start = Math.max(0, crmLineIdx - 3);
  const end = Math.min(lines.length, crmLineIdx + 2);
  
  // Loop backwards from CRM line to find the name closest to the CRM
  for (let i = Math.min(lines.length - 1, crmLineIdx); i >= start; i--) {
    const linha = lines[i].trim();
    if (!linha) continue;

    if (/(?:hospital|policlínica|policlinica|clínica|clinica|unidade|av\.|rua|telefone|fone|cnpj|cep|sac|atendimento|whatsapp|site|www|@)/i.test(linha)) {
      continue;
    }
    if (/^\d/.test(linha)) continue;

    // Clean common prefixes
    let linhaLimpa = linha
      .replace(/^(?:Nome do Médico Coordenador|Nome do Médico|Nome do Medico|Nome|Médico\s+Responsável\s+pelo\s+PCMSO|Médico\s+Examinador|Medico\s+Examinador|Assinatura\s*\/?[Cc]arimbo\s*[Mm]édico\s*[Examinador]*|Assinatura\s+do\s+candidato|Colaborador)[\s:]*/i, '')
      .replace(MEDICO_PREFIXO_INICIO_RE, '')
      .replace(/[\[\]|_:]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // If it contains DRA or Dr or Dra not at the beginning, clean it
    linhaLimpa = linhaLimpa.replace(MEDICO_PREFIXO_MEIO_RE, '').trim();

    // Truncate at common OCR noise words or instructions
    const noiseWords = ['valide', 'validacao', 'validação', 'validate', 'validation', 'or code', 'code', 'link', 'http', 'https', 'www', 'aso', 'rqe', 'crm', 'assinatura', 'carimbo', 'médico', 'medico', 'colaborador', 'exame realizado'];
    for (const word of noiseWords) {
      const idx = linhaLimpa.toLowerCase().indexOf(word);
      if (idx !== -1) {
        linhaLimpa = linhaLimpa.substring(0, idx).trim();
      }
    }

    if (linhaLimpa.length > 5 && linhaLimpa.split(' ').length >= 2 && !/\d/.test(linhaLimpa)) {
      return sanitizeTsNome(linhaLimpa);
    }
  }

  const regex = MEDICO_NOME_RE;
  if (tipo === 'pcmso') {
    const pcmsoIdx = texto.toLowerCase().indexOf('pcmso');
    if (pcmsoIdx !== -1) {
      const sub = texto.substring(pcmsoIdx - 50, pcmsoIdx + 200);
      const match = sub.match(regex);
      if (match) return sanitizeTsNome(match[1].trim());
    }
  }

  const medicoMatch = texto.match(regex);
  if (medicoMatch) {
    return sanitizeTsNome(medicoMatch[1].trim());
  }

  return '';
}

function extrairDadosDosMedicos(
  texto: string,
  crms: { crm: string; uf: string; contexto: string; indice: number }[]
): {
  medico_nome: string;
  medico_crm: string;
  medico_uf: string;
  medico_pcmso_nome: string;
  medico_pcmso_crm: string;
  medico_pcmso_uf: string;
} {
  let medico_nome = '';
  let medico_crm = '';
  let medico_uf = '';
  let medico_pcmso_nome = '';
  let medico_pcmso_crm = '';
  let medico_pcmso_uf = '';

  if (crms.length === 0) {
    return { medico_nome, medico_crm, medico_uf, medico_pcmso_nome, medico_pcmso_crm, medico_pcmso_uf };
  }

  const crmsClassificados = crms.map(item => {
    const ctxLower = item.contexto.toLowerCase();
    const isPCMSO = ctxLower.includes('pcmso') || ctxLower.includes('responsavel') || ctxLower.includes('responsável') || ctxLower.includes('coordenador') || ctxLower.includes('coord');
    const isExaminer = ctxLower.includes('examinador') || ctxLower.includes('examinadora') || ctxLower.includes('assinatura') || ctxLower.includes('emitente') || ctxLower.includes('carimbo');
    
    let scorePCMSO = isPCMSO ? 10 : 0;
    let scoreExaminer = isExaminer ? 10 : 0;

    if (ctxLower.includes('pcmso')) scorePCMSO += 20;
    if (ctxLower.includes('examinador')) scoreExaminer += 20;

    return { ...item, scorePCMSO, scoreExaminer };
  });

  const pcmsoCandidates = [...crmsClassificados].sort((a, b) => b.scorePCMSO - a.scorePCMSO);
  if (pcmsoCandidates[0] && pcmsoCandidates[0].scorePCMSO > 0) {
    const bestPCMSO = pcmsoCandidates[0];
    medico_pcmso_crm = bestPCMSO.crm;
    medico_pcmso_uf = bestPCMSO.uf || obterUFDoContexto(bestPCMSO.contexto);
    medico_pcmso_nome = extrairNomeMedicoDoContexto(texto, bestPCMSO.indice, 'pcmso');
  }

  const examinerCandidates = crmsClassificados.filter(item => item.crm !== medico_pcmso_crm);
  const candidatesToUse = examinerCandidates.length > 0 ? examinerCandidates : crmsClassificados;
  candidatesToUse.sort((a, b) => b.scoreExaminer - a.scoreExaminer);
  
  if (candidatesToUse[0]) {
    const bestExaminer = candidatesToUse[0];
    medico_crm = bestExaminer.crm;
    medico_uf = bestExaminer.uf || obterUFDoContexto(bestExaminer.contexto);
    medico_nome = extrairNomeMedicoDoContexto(texto, bestExaminer.indice, 'examinador');
  }

  if (medico_crm === medico_pcmso_crm && crms.length > 1) {
    const outro = crms.find(c => c.crm !== medico_crm);
    if (outro) {
      const outroCtx = outro.contexto.toLowerCase();
      if (outroCtx.includes('pcmso') || outroCtx.includes('responsavel') || outroCtx.includes('coordenador')) {
        medico_pcmso_crm = outro.crm;
        medico_pcmso_uf = outro.uf || obterUFDoContexto(outro.contexto);
        medico_pcmso_nome = extrairNomeMedicoDoContexto(texto, outro.indice, 'pcmso');
      } else {
        medico_crm = outro.crm;
        medico_uf = outro.uf || obterUFDoContexto(outro.contexto);
        medico_nome = extrairNomeMedicoDoContexto(texto, outro.indice, 'examinador');
      }
    }
  }

  return { medico_nome, medico_crm, medico_uf, medico_pcmso_nome, medico_pcmso_crm, medico_pcmso_uf };
}

function extrairResultado(texto: string): string {
  const linhas = texto.split('\n');

  let aptoCheckbox = false;
  let inaptoCheckbox = false;
  let condicionalCheckbox = false;

  for (const linha of linhas) {
    const upperLinha = linha.toUpperCase();

    if (/\[X\]\s*APTO|\(X\)\s*APTO|\[\*\]\s*APTO|APTO\s*\[X\]|APTO\s*\(X\)/i.test(upperLinha)) {
      aptoCheckbox = true;
    }
    if (/\[X\]\s*INAPTO|\(X\)\s*INAPTO|\[\*\]\s*INAPTO|INAPTO\s*\[X\]|INAPTO\s*\(X\)/i.test(upperLinha)) {
      inaptoCheckbox = true;
    }
    if (/\[X\]\s*APTO\s+CONDICIONAL|\(X\)\s*APTO\s+CONDICIONAL/i.test(upperLinha)) {
      condicionalCheckbox = true;
    }
    if (/\[\s*\]\s*APTO/.test(upperLinha)) aptoCheckbox = false;
    if (/\[\s*\]\s*INAPTO/.test(upperLinha)) inaptoCheckbox = false;
  }

  if (condicionalCheckbox) return 'apto_condicional';
  if (inaptoCheckbox) return 'inapto';
  if (aptoCheckbox) return 'apto';

  for (let i = 0; i < linhas.length; i++) {
    const upper = linhas[i].toUpperCase();

    if (/^(?:RESULTADO|CONCLUSÃO|CONCLUSAO|PARECER|DIAGNÓSTICO|DIAGNOSTICO)\s*[:]\s*(APTO|INAPTO)/i.test(upper)) {
      const m = upper.match(/:\s*(APTO|INAPTO)/i);
      if (m) {
        const val = m[1].toLowerCase();
        if (val === 'inapto') return 'inapto';
        return 'apto';
      }
    }
  }

  let encontrouInapto = false;
  let encontrouApto = false;

  for (let i = 0; i < Math.min(linhas.length, 25); i++) {
    const upperLinha = linhas[i].toUpperCase();

    if (/INAPTO/.test(upperLinha)) {
      const isFalsePositive =
        /NAO APLICAVEL|NÃO APLICÁVEL|NAO\s+SE\s+APLICA|NÃO\s+SE\s+APLICA|EM\s+CASO\s+DE\s+INAPTIDÃO|EM\s+CASO\s+DE\s+INAPTIDAO|DOENÇA|DOENCA|ACIDENTE|INAPTIDÃO/i.test(upperLinha);

      if (!isFalsePositive && upperLinha.length < 100) {
        encontrouInapto = true;
      }
    }

    if (/(?:^|\s)APTO(?:\s|$)/i.test(upperLinha) && !/INAPTO/.test(upperLinha)) {
      const isFalsePositive =
        /NAO APLICAVEL|NÃO APLICÁVEL/i.test(upperLinha);

      if (!isFalsePositive && upperLinha.length < 100) {
        encontrouApto = true;
      }
    }
  }

  const aptoCondicional = /APTO\s+CONDICIONAL/i.test(texto.substring(0, 2000));
  if (aptoCondicional) return 'apto_condicional';

  if (encontrouInapto) return 'inapto';
  if (encontrouApto) return 'apto';

  return 'apto';
}

function eLinhaDeExameValida(linha: string): boolean {
  const l = linha.toLowerCase();
  if (/nascimento|nasc\.?|admissão|admissao|emissão|emissao|cpf|cnpj|rg|resultado|conclusão|conclusao|médico|medico|crm|rqe|telefone|fone|empresa|função|funcao|setor|cargo|nome|colaborador|candidato/i.test(l)) {
    if (l.includes('clinico') || l.includes('clínico')) {
      return true;
    }
    return false;
  }
  return true;
}

function extrairExamesDoTexto(texto: string, dataAso: string | null): { nome: string; data: string }[] {
  const exames: { nome: string; data: string }[] = [];
  const linhas = texto.split('\n');

  for (const linha of linhas) {
    const linhaLimpa = linha.trim();
    if (!linhaLimpa) continue;
    
    if (!eLinhaDeExameValida(linhaLimpa)) {
      continue;
    }
    
    if (isTabelaHeaderLinha(linhaLimpa)) {
      continue;
    }

    const regexData = /(\d{2})\/(\d{2})\/(\d{2,4})/g;
    const matches = [...linhaLimpa.matchAll(regexData)];
    
    if (matches.length > 0) {
      let lastIndex = 0;
      for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        const matchIndex = match.index || 0;
        
        let procNome = linhaLimpa.substring(lastIndex, matchIndex)
          .replace(/[|;\t]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        
        procNome = procNome.replace(/^[^A-Za-zÀ-ÖØ-öø-ÿçãõ]+/, '').replace(/[^A-Za-zÀ-ÖØ-öø-ÿçãõ\s\-]+$/, '').trim();

        const dia = match[1];
        const mes = match[2];
        const anoRaw = match[3];
        let anoClean = anoRaw.replace(/O/g, '0').replace(/S/g, '5').replace(/[Il]/g, '1').replace(/[^\d]/g, '');
        if (anoClean.length === 2) {
          anoClean = '20' + anoClean;
        }
        
        const dataBruta = `${dia}/${mes}/${anoClean}`;
        const dataFormatada = alinharDataExamePtBr(dataBruta, dataAso) || normalizeEsocialDate(dataBruta);
        
        if (procNome.length > 3 && procNome.split(' ').some(w => w.length > 2)) {
          exames.push({
            nome: procNome.toUpperCase(),
            data: dataFormatada
          });
        }
        
        lastIndex = matchIndex + match[0].length;
      }
    }
  }

  if (exames.length === 0) {
    const examesComuns = [
      'ACUIDADE VISUAL', 'ELETROCARDIOGRAMA', 'EXAME CLINICO', 'EXAME CLINICO - ASO',
      'GLICOSE', 'HEMOGRAMA', 'HEMOGRAMA COMPLETO', 'RAIO X COLUNA LOMBAR', 'RAIO X COLUNA',
      'RAIO X', 'TIPO E FATOR RH', 'AUDIOMETRIA', 'ESPIROMETRIA', 'ENCEFALOGRAMA', 'EEG', 'ECG'
    ];
    const textoLower = texto.toLowerCase();
    for (const exameNome of examesComuns) {
      if (textoLower.includes(exameNome.toLowerCase())) {
        exames.push({
          nome: exameNome,
          data: dataAso || new Date().toISOString().split('T')[0]
        });
      }
    }
  }

  const uniqueExames: { nome: string; data: string }[] = [];
  const seenNomes = new Set<string>();
  for (const ex of exames) {
    if (!seenNomes.has(ex.nome)) {
      seenNomes.add(ex.nome);
      uniqueExames.push(ex);
    }
  }

  return uniqueExames;
}

export async function extrairDadosASODoTexto(
  documentoId: string,
  texto: string,
  dadosExtraidos: Record<string, any> | null | undefined,
  colaboradorId: string,
  dataEmissao?: string | null
): Promise<void> {
  // Hard identity gate com auto-reparo óptico e validação matemática de Módulo 11
  let colaboradorIdFinal: string | null = colaboradorId;
  const profileCpf = colaboradorId ? await getColaboradorCpfNormalized(colaboradorId) : null;

  // 1. Extração / Normalização de CPF com suporte a Módulo 11 e Profile CPF
  let cpfExtraido: string | null = null;
  let cpfFoiReparado = false;

  if (dadosExtraidos?.cpf) {
    const rawClean = normalizeCpf(String(dadosExtraidos.cpf));
    if (validarCPF(rawClean)) {
      cpfExtraido = rawClean;
    } else {
      const rep = repararCPFOptico(rawClean, profileCpf);
      if (rep && validarCPF(rep.cpf)) {
        cpfExtraido = rep.cpf;
        cpfFoiReparado = rep.corrigido;
      }
    }
  }

  if (!cpfExtraido && texto) {
    const info = extrairCPFInteligente(texto, profileCpf);
    if (info.cpf && validarCPF(info.cpf)) {
      cpfExtraido = info.cpf;
      cpfFoiReparado = info.corrigido;
    }
  }

  let identityMatch: AsoIdentityMatch = cpfExtraido ? 'unknown' : 'unknown';

  // Preserve esocial_status if already queued/sent — freeze identity after queue
  const { data: existingAso } = await supabaseAdmin
    .from('gt_documentos_aso')
    .select('esocial_status, colaborador_id, identity_match')
    .eq('documento_id', documentoId)
    .maybeSingle();

  const frozen = isEsocialQueuedOrBeyond(existingAso?.esocial_status);

  if (frozen) {
    identityMatch = 'frozen';
    colaboradorIdFinal = existingAso?.colaborador_id || colaboradorId;
    console.log(
      `[OCR/Identity] Documento ${documentoId} já em e-Social (${existingAso?.esocial_status}) — identidade congelada.`
    );
  } else if (cpfExtraido) {
    if (profileCpf && cpfsMatch(cpfExtraido, profileCpf)) {
      identityMatch = 'match';
      colaboradorIdFinal = colaboradorId;
      if (cpfFoiReparado) {
        console.log(
          `[OCR/Identity] ASO ${documentoId}: CPF reparado com sucesso via Módulo 11 para match com perfil (${cpfExtraido}).`
        );
      }
    } else {
      const colabCorreto = await findColaboradorByCpf(cpfExtraido);

      if (colabCorreto && colabCorreto.id !== colaboradorId) {
        console.log(
          `[OCR/Identity] ASO ${documentoId}: CPF OCR ${cpfExtraido} ≠ perfil. Reassociando → ${colabCorreto.id}`
        );
        identityMatch = 'reassigned';
        colaboradorIdFinal = colabCorreto.id;
        await supabaseAdmin
          .from('gt_documentos')
          .update({
            colaborador_id: colabCorreto.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', documentoId);
      } else if (colabCorreto && colabCorreto.id === colaboradorId) {
        identityMatch = 'match';
        colaboradorIdFinal = colaboradorId;
      } else {
        // CPF OCR existe mas não há colaborador cadastrado correspondente
        console.warn(
          `[OCR/Identity] ASO ${documentoId}: CPF OCR ${cpfExtraido} sem colaborador correspondente. Quarentena.`
        );
        identityMatch = 'quarantine';
        colaboradorIdFinal = null;
        await supabaseAdmin
          .from('gt_documentos')
          .update({
            colaborador_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', documentoId);
      }
    }
  } else {
    // Nenhum CPF extraído ou reparado com sucesso -> Quarentena
    identityMatch = 'quarantine';
    colaboradorIdFinal = null;
    console.warn(
      `[OCR/Identity] ASO ${documentoId}: CPF não extraído pelo OCR. Documento em quarentena para revisão manual.`
    );
    await supabaseAdmin
      .from('gt_documentos')
      .update({
        colaborador_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentoId);
  }

  // 1. Tipo de exame
  let tipo_exame = dadosExtraidos?.tipo_exame || 'periodico';
  if (!dadosExtraidos?.tipo_exame) {
    if (/admissional/i.test(texto)) tipo_exame = 'admissional';
    else if (/demissional/i.test(texto)) tipo_exame = 'demissional';
    else if (/retorno/i.test(texto)) tipo_exame = 'retorno';
    else if (/mudança\s+de\s+função|mudanca\s+de\s+funcao/i.test(texto)) tipo_exame = 'mudanca_funcao';
  }

  // 2. Resultado com heurística de caixas de seleção
  let resultado = dadosExtraidos?.resultado;
  if (!resultado || resultado === 'inapto') {
    resultado = extrairResultadoInteligente(texto);
  }

  // 3. Data de Realização
  let data_realizacao: string | null = dadosExtraidos?.data_realizacao || null;

  if (data_realizacao) {
    data_realizacao = normalizeEsocialDate(data_realizacao) || data_realizacao;
  }

  if (!data_realizacao) {
    data_realizacao = extrairDataDoTexto(texto);
  }

  if (!data_realizacao && dataEmissao) {
    data_realizacao = dataEmissao;
  }

  // 4. Médicos (Examinador e Coordenador PCMSO)
  const medicosInfo = extrairMedicoECRMInteligente(texto);
  const crmsEncontrados = extrairCRMsDoTexto(texto);
  const dadosMedicos = extrairDadosDosMedicos(texto, crmsEncontrados);

  const medico_nome =
    dadosExtraidos?.medico_examinador_nome ||
    dadosExtraidos?.medico ||
    medicosInfo.medicoExaminador?.nome ||
    dadosMedicos.medico_nome ||
    '';
  const medico_crm =
    dadosExtraidos?.medico_examinador_crm ||
    dadosExtraidos?.medico_crm ||
    medicosInfo.medicoExaminador?.crm ||
    dadosMedicos.medico_crm ||
    '';
  const medico_uf =
    dadosExtraidos?.medico_examinador_uf ||
    medicosInfo.medicoExaminador?.uf ||
    dadosMedicos.medico_uf ||
    'RJ';

  const medico_pcmso_nome =
    dadosExtraidos?.medico_pcmso_nome ||
    medicosInfo.medicoPcmso?.nome ||
    dadosMedicos.medico_pcmso_nome ||
    '';
  const medico_pcmso_crm =
    dadosExtraidos?.medico_pcmso_crm ||
    medicosInfo.medicoPcmso?.crm ||
    dadosMedicos.medico_pcmso_crm ||
    '';
  const medico_pcmso_uf =
    dadosExtraidos?.medico_pcmso_uf ||
    medicosInfo.medicoPcmso?.uf ||
    dadosMedicos.medico_pcmso_uf ||
    'RJ';

  // 5. Informações da clínica
  let cnpj_clinica = dadosExtraidos?.cnpj_clinica || extrairCNPJInteligente(texto) || '';
  let nome_clinica = dadosExtraidos?.nome_clinica || '';

  if (!cnpj_clinica) {
    const cnpjMatch = texto.match(CNPJ_OCR_RE);
    if (cnpjMatch) {
      cnpj_clinica = cnpjMatch[1].replace(/[^\d]/g, '');
    }
  }

  if (!nome_clinica) {
    if (/policlínica|policlinica/i.test(texto)) {
      nome_clinica = 'Policlínica';
    } else {
      const clinicaMatch = texto.match(CLINICA_OCR_RE);
      if (clinicaMatch) {
        nome_clinica = clinicaMatch[1].trim().split('\n')[0];
      }
    }
  }

  // 6. Exames complementares
  let exames_realizados = dadosExtraidos?.exames_realizados;
  if (!exames_realizados || !Array.isArray(exames_realizados) || exames_realizados.length === 0) {
    exames_realizados = extrairExamesDoTexto(texto, data_realizacao);
  }

  const examesComCodigos = [];
  if (Array.isArray(exames_realizados)) {
    for (const ex of exames_realizados) {
      const codProc = await buscarCodigoExame(ex.nome);
      const dataAlinhada = alinharDataExamePtBr(ex.data || ex.dtExm, data_realizacao)
        || normalizeEsocialDate(ex.data || ex.dtExm)
        || data_realizacao
        || ex.data;
      examesComCodigos.push({
        ...ex,
        data: dataAlinhada,
        dtExm: dataAlinhada,
        codProc: codProc || '9999'
      });
    }
  }

  // 7. Número próprio do documento (impresso no laudo) → numero_rastreio.
  // Substitui o fallback GT-... quando o ASO tem numeração própria.
  try {
    const numeroProprio = extrairNumeroDocumentoDoTexto(texto, 'aso');
    if (numeroProprio) {
      await persistirNumeroProprioRastreio(documentoId, numeroProprio);
    }
  } catch (rastreioErr) {
    console.warn('[OCR/Rastreio] falha ao extrair/persistir número próprio do ASO:', rastreioErr);
  }

  const asoUpsert: Record<string, unknown> = {
    documento_id: documentoId,
    colaborador_id: colaboradorIdFinal,
    tipo_exame,
    resultado,
    data_realizacao,
    medico_nome: sanitizeTsNome(medico_nome) || null,
    medico_crm: medico_crm || null,
    medico_uf: medico_uf || null,
    medico_pcmso_nome: sanitizeTsNome(medico_pcmso_nome) || null,
    medico_pcmso_crm: medico_pcmso_crm || null,
    medico_pcmso_uf: medico_pcmso_uf || null,
    cnpj_clinica: cnpj_clinica || null,
    nome_clinica: nome_clinica || null,
    exames_realizados: examesComCodigos.length > 0 ? examesComCodigos : null,
    cpf_documento: cpfExtraido,
    identity_match: identityMatch,
    updated_at: new Date().toISOString(),
  };

  // Never reset esocial_status once queued/sent/processed; quarantine gets explicit status
  if (frozen) {
    // leave esocial_status untouched (omit from upsert payload → need merge carefully)
  } else if (identityMatch === 'quarantine') {
    asoUpsert.esocial_status = 'quarentena';
  } else if (!existingAso?.esocial_status || existingAso.esocial_status === 'quarentena') {
    asoUpsert.esocial_status = 'nao_enviado';
  }
  // else: keep existing status (pendente/erro/etc.) by omitting esocial_status

  if (frozen) {
    // Upsert without overwriting esocial_status or colaborador when frozen
    delete asoUpsert.colaborador_id;
    const { error: upsertErr } = await supabaseAdmin
      .from('gt_documentos_aso')
      .upsert(asoUpsert, { onConflict: 'documento_id' });
    if (upsertErr) {
      console.error('[OCR/ASO] upsert (frozen) failed:', upsertErr);
    }
  } else {
    const { error: upsertErr } = await supabaseAdmin
      .from('gt_documentos_aso')
      .upsert(asoUpsert, { onConflict: 'documento_id' });
    if (upsertErr) {
      console.error('[OCR/ASO] upsert failed:', upsertErr);
    }
  }
}

/**
 * Identity gate for ALL document types (not only ASO).
 * A document may only stay attached to the colaborador that owns the CPF
 * found in its content. Anything ambiguous goes to quarantine:
 *   - CPF extracted ≠ profile CPF and no other colaborador owns it → quarantine
 *   - No CPF extractable at all → quarantine
 *   - CPF belongs to another colaborador → reassign (CPF-only, never by name)
 *
 * Writes identity_match onto gt_documentos so the auditoria panel can list it.
 */
export async function aplicarGateIdentidadeDocumento(
  documentoId: string,
  texto: string,
  dadosExtraidos: Record<string, any> | null | undefined,
  colaboradorId: string | null
): Promise<{ identityMatch: AsoIdentityMatch; cpfDocumento: string | null }> {
  const { data: existingDoc } = await supabaseAdmin
    .from('gt_documentos')
    .select('identity_match, tipo_documento')
    .eq('id', documentoId)
    .maybeSingle();

  // Frozen identities never move (e-Social sent/processed or admin-resolved)
  if (existingDoc?.identity_match === 'frozen') {
    return { identityMatch: 'frozen', cpfDocumento: null };
  }

  // Número próprio do documento (passaporte, certificado, treinamento…).
  // Substitui o fallback GT-... apenas quando há numeração intrínseca.
  try {
    const numeroProprio = extrairNumeroDocumentoDoTexto(texto, existingDoc?.tipo_documento);
    if (numeroProprio) {
      await persistirNumeroProprioRastreio(documentoId, numeroProprio);
    }
    await persistirCamposOcrDocumento(
      documentoId,
      existingDoc?.tipo_documento,
      dadosExtraidos,
      texto
    );
  } catch (rastreioErr) {
    console.warn('[OCR/Rastreio] falha ao extrair/persistir número próprio do documento:', rastreioErr);
  }

  const profileCpf = colaboradorId ? await getColaboradorCpfNormalized(colaboradorId) : null;
  let cpfExtraido: string | null = null;
  let cpfFoiReparado = false;

  if (dadosExtraidos?.cpf) {
    const rawClean = normalizeCpf(String(dadosExtraidos.cpf));
    if (validarCPF(rawClean)) {
      cpfExtraido = rawClean;
    } else {
      const rep = repararCPFOptico(rawClean, profileCpf);
      if (rep && validarCPF(rep.cpf)) {
        cpfExtraido = rep.cpf;
        cpfFoiReparado = rep.corrigido;
      }
    }
  }

  if (!cpfExtraido && texto) {
    const info = extrairCPFInteligente(texto, profileCpf);
    if (info.cpf && validarCPF(info.cpf)) {
      cpfExtraido = info.cpf;
      cpfFoiReparado = info.corrigido;
    }
  }

  let identityMatch: AsoIdentityMatch;

  if (!colaboradorId) {
    // Already orphan/quarantined — keep quarantined until admin resolves
    identityMatch = 'quarantine';
  } else if (!cpfExtraido) {
    // Passaporte, visto, certificados etc. frequentemente não imprimem CPF.
    // Não quarentenar: o doc permanece no colaborador atual para edição manual.
    console.warn(
      `[OCR/Identity] Documento ${documentoId}: CPF não extraído. identity_match=unknown (sem quarentena).`
    );
    identityMatch = 'unknown';
  } else {
    if (profileCpf && cpfsMatch(cpfExtraido, profileCpf)) {
      identityMatch = 'match';
      if (cpfFoiReparado) {
        console.log(
          `[OCR/Identity] Documento ${documentoId}: CPF reparado com sucesso via Módulo 11 para match com perfil (${cpfExtraido}).`
        );
      }
    } else {
      const colabCorreto = await findColaboradorByCpf(cpfExtraido);

      if (colabCorreto && colabCorreto.id !== colaboradorId) {
        console.log(
          `[OCR/Identity] Documento ${documentoId}: CPF OCR ${cpfExtraido} ≠ perfil. Reassociando → ${colabCorreto.id}`
        );
        identityMatch = 'reassigned';
        await supabaseAdmin
          .from('gt_documentos')
          .update({
            colaborador_id: colabCorreto.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', documentoId);
      } else if (colabCorreto) {
        identityMatch = 'match';
      } else {
        console.warn(
          `[OCR/Identity] Documento ${documentoId}: CPF OCR ${cpfExtraido} sem colaborador válido. Quarentena.`
        );
        identityMatch = 'quarantine';
        await supabaseAdmin
          .from('gt_documentos')
          .update({ colaborador_id: null, updated_at: new Date().toISOString() })
          .eq('id', documentoId);
      }
    }
  }

  await supabaseAdmin
    .from('gt_documentos')
    .update({
      identity_match: identityMatch,
      updated_at: new Date().toISOString(),
    })
    .eq('id', documentoId);

  return { identityMatch, cpfDocumento: cpfExtraido };
}
