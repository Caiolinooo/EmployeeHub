/**
 * Agregações puras dos relatórios da folha (custos por departamento/centro
 * de custo e guias de recolhimento). Sem banco/HTTP: a entrada são as linhas
 * do relatório operacional (`LinhaRelatorioColaborador` ou subconjunto com
 * os mesmos campos numéricos). Testável com node --test sem mocks.
 */

/** Subconjunto de LinhaRelatorioColaborador usado pelas agregações. */
export interface LinhaCusto {
  centroCusto: string;
  bruto: number;
  descontos: number;
  liquido: number;
  inss: number;
  irrf: number;
  fgts: number;
}

export interface CustoDepartamento {
  departamento: string;
  colaboradores: number;
  bruto: number;
  descontos: number;
  liquido: number;
  inss: number;
  irrf: number;
  fgts: number;
  /** Custo total da empresa: bruto + provisão patronal de FGTS. */
  custoTotal: number;
}

export type TributoGuia = 'INSS' | 'IRRF' | 'FGTS';

export interface GuiaRecolhimento {
  tributo: TributoGuia;
  descricao: string;
  valor: number;
}

export interface ResumoGuias {
  guias: GuiaRecolhimento[];
  /** Soma das provisões (INSS + IRRF + FGTS). */
  total: number;
  contribuintes: number;
  folhaBruta: number;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/** Rótulo de linha sem centro de custo/departamento informado. */
export const SEM_DEPARTAMENTO = '—';

/**
 * Agrupa as linhas por centro de custo/departamento. Ordenado por
 * custoTotal desc. Linhas sem centro de custo caem em SEM_DEPARTAMENTO.
 */
export function agregarCustosPorDepartamento(linhas: LinhaCusto[]): CustoDepartamento[] {
  const mapa = new Map<string, CustoDepartamento>();
  for (const linha of linhas) {
    const chave = linha.centroCusto?.trim() || SEM_DEPARTAMENTO;
    let dep = mapa.get(chave);
    if (!dep) {
      dep = {
        departamento: chave,
        colaboradores: 0,
        bruto: 0,
        descontos: 0,
        liquido: 0,
        inss: 0,
        irrf: 0,
        fgts: 0,
        custoTotal: 0,
      };
      mapa.set(chave, dep);
    }
    dep.colaboradores += 1;
    dep.bruto += linha.bruto || 0;
    dep.descontos += linha.descontos || 0;
    dep.liquido += linha.liquido || 0;
    dep.inss += linha.inss || 0;
    dep.irrf += linha.irrf || 0;
    dep.fgts += linha.fgts || 0;
  }
  return [...mapa.values()]
    .map((dep) => ({
      ...dep,
      bruto: round2(dep.bruto),
      descontos: round2(dep.descontos),
      liquido: round2(dep.liquido),
      inss: round2(dep.inss),
      irrf: round2(dep.irrf),
      fgts: round2(dep.fgts),
      custoTotal: round2(dep.bruto + dep.fgts),
    }))
    .sort((a, b) => b.custoTotal - a.custoTotal);
}

/** Totais gerais dos blocos de departamento (linha "TOTAL" do relatório). */
export function totalizarCustos(departamentos: CustoDepartamento[]): CustoDepartamento {
  const total: CustoDepartamento = {
    departamento: 'TOTAL',
    colaboradores: 0,
    bruto: 0,
    descontos: 0,
    liquido: 0,
    inss: 0,
    irrf: 0,
    fgts: 0,
    custoTotal: 0,
  };
  for (const dep of departamentos) {
    total.colaboradores += dep.colaboradores;
    total.bruto += dep.bruto;
    total.descontos += dep.descontos;
    total.liquido += dep.liquido;
    total.inss += dep.inss;
    total.irrf += dep.irrf;
    total.fgts += dep.fgts;
  }
  total.bruto = round2(total.bruto);
  total.descontos = round2(total.descontos);
  total.liquido = round2(total.liquido);
  total.inss = round2(total.inss);
  total.irrf = round2(total.irrf);
  total.fgts = round2(total.fgts);
  total.custoTotal = round2(total.bruto + total.fgts);
  return total;
}

/**
 * Provisões por tributo para as guias de recolhimento da competência:
 * INSS (desconto do segurado), IRRF (retido na fonte) e FGTS (8% patronal).
 */
export function agregarGuias(linhas: LinhaCusto[]): ResumoGuias {
  let inss = 0;
  let irrf = 0;
  let fgts = 0;
  let folhaBruta = 0;
  for (const linha of linhas) {
    inss += linha.inss || 0;
    irrf += linha.irrf || 0;
    fgts += linha.fgts || 0;
    folhaBruta += linha.bruto || 0;
  }
  inss = round2(inss);
  irrf = round2(irrf);
  fgts = round2(fgts);
  return {
    guias: [
      { tributo: 'INSS', descricao: 'Contribuição previdenciária (segurado)', valor: inss },
      { tributo: 'IRRF', descricao: 'Imposto de renda retido na fonte', valor: irrf },
      { tributo: 'FGTS', descricao: 'Depósito FGTS (8% sobre o bruto)', valor: fgts },
    ],
    total: round2(inss + irrf + fgts),
    contribuintes: linhas.length,
    folhaBruta: round2(folhaBruta),
  };
}
