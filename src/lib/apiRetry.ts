/**
 * Utilitários para retry de APIs e tratamento de erros
 */

interface RetryOptions {
  maxRetries?: number;
  delay?: number;
  backoff?: boolean;
  timeout?: number;
}

interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
}

/**
 * Executa uma função com retry automático
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const {
    maxRetries = 3,
    delay = 1000,
    backoff = true,
    timeout = 10000
  } = options;

  let lastError: Error | null = null;
  let attempts = 0;

  for (let i = 0; i <= maxRetries; i++) {
    attempts = i + 1;
    
    try {
      // Criar promise com timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Operation timeout after ${timeout}ms`)), timeout);
      });

      // Executar função com timeout
      const result = await Promise.race([fn(), timeoutPromise]);
      
      return {
        success: true,
        data: result,
        attempts
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      console.warn(`⚠️ Attempt ${attempts} failed:`, {
        error: lastError.message,
        willRetry: i < maxRetries
      });

      // Se não é a última tentativa, aguardar antes de tentar novamente
      if (i < maxRetries) {
        const waitTime = backoff ? delay * Math.pow(2, i) : delay;
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  return {
    success: false,
    error: lastError || new Error('Unknown error'),
    attempts
  };
}

/**
 * Wrapper para queries do Supabase com retry
 */
export async function supabaseWithRetry<T>(
  queryFn: () => Promise<{ data: T | null; error: any }>,
  options: RetryOptions = {}
): Promise<{ data: T | null; error: any; attempts: number }> {
  const result = await withRetry(async () => {
    const { data, error } = await queryFn();
    
    if (error) {
      throw new Error(`Supabase error: ${error.message || error.details || 'Unknown error'}`);
    }
    
    return data;
  }, options);

  return {
    data: result.success ? result.data || null : null,
    error: result.success ? null : result.error,
    attempts: result.attempts
  };
}

/**
 * Verifica se um erro é temporário e pode ser retentado
 */
export function isRetryableError(error: any): boolean {
  if (!error) return false;

  const errorMessage = error.message?.toLowerCase() || '';
  const errorCode = error.code?.toLowerCase() || '';

  // Erros de rede que podem ser temporários
  const networkErrors = [
    'fetch failed',
    'network error',
    'timeout',
    'connection refused',
    'connection reset',
    'socket hang up',
    'econnreset',
    'enotfound',
    'etimedout'
  ];

  // Códigos de erro HTTP temporários
  const temporaryHttpCodes = ['500', '502', '503', '504', '408', '429'];

  // Verificar se é um erro de rede
  const isNetworkError = networkErrors.some(netError => 
    errorMessage.includes(netError)
  );

  // Verificar se é um código HTTP temporário
  const isTemporaryHttpError = temporaryHttpCodes.some(code => 
    errorCode.includes(code) || errorMessage.includes(code)
  );

  return isNetworkError || isTemporaryHttpError;
}

/**
 * Cria um circuit breaker simples para APIs
 */
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private maxFailures = 5,
    private resetTimeout = 60000 // 1 minuto
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.maxFailures) {
      this.state = 'open';
    }
  }

  getState() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime
    };
  }
}

// Circuit breaker global para APIs
export const apiCircuitBreaker = new CircuitBreaker();

/**
 * Wrapper para APIs com circuit breaker e retry
 */
export async function resilientApiCall<T>(
  fn: () => Promise<T>,
  options: RetryOptions & { useCircuitBreaker?: boolean } = {}
): Promise<RetryResult<T>> {
  const { useCircuitBreaker = true, ...retryOptions } = options;

  const executeWithRetry = () => withRetry(fn, retryOptions);

  if (useCircuitBreaker) {
    try {
      const result = await apiCircuitBreaker.execute(executeWithRetry);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        attempts: 1
      };
    }
  } else {
    return executeWithRetry();
  }
}

/**
 * Utilitário para logging estruturado de erros
 */
export function logError(context: string, error: any, metadata?: Record<string, any>) {
  const errorInfo = {
    context,
    message: error?.message || 'Unknown error',
    stack: error?.stack,
    code: error?.code,
    details: error?.details || error?.hint,
    timestamp: new Date().toISOString(),
    ...metadata
  };

  console.error(`❌ ${context}:`, errorInfo);
  
  // Em produção, aqui você poderia enviar para um serviço de monitoramento
  // como Sentry, LogRocket, etc.
}

/**
 * Utilitário para logging de performance
 */
export function logPerformance(operation: string, startTime: number, metadata?: Record<string, any>) {
  const duration = Date.now() - startTime;
  const performanceInfo = {
    operation,
    duration: `${duration}ms`,
    timestamp: new Date().toISOString(),
    ...metadata
  };

  if (duration > 5000) {
    console.warn(`⚠️ Slow operation: ${operation}`, performanceInfo);
  } else {
    console.log(`⚡ ${operation} completed in ${duration}ms`);
  }
}

export default {
  withRetry,
  supabaseWithRetry,
  isRetryableError,
  resilientApiCall,
  logError,
  logPerformance,
  apiCircuitBreaker
};
