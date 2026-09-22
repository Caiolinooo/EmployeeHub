/**
 * Renderizador PURO do contracheque (holerite) em HTML — sem Supabase/Next,
 * testável com tsx --test. A rota /api/dp/folha/contracheque monta os dados.
 *
 * Layout segue o modelo CLT brasileiro: cabeçalho empregador, dados do
 * empregado, rubricas proventos/descontos/informativos com referência e
 * valor, totais, bases de cálculo e rodapé legal.
 */

export interface ContrachequeEmpresa {
  razaoSocial: string;
  cnpj: string;
}

export interface ContrachequeEmpregado {
  nome: string;
  cpf: string;
  matricula: string;
  cargo: string;
  departamento: string;
  admissao: string;
  pis: string;
  salarioBase: number;
  /** 'R$ 9.000,00 USD/mes bruto' etc. quando diferente do padrão. */
  salarioDetalhe?: string;
}

export interface ContrachequeRubrica {
  codigo: string;
  descricao: string;
  quantidade: number | null;
  referencia: number | null;
  valor: number;
  /** natureza da rubrica: provento soma, desconto tira, informativo só exibe. */
  natureza: 'provento' | 'desconto' | 'informativo';
}

export interface ContrachequeDados {
  competencia: string; // 'set/2026'
  empresa: ContrachequeEmpresa;
  empregado: ContrachequeEmpregado;
  rubricas: ContrachequeRubrica[];
  totais: { proventos: number; descontos: number; liquido: number };
  bases: { inss: number; irrf: number; fgts: number };
  valores: { inss: number; irrf: number; fgts: number };
}

export const round2 = (v: number): number => Math.round(v * 100) / 100;

/** '1234.5' → '1.234,50'; null → ''. */
export function brl(v: number | null | undefined): string {
  if (v == null) return '';
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function linhaRubrica(r: ContrachequeRubrica): string {
  return `<tr>
    <td class="cod">${esc(r.codigo)}</td>
    <td class="desc">${esc(r.descricao)}</td>
    <td class="num">${r.quantidade != null ? brl(r.quantidade) : ''}</td>
    <td class="num">${r.referencia != null ? brl(r.referencia) : ''}</td>
    <td class="num">${r.natureza === 'provento' ? brl(r.valor) : ''}</td>
    <td class="num">${r.natureza === 'desconto' ? brl(r.valor) : ''}</td>
    <td class="num">${r.natureza === 'informativo' ? brl(r.valor) : ''}</td>
  </tr>`;
}

/** HTML completo do contracheque, pronto para impressão (A4 retrato). */
export function renderContracheque(d: ContrachequeDados): string {
  const rubricas = [...d.rubricas].sort((a, b) => a.codigo.localeCompare(b.codigo, 'pt-BR'));
  const salarioDetalhe = d.empregado.salarioDetalhe || `R$ ${brl(d.empregado.salarioBase)}`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Contracheque ${esc(d.competencia)} — ${esc(d.empregado.nome)}</title>
<style>
  * { box-sizing: border-box; margin: 0; }
  body { font-family: 'Courier New', monospace; font-size: 11px; color: #000; background: #fff; padding: 12mm; }
  .cheque { border: 2px solid #000; padding: 6mm; max-width: 190mm; margin: 0 auto; }
  table { width: 100%; border-collapse: collapse; }
  .topo td { vertical-align: middle; }
  .empresa { font-size: 13px; font-weight: bold; }
  .doc { font-size: 10px; color: #333; }
  .titulo { text-align: center; font-size: 12px; font-weight: bold; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 3px 0; margin-top: 6px; }
  .dados td { padding: 2px 6px 2px 0; }
  .dados .rotulo { color: #555; }
  .dados .valor { font-weight: bold; }
  .rubricas { margin-top: 6px; }
  .rubricas th { border: 1px solid #000; background: #eee; padding: 2px 4px; text-align: left; }
  .rubricas td { border-left: 1px solid #ccc; border-right: 1px solid #ccc; padding: 1px 4px; }
  .rubricas .num { text-align: right; font-variant-numeric: tabular-nums; }
  .totais { border-top: 2px solid #000; }
  .totais td { border-left: 1px solid #ccc; border-right: 1px solid #ccc; padding: 2px 4px; font-weight: bold; }
  .liquido { border: 2px solid #000; margin-top: 8px; padding: 5px 8px; font-size: 13px; font-weight: bold; display: flex; justify-content: space-between; }
  .bases { margin-top: 8px; font-size: 10px; }
  .bases td { padding: 2px 8px 2px 0; }
  .bases .rotulo { color: #555; }
  .rodape { margin-top: 10px; border-top: 1px solid #000; padding-top: 4px; font-size: 9px; color: #444; display: flex; justify-content: space-between; }
  @media print { body { padding: 0; } .cheque { border: none; } }
</style>
</head>
<body>
<div class="cheque">
  <table class="topo">
    <tr>
      <td>
        <div class="empresa">${esc(d.empresa.razaoSocial)}</div>
        <div class="doc">CNPJ: ${esc(d.empresa.cnpj)}</div>
      </td>
      <td style="text-align:right">
        <div class="doc">Competência: <b>${esc(d.competencia)}</b></div>
      </td>
    </tr>
  </table>

  <div class="titulo">RECIBO DE PAGAMENTO DE SALÁRIO</div>

  <table class="dados">
    <tr>
      <td class="rotulo">Empregado:</td><td class="valor">${esc(d.empregado.nome)}</td>
      <td class="rotulo">Matrícula:</td><td class="valor">${esc(d.empregado.matricula)}</td>
    </tr>
    <tr>
      <td class="rotulo">CPF:</td><td class="valor">${esc(d.empregado.cpf)}</td>
      <td class="rotulo">PIS/PASEP:</td><td class="valor">${esc(d.empregado.pis)}</td>
    </tr>
    <tr>
      <td class="rotulo">Cargo:</td><td class="valor">${esc(d.empregado.cargo)}</td>
      <td class="rotulo">Departamento:</td><td class="valor">${esc(d.empregado.departamento)}</td>
    </tr>
    <tr>
      <td class="rotulo">Admissão:</td><td class="valor">${esc(d.empregado.admissao)}</td>
      <td class="rotulo">Salário:</td><td class="valor">${esc(salarioDetalhe)}</td>
    </tr>
  </table>

  <table class="rubricas">
    <thead>
      <tr>
        <th class="cod">Cód</th><th>Descrição</th><th class="num">Qtde</th>
        <th class="num">Referência</th><th class="num">Proventos</th>
        <th class="num">Descontos</th><th class="num">Informativo</th>
      </tr>
    </thead>
    <tbody>
      ${rubricas.map(linhaRubrica).join('\n      ')}
      <tr class="totais">
        <td colspan="4">TOTAIS</td>
        <td class="num">${brl(d.totais.proventos)}</td>
        <td class="num">${brl(d.totais.descontos)}</td>
        <td class="num"></td>
      </tr>
    </tbody>
  </table>

  <div class="liquido"><span>VALOR LÍQUIDO →</span><span>R$ ${brl(d.totais.liquido)}</span></div>

  <table class="bases">
    <tr>
      <td class="rotulo">Salário Base:</td><td>R$ ${brl(d.empregado.salarioBase)}</td>
      <td class="rotulo">Base INSS:</td><td>R$ ${brl(d.bases.inss)}</td>
      <td class="rotulo">INSS (desconto):</td><td>R$ ${brl(d.valores.inss)}</td>
    </tr>
    <tr>
      <td class="rotulo">Base IRRF:</td><td>R$ ${brl(d.bases.irrf)}</td>
      <td class="rotulo">IRRF (desconto):</td><td>R$ ${brl(d.valores.irrf)}</td>
      <td class="rotulo">FGTS do mês (8%):</td><td>R$ ${brl(d.valores.fgts)}</td>
    </tr>
  </table>

  <div class="rodape">
    <span>Declaro ter recebido a importância líquida discriminada neste recibo.</span>
    <span>____/____/______ &nbsp; Assinatura do empregado: ______________________________</span>
  </div>
</div>
</body>
</html>`;
}
