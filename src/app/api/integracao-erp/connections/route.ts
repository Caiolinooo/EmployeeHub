import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyTokenFromRequest } from '@/lib/auth';
import { ERPConnection, ERPConfig } from '@/types/integracao-erp';

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
      .select('role, access_permissions, email')
      .eq('id', authResult.payload.userId)
      .single();

    if (!user || (user.role !== 'ADMIN' && !user.access_permissions?.['erp.view'])) {
      return NextResponse.json({
        success: false,
        error: 'Sem permissão para visualizar conexões ERP'
      }, { status: 403 });
    }

    // Buscar conexões ERP
    const { data: connections, error } = await supabase
      .from('erp_connections')
      .select(`
        id,
        name,
        type,
        status,
        host,
        port,
        database_name,
        username,
        last_sync,
        last_error,
        sync_frequency,
        is_active,
        created_at,
        updated_at,
        config
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar conexões ERP:', error);
      return NextResponse.json({
        success: false,
        error: 'Erro ao buscar conexões ERP'
      }, { status: 500 });
    }

    // Remover informações sensíveis
    const safeConnections = connections?.map(conn => ({
      ...conn,
      password: undefined,
      apiKey: undefined,
      apiSecret: undefined,
      connectionString: undefined
    })) || [];

    return NextResponse.json({
      success: true,
      connections: safeConnections
    });

  } catch (error) {
    console.error('Erro na API de conexões ERP:', error);
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

    if (!user || (user.role !== 'ADMIN' && !user.access_permissions?.['erp.manage'])) {
      return NextResponse.json({
        success: false,
        error: 'Sem permissão para gerenciar conexões ERP'
      }, { status: 403 });
    }

    const body = await request.json();
    const {
      name,
      type,
      host,
      port,
      database,
      username,
      password,
      apiKey,
      apiSecret,
      connectionString,
      syncFrequency,
      config
    } = body;

    // Validar campos obrigatórios
    if (!name || !type || !host || !username) {
      return NextResponse.json({
        success: false,
        error: 'Campos obrigatórios: name, type, host, username'
      }, { status: 400 });
    }

    // Simular criptografia (em produção usar bcrypt ou similar)
    let hashedPassword = password ? `encrypted_${password}` : null;
    let hashedApiKey = apiKey ? `encrypted_${apiKey}` : null;
    let hashedApiSecret = apiSecret ? `encrypted_${apiSecret}` : null;

    // Configuração padrão
    const defaultConfig: ERPConfig = {
      modules: {
        funcionarios: true,
        folhaPagamento: true,
        contabilidade: false,
        compras: false,
        vendas: false,
        estoque: false,
        financeiro: false
      },
      mappings: {
        funcionarios: [
          { localField: 'name', erpField: 'nome', dataType: 'string', required: true },
          { localField: 'email', erpField: 'email', dataType: 'string', required: true },
          { localField: 'cpf', erpField: 'cpf', dataType: 'string', required: true },
          { localField: 'department', erpField: 'departamento', dataType: 'string', required: false },
          { localField: 'position', erpField: 'cargo', dataType: 'string', required: false }
        ],
        folhaPagamento: [
          { localField: 'employeeCode', erpField: 'codigo_funcionario', dataType: 'string', required: true },
          { localField: 'grossSalary', erpField: 'salario_bruto', dataType: 'decimal', required: true },
          { localField: 'netSalary', erpField: 'salario_liquido', dataType: 'decimal', required: true }
        ],
        departamentos: [],
        centrosCusto: []
      },
      filters: {
        funcionarios: [
          { field: 'ativo', operator: 'equals', value: true }
        ]
      },
      transformations: {
        dateFormat: 'YYYY-MM-DD',
        currencyFormat: 'BRL',
        encoding: 'UTF-8',
        timezone: 'America/Sao_Paulo'
      },
      authentication: {
        type: password ? 'basic' : apiKey ? 'apikey' : 'basic'
      },
      ...config
    };

    // Criar conexão
    const { data: connection, error } = await supabase
      .from('erp_connections')
      .insert({
        name,
        type,
        status: 'disconnected',
        host,
        port,
        database_name: database,
        username,
        password_hash: hashedPassword,
        api_key_hash: hashedApiKey,
        api_secret_hash: hashedApiSecret,
        connection_string: connectionString,
        sync_frequency: syncFrequency || 60,
        is_active: true,
        config: defaultConfig,
        created_by: authResult.payload.userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar conexão ERP:', error);
      return NextResponse.json({
        success: false,
        error: 'Erro ao criar conexão ERP'
      }, { status: 500 });
    }

    // Log da ação
    await supabase
      .from('erp_audit_logs')
      .insert({
        connection_id: connection.id,
        action: 'create',
        entity_type: 'connection',
        entity_id: connection.id,
        new_values: { name, type, host, username },
        user_id: authResult.payload.userId,
        user_email: user.email,
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent'),
        timestamp: new Date().toISOString(),
        success: true
      });

    return NextResponse.json({
      success: true,
      connection: {
        ...connection,
        password_hash: undefined,
        api_key_hash: undefined,
        api_secret_hash: undefined
      }
    });

  } catch (error) {
    console.error('Erro ao criar conexão ERP:', error);
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

    // Verificar permissões
    const { data: user } = await supabase
      .from('users_unified')
      .select('role, access_permissions, email')
      .eq('id', authResult.payload.userId)
      .single();

    if (!user || (user.role !== 'ADMIN' && !user.access_permissions?.['erp.manage'])) {
      return NextResponse.json({
        success: false,
        error: 'Sem permissão para gerenciar conexões ERP'
      }, { status: 403 });
    }

    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'ID da conexão é obrigatório'
      }, { status: 400 });
    }

    // Buscar conexão existente
    const { data: existingConnection, error: fetchError } = await supabase
      .from('erp_connections')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existingConnection) {
      return NextResponse.json({
        success: false,
        error: 'Conexão não encontrada'
      }, { status: 404 });
    }

    // Preparar dados para atualização
    const updateFields: any = {
      ...updateData,
      updated_at: new Date().toISOString()
    };

    // Simular criptografia para atualização
    if (updateData.password) {
      updateFields.password_hash = `encrypted_${updateData.password}`;
      delete updateFields.password;
    }

    if (updateData.apiKey) {
      updateFields.api_key_hash = `encrypted_${updateData.apiKey}`;
      delete updateFields.apiKey;
    }

    if (updateData.apiSecret) {
      updateFields.api_secret_hash = `encrypted_${updateData.apiSecret}`;
      delete updateFields.apiSecret;
    }

    // Atualizar conexão
    const { data: updatedConnection, error: updateError } = await supabase
      .from('erp_connections')
      .update(updateFields)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Erro ao atualizar conexão ERP:', updateError);
      return NextResponse.json({
        success: false,
        error: 'Erro ao atualizar conexão ERP'
      }, { status: 500 });
    }

    // Log da ação
    await supabase
      .from('erp_audit_logs')
      .insert({
        connection_id: id,
        action: 'update',
        entity_type: 'connection',
        entity_id: id,
        old_values: existingConnection,
        new_values: updateFields,
        user_id: authResult.payload.userId,
        user_email: user.email,
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent'),
        timestamp: new Date().toISOString(),
        success: true
      });

    return NextResponse.json({
      success: true,
      connection: {
        ...updatedConnection,
        password_hash: undefined,
        api_key_hash: undefined,
        api_secret_hash: undefined
      }
    });

  } catch (error) {
    console.error('Erro ao atualizar conexão ERP:', error);
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

    // Verificar permissões
    const { data: user } = await supabase
      .from('users_unified')
      .select('role, access_permissions, email')
      .eq('id', authResult.payload.userId)
      .single();

    if (!user || (user.role !== 'ADMIN' && !user.access_permissions?.['erp.manage'])) {
      return NextResponse.json({
        success: false,
        error: 'Sem permissão para gerenciar conexões ERP'
      }, { status: 403 });
    }

    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'ID da conexão é obrigatório'
      }, { status: 400 });
    }

    // Buscar conexão existente
    const { data: existingConnection, error: fetchError } = await supabase
      .from('erp_connections')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existingConnection) {
      return NextResponse.json({
        success: false,
        error: 'Conexão não encontrada'
      }, { status: 404 });
    }

    // Soft delete - marcar como inativa
    const { error: deleteError } = await supabase
      .from('erp_connections')
      .update({
        is_active: false,
        status: 'disconnected',
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (deleteError) {
      console.error('Erro ao deletar conexão ERP:', deleteError);
      return NextResponse.json({
        success: false,
        error: 'Erro ao deletar conexão ERP'
      }, { status: 500 });
    }

    // Log da ação
    await supabase
      .from('erp_audit_logs')
      .insert({
        connection_id: id,
        action: 'delete',
        entity_type: 'connection',
        entity_id: id,
        old_values: existingConnection,
        user_id: authResult.payload.userId,
        user_email: user.email,
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent'),
        timestamp: new Date().toISOString(),
        success: true
      });

    return NextResponse.json({
      success: true,
      message: 'Conexão ERP removida com sucesso'
    });

  } catch (error) {
    console.error('Erro ao deletar conexão ERP:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
}
