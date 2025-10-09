import { supabase } from '@/lib/supabase';
import { Tables } from '@/types/supabase';

// Tipo para criação de usuário
export interface CreateUserData {
  email: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  role?: 'ADMIN' | 'USER' | 'MANAGER';
  position?: string;
  department?: string;
  password?: string;
}

// Tipo para atualização de usuário
export interface UpdateUserData {
  email?: string;
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  role?: 'ADMIN' | 'USER' | 'MANAGER';
  position?: string;
  department?: string;
  active?: boolean;
}

// Função para buscar todos os usuários
export async function getAllUsers() {
  try {
    const { data, error } = await supabase
      .from('users_unified')
      .select('*')
      .order('first_name', { ascending: true });

    if (error) {
      throw error;
    }

    return data as Tables<'users_unified'>[];
  } catch (error) {
    console.error('Erro ao buscar usuários:', error);
    throw error;
  }
}

// Função para buscar um usuário pelo ID
export async function getUserById(id: string) {
  try {
    const { data, error } = await supabase
      .from('users_unified')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      throw error;
    }

    return data as Tables<'users_unified'>;
  } catch (error) {
    console.error('Erro ao buscar usuário:', error);
    throw error;
  }
}

// Função para buscar um usuário pelo email
export async function getUserByEmail(email: string) {
  try {
    const { data, error } = await supabase
      .from('users_unified')
      .select('*')
      .eq('email', email)
      .single();

    if (error) {
      throw error;
    }

    return data as Tables<'users_unified'>;
  } catch (error) {
    console.error('Erro ao buscar usuário pelo email:', error);
    throw error;
  }
}

// Função para buscar um usuário pelo telefone
export async function getUserByPhone(phone: string) {
  try {
    const { data, error } = await supabase
      .from('users_unified')
      .select('*')
      .eq('phone_number', phone)
      .single();

    if (error) {
      throw error;
    }

    return data as Tables<'users_unified'>;
  } catch (error) {
    console.error('Erro ao buscar usuário pelo telefone:', error);
    throw error;
  }
}

// Função para criar um usuário
export async function createUser(userData: CreateUserData) {
  try {
    // Gerar senha segura se não fornecida
    const { randomBytes } = await import('crypto');
    const securePassword = userData.password || randomBytes(12).toString('base64').slice(0, 16);

    // Primeiro, criamos o usuário na autenticação do Supabase
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: userData.email,
      password: securePassword,
      options: {
        data: {
          first_name: userData.first_name,
          last_name: userData.last_name,
          phone_number: userData.phone_number,
          role: userData.role || 'USER',
        },
      },
    });

    if (authError) {
      throw authError;
    }

    if (!authData.user) {
      throw new Error('Erro ao criar usuário na autenticação');
    }

    // Depois, inserimos os dados adicionais na tabela de usuários
    const { data, error } = await supabase
      .from('users_unified')
      .insert({
        id: authData.user.id,
        email: userData.email,
        first_name: userData.first_name,
        last_name: userData.last_name,
        phone_number: userData.phone_number,
        role: userData.role || 'USER',
        position: userData.position,
        department: userData.department,
        active: true,
        is_authorized: true,
        authorization_status: 'active',
      })
      .select()
      .single();

    if (error) {
      // Se houver erro ao criar o perfil, tentamos excluir o usuário da autenticação
      await supabase.auth.admin.deleteUser(authData.user.id);
      throw error;
    }

    return data as Tables<'users_unified'>;
  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    throw error;
  }
}

// Função para atualizar um usuário
export async function updateUser(id: string, userData: UpdateUserData) {
  try {
    const { data, error } = await supabase
      .from('users_unified')
      .update(userData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data as Tables<'users_unified'>;
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    throw error;
  }
}

// Função para excluir um usuário
export async function deleteUser(id: string) {
  try {
    // Primeiro, excluímos o usuário da autenticação
    const { error: authError } = await supabase.auth.admin.deleteUser(id);

    if (authError) {
      throw authError;
    }

    // Depois, excluímos o usuário da tabela de usuários
    const { error } = await supabase
      .from('users_unified')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Erro ao excluir usuário:', error);
    throw error;
  }
}

// Função para buscar as permissões de um usuário
export async function getUserPermissions(userId: string) {
  try {
    // Buscar o usuário na tabela users_unified para obter as permissões
    const { data: userData, error: userError } = await supabase
      .from('users_unified')
      .select('access_permissions')
      .eq('id', userId)
      .single();

    if (userError) {
      throw userError;
    }

    // Converter as permissões do formato JSONB para o formato de array
    const permissions = [];
    if (userData?.access_permissions?.modules) {
      for (const [module, hasAccess] of Object.entries(userData.access_permissions.modules)) {
        if (hasAccess) {
          permissions.push({
            user_id: userId,
            module,
            feature: null
          });
        }
      }
    }

    return permissions;
  } catch (error) {
    console.error('Erro ao buscar permissões do usuário:', error);
    throw error;
  }
}

// Função para atualizar as permissões de um usuário
export async function updateUserPermissions(userId: string, modules: string[]) {
  try {
    // Primeiro, buscar o usuário para obter as permissões atuais
    const { data: userData, error: userError } = await supabase
      .from('users_unified')
      .select('access_permissions')
      .eq('id', userId)
      .single();

    if (userError) {
      throw userError;
    }

    // Criar objeto de permissões
    const modulesObj = {};
    modules.forEach(module => {
      (modulesObj as any)[module] = true;
    });

    // Atualizar as permissões do usuário
    const { data, error } = await supabase
      .from('users_unified')
      .update({
        access_permissions: {
          modules: modulesObj,
          // Preservar outras propriedades se existirem
          ...(userData?.access_permissions && {
            features: userData.access_permissions.features
          })
        }
      })
      .eq('id', userId)
      .select();

    if (error) {
      throw error;
    }

    // Converter as permissões atualizadas para o formato esperado
    const updatedPermissions = modules.map(module => ({
      user_id: userId,
      module,
      feature: null
    }));

    return updatedPermissions;
  } catch (error) {
    console.error('Erro ao atualizar permissões do usuário:', error);
    throw error;
  }
}
