import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * API para limpeza automática de avaliações na lixeira após 30 dias
 *
 * Esta rota pode ser chamada periodicamente via cron job para remover
 * permanentemente avaliações que foram movidas para a lixeira há mais de 30 dias.
 *
 * @method GET
 * @returns JSON com o resultado da operação
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar se há uma chave de autorização para cron jobs
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // Validar autorização se houver segredo configurado
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    // Criar cliente Supabase com credenciais de serviço
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Configuração do Supabase incompleta' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calcular data de 30 dias atrás
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoISO = thirtyDaysAgo.toISOString();

    console.log(`Buscando avaliações deletadas antes de: ${thirtyDaysAgoISO}`);

    // Buscar avaliações que estão na lixeira há mais de 30 dias
    const { data: avaliacoesParaExcluir, error: selectError } = await supabase
      .from('avaliacoes_desempenho')
      .select('id, funcionario_id, periodo, deleted_at')
      .not('deleted_at', 'is', null)
      .lt('deleted_at', thirtyDaysAgoISO);

    if (selectError) {
      console.error('Erro ao buscar avaliações:', selectError);
      return NextResponse.json(
        { error: 'Erro ao buscar avaliações para exclusão', details: selectError.message },
        { status: 500 }
      );
    }

    if (!avaliacoesParaExcluir || avaliacoesParaExcluir.length === 0) {
      console.log('Nenhuma avaliação encontrada para exclusão automática');
      return NextResponse.json({
        success: true,
        message: 'Nenhuma avaliação encontrada para exclusão',
        deletedCount: 0,
        deletedIds: []
      });
    }

    console.log(`Encontradas ${avaliacoesParaExcluir.length} avaliações para exclusão permanente`);

    // Extrair IDs das avaliações
    const idsParaExcluir = avaliacoesParaExcluir.map(av => av.id);

    // Excluir pontuações relacionadas primeiro (devido a foreign keys)
    const { error: pontuacoesError } = await supabase
      .from('pontuacoes')
      .delete()
      .in('avaliacao_id', idsParaExcluir);

    if (pontuacoesError) {
      console.error('Erro ao excluir pontuações:', pontuacoesError);
      // Continuar mesmo com erro nas pontuações
    }

    // Excluir as avaliações permanentemente
    const { error: deleteError } = await supabase
      .from('avaliacoes_desempenho')
      .delete()
      .in('id', idsParaExcluir);

    if (deleteError) {
      console.error('Erro ao excluir avaliações:', deleteError);
      return NextResponse.json(
        { error: 'Erro ao excluir avaliações permanentemente', details: deleteError.message },
        { status: 500 }
      );
    }

    console.log(`${avaliacoesParaExcluir.length} avaliações excluídas permanentemente com sucesso`);

    return NextResponse.json({
      success: true,
      message: `${avaliacoesParaExcluir.length} avaliação(ões) excluída(s) permanentemente`,
      deletedCount: avaliacoesParaExcluir.length,
      deletedIds: idsParaExcluir,
      deletedItems: avaliacoesParaExcluir.map(av => ({
        id: av.id,
        periodo: av.periodo,
        deleted_at: av.deleted_at
      }))
    });

  } catch (error) {
    console.error('Erro na limpeza automática da lixeira:', error);
    return NextResponse.json(
      {
        error: 'Erro interno ao processar limpeza automática',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}

/**
 * Endpoint POST para executar limpeza manual (para admins)
 */
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação usando JWT customizado
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader || undefined);

    if (!token) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: 'Token inválido ou expirado' },
        { status: 401 }
      );
    }

    // Verificar se o usuário é administrador
    const { data: requestingUser, error: userError } = await supabaseAdmin
      .from('users_unified')
      .select('id, role')
      .eq('id', payload.userId)
      .single();

    if (userError || !requestingUser || requestingUser.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores podem executar limpeza manual.' },
        { status: 403 }
      );
    }

    // Executar a lógica de limpeza usando supabaseAdmin
    // Calcular data de 30 dias atrás
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoISO = thirtyDaysAgo.toISOString();

    // Buscar avaliações que estão na lixeira há mais de 30 dias
    const { data: avaliacoesParaExcluir, error: selectError } = await supabaseAdmin
      .from('avaliacoes_desempenho')
      .select('id, funcionario_id, periodo, deleted_at')
      .not('deleted_at', 'is', null)
      .lt('deleted_at', thirtyDaysAgoISO);

    if (selectError) {
      return NextResponse.json(
        { error: 'Erro ao buscar avaliações para exclusão', details: selectError.message },
        { status: 500 }
      );
    }

    if (!avaliacoesParaExcluir || avaliacoesParaExcluir.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nenhuma avaliação encontrada para exclusão',
        deletedCount: 0,
        deletedIds: []
      });
    }

    const idsParaExcluir = avaliacoesParaExcluir.map(av => av.id);

    // Excluir pontuações relacionadas
    await supabaseAdmin
      .from('pontuacoes')
      .delete()
      .in('avaliacao_id', idsParaExcluir);

    // Excluir as avaliações
    const { error: deleteError } = await supabaseAdmin
      .from('avaliacoes_desempenho')
      .delete()
      .in('id', idsParaExcluir);

    if (deleteError) {
      return NextResponse.json(
        { error: 'Erro ao excluir avaliações permanentemente', details: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `${avaliacoesParaExcluir.length} avaliação(ões) excluída(s) permanentemente`,
      deletedCount: avaliacoesParaExcluir.length,
      deletedIds: idsParaExcluir,
      deletedItems: avaliacoesParaExcluir.map(av => ({
        id: av.id,
        periodo: av.periodo,
        deleted_at: av.deleted_at
      }))
    });

  } catch (error) {
    console.error('Erro na limpeza manual da lixeira:', error);
    return NextResponse.json(
      {
        error: 'Erro interno ao processar limpeza manual',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}
