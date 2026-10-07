export type OCRTipoDocumento =
  | 'aso'
  | 'treinamento'
  | 'passaporte'
  | 'certificado'
  | 'laudo'
  | 'pessoal'
  | 'contratual'
  | 'demissional'
  | 'ferias'
  | 'ponto'
  | 'outro'
  // Chaves de extração civil (chegam via subtipo — ver tipoParaOcr)
  | 'cnh'
  | 'certidao_nascimento'
  | 'certidao_casamento'
  | 'reservista'
  | 'titulo_eleitor'
  | 'ctps'
  | 'documento_pessoal'
  | 'contrato';

export type OCRStatus = 'pendente' | 'processando' | 'concluido' | 'erro' | 'nao_aplicavel';

export interface OCRResult {
  texto: string;
  dadosExtraidos: Record<string, any>;
  confianca: number;
}

export interface OCRProcessOptions {
  tipoDocumento?: OCRTipoDocumento;
  bucketName?: string;
  idioma?: string;
  qualidade?: 'normal' | 'alta' | 'baixa';
  abortSignal?: AbortSignal;
}

export interface OCRExtractResult {
  success: boolean;
  data?: OCRResult;
  error?: string;
}

export interface OCRConfig {
  fallback_api_url?: string;
  fallback_api_key?: string;
  idioma: string;
  qualidade: string;
  automatico_upload?: boolean;
}
