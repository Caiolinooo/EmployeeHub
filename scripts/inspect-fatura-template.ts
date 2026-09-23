/**
 * Inspeciona o Template_Invoice_Geral.xlsx real do projeto 1_Invoice
 * (células de metadados, faixa da tabela de serviços, totais, merged ranges)
 * e imprime o mapping de células. Em seguida (padrão idempotente, --seed):
 *   1. sobe o arquivo para o bucket privado financeiro-templates;
 *   2. upsert do template default em fin_fatura_templates com o mapping.
 *
 * Uso:
 *   npx tsx scripts/inspect-fatura-template.ts            # só inspeciona/imprime
 *   npx tsx scripts/inspect-fatura-template.ts --seed     # inspeciona + seed no banco/bucket
 */
import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import { createClient } from '@supabase/supabase-js';

const CANDIDATOS_TEMPLATE = [
  'D:/Projeto/Finalizados/1_Invoice - ABZ - Conversão da Folha-Invoice-Financeiro/## V13.0.0/DADOS/Template_Invoice_Geral.xlsx',
  'D:/Projeto/Finalizados/1_Invoice - ABZ - Conversão da Folha-Invoice-Financeiro/V13.0.0/DADOS/Template_Invoice_Geral.xlsx',
];

interface MappingFatura {
  celulas: Record<string, string>;
  servicos: {
    linha_inicial: number;
    linha_final: number;
    colunas: { descricao: string; referencia: string; valor: string };
  };
  totais: { celula: string };
  conta: { secao: string };
}

function loadEnvFiles(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const f of ['.env.local', '.env', '.env.production']) {
    const p = path.join(process.cwd(), f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (m && !env[m[1]] && m[2].trim()) {
        env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
      }
    }
  }
  return env;
}

function acharTemplate(): string {
  for (const c of CANDIDATOS_TEMPLATE) {
    if (fs.existsSync(c)) return c;
  }
  console.error('INSPECT_FATURA_TEMPLATE_FAIL: Template_Invoice_Geral.xlsx não encontrado em:', CANDIDATOS_TEMPLATE);
  process.exit(1);
}

async function main() {
  const seed = process.argv.includes('--seed');
  const templatePath = acharTemplate();
  console.log(`Template: ${templatePath}`);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(templatePath);
  const sheet = workbook.worksheets[0];
  console.log(`Aba: "${sheet?.name}" (linhas=${sheet?.rowCount}, colunas=${sheet?.columnCount})`);

  // Leitura segura: exceljs lança em cell.text quando o master do merge tem
  // valor null; extraímos cell.value com fallbacks (fórmula/richText/data).
  const textoCelula = (cell: ExcelJS.Cell | undefined): string => {
    if (!cell) return '';
    try {
      if (cell.type === ExcelJS.ValueType.Merge) return '';
      const v = cell.value;
      if (v == null) return '';
      if (v instanceof Date) return v.toISOString().slice(0, 10);
      if (typeof v === 'string') return v;
      if (typeof v === 'object') {
        if ('richText' in v) {
          const rt = (v as { richText: { text: string }[] }).richText;
          return rt.map((t) => t.text).join('');
        }
        if ('result' in v) return String((v as { result: unknown }).result ?? '');
        if ('text' in v) return String((v as { text: unknown }).text ?? '');
      }
      return String(v);
    } catch {
      return '';
    }
  };

  // Localiza âncoras por texto (linhas visíveis)
  const textoEm = (linha: number, colA: number, colB: number): string => {
    let s = '';
    for (let c = colA; c <= colB; c++) {
      const v = textoCelula(sheet?.getRow(linha).getCell(c));
      if (v) s += (s ? ' ' : '') + v;
    }
    return s;
  };

  let invoiceNo = '';
  let invoiceDate = '';
  let callOff = '';
  let clienteRotulo = '';
  let clienteEndRotulo = '';
  let secaoConta = '';
  let linhaCabServicos = 0;
  let linhaTotal = 0;
  let colDescricao = '';
  let colReferencia = '';
  let colValor = '';
  let colUnit = '';

  const limite = Math.min(sheet?.rowCount || 60, 80);
  const colLetra = (n: number): string => {
    let s = '';
    while (n > 0) {
      const m = (n - 1) % 26;
      s = String.fromCharCode(65 + m) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  };
  for (let r = 1; r <= limite; r++) {
    for (let c = 1; c <= Math.min(sheet?.columnCount || 10, 12); c++) {
      const cell = sheet?.getRow(r).getCell(c);
      const texto = textoCelula(cell).trim().toLowerCase();
      if (!texto) continue;
      if (!invoiceNo && texto.startsWith('invoice no')) invoiceNo = cell!.address;
      if (!invoiceDate && texto.startsWith('invoice date')) invoiceDate = cell!.address;
      if (!callOff && texto.startsWith('call')) callOff = cell!.address;
      if (!clienteRotulo && texto.startsWith('client:')) clienteRotulo = cell!.address;
      if (!clienteEndRotulo && texto.startsWith('client address')) clienteEndRotulo = cell!.address;
      if (!secaoConta && texto.includes('corporate account')) secaoConta = cell!.address;
    }
  }
  // Cabeçalho da tabela de serviços: linha com Services/Price/Quantity/Amount
  for (let r = 10; r <= 28; r++) {
    const t = textoEm(r, 1, 12).toLowerCase();
    if (t.includes('services') || (t.includes('price') && t.includes('quantity'))) {
      linhaCabServicos = r;
      break;
    }
  }
  // Colunas do cabeçalho de serviços
  if (linhaCabServicos) {
    for (let c = 1; c <= 12; c++) {
      const t = textoCelula(sheet?.getRow(linhaCabServicos).getCell(c)).trim().toLowerCase();
      if (!colDescricao && (t.includes('service') || t === 'description')) colDescricao = colLetra(c);
      if (!colValor && (t.includes('final price') || t === 'amount' || t === 'total')) colValor = colLetra(c);
      if (!colValor && t.includes('unit price')) colUnit = colLetra(c);
      if (!colReferencia && (t.includes('ref') || t.includes('colab'))) colReferencia = colLetra(c);
    }
  }
  // Linha de total: célula com 'total' nas colunas A-J
  for (let r = Math.max(linhaCabServicos, 17) + 1; r <= 45; r++) {
    const t = textoEm(r, 1, 12).toLowerCase();
    if (t.startsWith('total')) {
      linhaTotal = r;
      break;
    }
  }

  const mergedServicos = (sheet?.model?.merges || []) as string[];
  // Template sem coluna de referência → convenção do renderer: referencia
  // cai na MESMA coluna da descrição (renderiza "descricao — referencia").
  const colDescricaoFinal = colDescricao || 'A';
  const colReferenciaFinal = colReferencia || colDescricaoFinal;
  const colValorFinal = colValor || colUnit || 'D';
  const linhaInicial = linhaCabServicos ? linhaCabServicos + 1 : 18;
  const linhaFinal = linhaTotal ? Math.max(linhaInicial, linhaTotal - 1) : 29;
  const celulaTotal = `${colValorFinal}${linhaTotal || 31}`;

  const mapping: MappingFatura = {
    celulas: {
      ...(invoiceNo ? { invoice_no: invoiceNo } : {}),
      ...(invoiceDate ? { invoice_date: invoiceDate } : {}),
      ...(callOff ? { call_off: callOff } : {}),
      ...(clienteRotulo ? { cliente: clienteRotulo } : {}),
      ...(clienteEndRotulo ? { cliente_endereco: clienteEndRotulo } : {}),
    },
    servicos: {
      linha_inicial: linhaInicial,
      linha_final: linhaFinal,
      colunas: { descricao: colDescricaoFinal, referencia: colReferenciaFinal, valor: colValorFinal },
    },
    totais: { celula: celulaTotal },
    conta: { secao: secaoConta || 'Corporate Account Details' },
  };

  console.log('\n=== ÂNCORAS DETECTADAS ===');
  console.log(`invoice_no: ${invoiceNo || '(não encontrado — usar H4 do design)'}`);
  console.log(`invoice_date: ${invoiceDate || '(não encontrado — usar H5)'}`);
  console.log(`call_off: ${callOff || '(não encontrado — usar H6)'}`);
  console.log(`cliente (rótulo): ${clienteRotulo || '(não encontrado)'}`);
  console.log(`cliente_endereco (rótulo): ${clienteEndRotulo || '(não encontrado)'}`);
  console.log(`seção conta: ${secaoConta || 'Corporate Account Details'}`);
  console.log(`cabeçalho serviços na linha: ${linhaCabServicos || '(padrão 17)'}`);
  console.log(`colunas serviços: descricao=${colDescricaoFinal} referencia=${colReferenciaFinal} valor=${colValorFinal}`);
  console.log(`linhas de serviço: ${linhaInicial}–${linhaFinal} (merged groups: ${mergedServicos.length})`);
  console.log(`total: ${celulaTotal}`);
  console.log('\n=== MAPPING (fin_fatura_templates.mapping) ===');
  console.log(JSON.stringify(mapping, null, 2));

  // Conteúdo amostrado das células de metadados para conferência visual
  console.log('\n=== CONTEÚDO (amostra linhas 1–35, colunas A–J) ===');
  for (let r = 1; r <= Math.min(limite, 35); r++) {
    const partes: string[] = [];
    for (let c = 1; c <= 10; c++) {
      const v = textoCelula(sheet?.getRow(r).getCell(c)).trim();
      if (v) partes.push(`${colLetra(c)}${r}="${v.replace(/\n/g, ' ').slice(0, 40)}"`);
    }
    if (partes.length) console.log(partes.join(' | '));
  }

  if (!seed) {
    console.log('\nINSPECT_FATURA_TEMPLATE_OK (sem --seed: banco/bucket não tocados)');
    return;
  }

  // ---- seed: bucket privado + upsert idempotente por nome ----
  const env = loadEnvFiles();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    console.error('INSPECT_FATURA_TEMPLATE_FAIL: Supabase env ausente para --seed');
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const storagePath = 'templates/default/Template_Invoice_Geral.xlsx';
  const { error: upErr } = await supabase.storage
    .from('financeiro-templates')
    .upload(storagePath, fs.readFileSync(templatePath), { upsert: true });
  if (upErr) {
    console.error('INSPECT_FATURA_TEMPLATE_FAIL: upload bucket:', upErr.message);
    process.exit(1);
  }
  console.log(`\nBucket: template enviado para financeiro-templates/${storagePath}`);

  const { data: existente } = await supabase
    .from('fin_fatura_templates')
    .select('id')
    .eq('nome', 'Template_Invoice_Geral')
    .maybeSingle();

  if (existente) {
    const { error } = await supabase
      .from('fin_fatura_templates')
      .update({
        tipo: 'xlsx',
        storage_path: storagePath,
        mapping,
        is_default: true,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', (existente as { id: string }).id);
    if (error) {
      console.error('INSPECT_FATURA_TEMPLATE_FAIL: update template:', error.message);
      process.exit(1);
    }
  } else {
    const { error } = await supabase.from('fin_fatura_templates').insert({
      nome: 'Template_Invoice_Geral',
      tipo: 'xlsx',
      storage_path: storagePath,
      mapping,
      is_default: true,
      is_active: true,
    });
    if (error) {
      console.error('INSPECT_FATURA_TEMPLATE_FAIL: insert template:', error.message);
      process.exit(1);
    }
  }
  console.log('fin_fatura_templates: template default gravado (upsert por nome, idempotente)');
  console.log('INSPECT_FATURA_TEMPLATE_OK');
}


main().catch((e) => {
  console.error('INSPECT_FATURA_TEMPLATE_FAIL:', e);
  process.exit(1);
});
