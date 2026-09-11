/**
 * Focused OCR routing tests (no Supabase / @/ aliases).
 * Run: node --experimental-strip-types scripts/test-gt-ocr-routing.ts
 */
import {
  visaoLlmCompativel,
  deveExtrairEstruturaComLlm,
  textoOcrSuficiente,
} from '../src/lib/ocr/ocr-routing.ts';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(!textoOcrSuficiente(''), 'empty text is weak');
assert(!textoOcrSuficiente('   \n'), 'whitespace is weak');
assert(!textoOcrSuficiente('abc'), 'short text is weak');
assert(textoOcrSuficiente('Passport No FG123456'), 'usable OCR text');

assert(
  visaoLlmCompativel({
    ativo: true,
    provider: 'llamacpp',
    model_default: 'gemini-3.5-flash',
    endpoint: 'http://127.0.0.1:8080/v1',
  }) === false,
  'skip vision: llamacpp + gemini mismatch'
);
assert(
  visaoLlmCompativel({
    ativo: true,
    provider: 'gemini',
    model_default: 'gemini-3.5-flash',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai',
  }) === true,
  'allow vision: gemini + gemini model'
);
assert(
  visaoLlmCompativel({
    ativo: true,
    provider: 'openai',
    model_default: 'gpt-4o',
    endpoint: 'https://api.openai.com/v1',
  }) === true,
  'allow vision: openai + gpt-4o'
);
assert(
  visaoLlmCompativel({
    ativo: true,
    provider: 'llamacpp',
    model_default: 'llava-v1.6',
    endpoint: 'http://127.0.0.1:8080/v1',
  }) === true,
  'allow vision: llamacpp + local vision model'
);
assert(
  visaoLlmCompativel({
    ativo: true,
    provider: 'llamacpp',
    model_default: 'gemini-3.5-flash',
    endpoint: '',
  }) === false,
  'skip vision: empty endpoint'
);

assert(deveExtrairEstruturaComLlm('', 'passaporte') === false, 'skip LLM on empty text');
assert(deveExtrairEstruturaComLlm('   ', 'aso') === false, 'skip LLM on whitespace');
assert(
  deveExtrairEstruturaComLlm('Passport No FG123456 Authority PF', 'passaporte', {
    numero_passaporte: 'FG123456',
  }) === false,
  'skip LLM when passport regex already filled'
);
assert(
  deveExtrairEstruturaComLlm(
    'Atestado de Saúde Ocupacional CPF 123.456.789-09 exame periodico',
    'aso'
  ) === true,
  'allow LLM for ASO with usable text'
);

console.log('OK: skip vision on provider mismatch, skip LLM on empty/passport regex');
process.exit(0);
