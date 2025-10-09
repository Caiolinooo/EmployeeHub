import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; phoneId: string }> }
) {
  try {
    // Aguardar os parâmetros da rota antes de acessá-los
    const { id, phoneId } = await params;

    // Verificar autenticação
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader || '');

    if (!token) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: 'Token inválido ou expirado' },
        { status: 401 }
      );
    }

    // Verificar se o usuário está tentando modificar seus próprios dados
    // ou se é um administrador
    if (payload.userId !== id && payload.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 403 }
      );
    }

    // Inicializar cliente Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Verificar se o telefone existe e pertence ao usuário
    const { data: phoneData, error: phoneError } = await supabase
      .from('user_phones')
      .select('*')
      .eq('id', phoneId)
      .eq('user_id', id)
      .single();

    if (phoneError || !phoneData) {
      return NextResponse.json(
        { error: 'Telefone não encontrado' },
        { status: 404 }
      );
    }

    // Verificar se é o telefone primário
    if (phoneData.is_primary) {
      return NextResponse.json(
        { error: 'Não é possível remover o telefone principal' },
        { status: 400 }
      );
    }

    // Remover telefone
    const { error } = await supabase
      .from('user_phones')
      .delete()
      .eq('id', phoneId)
      .eq('user_id', id);

    if (error) {
      console.error('Erro ao remover telefone:', error);
      return NextResponse.json(
        { error: 'Erro ao remover telefone' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Telefone removido com sucesso'
    });
  } catch (error) {
    console.error('Erro ao processar requisição:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; phoneId: string }> }
) {
  try {
    // Aguardar os parâmetros da rota antes de acessá-los
    const { id, phoneId } = await params;

    // Verificar autenticação
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader || '');

    if (!token) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: 'Token inválido ou expirado' },
        { status: 401 }
      );
    }

    // Verificar se o usuário está tentando modificar seus próprios dados
    // ou se é um administrador
    if (payload.userId !== id && payload.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 403 }
      );
    }

    // Obter dados do corpo da requisição
    const body = await request.json();
    const { label, is_primary } = body;

    // Inicializar cliente Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Verificar se o telefone existe e pertence ao usuário
    const { data: phoneData, error: phoneError } = await supabase
      .from('user_phones')
      .select('*')
      .eq('id', phoneId)
      .eq('user_id', id)
      .single();

    if (phoneError || !phoneData) {
      return NextResponse.json(
        { error: 'Telefone não encontrado' },
        { status: 404 }
      );
    }

    // Se estiver definindo como primário, remover o status primário de outros telefones
    if (is_primary) {
      await supabase
        .from('user_phones')
        .update({ is_primary: false })
        .eq('user_id', id)
        .eq('is_primary', true);
    }

    // Atualizar telefone
    const { data, error } = await supabase
      .from('user_phones')
      .update({
        label: label !== undefined ? label : phoneData.label,
        is_primary: is_primary !== undefined ? is_primary : phoneData.is_primary,
        updated_at: new Date().toISOString()
      })
      .eq('id', phoneId)
      .eq('user_id', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar telefone:', error);
      return NextResponse.json(
        { error: 'Erro ao atualizar telefone' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Telefone atualizado com sucesso',
      data
    });
  } catch (error) {
    console.error('Erro ao processar requisição:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
