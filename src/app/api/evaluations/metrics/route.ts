import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Verificar autenticação
async function verifyAuth(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return null;

    const token = authHeader.replace('Bearer ', '');
    const supabase = getSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) return null;
    return user;
  } catch (error) {
    return null;
  }
}

// GET - Obter métricas de avaliação
export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    // Verificar se é admin ou manager
    const supabase = getSupabaseClient();
    const { data: userData } = await supabase
      .from('users_unified')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!userData || !['ADMIN', 'MANAGER'].includes(userData.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    // Buscar métricas gerais
    const { data: allUsers } = await supabase
      .from('users_unified')
      .select('id, name, department, position')
      .neq('role', 'ADMIN');

    const { data: evaluationMetrics } = await supabase
      .from('evaluation_metrics')
      .select('*')
      .gte('period_start', new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

    // Calcular estatísticas
    const totalEmployees = allUsers?.length || 0;
    const averageScore = evaluationMetrics?.reduce((sum, m) => sum + (m.overall_score || 0), 0) / (evaluationMetrics?.length || 1);
    const completedEvaluations = evaluationMetrics?.length || 0;
    const pendingEvaluations = Math.max(0, totalEmployees - completedEvaluations);

    // Agrupar por departamento
    const departmentStats = allUsers?.reduce((acc, user) => {
      const dept = user.department || 'N/A';
      if (!acc[dept]) {
        acc[dept] = { employees: 0, totalScore: 0, evaluations: 0 };
      }
      acc[dept].employees++;
      
      const userMetrics = evaluationMetrics?.filter(m => m.user_id === user.id) || [];
      const userAvgScore = userMetrics.reduce((sum, m) => sum + (m.overall_score || 0), 0) / (userMetrics.length || 1);
      
      acc[dept].totalScore += userAvgScore || 0;
      acc[dept].evaluations += userMetrics.length;
      
      return acc;
    }, {} as Record<string, { employees: number; totalScore: number; evaluations: number }>);

    const departmentScores = Object.entries(departmentStats || {}).map(([name, stats]) => ({
      name,
      score: stats.totalScore / stats.employees,
      employees: stats.employees
    }));

    // Tendências mensais (últimos 6 meses)
    const monthlyTrends = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];
      
      const monthMetrics = evaluationMetrics?.filter(m => 
        m.period_start >= monthStart && m.period_end <= monthEnd
      ) || [];
      
      const monthAvg = monthMetrics.reduce((sum, m) => sum + (m.overall_score || 0), 0) / (monthMetrics.length || 1);
      
      monthlyTrends.push({
        month: date.toLocaleDateString('pt-BR', { month: 'short' }),
        score: monthAvg || 0
      });
    }

    return NextResponse.json({
      totalEmployees,
      averageScore: Math.round(averageScore * 100) / 100,
      completedEvaluations,
      pendingEvaluations,
      departmentScores,
      monthlyTrends
    });

  } catch (error) {
    console.error('Erro ao buscar métricas:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST - Criar/Atualizar métricas de avaliação
export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const body = await request.json();
    const { 
      user_id, 
      period_start, 
      period_end, 
      department, 
      position, 
      overall_score, 
      metrics 
    } = body;

    if (!user_id || !period_start || !period_end || overall_score === undefined) {
      return NextResponse.json(
        { error: 'Dados obrigatórios não fornecidos' },
        { status: 400 }
      );
    }

    // Verificar se já existe uma métrica para este período
    const supabase = getSupabaseClient();
    const { data: existingMetric } = await supabase
      .from('evaluation_metrics')
      .select('id')
      .eq('user_id', user_id)
      .eq('period_start', period_start)
      .eq('period_end', period_end)
      .single();

    if (existingMetric) {
      // Atualizar métrica existente
      const { data, error } = await supabase
        .from('evaluation_metrics')
        .update({
          department,
          position,
          overall_score,
          metrics,
          calculated_at: new Date().toISOString()
        })
        .eq('id', existingMetric.id)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json(data);
    } else {
      // Criar nova métrica
      const { data, error } = await supabase
        .from('evaluation_metrics')
        .insert([{
          user_id,
          period_start,
          period_end,
          department,
          position,
          overall_score,
          metrics: metrics || {}
        }])
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json(data, { status: 201 });
    }

  } catch (error) {
    console.error('Erro ao salvar métricas:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// PUT - Atualizar métrica específica
export async function PUT(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const body = await request.json();
    const { metricId, updates } = body;

    if (!metricId || !updates) {
      return NextResponse.json(
        { error: 'Dados inválidos' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('evaluation_metrics')
      .update({
        ...updates,
        calculated_at: new Date().toISOString()
      })
      .eq('id', metricId)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);

  } catch (error) {
    console.error('Erro ao atualizar métrica:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// DELETE - Deletar métrica
export async function DELETE(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const metricId = searchParams.get('metricId');

    if (!metricId) {
      return NextResponse.json(
        { error: 'ID da métrica é obrigatório' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('evaluation_metrics')
      .delete()
      .eq('id', metricId);

    if (error) throw error;
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Erro ao deletar métrica:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
