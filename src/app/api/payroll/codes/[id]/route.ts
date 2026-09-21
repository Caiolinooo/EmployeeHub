import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { PayrollCode, PayrollApiResponse } from '@/types/payroll';
import { garantirNivelPayroll } from '@/lib/payroll/payroll-auth';
import { FORMULAS_FOLHA } from '@/lib/payroll/calculations';

export const dynamic = 'force-dynamic';

/** Linha bruta do banco (snake_case) de payroll_codes. */
interface PayrollCodeRow {
  id: string;
  code: string;
  type: PayrollCode['type'];
  name: string;
  description: string | null;
  calculation_type: PayrollCode['calculationType'];
  value: number;
  formula: string | null;
  legal_type: PayrollCode['legalType'];
  codigo_wk: string | null;
  is_system: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Converte a linha bruta do banco para o formato da API (camelCase). */
function mapearCode(row: PayrollCodeRow): PayrollCode {
  return {
    id: row.id,
    code: row.code,
    type: row.type,
    name: row.name,
    description: row.description ?? undefined,
    calculationType: row.calculation_type,
    value: Number(row.value),
    formula: row.formula ?? undefined,
    legalType: row.legal_type ?? undefined,
    codigoWk: row.codigo_wk,
    isSystem: row.is_system,
    isActive: row.is_active,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
}

/** Tipos de cálculo aceitos (CHECK da tabela). */
const CALCULATION_TYPES = ['fixed', 'percentage', 'formula', 'legal'] as const;
const LEGAL_TYPES = ['inss', 'irrf', 'fgts'] as const;

/**
 * GET /api/payroll/codes/[id]
 * Busca um código específico
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await garantirNivelPayroll(request, 'view');
    if (!gate.ok) return gate.error;

    const { id } = await params;

    const { data, error } = await supabaseAdmin
      .from('payroll_codes')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json({
        success: false,
        error: 'Código não encontrado'
      } as PayrollApiResponse<null>, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: mapearCode(data as PayrollCodeRow)
    } as PayrollApiResponse<PayrollCode>);
  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    } as PayrollApiResponse<null>, { status: 500 });
  }
}

/**
 * PUT /api/payroll/codes/[id]
 * Edita um código. `code` e `type` são imutáveis quando existem itens
 * lançados em payroll_sheet_items (409 se tentados).
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await garantirNivelPayroll(request, 'edit');
    if (!gate.ok) return gate.error;

    const { id } = await params;
    const body = await request.json();

    // Aceita camelCase (padrão da API) com fallback snake_case
    const nome = body.name;
    const descricao = body.description;
    const tipoCalculo = body.calculationType ?? body.calculation_type;
    const valor = body.value;
    const formula = body.formula;
    const tipoLegal = body.legalType ?? body.legal_type;
    const codigoWkBruto = body.codigoWk ?? body.codigo_wk;
    const ativo = body.isActive ?? body.is_active;
    const novoCode = body.code;
    const novoType = body.type;

    // Código existente
    const { data: existente, error: erroBusca } = await supabaseAdmin
      .from('payroll_codes')
      .select('*')
      .eq('id', id)
      .single();

    if (erroBusca || !existente) {
      return NextResponse.json({
        success: false,
        error: 'Código não encontrado'
      } as PayrollApiResponse<null>, { status: 404 });
    }

    const atual = existente as PayrollCodeRow;

    // Validações de enum
    if (tipoCalculo !== undefined && !CALCULATION_TYPES.includes(tipoCalculo)) {
      return NextResponse.json({
        success: false,
        error: `Tipo de cálculo inválido: ${tipoCalculo}. Use: ${CALCULATION_TYPES.join(', ')}`
      } as PayrollApiResponse<null>, { status: 400 });
    }
    if (tipoLegal !== undefined && tipoLegal !== null && !LEGAL_TYPES.includes(tipoLegal)) {
      return NextResponse.json({
        success: false,
        error: `Tipo legal inválido: ${tipoLegal}. Use: ${LEGAL_TYPES.join(', ')}`
      } as PayrollApiResponse<null>, { status: 400 });
    }

    // Fórmula deve ser uma chave conhecida de FORMULAS_FOLHA (o motor nunca
    // inventa valor para fórmula desconhecida — rejeitar na digitação).
    const tipoCalculoEfetivo = tipoCalculo ?? atual.calculation_type;
    if (formula !== undefined && formula !== null && formula !== '' && tipoCalculoEfetivo === 'formula') {
      if (!Object.prototype.hasOwnProperty.call(FORMULAS_FOLHA, formula)) {
        return NextResponse.json({
          success: false,
          error: `Fórmula desconhecida: "${formula}". Chaves válidas: ${Object.keys(FORMULAS_FOLHA).join(', ')}`
        } as PayrollApiResponse<null>, { status: 400 });
      }
    }

    // Mudança de code/type: imutável quando há itens lançados
    const trocaChave = (novoCode !== undefined && novoCode !== atual.code)
      || (novoType !== undefined && novoType !== atual.type);
    if (trocaChave) {
      const { count: itensCount, error: erroCount } = await supabaseAdmin
        .from('payroll_sheet_items')
        .select('id', { count: 'exact', head: true })
        .eq('code_id', id);

      if (erroCount) {
        console.error('Erro ao contar itens do código:', erroCount);
        return NextResponse.json({
          success: false,
          error: 'Erro ao verificar itens lançados do código'
        } as PayrollApiResponse<null>, { status: 500 });
      }

      if ((itensCount || 0) > 0) {
        return NextResponse.json({
          success: false,
          error: `Código possui ${itensCount} item(ns) lançado(s) na folha — code e type são imutáveis`
        } as PayrollApiResponse<null>, { status: 409 });
      }

      // Sem itens: troca permitida, mas deve respeitar UNIQUE(code, type)
      const codeFinal = novoCode ?? atual.code;
      const typeFinal = novoType ?? atual.type;
      const { data: conflito } = await supabaseAdmin
        .from('payroll_codes')
        .select('id')
        .eq('code', codeFinal)
        .eq('type', typeFinal)
        .neq('id', id)
        .maybeSingle();

      if (conflito) {
        return NextResponse.json({
          success: false,
          error: 'Já existe outro código com esse par código/tipo'
        } as PayrollApiResponse<null>, { status: 409 });
      }
    }

    // codigo_wk: índice único parcial — validar conflito com OUTRA rubrica
    const codigoWk = codigoWkBruto === undefined
      ? undefined
      : (codigoWkBruto === null || String(codigoWkBruto).trim() === '' ? null : String(codigoWkBruto).trim());
    if (codigoWk) {
      const { data: conflitoWk } = await supabaseAdmin
        .from('payroll_codes')
        .select('id, code, type')
        .eq('codigo_wk', codigoWk)
        .neq('id', id)
        .maybeSingle();

      if (conflitoWk) {
        return NextResponse.json({
          success: false,
          error: `Código WK "${codigoWk}" já mapeado para a rubrica ${conflitoWk.code} (${conflitoWk.type})`
        } as PayrollApiResponse<null>, { status: 409 });
      }
    }

    // Montar patch apenas com campos presentes no corpo
    const patch: Record<string, unknown> = {};
    if (novoCode !== undefined && trocaChave) patch.code = novoCode;
    if (novoType !== undefined && trocaChave) patch.type = novoType;
    if (nome !== undefined) patch.name = nome;
    if (descricao !== undefined) patch.description = descricao;
    if (tipoCalculo !== undefined) patch.calculation_type = tipoCalculo;
    if (valor !== undefined) patch.value = valor;
    if (formula !== undefined) patch.formula = formula;
    if (tipoLegal !== undefined) patch.legal_type = tipoLegal;
    if (codigoWk !== undefined) patch.codigo_wk = codigoWk;
    if (ativo !== undefined) patch.is_active = ativo;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Nenhum campo para atualizar'
      } as PayrollApiResponse<null>, { status: 400 });
    }

    const { data: atualizado, error: erroUpdate } = await supabaseAdmin
      .from('payroll_codes')
      .update(patch)
      .eq('id', id)
      .select()
      .single();

    if (erroUpdate) {
      // Violação de UNIQUE(code, type) ou do índice único de codigo_wk em corrida
      if (erroUpdate.code === '23505') {
        return NextResponse.json({
          success: false,
          error: 'Conflito de unicidade (código/tipo ou código WK já em uso por outra rubrica)'
        } as PayrollApiResponse<null>, { status: 409 });
      }
      console.error('Erro ao atualizar código:', erroUpdate);
      return NextResponse.json({
        success: false,
        error: 'Erro ao atualizar código'
      } as PayrollApiResponse<null>, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: mapearCode(atualizado as PayrollCodeRow),
      message: 'Código atualizado com sucesso'
    } as PayrollApiResponse<PayrollCode>);
  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    } as PayrollApiResponse<null>, { status: 500 });
  }
}

/**
 * DELETE /api/payroll/codes/[id]
 * Desativa o código (soft delete SEMPRE — histórico de itens referencia codes).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await garantirNivelPayroll(request, 'edit');
    if (!gate.ok) return gate.error;

    const { id } = await params;

    const { data, error } = await supabaseAdmin
      .from('payroll_codes')
      .update({ is_active: false })
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      if ((error as { code?: string } | null)?.code === 'PGRST116' || !error) {
        return NextResponse.json({
          success: false,
          error: 'Código não encontrado'
        } as PayrollApiResponse<null>, { status: 404 });
      }
      console.error('Erro ao desativar código:', error);
      return NextResponse.json({
        success: false,
        error: 'Erro ao desativar código'
      } as PayrollApiResponse<null>, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: mapearCode(data as PayrollCodeRow),
      message: 'Código desativado com sucesso'
    } as PayrollApiResponse<PayrollCode>);
  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    } as PayrollApiResponse<null>, { status: 500 });
  }
}
