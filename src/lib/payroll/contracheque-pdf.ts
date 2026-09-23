/**
 * Renderizador PDF do contracheque (pdfkit — padrão
 * src/lib/financeiro/invoice/render-pdf.ts, ambient src/types/pdfkit.d.ts).
 * Render nativo a partir do MESMO ContrachequeDados do HTML
 * (src/lib/payroll/contracheque.ts) — não converte HTML. A4 retrato, 1+
 * páginas conforme o número de rubricas.
 */
import PDFDocument from 'pdfkit';
import { brl, type ContrachequeDados } from '@/lib/payroll/contracheque';

const AZUL = '#0b3355';
const CINZA = '#555555';
const LINHA = '#d9dee3';
const VERDE = '#1a7f37';
const VERMELHO = '#b42318';

const A4 = { largura: 595.28, altura: 841.89, margem: 40 };

/** PDF A4 (buffer) do contracheque — mesmas rubricas/totais/bases do HTML. */
export async function renderContrachequePdf(d: ContrachequeDados): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: A4.margem, info: { Title: `Contracheque ${d.competencia} — ${d.empregado.nome}` } });
  const chunks: Buffer[] = [];
  const pronto = new Promise<Buffer>((resolve) => {
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });

  doc.font('Helvetica');
  let y = A4.margem;

  // Cabeçalho: empregador à esquerda, competência à direita
  doc.fillColor(AZUL).font('Helvetica-Bold').fontSize(14).text(d.empresa.razaoSocial, A4.margem, y, { width: 340 });
  y += 18;
  doc.fillColor(CINZA).font('Helvetica').fontSize(9);
  if (d.empresa.cnpj) {
    doc.text(`CNPJ: ${d.empresa.cnpj}`, A4.margem, y, { width: 340 });
    y += 12;
  }

  const xMeta = A4.largura - A4.margem - 190;
  let yMeta = A4.margem;
  const metaLinha = (k: string, v: string) => {
    doc.fillColor(CINZA).font('Helvetica').fontSize(8).text(k.toUpperCase(), xMeta, yMeta, { width: 90, align: 'left' });
    doc.fillColor('#1a1a1a').font('Helvetica-Bold').fontSize(9.5).text(v, xMeta + 94, yMeta - 1, { width: 96, align: 'right' });
    yMeta += 14;
  };
  metaLinha('Competência', d.competencia);
  if (d.empregado.admissao) metaLinha('Admissão', d.empregado.admissao);

  y = Math.max(y, yMeta) + 8;
  doc.moveTo(A4.margem, y).lineTo(A4.largura - A4.margem, y).lineWidth(2).strokeColor(AZUL).stroke();
  y += 8;
  doc.fillColor(AZUL).font('Helvetica-Bold').fontSize(12).text('RECIBO DE PAGAMENTO DE SALÁRIO', A4.margem, y, { width: 400 });
  y += 20;

  // Empregado
  doc.fillColor(CINZA).font('Helvetica').fontSize(8).text('EMPREGADO', A4.margem, y);
  y += 11;
  doc.fillColor('#1a1a1a').font('Helvetica-Bold').fontSize(11).text(d.empregado.nome || '—', A4.margem, y);
  y += 14;
  doc.font('Helvetica').fontSize(9).fillColor('#333333');
  const linhaEmp: string[] = [];
  if (d.empregado.cpf) linhaEmp.push(`CPF: ${d.empregado.cpf}`);
  if (d.empregado.matricula) linhaEmp.push(`Matrícula: ${d.empregado.matricula}`);
  if (d.empregado.pis) linhaEmp.push(`PIS/PASEP: ${d.empregado.pis}`);
  if (linhaEmp.length) {
    doc.text(linhaEmp.join('   ·   '), A4.margem, y, { width: A4.largura - 2 * A4.margem });
    y += 12;
  }
  const linhaCargo = [d.empregado.cargo, d.empregado.departamento].filter(Boolean).join(' — ');
  if (linhaCargo) {
    doc.text(linhaCargo, A4.margem, y, { width: A4.largura - 2 * A4.margem });
    y += 12;
  }
  doc.text(`Salário base: R$ ${brl(d.empregado.salarioBase)}${d.empregado.salarioDetalhe ? ` (${d.empregado.salarioDetalhe})` : ''}`, A4.margem, y);
  y += 16;

  // Tabela de rubricas
  const larguraUtil = A4.largura - 2 * A4.margem;
  const colX = {
    codigo: A4.margem,
    descricao: A4.margem + 40,
    quantidade: A4.margem + 260,
    referencia: A4.margem + 310,
    provento: A4.largura - A4.margem - 170,
    desconto: A4.largura - A4.margem - 85,
  };
  const alturaCab = 18;
  doc.rect(A4.margem, y, larguraUtil, alturaCab).fill(AZUL);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8.5);
  doc.text('CÓD.', colX.codigo + 4, y + 5);
  doc.text('DESCRIÇÃO', colX.descricao, y + 5);
  doc.text('QTD.', colX.quantidade, y + 5, { width: 44, align: 'right' });
  doc.text('REF.', colX.referencia, y + 5, { width: 44, align: 'right' });
  doc.text('PROVENTO', colX.provento, y + 5, { width: 80, align: 'right' });
  doc.text('DESCONTO', colX.desconto, y + 5, { width: 80, align: 'right' });
  y += alturaCab;

  doc.font('Helvetica').fontSize(9);
  const alturaLinha = 15;
  const quebraPaginaSePreciso = () => {
    if (y + alturaLinha > A4.altura - A4.margem - 120) {
      doc.addPage();
      y = A4.margem;
    }
  };
  for (let i = 0; i < d.rubricas.length; i++) {
    quebraPaginaSePreciso();
    const r = d.rubricas[i];
    if (i % 2 === 1) {
      doc.rect(A4.margem, y, larguraUtil, alturaLinha).fill('#f4f6f8');
    }
    const ehProvento = r.natureza === 'provento';
    const ehDesconto = r.natureza === 'desconto';
    doc.fillColor('#444444').text(r.codigo, colX.codigo + 4, y + 3, { width: 34 });
    doc.fillColor('#1a1a1a').text(r.descricao, colX.descricao, y + 3, { width: 215, ellipsis: true });
    doc.fillColor('#444444');
    doc.text(r.quantidade != null ? String(r.quantidade) : '', colX.quantidade, y + 3, { width: 44, align: 'right' });
    doc.text(r.referencia != null ? brl(r.referencia) : '', colX.referencia, y + 3, { width: 44, align: 'right' });
    if (ehProvento || r.natureza === 'informativo') {
      doc.fillColor(ehProvento ? VERDE : CINZA);
      doc.text(brl(r.valor), colX.provento, y + 3, { width: 80, align: 'right' });
    }
    if (ehDesconto) {
      doc.fillColor(VERMELHO).text(brl(r.valor), colX.desconto, y + 3, { width: 80, align: 'right' });
    }
    y += alturaLinha;
    doc.moveTo(A4.margem, y).lineTo(A4.largura - A4.margem, y).lineWidth(0.5).strokeColor(LINHA).stroke();
  }

  // Totais
  y += 8;
  quebraPaginaSePreciso();
  const xCaixa = A4.largura - A4.margem - 240;
  doc.rect(xCaixa, y, 240, 20).fill(AZUL);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(10);
  doc.text(`Proventos: R$ ${brl(d.totais.proventos)}`, xCaixa + 8, y + 5, { width: 130 });
  doc.text(`Desc.: R$ ${brl(d.totais.descontos)}`, xCaixa + 140, y + 5, { width: 96, align: 'right' });
  y += 24;
  doc.rect(xCaixa, y, 240, 22).fill(VERDE);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(11);
  doc.text('LÍQUIDO A RECEBER', xCaixa + 8, y + 6, { width: 120 });
  doc.text(`R$ ${brl(d.totais.liquido)}`, xCaixa + 130, y + 6, { width: 104, align: 'right' });
  y += 34;

  // Bases de cálculo
  doc.fillColor(CINZA).font('Helvetica').fontSize(8);
  doc.text(
    `Base INSS: R$ ${brl(d.bases.inss)}   ·   Base IRRF: R$ ${brl(d.bases.irrf)}   ·   Base FGTS: R$ ${brl(d.bases.fgts)}   ·   INSS: R$ ${brl(d.valores.inss)}   ·   IRRF: R$ ${brl(d.valores.irrf)}   ·   FGTS: R$ ${brl(d.valores.fgts)}`,
    A4.margem,
    y,
    { width: larguraUtil },
  );
  y += 24;

  // Declaração + linha de assinatura
  doc.fillColor('#333333').font('Helvetica').fontSize(8.5);
  doc.text('Declaro ter recebido a importância líquida discriminada neste recibo.', A4.margem, y, { width: larguraUtil });
  y += 26;
  doc.moveTo(A4.margem + 120, y).lineTo(A4.largura - A4.margem - 120, y).lineWidth(0.8).strokeColor('#999999').stroke();
  y += 4;
  doc.fillColor(CINZA).fontSize(8).text('Assinatura do empregado', A4.margem + 120, y, { width: larguraUtil - 240, align: 'center' });

  // Rodapé
  const yRodape = A4.altura - A4.margem - 20;
  doc.moveTo(A4.margem, yRodape - 6).lineTo(A4.largura - A4.margem, yRodape - 6).lineWidth(0.5).strokeColor('#cccccc').stroke();
  doc.fillColor(CINZA).font('Helvetica').fontSize(8);
  doc.text(`${d.empresa.razaoSocial} · Contracheque ${d.competencia}`, A4.margem, yRodape, { width: 350 });

  doc.end();
  return pronto;
}
