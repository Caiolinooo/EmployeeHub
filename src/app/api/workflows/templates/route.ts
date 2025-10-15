import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyTokenFromRequest, verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { WorkflowTemplate } from '@/types/workflows';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
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

    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    const industry = url.searchParams.get('industry');
    const isOfficial = url.searchParams.get('official') === 'true';
    const isPremium = url.searchParams.get('premium') === 'true';
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const search = url.searchParams.get('search');

    let query = supabase
      .from('workflow_templates')
      .select(`
        id,
        name,
        description,
        category,
        industry,
        tags,
        thumbnail,
        workflow,
        rating,
        downloads,
        created_by,
        created_at,
        is_official,
        is_premium,
        documentation
      `)
      .order('rating', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filtrar por categoria se especificado
    if (category) {
      query = query.eq('category', category);
    }

    // Filtrar por indústria se especificado
    if (industry) {
      query = query.contains('industry', [industry]);
    }

    // Filtrar por templates oficiais se especificado
    if (isOfficial) {
      query = query.eq('is_official', true);
    }

    // Filtrar por templates premium se especificado
    if (isPremium) {
      query = query.eq('is_premium', true);
    }

    // Busca por texto se especificado
    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%,tags.cs.{${search}}`);
    }

    const { data: templates, error } = await query;

    if (error) {
      console.error('Erro ao buscar templates:', error);
      return NextResponse.json({
        success: false,
        error: 'Erro ao buscar templates'
      }, { status: 500 });
    }

    // Buscar informações dos criadores
    const creatorIds = [...new Set(templates?.map(t => t.created_by) || [])];
    const { data: creators } = await supabase
      .from('users_unified')
      .select('id, name, email')
      .in('id', creatorIds);

    const creatorMap = creators?.reduce((acc: any, c: any) => {
      acc[c.id] = c;
      return acc;
    }, {}) || {};

    // Enriquecer templates com dados do criador
    const enrichedTemplates = templates?.map(template => ({
      ...template,
      creatorName: creatorMap[template.created_by]?.name || 'Usuário',
      creatorEmail: creatorMap[template.created_by]?.email
    })) || [];

    return NextResponse.json({
      success: true,
      templates: enrichedTemplates
    });

  } catch (error) {
    console.error('Erro na API de templates:', error);
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
        error: 'Sem permissão para criar templates'
      }, { status: 403 });
    }

    const body = await request.json();
    const {
      name,
      description,
      category,
      industry = [],
      tags = [],
      thumbnail,
      workflow,
      documentation,
      examples = [],
      isOfficial = false,
      isPremium = false
    } = body;

    // Validar campos obrigatórios
    if (!name || !description || !category || !workflow) {
      return NextResponse.json({
        success: false,
        error: 'Nome, descrição, categoria e workflow são obrigatórios'
      }, { status: 400 });
    }

    // Apenas admins podem criar templates oficiais
    const finalIsOfficial = user.role === 'ADMIN' ? isOfficial : false;

    // Criar template
    const { data: template, error } = await supabase
      .from('workflow_templates')
      .insert({
        name,
        description,
        category,
        industry,
        tags,
        thumbnail,
        workflow,
        rating: 0,
        downloads: 0,
        created_by: authResult.payload.userId,
        is_official: finalIsOfficial,
        is_premium: isPremium,
        documentation,
        examples,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar template:', error);
      return NextResponse.json({
        success: false,
        error: 'Erro ao criar template'
      }, { status: 500 });
    }

    // Log da ação
    await supabase
      .from('workflow_audit_logs')
      .insert({
        workflow_id: null,
        action: 'create_template',
        entity_type: 'template',
        entity_id: template.id,
        new_values: { name, category, isOfficial: finalIsOfficial },
        user_id: authResult.payload.userId,
        user_email: user.email,
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent'),
        timestamp: new Date().toISOString(),
        success: true
      });

    return NextResponse.json({
      success: true,
      template
    });

  } catch (error) {
    console.error('Erro ao criar template:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
}

// Endpoint para usar um template (criar workflow a partir do template)
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
    const { templateId, workflowName, workflowDescription, variables = {} } = body;

    if (!templateId) {
      return NextResponse.json({
        success: false,
        error: 'ID do template é obrigatório'
      }, { status: 400 });
    }

    // Buscar template
    const { data: template, error: templateError } = await supabase
      .from('workflow_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (templateError || !template) {
      return NextResponse.json({
        success: false,
        error: 'Template não encontrado'
      }, { status: 404 });
    }

    // Verificar se usuário pode criar workflows
    const { data: user } = await supabase
      .from('users_unified')
      .select('role, email')
      .eq('id', authResult.payload.userId)
      .single();

    if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
      return NextResponse.json({
        success: false,
        error: 'Sem permissão para criar workflows'
      }, { status: 403 });
    }

    // Preparar dados do workflow baseado no template
    const workflowData = {
      ...template.workflow,
      name: workflowName || `${template.name} - Workflow`,
      description: workflowDescription || template.description,
      status: 'draft',
      created_by: authResult.payload.userId,
      template_id: templateId,
      is_template: false,
      permissions: {
        owner: authResult.payload.userId,
        viewers: [],
        editors: [],
        executors: [],
        roles: {},
        departments: {},
        isPublic: false
      },
      statistics: {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        averageExecutionTime: 0,
        executionHistory: []
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Aplicar variáveis personalizadas se fornecidas
    if (Object.keys(variables).length > 0) {
      workflowData.variables = workflowData.variables?.map((v: any) => ({
        ...v,
        value: variables[v.name] !== undefined ? variables[v.name] : v.defaultValue
      })) || [];
    }

    // Criar workflow
    const { data: workflow, error: workflowError } = await supabase
      .from('workflows')
      .insert(workflowData)
      .select()
      .single();

    if (workflowError) {
      console.error('Erro ao criar workflow do template:', workflowError);
      return NextResponse.json({
        success: false,
        error: 'Erro ao criar workflow do template'
      }, { status: 500 });
    }

    // Incrementar contador de downloads do template
    await supabase
      .from('workflow_templates')
      .update({
        downloads: template.downloads + 1
      })
      .eq('id', templateId);

    // Log da ação
    await supabase
      .from('workflow_audit_logs')
      .insert({
        workflow_id: workflow.id,
        action: 'create_from_template',
        entity_type: 'workflow',
        entity_id: workflow.id,
        new_values: { 
          templateId,
          templateName: template.name,
          workflowName: workflow.name
        },
        user_id: authResult.payload.userId,
        user_email: user.email,
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent'),
        timestamp: new Date().toISOString(),
        success: true
      });

    return NextResponse.json({
      success: true,
      workflow,
      message: 'Workflow criado a partir do template com sucesso'
    });

  } catch (error) {
    console.error('Erro ao usar template:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
}
