#!/usr/bin/env node
/**
 * Gate dev-Front G4 (design financeiro §10): simetria i18n das chaves novas do
 * módulo Financeiro entre pt-BR e en-US.
 *
 * Compara:
 *  1. TODAS as chaves (folhas) do bloco top-level `financeiro: { ... }`;
 *  2. As chaves `admin.*` do §8 do design (lista FINANCEIRO_ADMIN_KEYS).
 *
 * Extração por texto (brace matching + indentação) — não importa nem executa
 * os arquivos de locale. Imprime FIN_I18N_OK quando simétrico; sai com código 1
 * listando as chaves faltantes de cada lado.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILES = {
  'pt-BR': join(ROOT, 'src', 'i18n', 'locales', 'pt-BR.ts'),
  'en-US': join(ROOT, 'src', 'i18n', 'locales', 'en-US.ts'),
};

/** Chaves `admin.*` do §8 (contrato do design — manter em sincronia com o doc). */
const FINANCEIRO_ADMIN_KEYS = [
  'financeiroConfig', 'tabBancos', 'tabNfse', 'tabTemplates', 'tabMunicipios',
  'novaIntegracao', 'ambiente', 'sandbox', 'producao', 'credenciais',
  'credencialPreenchida', 'credencialVazia', 'certificadoUpload',
  'certificadoValidade', 'testarConexao', 'conexaoOk', 'conexaoErro',
  'contasBancarias', 'municipioBusca', 'provider', 'inscricaoMunicipal',
  'aliquotaIss', 'templateDefault',
];

/** Localiza `chave: {` na indentação pedida e devolve o conteúdo até o `}` que fecha o bloco.
 * Ignora `{`/`}` dentro de literais de string ('...', "...", `...`) — traduções carregam
 * placeholders tipo '{name}'. */
function extractBlock(source, key, indent) {
  const openRe = new RegExp(`^ {${indent}}${key}: \\{\\s*$`, 'm');
  const open = openRe.exec(source);
  if (!open) return null;
  let depth = 0;
  for (let i = open.index; i < source.length; i++) {
    const c = source[i];
    if (c === "'" || c === '"' || c === '`') {
      const quote = c;
      i++;
      while (i < source.length && source[i] !== quote) {
        if (source[i] === '\\') i++;
        i++;
      }
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return source.slice(open.index, i + 1);
    }
  }
  return null;
}

/** Chaves folha (indentação exata, terminando em valor — bloco tratado é flat). */
function leafKeys(block, indent) {
  const re = new RegExp(`^ {${indent}}([A-Za-z0-9_]+):\\s*(?:'[^']*'|"[^"]*"|[0-9truefalsnull]+)\\s*,?\\s*$`, 'gm');
  return new Set([...block.matchAll(re)].map((m) => m[1]));
}

function keysFor(file) {
  const src = readFileSync(file, 'utf8');
  const finBlock = extractBlock(src, 'financeiro', 2);
  if (!finBlock) throw new Error(`bloco 'financeiro' não encontrado em ${file}`);
  const finKeys = leafKeys(finBlock, 4);
  if (finKeys.size === 0) throw new Error(`nenhuma chave folha no bloco 'financeiro' de ${file}`);
  const adminBlock = extractBlock(src, 'admin', 2);
  if (!adminBlock) throw new Error(`bloco 'admin' não encontrado em ${file}`);
  const adminKeys = new Set([...leafKeys(adminBlock, 4), ...leafKeys(adminBlock, 6)]);
  return {
    fin: finKeys,
    adminFin: new Set(FINANCEIRO_ADMIN_KEYS.filter((k) => adminKeys.has(k))),
  };
}

const locales = Object.fromEntries(Object.entries(FILES).map(([loc, file]) => [loc, keysFor(file)]));
const [pt, en] = [locales['pt-BR'], locales['en-US']];

const missing = [];
for (const k of pt.fin) if (!en.fin.has(k)) missing.push(`financeiro.${k} ausente em en-US`);
for (const k of en.fin) if (!pt.fin.has(k)) missing.push(`financeiro.${k} ausente em pt-BR`);
for (const k of FINANCEIRO_ADMIN_KEYS) {
  const inPt = pt.adminFin.has(k);
  const inEn = en.adminFin.has(k);
  if (!inPt || !inEn) missing.push(`admin.${k} ausente em ${[!inPt && 'pt-BR', !inEn && 'en-US'].filter(Boolean).join(' e ')}`);
}

if (missing.length > 0) {
  console.error('FIN_I18N_DIVERGENCIA:');
  for (const m of missing) console.error(`  - ${m}`);
  process.exit(1);
}
console.log(`FIN_I18N_OK (financeiro.*: ${pt.fin.size} chaves; admin.* do §8: ${FINANCEIRO_ADMIN_KEYS.length} chaves — pt-BR == en-US)`);
