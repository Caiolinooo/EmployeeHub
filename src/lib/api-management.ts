import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export interface APIKey {
  id: string;
  name: string;
  key: string;
  permissions: string[];
  created_at: string;
  last_used: string | null;
  active: boolean;
  usage_count: number;
  rate_limit: number;
  user_id: string;
}

export interface APIUsage {
  id: string;
  api_key_id: string;
  endpoint: string;
  method: string;
  ip_address: string;
  user_agent: string;
  response_status: number;
  response_time: number;
  timestamp: string;
}

export class APIKeyManager {
  private static instance: APIKeyManager;
  private rateLimitMap = new Map<string, { count: number; resetTime: number }>();

  static getInstance(): APIKeyManager {
    if (!APIKeyManager.instance) {
      APIKeyManager.instance = new APIKeyManager();
    }
    return APIKeyManager.instance;
  }

  // Gerar nova chave API
  async generateAPIKey(name: string, permissions: string[], userId: string, rateLimit = 1000): Promise<APIKey> {
    const keyId = crypto.randomUUID();
    const apiKey = `abz_${crypto.randomBytes(32).toString('hex')}`;
    
    const newKey: Omit<APIKey, 'id'> = {
      name,
      key: apiKey,
      permissions,
      created_at: new Date().toISOString(),
      last_used: null,
      active: true,
      usage_count: 0,
      rate_limit: rateLimit,
      user_id: userId
    };

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('api_keys')
      .insert([{ id: keyId, ...newKey }])
      .select()
      .single();

    if (error) throw new Error(`Erro ao criar chave API: ${error.message}`);
    
    return data;
  }

  // Validar chave API
  async validateAPIKey(apiKey: string): Promise<{ valid: boolean; key?: APIKey; error?: string }> {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('api_keys')
        .select('*')
        .eq('key', apiKey)
        .eq('active', true)
        .single();

      if (error || !data) {
        return { valid: false, error: 'Chave API inválida ou inativa' };
      }

      // Verificar rate limiting
      const rateLimitCheck = this.checkRateLimit(apiKey, data.rate_limit);
      if (!rateLimitCheck.allowed) {
        return { valid: false, error: 'Rate limit excedido' };
      }

      // Atualizar último uso
      await this.updateLastUsed(data.id);

      return { valid: true, key: data };
    } catch (error) {
      return { valid: false, error: 'Erro interno na validação' };
    }
  }

  // Verificar rate limiting
  private checkRateLimit(apiKey: string, limit: number): { allowed: boolean; remaining: number } {
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minuto
    const current = this.rateLimitMap.get(apiKey);

    if (!current || now > current.resetTime) {
      this.rateLimitMap.set(apiKey, { count: 1, resetTime: now + windowMs });
      return { allowed: true, remaining: limit - 1 };
    }

    if (current.count >= limit) {
      return { allowed: false, remaining: 0 };
    }

    current.count++;
    return { allowed: true, remaining: limit - current.count };
  }

  // Atualizar último uso
  private async updateLastUsed(keyId: string): Promise<void> {
    const supabase = getSupabaseClient();
    await supabase
      .from('api_keys')
      .update({
        last_used: new Date().toISOString(),
        usage_count: supabase.sql`usage_count + 1`
      })
      .eq('id', keyId);
  }

  // Registrar uso da API
  async logAPIUsage(
    apiKeyId: string,
    endpoint: string,
    method: string,
    ipAddress: string,
    userAgent: string,
    responseStatus: number,
    responseTime: number
  ): Promise<void> {
    const usage: Omit<APIUsage, 'id'> = {
      api_key_id: apiKeyId,
      endpoint,
      method,
      ip_address: ipAddress,
      user_agent: userAgent,
      response_status: responseStatus,
      response_time: responseTime,
      timestamp: new Date().toISOString()
    };

    const supabase = getSupabaseClient();
    await supabase.from('api_usage').insert([usage]);
  }

  // Listar chaves API do usuário
  async getUserAPIKeys(userId: string): Promise<APIKey[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('api_keys')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Erro ao buscar chaves: ${error.message}`);
    return data || [];
  }

  // Ativar/Desativar chave
  async toggleAPIKey(keyId: string, userId: string): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('api_keys')
      .update({ active: supabase.sql`NOT active` })
      .eq('id', keyId)
      .eq('user_id', userId);

    if (error) throw new Error(`Erro ao alterar status: ${error.message}`);
  }

  // Deletar chave API
  async deleteAPIKey(keyId: string, userId: string): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('api_keys')
      .delete()
      .eq('id', keyId)
      .eq('user_id', userId);

    if (error) throw new Error(`Erro ao deletar chave: ${error.message}`);
  }

  // Obter estatísticas
  async getAPIStats(userId?: string): Promise<{
    totalRequests: number;
    requestsToday: number;
    activeKeys: number;
    errorRate: number;
  }> {
    const today = new Date().toISOString().split('T')[0];
    
    // Total de requisições
    let totalQuery = supabase.from('api_usage').select('*', { count: 'exact', head: true });
    let todayQuery = supabase.from('api_usage').select('*', { count: 'exact', head: true })
      .gte('timestamp', `${today}T00:00:00.000Z`);
    let keysQuery = supabase.from('api_keys').select('*', { count: 'exact', head: true })
      .eq('active', true);
    let errorsQuery = supabase.from('api_usage').select('*', { count: 'exact', head: true })
      .gte('response_status', 400);

    if (userId) {
      totalQuery = totalQuery.eq('api_key_id', userId);
      todayQuery = todayQuery.eq('api_key_id', userId);
      keysQuery = keysQuery.eq('user_id', userId);
      errorsQuery = errorsQuery.eq('api_key_id', userId);
    }

    const [totalResult, todayResult, keysResult, errorsResult] = await Promise.all([
      totalQuery,
      todayQuery,
      keysQuery,
      errorsQuery
    ]);

    const totalRequests = totalResult.count || 0;
    const requestsToday = todayResult.count || 0;
    const activeKeys = keysResult.count || 0;
    const errorCount = errorsResult.count || 0;
    const errorRate = totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0;

    return {
      totalRequests,
      requestsToday,
      activeKeys,
      errorRate: Math.round(errorRate * 100) / 100
    };
  }

  // Verificar permissões
  hasPermission(apiKey: APIKey, requiredPermission: string): boolean {
    return apiKey.permissions.includes(requiredPermission) || apiKey.permissions.includes('*');
  }

  // Middleware para Express
  createMiddleware() {
    return async (req: any, res: any, next: any) => {
      const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
      
      if (!apiKey) {
        return res.status(401).json({ error: 'API key required' });
      }

      const startTime = Date.now();
      const validation = await this.validateAPIKey(apiKey);
      
      if (!validation.valid) {
        return res.status(401).json({ error: validation.error });
      }

      req.apiKey = validation.key;
      
      // Log da requisição
      res.on('finish', () => {
        const responseTime = Date.now() - startTime;
        this.logAPIUsage(
          validation.key!.id,
          req.path,
          req.method,
          req.ip,
          req.get('User-Agent') || '',
          res.statusCode,
          responseTime
        );
      });

      next();
    };
  }
}

export default APIKeyManager.getInstance();
