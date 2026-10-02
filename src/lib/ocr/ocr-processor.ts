import { supabaseAdmin } from '@/lib/supabase';
import { normalizeEsocialDate } from '@/lib/e-social/esocial-date';
import { normalizeCpf } from '@/lib/utils/identity';
import type { OCRTipoDocumento, OCRExtractResult, OCRConfig } from '@/types/ocr';
import {
  validarCPF,
  validarCNPJ,
  repararCPFOptico,
  extrairCPFInteligente,
  extrairResultadoInteligente,
  extrairDataNascimentoInteligente,
  extrairRGInteligente,
  extrairMedicoECRMInteligente,
  extrairCNPJInteligente,
} from './ocr-repair';
import {
  deveExtrairEstruturaComLlm,
  textoOcrSuficiente,
  visaoLlmCompativel,
} from './ocr-routing';
import { decodeXmlEntities } from './decode-xml-entities';
import {
  extrairCnhOcr,
  extrairCtpsOcr,
  extrairLogradouroOcr,
  extrairNomeMaeOcr,
  extrairNomeOcr,
  extrairNomePaiOcr,
  extrairPisOcr,
} from './ocr-field-extract';
import fs from 'fs';
import path from 'path';

export {
  OCR_TEXTO_MINIMO,
  textoOcrSuficiente,
  visaoLlmCompativel,
  deveExtrairEstruturaComLlm,
} from './ocr-routing';
export type { VisaoLlmConfig } from './ocr-routing';

let configCache: { data: OCRConfig; time: number } | null = null;
const CONFIG_TTL = 60000;

function isAmbienteServerless(): boolean {
  return !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

async function getOCRConfigFromDB(): Promise<OCRConfig> {
  if (configCache && Date.now() - configCache.time < CONFIG_TTL) {
    return configCache.data;
  }
  try {
    const { data } = await supabaseAdmin
      .from('settings')
      .select('value')
      .eq('key', 'ocr')
      .maybeSingle();
    if (data?.value) {
      const cfg = { idioma: 'por', qualidade: 'normal', ...(data.value as Record<string, any>) } as OCRConfig;
      configCache = { data: cfg, time: Date.now() };
      return cfg;
    }
  } catch { /* fallback */ }
  const fallback: OCRConfig = { idioma: 'por', qualidade: 'normal' };
  configCache = { data: fallback, time: Date.now() };
  return fallback;
}

export function extrairDadosTexto(
  texto: string,
  tipoDocumento?: OCRTipoDocumento,
  profileCpf?: string | null
): Record<string, any> {
  const dados: Record<string, any> = {};
  const upper = texto.toUpperCase();

  // 1. Extração Inteligente de CPF com Validação de Módulo 11 e Auto-Reparo Óptico
  const cpfInfo = extrairCPFInteligente(texto, profileCpf);
  if (cpfInfo.cpf) {
    dados.cpf = cpfInfo.cpf;
    dados._cpf_corrigido = cpfInfo.corrigido;
    dados._cpf_confianca = cpfInfo.confianca;
  }

  // 2. Extração Inteligente de RG (sem sobreposição com CPF)
  const rgVal = extrairRGInteligente(texto, dados.cpf);
  if (rgVal) {
    dados.rg = rgVal;
  }

  // 3. Nome do Colaborador
  const nomeLimpo = extrairNomeOcr(upper);
  if (nomeLimpo) {
    dados.nome_completo = nomeLimpo;
  }

  // 4. Data de Realização preliminar para evitar conflito com Data de Nascimento
  let dataRealizacaoTemp: string | null = null;
  const datasEncontradas = [...texto.matchAll(/(\d{2})[\/\.\-](\d{2})[\/\.\-](\d{4})/g)];
  if (datasEncontradas.length > 0) {
    const validas = datasEncontradas
      .map(m => m[0])
      .filter(dStr => {
        const iso = normalizeEsocialDate(dStr);
        if (!iso) return false;
        const year = Number(iso.slice(0, 4));
        return year >= 2020 && year <= 2030;
      });
    if (validas.length > 0) {
      dataRealizacaoTemp = validas[validas.length - 1];
    }
  }

  // 5. Data de Nascimento Segura com Correção de Século
  const dnVal = extrairDataNascimentoInteligente(texto, dataRealizacaoTemp);
  if (dnVal) {
    dados.data_nascimento = dnVal;
  }

  // 6. Filiação
  const nomeMae = extrairNomeMaeOcr(upper);
  if (nomeMae) dados.nome_mae = nomeMae;

  const nomePai = extrairNomePaiOcr(upper);
  if (nomePai) dados.nome_pai = nomePai;

  // 7. Documentos complementares
  const ctps = extrairCtpsOcr(upper);
  if (ctps) dados.ctps = ctps;

  const cnh = extrairCnhOcr(upper);
  if (cnh) dados.numero_cnh = cnh;

  const pis = extrairPisOcr(upper);
  if (pis) dados.pis_pasep = pis;

  const logradouro = extrairLogradouroOcr(upper);
  if (logradouro) dados.endereco_logradouro = logradouro;

  const cepMatch = texto.match(/(\d{5})-?(\d{3})/);
  if (cepMatch) dados.endereco_cep = `${cepMatch[1]}-${cepMatch[2]}`;

  // 8. Regras específicas para ASO
  if (tipoDocumento === 'aso') {
    // Resultado Apto vs Inapto com Heurística de Checkbox
    dados.resultado = extrairResultadoInteligente(texto);

    if (dataRealizacaoTemp) {
      dados.data_realizacao = normalizeEsocialDate(dataRealizacaoTemp) || dataRealizacaoTemp;
    } else if (datasEncontradas.length > 0) {
      dados.data_realizacao = normalizeEsocialDate(datasEncontradas[datasEncontradas.length - 1][0])
        || datasEncontradas[datasEncontradas.length - 1][0];
    }

    // Médicos e CRMs (Examinador e PCMSO)
    const medicos = extrairMedicoECRMInteligente(texto);
    if (medicos.medicoExaminador?.nome) {
      dados.medico = medicos.medicoExaminador.nome;
    } else if (medicos.medicoPcmso?.nome && !dados.medico) {
      dados.medico = medicos.medicoPcmso.nome;
    }

    if (medicos.medicoExaminador?.crm) {
      dados.medico_crm = medicos.medicoExaminador.crm;
    } else if (medicos.medicoPcmso?.crm && !dados.medico_crm) {
      dados.medico_crm = medicos.medicoPcmso.crm;
    }

    if (medicos.medicoPcmso?.nome) dados.medico_pcmso_nome = medicos.medicoPcmso.nome;
    if (medicos.medicoPcmso?.crm) dados.medico_pcmso_crm = medicos.medicoPcmso.crm;
    if (medicos.medicoPcmso?.uf) dados.medico_pcmso_uf = medicos.medicoPcmso.uf;

    // CNPJ e Nome da Clínica
    const cnpj = extrairCNPJInteligente(texto);
    if (cnpj) dados.cnpj_clinica = cnpj;

    const clinicaMatch = texto.match(/(?:Clínica|Clinica|Centro\s+Médico|Laboratório|Laboratorio)\s*:?\s*([A-Za-zÀ-ÖØ-öø-ÿ\s]{4,60})/i);
    if (clinicaMatch) dados.nome_clinica = clinicaMatch[1].trim();
  }

  // 9. Passaporte — número, órgão, emissão, validade
  if (tipoDocumento === 'passaporte') {
    const passaporteMatch =
      texto.match(/(?:PASSPORT\s*(?:NO\.?|NUMBER|#)|N[ºo°.]?\s*(?:DO\s+)?PASSAPORTE)\s*[:\-]?\s*([A-Z]{1,2}\d{5,9}|[A-Z0-9]{6,12})/i)
      || texto.match(/\b([A-Z]{2}\d{6,7})\b/);
    if (passaporteMatch) dados.numero_passaporte = passaporteMatch[1].replace(/\s+/g, '');
    dados.numero_documento = dados.numero_documento || dados.numero_passaporte;

    const authMatch = texto.match(/(?:AUTHORITY|ÓRGÃO\s*EMISSOR|ORGAO\s*EMISSOR|ISSUING\s*AUTHORITY)\s*[:\-]?\s*([A-ZÀ-Úa-zà-ú0-9 ./-]{2,40})/i);
    if (authMatch) dados.orgao_emissor = authMatch[1].trim();

    const issueMatch = texto.match(/(?:DATE\s*OF\s*ISSUE|DATA\s*(?:DE\s*)?EMISS[AÃ]O)\s*[:\-]?\s*(\d{2}[\/.\-]\d{2}[\/.\-]\d{4}|\d{4}[\/.\-]\d{2}[\/.\-]\d{2})/i);
    if (issueMatch) dados.data_emissao = issueMatch[1];

    const expiryMatch = texto.match(/(?:DATE\s*OF\s*EXPIRY|DATE\s*OF\s*EXPIRATION|DATA\s*(?:DE\s*)?VALIDADE|VALID\s*UNTIL)\s*[:\-]?\s*(\d{2}[\/.\-]\d{2}[\/.\-]\d{4}|\d{4}[\/.\-]\d{2}[\/.\-]\d{2})/i);
    if (expiryMatch) dados.data_validade = expiryMatch[1];
  }

  // 10. CNH
  if (tipoDocumento === 'cnh') {
    if (!dados.numero_cnh) {
      const cnhNum = texto.match(/(?:REGISTRO|N[ºo°.]?\s*(?:DE\s*)?REGISTRO|CNH)\s*[:\-]?\s*(\d{9,11})/i)
        || texto.match(/\b(\d{11})\b/);
      if (cnhNum) dados.numero_cnh = cnhNum[1];
    }
    dados.numero_documento = dados.numero_documento || dados.numero_cnh;
    const catMatch = texto.match(/(?:CAT(?:EGORIA)?)\s*[:\-]?\s*([A-E]{1,4})/i);
    if (catMatch) dados.categoria_cnh = catMatch[1].toUpperCase();
    const cnhVal = texto.match(/(?:VALIDADE|VENCIMENTO)\s*[:\-]?\s*(\d{2}[\/.\-]\d{2}[\/.\-]\d{4})/i);
    if (cnhVal) dados.data_validade = cnhVal[1];
  }

  // 11. Demais tipos: número rotulado + datas genéricas
  if (!dados.numero_documento && tipoDocumento && tipoDocumento !== 'aso') {
    const genNum = texto.match(/\bN[ºo°.]?\s*(?:[UÚ]MERO\s*)?(?:DO\s+|DA\s+|DE\s+)?(?:DOCUMENTO|CERTIFICADO|REGISTRO|RG)\s*[:\-]?\s*([A-Z0-9][A-Z0-9\/\-. ]{2,24})/i);
    if (genNum) dados.numero_documento = genNum[1].trim();
  }
  if (!dados.orgao_emissor) {
    const orgMatch = texto.match(/(?:ÓRGÃO\s*EMISSOR|ORGAO\s*EMISSOR|INSTITUI[CÇ][AÃ]O|EMITIDO\s*POR)\s*[:\-]?\s*([A-ZÀ-Úa-zà-ú0-9 ./-]{3,50})/i);
    if (orgMatch) dados.orgao_emissor = orgMatch[1].trim();
  }
  if (!dados.data_emissao) {
    const emMatch = texto.match(/(?:DATA\s*(?:DE\s*)?EMISS[AÃ]O|EMITIDO\s*EM)\s*[:\-]?\s*(\d{2}[\/.\-]\d{2}[\/.\-]\d{4})/i);
    if (emMatch) dados.data_emissao = emMatch[1];
  }
  if (!dados.data_validade) {
    const vaMatch = texto.match(/(?:DATA\s*(?:DE\s*)?VALIDADE|V[ÁA]LIDO\s*AT[ÉE]|VENCIMENTO)\s*[:\-]?\s*(\d{2}[\/.\-]\d{2}[\/.\-]\d{4})/i);
    if (vaMatch) dados.data_validade = vaMatch[1];
  }

  return dados;
}

async function obterConteudoArquivo(arquivoUrl: string): Promise<{ buffer: Buffer; ext: string }> {
  if (arquivoUrl.startsWith('data:')) {
    const match = arquivoUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) throw new Error('Data URI inválida');
    const mime = match[1];
    const data = match[2];
    const buffer = Buffer.from(data, 'base64');
    let ext = mime.split('/')[1] || '';
    if (ext === 'vnd.openxmlformats-officedocument.wordprocessingml.document') ext = 'docx';
    if (ext === 'vnd.openxmlformats-officedocument.spreadsheetml.sheet') ext = 'xlsx';
    return { buffer, ext };
  }

  if (arquivoUrl.startsWith('http://') || arquivoUrl.startsWith('https://')) {
    const headers: Record<string, string> = {};
    if (arquivoUrl.includes('supabase.co/storage/')) {
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
      if (serviceKey) {
        headers['Authorization'] = `Bearer ${serviceKey}`;
      }
    }
    const response = await fetch(arquivoUrl, { headers });
    if (!response.ok) {
      throw new Error(`Falha ao baixar arquivo da URL: ${response.status} ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Detect structure from Content-Type
    const contentType = response.headers.get('content-type') || '';
    let ext = '';
    if (contentType.includes('pdf')) ext = 'pdf';
    else if (contentType.includes('word') || contentType.includes('officedocument.wordprocessingml')) ext = 'docx';
    else if (contentType.includes('sheet') || contentType.includes('officedocument.spreadsheetml')) ext = 'xlsx';
    else if (contentType.includes('png')) ext = 'png';
    else if (contentType.includes('jpeg') || contentType.includes('jpg')) ext = 'jpg';
    else if (contentType.includes('webp')) ext = 'webp';
    else if (contentType.includes('text/plain')) ext = 'txt';
    else if (contentType.includes('csv')) ext = 'csv';

    // Se não encontrou pelo Content-Type, tentar pelo nome do arquivo na URL
    if (!ext) {
      const urlSemParams = arquivoUrl.split('?')[0];
      const parsedExt = path.extname(urlSemParams).toLowerCase().replace('.', '');
      if (parsedExt) ext = parsedExt;
    }

    return { buffer, ext };
  }

  // Caminho local
  try {
    const localPath = path.resolve(arquivoUrl);
    if (fs.existsSync(localPath)) {
      const buffer = fs.readFileSync(localPath);
      const ext = path.extname(localPath).toLowerCase().replace('.', '');
      return { buffer, ext };
    }
  } catch (err) {
    // Ignore and let it fail below
  }

  throw new Error(`Caminho ou URL de arquivo inválido: ${arquivoUrl}`);
}

async function detectarExtensao(buffer: Buffer, extIndicada: string): Promise<string> {
  if (buffer.length < 4) return extIndicada || 'txt';
  
  // PDF: %PDF
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return 'pdf';
  }
  
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return 'png';
  }
  
  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return 'jpg';
  }
  
  // ZIP / DOCX / XLSX: PK..
  if (buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04) {
    try {
      const JSZip = (await import('jszip')).default;
      const zip = await JSZip.loadAsync(buffer);
      if (zip.file('word/document.xml')) {
        return 'docx';
      }
      if (zip.file('xl/workbook.xml')) {
        return 'xlsx';
      }
    } catch {
      // ignore zip identification error and fallback
    }
    return 'zip';
  }
  
  return extIndicada || 'txt';
}

/**
 * Converte páginas de um PDF em imagens PNG usando pdfjs-dist + canvas.
 * Retorna um array de buffers PNG, um por página.
 */
async function converterPDFParaImagens(pdfBuffer: Buffer): Promise<Buffer[]> {
  try {
    const pdfjsModule = await import('pdfjs-dist/legacy/build/pdf.mjs').catch(() => import('pdfjs-dist'));
    const pdfjs = (pdfjsModule as any).getDocument ? pdfjsModule : ((pdfjsModule as any).default || pdfjsModule);

    const canvasModule = await import('canvas');
    const canvas = (canvasModule as any).createCanvas ? canvasModule : ((canvasModule as any).default || canvasModule);

    // pdf.js 4.x: pass CanvasFactory *class*, not a canvasFactory instance
    // (deprecated: `canvasFactory`-instance option).
    class NodeCanvasFactory {
      constructor(_opts?: { ownerDocument?: unknown; enableHWA?: boolean }) {}
      _createCanvas(width: number, height: number) {
        return canvas.createCanvas(width, height);
      }
      create(width: number, height: number) {
        const c = this._createCanvas(width, height);
        return { canvas: c, context: c.getContext('2d') };
      }
      reset(canvasAndContext: { canvas: any }, width: number, height: number) {
        canvasAndContext.canvas.width = width;
        canvasAndContext.canvas.height = height;
      }
      destroy(canvasAndContext: { canvas: any; context: any }) {
        if (canvasAndContext.canvas) {
          canvasAndContext.canvas.width = 0;
          canvasAndContext.canvas.height = 0;
          canvasAndContext.canvas = null;
        }
        canvasAndContext.context = null;
      }
    }

    const docData = new Uint8Array(pdfBuffer);
    const pdfDoc = await pdfjs.getDocument({
      data: docData,
      CanvasFactory: NodeCanvasFactory,
      disableFontFace: true,
    }).promise;

    const factory: InstanceType<typeof NodeCanvasFactory> =
      pdfDoc.canvasFactory || new NodeCanvasFactory();
    const imagens: Buffer[] = [];
    const MAX_PAGINAS = 5;

    for (let i = 1; i <= Math.min(pdfDoc.numPages, MAX_PAGINAS); i++) {
      const page = await pdfDoc.getPage(i);
      const viewport = page.getViewport({ scale: 2.0 });
      const canvasAndContext = factory.create(viewport.width, viewport.height);
      if (canvasAndContext.context) {
        canvasAndContext.context.imageSmoothingEnabled = true;
      }

      await page.render({ canvasContext: canvasAndContext.context as any, viewport }).promise;

      const pageBuffer = canvasAndContext.canvas.toBuffer('image/png');
      imagens.push(pageBuffer);
      factory.destroy(canvasAndContext);
      console.log(`[OCR/PDF→IMG] Página ${i}/${Math.min(pdfDoc.numPages, MAX_PAGINAS)} convertida para PNG (${pageBuffer.length} bytes).`);
    }

    return imagens;
  } catch (err: any) {
    console.warn('[OCR/PDF→IMG] Falha ao converter PDF para imagens no Node:', err.message);
    return [];
  }
}

/**
 * Extrai texto de um PDF digitalizado enviando-o ao LLM com visão.
 * Converte PDF em imagens PNG antes de enviar (compatível com llama.cpp e outros).
 * Retorna null se o LLM não suportar visão ou se o provider não casar com o modelo.
 */
async function extrairTextoViaLLMVisao(
  buffer: Buffer,
  mimeType: string = 'application/pdf',
  imagensPreConvertidas?: Buffer[]
): Promise<string | null> {
  const { getIAConfig } = await import('@/lib/ia/client');
  const config = await getIAConfig();
  if (!visaoLlmCompativel(config)) {
    console.log(
      `[OCR/LLM-Visão] Pulando visão: provider "${config?.provider || '?'}" ` +
      `+ modelo "${config?.model_default || '?'}" incompatível (ex.: llamacpp+gemini).`
    );
    return null;
  }

  const isPDF = mimeType === 'application/pdf' || buffer.subarray(0, 4).toString() === '%PDF';

  let imageBuffers: Buffer[] = imagensPreConvertidas?.length ? imagensPreConvertidas : [];

  if (imageBuffers.length === 0 && isPDF) {
    try {
      console.log('[OCR/LLM-Visão] PDF detectado, convertendo páginas para imagens PNG...');
      imageBuffers = await converterPDFParaImagens(buffer);
      if (imageBuffers.length === 0) {
        console.warn('[OCR/LLM-Visão] Nenhuma página extraída do PDF.');
        return null;
      }
      console.log(`[OCR/LLM-Visão] ${imageBuffers.length} página(s) convertida(s) para PNG.`);
    } catch (convertErr: any) {
      console.warn(`[OCR/LLM-Visão] Falha ao converter PDF para imagens: ${convertErr.message}.`);
      return null;
    }
  }

  if (imageBuffers.length === 0) {
    imageBuffers = [buffer];
  }

  const systemPrompt = `Você é um sistema de OCR. Extraia TODO o texto visível do documento fornecido.
Transcreva o conteúdo exatamente como aparece, preservando a estrutura e quebras de linha.
Inclua cabeçalhos, rodapés, carimbos, assinaturas legíveis, tabelas, e qualquer informação visível.
Retorne APENAS o texto extraído, sem explicações, sem formatação markdown.`;

  const userText = imageBuffers.length > 1
    ? `Extraia todo o texto deste documento (${imageBuffers.length} páginas):`
    : 'Extraia todo o texto deste documento:';

  const contentParts: Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string } }> = [
    { type: 'text' as const, text: userText },
  ];

  for (const imgBuffer of imageBuffers) {
    const base64Data = imgBuffer.toString('base64');
    contentParts.push({
      type: 'image_url' as const,
      image_url: { url: `data:image/png;base64,${base64Data}` },
    });
  }

  const formatName = `${config!.provider}_image_url`;

  try {
    console.log(
      `[OCR/LLM-Visão] Enviando ${imageBuffers.length} imagem(ns) ao LLM com formato "${formatName}" ` +
      `(modelo: ${config!.model_default}, provider: ${config!.provider})...`
    );

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: contentParts },
    ];

    const response = await fetch(`${config!.endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config!.api_key}`,
      },
      body: JSON.stringify({
        model: config!.model_default,
        messages,
        max_tokens: config!.max_tokens || 4096,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Sem detalhes');
      console.warn(`[OCR/LLM-Visão] Formato "${formatName}" retornou ${response.status}: ${errorText.substring(0, 300)}`);
      return null;
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || '';

    if (content.includes('<think>')) {
      content = content.substring(content.indexOf('</think>') + 8).trim();
    }
    content = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

    if (content.length >= 10) {
      console.log(`[OCR/LLM-Visão] Formato "${formatName}" extraiu ${content.length} caracteres.`);
      return content;
    }
    console.warn(`[OCR/LLM-Visão] Formato "${formatName}" retornou texto muito curto (${content.length} chars).`);
  } catch (err: any) {
    console.warn(`[OCR/LLM-Visão] Formato "${formatName}" falhou: ${err.message}`);
  }

  console.log('[OCR/LLM-Visão] Visão LLM não retornou texto utilizável.');
  return null;
}

async function ocrImagensComTesseract(
  imagens: Buffer[],
  idioma: string
): Promise<{ texto: string; confianca: number } | null> {
  if (!imagens.length) return null;
  const textPages: string[] = [];
  let totalConfidence = 0;
  let confidenceCount = 0;

  for (let i = 0; i < imagens.length; i++) {
    const pageOcr = await processarComTesseract(imagens[i], idioma);
    if (pageOcr && textoOcrSuficiente(pageOcr.texto, 5)) {
      console.log(
        `[OCR/Tesseract] Página ${i + 1}/${imagens.length} extraiu ${pageOcr.texto.length} caracteres (confiança ${Math.round(pageOcr.confianca)}).`
      );
      textPages.push(pageOcr.texto);
      totalConfidence += pageOcr.confianca;
      confidenceCount++;
    }
  }

  if (confidenceCount === 0) return null;
  return { texto: textPages.join('\n\n'), confianca: Math.round(totalConfidence / confidenceCount) };
}

async function ocrPdfDigitalizado(buffer: Buffer, idioma: string = 'por'): Promise<{ texto: string; confianca: number }> {
  // 1) pdf-parse com render customizado — camada de texto residual
  try {
    // @ts-expect-error - pdf-parse/lib/pdf-parse.js sem tipos
    const pdfParseModule = await import('pdf-parse/lib/pdf-parse.js').catch(() => import('pdf-parse'));
    const pdfParse = typeof pdfParseModule === 'function' ? pdfParseModule : (pdfParseModule.default || pdfParseModule);

    const customRenderPage = (pageData: any) => {
      return pageData.getTextContent({ normalizeWhitespace: true }).then((textContent: any) => {
        let lastY: number | null = null;
        let text = '';
        for (const item of textContent.items) {
          if ('str' in item) {
            if (lastY !== null && Math.abs(item.transform[5] - lastY) > 2) {
              text += '\n';
            }
            text += item.str;
            lastY = item.transform[5];
          }
        }
        return text;
      });
    };

    const data = await pdfParse(buffer, { pagerender: customRenderPage });
    const texto = (data.text || '').trim();

    if (textoOcrSuficiente(texto)) {
      console.log(`[OCR/PDF] pdf-parse (render custom) extraiu ${texto.length} caracteres.`);
      return { texto, confianca: 95 };
    }
    console.log('[OCR/PDF] pdf-parse retornou texto insuficiente (' + texto.length + ' chars), tentando OCR local...');
  } catch (error: any) {
    console.warn(`[OCR/PDF] Falha no pdf-parse customizado: ${error.message}`);
  }

  const serverless = isAmbienteServerless();
  let imagens: Buffer[] = [];
  let localResult: { texto: string; confianca: number } | null = null;

  // 2) Converter PDF → PNG UMA vez, depois Tesseract (antes de qualquer visão LLM)
  if (!serverless) {
    try {
      imagens = await converterPDFParaImagens(buffer);
      localResult = await ocrImagensComTesseract(imagens, idioma);
      if (localResult && textoOcrSuficiente(localResult.texto)) {
        console.log(`[OCR/PDF] Tesseract extraiu ${localResult.texto.length} caracteres do PDF digitalizado.`);
        return localResult;
      }
    } catch (localError: any) {
      console.warn(`[OCR/PDF] Fallback local (pdfjs+tesseract) falhou: ${localError.message}`);
    }
  }

  // 3) Visão LLM só se OCR local fraco E provider/modelo realmente compatíveis
  try {
    const { getIAConfig } = await import('@/lib/ia/client');
    const iaConfig = await getIAConfig();
    if (!visaoLlmCompativel(iaConfig)) {
      console.log(
        `[OCR/PDF] Visão LLM pulada: provider "${iaConfig?.provider || '?'}" ` +
        `+ modelo "${iaConfig?.model_default || '?'}" incompatível ou sem endpoint.`
      );
    } else {
      const texto = await extrairTextoViaLLMVisao(buffer, 'application/pdf', imagens);
      if (texto && textoOcrSuficiente(texto)) {
        console.log(`[OCR/PDF] LLM visão extraiu ${texto.length} caracteres do PDF digitalizado.`);
        return { texto, confianca: 90 };
      }
    }
  } catch (llmError: any) {
    console.warn(`[OCR/PDF] LLM visão falhou: ${llmError.message}`);
  }

  if (localResult && localResult.texto.trim()) {
    return localResult;
  }

  console.warn('[OCR/PDF] Não foi possível extrair texto do PDF digitalizado. Documento permanece editável.');
  return { texto: '', confianca: 0 };
}

async function processarPDF(buffer: Buffer, idioma: string = 'por'): Promise<{ texto: string; confianca: number }> {
  let digitalTexto = '';
  try {
    // @ts-expect-error - pdf-parse/lib/pdf-parse.js sem tipos
    const pdfParseModule = await import('pdf-parse/lib/pdf-parse.js').catch(() => import('pdf-parse'));
    const pdfParse = typeof pdfParseModule === 'function' ? pdfParseModule : (pdfParseModule.default || pdfParseModule);
    const data = await pdfParse(buffer);
    digitalTexto = data.text || '';
  } catch (error: any) {
    console.warn(`[OCR/PDF] Erro ao extrair texto digital do PDF, tentando OCR via canvas: ${error.message}`);
  }

  // Se extraiu texto e parece conter conteúdo real (mais de 10 caracteres)
  if (digitalTexto.trim().length >= 10) {
    return {
      texto: digitalTexto,
      confianca: 100,
    };
  }

  console.log('[OCR/PDF] O PDF parece ser digitalizado (imagem) ou está sem camada de texto. Executando OCR...');
  return await ocrPdfDigitalizado(buffer, idioma);
}

async function processarDOCX(buffer: Buffer): Promise<{ texto: string; confianca: number }> {
  try {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(buffer);
    const docXml = await zip.file('word/document.xml')?.async('text');
    if (!docXml) {
      throw new Error('Documento Word inválido (word/document.xml não encontrado)');
    }
    
    const paragraphs = docXml.split('<w:p');
    const textParts: string[] = [];
    
    for (const p of paragraphs) {
      const matches = p.match(/<w:t[^>]*>(.*?)<\/w:t>/g);
      if (matches) {
        const pText = matches
          .map(m => {
            const content = m.replace(/<w:t[^>]*>|<\/w:t>/g, '');
            return decodeXmlEntities(content);
          })
          .join('');
        if (pText.trim()) {
          textParts.push(pText);
        }
      }
    }
    
    return {
      texto: textParts.join('\n'),
      confianca: 100,
    };
  } catch (error: any) {
    throw new Error(`Erro ao extrair texto do Word (.docx): ${error.message}`);
  }
}

async function processarXLSX(buffer: Buffer): Promise<{ texto: string; confianca: number }> {
  try {
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const textParts: string[] = [];
    
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet);
      if (csv.trim()) {
        textParts.push(`--- Planilha: ${sheetName} ---`);
        textParts.push(csv);
      }
    }
    
    return {
      texto: textParts.join('\n\n'),
      confianca: 100,
    };
  } catch (error: any) {
    throw new Error(`Erro ao extrair dados do Excel (.xlsx): ${error.message}`);
  }
}

async function processarTXT(buffer: Buffer): Promise<{ texto: string; confianca: number }> {
  return {
    texto: buffer.toString('utf-8'),
    confianca: 100,
  };
}

function limparTextoOCR(texto: string): string {
  return texto
    .replace(/[|¦\\]/g, 'I')
    .replace(/[‘’'`]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/[•·]/g, '.')
    .replace(/[©®™]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function processarComTesseract(
  buffer: Buffer,
  idioma: string = 'por'
): Promise<{ texto: string; confianca: number } | null> {
  try {
    const TesseractModule = await import('tesseract.js');
    const Tesseract = (TesseractModule as any).default || TesseractModule;
    if (typeof Tesseract.recognize === 'function') {
      const { data } = await Tesseract.recognize(buffer, idioma, {
        logger: () => {},
      });
      return { texto: limparTextoOCR(data.text), confianca: data.confidence };
    }
    return null;
  } catch (error) {
    console.error('[OCR Tesseract] Erro:', error);
    return null;
  }
}

function promptExtracaoLLM(tipoDocumento: OCRTipoDocumento): string {
  if (tipoDocumento === 'aso') {
    return `Você é um extrator de dados estruturados especializado em Atestados de Saúde Ocupacional (ASO) no padrão brasileiro e-Social.
Dada a extração bruta de texto (OCR) de um ASO, seu trabalho é identificar com máxima precisão os seguintes campos em formato JSON:
{
  "cpf": "somente números do CPF do colaborador",
  "rg": "somente números do RG do colaborador (não confunda com CPF!)",
  "nome_completo": "Nome completo do colaborador (apenas o nome, em maiúsculas)",
  "data_nascimento": "Data de nascimento do colaborador no formato YYYY-MM-DD",
  "tipo_exame": "Selecione estritamente uma das opções: 'admissional', 'periodico', 'demissional', 'retorno', 'mudanca_funcao'",
  "resultado": "Selecione estritamente uma das opções: 'apto', 'inapto', 'apto_condicional'",
  "data_realizacao": "Data de emissão/conclusão do ASO no formato YYYY-MM-DD (sempre a partir de DD/MM/AAAA brasileiro)",
  "medico_examinador_nome": "Nome do médico que assina/examina",
  "medico_examinador_crm": "Apenas números do CRM do médico examinador",
  "medico_examinador_uf": "UF do CRM do médico examinador (ex: RJ, SP, etc)",
  "medico_pcmso_nome": "Nome do médico coordenador do PCMSO",
  "medico_pcmso_crm": "Apenas números do CRM do médico coordenador",
  "medico_pcmso_uf": "UF do CRM do médico coordenador (ex: RJ, SP, etc)",
  "cnpj_clinica": "Apenas números do CNPJ da clínica (se disponível)",
  "nome_clinica": "Nome da clínica ou laboratório",
  "exames_realizados": [
    {
      "nome": "Nome do exame (ex: ELETROCARDIOGRAMA, GLICOSE, etc)",
      "data": "Data do exame no formato YYYY-MM-DD (sempre a partir de DD/MM/AAAA brasileiro; 10/08/2026 = 2026-08-10, nunca 2026-10-08)"
    }
  ]
}

Atenção especial (Regras de Negócio):
1. EMPRESA X CLÍNICA: A empresa "Águas", "Águas do Brasil", "Grupo Águas" ou "ABZ" é a EMPRESA CONTRATANTE (Empregador). NUNCA defina esses nomes como "nome_clinica". A clínica será um laboratório ou centro de saúde ocupacional emitente do laudo.
2. RG e CPF: Nunca confunda o CPF do colaborador com o RG dele. CPF tem formato XXX.XXX.XXX-XX. RG varia e costuma ser menor.
3. Nome Completo: Certifique-se de retornar apenas o nome da pessoa e ignorar textos subsequentes de empresas/linhas adicionais.
4. Resultado: Se o documento contiver tanto "APTO" quanto "INAPTO" (como em formulários com caixa de seleção), avalie o contexto ou qual caixa/marcação está selecionada (como "(X) APTO" ou "to) APTO" vs "( ) INAPTO").
5. Data de nascimento: Procure especificamente por rótulos como DN, DATA NASCIMENTO, NASCIMENTO, NASC:, etc. Não retorne a data de realização do exame como data de nascimento.
6. Diferencie o Médico Examinador (quem assina/carimba o exame atual) do Médico Coordenador (responsável pelo PCMSO).
7. Exames: Liste TODOS os procedimentos/exames clínicos realizados no paciente, com suas respectivas datas. Se houver "EXAME CLINICO - ASO", adicione na lista.
8. Datas: Sempre interprete números como DD/MM/AAAA (padrão brasileiro), mesmo que o laudo misture formato inglês (MM/DD). 10/08/2026 e 08/10/2026 no mesmo ASO de 10 de agosto viram 2026-08-10. Nunca use Date.parse americano. Retorne YYYY-MM-DD.
9. Evite deduções incertas. Não duplique dados e não preencha campos de clínica com informações da empresa contratante.

Retorne APENAS o objeto JSON válido, sem explicações, sem blocos de código markdown.`;
  }

  return `Você extrai dados estruturados de um documento do tipo "${tipoDocumento}".
Dado o texto OCR, retorne APENAS um JSON válido com estes campos (use null se o campo não existir no documento):
{
  "cpf": "somente dígitos do CPF, se impresso",
  "nome_completo": "nome da pessoa titular",
  "numero_documento": "número próprio impresso (passaporte, CNH, certificado, RG, visto…)",
  "orgao_emissor": "órgão/autoridade/instituição/país emissor",
  "data_emissao": "YYYY-MM-DD",
  "data_validade": "YYYY-MM-DD",
  "numero_passaporte": "número do passaporte se aplicável (ex: FG123456)",
  "numero_cnh": "número de registro da CNH se aplicável",
  "categoria_cnh": "categoria da CNH se aplicável (A, B, AB…)",
  "rg": "número do RG se aplicável"
}

Regras:
- Passaporte: Passport No / Nº do passaporte, Date of issue, Date of expiry, Authority (PF, DPF, país).
- CNH: registro, validade, categoria.
- Certificado/treinamento: número do certificado, instituição, data de realização e validade.
- Não invente valores. Campos ausentes = null.
- Datas estritamente YYYY-MM-DD.
- Retorne APENAS o JSON, sem markdown e sem explicações.`;
}

async function extrairDadosComLLM(
  texto: string,
  tipoDocumento: OCRTipoDocumento,
  profileCpf?: string | null
): Promise<Record<string, any> | null> {
  if (!deveExtrairEstruturaComLlm(texto, tipoDocumento)) {
    console.log('[OCR/LLM] Extração estruturada pulada (texto vazio/insuficiente).');
    return null;
  }

  try {
    const { getIAConfig } = await import('@/lib/ia/client');
    const config = await getIAConfig();
    if (!config || !config.ativo) {
      console.log('[OCR/LLM] Nenhuma configuração ativa de IA encontrada no banco.');
      return null;
    }

    const systemPrompt = promptExtracaoLLM(tipoDocumento);

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: texto }
    ];

    console.log(`[OCR/LLM] Enviando texto ao LLM para extração inteligente (${tipoDocumento}) — sem tools...`);

    const response = await fetch(`${config.endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.api_key}`,
      },
      body: JSON.stringify({
        model: config.model_default,
        messages,
        max_tokens: Math.min(config.max_tokens || 2048, 2048),
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Sem detalhes');
      console.warn(`[OCR/LLM] LLM retornou ${response.status}: ${errorText.substring(0, 200)}`);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      console.warn('[OCR/LLM] Resposta do LLM veio vazia.');
      return null;
    }

    let jsonText = content.trim();

    // Remover blocos de raciocínio (como <think>...</think> do DeepSeek/Qwen)
    if (jsonText.includes('</think>')) {
      const index = jsonText.indexOf('</think>');
      jsonText = jsonText.substring(index + 8).trim();
    }
    if (jsonText.includes('<think>')) {
      jsonText = jsonText.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    }

    if (jsonText.startsWith('```')) {
      const match = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match) {
        jsonText = match[1];
      }
    }

    const parsed = JSON.parse(jsonText);

    // Validação matemática de CPF extraído pela IA
    if (parsed.cpf) {
      const cpfClean = String(parsed.cpf).replace(/\D/g, '');
      if (validarCPF(cpfClean)) {
        parsed.cpf = cpfClean;
      } else {
        console.log(`[OCR/LLM] CPF retornado pelo LLM (${cpfClean}) é inválido pelo Módulo 11. Tentando auto-reparo...`);
        const reparado = repararCPFOptico(cpfClean, profileCpf);
        if (reparado && validarCPF(reparado.cpf)) {
          console.log(`[OCR/LLM] CPF reparado com sucesso: ${cpfClean} -> ${reparado.cpf}`);
          parsed.cpf = reparado.cpf;
        } else {
          console.warn(`[OCR/LLM] Não foi possível reparar CPF do LLM (${cpfClean}). Descartando para uso do extrator regex inteligente.`);
          delete parsed.cpf;
        }
      }
    }

    // Validação matemática de CNPJ da clínica
    if (parsed.cnpj_clinica) {
      const cnpjClean = String(parsed.cnpj_clinica).replace(/\D/g, '');
      if (validarCNPJ(cnpjClean)) {
        parsed.cnpj_clinica = cnpjClean;
      } else {
        delete parsed.cnpj_clinica;
      }
    }

    if (tipoDocumento === 'aso' && parsed.resultado === 'inapto') {
      const resHeuristica = extrairResultadoInteligente(texto);
      if (resHeuristica === 'apto') {
        console.log('[OCR/LLM] LLM indicou inapto por falso positivo de gabarito. Corrigindo para apto.');
        parsed.resultado = 'apto';
      }
    }

    // Validação de data de nascimento (evitar século 19 ou ano do exame)
    if (parsed.data_nascimento) {
      const mDN = String(parsed.data_nascimento).match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (mDN) {
        let ano = parseInt(mDN[1], 10);
        if (ano < 1920 && ano >= 1800) ano += 100;
        if (ano < 1940 || ano >= 2015) {
          delete parsed.data_nascimento;
        } else {
          parsed.data_nascimento = `${ano}-${mDN[2]}-${mDN[3]}`;
        }
      }
    }

    console.log('[OCR/LLM] Dados extraídos e validados via LLM com sucesso:', parsed);
    return parsed;
  } catch (err: any) {
    console.warn(`[OCR/LLM] Falha ao extrair dados via LLM (${tipoDocumento}), usando fallback de regex:`, err.message);
    return null;
  }
}

/**
 * Processa imagens pré-renderizadas pelo navegador via LLM com visão.
 * Essa função é usada quando o cliente (browser) converte o PDF em imagens
 * usando Canvas API e envia as imagens já prontas para a API.
 * 
 * Isso resolve o problema do Vercel serverless que não tem suporte ao
 * módulo nativo `canvas` do Node.js.
 */
export async function processarImagensPreRenderizadas(
  images: string[], // data URIs base64 (data:image/jpeg;base64,...)
  tipoDocumento?: OCRTipoDocumento,
  profileCpf?: string | null
): Promise<OCRExtractResult> {
  try {
    if (!images || images.length === 0) {
      return { success: false, error: 'Nenhuma imagem fornecida' };
    }

    console.log(`[OCR/ClientImages] Recebidas ${images.length} imagens pré-renderizadas pelo navegador.`);

    const buffers: Buffer[] = [];
    for (const img of images) {
      const match = img.match(/^data:[^;]+;base64,(.+)$/);
      if (match) buffers.push(Buffer.from(match[1], 'base64'));
    }

    let texto = '';
    let confianca = 0;

    if (!isAmbienteServerless() && buffers.length > 0) {
      const local = await ocrImagensComTesseract(buffers, 'por');
      if (local && textoOcrSuficiente(local.texto)) {
        texto = local.texto;
        confianca = local.confianca;
        console.log(`[OCR/ClientImages] Tesseract local extraiu ${texto.length} caracteres.`);
      }
    }

    const { getIAConfig } = await import('@/lib/ia/client');
    const config = await getIAConfig();

    if (!textoOcrSuficiente(texto) && visaoLlmCompativel(config)) {
      const systemPrompt = `Você é um sistema de OCR. Extraia TODO o texto visível das imagens do documento fornecido.
Transcreva o conteúdo exatamente como aparece, preservando a estrutura e quebras de linha.
Inclua cabeçalhos, rodapés, carimbos, assinaturas legíveis, tabelas, e qualquer informação visível.
Retorne APENAS o texto extraído, sem explicações, sem formatação markdown.`;

      const userContent: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
        { type: 'text', text: `Extraia todo o texto deste documento (${images.length} página(s)):` },
      ];

      for (const img of images) {
        userContent.push({
          type: 'image_url',
          image_url: { url: img },
        });
      }

      const messages = [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: userContent },
      ];

      console.log(`[OCR/ClientImages] Enviando ${images.length} imagens ao LLM "${config!.model_default}" (provider: ${config!.provider})...`);

      const response = await fetch(`${config!.endpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config!.api_key}`,
        },
        body: JSON.stringify({
          model: config!.model_default,
          messages,
          max_tokens: config!.max_tokens || 4096,
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Sem detalhes');
        console.error(`[OCR/ClientImages] LLM retornou ${response.status}: ${errorText.substring(0, 500)}`);

        if (images.length > 1 && (response.status === 400 || response.status === 422)) {
          console.log('[OCR/ClientImages] Tentando enviar imagens individualmente...');
          return await processarImagensIndividualmente(images, config, tipoDocumento, profileCpf);
        }
      } else {
        const data = await response.json();
        let visionText = data.choices?.[0]?.message?.content || '';

        if (visionText.includes('<think>')) {
          visionText = visionText.substring(visionText.indexOf('</think>') + 8).trim();
        }
        visionText = visionText.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

        if (textoOcrSuficiente(visionText)) {
          texto = visionText;
          confianca = 90;
          console.log(`[OCR/ClientImages] LLM extraiu ${texto.length} caracteres com sucesso.`);
        }
      }
    } else if (!textoOcrSuficiente(texto)) {
      console.log(
        `[OCR/ClientImages] Visão LLM pulada: provider "${config?.provider || '?'}" ` +
        `+ modelo "${config?.model_default || '?'}" incompatível.`
      );
    }

    const dadosRegex = extrairDadosTexto(texto, tipoDocumento, profileCpf);
    let dadosIa: Record<string, any> | null = null;
    if (deveExtrairEstruturaComLlm(texto, tipoDocumento, dadosRegex)) {
      dadosIa = await extrairDadosComLLM(texto, tipoDocumento || 'outro', profileCpf);
    }

    const dadosIaLimpos: Record<string, any> = {};
    if (dadosIa) {
      Object.keys(dadosIa).forEach(key => {
        if (dadosIa![key] !== null && dadosIa![key] !== undefined && dadosIa![key] !== '') {
          dadosIaLimpos[key] = dadosIa![key];
        }
      });
    }

    return {
      success: true,
      data: { texto, dadosExtraidos: { ...dadosRegex, ...dadosIaLimpos }, confianca },
    };
  } catch (error) {
    console.error('[OCR/ClientImages] Erro inesperado:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao processar imagens',
    };
  }
}

/**
 * Fallback: Processa imagens uma a uma se o LLM não aceitar múltiplas de uma vez.
 */
async function processarImagensIndividualmente(
  images: string[],
  config: any,
  tipoDocumento?: OCRTipoDocumento,
  profileCpf?: string | null
): Promise<OCRExtractResult> {
  const systemPrompt = `Você é um sistema de OCR. Extraia TODO o texto visível da imagem do documento.
Transcreva o conteúdo exatamente como aparece, preservando a estrutura e quebras de linha.
Retorne APENAS o texto extraído, sem explicações, sem formatação markdown.`;

  const textos: string[] = [];

  for (let i = 0; i < images.length; i++) {
    try {
      console.log(`[OCR/ClientImages] Processando imagem ${i + 1}/${images.length}...`);

      const messages = [
        { role: 'system' as const, content: systemPrompt },
        {
          role: 'user' as const,
          content: [
            { type: 'text', text: `Extraia todo o texto desta página ${i + 1}:` },
            { type: 'image_url', image_url: { url: images[i] } },
          ],
        },
      ];

      const response = await fetch(`${config.endpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.api_key}`,
        },
        body: JSON.stringify({
          model: config.model_default,
          messages,
          max_tokens: config.max_tokens || 4096,
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        console.warn(`[OCR/ClientImages] Página ${i + 1} falhou: ${response.status}`);
        continue;
      }

      const data = await response.json();
      let content = data.choices?.[0]?.message?.content || '';

      // Limpar blocos de raciocínio
      if (content.includes('<think>')) {
        content = content.substring(content.indexOf('</think>') + 8).trim();
      }
      content = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

      if (content.length >= 5) {
        textos.push(content);
      }
    } catch (err: any) {
      console.warn(`[OCR/ClientImages] Erro na página ${i + 1}:`, err.message);
    }
  }

  if (textos.length === 0) {
    return { success: false, error: 'Nenhuma página pôde ser processada pelo LLM.' };
  }

  const texto = textos.join('\n\n');

  const dadosRegex = extrairDadosTexto(texto, tipoDocumento, profileCpf);
  let dadosIa: Record<string, any> | null = null;
  if (deveExtrairEstruturaComLlm(texto, tipoDocumento, dadosRegex)) {
    dadosIa = await extrairDadosComLLM(texto, tipoDocumento || 'outro', profileCpf);
  }

  const dadosIaLimpos: Record<string, any> = {};
  if (dadosIa) {
    Object.keys(dadosIa).forEach(key => {
      if (dadosIa![key] !== null && dadosIa![key] !== undefined && dadosIa![key] !== '') {
        dadosIaLimpos[key] = dadosIa![key];
      }
    });
  }

  return {
    success: true,
    data: { texto, dadosExtraidos: { ...dadosRegex, ...dadosIaLimpos }, confianca: 88 },
  };
}

export async function processarDocumentoOCR(
  arquivoUrl: string,
  tipoDocumento?: OCRTipoDocumento,
  profileCpf?: string | null
): Promise<OCRExtractResult> {
  try {
    if (!arquivoUrl) {
      return { success: false, error: 'URL do arquivo é obrigatória' };
    }

    const config = await getOCRConfigFromDB();
    const serverless = isAmbienteServerless();
    let resultado: { texto: string; dadosExtraidos: Record<string, any>; confianca: number } | null = null;

    if (config.fallback_api_url) {
      try {
        const response = await fetch(config.fallback_api_url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(config.fallback_api_key ? { 'Authorization': `Bearer ${config.fallback_api_key}` } : {}),
          },
          body: JSON.stringify({ imageUrl: arquivoUrl }),
        });
        if (response.ok) {
          const extData = await response.json();
          resultado = {
            texto: extData.texto || extData.text || '',
            dadosExtraidos: extData.dadosExtraidos || {},
            confianca: extData.confianca || extData.confidence || 0,
          };
        }
      } catch (err) {
        console.warn('[OCR] Falha API externa, usando extrator local:', err);
      }
    }

    if (!resultado) {
      // 1. Obter conteúdo do arquivo como buffer
      const { buffer, ext: extIndicada } = await obterConteudoArquivo(arquivoUrl);
      
      // 2. Detectar a extensão real pelo magic number ou cabeçalho
      const ext = await detectarExtensao(buffer, extIndicada);
      
      console.log(`[OCR/Parser] Roteando arquivo do tipo: ${ext}`);

      let parseResult: { texto: string; confianca: number } | null = null;

      if (ext === 'pdf') {
        parseResult = await processarPDF(buffer, config.idioma);
      } else if (ext === 'docx') {
        parseResult = await processarDOCX(buffer);
      } else if (ext === 'xlsx') {
        parseResult = await processarXLSX(buffer);
      } else if (ext === 'txt' || ext === 'csv') {
        parseResult = await processarTXT(buffer);
      } else if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) {
        if (!serverless) {
          try {
            parseResult = await processarComTesseract(buffer, config.idioma);
            if (parseResult && textoOcrSuficiente(parseResult.texto)) {
              console.log(`[OCR/Image] Tesseract extraiu ${parseResult.texto.length} caracteres.`);
            }
          } catch (tessErr: any) {
            console.warn('[OCR/Image] Tesseract falhou:', tessErr.message);
          }
        }
        if (!textoOcrSuficiente(parseResult?.texto)) {
          try {
            const mime = ext === 'jpg' ? 'jpeg' : ext;
            const texto = await extrairTextoViaLLMVisao(buffer, `image/${mime}`, [buffer]);
            if (texto && textoOcrSuficiente(texto)) {
              parseResult = { texto, confianca: 90 };
            }
          } catch (err: any) {
            console.warn('[OCR/Image] LLM visão falhou:', err.message);
          }
        }
      } else {
        if (!serverless) {
          try {
            parseResult = await processarComTesseract(buffer, config.idioma);
          } catch {
            parseResult = await processarTXT(buffer);
          }
        }
      }

      // Arquivo salvo permanece editável mesmo se o OCR não extrair texto
      if (!parseResult) {
        parseResult = { texto: '', confianca: 0 };
        console.warn(`[OCR/Parser] Sem texto extraído para tipo ${ext}; documento permanece editável.`);
      }

      resultado = {
        texto: parseResult.texto,
        dadosExtraidos: {},
        confianca: parseResult.confianca,
      };
    }

    const dadosRegex = extrairDadosTexto(resultado.texto, tipoDocumento, profileCpf);
    let dadosIa: Record<string, any> | null = null;
    if (deveExtrairEstruturaComLlm(resultado.texto, tipoDocumento, dadosRegex)) {
      dadosIa = await extrairDadosComLLM(resultado.texto, tipoDocumento || 'outro', profileCpf);
    } else {
      console.log(
        `[OCR/LLM] Extração via LLM pulada (texto insuficiente ou regex já preencheu ${tipoDocumento || 'documento'}).`
      );
    }

    const dadosIaLimpos: Record<string, any> = {};
    if (dadosIa) {
      Object.keys(dadosIa).forEach(key => {
        if (dadosIa[key] !== null && dadosIa[key] !== undefined && dadosIa[key] !== '') {
          dadosIaLimpos[key] = dadosIa[key];
        }
      });
    }

    resultado.dadosExtraidos = {
      ...dadosRegex,
      ...dadosIaLimpos,
      ...resultado.dadosExtraidos,
    };

    return { success: true, data: resultado };
  } catch (error) {
    console.error('[OCR] Erro inesperado:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}

export function invalidateConfigCache(): void {
  configCache = null;
}
