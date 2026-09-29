/** Códigos COMPE usados no cadastro. A lista é selecionável; o dígito da conta fica à parte. */

export interface BancoBr {
  codigo: string;
  nome: string;
}

export const BANCOS_BR: BancoBr[] = [
  { codigo: '001', nome: 'Banco do Brasil' },
  { codigo: '003', nome: 'Banco da Amazônia' },
  { codigo: '004', nome: 'Banco do Nordeste' },
  { codigo: '021', nome: 'Banestes' },
  { codigo: '033', nome: 'Santander' },
  { codigo: '037', nome: 'Banpará' },
  { codigo: '041', nome: 'Banrisul' },
  { codigo: '047', nome: 'Banese' },
  { codigo: '070', nome: 'BRB' },
  { codigo: '077', nome: 'Banco Inter' },
  { codigo: '084', nome: 'Uniprime' },
  { codigo: '085', nome: 'Ailos (Cecred)' },
  { codigo: '104', nome: 'Caixa Econômica Federal' },
  { codigo: '136', nome: 'Unicred' },
  { codigo: '197', nome: 'Stone' },
  { codigo: '208', nome: 'BTG Pactual' },
  { codigo: '212', nome: 'Banco Original' },
  { codigo: '237', nome: 'Bradesco' },
  { codigo: '260', nome: 'Nubank' },
  { codigo: '290', nome: 'PagBank' },
  { codigo: '318', nome: 'BMG' },
  { codigo: '323', nome: 'Mercado Pago' },
  { codigo: '336', nome: 'C6 Bank' },
  { codigo: '341', nome: 'Itaú' },
  { codigo: '380', nome: 'PicPay' },
  { codigo: '389', nome: 'Mercantil do Brasil' },
  { codigo: '399', nome: 'HSBC' },
  { codigo: '422', nome: 'Safra' },
  { codigo: '633', nome: 'Rendimento' },
  { codigo: '652', nome: 'Itaú Unibanco Holding' },
  { codigo: '655', nome: 'Votorantim' },
  { codigo: '707', nome: 'Daycoval' },
  { codigo: '745', nome: 'Citibank' },
  { codigo: '748', nome: 'Sicredi' },
  { codigo: '756', nome: 'Sicoob' },
];

export function labelBanco(codigo: string | null | undefined, nome?: string | null): string {
  const c = String(codigo || '').replace(/\D/g, '').padStart(3, '0');
  if (!codigo) return nome || '';
  const catalogo = BANCOS_BR.find((b) => b.codigo === c);
  const n = (nome || catalogo?.nome || '').trim();
  return n ? `${c} - ${n}` : c;
}

/** Conta + dígito verificador. Sem dígito, devolve só a conta. */
export function contaComDigito(conta: string | null | undefined, digito: string | null | undefined): string {
  const c = String(conta || '').trim();
  const d = String(digito || '').trim();
  if (!c) return '';
  if (!d) return c;
  return `${c}-${d}`;
}
