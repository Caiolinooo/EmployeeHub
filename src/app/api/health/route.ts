import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// GET - Health check da API
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Verificar se o Supabase está acessível
    let supabaseHealthy = false;
    let supabaseLatency = 0;
    
    try {
      const supabaseStart = Date.now();
      
      // Fazer uma query simples para testar conectividade
      const { data, error } = await supabaseAdmin
        .from('users_unified')
        .select('id')
        .limit(1)
        .single();
      
      supabaseLatency = Date.now() - supabaseStart;
      supabaseHealthy = !error || error.code === 'PGRST116'; // PGRST116 = no rows returned (ok)
      
    } catch (supabaseError) {
      console.warn('Supabase health check failed:', supabaseError);
      supabaseHealthy = false;
    }

    // Verificar memória e performance
    const memoryUsage = process.memoryUsage();
    const totalLatency = Date.now() - startTime;

    // Determinar status geral
    const isHealthy = supabaseHealthy && totalLatency < 5000; // 5 segundos max

    const healthData = {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      latency: {
        total: totalLatency,
        supabase: supabaseLatency
      },
      services: {
        supabase: {
          status: supabaseHealthy ? 'healthy' : 'unhealthy',
          latency: supabaseLatency
        }
      },
      memory: {
        rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
        external: Math.round(memoryUsage.external / 1024 / 1024) // MB
      },
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      }
    };

    // Log para monitoramento
    if (!isHealthy) {
      console.warn('🚨 Health check failed:', {
        supabaseHealthy,
        totalLatency,
        memoryUsage: healthData.memory
      });
    } else {
      console.log(`✅ Health check passed in ${totalLatency}ms`);
    }

    return NextResponse.json(healthData, {
      status: isHealthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

  } catch (error) {
    console.error('❌ Health check critical error:', error);
    
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      latency: {
        total: Date.now() - startTime,
        supabase: 0
      }
    }, { 
      status: 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  }
}

// HEAD - Health check simples (apenas status)
export async function HEAD(request: NextRequest) {
  try {
    // Verificação rápida apenas do Supabase
    const { error } = await supabaseAdmin
      .from('users_unified')
      .select('id')
      .limit(1)
      .single();
    
    const isHealthy = !error || error.code === 'PGRST116';
    
    return new NextResponse(null, {
      status: isHealthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
  } catch (error) {
    return new NextResponse(null, {
      status: 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  }
}
