import { NextRequest, NextResponse } from 'next/server';
import ERPIntegrationManager from '@/lib/erp-integration';
import { createClient } from '@supabase/supabase-js';

// Função para obter o cliente Supabase de forma lazy
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials are not configured');
  }

  return createClient(supabaseUrl, supabaseKey);
}

// Verificar se o usuário é admin
async function verifyAdmin(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return null;

    const token = authHeader.replace('Bearer ', '');
    const supabase = getSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) return null;

    // Verificar se é admin
    const { data: userData } = await supabase
      .from('users_unified')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userData?.role !== 'ADMIN') return null;

    return user;
  } catch (error) {
    return null;
  }
}

// GET - Listar conexões ERP
export async function GET(request: NextRequest) {
  try {
    const user = await verifyAdmin(request);
    if (!user) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'logs') {
      const connectionId = searchParams.get('connectionId');
      const logs = await ERPIntegrationManager.getSyncLogs(connectionId || undefined);
      return NextResponse.json({ logs });
    }

    const connections = await ERPIntegrationManager.getConnections();
    return NextResponse.json({ connections });

  } catch (error) {
    console.error('Erro ao buscar conexões ERP:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST - Criar conexão ERP ou executar ação
export async function POST(request: NextRequest) {
  try {
    const user = await verifyAdmin(request);
    if (!user) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'create':
        return await createConnection(body);
      case 'test':
        return await testConnection(body);
      case 'sync':
        return await syncData(body);
      default:
        return NextResponse.json(
          { error: 'Ação não suportada' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Erro na operação ERP:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// Criar nova conexão
async function createConnection(body: any) {
  const { name, type, endpoint, username, password, modules, config } = body;

  if (!name || !type || !endpoint || !username || !password) {
    return NextResponse.json(
      { error: 'Dados obrigatórios não fornecidos' },
      { status: 400 }
    );
  }

  const connection = await ERPIntegrationManager.createConnection({
    name,
    type,
    endpoint,
    username,
    password,
    modules: modules || [],
    config: config || {}
  });

  return NextResponse.json(connection, { status: 201 });
}

// Testar conexão
async function testConnection(body: any) {
  const { connectionId } = body;

  if (!connectionId) {
    return NextResponse.json(
      { error: 'ID da conexão é obrigatório' },
      { status: 400 }
    );
  }

  const result = await ERPIntegrationManager.testConnection(connectionId);
  return NextResponse.json(result);
}

// Sincronizar dados
async function syncData(body: any) {
  const { connectionId, module } = body;

  if (!connectionId || !module) {
    return NextResponse.json(
      { error: 'ID da conexão e módulo são obrigatórios' },
      { status: 400 }
    );
  }

  const result = await ERPIntegrationManager.syncData(connectionId, module);
  return NextResponse.json(result);
}

// PUT - Atualizar conexão ERP
export async function PUT(request: NextRequest) {
  try {
    const user = await verifyAdmin(request);
    if (!user) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const body = await request.json();
    const { connectionId, updates } = body;

    if (!connectionId || !updates) {
      return NextResponse.json(
        { error: 'Dados inválidos' },
        { status: 400 }
      );
    }

    // Atualizar conexão no banco
    const { data, error } = await supabase
      .from('erp_connections')
      .update(updates)
      .eq('id', connectionId)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao atualizar conexão: ${error.message}`);
    }

    return NextResponse.json(data);

  } catch (error) {
    console.error('Erro ao atualizar conexão ERP:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// DELETE - Deletar conexão ERP
export async function DELETE(request: NextRequest) {
  try {
    const user = await verifyAdmin(request);
    if (!user) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const connectionId = searchParams.get('connectionId');

    if (!connectionId) {
      return NextResponse.json(
        { error: 'ID da conexão é obrigatório' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('erp_connections')
      .delete()
      .eq('id', connectionId);

    if (error) {
      throw new Error(`Erro ao deletar conexão: ${error.message}`);
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Erro ao deletar conexão ERP:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
