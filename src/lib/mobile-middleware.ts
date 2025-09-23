import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { MobileMetrics, MobileErrorReport } from '@/types/api-mobile';

// Cache em memória para rate limiting (em produção usar Redis)
const rateLimitCache = new Map<string, { count: number; resetTime: number }>();

export interface RateLimitConfig {
  requests: number;
  window: number; // em segundos
  skipSuccessfulAuth?: boolean;
}

export interface MobileMiddlewareConfig {
  rateLimit?: RateLimitConfig;
  logRequests?: boolean;
  logErrors?: boolean;
  requireAuth?: boolean;
  allowedVersions?: string[];
  maintenanceMode?: boolean;
}

export class MobileMiddleware {
  private config: MobileMiddlewareConfig;

  constructor(config: MobileMiddlewareConfig = {}) {
    this.config = {
      logRequests: true,
      logErrors: true,
      requireAuth: true,
      ...config
    };
  }

  async handle(
    request: NextRequest,
    handler: (request: NextRequest) => Promise<NextResponse>
  ): Promise<NextResponse> {
    const startTime = Date.now();
    let response: NextResponse;
    let error: Error | null = null;

    try {
      // 1. Verificar modo de manutenção
      if (this.config.maintenanceMode) {
        return NextResponse.json({
          success: false,
          error: 'Sistema em manutenção. Tente novamente mais tarde.',
          maintenanceMode: true
        }, { status: 503 });
      }

      // 2. Verificar versão do app
      if (this.config.allowedVersions) {
        const appVersion = request.headers.get('app-version');
        if (!appVersion || !this.config.allowedVersions.includes(appVersion)) {
          return NextResponse.json({
            success: false,
            error: 'Versão do aplicativo não suportada. Atualize o app.',
            forceUpdate: true,
            minVersion: this.config.allowedVersions[0]
          }, { status: 426 });
        }
      }

      // 3. Rate limiting
      if (this.config.rateLimit) {
        const rateLimitResult = await this.checkRateLimit(request);
        if (!rateLimitResult.allowed) {
          return NextResponse.json({
            success: false,
            error: 'Muitas requisições. Tente novamente mais tarde.',
            retryAfter: rateLimitResult.retryAfter
          }, { 
            status: 429,
            headers: {
              'Retry-After': rateLimitResult.retryAfter.toString(),
              'X-RateLimit-Limit': this.config.rateLimit.requests.toString(),
              'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
              'X-RateLimit-Reset': rateLimitResult.resetTime.toString()
            }
          });
        }
      }

      // 4. Executar handler
      response = await handler(request);

      // 5. Log da requisição bem-sucedida
      if (this.config.logRequests) {
        await this.logRequest(request, response, Date.now() - startTime);
      }

      return response;

    } catch (err) {
      error = err as Error;
      console.error('Erro no middleware mobile:', error);

      // Log do erro
      if (this.config.logErrors) {
        await this.logError(request, error, Date.now() - startTime);
      }

      // Resposta de erro padronizada
      response = NextResponse.json({
        success: false,
        error: 'Erro interno do servidor',
        timestamp: new Date().toISOString()
      }, { status: 500 });

      return response;
    }
  }

  private async checkRateLimit(request: NextRequest): Promise<{
    allowed: boolean;
    remaining: number;
    retryAfter: number;
    resetTime: number;
  }> {
    if (!this.config.rateLimit) {
      return { allowed: true, remaining: 0, retryAfter: 0, resetTime: 0 };
    }

    // Identificar cliente (IP + User-Agent ou token)
    const clientId = this.getClientId(request);
    const now = Date.now();
    const windowMs = this.config.rateLimit.window * 1000;

    // Verificar cache
    const cached = rateLimitCache.get(clientId);
    
    if (!cached || now > cached.resetTime) {
      // Nova janela de tempo
      rateLimitCache.set(clientId, {
        count: 1,
        resetTime: now + windowMs
      });
      
      return {
        allowed: true,
        remaining: this.config.rateLimit.requests - 1,
        retryAfter: 0,
        resetTime: now + windowMs
      };
    }

    // Incrementar contador
    cached.count++;
    rateLimitCache.set(clientId, cached);

    const allowed = cached.count <= this.config.rateLimit.requests;
    const remaining = Math.max(0, this.config.rateLimit.requests - cached.count);
    const retryAfter = Math.ceil((cached.resetTime - now) / 1000);

    return {
      allowed,
      remaining,
      retryAfter,
      resetTime: cached.resetTime
    };
  }

  private getClientId(request: NextRequest): string {
    // Priorizar token de autenticação se disponível
    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      return `auth:${authHeader.substring(0, 20)}`;
    }

    // Usar IP + User-Agent
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    return `ip:${ip}:${userAgent.substring(0, 50)}`;
  }

  private async logRequest(
    request: NextRequest,
    response: NextResponse,
    responseTime: number
  ): Promise<void> {
    try {
      const metrics: MobileMetrics = {
        endpoint: new URL(request.url).pathname,
        method: request.method,
        statusCode: response.status,
        responseTime,
        userId: this.extractUserId(request),
        deviceId: this.extractDeviceId(request),
        timestamp: new Date().toISOString(),
        userAgent: request.headers.get('user-agent') || undefined
      };

      // Salvar no banco (não bloquear a resposta)
      supabase
        .from('mobile_request_logs')
        .insert(metrics)
        .then(({ error }) => {
          if (error) {
            console.error('Erro ao salvar log de requisição:', error);
          }
        });

    } catch (error) {
      console.error('Erro ao criar log de requisição:', error);
    }
  }

  private async logError(
    request: NextRequest,
    error: Error,
    responseTime: number
  ): Promise<void> {
    try {
      const errorLog = {
        endpoint: new URL(request.url).pathname,
        method: request.method,
        error_message: error.message,
        error_stack: error.stack,
        response_time: responseTime,
        user_id: this.extractUserId(request),
        device_id: this.extractDeviceId(request),
        timestamp: new Date().toISOString(),
        user_agent: request.headers.get('user-agent'),
        ip_address: request.headers.get('x-forwarded-for') || 
                   request.headers.get('x-real-ip') || 
                   'unknown'
      };

      // Salvar no banco (não bloquear a resposta)
      supabase
        .from('mobile_error_logs')
        .insert(errorLog)
        .then(({ error: logError }) => {
          if (logError) {
            console.error('Erro ao salvar log de erro:', logError);
          }
        });

    } catch (logError) {
      console.error('Erro ao criar log de erro:', logError);
    }
  }

  private extractUserId(request: NextRequest): string | undefined {
    try {
      const authHeader = request.headers.get('authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return undefined;
      }

      const token = authHeader.substring(7);
      // Aqui seria decodificado o JWT para extrair o userId
      // Por simplicidade, vamos retornar undefined
      return undefined;
    } catch {
      return undefined;
    }
  }

  private extractDeviceId(request: NextRequest): string | undefined {
    return request.headers.get('device-id') || undefined;
  }
}

// Função helper para criar middleware com configuração
export function createMobileMiddleware(config?: MobileMiddlewareConfig) {
  const middleware = new MobileMiddleware(config);
  
  return (handler: (request: NextRequest) => Promise<NextResponse>) => {
    return (request: NextRequest) => middleware.handle(request, handler);
  };
}

// Configurações pré-definidas
export const mobileMiddlewareConfigs = {
  // Para endpoints de autenticação
  auth: {
    rateLimit: { requests: 5, window: 60 }, // 5 tentativas por minuto
    requireAuth: false,
    logRequests: true,
    logErrors: true
  },

  // Para endpoints de sincronização
  sync: {
    rateLimit: { requests: 10, window: 60 }, // 10 syncs por minuto
    requireAuth: true,
    logRequests: true,
    logErrors: true
  },

  // Para uploads
  upload: {
    rateLimit: { requests: 20, window: 300 }, // 20 uploads por 5 minutos
    requireAuth: true,
    logRequests: true,
    logErrors: true
  },

  // Para notificações push
  notifications: {
    rateLimit: { requests: 100, window: 60 }, // 100 notificações por minuto
    requireAuth: true,
    logRequests: true,
    logErrors: true
  },

  // Para health check
  health: {
    rateLimit: { requests: 60, window: 60 }, // 1 por segundo
    requireAuth: false,
    logRequests: false,
    logErrors: true
  }
};

// Função para reportar erros do cliente mobile
export async function reportMobileError(errorReport: MobileErrorReport): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('mobile_client_errors')
      .insert({
        id: errorReport.id,
        user_id: errorReport.userId,
        device_id: errorReport.deviceId,
        app_version: errorReport.appVersion,
        error_message: errorReport.error.message,
        error_stack: errorReport.error.stack,
        error_type: errorReport.error.type,
        screen: errorReport.context.screen,
        action: errorReport.context.action,
        platform: errorReport.device.platform,
        device_version: errorReport.device.version,
        device_model: errorReport.device.model,
        timestamp: errorReport.context.timestamp,
        created_at: new Date().toISOString()
      });

    return !error;
  } catch (error) {
    console.error('Erro ao reportar erro do cliente:', error);
    return false;
  }
}

// Limpeza periódica do cache de rate limiting
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitCache.entries()) {
    if (now > value.resetTime) {
      rateLimitCache.delete(key);
    }
  }
}, 60000); // Limpar a cada minuto
