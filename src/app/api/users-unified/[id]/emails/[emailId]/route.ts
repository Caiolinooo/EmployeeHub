import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; emailId: string }> }
) {
  try {
    // Aguardar os parâmetros da rota antes de acessá-los
    const { id, emailId } = await params;

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

    // Verificar se o e-mail existe e pertence ao usuário
    const { data: emailData, error: emailError } = await supabase
      .from('user_emails')
      .select('*')
      .eq('id', emailId)
      .eq('user_id', id)
      .single();

    if (emailError || !emailData) {
      return NextResponse.json(
        { error: 'E-mail não encontrado' },
        { status: 404 }
      );
    }

    // Verificar se é o e-mail primário
    if (emailData.is_primary) {
      return NextResponse.json(
        { error: 'Não é possível remover o e-mail principal' },
        { status: 400 }
      );
    }

    // Remover e-mail
    const { error } = await supabase
      .from('user_emails')
      .delete()
      .eq('id', emailId)
      .eq('user_id', id);

    if (error) {
      console.error('Erro ao remover e-mail:', error);
      return NextResponse.json(
        { error: 'Erro ao remover e-mail' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'E-mail removido com sucesso'
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
  { params }: { params: Promise<{ id: string; emailId: string }> }
) {
  try {
    // Aguardar os parâmetros da rota antes de acessá-los
    const { id, emailId } = await params;

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

    // Verificar se o e-mail existe e pertence ao usuário
    const { data: emailData, error: emailError } = await supabase
      .from('user_emails')
      .select('*')
      .eq('id', emailId)
      .eq('user_id', id)
      .single();

    if (emailError || !emailData) {
      return NextResponse.json(
        { error: 'E-mail não encontrado' },
        { status: 404 }
      );
    }

    // Se estiver definindo como primário, remover o status primário de outros e-mails
    if (is_primary) {
      await supabase
        .from('user_emails')
        .update({ is_primary: false })
        .eq('user_id', id)
        .eq('is_primary', true);
    }

    // Atualizar e-mail
    const { data, error } = await supabase
      .from('user_emails')
      .update({
        label: label !== undefined ? label : emailData.label,
        is_primary: is_primary !== undefined ? is_primary : emailData.is_primary,
        updated_at: new Date().toISOString()
      })
      .eq('id', emailId)
      .eq('user_id', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar e-mail:', error);
      return NextResponse.json(
        { error: 'Erro ao atualizar e-mail' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'E-mail atualizado com sucesso',
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
