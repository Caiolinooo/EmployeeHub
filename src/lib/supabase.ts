import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getCredential, initializeSupabaseClient } from './secure-credentials';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

// Estas variáveis devem ser definidas no arquivo .env
// Buscar configurações do Supabase das variáveis de ambiente
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
// Usar a nomenclatura padrão do Supabase para a chave de serviço
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

// Função para validar configurações do Supabase
function validateSupabaseConfig() {
  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is required but not defined in environment variables');
  }

  if (!supabaseAnonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is required but not defined in environment variables');
  }

  // Validar formato da URL
  try {
    new URL(supabaseUrl);
  } catch (error) {
    throw new Error(`Invalid NEXT_PUBLIC_SUPABASE_URL format: ${supabaseUrl}`);
  }

  // Validar formato da chave anônima (deve ser um JWT)
  if (!supabaseAnonKey.startsWith('eyJ')) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY must be a valid JWT token starting with "eyJ"');
  }

  return { url: supabaseUrl, anonKey: supabaseAnonKey };
}

// Implementar padrão Singleton para evitar múltiplas instâncias do GoTrueClient
// Usar globalThis para armazenar as instâncias únicas dos clientes
// Isso garante que mesmo em ambientes de desenvolvimento com hot-reloading,
// apenas uma instância será criada

// Verificar se estamos no ambiente do navegador
const isBrowser = typeof window !== 'undefined';

// Definir o tipo para o objeto global
type GlobalWithSupabase = typeof globalThis & {
  _supabaseClient?: SupabaseClient;
  _supabaseAdminClient?: SupabaseClient;
};

// Função para criar ou retornar a instância do cliente Supabase
function getSupabaseClient(): SupabaseClient {
  // Usar o objeto global para armazenar a instância
  const globalWithSupabase = globalThis as GlobalWithSupabase;

  // Se já temos uma instância no objeto global, retorná-la
  if (globalWithSupabase._supabaseClient) {
    return globalWithSupabase._supabaseClient;
  }

  // Validar e obter configurações do Supabase
  const config = validateSupabaseConfig();

  // Criar uma nova instância apenas se ainda não existir
  if (isBrowser) {
    console.log('Criando nova instância do cliente Supabase');
  }

  // Criar a instância e armazená-la no objeto global
  const instance = createClient(config.url, config.anonKey, {
    auth: {
      storageKey: 'supabase_auth_token',
      persistSession: true
    }
  });

  globalWithSupabase._supabaseClient = instance;
  return instance;
}

// Função para validar a chave de serviço
function validateServiceKey(serviceKey: string | undefined): string {
  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required but not defined in environment variables');
  }

  if (serviceKey.length < 100 || !serviceKey.startsWith('eyJ')) {
    throw new Error(
      `Invalid SUPABASE_SERVICE_ROLE_KEY format. ` +
      `Expected a JWT token starting with "eyJ" and at least 100 characters long. ` +
      `Current length: ${serviceKey.length}, starts with: ${serviceKey.substring(0, 10)}...`
    );
  }

  return serviceKey;
}

// Função para criar ou retornar a instância do cliente Supabase Admin
async function getSupabaseAdminClient(): Promise<SupabaseClient> {
  // Usar o objeto global para armazenar a instância
  const globalWithSupabase = globalThis as GlobalWithSupabase;

  // Se já temos uma instância no objeto global, retorná-la
  if (globalWithSupabase._supabaseAdminClient) {
    return globalWithSupabase._supabaseAdminClient;
  }

  // Validar configurações básicas
  const config = validateSupabaseConfig();
  
  // Tentar obter a chave de serviço da tabela app_secrets primeiro
  let serviceKey = supabaseServiceKey;

  // Se não temos a chave no ambiente, tentar buscar da tabela app_secrets
  if (!serviceKey) {
    try {
      // Inicializar o cliente Supabase com a chave anônima para buscar secrets
      initializeSupabaseClient(config.url, config.anonKey);

      // Buscar a chave de serviço da tabela app_secrets
      const secretKey = await getCredential('SUPABASE_SERVICE_ROLE_KEY') || await getCredential('SUPABASE_SERVICE_KEY');
      if (secretKey) {
        serviceKey = secretKey;
        console.log('Chave de serviço obtida da tabela app_secrets');
      }
    } catch (error) {
      console.error('Erro ao buscar chave de serviço da tabela app_secrets:', error);
    }
  }

  // Validar a chave de serviço
  const validatedServiceKey = validateServiceKey(serviceKey);

  // Criar uma nova instância apenas se ainda não existir
  if (isBrowser) {
    console.log('Criando nova instância do cliente Supabase Admin');
  }

  // Criar a instância e armazená-la no objeto global
  const instance = createClient(
    config.url,
    validatedServiceKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  globalWithSupabase._supabaseAdminClient = instance;
  return instance;
}

// Exportar as instâncias únicas dos clientes
export const supabase = getSupabaseClient();
// Para o cliente admin, precisamos usar uma função assíncrona
let _supabaseAdminPromise: Promise<SupabaseClient> | null = null;

export function getSupabaseAdmin(): Promise<SupabaseClient> {
  if (!_supabaseAdminPromise) {
    _supabaseAdminPromise = getSupabaseAdminClient();
  }
  return _supabaseAdminPromise;
}

// Para compatibilidade com código existente, criar uma versão síncrona
// Isso usará a chave do ambiente inicialmente, mas será atualizado quando getSupabaseAdmin() for chamado
export const supabaseAdmin = (() => {
  try {
    const config = validateSupabaseConfig();
    // Evitar inicializar com chave de serviço no navegador
    if (isBrowser) {
      // No browser nunca devemos usar a service role key
      return createClient(
        config.url,
        config.anonKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      );
    }
    const validatedServiceKey = validateServiceKey(supabaseServiceKey);
    return createClient(
      config.url,
      validatedServiceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
  } catch (error) {
    // Em ambiente de servidor, logar; no browser, silenciar para evitar ruído
    if (!isBrowser) {
      console.error('Failed to initialize supabaseAdmin:', error);
    }
    // Retorna cliente com anon key como fallback
    const config = validateSupabaseConfig();
    return createClient(
      config.url,
      config.anonKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
  }
})();

// Adicionar logs para depuração apenas no navegador
if (isBrowser) {
  console.log('=== INICIALIZANDO SUPABASE ===');
  console.log('URL do Supabase:', supabaseUrl);
  console.log('Chave anônima presente:', supabaseAnonKey ? 'Sim' : 'Não');
  console.log('Chave de serviço presente:', supabaseServiceKey ? 'Sim' : 'Não');
  console.log('Comprimento da chave de serviço:', supabaseServiceKey ? supabaseServiceKey.length : 0);
}

// Função para verificar a conexão com o Supabase
export async function checkSupabaseConnection() {
  try {
    // Tentar fazer uma consulta simples para verificar a conexão
    const { data, error } = await supabase.from('users_unified').select('id').limit(1);

    if (error) {
      console.error('Erro ao conectar com o Supabase:', error.message);
      return false;
    }

    console.log('Conexão com o Supabase estabelecida com sucesso!');
    return true;
  } catch (error) {
    console.error('Erro ao verificar conexão com o Supabase:', error);
    return false;
  }
}

// Função para obter o usuário atual
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// Função para fazer login com email e senha usando o PostgreSQL diretamente
export async function signInWithEmail(email: string, password: string) {
  try {
    // Buscar o usuário pelo email
    const { data: user, error: userError } = await supabase
      .from('users_unified')
      .select('*')
      .eq('email', email)
      .single();

    if (userError) {
      throw userError;
    }

    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    // Verificar a senha usando bcrypt contra password_hash
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      throw new Error('Senha incorreta');
    }

    // Gerar token JWT

    // Obter a chave JWT da tabela app_secrets ou usar a do ambiente
    let jwtSecret = process.env.JWT_SECRET || 'fallback-secret';
    try {
      const secretKey = await getCredential('JWT_SECRET');
      if (secretKey) {
        jwtSecret = secretKey;
      }
    } catch (error) {
      console.warn('Erro ao obter JWT_SECRET da tabela app_secrets, usando fallback:', error);
    }

    const token = jwt.sign(
      {
        userId: user.id,
        phoneNumber: user.phone_number,
        role: user.role,
      },
      jwtSecret,
      { expiresIn: '7d' }
    );

    // Registrar o login no histórico de acesso
    const now = new Date().toISOString();
    const accessHistory = user.access_history || [];
    accessHistory.push({
      timestamp: now,
      action: 'LOGIN',
      details: 'Login com email'
    });

    // Atualizar o histórico de acesso
    await supabase
      .from('users_unified')
      .update({
        access_history: accessHistory,
        updated_at: now
      })
      .eq('id', user.id);

    return {
      session: {
        access_token: token,
        user: user
      },
      user: user
    };
  } catch (error) {
    console.error('Erro ao fazer login com email:', error);
    throw error;
  }
}

// Função para fazer login com número de telefone usando o PostgreSQL diretamente
export async function signInWithPhone(phone: string, password: string) {
  try {
    // Buscar o usuário pelo telefone
    const { data: user, error: userError } = await supabase
      .from('users_unified')
      .select('*')
      .eq('phone_number', phone)
      .single();

    if (userError) {
      throw userError;
    }

    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    // Verificar a senha usando bcrypt contra password_hash
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      throw new Error('Senha incorreta');
    }

    // Gerar token JWT

    // Obter a chave JWT da tabela app_secrets ou usar a do ambiente
    let jwtSecret = process.env.JWT_SECRET || 'fallback-secret';
    try {
      const secretKey = await getCredential('JWT_SECRET');
      if (secretKey) {
        jwtSecret = secretKey;
      }
    } catch (error) {
      console.warn('Erro ao obter JWT_SECRET da tabela app_secrets, usando fallback:', error);
    }

    const token = jwt.sign(
      {
        userId: user.id,
        phoneNumber: user.phone_number,
        role: user.role,
      },
      jwtSecret,
      { expiresIn: '7d' }
    );

    // Registrar o login no histórico de acesso
    const now = new Date().toISOString();
    const accessHistory = user.access_history || [];
    accessHistory.push({
      timestamp: now,
      action: 'LOGIN',
      details: 'Login com telefone'
    });

    // Atualizar o histórico de acesso
    await supabase
      .from('users_unified')
      .update({
        access_history: accessHistory,
        updated_at: now
      })
      .eq('id', user.id);

    return {
      session: {
        access_token: token,
        user: user
      },
      user: user
    };
  } catch (error) {
    console.error('Erro ao fazer login com telefone:', error);
    throw error;
  }
}

// Função para fazer logout
export async function signOut() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }

  return true;
}

// Função para registrar um novo usuário usando o PostgreSQL diretamente
export async function signUp(email: string, password: string, userData: any) {
  try {
    // Verificar se o email ou telefone já estão em uso
    const { data: existingUser, error: checkError } = await supabase
      .from('users_unified')
      .select('id')
      .or(`email.eq.${email},phone_number.eq.${userData.phoneNumber}`)
      .single();

    if (existingUser) {
      throw new Error('Email ou telefone já estão em uso');
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 10);

    // Gerar ID único
    const userId = uuidv4();

    // Verificar se o usuário está autorizado
    let isAuthorized = false;
    let authorizationStatus = 'pending';

    // Verificar se o email ou telefone está na lista de autorizados
    if (email || userData.phoneNumber) {
      const { data: authorizedData } = await supabase
        .from('users_unified')
        .select('id, authorization_status')
        .or(`email.eq.${email},phone_number.eq.${userData.phoneNumber}`)
        .eq('is_authorized', true)
        .single();

      if (authorizedData) {
        isAuthorized = true;
        authorizationStatus = authorizedData.authorization_status || 'active';
      }
    }

    // Definir permissões padrão com base no papel
    const defaultPermissions = {
      modules: {
        dashboard: true,
        manual: true,
        procedimentos: true,
        politicas: true,
        calendario: true,
        noticias: true,
        reembolso: true,
        contracheque: true,
        ponto: true,
        admin: userData.role === 'ADMIN'
      }
    };

    const now = new Date().toISOString();

    // Inserir o usuário no banco de dados
    const { data: newUser, error: insertError } = await supabase
      .from('users_unified')
      .insert({
        id: userId,
        email: email,
        phone_number: userData.phoneNumber,
        first_name: userData.firstName,
        last_name: userData.lastName,
        password: hashedPassword,
        role: userData.role || 'USER',
        position: userData.position,
        department: userData.department,
        active: isAuthorized && authorizationStatus === 'active',
        is_authorized: isAuthorized,
        authorization_status: authorizationStatus,
        access_permissions: defaultPermissions,
        access_history: [{
          timestamp: now,
          action: 'REGISTERED',
          details: 'Usuário registrado'
        }],
        created_at: now,
        updated_at: now
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    // Gerar token JWT

    // Obter a chave JWT da tabela app_secrets ou usar a do ambiente
    let jwtSecret = process.env.JWT_SECRET || 'fallback-secret';
    try {
      const secretKey = await getCredential('JWT_SECRET');
      if (secretKey) {
        jwtSecret = secretKey;
      }
    } catch (error) {
      console.warn('Erro ao obter JWT_SECRET da tabela app_secrets, usando fallback:', error);
    }

    const token = jwt.sign(
      {
        userId: userId,
        phoneNumber: userData.phoneNumber,
        role: userData.role || 'USER',
      },
      jwtSecret,
      { expiresIn: '7d' }
    );

    return {
      user: newUser,
      session: {
        access_token: token,
        user: newUser
      }
    };
  } catch (error) {
    console.error('Erro ao registrar usuário:', error);
    throw error;
  }
}

// Função para atualizar os dados do usuário usando o PostgreSQL diretamente
export async function updateUserProfile(userId: string, userData: any) {
  try {
    // Verificar se o usuário existe
    const { data: existingUser, error: checkError } = await supabase
      .from('users_unified')
      .select('id, access_history')
      .eq('id', userId)
      .single();

    if (checkError || !existingUser) {
      throw new Error('Usuário não encontrado');
    }

    const now = new Date().toISOString();

    // Preparar o histórico de acesso
    const accessHistory = existingUser.access_history || [];
    accessHistory.push({
      timestamp: now,
      action: 'PROFILE_UPDATE',
      details: 'Perfil atualizado pelo usuário'
    });

    // Atualizar os dados do usuário
    const { data: updatedUser, error: updateError } = await supabase
      .from('users_unified')
      .update({
        first_name: userData.firstName,
        last_name: userData.lastName,
        phone_number: userData.phoneNumber,
        position: userData.position,
        department: userData.department,
        access_history: accessHistory,
        updated_at: now
      })
      .eq('id', userId)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    return updatedUser;
  } catch (error) {
    console.error('Erro ao atualizar perfil do usuário:', error);
    throw error;
  }
}

// Função para verificar se o usuário tem permissão para acessar um módulo
export async function checkModulePermission(userId: string, module: string) {
  try {
    // Buscar o usuário
    const { data: user, error: userError } = await supabase
      .from('users_unified')
      .select('role, access_permissions')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      console.error('Erro ao buscar usuário para verificar permissão de módulo:', userError);
      return false;
    }

    // Administradores sempre têm acesso a todos os módulos
    if (user.role === 'ADMIN') {
      return true;
    }

    // Verificar se o usuário tem permissões definidas
    if (!user.access_permissions?.modules) {
      return false;
    }

    // Verificar se o módulo está nas permissões
    return user.access_permissions.modules[module] === true;
  } catch (error) {
    console.error('Erro ao verificar permissão de módulo:', error);
    return false;
  }
}

// Função para verificar se o usuário tem permissão para acessar uma funcionalidade
export async function checkFeaturePermission(userId: string, feature: string) {
  try {
    // Buscar o usuário
    const { data: user, error: userError } = await supabase
      .from('users_unified')
      .select('role, access_permissions')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      console.error('Erro ao buscar usuário para verificar permissão de funcionalidade:', userError);
      return false;
    }

    // Administradores sempre têm acesso a todas as funcionalidades
    if (user.role === 'ADMIN') {
      return true;
    }

    // Verificar se o usuário tem permissões definidas
    if (!user.access_permissions?.features) {
      return false;
    }

    // Verificar se a funcionalidade está nas permissões
    return user.access_permissions.features[feature] === true;
  } catch (error) {
    console.error('Erro ao verificar permissão de funcionalidade:', error);
    return false;
  }
}

// Função para buscar um usuário pelo ID
export async function getUserById(userId: string) {
  try {
    const { data: user, error } = await supabase
      .from('users_unified')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      throw error;
    }

    return user;
  } catch (error) {
    console.error('Erro ao buscar usuário por ID:', error);
    throw error;
  }
}

// Função para buscar um usuário pelo email
export async function getUserByEmail(email: string) {
  try {
    const { data: user, error } = await supabase
      .from('users_unified')
      .select('*')
      .eq('email', email)
      .single();

    if (error) {
      throw error;
    }

    return user;
  } catch (error) {
    console.error('Erro ao buscar usuário por email:', error);
    throw error;
  }
}

// Função para buscar um usuário pelo telefone
export async function getUserByPhone(phone: string) {
  try {
    const { data: user, error } = await supabase
      .from('users_unified')
      .select('*')
      .eq('phone_number', phone)
      .single();

    if (error) {
      throw error;
    }

    return user;
  } catch (error) {
    console.error('Erro ao buscar usuário por telefone:', error);
    throw error;
  }
}

// Função para listar todos os usuários
export async function listUsers() {
  try {
    const { data: users, error } = await supabase
      .from('users_unified')
      .select('*')
      .order('first_name', { ascending: true });

    if (error) {
      throw error;
    }

    return users;
  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    throw error;
  }
}

// Função para listar usuários autorizados
export async function listAuthorizedUsers() {
  try {
    const { data: users, error } = await supabase
      .from('users_unified')
      .select('*')
      .eq('is_authorized', true)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return users;
  } catch (error) {
    console.error('Erro ao listar usuários autorizados:', error);
    throw error;
  }
}

// Função para autorizar um usuário
export async function authorizeUser(userId: string, authorizedBy: string) {
  try {
    const now = new Date().toISOString();

    const { data: user, error } = await supabase
      .from('users_unified')
      .update({
        is_authorized: true,
        authorization_status: 'active',
        authorized_by: authorizedBy,
        authorization_notes: [{
          timestamp: now,
          action: 'AUTHORIZED',
          details: `Autorizado por ${authorizedBy}`
        }],
        updated_at: now
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return user;
  } catch (error) {
    console.error('Erro ao autorizar usuário:', error);
    throw error;
  }
}
