import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { buscarAsosComAlerta } from '@/lib/gestao-tripulantes/aso-vencimentos';
import { getAsoAntecedenciaDias } from '@/lib/gestao-tripulantes/aso-agendamento-config';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return processarAlertas(request);
}

export async function POST(request: NextRequest) {
  return processarAlertas(request);
}

async function processarAlertas(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // allow internal cron or continue
    }

    const antecedenciaDias = await getAsoAntecedenciaDias();
    const { vencidos, vencendo } = await buscarAsosComAlerta(antecedenciaDias);
    const listaAsos = [...vencidos, ...vencendo];

    const notificacoesInApp: Array<{
      user_id: string;
      type: string;
      title: string;
      message: string;
      priority: string;
      action_url: string;
      created_at: string;
    }> = [];

    for (const a of listaAsos) {
      const colab = a.colaborador;
      if (colab?.user_id) {
        const isVencido = a.alerta === 'vencido';
        notificacoesInApp.push({
          user_id: colab.user_id,
          type: 'compliance_alert',
          title: isVencido ? '⚠️ ASO Vencido — Renovação Obrigatória' : '⏰ ASO Próximo do Vencimento',
          message: `Seu ASO com validade até ${a.data_validade} está ${isVencido ? 'VENCIDO' : 'próximo de expirar'}.`,
          priority: isVencido ? 'high' : 'normal',
          action_url: '/department/gestao-tripulantes',
          created_at: new Date().toISOString(),
        });
      }
    }

    const { data: adminUsers } = await supabaseAdmin
      .from('users_unified')
      .select('id')
      .in('role', ['admin', 'manager', 'dp', 'gestor'])
      .limit(20);

    for (const adm of adminUsers || []) {
      notificacoesInApp.push({
        user_id: adm.id,
        type: 'compliance_alert',
        title: `🚨 Alerta DP: ${vencidos.length} ASOs Vencidos e ${vencendo.length} Vencendo`,
        message: `Existem ${vencidos.length} ASO(s) vencido(s) e ${vencendo.length} vencendo nos próximos ${antecedenciaDias} dias.`,
        priority: vencidos.length > 0 ? 'high' : 'normal',
        action_url: '/department/dp',
        created_at: new Date().toISOString(),
      });
    }

    if (notificacoesInApp.length > 0) {
      await supabaseAdmin.from('notifications').insert(notificacoesInApp);
    }

    return NextResponse.json({
      success: true,
      totalVencidos: vencidos.length,
      totalVencendo: vencendo.length,
      antecedencia_dias: antecedenciaDias,
      notificacoesCriadas: notificacoesInApp.length,
    });
  } catch (error) {
    console.error('Erro no cron de notificação de ASO:', error);
    return NextResponse.json({ error: 'Erro interno no cron' }, { status: 500 });
  }
}
