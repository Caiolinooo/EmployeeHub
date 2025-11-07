import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';

export const dynamic = 'force-dynamic';

// POST - Atualizar configurações de email de reembolso de um usuário
export async function POST(request: NextRequest) {
  try {
    // Obter dados do corpo da requisição
    const body = await request.json();
    const { userId, enabled, recipients } = body;

    // Validar os dados de entrada
    if (!userId || typeof enabled !== 'boolean' || !Array.isArray(recipients)) {
      return NextResponse.json(
        { error: 'Dados inválidos' },
        { status: 400 }
      );
    }

    // Atualizar configurações do usuário
    const { data, error } = await supabaseAdmin
      .from('users')
      .update({
        reimbursement_email_settings: { enabled, recipients },
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar configurações de email do usuário:', error);
      return NextResponse.json(
        { error: `Erro ao atualizar configurações: ${error.message}` },
        { status: 500 }
      );
    }

    // Retornar resultado
    return NextResponse.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Erro ao processar requisição:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// GET - Obter configurações de email de reembolso de um usuário
export async function GET(request: NextRequest) {
  try {
    // Obter ID do usuário da URL
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const email = searchParams.get('email');

    if (!userId && !email) {
      return NextResponse.json(
        { error: 'É necessário fornecer userId ou email' },
        { status: 400 }
      );
    }

    // Buscar configurações do usuário
    let query = supabaseAdmin
      .from('users')
      .select('id, email, reimbursement_email_settings');

    if (userId) {
      query = query.eq('id', userId);
    } else if (email) {
      query = query.eq('email', email);
    }

    const { data, error } = await query.single();

    if (error) {
      console.error('Erro ao buscar configurações de email do usuário:', error);
      return NextResponse.json(
        { error: `Erro ao buscar configurações: ${error.message}` },
        { status: 500 }
      );
    }

    // Retornar configurações
    return NextResponse.json({
      id: data.id,
      email: data.email,
      reimbursement_email_settings: data.reimbursement_email_settings || {
        enabled: false,
        recipients: []
      }
    });
  } catch (error) {
    console.error('Erro ao processar requisição:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
