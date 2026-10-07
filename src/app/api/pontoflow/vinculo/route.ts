import { NextRequest, NextResponse } from 'next/server';
import { verifyRequestToken } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { podeMutarCadastroColaborador } from '@/lib/gestao-tripulantes/colaborador-cadastro-auth';
import {
  createSupabaseVinculoStore,
  resolveVinculoByExternalId,
  resolveVinculoByUser,
} from '@/lib/timesheet-integration/vinculo';

export const dynamic = 'force-dynamic';

/**
 * Estado da cadeia login / PontoFlow / folha / empresa.
 * Sem colaboradorId: o próprio usuário. Com colaboradorId: DP (pode mutar cadastro).
 */
export async function GET(request: NextRequest) {
  const auth = verifyRequestToken(request);
  if (!auth.valid || !auth.payload) {
    return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
  }
  const userId = auth.payload.userId || auth.payload.user_id || auth.payload.sub || auth.payload.id || null;
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
  }

  const colaboradorId = request.nextUrl.searchParams.get('colaboradorId');
  try {
    const admin = await getSupabaseAdmin();
    const store = createSupabaseVinculoStore(admin);
    if (colaboradorId) {
      const pode = await podeMutarCadastroColaborador(userId, auth.payload.role);
      if (!pode) {
        return NextResponse.json({ success: false, error: 'Sem permissão' }, { status: 403 });
      }
      const vinculo = await resolveVinculoByExternalId(store, colaboradorId);
      return NextResponse.json({ success: true, data: snapshot(vinculo) });
    }
    const vinculo = await resolveVinculoByUser(store, userId);
    return NextResponse.json({ success: true, data: snapshot(vinculo) });
  } catch (error) {
    console.error('[pontoflow/vinculo] GET erro:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 },
    );
  }
}

function snapshot(vinculo: Awaited<ReturnType<typeof resolveVinculoByUser>>) {
  return {
    completo: vinculo.completo,
    motivo: vinculo.motivo,
    login: Boolean(vinculo.colaborador?.user_id),
    ponto: Boolean(vinculo.tsEmployeeId),
    folha: Boolean(vinculo.payrollEmployeeId),
    empresa: vinculo.empresaConfigurada,
  };
}
