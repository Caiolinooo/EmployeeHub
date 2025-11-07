import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyToken } from '@/lib/auth';
import { KPIAvaliacao, FiltroAnalise } from '@/types/avaliacoes-avancadas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token não fornecido' },
        { status: 401 }
      );
    }

    const authResult = verifyToken(token);
    if (!authResult) {
      return NextResponse.json(
        { success: false, error: 'Token inválido' },
        { status: 401 }
      );
    }

    // Verificar permissões
    const { data: user } = await supabase
      .from('users_unified')
      .select('access_permissions')
      .eq('id', authResult.userId)
      .single();

    const permissions = user?.access_permissions || {};
    if (!permissions['avaliacoes.metricas.read']) {
      return NextResponse.json(
        { success: false, error: 'Sem permissão para visualizar métricas' },
        { status: 403 }
      );
    }

    // Obter filtros
    const filtros: FiltroAnalise = await request.json();

    // Calcular KPIs
    const kpis: KPIAvaliacao[] = [];

    // 1. Média Geral de Pontuação
    const { data: mediaGeral } = await supabase
      .from('vw_avaliacoes_desempenho')
      .select('pontuacao_total')
      .gte('data_inicio', filtros.periodo_inicio)
      .lte('data_fim', filtros.periodo_fim)
      .in('status', filtros.status_avaliacoes);

    const pontuacoes = mediaGeral?.map(a => a.pontuacao_total).filter(p => p > 0) || [];
    const mediaAtual = pontuacoes.length > 0 ? 
      pontuacoes.reduce((sum, p) => sum + p, 0) / pontuacoes.length : 0;

    // Calcular variação (comparar com período anterior)
    const periodoAnteriorInicio = new Date(filtros.periodo_inicio);
    periodoAnteriorInicio.setMonth(periodoAnteriorInicio.getMonth() - 6);
    const periodoAnteriorFim = new Date(filtros.periodo_fim);
    periodoAnteriorFim.setMonth(periodoAnteriorFim.getMonth() - 6);

    const { data: mediaAnterior } = await supabase
      .from('vw_avaliacoes_desempenho')
      .select('pontuacao_total')
      .gte('data_inicio', periodoAnteriorInicio.toISOString().split('T')[0])
      .lte('data_fim', periodoAnteriorFim.toISOString().split('T')[0])
      .in('status', filtros.status_avaliacoes);

    const pontuacoesAnteriores = mediaAnterior?.map(a => a.pontuacao_total).filter(p => p > 0) || [];
    const mediaAnteriorValor = pontuacoesAnteriores.length > 0 ? 
      pontuacoesAnteriores.reduce((sum, p) => sum + p, 0) / pontuacoesAnteriores.length : 0;

    const variacaoMedia = mediaAnteriorValor > 0 ? 
      ((mediaAtual - mediaAnteriorValor) / mediaAnteriorValor) * 100 : 0;

    kpis.push({
      id: 'media-geral',
      nome: 'Média Geral de Pontuação',
      valor: mediaAtual,
      meta: 8.0,
      unidade: 'pontos',
      variacao: variacaoMedia,
      tendencia: variacaoMedia > 5 ? 'crescente' : variacaoMedia < -5 ? 'decrescente' : 'estavel',
      periodo: `${filtros.periodo_inicio} a ${filtros.periodo_fim}`,
      cor: '#3B82F6',
      descricao: 'Média de todas as pontuações de avaliações no período'
    });

    // 2. Total de Avaliações Concluídas
    const { data: totalConcluidas, count: countConcluidas } = await supabase
      .from('vw_avaliacoes_desempenho')
      .select('id', { count: 'exact' })
      .gte('data_inicio', filtros.periodo_inicio)
      .lte('data_fim', filtros.periodo_fim)
      .eq('status', 'concluida');

    const { data: totalAnterioresConcluidas, count: countAnterioresConcluidas } = await supabase
      .from('vw_avaliacoes_desempenho')
      .select('id', { count: 'exact' })
      .gte('data_inicio', periodoAnteriorInicio.toISOString().split('T')[0])
      .lte('data_fim', periodoAnteriorFim.toISOString().split('T')[0])
      .eq('status', 'concluida');

    const variacaoConcluidas = countAnterioresConcluidas && countAnterioresConcluidas > 0 ? 
      (((countConcluidas || 0) - countAnterioresConcluidas) / countAnterioresConcluidas) * 100 : 0;

    kpis.push({
      id: 'avaliacoes-concluidas',
      nome: 'Avaliações Concluídas',
      valor: countConcluidas || 0,
      meta: 50,
      unidade: '',
      variacao: variacaoConcluidas,
      tendencia: variacaoConcluidas > 10 ? 'crescente' : variacaoConcluidas < -10 ? 'decrescente' : 'estavel',
      periodo: `${filtros.periodo_inicio} a ${filtros.periodo_fim}`,
      cor: '#10B981',
      descricao: 'Número total de avaliações finalizadas no período'
    });

    // 3. Funcionários Avaliados
    const { data: funcionariosAvaliados } = await supabase
      .from('vw_avaliacoes_desempenho')
      .select('funcionario_id')
      .gte('data_inicio', filtros.periodo_inicio)
      .lte('data_fim', filtros.periodo_fim)
      .in('status', filtros.status_avaliacoes);

    const funcionariosUnicos = new Set(funcionariosAvaliados?.map(f => f.funcionario_id) || []).size;

    const { data: funcionariosAnteriores } = await supabase
      .from('vw_avaliacoes_desempenho')
      .select('funcionario_id')
      .gte('data_inicio', periodoAnteriorInicio.toISOString().split('T')[0])
      .lte('data_fim', periodoAnteriorFim.toISOString().split('T')[0])
      .in('status', filtros.status_avaliacoes);

    const funcionariosAnterioresUnicos = new Set(funcionariosAnteriores?.map(f => f.funcionario_id) || []).size;
    const variacaoFuncionarios = funcionariosAnterioresUnicos > 0 ? 
      ((funcionariosUnicos - funcionariosAnterioresUnicos) / funcionariosAnterioresUnicos) * 100 : 0;

    kpis.push({
      id: 'funcionarios-avaliados',
      nome: 'Funcionários Avaliados',
      valor: funcionariosUnicos,
      meta: 30,
      unidade: '',
      variacao: variacaoFuncionarios,
      tendencia: variacaoFuncionarios > 5 ? 'crescente' : variacaoFuncionarios < -5 ? 'decrescente' : 'estavel',
      periodo: `${filtros.periodo_inicio} a ${filtros.periodo_fim}`,
      cor: '#F59E0B',
      descricao: 'Número de funcionários únicos que receberam avaliações'
    });

    // 4. Taxa de Conclusão
    const { data: totalAvaliacoes, count: countTotal } = await supabase
      .from('vw_avaliacoes_desempenho')
      .select('id', { count: 'exact' })
      .gte('data_inicio', filtros.periodo_inicio)
      .lte('data_fim', filtros.periodo_fim);

    const taxaConclusao = countTotal && countTotal > 0 ? 
      ((countConcluidas || 0) / countTotal) * 100 : 0;

    const { data: totalAnteriores, count: countTotalAnterior } = await supabase
      .from('vw_avaliacoes_desempenho')
      .select('id', { count: 'exact' })
      .gte('data_inicio', periodoAnteriorInicio.toISOString().split('T')[0])
      .lte('data_fim', periodoAnteriorFim.toISOString().split('T')[0]);

    const taxaAnterior = countTotalAnterior && countTotalAnterior > 0 ? 
      ((countAnterioresConcluidas || 0) / countTotalAnterior) * 100 : 0;

    const variacaoTaxa = taxaAnterior > 0 ? 
      ((taxaConclusao - taxaAnterior) / taxaAnterior) * 100 : 0;

    kpis.push({
      id: 'taxa-conclusao',
      nome: 'Taxa de Conclusão',
      valor: taxaConclusao,
      meta: 85,
      unidade: '%',
      variacao: variacaoTaxa,
      tendencia: variacaoTaxa > 5 ? 'crescente' : variacaoTaxa < -5 ? 'decrescente' : 'estavel',
      periodo: `${filtros.periodo_inicio} a ${filtros.periodo_fim}`,
      cor: '#8B5CF6',
      descricao: 'Percentual de avaliações concluídas em relação ao total iniciado'
    });

    return NextResponse.json({
      success: true,
      kpis,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Erro ao calcular KPIs:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
