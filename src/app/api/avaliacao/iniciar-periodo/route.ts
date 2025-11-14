import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase';
import { verifyToken } from '@/lib/auth';

/**
 * POST /api/avaliacao/iniciar-periodo
 * Cria uma avaliação para o usuário em um período específico (sob demanda)
 * 
 * Body: { periodo_id: string }
 */
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação via cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('abzToken')?.value || cookieStore.get('token')?.value;

    console.log('🔐 Verificando autenticação...');
    console.log('Token presente:', !!token);

    if (!token) {
      console.error('❌ Token não fornecido');
      return NextResponse.json(
        { success: false, error: 'Token não fornecido' },
        { status: 401 }
      );
    }

    // Verificar token diretamente
    const decoded = verifyToken(token);
    
    if (!decoded || !decoded.userId) {
      console.error('❌ Token inválido ou sem userId');
      return NextResponse.json(
        { success: false, error: 'Token inválido' },
        { status: 401 }
      );
    }

    const userId = decoded.userId;
    console.log('✅ Usuário autenticado:', userId);

    // Ler body do request
    const body = await request.json();
    const { periodo_id } = body;

    console.log('📋 Dados recebidos:', { userId, periodo_id });

    if (!periodo_id) {
      console.error('❌ periodo_id não fornecido');
      return NextResponse.json(
        { success: false, error: 'periodo_id é obrigatório' },
        { status: 400 }
      );
    }

    // Obter cliente Supabase Admin
    const supabaseAdmin = await getSupabaseAdmin();
    console.log('✅ Cliente Supabase Admin obtido');

    // 1. Verificar se período existe e está ativo
    console.log('🔍 Buscando período:', periodo_id);
    const { data: periodo, error: periodoError } = await supabaseAdmin
      .from('periodos_avaliacao')
      .select('*')
      .eq('id', periodo_id)
      .eq('ativo', true)
      .single();

    if (periodoError || !periodo) {
      console.error('❌ Período não encontrado:', periodoError);
      return NextResponse.json(
        { success: false, error: 'Período não encontrado ou inativo' },
        { status: 404 }
      );
    }

    console.log('✅ Período encontrado:', periodo.nome);

    // Verificar se o período já começou
    const hoje = new Date().toISOString().split('T')[0];
    const dataInicio = new Date(periodo.data_inicio).toISOString().split('T')[0];
    
    console.log('📅 Verificando datas:', { hoje, dataInicio });

    if (dataInicio > hoje) {
      console.warn('⚠️ Período ainda não iniciou');
      return NextResponse.json(
        { 
          success: false, 
          error: 'Este período ainda não iniciou',
          hint: `O período inicia em ${new Date(periodo.data_inicio).toLocaleDateString('pt-BR')}`
        },
        { status: 400 }
      );
    }

    // 2. Verificar se já existe avaliação para este usuário neste período
    console.log('🔍 Verificando avaliação existente para:', { funcionario_id: userId, periodo_id });
    
    const { data: avaliacaoExistente, error: avaliacaoError } = await supabaseAdmin
      .from('avaliacoes_desempenho')
      .select('*')
      .eq('funcionario_id', userId)
      .eq('periodo_id', periodo_id)
      .maybeSingle();

    if (avaliacaoError && avaliacaoError.code !== 'PGRST116') {
      console.error('❌ Erro ao verificar avaliação existente:', avaliacaoError);
      return NextResponse.json(
        { success: false, error: 'Erro ao verificar avaliação existente' },
        { status: 500 }
      );
    }

    // Se já existe, retornar a existente
    if (avaliacaoExistente) {
      console.log('✅ Avaliação já existe, retornando existente:', avaliacaoExistente.id);
      return NextResponse.json({
        success: true,
        message: 'Avaliação já existe para este período',
        avaliacao: avaliacaoExistente,
        isNew: false
      });
    }

    console.log('📝 Nenhuma avaliação existente, criando nova...');

    // 3. Buscar gerente configurado para o usuário
    console.log('🔍 Buscando gerente para colaborador:', userId);
    
    const { data: mapping, error: mappingError } = await supabaseAdmin
      .from('avaliacao_colaborador_gerente')
      .select('gerente_id')
      .eq('colaborador_id', userId)
      .or(`periodo_id.eq.${periodo_id},periodo_id.is.null`)
      .maybeSingle();

    if (mappingError && mappingError.code !== 'PGRST116') {
      console.error('❌ Erro ao buscar gerente:', mappingError);
      return NextResponse.json(
        { success: false, error: 'Erro ao buscar gerente configurado' },
        { status: 500 }
      );
    }

    if (!mapping || !mapping.gerente_id) {
      console.warn('⚠️ Gerente não configurado para este usuário');
      return NextResponse.json(
        {
          success: false,
          error: 'Gerente não configurado para este usuário',
          hint: 'Entre em contato com o administrador para configurar seu gerente'
        },
        { status: 400 }
      );
    }

    console.log('✅ Gerente encontrado:', mapping.gerente_id);

    // 4. Criar nova avaliação
    console.log('📝 Criando nova avaliação...');
    
    const { data: novaAvaliacao, error: createError } = await supabaseAdmin
      .from('avaliacoes_desempenho')
      .insert({
        funcionario_id: userId,
        avaliador_id: mapping.gerente_id,
        periodo_id: periodo_id,
        periodo: periodo.nome,
        data_inicio: periodo.data_inicio,
        data_fim: periodo.data_fim,
        status: 'pendente',
        pontuacao_total: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (createError) {
      console.error('❌ Erro ao criar avaliação:', createError);
      return NextResponse.json(
        { success: false, error: 'Erro ao criar avaliação' },
        { status: 500 }
      );
    }

    console.log('✅ Avaliação criada com sucesso:', novaAvaliacao.id);

    // 5. Enviar notificações
    try {
      console.log('📧 Enviando notificações...');
      
      // Notificar colaborador
      await supabaseAdmin.from('notifications').insert({
        user_id: userId,
        type: 'avaliacao_criada',
        title: 'Nova Avaliação de Desempenho',
        message: `Sua avaliação para o período "${periodo.nome}" está disponível. Preencha sua autoavaliação até ${new Date(periodo.data_limite_autoavaliacao).toLocaleDateString('pt-BR')}.`,
        data: {
          avaliacao_id: novaAvaliacao.id,
          periodo_id: periodo_id,
          periodo_nome: periodo.nome,
          data_limite: periodo.data_limite_autoavaliacao,
        },
        action_url: `/avaliacao/preencher/${novaAvaliacao.id}`,
        priority: 'high',
        read_at: null,
        created_at: new Date().toISOString(),
      });

      // Notificar gerente
      await supabaseAdmin.from('notifications').insert({
        user_id: mapping.gerente_id,
        type: 'avaliacao_criada',
        title: 'Nova Avaliação para Colaborador',
        message: `Nova avaliação criada para o período "${periodo.nome}". Aguardando autoavaliação do colaborador.`,
        data: {
          avaliacao_id: novaAvaliacao.id,
          periodo_id: periodo_id,
          periodo_nome: periodo.nome,
          funcionario_id: userId,
        },
        action_url: `/avaliacao`,
        priority: 'normal',
        read_at: null,
        created_at: new Date().toISOString(),
      });

      console.log('✅ Notificações enviadas com sucesso');
    } catch (notifError: any) {
      console.error('⚠️ Erro ao enviar notificações:', notifError.message);
      // Não falhar a criação da avaliação se a notificação falhar
    }

    return NextResponse.json({
      success: true,
      message: 'Avaliação criada com sucesso',
      avaliacao: novaAvaliacao,
      isNew: true
    });

  } catch (error: any) {
    console.error('Erro em POST /api/avaliacao/iniciar-periodo:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Erro interno do servidor',
        details: error.message
      },
      { status: 500 }
    );
  }
}
