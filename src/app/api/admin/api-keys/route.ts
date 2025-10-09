import { NextRequest, NextResponse } from 'next/server';
import APIKeyManager from '@/lib/api-management';
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

// GET - Listar chaves API e estatísticas
export async function GET(request: NextRequest) {
  try {
    const user = await verifyAdmin(request);
    if (!user) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const [keys, stats] = await Promise.all([
      APIKeyManager.getUserAPIKeys(user.id),
      APIKeyManager.getAPIStats()
    ]);

    return NextResponse.json({
      keys,
      stats
    });
  } catch (error) {
    console.error('Erro ao buscar chaves API:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST - Criar nova chave API
export async function POST(request: NextRequest) {
  try {
    const user = await verifyAdmin(request);
    if (!user) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const body = await request.json();
    const { name, permissions, rateLimit } = body;

    if (!name || !permissions || !Array.isArray(permissions)) {
      return NextResponse.json(
        { error: 'Dados inválidos' },
        { status: 400 }
      );
    }

    const newKey = await APIKeyManager.generateAPIKey(
      name,
      permissions,
      user.id,
      rateLimit || 1000
    );

    return NextResponse.json(newKey, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar chave API:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// PUT - Ativar/Desativar chave API
export async function PUT(request: NextRequest) {
  try {
    const user = await verifyAdmin(request);
    if (!user) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const body = await request.json();
    const { keyId, action } = body;

    if (!keyId || !action) {
      return NextResponse.json(
        { error: 'Dados inválidos' },
        { status: 400 }
      );
    }

    if (action === 'toggle') {
      await APIKeyManager.toggleAPIKey(keyId, user.id);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: 'Ação não suportada' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Erro ao atualizar chave API:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// DELETE - Deletar chave API
export async function DELETE(request: NextRequest) {
  try {
    const user = await verifyAdmin(request);
    if (!user) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const keyId = searchParams.get('keyId');

    if (!keyId) {
      return NextResponse.json(
        { error: 'ID da chave é obrigatório' },
        { status: 400 }
      );
    }

    await APIKeyManager.deleteAPIKey(keyId, user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao deletar chave API:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
