/**
 * Renderizador PDF da fatura (pdfkit — já no repo) — mesmo layout do HTML
 * (§3.3): metadados no topo direito, cliente, tabela de serviços, totais e
 * seção "Corporate Account Details". 1 página A4 retrato.
 *
 * Implementa a assinatura do contrato §3.3 (invoice/types.ts).
 */
import PDFDocument from 'pdfkit';
import type { FaturaRenderInput } from './types';

const SIMBOLO_MOEDA: Record<string, string> = {
  BRL: 'R$',
  GBP: '£',
  USD: '$',
  EUR: '€',
};

function formatarValor(moeda: string, v: number): string {
  const simbolo = SIMBOLO_MOEDA[(moeda || '').toUpperCase()] || `${(moeda || '').toUpperCase()} `;
  return `${simbolo} ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const AZUL = '#0b3355';
const CINZA = '#555555';
const LINHA = '#d9dee3';

const A4 = { largura: 595.28, altura: 841.89, margem: 40 };

/** PDF A4 (buffer) com o layout da fatura. */
export async function renderFaturaPdf(input: FaturaRenderInput): Promise<Buffer> {
  const d = input;
  const moeda = (d.fatura.moeda || 'BRL').toUpperCase();

  const doc = new PDFDocument({ size: 'A4', margin: A4.margem, info: { Title: `Invoice ${d.fatura.numero}/${d.fatura.ano}` } });
  const chunks: Buffer[] = [];
  const pronto = new Promise<Buffer>((resolve) => {
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });

  doc.font('Helvetica');
  let y = A4.margem;

  // Cabeçalho: emissor à esquerda, metadados à direita
  doc.fillColor(AZUL).font('Helvetica-Bold').fontSize(16).text(d.emissor.razaoSocial, A4.margem, y, { width: 300 });
  y += 20;
  doc.fillColor(CINZA).font('Helvetica').fontSize(9);
  doc.text(`CNPJ: ${d.emissor.cnpj}`, A4.margem, y, { width: 300 });
  y += 12;
  if (d.emissor.endereco) {
    doc.text(d.emissor.endereco, A4.margem, y, { width: 300 });
    y += 12;
  }
  if (d.emissor.email || d.emissor.telefone) {
    doc.text([d.emissor.email, d.emissor.telefone].filter(Boolean).join(' · '), A4.margem, y, { width: 300 });
  }

  let yMeta = A4.margem;
  const xMeta = A4.largura - A4.margem - 190;
  const metaLinha = (k: string, v: string) => {
    doc.fillColor(CINZA).font('Helvetica').fontSize(8).text(k.toUpperCase(), xMeta, yMeta, { width: 80, align: 'left' });
    doc.fillColor('#1a1a1a').font('Helvetica-Bold').fontSize(9.5).text(v, xMeta + 84, yMeta - 1, { width: 106, align: 'right' });
    yMeta += 14;
  };
  metaLinha('Invoice No.', `${String(d.fatura.numero).padStart(7, '0')}/${d.fatura.ano}`);
  metaLinha('Invoice Date', d.fatura.dataEmissao || '—');
  if (d.fatura.callOff) metaLinha('Call Off', d.fatura.callOff);
  if (d.fatura.dataVencimento) metaLinha('Due Date', d.fatura.dataVencimento);
  if (d.fatura.competencia) metaLinha('Period', d.fatura.competencia);

  y = Math.max(y, yMeta) + 10;
  doc.moveTo(A4.margem, y).lineTo(A4.largura - A4.margem, y).lineWidth(2).strokeColor(AZUL).stroke();
  y += 8;
  doc.fillColor(AZUL).font('Helvetica-Bold').fontSize(13).text('I N V O I C E', A4.margem, y, { width: 200 });
  y += 22;

  // Cliente
  doc.fillColor(CINZA).font('Helvetica').fontSize(8).text('BILL TO', A4.margem, y);
  y += 11;
  doc.fillColor('#1a1a1a').font('Helvetica-Bold').fontSize(12).text(d.cliente.nome, A4.margem, y);
  y += 15;
  doc.font('Helvetica').fontSize(9).fillColor('#333333');
  if (d.cliente.documento) {
    doc.text(`Doc: ${d.cliente.documento}`, A4.margem, y);
    y += 12;
  }
  if (d.cliente.endereco) {
    doc.text(d.cliente.endereco, A4.margem, y, { width: 320 });
    y += 12;
  }
  y += 6;

  // Tabela de serviços
  const colX = { descricao: A4.margem, referencia: A4.margem + 230, qty: A4.margem + 340, unit: A4.margem + 390, total: A4.largura - A4.margem - 85 };
  const alturaCab = 18;
  doc.rect(A4.margem, y, A4.largura - 2 * A4.margem, alturaCab).fill(AZUL);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8.5);
  doc.text('DESCRIPTION', colX.descricao + 5, y + 5);
  doc.text('REFERENCE', colX.referencia, y + 5);
  doc.text('QTY', colX.qty, y + 5, { width: 40, align: 'right' });
  doc.text('UNIT PRICE', colX.unit, y + 5, { width: 70, align: 'right' });
  doc.text('AMOUNT', colX.total, y + 5, { width: 80, align: 'right' });
  y += alturaCab;

  doc.font('Helvetica').fontSize(9);
  for (let i = 0; i < d.itens.length; i++) {
    const it = d.itens[i];
    const alturaLinha = 16;
    if (i % 2 === 1) {
      doc.rect(A4.margem, y, A4.largura - 2 * A4.margem, alturaLinha).fill('#f4f6f8');
    }
    doc.fillColor('#1a1a1a');
    doc.text(it.descricao, colX.descricao + 5, y + 4, { width: 220, ellipsis: true });
    doc.fillColor('#444444').text(it.referencia || '', colX.referencia, y + 4, { width: 105, ellipsis: true });
    doc.fillColor('#1a1a1a');
    doc.text(it.quantidade.toLocaleString('pt-BR'), colX.qty, y + 4, { width: 40, align: 'right' });
    doc.text(formatarValor(moeda, it.valorUnitario), colX.unit, y + 4, { width: 70, align: 'right' });
    doc.text(formatarValor(moeda, it.valorTotal), colX.total, y + 4, { width: 80, align: 'right' });
    y += alturaLinha;
    doc.moveTo(A4.margem, y).lineTo(A4.largura - A4.margem, y).lineWidth(0.5).strokeColor(LINHA).stroke();
  }

  // Total
  y += 10;
  const xCaixa = A4.largura - A4.margem - 220;
  doc.rect(xCaixa, y, 220, 20).fill(AZUL);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(11);
  doc.text(`TOTAL ${moeda}`, xCaixa + 8, y + 5, { width: 100 });
  doc.text(formatarValor(moeda, d.fatura.valorTotal), xCaixa + 100, y + 5, { width: 112, align: 'right' });
  y += 32;

  if (d.fatura.observacoes) {
    doc.fillColor(CINZA).font('Helvetica-Bold').fontSize(8).text('OBSERVAÇÕES', A4.margem, y);
    y += 11;
    doc.fillColor('#333333').font('Helvetica').fontSize(9).text(d.fatura.observacoes, A4.margem, y, { width: 400 });
    y += doc.heightOfString(d.fatura.observacoes, { width: 400 }) + 10;
  }

  // Corporate Account Details
  if (d.contaBancaria) {
    const c = d.contaBancaria;
    const alturaCaixa = 84;
    doc.rect(A4.margem, y, 320, alturaCaixa).lineWidth(1).strokeColor(AZUL).stroke();
    y += 8;
    doc.fillColor(AZUL).font('Helvetica-Bold').fontSize(9).text('CORPORATE ACCOUNT DETAILS', A4.margem + 8, y);
    y += 14;
    doc.font('Helvetica').fontSize(9);
    const linhaConta = (k: string, v: string) => {
      doc.fillColor(CINZA).text(k.toUpperCase(), A4.margem + 8, y, { width: 100 });
      doc.fillColor('#1a1a1a').font('Helvetica-Bold').text(v, A4.margem + 112, y, { width: 190 });
      doc.font('Helvetica');
      y += 13;
    };
    linhaConta('Bank', c.bancoNome);
    linhaConta('Agency', c.agencia);
    linhaConta('Account', c.conta);
    linhaConta('Account Holder', c.titularNome);
    if (c.pixChave) linhaConta('Pix Key', c.pixChave);
    y = Math.max(y, A4.margem + alturaCaixa + 10);
  }

  // Rodapé
  const yRodape = A4.altura - A4.margem - 20;
  doc.moveTo(A4.margem, yRodape - 6).lineTo(A4.largura - A4.margem, yRodape - 6).lineWidth(0.5).strokeColor('#cccccc').stroke();
  doc.fillColor(CINZA).font('Helvetica').fontSize(8);
  doc.text(d.fatura.status === 'rascunho' ? `${d.emissor.razaoSocial} · DRAFT — NON-BILLING DOCUMENT` : `${d.emissor.razaoSocial} · Status: ${d.fatura.status}`, A4.margem, yRodape, { width: 350 });
  doc.text('Page 1/1', A4.largura - A4.margem - 60, yRodape, { width: 60, align: 'right' });

  doc.end();
  return pronto;
}
