import { NextRequest, NextResponse } from 'next/server';
import { syncAllFromMIO } from '@/lib/gestao-tripulantes/mio-sync';
import { verifyToken } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return handleCronRequest(request);
}

export async function POST(request: NextRequest) {
  return handleCronRequest(request);
}

async function handleCronRequest(request: NextRequest) {
  const logId = crypto.randomUUID();
  const startTime = new Date().toISOString();

  try {
    const authHeader = request.headers.get('authorization');
    const cronSecretHeader = request.headers.get('x-vercel-cron-secret');

    const isVercelCron =
      cronSecretHeader === process.env.CRON_SECRET ||
      (Boolean(process.env.CRON_SECRET) && authHeader === `Bearer ${process.env.CRON_SECRET}`);
    let isAdmin = false;

    if (authHeader && authHeader.startsWith('Bearer ') && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      const token = authHeader.substring(7);
      const decoded = verifyToken(token);
      if (decoded && (decoded.role === 'ADMIN' || decoded.role === 'MANAGER')) {
        isAdmin = true;
      }
    }

    const isLocalDevelopment = process.env.NODE_ENV === 'development';
    const isAuthorized = isVercelCron || isAdmin || isLocalDevelopment;

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: 'Acesso não autorizado ao agendador cron.' },
        { status: 401 }
      );
    }

    console.log('⏰ Executando Cron de sincronização completa do MIO...');

    await supabaseAdmin
      .from('gt_cron_log')
      .insert({
        id: logId,
        tipo: 'sync_mio',
        status: 'executando',
        iniciado_em: startTime,
        detalhes: { mensagem: 'Sincronização completa do MIO iniciada (colaboradores + treinamentos + embarques)' }
      });

    const allResult = await syncAllFromMIO();

    const success = allResult.success;
    const colData = allResult.data?.colaboradores || { importados: 0, atualizados: 0, erros: [] };
    const treData = allResult.data?.treinamentos || { importados: 0, atualizados: 0, ignorados: 0, erros: [] };
    const embData = allResult.data?.embarques || { importados: 0, atualizados: 0, ignorados: 0, erros: [] };
    const usrData = allResult.data?.usuarios || { criados: 0, atualizados: 0, erros: [] };
    const afaData = allResult.data?.afastamentos || { importados: 0, atualizados: 0, ignorados: 0, erros: [] };

    const totalProcessados =
      (colData.importados || 0) + (colData.atualizados || 0) +
      (treData.importados || 0) + (treData.atualizados || 0) +
      (embData.importados || 0) + (embData.atualizados || 0) +
      (usrData.criados || 0) + (usrData.atualizados || 0) +
      (afaData.importados || 0) + (afaData.atualizados || 0);

    const totalErros =
      (colData.erros?.length || 0) +
      (treData.erros?.length || 0) +
      (embData.erros?.length || 0) +
      (usrData.erros?.length || 0) +
      (afaData.erros?.length || 0);

    const detalhes = {
      colaboradores: colData,
      treinamentos: treData,
      embarques: embData,
      afastamentos: afaData,
      usuarios: usrData,
      exportacao_mio: { enviados: 0, erros: [], blocked: true },
      erro: allResult.error
    };

    await supabaseAdmin
      .from('gt_cron_log')
      .update({
        status: success ? 'sucesso' : 'erro',
        registros_processados: totalProcessados,
        registros_erro: totalErros,
        mensagem_erro: !success ? `Erro na sincronização: ${allResult.error || ''}` : null,
        finalizado_em: new Date().toISOString(),
        detalhes
      })
      .eq('id', logId);

    if (!success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Erro parcial ou total na sincronização do MIO',
          details: detalhes
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Sincronização completa com o MIO executada com sucesso.',
      data: detalhes
    });

  } catch (error: any) {
    console.error('Erro na rota de Cron MIO:', error);
    
    try {
      await supabaseAdmin
        .from('gt_cron_log')
        .update({
          status: 'erro',
          mensagem_erro: error.message || 'Erro interno fatal na execução do MIO sync',
          finalizado_em: new Date().toISOString()
        })
        .eq('id', logId);
    } catch (logErr) {
      console.error('Erro ao salvar log de erro do Cron MIO:', logErr);
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
