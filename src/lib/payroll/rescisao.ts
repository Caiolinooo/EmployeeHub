/**
 * Motor de verbas rescisórias — CLT.
 * Retorna verbas (PayrollItem + valorCalculado) com natureza 'rescisao', prontas
 * para serem somadas aos itens mensais e passadas a calculateEmployeePayroll.
 *
 * Códigos conforme seed-payroll-data.sql / PAYROLL_CODE_RESCISAO (NÃO inventar):
 *   303 Saldo de Salário | 301 Aviso Prévio | 304 13º Proporcional
 *   305 Férias Proporcionais + 1/3 | 306 Férias Vencidas + 1/3
 *   302 Multa 40% FGTS | 307 Multa 20% FGTS (art. 484-A)
 *
 * Matriz por motivo:
 *   sem_justa_causa / rescisao_indireta: 303 + 301* + 304 + 305 + 306 + 302
 *   pedido_demissao / termino_contrato:  303 + 304 + 305 + 306
 *   acordo_mutuo (art. 484-A):           303 + 304 + 305 + 306 + 301* (metade) + 307
 *   justa_causa:                         303 + 306 (férias VENCIDAS sempre devidas — art. 530 CLT;
 *                                        perde apenas proporcionais, aviso e multa)
 *   (*) 301 somente quando avisoPrevio = 'indenizado'.
 *
 * Fração ≥ 15 dias conta como avo cheio (13º e férias proporcionais).
 * Valores arredondados a 2 casas. Aviso indenizado não é projetado no 13º/férias.
 */

import type { NaturezaFolha, PayrollItem } from './calculations';

/** Motivos de rescisão (união compatível com TipoRescisao de gestao-tripulantes). */
export type MotivoRescisao =
  | 'sem_justa_causa'
  | 'pedido_demissao'
  | 'justa_causa'
  | 'acordo_mutuo'
  | 'termino_contrato'
  | 'rescisao_indireta';

export type AvisoRescisao = 'indenizado' | 'trabalhado' | 'dispensado' | 'nao_aplicavel';

export interface EntradaRescisao {
  salarioMensal: number;
  admissao: Date | string;
  ultimoDia: Date | string;
  motivo: MotivoRescisao;
  /** Dias trabalhados no mês do desligamento (0–30). */
  diasTrabalhadosNoMes: number;
  /** Ciclos aquisitivos vencidos e não gozados (306); omitido/0 → sem 306. */
  feriasVencidasCiclos?: number;
  /**
   * Aceito para o chamador reutilizar o mesmo payload do funcionário; a tributação
   * (INSS/IRRF do grupo 'rescisao') ocorre em calculateEmployeePayroll via employee.dependents.
   */
  dependentes?: number;
  /** Default 'indenizado' (aviso pago influencia 301). */
  avisoPrevio?: AvisoRescisao;
}

/** Metadados das rubricas de rescisão (nomes/tipos = seed-payroll-data.sql). */
const RUBRICA_RESCISAO: Record<string, { name: string; type: PayrollItem['type'] }> = {
  '303': { name: 'Saldo de Salário', type: 'provento' },
  '304': { name: '13º Salário Proporcional', type: 'provento' },
  '305': { name: 'Férias Proporcionais + 1/3', type: 'provento' },
  '306': { name: 'Férias Vencidas + 1/3', type: 'provento' },
  '301': { name: 'Aviso Prévio', type: 'outros' },
  '302': { name: 'Multa 40% FGTS', type: 'outros' },
  '307': { name: 'Multa 20% FGTS', type: 'outros' }
};

export interface VerbaRescisao extends PayrollItem {
  /** Valor calculado da verba (2 casas). */
  valorCalculado: number;
}

function parseData(valor: Date | string): Date {
  if (valor instanceof Date) return valor;
  // 'YYYY-MM-DD' → Date local (evita deslocamento de fuso do ISO UTC)
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(valor);
}

/** Meses completos de contrato entre admissão e último dia. */
function mesesDeContrato(admissao: Date, ultimoDia: Date): number {
  let meses =
    (ultimoDia.getFullYear() - admissao.getFullYear()) * 12 +
    (ultimoDia.getMonth() - admissao.getMonth());
  if (ultimoDia.getDate() < admissao.getDate()) meses -= 1;
  return Math.max(0, meses);
}

/**
 * Avos do ano do desligamento (13º e férias proporcionais).
 * Cada mês com ≥ 15 dias conta como avo cheio. No mês da admissão,
 * conta quando a admissão ocorre até o dia 15.
 */
function avosDoAno(admissao: Date, ultimoDia: Date): number {
  let avos: number;
  if (admissao.getFullYear() < ultimoDia.getFullYear()) {
    avos = ultimoDia.getMonth() + (ultimoDia.getDate() >= 15 ? 1 : 0);
  } else {
    avos = ultimoDia.getMonth() - admissao.getMonth() + (ultimoDia.getDate() >= 15 ? 1 : 0);
    if (admissao.getDate() > 15) avos -= 1;
  }
  return Math.min(12, Math.max(0, avos));
}

/**
 * Calcula as verbas rescisórias. Verbas inexistentes para o motivo (ou sem
 * férias vencidas informado) são OMITIDAS — nunca devolvidas zeradas.
 * Ordem canônica: 303 → 304 → 305 → 306 → 301 → 302/307.
 */
export function calcularRescisao(entrada: EntradaRescisao): VerbaRescisao[] {
  const salario = Math.max(0, entrada.salarioMensal);
  const admissao = parseData(entrada.admissao);
  const ultimoDia = parseData(entrada.ultimoDia);
  const aviso: AvisoRescisao = entrada.avisoPrevio ?? 'indenizado';
  const avisoIndenizado = aviso === 'indenizado';
  const dias = Math.min(30, Math.max(0, Math.floor(entrada.diasTrabalhadosNoMes)));
  const ciclos = Math.max(0, Math.floor(entrada.feriasVencidasCiclos ?? 0));
  const motivo = entrada.motivo;

  const temDecimoFeriasProp = motivo !== 'justa_causa';
  const semJusta = motivo === 'sem_justa_causa' || motivo === 'rescisao_indireta';
  const acordo = motivo === 'acordo_mutuo';

  const meses = mesesDeContrato(admissao, ultimoDia);
  const avos = avosDoAno(admissao, ultimoDia);
  const baseDia = salario / 30;
  const baseAvo = salario / 12;
  const r2 = (v: number) => Math.round(v * 100) / 100;

  const saida: VerbaRescisao[] = [];
  const push = (code: string, calculationType: PayrollItem['calculationType'], value: number, quantity: number, referenceValue: number, valorCalculado: number) => {
    const meta = RUBRICA_RESCISAO[code];
    saida.push({
      codeId: code,
      code,
      type: meta?.type ?? 'provento',
      name: meta?.name ?? code,
      calculationType,
      value,
      quantity,
      referenceValue,
      natureza: 'rescisao',
      valorCalculado: r2(valorCalculado)
    });
  };

  // 303 — Saldo de Salário: sempre devido (salário/30 × dias trabalhados)
  if (dias > 0) {
    push('303', 'fixed', baseDia, dias, baseDia, baseDia * dias);
  }

  // 304 — 13º Proporcional: avos × salário/12
  if (temDecimoFeriasProp && avos > 0) {
    push('304', 'fixed', baseAvo, avos, baseAvo, avos * baseAvo);
  }

  // 305 — Férias Proporcionais + 1/3: avos × salário/12 × 4/3
  if (temDecimoFeriasProp && avos > 0) {
    push('305', 'fixed', baseAvo * (4 / 3), avos, baseAvo, avos * baseAvo * (4 / 3));
  }

  // 306 — Férias Vencidas + 1/3: ciclos × salário × 4/3 (devida inclusive na justa causa)
  if (ciclos >= 1 && salario > 0) {
    push('306', 'fixed', salario * (4 / 3), ciclos, salario, ciclos * salario * (4 / 3));
  }

  // 301 — Aviso Prévio Indenizado: integral na demissão pelo empregador; metade no acordo (art. 484-A)
  if (avisoIndenizado && (semJusta || acordo) && salario > 0) {
    const valorAviso = acordo ? salario / 2 : salario;
    push('301', 'fixed', valorAviso, 1, salario, valorAviso);
  }

  // 302 / 307 — Multa FGTS: salário × 8% (depósito) × meses de contrato × 40% (20% no acordo)
  if (semJusta && salario > 0) {
    push('302', 'percentage', 40, meses, salario * 0.08, salario * 0.08 * meses * 0.4);
  }
  if (acordo && salario > 0) {
    push('307', 'percentage', 20, meses, salario * 0.08, salario * 0.08 * meses * 0.2);
  }

  return saida;
}
