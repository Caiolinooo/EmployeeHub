import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyToken } from '@/lib/auth';
import { 
  FiltroAnalise, 
  ResultadoAnalise, 
  TendenciaAvaliacao, 
  AnaliseComparativa,
  AlertaPerformance 
} from '@/types/avaliacoes-avancadas';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

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
        { success: false, error: 'Sem permissão para visualizar análises' },
        { status: 403 }
      );
    }

    // Obter filtros
    const filtros: FiltroAnalise = await request.json();

    // 1. Calcular Resumo Geral
    const { data: avaliacoes } = await supabase
      .from('vw_avaliacoes_desempenho')
      .select('*')
      .gte('data_inicio', filtros.periodo_inicio)
      .lte('data_fim', filtros.periodo_fim);

    const avaliacoesValidas = avaliacoes || [];
    const avaliacoesConcluidas = avaliacoesValidas.filter(a => a.status === 'concluida');
    const avaliacoesPendentes = avaliacoesValidas.filter(a => a.status === 'pendente');
    const funcionariosUnicos = new Set(avaliacoesValidas.map(a => a.funcionario_id)).size;
    
    const pontuacoesValidas = avaliacoesConcluidas
      .map(a => a.pontuacao_total)
      .filter(p => p && p > 0);
    
    const mediaGeral = pontuacoesValidas.length > 0 ? 
      pontuacoesValidas.reduce((sum, p) => sum + p, 0) / pontuacoesValidas.length : 0;

    const resumo = {
      total_avaliacoes: avaliacoesValidas.length,
      media_geral: mediaGeral,
      avaliacoes_concluidas: avaliacoesConcluidas.length,
      avaliacoes_pendentes: avaliacoesPendentes.length,
      funcionarios_avaliados: funcionariosUnicos
    };

    // 2. Calcular Tendências (últimos 12 meses)
    const tendencias: TendenciaAvaliacao[] = [];
    const dataInicio = new Date(filtros.periodo_inicio);
    const dataFim = new Date(filtros.periodo_fim);
    
    // Gerar dados mensais
    for (let d = new Date(dataInicio); d <= dataFim; d.setMonth(d.getMonth() + 1)) {
      const mesInicio = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
      const mesFim = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
      
      const { data: avaliacoesMes } = await supabase
        .from('vw_avaliacoes_desempenho')
        .select('pontuacao_total, status')
        .gte('data_inicio', mesInicio)
        .lte('data_fim', mesFim);

      const avaliacoesValidasMes = avaliacoesMes || [];
      const concluidasMes = avaliacoesValidasMes.filter(a => a.status === 'concluida');
      const pontuacoesMes = concluidasMes
        .map(a => a.pontuacao_total)
        .filter(p => p && p > 0);
      
      const mediaMes = pontuacoesMes.length > 0 ? 
        pontuacoesMes.reduce((sum, p) => sum + p, 0) / pontuacoesMes.length : 0;

      tendencias.push({
        periodo: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        data: mesInicio,
        media_pontuacao: mediaMes,
        total_avaliacoes: avaliacoesValidasMes.length,
        avaliacoes_concluidas: concluidasMes.length,
        satisfacao_media: mediaMes // Simplificado - pode ser calculado separadamente
      });
    }

    // 3. Análise Comparativa por Departamentos
    const { data: departamentosData } = await supabase
      .from('vw_avaliacoes_desempenho')
      .select('funcionario_id, funcionario_departamento, pontuacao_total, status')
      .gte('data_inicio', filtros.periodo_inicio)
      .lte('data_fim', filtros.periodo_fim)
      .not('funcionario_departamento', 'is', null);

    const departamentosMap = new Map();
    departamentosData?.forEach(item => {
      const dept = item.funcionario_departamento;
      if (!departamentosMap.has(dept)) {
        departamentosMap.set(dept, {
          nome: dept,
          pontuacoes: [],
          total_funcionarios: new Set(),
          avaliacoes_concluidas: 0
        });
      }
      
      const deptData = departamentosMap.get(dept);
      deptData.total_funcionarios.add(item.funcionario_id);
      
      if (item.status === 'concluida' && item.pontuacao_total > 0) {
        deptData.pontuacoes.push(item.pontuacao_total);
        deptData.avaliacoes_concluidas++;
      }
    });

    const departamentos = Array.from(departamentosMap.values()).map(dept => ({
      nome: dept.nome,
      media_pontuacao: dept.pontuacoes.length > 0 ? 
        dept.pontuacoes.reduce((sum: number, p: number) => sum + p, 0) / dept.pontuacoes.length : 0,
      total_funcionarios: dept.total_funcionarios.size,
      avaliacoes_concluidas: dept.avaliacoes_concluidas
    }));

    // 4. Análise Comparativa por Cargos
    const { data: cargosData } = await supabase
      .from('vw_avaliacoes_desempenho')
      .select('funcionario_id, funcionario_cargo, pontuacao_total, status')
      .gte('data_inicio', filtros.periodo_inicio)
      .lte('data_fim', filtros.periodo_fim)
      .not('funcionario_cargo', 'is', null);

    const cargosMap = new Map();
    cargosData?.forEach(item => {
      const cargo = item.funcionario_cargo;
      if (!cargosMap.has(cargo)) {
        cargosMap.set(cargo, {
          nome: cargo,
          pontuacoes: [],
          total_funcionarios: new Set(),
          avaliacoes_concluidas: 0
        });
      }
      
      const cargoData = cargosMap.get(cargo);
      cargoData.total_funcionarios.add(item.funcionario_id);
      
      if (item.status === 'concluida' && item.pontuacao_total > 0) {
        cargoData.pontuacoes.push(item.pontuacao_total);
        cargoData.avaliacoes_concluidas++;
      }
    });

    const cargos = Array.from(cargosMap.values()).map(cargo => ({
      nome: cargo.nome,
      media_pontuacao: cargo.pontuacoes.length > 0 ? 
        cargo.pontuacoes.reduce((sum: number, p: number) => sum + p, 0) / cargo.pontuacoes.length : 0,
      total_funcionarios: cargo.total_funcionarios.size,
      avaliacoes_concluidas: cargo.avaliacoes_concluidas
    }));

    // 5. Análise por Critérios (simulado - seria necessário ter dados de critérios)
    const criterios = [
      { nome: 'Produtividade', media_pontuacao: 8.2, peso: 1.0 },
      { nome: 'Qualidade', media_pontuacao: 7.8, peso: 1.0 },
      { nome: 'Comunicação', media_pontuacao: 8.5, peso: 0.8 },
      { nome: 'Liderança', media_pontuacao: 7.3, peso: 0.9 },
      { nome: 'Inovação', media_pontuacao: 7.9, peso: 0.7 }
    ];

    const comparacoes: AnaliseComparativa = {
      periodo: `${filtros.periodo_inicio} a ${filtros.periodo_fim}`,
      departamentos,
      cargos,
      criterios
    };

    // 6. Gerar Alertas
    const alertas: AlertaPerformance[] = [];
    
    // Alerta para departamentos com baixa performance
    departamentos.forEach(dept => {
      if (dept.media_pontuacao < 6.0 && dept.avaliacoes_concluidas > 0) {
        alertas.push({
          id: `dept-${dept.nome.toLowerCase().replace(/\s+/g, '-')}`,
          tipo: 'queda_performance',
          titulo: `Performance baixa em ${dept.nome}`,
          descricao: `O departamento ${dept.nome} apresenta média de ${dept.media_pontuacao.toFixed(1)} pontos`,
          severidade: dept.media_pontuacao < 5.0 ? 'critica' : 'alta',
          departamento: dept.nome,
          data_criacao: new Date().toISOString(),
          resolvido: false,
          acao_sugerida: 'Revisar processos e oferecer treinamento adicional'
        });
      }
    });

    // Alerta para avaliações pendentes
    if (avaliacoesPendentes.length > 10) {
      alertas.push({
        id: 'avaliacoes-pendentes',
        tipo: 'avaliacao_pendente',
        titulo: 'Muitas avaliações pendentes',
        descricao: `${avaliacoesPendentes.length} avaliações estão pendentes de conclusão`,
        severidade: avaliacoesPendentes.length > 20 ? 'alta' : 'media',
        data_criacao: new Date().toISOString(),
        resolvido: false,
        acao_sugerida: 'Notificar avaliadores e definir prazos'
      });
    }

    // 7. Gerar Recomendações
    const recomendacoes: string[] = [];
    
    if (mediaGeral < 7.0) {
      recomendacoes.push('Considere revisar os critérios de avaliação e oferecer mais treinamento');
    }
    
    if (resumo.avaliacoes_pendentes > resumo.avaliacoes_concluidas) {
      recomendacoes.push('Implemente lembretes automáticos para avaliações pendentes');
    }
    
    const deptComMaiorMedia = departamentos.reduce((prev, current) => 
      prev.media_pontuacao > current.media_pontuacao ? prev : current, departamentos[0]);
    
    if (deptComMaiorMedia) {
      recomendacoes.push(`Analise as práticas do departamento ${deptComMaiorMedia.nome} para replicar em outros setores`);
    }

    const resultado: ResultadoAnalise = {
      resumo,
      metricas: [], // Será preenchido pela API de KPIs
      tendencias,
      comparacoes,
      alertas,
      recomendacoes
    };

    return NextResponse.json({
      success: true,
      data: resultado,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Erro ao gerar análise:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
