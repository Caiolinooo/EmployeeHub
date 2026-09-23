/**
 * Renderizador XLSX da fatura a partir do template do bucket
 * (financeiro-templates) via exceljs — preserva células mescladas/fórmulas
 * do Template_Invoice_Geral (§1.5/§2.1) e aplica o mapping gravado em
 * fin_fatura_templates.mapping:
 *   { celulas: {invoice_no, invoice_date, call_off, cliente},
 *     servicos: {linha_inicial, linha_final, colunas:{descricao, referencia, valor}},
 *     totais: {celula} }
 *
 * storagePath pode ser: caminho local (usado nos testes) ou caminho no bucket
 * privado (download server-side via supabaseAdmin).
 *
 * Implementa a assinatura do contrato §3.3 (invoice/types.ts).
 */
import fs from 'fs';
import ExcelJS from 'exceljs';
import { supabaseAdmin } from '@/lib/supabase';
import type { FaturaRenderInput, FaturaItemRender, FaturaTemplateDef } from './types';

const BUCKET_TEMPLATES = 'financeiro-templates';
const LINHAS_SERVICO_MAX = 12; // template 1_Invoice: linhas 18–29

async function carregarTemplateBuffer(storagePath: string): Promise<Buffer> {
  if (fs.existsSync(storagePath)) {
    return fs.readFileSync(storagePath);
  }
  const { data, error } = await supabaseAdmin.storage.from(BUCKET_TEMPLATES).download(storagePath);
  if (error || !data) {
    throw new Error(`Falha ao baixar template do bucket: ${error?.message || 'arquivo vazio'}`);
  }
  return Buffer.from(await data.arrayBuffer());
}

function colunaDaCelula(celula: string): string {
  const m = /^([A-Z]+)/.exec(celula.toUpperCase());
  return m ? m[1] : 'A';
}

function linhaDaCelula(celula: string): number {
  const m = /(\d+)$/.exec(celula);
  return m ? Number(m[1]) : 1;
}

/** Leitura segura de texto (exceljs lança em cell.text com merge master null). */
function textoSeguro(cell: ExcelJS.Cell): string {
  try {
    return cell.text || '';
  } catch {
    return '';
  }
}

/**
 * Template 1_Invoice embute rótulo e valor na MESMA célula ("Invoice No:
 * xx/2025"). Ao gravar um campo de metadados, preserva o rótulo existente
 * (texto até ':') e substitui só o valor. Célula vazia → valor cru.
 */
function valorComPrefixo(textoAtual: string, novoValor: unknown): ExcelJS.CellValue {
  const m = /^([A-Za-zÀ-Ý][A-Za-zÀ-ÿ' .]{0,40}):\s?(.*)$/.exec(textoAtual || '');
  if (m && typeof novoValor !== 'object') {
    return `${m[1]} ${String(novoValor)}`;
  }
  return (novoValor ?? null) as ExcelJS.CellValue;
}

/** Preenche o workbook do template com os dados da fatura e devolve o xlsx. */
export async function renderFaturaXlsx(
  input: FaturaRenderInput,
  template: { storagePath: string } & FaturaTemplateDef,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const templateBuf = await carregarTemplateBuffer(template.storagePath);
  // Typings do exceljs referenciam Buffer pré-@types/node genérico.
  await workbook.xlsx.load(templateBuf as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('Template sem aba de trabalho');

  const mapping = template.mapping || {};
  const celulas = mapping.celulas || {};

  // Valores disponíveis para o mapping campo→célula (campos livres; os quatro
  // nomeados no §2.1 + extras de emissor/cliente/fatura/conta).
  const valores: Record<string, ExcelJS.CellValue> = {
    invoice_no: `${String(input.fatura.numero).padStart(7, '0')}/${input.fatura.ano}`,
    invoice_date: input.fatura.dataEmissao || '',
    call_off: input.fatura.callOff || '',
    cliente: input.cliente.nome,
    cliente_documento: input.cliente.documento || '',
    cliente_endereco: input.cliente.endereco || '',
    emissor: input.emissor.razaoSocial,
    emissor_cnpj: input.emissor.cnpj,
    emissor_endereco: input.emissor.endereco || '',
    vencimento: input.fatura.dataVencimento || '',
    competencia: input.fatura.competencia || '',
    observacoes: input.fatura.observacoes || '',
    status: input.fatura.status,
    moeda: input.fatura.moeda,
    valor_total: input.fatura.valorTotal,
    conta_banco: input.contaBancaria?.bancoNome || '',
    conta_agencia: input.contaBancaria?.agencia || '',
    conta_numero: input.contaBancaria?.conta || '',
    conta_titular: input.contaBancaria?.titularNome || '',
    pix_chave: input.contaBancaria?.pixChave || '',
  };
  for (const [campo, celula] of Object.entries(celulas)) {
    const valor = valores[campo];
    if (valor === undefined || valor === '') continue;
    sheet.getCell(celula).value = valorComPrefixo(textoSeguro(sheet.getCell(celula)), valor);
  }

  // Tabela de serviços. Convenção: colunas.referencia === colunas.descricao
  // (template sem coluna própria) → descrição recebe "descricao — referencia".
  const servicos = mapping.servicos;
  if (servicos) {
    const colDesc = servicos.colunas.descricao.toUpperCase();
    const colRef = servicos.colunas.referencia.toUpperCase();
    const colValor = servicos.colunas.valor.toUpperCase();
    const mesmaColunaRef = colRef === colDesc;
    const totalLinhas = servicos.linhaFinal - servicos.linhaInicial + 1;
    const escreverLinha = (linha: number, item: FaturaItemRender): void => {
      sheet.getCell(`${colDesc}${linha}`).value = mesmaColunaRef && item.referencia
        ? `${item.descricao} — ${item.referencia}`
        : item.descricao;
      if (!mesmaColunaRef && item.referencia) {
        sheet.getCell(`${colRef}${linha}`).value = item.referencia;
      }
      if (item.valorTotal > 0) {
        sheet.getCell(`${colValor}${linha}`).value = item.valorTotal;
      }
    };
    for (let i = 0; i < totalLinhas && i < input.itens.length; i++) {
      escreverLinha(servicos.linhaInicial + i, input.itens[i]);
    }
    // Excedente de itens sem linha no template → anexa logo após a faixa
    for (let i = totalLinhas; i < input.itens.length && i < totalLinhas + LINHAS_SERVICO_MAX; i++) {
      escreverLinha(servicos.linhaFinal + (i - totalLinhas) + 1, input.itens[i]);
    }
  }

  // Total
  if (mapping.totais?.celula) {
    sheet.getCell(mapping.totais.celula).value = input.fatura.valorTotal;
  }

  // Corporate Account Details (escrita quando o mapping aponta células nomeadas)
  if (input.contaBancaria) {
    const contaCelulas = (mapping as { conta?: { banco?: string; agencia?: string; conta?: string; titular?: string; pix?: string } }).conta;
    if (contaCelulas) {
      if (contaCelulas.banco) sheet.getCell(contaCelulas.banco).value = valorComPrefixo(textoSeguro(sheet.getCell(contaCelulas.banco)), input.contaBancaria.bancoNome);
      if (contaCelulas.agencia) sheet.getCell(contaCelulas.agencia).value = valorComPrefixo(textoSeguro(sheet.getCell(contaCelulas.agencia)), input.contaBancaria.agencia);
      if (contaCelulas.conta) sheet.getCell(contaCelulas.conta).value = valorComPrefixo(textoSeguro(sheet.getCell(contaCelulas.conta)), input.contaBancaria.conta);
      if (contaCelulas.titular) sheet.getCell(contaCelulas.titular).value = valorComPrefixo(textoSeguro(sheet.getCell(contaCelulas.titular)), input.contaBancaria.titularNome);
      if (contaCelulas.pix && input.contaBancaria.pixChave) sheet.getCell(contaCelulas.pix).value = input.contaBancaria.pixChave;
    }
  }

  const saida = await workbook.xlsx.writeBuffer();
  return Buffer.from(saida);
}

export { colunaDaCelula, linhaDaCelula, LINHAS_SERVICO_MAX };
