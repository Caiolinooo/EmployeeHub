/**
 * Módulo para gerenciamento seguro de credenciais
 * Implementa um sistema de cache e recuperação segura de credenciais do Supabase
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { SECURITY_SALT, SUPABASE_KEY_HASH } from './security-config';

// Interface para credenciais
interface Credential {
  key: string;
  value: string;
  description?: string;
  is_encrypted: boolean;
}

// Cache de credenciais
const credentialsCache = new Map<string, string>();

// Cliente Supabase
let supabaseClient: ReturnType<typeof createClient> | null = null;

/**
 * Inicializa o cliente Supabase com a chave de serviço
 * @param supabaseUrl URL do Supabase
 * @param supabaseKey Chave de serviço do Supabase (opcional)
 * @returns Cliente Supabase inicializado
 */
export function initializeSupabaseClient(
  supabaseUrl: string = process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  supabaseKey: string = process.env.SUPABASE_SERVICE_KEY || ''
) {
  // Verificar se a chave fornecida é válida
  if (supabaseKey) {
    const keyHash = crypto.createHash('md5').update(supabaseKey).digest('hex');
    if (keyHash !== SUPABASE_KEY_HASH) {
      console.warn('Aviso: Hash da chave Supabase não corresponde ao esperado');
    }
  }

  // Criar cliente Supabase
  supabaseClient = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  return supabaseClient;
}

/**
 * Descriptografa um valor criptografado
 * @param encryptedValue Valor criptografado
 * @param salt Salt para descriptografia
 * @returns Valor descriptografado
 */
export function decryptValue(encryptedValue: string, salt: string = SECURITY_SALT): string {
  if (!encryptedValue) return '';
  
  // Separar IV e valor criptografado
  const parts = encryptedValue.split(':');
  if (parts.length !== 2) return '';
  
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts[1];
  
  // Criar um hash MD5 do salt para usar como chave
  const key = crypto.createHash('md5').update(salt).digest('hex').slice(0, 32);
  
  try {
    // Criar decipher
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key), iv);
    
    // Descriptografar o valor
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Erro ao descriptografar valor:', error);
    return '';
  }
}

/**
 * Obtém uma credencial do Supabase
 * @param key Chave da credencial
 * @returns Valor da credencial ou null se não encontrada
 */
export async function getCredential(key: string): Promise<string | null> {
  // Verificar se a credencial está no cache
  if (credentialsCache.has(key)) {
    return credentialsCache.get(key) || null;
  }
  
  // Verificar se o cliente Supabase está inicializado
  if (!supabaseClient) {
    console.error('Cliente Supabase não inicializado. Chame initializeSupabaseClient primeiro.');
    return null;
  }
  
  try {
    // Buscar a credencial no Supabase
    const { data, error } = await supabaseClient
      .from('app_secrets')
      .select('*')
      .eq('key', key)
      .single();
    
    if (error) {
      console.error(`Erro ao buscar credencial ${key}:`, error);
      return null;
    }
    
    if (!data) {
      console.warn(`Credencial ${key} não encontrada`);
      return null;
    }
    
    // Descriptografar o valor se necessário
    const credential = data as unknown as Credential;
    const value = credential.is_encrypted 
      ? decryptValue(credential.value)
      : credential.value;
    
    // Armazenar no cache
    credentialsCache.set(key, value);
    
    return value;
  } catch (error) {
    console.error(`Erro ao obter credencial ${key}:`, error);
    return null;
  }
}

/**
 * Obtém todas as credenciais necessárias para a aplicação
 * @returns Objeto com todas as credenciais
 */
export async function getAllCredentials(): Promise<Record<string, string>> {
  const credentials: Record<string, string> = {};
  
  // Lista de credenciais para buscar
  const keys = [
    'JWT_SECRET',
    'EMAIL_USER',
    'EMAIL_PASSWORD',
    'SUPABASE_SERVICE_KEY'
  ];
  
  // Buscar cada credencial
  for (const key of keys) {
    const value = await getCredential(key);
    if (value) {
      credentials[key] = value;
    }
  }
  
  return credentials;
}

/**
 * Inicializa o sistema de credenciais
 * Deve ser chamado no início da aplicação
 */
export async function initializeCredentials(): Promise<boolean> {
  try {
    // Inicializar cliente Supabase
    initializeSupabaseClient();
    
    // Carregar todas as credenciais
    await getAllCredentials();
    
    return true;
  } catch (error) {
    console.error('Erro ao inicializar sistema de credenciais:', error);
    return false;
  }
}
