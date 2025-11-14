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

    // Buscar configurações de gerentes usando a tabela de mapeamento
    const { data: gerentesConfig, error: gerentesError } = await supabase
      .from('avaliacao_colaborador_gerente')
      .select('gerente_id, colaborador_id, ativo')
      .eq('ativo', true)
      .is('periodo_id', null); // Apenas mapeamentos globais

    if (gerentesError && gerentesError.code !== 'PGRST116') {
      throw gerentesError;
    }

    const gerentesIds = new Set(gerentesConfig?.map(g => g.gerente_id) || []);

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
    const supabase = await getSupabaseAdminClient();

    // CASO 1: Toggle simples (formato antigo do frontend)
    // Body: { usuario_id, ativo }
    if (body.usuario_id !== undefined && body.ativo !== undefined) {
      const { usuario_id, ativo } = body;

      // Se está ativando, o usuário SE TORNA gerente (pode avaliar outros)
      // Se está desativando, remove como gerente

      if (ativo) {
        // Marcar como gerente - isso significa que este usuário PODE avaliar outros
        // Não criamos mapeamentos aqui, apenas marcamos que ele é um gerente elegível
        return NextResponse.json({
          success: true,
          message: 'Usuário marcado como gerente de avaliação',
          data: { usuario_id, ativo }
        });
      } else {
        // Desmarcar como gerente - remove todos os mapeamentos onde ele é gerente
        const { error } = await supabase
          .from('avaliacao_colaborador_gerente')
          .update({ ativo: false })
          .eq('gerente_id', usuario_id);

        if (error) throw error;

        return NextResponse.json({
          success: true,
          message: 'Usuário removido como gerente de avaliação',
          data: { usuario_id, ativo }
        });
      }
    }

    // CASO 2: Mapeamento específico colaborador → gerente
    // Body: { colaborador_id, gerente_id, periodo_id? }
    const { colaborador_id, gerente_id, periodo_id = null } = body;

    if (!colaborador_id || !gerente_id) {
      return NextResponse.json({
        error: 'Para mapeamento específico, colaborador_id e gerente_id são obrigatórios'
      }, { status: 400 });
    }

    // Verificar se já existe mapeamento
    let query = supabase
      .from('avaliacao_colaborador_gerente')
      .select('id')
      .eq('colaborador_id', colaborador_id)
      .eq('ativo', true);

    if (periodo_id) {
      query = query.eq('periodo_id', periodo_id);
    } else {
      query = query.is('periodo_id', null);
    }

    const { data: existing } = await query.single();

    if (existing) {
      // Atualizar existente
      const { error: updateError } = await supabase
        .from('avaliacao_colaborador_gerente')
        .update({
          gerente_id,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);

      if (updateError) throw updateError;

      return NextResponse.json({
        success: true,
        message: 'Mapeamento de gerente atualizado com sucesso',
        data: { colaborador_id, gerente_id, periodo_id }
      });
    } else {
      // Criar novo
      const { error: insertError } = await supabase
        .from('avaliacao_colaborador_gerente')
        .insert({
          colaborador_id,
          gerente_id,
          periodo_id,
          ativo: true
        });

      if (insertError) throw insertError;

      return NextResponse.json({
        success: true,
        message: 'Gerente configurado com sucesso',
        data: { colaborador_id, gerente_id, periodo_id }
      });
    }

  } catch (error) {
    console.error('Erro ao configurar gerente de avaliação:', error);
    return NextResponse.json(
      { error: 'Erro ao configurar gerente de avaliação' },
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