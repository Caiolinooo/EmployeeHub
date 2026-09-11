/**
 * Focused checks for GT document upload MIME/type mapping and passport OCR regex.
 * Run: npx tsx scripts/test-gt-doc-upload-helpers.ts
 */
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const {
    resolverMimeArquivo,
    normalizarTipoDocumento,
    validarDatasObrigatorias,
  } = await import('../src/lib/gestao-tripulantes/documento-integrity');
  const {
    extrairDadosTexto,
  } = await import('../src/lib/ocr/ocr-processor');
  const {
    visaoLlmCompativel,
    deveExtrairEstruturaComLlm,
    textoOcrSuficiente,
  } = await import('../src/lib/ocr/ocr-routing');
  const { extrairNumeroDocumentoDoTexto } = await import('../src/lib/gestao-tripulantes/ocr-processor');

  const jpegMagic = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
  const pdfMagic = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0x00, 0x00]);

  assert(resolverMimeArquivo('passaporte.jpg', '', jpegMagic) === 'image/jpeg', 'empty MIME + jpeg magic');
  assert(resolverMimeArquivo('scan.JPG', 'image/jpg', jpegMagic) === 'image/jpeg', 'image/jpg alias');
  assert(resolverMimeArquivo('doc.pdf', 'application/octet-stream', pdfMagic) === 'application/pdf', 'octet-stream pdf');
  assert(resolverMimeArquivo('foto.png', '', null) === 'image/png', 'png by extension');
  assert(resolverMimeArquivo('virus.exe', 'application/x-msdownload', null) === null, 'reject unknown');

  assert(normalizarTipoDocumento('passaporte').tipo === 'passaporte', 'passaporte valid');
  assert(normalizarTipoDocumento('visto').tipo === 'documento_pessoal', 'visto maps');
  assert(normalizarTipoDocumento('visto').subtipo === 'visto', 'visto subtipo');
  assert(normalizarTipoDocumento('habilitacao').tipo === 'cnh', 'habilitacao maps to cnh');
  assert(normalizarTipoDocumento('foo').invalido === true, 'unknown tipo');

  const datesOk = validarDatasObrigatorias(
    { data_emissao: null, data_validade: null, tipo_documento: 'passaporte' },
    { permitirSemValidade: true, tipoDocumento: 'passaporte' }
  );
  assert(datesOk.ok, 'passport upload without dates allowed');

  const samplePassport = `
REPUBLICA FEDERATIVA DO BRASIL
PASSAPORTE / PASSPORT
Passport No FG123456
Authority POLICIA FEDERAL
Date of issue 12/03/2022
Date of expiry 11/03/2032
`;
  const extracted = extrairDadosTexto(samplePassport, 'passaporte');
  assert(extracted.numero_passaporte === 'FG123456', `passport number, got ${extracted.numero_passaporte}`);
  assert(extracted.numero_documento === 'FG123456', 'numero_documento alias');
  assert(extracted.orgao_emissor && /POLICIA/i.test(extracted.orgao_emissor), 'orgao_emissor');
  assert(extracted.data_validade, 'data_validade from expiry');

  const num = extrairNumeroDocumentoDoTexto(samplePassport, 'passaporte');
  assert(num === 'FG123456' || (num && num.includes('123456')), `rastreio number ${num}`);

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
    deveExtrairEstruturaComLlm(samplePassport, 'passaporte', extracted) === false,
    'skip LLM when passport regex already filled'
  );
  assert(
    deveExtrairEstruturaComLlm('Atestado de Saúde Ocupacional CPF 123.456.789-09 exame periodico', 'aso') === true,
    'allow LLM for ASO with usable text'
  );

  console.log('OK: MIME, tipos, datas, extração de passaporte, skip vision mismatch, skip LLM vazio');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
