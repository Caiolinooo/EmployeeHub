import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyToken } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação
    const authResult = await verifyToken(request);
    if (!authResult.valid || !authResult.payload) {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 });
    }

    // Verificar permissões
    const { data: user } = await supabase
      .from('users_unified')
      .select('role, access_permissions')
      .eq('id', authResult.payload.userId)
      .single();

    if (!user || (user.role !== 'ADMIN' && !user.access_permissions?.['erp.sync'])) {
      return NextResponse.json({
        success: false,
        error: 'Sem permissão para iniciar sincronização'
      }, { status: 403 });
    }

    const body = await request.json();
    const { connectionId, module, type = 'import' } = body;

    // Validar campos obrigatórios
    if (!connectionId || !module) {
      return NextResponse.json({
        success: false,
        error: 'connectionId e module são obrigatórios'
      }, { status: 400 });
    }

    // Verificar se a conexão existe e está ativa
    const { data: connection, error: connectionError } = await supabase
      .from('erp_connections')
      .select('id, name, status, type')
      .eq('id', connectionId)
      .eq('is_active', true)
      .single();

    if (connectionError || !connection) {
      return NextResponse.json({
        success: false,
        error: 'Conexão ERP não encontrada ou inativa'
      }, { status: 404 });
    }

    if (connection.status !== 'connected') {
      return NextResponse.json({
        success: false,
        error: 'Conexão ERP não está conectada'
      }, { status: 400 });
    }

    // Verificar se já existe um job em execução para esta conexão e módulo
    const { data: runningJob } = await supabase
      .from('erp_sync_jobs')
      .select('id')
      .eq('connection_id', connectionId)
      .eq('module', module)
      .eq('status', 'running')
      .single();

    if (runningJob) {
      return NextResponse.json({
        success: false,
        error: 'Já existe uma sincronização em execução para este módulo'
      }, { status: 409 });
    }

    // Criar novo job de sincronização
    const { data: job, error: jobError } = await supabase
      .from('erp_sync_jobs')
      .insert({
        connection_id: connectionId,
        module,
        type,
        status: 'pending',
        total_records: 0,
        processed_records: 0,
        successful_records: 0,
        failed_records: 0,
        progress: 0,
        created_by: authResult.payload.userId,
        is_scheduled: false,
        config: {
          batchSize: 100,
          timeout: 300,
          retryAttempts: 3,
          retryDelay: 30,
          skipErrors: false,
          validateData: true,
          backupBeforeSync: true,
          notifyOnCompletion: true,
          notifyOnError: true,
          emailRecipients: [user.email]
        },
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

    // Iniciar sincronização em background
    startSyncProcess(job.id, connectionId, module, type);

    // Log da ação
    await supabase
      .from('erp_integration_logs')
      .insert({
        connection_id: connectionId,
        job_id: job.id,
        level: 'info',
        message: `Sincronização iniciada para módulo ${module}`,
        details: { module, type, jobId: job.id },
        timestamp: new Date().toISOString(),
        user_id: authResult.payload.userId,
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent')
      });

    return NextResponse.json({
      success: true,
      message: 'Sincronização iniciada com sucesso',
      jobId: job.id
    });

  } catch (error) {
    console.error('Erro ao iniciar sincronização:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
}

async function startSyncProcess(jobId: string, connectionId: string, module: string, type: string) {
  try {
    // Atualizar status para "running"
    await supabase
      .from('erp_sync_jobs')
      .update({
        status: 'running',
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId);

    // Log início da sincronização
    await supabase
      .from('erp_integration_logs')
      .insert({
        connection_id: connectionId,
        job_id: jobId,
        level: 'info',
        message: `Iniciando sincronização do módulo ${module}`,
        timestamp: new Date().toISOString()
      });

    // Simular processo de sincronização baseado no módulo
    let totalRecords = 0;
    let processedRecords = 0;
    let successfulRecords = 0;
    let failedRecords = 0;

    switch (module) {
      case 'funcionarios':
        totalRecords = await syncEmployees(connectionId, jobId);
        break;
      case 'folhaPagamento':
        totalRecords = await syncPayroll(connectionId, jobId);
        break;
      case 'departamentos':
        totalRecords = await syncDepartments(connectionId, jobId);
        break;
      default:
        totalRecords = 100; // Valor padrão para simulação
    }

    // Atualizar total de registros
    await supabase
      .from('erp_sync_jobs')
      .update({
        total_records: totalRecords,
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId);

    // Simular processamento com progresso
    for (let i = 0; i <= totalRecords; i += 10) {
      const currentProcessed = Math.min(i, totalRecords);
      const currentSuccessful = Math.floor(currentProcessed * 0.95); // 95% de sucesso
      const currentFailed = currentProcessed - currentSuccessful;
      const progress = Math.floor((currentProcessed / totalRecords) * 100);

      await supabase
        .from('erp_sync_jobs')
        .update({
          processed_records: currentProcessed,
          successful_records: currentSuccessful,
          failed_records: currentFailed,
          progress,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId);

      // Simular delay de processamento
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Finalizar sincronização
    await supabase
      .from('erp_sync_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        progress: 100,
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId);

    // Log conclusão
    await supabase
      .from('erp_integration_logs')
      .insert({
        connection_id: connectionId,
        job_id: jobId,
        level: 'info',
        message: `Sincronização do módulo ${module} concluída com sucesso`,
        details: {
          totalRecords,
          successfulRecords: Math.floor(totalRecords * 0.95),
          failedRecords: Math.floor(totalRecords * 0.05)
        },
        timestamp: new Date().toISOString()
      });

  } catch (error) {
    console.error('Erro no processo de sincronização:', error);

    // Marcar job como falhou
    await supabase
      .from('erp_sync_jobs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId);

    // Log erro
    await supabase
      .from('erp_integration_logs')
      .insert({
        connection_id: connectionId,
        job_id: jobId,
        level: 'error',
        message: `Erro na sincronização do módulo ${module}`,
        details: { error: error.message },
        timestamp: new Date().toISOString()
      });
  }
}

async function syncEmployees(connectionId: string, jobId: string): Promise<number> {
  // Simular sincronização de funcionários
  // Em produção, aqui seria feita a conexão real com o ERP
  
  const mockEmployees = [
    { code: '001', name: 'João Silva', email: 'joao@empresa.com', department: 'TI' },
    { code: '002', name: 'Maria Santos', email: 'maria@empresa.com', department: 'RH' },
    { code: '003', name: 'Pedro Costa', email: 'pedro@empresa.com', department: 'Vendas' }
  ];

  // Simular inserção/atualização no banco
  for (const employee of mockEmployees) {
    await supabase
      .from('erp_employees')
      .upsert({
        connection_id: connectionId,
        employee_code: employee.code,
        name: employee.name,
        email: employee.email,
        department: employee.department,
        status: 'active',
        last_updated: new Date().toISOString(),
        erp_data: employee
      }, {
        onConflict: 'connection_id,employee_code'
      });
  }

  return mockEmployees.length;
}

async function syncPayroll(connectionId: string, jobId: string): Promise<number> {
  // Simular sincronização de folha de pagamento
  const mockPayroll = [
    { employeeCode: '001', month: '2025-01', grossSalary: 5000, netSalary: 4000 },
    { employeeCode: '002', month: '2025-01', grossSalary: 4500, netSalary: 3600 },
    { employeeCode: '003', month: '2025-01', grossSalary: 3500, netSalary: 2800 }
  ];

  for (const payroll of mockPayroll) {
    await supabase
      .from('erp_payroll')
      .upsert({
        connection_id: connectionId,
        employee_code: payroll.employeeCode,
        reference_month: payroll.month,
        gross_salary: payroll.grossSalary,
        net_salary: payroll.netSalary,
        status: 'calculated',
        last_updated: new Date().toISOString(),
        erp_data: payroll
      }, {
        onConflict: 'connection_id,employee_code,reference_month'
      });
  }

  return mockPayroll.length;
}

async function syncDepartments(connectionId: string, jobId: string): Promise<number> {
  // Simular sincronização de departamentos
  const mockDepartments = [
    { code: 'TI', name: 'Tecnologia da Informação', costCenter: 'CC001' },
    { code: 'RH', name: 'Recursos Humanos', costCenter: 'CC002' },
    { code: 'VEN', name: 'Vendas', costCenter: 'CC003' }
  ];

  for (const dept of mockDepartments) {
    await supabase
      .from('erp_departments')
      .upsert({
        connection_id: connectionId,
        code: dept.code,
        name: dept.name,
        cost_center: dept.costCenter,
        is_active: true,
        last_updated: new Date().toISOString(),
        erp_data: dept
      }, {
        onConflict: 'connection_id,code'
      });
  }

  return mockDepartments.length;
}
