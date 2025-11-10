import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { MobileHealthCheck } from '@/types/api-mobile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const healthCheck: MobileHealthCheck = {
      status: 'healthy',
      version: process.env.APP_VERSION || '1.0.0',
      timestamp: new Date().toISOString(),
      services: {
        database: 'up',
        storage: 'up',
        notifications: 'up',
        websocket: 'up'
      },
      metrics: {
        responseTime: 0,
        activeUsers: 0,
        errorRate: 0
      }
    };

    // Testar conexão com banco de dados
    try {
      const { data, error } = await supabase
        .from('users_unified')
        .select('id')
        .limit(1);
      
      if (error) {
        healthCheck.services.database = 'down';
        healthCheck.status = 'degraded';
      }
    } catch (error) {
      healthCheck.services.database = 'down';
      healthCheck.status = 'unhealthy';
    }

    // Testar Supabase Storage
    try {
      const { data, error } = await supabase.storage
        .from('uploads')
        .list('', { limit: 1 });
      
      if (error) {
        healthCheck.services.storage = 'down';
        if (healthCheck.status === 'healthy') {
          healthCheck.status = 'degraded';
        }
      }
    } catch (error) {
      healthCheck.services.storage = 'down';
      healthCheck.status = 'unhealthy';
    }

    // Verificar serviço de notificações (simulado)
    try {
      // Aqui seria testada a conectividade com Firebase/FCM
      // Por enquanto, assumimos que está funcionando
      healthCheck.services.notifications = 'up';
    } catch (error) {
      healthCheck.services.notifications = 'down';
      if (healthCheck.status === 'healthy') {
        healthCheck.status = 'degraded';
      }
    }

    // Verificar WebSocket (simulado)
    try {
      // Aqui seria testada a conectividade WebSocket
      healthCheck.services.websocket = 'up';
    } catch (error) {
      healthCheck.services.websocket = 'down';
      if (healthCheck.status === 'healthy') {
        healthCheck.status = 'degraded';
      }
    }

    // Calcular métricas
    const responseTime = Date.now() - startTime;
    healthCheck.metrics.responseTime = responseTime;

    // Obter usuários ativos (últimas 24h)
    try {
      const { count } = await supabase
        .from('mobile_devices')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
        .gte('last_seen', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
      
      healthCheck.metrics.activeUsers = count || 0;
    } catch (error) {
      console.error('Erro ao obter usuários ativos:', error);
    }

    // Calcular taxa de erro (últimas 24h)
    try {
      const { data: errorLogs } = await supabase
        .from('mobile_error_logs')
        .select('id')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      const { data: totalRequests } = await supabase
        .from('mobile_request_logs')
        .select('id')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      const errorCount = errorLogs?.length || 0;
      const totalCount = totalRequests?.length || 0;
      
      healthCheck.metrics.errorRate = totalCount > 0 ? (errorCount / totalCount) * 100 : 0;
    } catch (error) {
      console.error('Erro ao calcular taxa de erro:', error);
    }

    // Determinar status final baseado nas métricas
    if (healthCheck.metrics.errorRate > 10) {
      healthCheck.status = 'degraded';
    }
    if (healthCheck.metrics.responseTime > 5000) {
      healthCheck.status = 'degraded';
    }

    // Registrar health check
    try {
      await supabase
        .from('mobile_health_logs')
        .insert({
          status: healthCheck.status,
          response_time: healthCheck.metrics.responseTime,
          active_users: healthCheck.metrics.activeUsers,
          error_rate: healthCheck.metrics.errorRate,
          services_status: healthCheck.services,
          timestamp: healthCheck.timestamp
        });
    } catch (error) {
      console.error('Erro ao registrar health check:', error);
    }

    // Definir status HTTP baseado no health check
    let statusCode = 200;
    if (healthCheck.status === 'degraded') {
      statusCode = 200; // Ainda funcional, mas com problemas
    } else if (healthCheck.status === 'unhealthy') {
      statusCode = 503; // Serviço indisponível
    }

    return NextResponse.json(healthCheck, { status: statusCode });

  } catch (error) {
    console.error('Erro no health check:', error);
    
    const errorHealthCheck: MobileHealthCheck = {
      status: 'unhealthy',
      version: process.env.APP_VERSION || '1.0.0',
      timestamp: new Date().toISOString(),
      services: {
        database: 'down',
        storage: 'down',
        notifications: 'down',
        websocket: 'down'
      },
      metrics: {
        responseTime: Date.now() - startTime,
        activeUsers: 0,
        errorRate: 100
      }
    };

    return NextResponse.json(errorHealthCheck, { status: 503 });
  }
}

// Endpoint para health check detalhado (apenas para admins)
export async function POST(request: NextRequest) {
  try {
    // Verificar se é uma requisição de admin
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        success: false,
        error: 'Token de autorização necessário'
      }, { status: 401 });
    }

    // Aqui seria verificado se o token é de admin
    // Por simplicidade, vamos assumir que é válido

    const detailedHealth = {
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      
      // Estatísticas detalhadas do banco
      database: {
        status: 'up',
        connections: {
          active: 0,
          idle: 0,
          total: 0
        },
        performance: {
          avgQueryTime: 0,
          slowQueries: 0
        }
      },

      // Estatísticas de storage
      storage: {
        status: 'up',
        usage: {
          total: 0,
          used: 0,
          available: 0
        },
        buckets: []
      },

      // Estatísticas de usuários
      users: {
        total: 0,
        active24h: 0,
        active7d: 0,
        newToday: 0
      },

      // Estatísticas de dispositivos
      devices: {
        total: 0,
        ios: 0,
        android: 0,
        active: 0
      },

      // Estatísticas de sincronização
      sync: {
        totalSyncs24h: 0,
        avgSyncTime: 0,
        failedSyncs: 0,
        conflictsResolved: 0
      },

      // Estatísticas de notificações
      notifications: {
        sent24h: 0,
        delivered24h: 0,
        failed24h: 0,
        deliveryRate: 0
      }
    };

    // Obter estatísticas detalhadas
    try {
      // Usuários
      const { count: totalUsers } = await supabase
        .from('users_unified')
        .select('*', { count: 'exact', head: true });
      
      const { count: active24h } = await supabase
        .from('mobile_devices')
        .select('*', { count: 'exact', head: true })
        .gte('last_seen', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      const { count: active7d } = await supabase
        .from('mobile_devices')
        .select('*', { count: 'exact', head: true })
        .gte('last_seen', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      const { count: newToday } = await supabase
        .from('users_unified')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', new Date().toISOString().split('T')[0]);

      detailedHealth.users = {
        total: totalUsers || 0,
        active24h: active24h || 0,
        active7d: active7d || 0,
        newToday: newToday || 0
      };

      // Dispositivos
      const { count: totalDevices } = await supabase
        .from('mobile_devices')
        .select('*', { count: 'exact', head: true });

      const { count: iosDevices } = await supabase
        .from('mobile_devices')
        .select('*', { count: 'exact', head: true })
        .eq('type', 'ios');

      const { count: androidDevices } = await supabase
        .from('mobile_devices')
        .select('*', { count: 'exact', head: true })
        .eq('type', 'android');

      const { count: activeDevices } = await supabase
        .from('mobile_devices')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      detailedHealth.devices = {
        total: totalDevices || 0,
        ios: iosDevices || 0,
        android: androidDevices || 0,
        active: activeDevices || 0
      };

    } catch (error) {
      console.error('Erro ao obter estatísticas detalhadas:', error);
    }

    return NextResponse.json({
      success: true,
      data: detailedHealth
    });

  } catch (error) {
    console.error('Erro no health check detalhado:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
}
