import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verificar autenticação
    const token = extractTokenFromHeader(request.headers.get('authorization') || undefined);
    if (!token) {
      return NextResponse.json({
        success: false,
        error: 'Token não fornecido'
      }, { status: 401 });
    }

    const authResult = verifyToken(token);
    if (!authResult) {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 });
    }

    const dashboardId = params.id;

    // Buscar dashboard
    const { data: dashboard, error } = await supabase
      .from('bi_dashboards')
      .select(`
        id,
        name,
        description,
        layout,
        widgets,
        filters,
        permissions,
        is_public,
        is_template,
        created_by,
        created_at,
        updated_at,
        last_accessed,
        access_count,
        tags,
        category,
        refresh_interval,
        auto_refresh
      `)
      .eq('id', dashboardId)
      .eq('is_active', true)
      .single();

    if (error || !dashboard) {
      return NextResponse.json({
        success: false,
        error: 'Dashboard não encontrado'
      }, { status: 404 });
    }

    // Verificar permissões de acesso
    const hasAccess = dashboard.is_public ||
                     dashboard.created_by === authResult.userId ||
                     dashboard.permissions?.viewers?.includes(authResult.userId) ||
                     dashboard.permissions?.editors?.includes(authResult.userId);

    if (!hasAccess) {
      // Verificar se usuário é admin
      const { data: user } = await supabase
        .from('users_unified')
        .select('role')
        .eq('id', authResult.userId)
        .single();

      if (user?.role !== 'ADMIN') {
        return NextResponse.json({
          success: false,
          error: 'Sem permissão para acessar este dashboard'
        }, { status: 403 });
      }
    }

    // Atualizar contador de acesso e último acesso
    await supabase
      .from('bi_dashboards')
      .update({
        access_count: dashboard.access_count + 1,
        last_accessed: new Date().toISOString()
      })
      .eq('id', dashboardId);

    // Registrar visualização
    await supabase
      .from('bi_dashboard_views')
      .insert({
        dashboard_id: dashboardId,
        user_id: authResult.userId,
        viewed_at: new Date().toISOString(),
        session_id: request.headers.get('x-session-id') || 'unknown',
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent')
      });

    return NextResponse.json({
      success: true,
      dashboard
    });

  } catch (error) {
    console.error('Erro ao buscar dashboard BI:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verificar autenticação
    const token = extractTokenFromHeader(request.headers.get('authorization') || undefined);
    if (!token) {
      return NextResponse.json({
        success: false,
        error: 'Token não fornecido'
      }, { status: 401 });
    }

    const authResult = verifyToken(token);
    if (!authResult) {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 });
    }

    const dashboardId = params.id;
    const body = await request.json();
    const { action } = body;

    // Buscar dashboard existente
    const { data: dashboard, error: fetchError } = await supabase
      .from('bi_dashboards')
      .select('*')
      .eq('id', dashboardId)
      .single();

    if (fetchError || !dashboard) {
      return NextResponse.json({
        success: false,
        error: 'Dashboard não encontrado'
      }, { status: 404 });
    }

    switch (action) {
      case 'duplicate':
        return await duplicateDashboard(request, dashboard, authResult.userId);
      
      case 'export':
        return await exportDashboard(request, dashboard, body.options);
      
      case 'refresh':
        return await refreshDashboard(request, dashboard);
      
      default:
        return NextResponse.json({
          success: false,
          error: 'Ação inválida'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Erro na ação do dashboard BI:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
}

async function duplicateDashboard(request: NextRequest, originalDashboard: any, userId: string) {
  try {
    // Criar cópia do dashboard
    const { data: newDashboard, error } = await supabase
      .from('bi_dashboards')
      .insert({
        name: `${originalDashboard.name} (Cópia)`,
        description: originalDashboard.description,
        layout: originalDashboard.layout,
        widgets: originalDashboard.widgets,
        filters: originalDashboard.filters,
        permissions: {
          ...originalDashboard.permissions,
          owner: userId,
          viewers: [],
          editors: []
        },
        is_public: false,
        is_template: false,
        created_by: userId,
        tags: originalDashboard.tags,
        category: originalDashboard.category,
        refresh_interval: originalDashboard.refresh_interval,
        auto_refresh: originalDashboard.auto_refresh,
        access_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Log da ação
    await supabase
      .from('bi_audit_logs')
      .insert({
        dashboard_id: newDashboard.id,
        action: 'duplicate',
        entity_type: 'dashboard',
        entity_id: newDashboard.id,
        new_values: { originalId: originalDashboard.id },
        user_id: userId,
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent'),
        timestamp: new Date().toISOString(),
        success: true
      });

    return NextResponse.json({
      success: true,
      dashboard: newDashboard,
      message: 'Dashboard duplicado com sucesso'
    });

  } catch (error) {
    console.error('Erro ao duplicar dashboard:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro ao duplicar dashboard'
    }, { status: 500 });
  }
}

async function exportDashboard(request: NextRequest, dashboard: any, options: any) {
  try {
    // Simular exportação (em produção seria gerado o arquivo real)
    const exportData = {
      dashboard: {
        name: dashboard.name,
        description: dashboard.description,
        widgets: dashboard.widgets,
        filters: options.includeFilters ? dashboard.filters : [],
        exportedAt: new Date().toISOString(),
        format: options.format || 'json'
      }
    };

    // Log da ação
    await supabase
      .from('bi_audit_logs')
      .insert({
        dashboard_id: dashboard.id,
        action: 'export',
        entity_type: 'dashboard',
        entity_id: dashboard.id,
        new_values: { format: options.format },
        user_id: dashboard.created_by,
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent'),
        timestamp: new Date().toISOString(),
        success: true
      });

    return NextResponse.json({
      success: true,
      exportData,
      message: 'Dashboard exportado com sucesso'
    });

  } catch (error) {
    console.error('Erro ao exportar dashboard:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro ao exportar dashboard'
    }, { status: 500 });
  }
}

async function refreshDashboard(request: NextRequest, dashboard: any) {
  try {
    // Simular refresh dos dados dos widgets
    const refreshedWidgets = dashboard.widgets.map((widget: any) => ({
      ...widget,
      lastUpdated: new Date().toISOString()
    }));

    // Atualizar dashboard
    const { data: updatedDashboard, error } = await supabase
      .from('bi_dashboards')
      .update({
        widgets: refreshedWidgets,
        updated_at: new Date().toISOString()
      })
      .eq('id', dashboard.id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Log da ação
    await supabase
      .from('bi_audit_logs')
      .insert({
        dashboard_id: dashboard.id,
        action: 'refresh',
        entity_type: 'dashboard',
        entity_id: dashboard.id,
        user_id: dashboard.created_by,
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent'),
        timestamp: new Date().toISOString(),
        success: true
      });

    return NextResponse.json({
      success: true,
      dashboard: updatedDashboard,
      message: 'Dashboard atualizado com sucesso'
    });

  } catch (error) {
    console.error('Erro ao atualizar dashboard:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro ao atualizar dashboard'
    }, { status: 500 });
  }
}
