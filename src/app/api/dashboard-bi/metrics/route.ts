import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyTokenFromRequest } from '@/lib/auth';
import { BIMetrics, WidgetMetric, PerformanceMetric, EngagementMetric } from '@/types/dashboard-bi';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação
    const authResult = await verifyTokenFromRequest(request);
    if (!authResult.valid || !authResult.payload) {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 });
    }

    // Verificar permissões
    const { data: user } = await supabase
      .from('users_unified')
      .select('role, access_permissions')
      .eq('id', authResult.payload.userId)
      .single();

    if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
      return NextResponse.json({
        success: false,
        error: 'Sem permissão para visualizar métricas BI'
      }, { status: 403 });
    }

    const url = new URL(request.url);
    const dashboardId = url.searchParams.get('dashboardId');
    const period = url.searchParams.get('period') || '30d'; // 7d, 30d, 90d, 1y
    const metric = url.searchParams.get('metric'); // views, engagement, performance

    // Calcular período de tempo
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(endDate.getDate() - 30);
    }

    let metrics: BIMetrics[] = [];

    if (dashboardId) {
      // Métricas para dashboard específico
      const dashboardMetrics = await calculateDashboardMetrics(dashboardId, startDate, endDate);
      metrics = [dashboardMetrics];
    } else {
      // Métricas para todos os dashboards do usuário
      const { data: dashboards } = await supabase
        .from('bi_dashboards')
        .select('id')
        .or(`created_by.eq.${authResult.payload.userId},is_public.eq.true`)
        .eq('is_active', true);

      if (dashboards) {
        for (const dashboard of dashboards) {
          const dashboardMetrics = await calculateDashboardMetrics(dashboard.id, startDate, endDate);
          metrics.push(dashboardMetrics);
        }
      }
    }

    // Filtrar por tipo de métrica se especificado
    if (metric) {
      metrics = metrics.map(m => filterMetricsByType(m, metric));
    }

    return NextResponse.json({
      success: true,
      metrics,
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        period
      }
    });

  } catch (error) {
    console.error('Erro ao buscar métricas BI:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
}

async function calculateDashboardMetrics(
  dashboardId: string, 
  startDate: Date, 
  endDate: Date
): Promise<BIMetrics> {
  try {
    // Buscar visualizações do dashboard
    const { data: views } = await supabase
      .from('bi_dashboard_views')
      .select('*')
      .eq('dashboard_id', dashboardId)
      .gte('viewed_at', startDate.toISOString())
      .lte('viewed_at', endDate.toISOString());

    // Buscar interações com widgets
    const { data: interactions } = await supabase
      .from('bi_widget_interactions')
      .select('*')
      .eq('dashboard_id', dashboardId)
      .gte('timestamp', startDate.toISOString())
      .lte('timestamp', endDate.toISOString());

    // Buscar dados de performance
    const { data: performance } = await supabase
      .from('bi_performance_logs')
      .select('*')
      .eq('dashboard_id', dashboardId)
      .gte('timestamp', startDate.toISOString())
      .lte('timestamp', endDate.toISOString());

    // Calcular métricas básicas
    const totalViews = views?.length || 0;
    const uniqueUsers = new Set(views?.map(v => v.user_id)).size;
    
    // Calcular duração média da sessão
    const sessions = groupViewsBySession(views || []);
    const avgSessionDuration = calculateAverageSessionDuration(sessions);
    
    // Calcular bounce rate (sessões com apenas 1 visualização)
    const singleViewSessions = sessions.filter(s => s.views.length === 1).length;
    const bounceRate = sessions.length > 0 ? (singleViewSessions / sessions.length) * 100 : 0;

    // Calcular métricas de widgets mais visualizados
    const mostViewedWidgets = calculateWidgetMetrics(interactions || []);

    // Calcular métricas de performance
    const performanceMetrics = calculatePerformanceMetrics(performance || []);

    // Calcular métricas de engajamento
    const userEngagement = calculateEngagementMetrics(views || [], interactions || []);

    // Calcular taxa de erro
    const errorRate = calculateErrorRate(performance || []);

    return {
      dashboardId,
      totalViews,
      uniqueUsers,
      avgSessionDuration,
      bounceRate,
      mostViewedWidgets,
      performanceMetrics,
      userEngagement,
      errorRate,
      lastCalculated: new Date().toISOString()
    };

  } catch (error) {
    console.error('Erro ao calcular métricas do dashboard:', error);
    return {
      dashboardId,
      totalViews: 0,
      uniqueUsers: 0,
      avgSessionDuration: 0,
      bounceRate: 0,
      mostViewedWidgets: [],
      performanceMetrics: [],
      userEngagement: [],
      errorRate: 0,
      lastCalculated: new Date().toISOString()
    };
  }
}

function groupViewsBySession(views: any[]): any[] {
  const sessions = new Map();
  
  views.forEach(view => {
    const sessionKey = `${view.user_id}-${view.session_id}`;
    if (!sessions.has(sessionKey)) {
      sessions.set(sessionKey, {
        userId: view.user_id,
        sessionId: view.session_id,
        views: []
      });
    }
    sessions.get(sessionKey).views.push(view);
  });

  return Array.from(sessions.values());
}

function calculateAverageSessionDuration(sessions: any[]): number {
  if (sessions.length === 0) return 0;

  const durations = sessions.map(session => {
    const views = session.views.sort((a: any, b: any) => 
      new Date(a.viewed_at).getTime() - new Date(b.viewed_at).getTime()
    );
    
    if (views.length < 2) return 0;
    
    const start = new Date(views[0].viewed_at).getTime();
    const end = new Date(views[views.length - 1].viewed_at).getTime();
    return (end - start) / 1000; // em segundos
  });

  return durations.reduce((sum, duration) => sum + duration, 0) / durations.length;
}

function calculateWidgetMetrics(interactions: any[]): WidgetMetric[] {
  const widgetStats = new Map();

  interactions.forEach(interaction => {
    const widgetId = interaction.widget_id;
    if (!widgetStats.has(widgetId)) {
      widgetStats.set(widgetId, {
        widgetId,
        widgetTitle: interaction.widget_title || 'Widget',
        views: 0,
        interactions: 0,
        loadTimes: [],
        errorCount: 0
      });
    }

    const stats = widgetStats.get(widgetId);
    
    if (interaction.type === 'view') {
      stats.views++;
    } else {
      stats.interactions++;
    }

    if (interaction.load_time) {
      stats.loadTimes.push(interaction.load_time);
    }

    if (interaction.error) {
      stats.errorCount++;
    }
  });

  return Array.from(widgetStats.values()).map(stats => ({
    widgetId: stats.widgetId,
    widgetTitle: stats.widgetTitle,
    views: stats.views,
    interactions: stats.interactions,
    avgLoadTime: stats.loadTimes.length > 0 
      ? stats.loadTimes.reduce((sum: number, time: number) => sum + time, 0) / stats.loadTimes.length 
      : 0,
    errorCount: stats.errorCount
  })).sort((a, b) => b.views - a.views);
}

function calculatePerformanceMetrics(performance: any[]): PerformanceMetric[] {
  return performance.map(p => ({
    timestamp: p.timestamp,
    loadTime: p.load_time || 0,
    queryTime: p.query_time || 0,
    renderTime: p.render_time || 0,
    memoryUsage: p.memory_usage || 0,
    cpuUsage: p.cpu_usage || 0
  }));
}

function calculateEngagementMetrics(views: any[], interactions: any[]): EngagementMetric[] {
  const userSessions = new Map();

  // Agrupar por usuário e sessão
  views.forEach(view => {
    const key = `${view.user_id}-${view.session_id}`;
    if (!userSessions.has(key)) {
      userSessions.set(key, {
        userId: view.user_id,
        sessionId: view.session_id,
        startTime: view.viewed_at,
        endTime: view.viewed_at,
        interactions: [],
        widgets: new Set(),
        filters: new Set()
      });
    }

    const session = userSessions.get(key);
    if (new Date(view.viewed_at) < new Date(session.startTime)) {
      session.startTime = view.viewed_at;
    }
    if (new Date(view.viewed_at) > new Date(session.endTime)) {
      session.endTime = view.viewed_at;
    }
  });

  // Adicionar interações
  interactions.forEach(interaction => {
    const key = `${interaction.user_id}-${interaction.session_id}`;
    if (userSessions.has(key)) {
      const session = userSessions.get(key);
      session.interactions.push({
        timestamp: interaction.timestamp,
        type: interaction.type,
        target: interaction.target,
        duration: interaction.duration,
        metadata: interaction.metadata
      });

      if (interaction.widget_id) {
        session.widgets.add(interaction.widget_id);
      }
      if (interaction.filter_id) {
        session.filters.add(interaction.filter_id);
      }
    }
  });

  return Array.from(userSessions.values()).map(session => ({
    userId: session.userId,
    sessionId: session.sessionId,
    startTime: session.startTime,
    endTime: session.endTime,
    interactions: session.interactions,
    widgets: Array.from(session.widgets),
    filters: Array.from(session.filters)
  }));
}

function calculateErrorRate(performance: any[]): number {
  if (performance.length === 0) return 0;
  
  const errors = performance.filter(p => p.error || p.status_code >= 400).length;
  return (errors / performance.length) * 100;
}

function filterMetricsByType(metrics: BIMetrics, type: string): BIMetrics {
  switch (type) {
    case 'views':
      return {
        ...metrics,
        performanceMetrics: [],
        userEngagement: []
      };
    case 'engagement':
      return {
        ...metrics,
        performanceMetrics: [],
        mostViewedWidgets: []
      };
    case 'performance':
      return {
        ...metrics,
        userEngagement: [],
        mostViewedWidgets: []
      };
    default:
      return metrics;
  }
}
