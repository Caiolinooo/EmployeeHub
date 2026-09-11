import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendEmail } from '@/lib/email-exchange';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // BRT = UTC-3 (sem DST): âncora -3h evita virar o mês cedo demais no fim do dia.
    const today = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const currentDay = today.getUTCDate();
    const mesAno = today.toISOString().slice(0, 7);

    const { data: configData } = await supabaseAdmin
      .from('gt_configuracoes')
      .select('valor')
      .eq('chave', 'gt_fechamento_mensal_config')
      .maybeSingle();

    if (!configData?.valor) {
      return NextResponse.json({ message: 'Nenhuma configuração de fechamento encontrada.' });
    }

    const config = typeof configData.valor === 'string' ? JSON.parse(configData.valor) : configData.valor;
    const diaCorte = config.dia_fechamento_mes || 25;

    if (currentDay !== diaCorte) {
      return NextResponse.json({
        message: `Hoje é dia ${currentDay}. O fechamento mensal está programado para o dia ${diaCorte}.`,
        mesAno,
        diaCorte,
      });
    }

    const { data: relatorio } = await supabaseAdmin
      .from('gt_relatorios_aprovacoes')
      .select('*')
      .eq('mes_referencia', mesAno)
      .maybeSingle();

    if (relatorio && (relatorio.status === 'enviado' || relatorio.status === 'aprovado')) {
      return NextResponse.json({
        message: `Fechamento de ${mesAno} já foi realizado com status '${relatorio.status}'.`,
        relatorio,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Dia de corte atingido (${diaCorte}). Fechamento de ${mesAno} pendente de revisão/aprovação.`,
      mesAno,
    });
  } catch (error: any) {
    console.error('[CRON Fechamento Mensal]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
