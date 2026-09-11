/** Minimum OCR text length before treating extraction as usable. */
export const OCR_TEXTO_MINIMO = 10;

const VISION_CLOUD_MODELS = [
  'gpt-4o', 'gpt-4v', 'gpt-4-turbo', 'claude-3', 'claude-4',
  'sonnet', 'haiku', 'opus', 'gemini',
];
const VISION_LOCAL_MODELS = [
  'llava', 'bakllava', 'moondream', 'minicpm-v', 'qwen-vl', 'internvl', 'llama-vision',
];
const VISION_LOCAL_PROVIDERS = new Set(['llamacpp', 'lmstudio', 'ollama']);

export type VisaoLlmConfig = {
  provider?: string | null;
  model_default?: string | null;
  endpoint?: string | null;
  api_key?: string | null;
  ativo?: boolean | null;
};

export function textoOcrSuficiente(
  texto: string | null | undefined,
  minimo: number = OCR_TEXTO_MINIMO
): boolean {
  return (texto || '').trim().length >= minimo;
}

/**
 * Vision is allowed only when the configured provider can actually serve the
 * model (e.g. gemini+gemini, openai+gpt-4o, llamacpp+llava).
 * llamacpp + gemini is a mismatch and must be skipped.
 */
export function visaoLlmCompativel(config: VisaoLlmConfig | null | undefined): boolean {
  if (!config || config.ativo === false) return false;
  if (!(config.endpoint || '').trim()) return false;
  const provider = (config.provider || '').toLowerCase();
  const model = (config.model_default || '').toLowerCase();
  if (!model) return false;

  const localVision = VISION_LOCAL_MODELS.some((m) => model.includes(m));
  const cloudVision = VISION_CLOUD_MODELS.some((m) => model.includes(m));

  if (VISION_LOCAL_PROVIDERS.has(provider)) {
    return localVision;
  }
  return cloudVision;
}

/**
 * Never send empty/weak OCR text into a tools-enabled chat client.
 * Simple docs (passaporte) with regex already filled skip the LLM round-trip.
 */
export function deveExtrairEstruturaComLlm(
  texto: string | null | undefined,
  tipoDocumento?: string | null,
  dadosRegex?: Record<string, unknown> | null
): boolean {
  if (!textoOcrSuficiente(texto)) return false;
  const tipo = String(tipoDocumento || '').toLowerCase();
  if (tipo === 'passaporte') {
    const numero = dadosRegex?.numero_passaporte || dadosRegex?.numero_documento;
    if (numero) return false;
  }
  return true;
}
