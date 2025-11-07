import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { 
  MobileSyncRequest, 
  MobileSyncResponse, 
  SyncData,
  SyncConflict,
  SyncError 
} from '@/types/api-mobile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação
    const token = extractTokenFromHeader(request.headers.get('authorization') || undefined);
    if (!token) {
      return NextResponse.json({
        success: false,
        error: 'Token não fornecido'
      }, { status: 401 });
    }

    const authResult = verifyToken(token);
    if (!authResult) {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 });
    }

    const userId = authResult.userId;
    const body: MobileSyncRequest = await request.json();
    const { lastSync, version, deviceId, changes } = body;

    if (!deviceId) {
      return NextResponse.json({
        success: false,
        error: 'deviceId é obrigatório'
      }, { status: 400 });
    }

    const conflicts: SyncConflict[] = [];
    const errors: SyncError[] = [];

    // Processar mudanças locais primeiro
    if (changes) {
      await processLocalChanges(userId, deviceId, changes, conflicts, errors);
    }

    // Obter dados atualizados do servidor
    const syncData = await getServerData(userId, deviceId, lastSync, version);

    // Registrar sincronização
    await supabase
      .from('mobile_sync_logs')
      .upsert({
        user_id: userId,
        device_id: deviceId,
        last_sync: new Date().toISOString(),
        version: syncData.version,
        items_synced: {
          avaliacoes: syncData.data.avaliacoes.length,
          reembolsos: syncData.data.reembolsos.length,
          noticias: syncData.data.noticias.length,
          eventos: syncData.data.eventos.length,
          notificacoes: syncData.data.notificacoes.length
        },
        conflicts_count: conflicts.length,
        errors_count: errors.length
      }, {
        onConflict: 'user_id,device_id'
      });

    const response: MobileSyncResponse = {
      success: true,
      data: syncData,
      conflicts: conflicts.length > 0 ? conflicts : undefined,
      errors: errors.length > 0 ? errors : undefined
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Erro na sincronização:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
}

async function processLocalChanges(
  userId: string,
  deviceId: string,
  changes: any,
  conflicts: SyncConflict[],
  errors: SyncError[]
) {
  // Processar avaliações
  if (changes.avaliacoes) {
    for (const avaliacao of changes.avaliacoes) {
      try {
        if (avaliacao.syncStatus === 'pending') {
          await processAvaliacaoChange(userId, avaliacao, conflicts, errors);
        }
      } catch (error) {
        errors.push({
          id: avaliacao.id,
          type: 'avaliacao',
          message: error.message,
          retryable: true
        });
      }
    }
  }

  // Processar reembolsos
  if (changes.reembolsos) {
    for (const reembolso of changes.reembolsos) {
      try {
        if (reembolso.syncStatus === 'pending') {
          await processReembolsoChange(userId, reembolso, conflicts, errors);
        }
      } catch (error) {
        errors.push({
          id: reembolso.id,
          type: 'reembolso',
          message: error.message,
          retryable: true
        });
      }
    }
  }

  // Processar configurações
  if (changes.configuracoes) {
    try {
      await supabase
        .from('users_unified')
        .update({
          profile_data: {
            ...changes.configuracoes,
            updated_at: new Date().toISOString()
          }
        })
        .eq('id', userId);
    } catch (error) {
      errors.push({
        id: 'configuracoes',
        type: 'configuracao',
        message: error.message,
        retryable: true
      });
    }
  }
}

async function processAvaliacaoChange(
  userId: string,
  avaliacao: any,
  conflicts: SyncConflict[],
  errors: SyncError[]
) {
  // Verificar se existe no servidor
  const { data: existing } = await supabase
    .from('avaliacoes_desempenho')
    .select('*')
    .eq('id', avaliacao.id)
    .single();

  if (existing) {
    // Verificar conflito de versão
    const localUpdated = new Date(avaliacao.atualizadoEm);
    const serverUpdated = new Date(existing.updated_at);

    if (serverUpdated > localUpdated) {
      // Conflito detectado
      conflicts.push({
        id: avaliacao.id,
        type: 'avaliacao',
        localVersion: avaliacao,
        serverVersion: existing,
        resolution: 'server' // Priorizar versão do servidor por padrão
      });
      return;
    }
  }

  // Atualizar ou criar avaliação
  const { error } = await supabase
    .from('avaliacoes_desempenho')
    .upsert({
      id: avaliacao.id,
      titulo: avaliacao.titulo,
      descricao: avaliacao.descricao,
      tipo: avaliacao.tipo,
      status: avaliacao.status,
      data_inicio: avaliacao.dataInicio,
      data_fim: avaliacao.dataFim,
      avaliador_id: avaliacao.avaliadorId,
      funcionario_id: avaliacao.funcionarioId,
      criterios: avaliacao.criterios,
      pontuacao_total: avaliacao.pontuacaoTotal,
      observacoes: avaliacao.observacoes,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'id'
    });

  if (error) {
    throw new Error(`Erro ao salvar avaliação: ${error.message}`);
  }
}

async function processReembolsoChange(
  userId: string,
  reembolso: any,
  conflicts: SyncConflict[],
  errors: SyncError[]
) {
  // Verificar se existe no servidor
  const { data: existing } = await supabase
    .from('reembolsos')
    .select('*')
    .eq('id', reembolso.id)
    .single();

  if (existing) {
    // Verificar conflito de versão
    const localUpdated = new Date(reembolso.atualizadoEm);
    const serverUpdated = new Date(existing.updated_at);

    if (serverUpdated > localUpdated) {
      // Conflito detectado
      conflicts.push({
        id: reembolso.id,
        type: 'reembolso',
        localVersion: reembolso,
        serverVersion: existing,
        resolution: 'server'
      });
      return;
    }
  }

  // Atualizar ou criar reembolso
  const { error } = await supabase
    .from('reembolsos')
    .upsert({
      id: reembolso.id,
      titulo: reembolso.titulo,
      descricao: reembolso.descricao,
      valor: reembolso.valor,
      categoria: reembolso.categoria,
      status: reembolso.status,
      data_gasto: reembolso.dataGasto,
      comprovantes: reembolso.comprovantes,
      user_id: userId,
      observacoes: reembolso.observacoes,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'id'
    });

  if (error) {
    throw new Error(`Erro ao salvar reembolso: ${error.message}`);
  }
}

async function getServerData(
  userId: string,
  deviceId: string,
  lastSync?: string,
  version?: number
): Promise<SyncData> {
  const syncDate = lastSync || new Date(0).toISOString();
  const newVersion = (version || 0) + 1;

  // Buscar avaliações atualizadas
  const { data: avaliacoes } = await supabase
    .from('vw_avaliacoes_mobile')
    .select('*')
    .or(`funcionario_id.eq.${userId},avaliador_id.eq.${userId}`)
    .gte('updated_at', syncDate)
    .order('updated_at', { ascending: false })
    .limit(100);

  // Buscar reembolsos atualizados
  const { data: reembolsos } = await supabase
    .from('vw_reembolsos_mobile')
    .select('*')
    .eq('user_id', userId)
    .gte('updated_at', syncDate)
    .order('updated_at', { ascending: false })
    .limit(100);

  // Buscar notícias atualizadas
  const { data: noticias } = await supabase
    .from('vw_noticias_mobile')
    .select('*')
    .eq('ativo', true)
    .gte('updated_at', syncDate)
    .order('data_publicacao', { ascending: false })
    .limit(50);

  // Buscar eventos futuros
  const { data: eventos } = await supabase
    .from('vw_eventos_mobile')
    .select('*')
    .gte('data_inicio', new Date().toISOString())
    .gte('updated_at', syncDate)
    .order('data_inicio', { ascending: true })
    .limit(50);

  // Buscar notificações não lidas
  const { data: notificacoes } = await supabase
    .from('mobile_notifications')
    .select('*')
    .eq('user_id', userId)
    .eq('read', false)
    .gte('created_at', syncDate)
    .order('created_at', { ascending: false })
    .limit(100);

  // Buscar itens deletados
  const { data: deletedItems } = await supabase
    .from('mobile_deleted_items')
    .select('entity_type, entity_id')
    .eq('user_id', userId)
    .gte('deleted_at', syncDate);

  const deletedIds = {
    avaliacoes: [],
    reembolsos: [],
    noticias: [],
    eventos: []
  };

  deletedItems?.forEach(item => {
    if (deletedIds[item.entity_type]) {
      deletedIds[item.entity_type].push(item.entity_id);
    }
  });

  return {
    lastSync: new Date().toISOString(),
    version: newVersion,
    data: {
      avaliacoes: avaliacoes || [],
      reembolsos: reembolsos || [],
      noticias: noticias || [],
      eventos: eventos || [],
      notificacoes: notificacoes || []
    },
    deletedIds
  };
}

// Endpoint para sincronização incremental (GET)
export async function GET(request: NextRequest) {
  try {
    const token = extractTokenFromHeader(request.headers.get('authorization') || undefined);
    if (!token) {
      return NextResponse.json({
        success: false,
        error: 'Token não fornecido'
      }, { status: 401 });
    }

    const authResult = verifyToken(token);
    if (!authResult) {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 });
    }

    const userId = authResult.userId;
    const url = new URL(request.url);
    const deviceId = url.searchParams.get('deviceId');
    const lastSync = url.searchParams.get('lastSync');
    const version = parseInt(url.searchParams.get('version') || '0');

    if (!deviceId) {
      return NextResponse.json({
        success: false,
        error: 'deviceId é obrigatório'
      }, { status: 400 });
    }

    const syncData = await getServerData(userId, deviceId, lastSync, version);

    return NextResponse.json({
      success: true,
      data: syncData
    });

  } catch (error) {
    console.error('Erro na sincronização GET:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
}
