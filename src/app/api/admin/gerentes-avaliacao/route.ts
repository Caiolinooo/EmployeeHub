import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { verifyTokenFromRequest } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const { user } = await verifyTokenFromRequest(request);

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const supabase = await getSupabaseAdminClient();

    // Buscar todos os usuários autorizados e ativos
    const { data: usuarios, error: usuariosError } = await supabase
      .from('users_unified')
      .select('id, first_name, last_name, email, position, department, role, is_authorized, active')
      .eq('is_authorized', true)
      .eq('active', true)
      .order('first_name', { ascending: true });

    if (usuariosError) throw usuariosError;

    // Buscar configurações de gerentes
    const { data: gerentesConfig, error: gerentesError } = await supabase
      .from('vw_gerentes_avaliacao_ativos')
      .select('*');

    if (gerentesError && gerentesError.code !== 'PGRST116') {
      throw gerentesError;
    }

    const gerentesIds = new Set(gerentesConfig?.map(g => g.usuario_id) || []);

    const gerentesAtuais = usuarios.filter(u => gerentesIds.has(u.id));
    const usuariosDisponiveis = usuarios.filter(u => !gerentesIds.has(u.id));

    return NextResponse.json({
      success: true,
      data: {
        usuarios,
        gerentesAtuais,
        usuariosDisponiveis,
        gerentesConfig: gerentesConfig || [],
        estatisticas: {
          totalUsuarios: usuarios.length,
          totalGerentes: gerentesAtuais.length,
          totalDisponiveis: usuariosDisponiveis.length
        }
      }
    });

  } catch (error) {
    console.error('Erro ao buscar gerentes de avaliação:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar dados dos gerentes de avaliação' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await verifyTokenFromRequest(request);

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const body = await request.json();
    const { usuario_id, ativo } = body;

    if (!usuario_id) {
      return NextResponse.json({ error: 'ID do usuário é obrigatório' }, { status: 400 });
    }

    const supabase = await getSupabaseAdminClient();

    // Usar a função SQL para adicionar/remover gerente
    const { data, error } = await supabase.rpc('toggle_gerente_avaliacao', {
      usuario_id_param: usuario_id,
      ativo_param: ativo !== false,
      usuario_operacao: user.id
    });

    if (error) throw error;

    const result = data[0]?.toggle_gerente_avaliacao;

    if (!result || !result.sucesso) {
      return NextResponse.json({
        error: result?.mensagem || 'Erro ao processar solicitação'
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: result.mensagem,
      data: {
        usuario_id,
        ativo: ativo !== false
      }
    });

  } catch (error) {
    console.error('Erro ao atualizar gerente de avaliação:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar configuração do gerente de avaliação' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { user } = await verifyTokenFromRequest(request);

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const body = await request.json();
    const { usuarios } = body;

    if (!Array.isArray(usuarios)) {
      return NextResponse.json({ error: 'Lista de usuários é obrigatória' }, { status: 400 });
    }

    const supabase = await getSupabaseAdminClient();
    const resultados = [];

    for (const usuario of usuarios) {
      try {
        const { data, error } = await supabase.rpc('toggle_gerente_avaliacao', {
          usuario_id_param: usuario.usuario_id,
          ativo_param: usuario.ativo !== false,
          usuario_operacao: user.id
        });

        if (error) {
          resultados.push({
            usuario_id: usuario.usuario_id,
            sucesso: false,
            erro: error.message
          });
        } else {
          const result = data[0]?.toggle_gerente_avaliacao;
          resultados.push({
            usuario_id: usuario.usuario_id,
            sucesso: result?.sucesso || false,
            mensagem: result?.mensagem || 'Erro desconhecido'
          });
        }
      } catch (err) {
        resultados.push({
          usuario_id: usuario.usuario_id,
          sucesso: false,
          erro: err instanceof Error ? err.message : 'Erro desconhecido'
        });
      }
    }

    const sucessos = resultados.filter(r => r.sucesso).length;
    const falhas = resultados.filter(r => !r.sucesso).length;

    return NextResponse.json({
      success: true,
      message: `${sucessos} usuários atualizados com sucesso${falhas > 0 ? `, ${falhas} falhas` : ''}`,
      data: {
        resultados,
        total: resultados.length,
        sucessos,
        falhas
      }
    });

  } catch (error) {
    console.error('Erro ao atualizar múltiplos gerentes:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar configurações dos gerentes' },
      { status: 500 }
    );
  }
}