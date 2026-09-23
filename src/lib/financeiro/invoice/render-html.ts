/**
 * Renderizador PURO da fatura em HTML A4 imprimível — sem Supabase/Next,
 * testável com tsx --test (padrão src/lib/payroll/contracheque.ts).
 *
 * Layout do 1_Invoice (Template_Invoice_Geral.xlsx, §1.5): metadados no topo
 * direito (nº da fatura, data, call-off), bloco do cliente, tabela de serviços
 * (descrição/referência/valor — template linhas 18–29, células mescladas em
 * grupos de 3), totais e seção "Corporate Account Details". Fonte Calibri,
 * 1 página A4.
 *
 * Implementa a assinatura do contrato §3.3 (invoice/types.ts).
 */
import type { FaturaRenderInput, FaturaItemRender } from './types';

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

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function linhaServico(item: FaturaItemRender, moeda: string, zebra: boolean): string {
  return `<tr${zebra ? ' class="alt"' : ''}>
    <td class="desc">${esc(item.descricao)}</td>
    <td class="ref">${esc(item.referencia || '')}</td>
    <td class="num">${item.quantidade.toLocaleString('pt-BR')}</td>
    <td class="num">${formatarValor(moeda, item.valorUnitario)}</td>
    <td class="num">${formatarValor(moeda, item.valorTotal)}</td>
  </tr>`;
}

function metadados(d: FaturaRenderInput): string {
  const linhas: [string, string][] = [
    ['Invoice No.', `${String(d.fatura.numero).padStart(7, '0')}/${d.fatura.ano}`],
    ['Invoice Date', esc(d.fatura.dataEmissao || '—')],
  ];
  if (d.fatura.callOff) linhas.push(['Call Off', esc(d.fatura.callOff)]);
  if (d.fatura.dataVencimento) linhas.push(['Due Date', esc(d.fatura.dataVencimento)]);
  if (d.fatura.competencia) linhas.push(['Period', esc(d.fatura.competencia)]);
  return linhas
    .map(([k, v]) => `<div class="meta-linha"><span class="meta-k">${k}</span><span class="meta-v">${v}</span></div>`)
    .join('\n        ');
}

function contaBancariaHtml(d: FaturaRenderInput): string {
  if (!d.contaBancaria) return '';
  const c = d.contaBancaria;
  const campos: [string, string][] = [
    ['Bank', esc(c.bancoNome)],
    ['Agency', esc(c.agencia)],
    ['Account', esc(c.conta)],
    ['Account Holder', esc(c.titularNome)],
  ];
  if (c.pixChave) campos.push(['Pix Key', esc(c.pixChave)]);
  return `
  <div class="conta">
    <div class="conta-titulo">CORPORATE ACCOUNT DETAILS</div>
    <table class="conta-dados">
      ${campos.map(([k, v]) => `<tr><td class="conta-k">${k}</td><td class="conta-v">${v}</td></tr>`).join('\n      ')}
    </table>
  </div>`;
}

/** HTML completo da fatura, pronto para impressão/PDF (A4 retrato, 1 página). */
export function renderFaturaHtml(input: FaturaRenderInput): string {
  const d = input;
  const moeda = (d.fatura.moeda || 'BRL').toUpperCase();
  const itens = d.itens;
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Invoice ${String(d.fatura.numero).padStart(7, '0')}/${d.fatura.ano} — ${esc(d.cliente.nome)}</title>
<style>
  * { box-sizing: border-box; margin: 0; }
  body { font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #1a1a1a; background: #fff; padding: 12mm; }
  .fatura { max-width: 186mm; margin: 0 auto; }
  table { width: 100%; border-collapse: collapse; }
  .topo { display: flex; justify-content: space-between; align-items: flex-start; }
  .emissor .razao { font-size: 16px; font-weight: bold; color: #0b3355; }
  .emissor .dado { font-size: 10px; color: #444; }
  .metadados { text-align: right; }
  .meta-linha { margin-bottom: 2px; }
  .meta-k { display: inline-block; width: 90px; color: #555; font-size: 10px; text-transform: uppercase; letter-spacing: 0.4px; }
  .meta-v { font-weight: bold; font-size: 11px; }
  .titulo { margin: 6px 0 10px; font-size: 13px; font-weight: bold; letter-spacing: 2px; color: #0b3355; border-bottom: 2px solid #0b3355; padding-bottom: 3px; }
  .partes { display: flex; justify-content: space-between; margin-bottom: 10px; }
  .parte .rotulo { font-size: 9px; text-transform: uppercase; color: #666; letter-spacing: 1px; margin-bottom: 2px; }
  .parte .nome { font-weight: bold; font-size: 12px; }
  .parte .dado { font-size: 10px; color: #333; }
  .servicos th { background: #0b3355; color: #fff; padding: 4px 6px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
  .servicos td { border-bottom: 1px solid #d9dee3; padding: 3px 6px; }
  .servicos tr.alt td { background: #f4f6f8; }
  .servicos .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .servicos .ref { color: #444; }
  .totais { margin-top: 6px; display: flex; justify-content: flex-end; }
  .totais .caixa { min-width: 60mm; }
  .totais .linha { display: flex; justify-content: space-between; padding: 2px 6px; }
  .totais .linha.total { background: #0b3355; color: #fff; font-weight: bold; font-size: 12px; border-radius: 2px; }
  .observacoes { margin-top: 8px; font-size: 10px; color: #333; max-width: 120mm; }
  .observacoes .rotulo { font-weight: bold; text-transform: uppercase; font-size: 9px; color: #666; }
  .conta { margin-top: 12px; border: 1px solid #0b3355; border-radius: 3px; padding: 6px 8px; max-width: 120mm; }
  .conta-titulo { font-weight: bold; font-size: 10px; letter-spacing: 1.5px; color: #0b3355; margin-bottom: 4px; }
  .conta-dados .conta-k { width: 40mm; color: #555; font-size: 10px; text-transform: uppercase; letter-spacing: 0.4px; }
  .conta-dados .conta-v { font-weight: bold; font-size: 11px; }
  .rodape { margin-top: 12px; border-top: 1px solid #ccc; padding-top: 4px; font-size: 9px; color: #666; display: flex; justify-content: space-between; }
  @media print { body { padding: 0; } .fatura { max-width: none; } @page { size: A4 portrait; margin: 12mm; } }
</style>
</head>
<body>
<div class="fatura">
  <div class="topo">
    <div class="emissor">
      <div class="razao">${esc(d.emissor.razaoSocial)}</div>
      <div class="dado">CNPJ: ${esc(d.emissor.cnpj)}</div>
      ${d.emissor.endereco ? `<div class="dado">${esc(d.emissor.endereco)}</div>` : ''}
      ${d.emissor.email || d.emissor.telefone ? `<div class="dado">${esc([d.emissor.email, d.emissor.telefone].filter(Boolean).join(' · '))}</div>` : ''}
    </div>
    <div class="metadados">
        ${metadados(d)}
    </div>
  </div>

  <div class="titulo">INVOICE</div>

  <div class="partes">
    <div class="parte">
      <div class="rotulo">Bill To</div>
      <div class="nome">${esc(d.cliente.nome)}</div>
      ${d.cliente.documento ? `<div class="dado">Doc: ${esc(d.cliente.documento)}</div>` : ''}
      ${d.cliente.endereco ? `<div class="dado">${esc(d.cliente.endereco)}</div>` : ''}
    </div>
  </div>

  <table class="servicos">
    <thead>
      <tr>
        <th>Description</th><th>Reference</th><th class="num">Qty</th>
        <th class="num">Unit Price</th><th class="num">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${itens.map((it, i) => linhaServico(it, moeda, i % 2 === 1)).join('\n      ')}
    </tbody>
  </table>

  <div class="totais">
    <div class="caixa">
      <div class="linha total"><span>TOTAL ${esc(moeda)}</span><span>${formatarValor(moeda, d.fatura.valorTotal)}</span></div>
    </div>
  </div>

  ${d.fatura.observacoes ? `<div class="observacoes"><span class="rotulo">Observações</span><br>${esc(d.fatura.observacoes)}</div>` : ''}

  ${contaBancariaHtml(d)}

  <div class="rodape">
    <span>${esc(d.emissor.razaoSocial)} · ${esc(d.fatura.status === 'rascunho' ? 'DRAFT — NON-BILLING DOCUMENT' : `Status: ${d.fatura.status}`)}</span>
    <span>Page 1/1</span>
  </div>
</div>
</body>
</html>`;
}
