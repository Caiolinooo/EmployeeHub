import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyTokenFromRequest } from '@/lib/auth';
import { BIDashboard, DashboardLayout, DashboardPermissions } from '@/types/dashboard-bi';

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
        error: 'Sem permissão para visualizar dashboards BI'
      }, { status: 403 });
    }

    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    const isPublic = url.searchParams.get('public') === 'true';
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    let query = supabase
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
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filtrar por categoria se especificado
    if (category) {
      query = query.eq('category', category);
    }

    // Filtrar por dashboards públicos ou do usuário
    if (isPublic) {
      query = query.eq('is_public', true);
    } else {
      query = query.or(`created_by.eq.${authResult.payload.userId},is_public.eq.true`);
    }

    const { data: dashboards, error } = await query;

    if (error) {
      console.error('Erro ao buscar dashboards BI:', error);
      return NextResponse.json({
        success: false,
        error: 'Erro ao buscar dashboards BI'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      dashboards: dashboards || []
    });

  } catch (error) {
    console.error('Erro na API de dashboards BI:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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
      .select('role, access_permissions, email')
      .eq('id', authResult.payload.userId)
      .single();

    if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
      return NextResponse.json({
        success: false,
        error: 'Sem permissão para criar dashboards BI'
      }, { status: 403 });
    }

    const body = await request.json();
    const {
      name,
      description,
      layout,
      widgets = [],
      filters = [],
      permissions,
      isPublic = false,
      isTemplate = false,
      tags = [],
      category = 'custom',
      refreshInterval,
      autoRefresh = false
    } = body;

    // Validar campos obrigatórios
    if (!name) {
      return NextResponse.json({
        success: false,
        error: 'Nome do dashboard é obrigatório'
      }, { status: 400 });
    }

    // Layout padrão se não fornecido
    const defaultLayout: DashboardLayout = {
      type: 'grid',
      columns: 12,
      rows: 8,
      gap: 16,
      responsive: true,
      breakpoints: {
        mobile: 768,
        tablet: 1024,
        desktop: 1200
      },
      ...layout
    };

    // Permissões padrão se não fornecidas
    const defaultPermissions: DashboardPermissions = {
      owner: authResult.payload.userId,
      viewers: [],
      editors: [],
      public: isPublic,
      roles: {},
      departments: {},
      ...permissions
    };

    // Criar dashboard
    const { data: dashboard, error } = await supabase
      .from('bi_dashboards')
      .insert({
        name,
        description,
        layout: defaultLayout,
        widgets,
        filters,
        permissions: defaultPermissions,
        is_public: isPublic,
        is_template: isTemplate,
        created_by: authResult.payload.userId,
        tags,
        category,
        refresh_interval: refreshInterval,
        auto_refresh: autoRefresh,
        access_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar dashboard BI:', error);
      return NextResponse.json({
        success: false,
        error: 'Erro ao criar dashboard BI'
      }, { status: 500 });
    }

    // Log da ação
    await supabase
      .from('bi_audit_logs')
      .insert({
        dashboard_id: dashboard.id,
        action: 'create',
        entity_type: 'dashboard',
        entity_id: dashboard.id,
        new_values: { name, category, isPublic },
        user_id: authResult.payload.userId,
        user_email: user.email,
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent'),
        timestamp: new Date().toISOString(),
        success: true
      });

    return NextResponse.json({
      success: true,
      dashboard
    });

  } catch (error) {
    console.error('Erro ao criar dashboard BI:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Verificar autenticação
    const authResult = await verifyTokenFromRequest(request);
    if (!authResult.valid || !authResult.payload) {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 });
    }

    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'ID do dashboard é obrigatório'
      }, { status: 400 });
    }

    // Buscar dashboard existente
    const { data: existingDashboard, error: fetchError } = await supabase
      .from('bi_dashboards')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existingDashboard) {
      return NextResponse.json({
        success: false,
        error: 'Dashboard não encontrado'
      }, { status: 404 });
    }

    // Verificar permissões (owner ou admin)
    const { data: user } = await supabase
      .from('users_unified')
      .select('role, email')
      .eq('id', authResult.payload.userId)
      .single();

    if (existingDashboard.created_by !== authResult.payload.userId && user?.role !== 'ADMIN') {
      return NextResponse.json({
        success: false,
        error: 'Sem permissão para editar este dashboard'
      }, { status: 403 });
    }

    // Atualizar dashboard
    const { data: updatedDashboard, error: updateError } = await supabase
      .from('bi_dashboards')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Erro ao atualizar dashboard BI:', updateError);
      return NextResponse.json({
        success: false,
        error: 'Erro ao atualizar dashboard BI'
      }, { status: 500 });
    }

    // Log da ação
    await supabase
      .from('bi_audit_logs')
      .insert({
        dashboard_id: id,
        action: 'update',
        entity_type: 'dashboard',
        entity_id: id,
        old_values: existingDashboard,
        new_values: updateData,
        user_id: authResult.payload.userId,
        user_email: user?.email,
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent'),
        timestamp: new Date().toISOString(),
        success: true
      });

    return NextResponse.json({
      success: true,
      dashboard: updatedDashboard
    });

  } catch (error) {
    console.error('Erro ao atualizar dashboard BI:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Verificar autenticação
    const authResult = await verifyTokenFromRequest(request);
    if (!authResult.valid || !authResult.payload) {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 });
    }

    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'ID do dashboard é obrigatório'
      }, { status: 400 });
    }

    // Buscar dashboard existente
    const { data: existingDashboard, error: fetchError } = await supabase
      .from('bi_dashboards')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existingDashboard) {
      return NextResponse.json({
        success: false,
        error: 'Dashboard não encontrado'
      }, { status: 404 });
    }

    // Verificar permissões (owner ou admin)
    const { data: user } = await supabase
      .from('users_unified')
      .select('role, email')
      .eq('id', authResult.payload.userId)
      .single();

    if (existingDashboard.created_by !== authResult.payload.userId && user?.role !== 'ADMIN') {
      return NextResponse.json({
        success: false,
        error: 'Sem permissão para excluir este dashboard'
      }, { status: 403 });
    }

    // Soft delete - marcar como inativo
    const { error: deleteError } = await supabase
      .from('bi_dashboards')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (deleteError) {
      console.error('Erro ao deletar dashboard BI:', deleteError);
      return NextResponse.json({
        success: false,
        error: 'Erro ao deletar dashboard BI'
      }, { status: 500 });
    }

    // Log da ação
    await supabase
      .from('bi_audit_logs')
      .insert({
        dashboard_id: id,
        action: 'delete',
        entity_type: 'dashboard',
        entity_id: id,
        old_values: existingDashboard,
        user_id: authResult.payload.userId,
        user_email: user?.email,
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent'),
        timestamp: new Date().toISOString(),
        success: true
      });

    return NextResponse.json({
      success: true,
      message: 'Dashboard BI removido com sucesso'
    });

  } catch (error) {
    console.error('Erro ao deletar dashboard BI:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
}
