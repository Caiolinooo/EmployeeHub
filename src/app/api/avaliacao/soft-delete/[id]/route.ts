/**
 * API para soft delete de avaliações (mover para lixeira)
 * Em vez de excluir permanentemente, marca como deleted_at
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { AvaliacaoWorkflowService } from '@/lib/services/avaliacao-workflow-service';

export const dynamic = 'force-dynamic';

/**
 * Rota para mover uma avaliação para a lixeira (soft delete)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verificar autenticação
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader || undefined);

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { success: false, error: 'Token inválido ou expirado' },
        { status: 401 }
      );
    }

    // Verificar se o usuário é um gerente (MANAGER) ou administrador (ADMIN)
    if (payload.role !== 'MANAGER' && payload.role !== 'ADMIN') {
      console.error('Usuário não autorizado a mover avaliações para lixeira:', payload.userId, payload.role);
      return NextResponse.json({
        success: false,
        error: 'Apenas gerentes e administradores podem mover avaliações para a lixeira.',
        timestamp: new Date().toISOString()
      }, { status: 403 });
    }

    // Garantir que params seja await antes de acessar suas propriedades
    const { id } = await params;
    console.log(`API soft-delete: Movendo avaliação ${id} para a lixeira`);

    // Validar se o ID é um UUID válido
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      console.error('ID inválido, não é um UUID válido:', id);
      return NextResponse.json({
        success: false,
        error: 'ID inválido. O ID deve ser um UUID válido.',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // Verificar se a avaliação existe
    const { data: avaliacaoExistente, error: checkError } = await supabase
      .from('avaliacoes_desempenho')
      .select('*')
      .eq('id', id)
      .single();

    if (checkError || !avaliacaoExistente) {
      console.error('Avaliação não encontrada:', id);
      return NextResponse.json({
        success: false,
        error: 'Avaliação não encontrada',
        timestamp: new Date().toISOString()
      }, { status: 404 });
    }

    // Verificar se já está na lixeira
    if (avaliacaoExistente.deleted_at) {
      return NextResponse.json({
        success: false,
        error: 'Esta avaliação já está na lixeira',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // Fazer soft delete - atualizar apenas deleted_at (mantém status original)
    const { error: softDeleteError } = await supabaseAdmin
      .from('avaliacoes_desempenho')
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (softDeleteError) {
      console.error('Erro ao mover avaliação para lixeira:', softDeleteError);
      return NextResponse.json({
        success: false,
        error: `Erro ao mover para lixeira: ${softDeleteError.message}`,
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }

    console.log(`✅ Avaliação ${id} movida para lixeira com sucesso`);

    // Enviar notificações sobre a movimentação para lixeira
    try {
      await AvaliacaoWorkflowService.sendTrashNotifications(
        id,
        avaliacaoExistente.funcionario_id,
        avaliacaoExistente.avaliador_id,
        'movida para lixeira'
      );
      console.log(`✅ Notificações de lixeira enviadas para avaliação ${id}`);
    } catch (notificationError) {
      console.error('❌ Erro ao enviar notificações de lixeira:', notificationError);
      // Não falhar a operação principal se as notificações falharem
    }

    return NextResponse.json({
      success: true,
      message: 'Avaliação movida para a lixeira com sucesso. Ela será excluída permanentemente após 30 dias.',
      timestamp: new Date().toISOString(),
      data: {
        id: avaliacaoExistente.id,
        deleted_at: new Date().toISOString(),
        days_until_permanent_delete: 30
      }
    });

  } catch (error) {
    console.error('Erro ao mover avaliação para lixeira:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * Rota para restaurar uma avaliação da lixeira
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verificar autenticação
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader || undefined);

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { success: false, error: 'Token inválido ou expirado' },
        { status: 401 }
      );
    }

    // Verificar se o usuário é um gerente (MANAGER) ou administrador (ADMIN)
    if (payload.role !== 'MANAGER' && payload.role !== 'ADMIN') {
      console.error('Usuário não autorizado a restaurar avaliações:', payload.userId, payload.role);
      return NextResponse.json({
        success: false,
        error: 'Apenas gerentes e administradores podem restaurar avaliações.',
        timestamp: new Date().toISOString()
      }, { status: 403 });
    }

    // Garantir que params seja await antes de acessar suas propriedades
    const { id } = await params;
    console.log(`API soft-delete: Restaurando avaliação ${id} da lixeira`);

    // Validar se o ID é um UUID válido
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      console.error('ID inválido, não é um UUID válido:', id);
      return NextResponse.json({
        success: false,
        error: 'ID inválido. O ID deve ser um UUID válido.',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // Verificar se a avaliação existe e está na lixeira
    const { data: avaliacaoExistente, error: checkError } = await supabase
      .from('avaliacoes_desempenho')
      .select('*')
      .eq('id', id)
      .single();

    if (checkError || !avaliacaoExistente) {
      console.error('Avaliação não encontrada:', id);
      return NextResponse.json({
        success: false,
        error: 'Avaliação não encontrada',
        timestamp: new Date().toISOString()
      }, { status: 404 });
    }

    // Verificar se está na lixeira
    if (!avaliacaoExistente.deleted_at) {
      return NextResponse.json({
        success: false,
        error: 'Esta avaliação não está na lixeira',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // Restaurar avaliação - remover deleted_at e voltar status original
    const { error: restoreError } = await supabaseAdmin
      .from('avaliacoes_desempenho')
      .update({
        deleted_at: null,
        status: 'pendente', // Restaurar para status pendente
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (restoreError) {
      console.error('Erro ao restaurar avaliação:', restoreError);
      return NextResponse.json({
        success: false,
        error: `Erro ao restaurar: ${restoreError.message}`,
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }

    console.log(`✅ Avaliação ${id} restaurada da lixeira com sucesso`);

    return NextResponse.json({
      success: true,
      message: 'Avaliação restaurada com sucesso',
      timestamp: new Date().toISOString(),
      data: {
        id: avaliacaoExistente.id,
        restored_at: new Date().toISOString(),
        status: 'pendente'
      }
    });

  } catch (error) {
    console.error('Erro ao restaurar avaliação:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}