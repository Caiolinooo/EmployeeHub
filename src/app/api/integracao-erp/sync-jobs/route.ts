import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyRequestToken } from '@/lib/auth';
import { ERPSyncJob, SyncJobConfig } from '@/types/integracao-erp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação
    const authResult = verifyRequestToken(request);
    if (!authResult.valid || !authResult.payload) {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 });
    }

    // Verificar permissões
    const { data: user } = await supabase
      .from('users_unified')
      .select('role, access_permissions, email')
      .eq('id', authResult.payload.userId)
      .single();

    if (!user || (user.role !== 'ADMIN' && !user.access_permissions?.['erp.view'])) {
      return NextResponse.json({
        success: false,
        error: 'Sem permissão para visualizar jobs de sincronização'
      }, { status: 403 });
    }

    const url = new URL(request.url);
    const connectionId = url.searchParams.get('connectionId');
    const status = url.searchParams.get('status');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    let query = supabase
      .from('erp_sync_jobs')
      .select(`
        id,
        connection_id,
        module,
        type,
        status,
        started_at,
        completed_at,
        total_records,
        processed_records,
        successful_records,
        failed_records,
        progress,
        estimated_time_remaining,
        created_by,
        scheduled_at,
        is_scheduled,
        config,
        created_at,
        updated_at
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (connectionId) {
      query = query.eq('connection_id', connectionId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data: jobs, error } = await query;

    if (error) {
      console.error('Erro ao buscar jobs de sincronização:', error);
      return NextResponse.json({
        success: false,
        error: 'Erro ao buscar jobs de sincronização'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      jobs: jobs || []
    });

  } catch (error) {
    console.error('Erro na API de jobs de sincronização:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação
    const authResult = verifyRequestToken(request);
    if (!authResult.valid || !authResult.payload) {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 });
    }

    // Verificar permissões
    const { data: user } = await supabase
      .from('users_unified')
      .select('role, access_permissions, email')
      .eq('id', authResult.payload.userId)
      .single();

    if (!user || (user.role !== 'ADMIN' && !user.access_permissions?.['erp.sync'])) {
      return NextResponse.json({
        success: false,
        error: 'Sem permissão para criar jobs de sincronização'
      }, { status: 403 });
    }

    const body = await request.json();
    const {
      connectionId,
      module,
      type,
      scheduledAt,
      config
    } = body;

    // Validar campos obrigatórios
    if (!connectionId || !module || !type) {
      return NextResponse.json({
        success: false,
        error: 'Campos obrigatórios: connectionId, module, type'
      }, { status: 400 });
    }

    // Verificar se a conexão existe
    const { data: connection, error: connectionError } = await supabase
      .from('erp_connections')
      .select('id, name, status')
      .eq('id', connectionId)
      .eq('is_active', true)
      .single();

    if (connectionError || !connection) {
      return NextResponse.json({
        success: false,
        error: 'Conexão ERP não encontrada ou inativa'
      }, { status: 404 });
    }

    // Configuração padrão do job
    const defaultConfig: SyncJobConfig = {
      batchSize: 100,
      timeout: 300, // 5 minutos
      retryAttempts: 3,
      retryDelay: 30, // 30 segundos
      skipErrors: false,
      validateData: true,
      backupBeforeSync: true,
      notifyOnCompletion: true,
      notifyOnError: true,
      emailRecipients: [user.email],
      ...config
    };

    // Criar job de sincronização
    const { data: job, error: jobError } = await supabase
      .from('erp_sync_jobs')
      .insert({
        connection_id: connectionId,
        module,
        type,
        status: scheduledAt ? 'pending' : 'pending',
        total_records: 0,
        processed_records: 0,
        successful_records: 0,
        failed_records: 0,
        progress: 0,
        created_by: authResult.payload.userId,
        scheduled_at: scheduledAt,
        is_scheduled: !!scheduledAt,
        config: defaultConfig,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (jobError) {
      console.error('Erro ao criar job de sincronização:', jobError);
      return NextResponse.json({
        success: false,
        error: 'Erro ao criar job de sincronização'
      }, { status: 500 });
    }

    // Se não for agendado, iniciar imediatamente
    if (!scheduledAt) {
      // Aqui seria iniciado o processo de sincronização
      // Por enquanto, vamos simular
      await simulateSync(job.id);
    }

    // Log da ação
    await supabase
      .from('erp_audit_logs')
      .insert({
        connection_id: connectionId,
        action: 'create',
        entity_type: 'sync_job',
        entity_id: job.id,
        new_values: { module, type, scheduledAt },
        user_id: authResult.payload.userId,
        user_email: user.email,
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent'),
        timestamp: new Date().toISOString(),
        success: true
      });

    return NextResponse.json({
      success: true,
      job
    });

  } catch (error) {
    console.error('Erro ao criar job de sincronização:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
}

// Função para simular sincronização
async function simulateSync(jobId: string) {
  try {
    // Atualizar status para "running"
    await supabase
      .from('erp_sync_jobs')
      .update({
        status: 'running',
        started_at: new Date().toISOString(),
        total_records: 100,
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId);

    // Simular progresso
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1 segundo de delay
      
      await supabase
        .from('erp_sync_jobs')
        .update({
          progress: i,
          processed_records: i,
          successful_records: Math.floor(i * 0.95), // 95% de sucesso
          failed_records: Math.floor(i * 0.05), // 5% de falha
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId);
    }

    // Finalizar job
    await supabase
      .from('erp_sync_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        progress: 100,
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId);

  } catch (error) {
    console.error('Erro na simulação de sincronização:', error);
    
    // Marcar job como falhou
    await supabase
      .from('erp_sync_jobs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    // Verificar autenticação
    const authResult = verifyRequestToken(request);
    if (!authResult.valid || !authResult.payload) {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 });
    }

    // Verificar permissões
    const { data: user } = await supabase
      .from('users_unified')
      .select('role, access_permissions, email')
      .eq('id', authResult.payload.userId)
      .single();

    if (!user || (user.role !== 'ADMIN' && !user.access_permissions?.['erp.sync'])) {
      return NextResponse.json({
        success: false,
        error: 'Sem permissão para gerenciar jobs de sincronização'
      }, { status: 403 });
    }

    const body = await request.json();
    const { id, action } = body;

    if (!id || !action) {
      return NextResponse.json({
        success: false,
        error: 'ID do job e ação são obrigatórios'
      }, { status: 400 });
    }

    // Buscar job existente
    const { data: job, error: fetchError } = await supabase
      .from('erp_sync_jobs')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !job) {
      return NextResponse.json({
        success: false,
        error: 'Job não encontrado'
      }, { status: 404 });
    }

    let updateData: any = {
      updated_at: new Date().toISOString()
    };

    switch (action) {
      case 'cancel':
        if (job.status === 'running' || job.status === 'pending') {
          updateData.status = 'cancelled';
          updateData.completed_at = new Date().toISOString();
        } else {
          return NextResponse.json({
            success: false,
            error: 'Job não pode ser cancelado no status atual'
          }, { status: 400 });
        }
        break;

      case 'retry':
        if (job.status === 'failed' || job.status === 'cancelled') {
          updateData.status = 'pending';
          updateData.started_at = null;
          updateData.completed_at = null;
          updateData.progress = 0;
          updateData.processed_records = 0;
          updateData.successful_records = 0;
          updateData.failed_records = 0;
        } else {
          return NextResponse.json({
            success: false,
            error: 'Job não pode ser reexecutado no status atual'
          }, { status: 400 });
        }
        break;

      default:
        return NextResponse.json({
          success: false,
          error: 'Ação inválida'
        }, { status: 400 });
    }

    // Atualizar job
    const { data: updatedJob, error: updateError } = await supabase
      .from('erp_sync_jobs')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Erro ao atualizar job:', updateError);
      return NextResponse.json({
        success: false,
        error: 'Erro ao atualizar job'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      job: updatedJob
    });

  } catch (error) {
    console.error('Erro ao gerenciar job de sincronização:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
}
