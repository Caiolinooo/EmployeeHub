import { NextRequest, NextResponse } from 'next/server';
import { AdvancedPDFGenerator } from '@/lib/advanced-pdf-generator';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// Função para obter o cliente Supabase de forma lazy
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials are not configured');
  }

  return createClient(supabaseUrl, supabaseKey);
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

// POST - Gerar relatório PDF
export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const body = await request.json();
    const { reportType, parameters } = body;

    if (!reportType) {
      return NextResponse.json(
        { error: 'Tipo de relatório é obrigatório' },
        { status: 400 }
      );
    }

    let reportData;

    switch (reportType) {
      case 'individual':
        reportData = await generateIndividualReport(parameters, user.id);
        break;
      case 'departmental':
        reportData = await generateDepartmentalReport(parameters, user.id);
        break;
      case 'executive':
        reportData = await generateExecutiveReport(parameters, user.id);
        break;
      case 'custom':
        reportData = parameters.reportData;
        break;
      default:
        return NextResponse.json(
          { error: 'Tipo de relatório não suportado' },
          { status: 400 }
        );
    }

    const pdfGenerator = AdvancedPDFGenerator.getInstance();
    const filePath = await pdfGenerator.generatePDF(reportData, user.id);

    return NextResponse.json({
      success: true,
      filePath,
      reportId: reportData.id || crypto.randomUUID()
    });

  } catch (error) {
    console.error('Erro ao gerar relatório:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// Gerar relatório individual
async function generateIndividualReport(parameters: any, userId: string) {
  const { targetUserId, periodStart, periodEnd } = parameters;

  const supabase = getSupabaseClient();

  // Buscar dados do usuário
  const { data: user } = await supabase
    .from('users_unified')
    .select('name, department, position, email')
    .eq('id', targetUserId || userId)
    .single();

  // Buscar métricas de avaliação
  const { data: metrics } = await supabase
    .from('evaluation_metrics')
    .select('*')
    .eq('user_id', targetUserId || userId)
    .gte('period_start', periodStart)
    .lte('period_end', periodEnd);

  // Buscar dados de reembolsos
  const { data: reimbursements } = await supabase
    .from('reimbursements')
    .select('*')
    .eq('user_id', targetUserId || userId)
    .gte('created_at', periodStart)
    .lte('created_at', periodEnd);

  const avgScore = metrics?.reduce((sum: number, m: any) => sum + (m.overall_score || 0), 0) / (metrics?.length || 1);
  const totalReimbursements = reimbursements?.reduce((sum: number, r: any) => sum + (r.amount || 0), 0) || 0;

  return {
    title: 'Relatório de Performance Individual',
    subtitle: `Análise detalhada de desempenho - ${user?.name || 'N/A'}`,
    period: { start: periodStart, end: periodEnd },
    user: {
      name: user?.name || 'N/A',
      department: user?.department || 'N/A',
      position: user?.position || 'N/A'
    },
    metrics: {
      'Pontuação Média': avgScore.toFixed(2),
      'Avaliações': metrics?.length || 0,
      'Reembolsos': reimbursements?.length || 0,
      'Total Reembolsado': `R$ ${totalReimbursements.toFixed(2)}`
    },
    charts: [
      {
        type: 'line' as const,
        title: 'Evolução da Performance',
        data: {
          labels: metrics?.map(m => new Date(m.period_start).toLocaleDateString('pt-BR')) || [],
          datasets: [{
            label: 'Pontuação',
            data: metrics?.map(m => m.overall_score || 0) || [],
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37, 99, 235, 0.1)'
          }]
        }
      },
      {
        type: 'bar' as const,
        title: 'Reembolsos por Mês',
        data: {
          labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'],
          datasets: [{
            label: 'Valor (R$)',
            data: [1200, 800, 1500, 900, 1100, 1300],
            backgroundColor: '#10b981'
          }]
        }
      }
    ],
    tables: [
      {
        title: 'Histórico de Avaliações',
        headers: ['Período', 'Pontuação', 'Departamento'],
        rows: metrics?.map(m => [
          `${new Date(m.period_start).toLocaleDateString('pt-BR')} - ${new Date(m.period_end).toLocaleDateString('pt-BR')}`,
          m.overall_score?.toFixed(2) || '0.00',
          m.department || 'N/A'
        ]) || []
      },
      {
        title: 'Reembolsos Recentes',
        headers: ['Data', 'Descrição', 'Valor', 'Status'],
        rows: reimbursements?.slice(0, 10).map(r => [
          new Date(r.created_at).toLocaleDateString('pt-BR'),
          r.description || 'N/A',
          `R$ ${(r.amount || 0).toFixed(2)}`,
          r.status || 'N/A'
        ]) || []
      }
    ]
  };
}

// Gerar relatório departamental
async function generateDepartmentalReport(parameters: any, userId: string) {
  const { department, periodStart, periodEnd } = parameters;

  const supabase = getSupabaseClient();

  // Buscar dados do departamento
  const { data: metrics } = await supabase
    .from('evaluation_metrics')
    .select('*, users_unified(name)')
    .eq('department', department)
    .gte('period_start', periodStart)
    .lte('period_end', periodEnd);

  const avgScore = metrics?.reduce((sum: number, m: any) => sum + (m.overall_score || 0), 0) / (metrics?.length || 1);
  const employeeCount = new Set(metrics?.map(m => m.user_id)).size;

  return {
    title: 'Relatório Departamental',
    subtitle: `Análise de performance - ${department}`,
    period: { start: periodStart, end: periodEnd },
    metrics: {
      'Pontuação Média': avgScore.toFixed(2),
      'Funcionários': employeeCount,
      'Avaliações': metrics?.length || 0,
      'Departamento': department
    },
    charts: [
      {
        type: 'bar' as const,
        title: 'Performance por Funcionário',
        data: {
          labels: metrics?.slice(0, 10).map(m => m.users_unified?.name || 'N/A') || [],
          datasets: [{
            label: 'Pontuação',
            data: metrics?.slice(0, 10).map(m => m.overall_score || 0) || [],
            backgroundColor: '#2563eb'
          }]
        }
      },
      {
        type: 'pie' as const,
        title: 'Distribuição de Performance',
        data: {
          labels: ['Excelente (>8.0)', 'Bom (6.0-8.0)', 'Regular (4.0-6.0)', 'Baixo (<4.0)'],
          datasets: [{
            label: 'Funcionários',
            data: [
              metrics?.filter(m => (m.overall_score || 0) > 8).length || 0,
              metrics?.filter(m => (m.overall_score || 0) >= 6 && (m.overall_score || 0) <= 8).length || 0,
              metrics?.filter(m => (m.overall_score || 0) >= 4 && (m.overall_score || 0) < 6).length || 0,
              metrics?.filter(m => (m.overall_score || 0) < 4).length || 0
            ],
            backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444']
          }]
        }
      }
    ],
    tables: [
      {
        title: 'Ranking Departamental',
        headers: ['Funcionário', 'Pontuação Média', 'Avaliações'],
        rows: metrics?.map(m => [
          m.users_unified?.name || 'N/A',
          m.overall_score?.toFixed(2) || '0.00',
          '1'
        ]) || []
      }
    ]
  };
}

// Gerar relatório executivo
async function generateExecutiveReport(parameters: any, userId: string) {
  const { periodStart, periodEnd } = parameters;

  const supabase = getSupabaseClient();

  // Buscar dados gerais
  const { data: allMetrics } = await supabase
    .from('evaluation_metrics')
    .select('*, users_unified(name, department)')
    .gte('period_start', periodStart)
    .lte('period_end', periodEnd);

  const { data: allReimbursements } = await supabase
    .from('reimbursements')
    .select('*')
    .gte('created_at', periodStart)
    .lte('created_at', periodEnd);

  const avgScore = allMetrics?.reduce((sum: number, m: any) => sum + (m.overall_score || 0), 0) / (allMetrics?.length || 1);
  const totalEmployees = new Set(allMetrics?.map((m: any) => m.user_id)).size;
  const totalReimbursements = allReimbursements?.reduce((sum: number, r: any) => sum + (r.amount || 0), 0) || 0;

  // Agrupar por departamento
  const departmentStats = allMetrics?.reduce((acc: any, metric: any) => {
    const dept = metric.users_unified?.department || 'N/A';
    if (!acc[dept]) {
      acc[dept] = { count: 0, totalScore: 0 };
    }
    acc[dept].count++;
    acc[dept].totalScore += metric.overall_score || 0;
    return acc;
  }, {} as Record<string, { count: number; totalScore: number }>);

  return {
    title: 'Relatório Executivo',
    subtitle: 'Visão geral da organização',
    period: { start: periodStart, end: periodEnd },
    metrics: {
      'Pontuação Geral': avgScore.toFixed(2),
      'Total de Funcionários': totalEmployees,
      'Total de Avaliações': allMetrics?.length || 0,
      'Total Reembolsado': `R$ ${totalReimbursements.toFixed(2)}`
    },
    charts: [
      {
        type: 'bar' as const,
        title: 'Performance por Departamento',
        data: {
          labels: Object.keys(departmentStats || {}),
          datasets: [{
            label: 'Pontuação Média',
            data: Object.values(departmentStats || {}).map((d: any) => d.totalScore / d.count),
            backgroundColor: '#2563eb'
          }]
        }
      }
    ],
    tables: [
      {
        title: 'Resumo por Departamento',
        headers: ['Departamento', 'Funcionários', 'Pontuação Média'],
        rows: Object.entries(departmentStats || {}).map(([dept, stats]: [string, any]) => [
          dept,
          stats.count.toString(),
          (stats.totalScore / stats.count).toFixed(2)
        ])
      }
    ]
  };
}
