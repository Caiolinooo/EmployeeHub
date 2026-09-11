export {
  processarDocumentoOCR,
  processarImagensPreRenderizadas,
  invalidateConfigCache,
  extrairDadosTexto,
  textoOcrSuficiente,
  visaoLlmCompativel,
  deveExtrairEstruturaComLlm,
  OCR_TEXTO_MINIMO,
} from './ocr-processor';
export type { VisaoLlmConfig } from './ocr-routing';

export {
  validarCPF,
  validarCNPJ,
  repararCPFOptico,
  extrairCPFInteligente,
  extrairResultadoInteligente,
  extrairDataNascimentoInteligente,
  extrairRGInteligente,
  extrairMedicoECRMInteligente,
  extrairCNPJInteligente,
  normalizarDigitosOCR,
  CONFUSAO_OPTICA,
  MAPA_CARACTER_PARA_DIGITO,
} from './ocr-repair';

export type {
  OCRTipoDocumento,
  OCRStatus,
  OCRResult,
  OCRProcessOptions,
  OCRExtractResult,
  OCRConfig,
} from '@/types/ocr';
