'use client';

import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/supabase';
import { Tables } from '@/types/supabase';

export function useSupabase() {
  const auth = useSupabaseAuth();

  // Função para buscar documentos
  const getDocuments = async (category?: string) => {
    try {
      let query = supabase.from('documents').select('*');

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data as Tables<'documents'>[];
    } catch (error) {
      console.error('Erro ao buscar documentos:', error);
      throw error;
    }
  };

  // Função para buscar um documento pelo ID
  const getDocumentById = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        throw error;
      }

      return data as Tables<'documents'>;
    } catch (error) {
      console.error('Erro ao buscar documento:', error);
      throw error;
    }
  };

  // Função para criar um documento
  const createDocument = async (document: Omit<Tables<'documents'>, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      if (!auth.user) {
        throw new Error('Usuário não autenticado');
      }

      const { data, error } = await supabase
        .from('documents')
        .insert({
          ...document,
          created_by: auth.user.id,
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data as Tables<'documents'>;
    } catch (error) {
      console.error('Erro ao criar documento:', error);
      throw error;
    }
  };

  // Função para atualizar um documento
  const updateDocument = async (id: string, document: Partial<Tables<'documents'>>) => {
    try {
      if (!auth.user) {
        throw new Error('Usuário não autenticado');
      }

      const { data, error } = await supabase
        .from('documents')
        .update({
          ...document,
          updated_by: auth.user.id,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data as Tables<'documents'>;
    } catch (error) {
      console.error('Erro ao atualizar documento:', error);
      throw error;
    }
  };

  // Função para excluir um documento
  const deleteDocument = async (id: string) => {
    try {
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', id);

      if (error) {
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Erro ao excluir documento:', error);
      throw error;
    }
  };

  // Função para buscar notícias
  const getNews = async (published?: boolean) => {
    try {
      let query = supabase.from('news').select('*');

      if (published !== undefined) {
        query = query.eq('published', published);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data as Tables<'news'>[];
    } catch (error) {
      console.error('Erro ao buscar notícias:', error);
      throw error;
    }
  };

  // Função para buscar uma notícia pelo ID
  const getNewsById = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('news')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        throw error;
      }

      return data as Tables<'news'>;
    } catch (error) {
      console.error('Erro ao buscar notícia:', error);
      throw error;
    }
  };

  // Função para criar uma notícia
  const createNews = async (news: Omit<Tables<'news'>, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      if (!auth.user) {
        throw new Error('Usuário não autenticado');
      }

      const { data, error } = await supabase
        .from('news')
        .insert({
          ...news,
          created_by: auth.user.id,
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data as Tables<'news'>;
    } catch (error) {
      console.error('Erro ao criar notícia:', error);
      throw error;
    }
  };

  // Função para atualizar uma notícia
  const updateNews = async (id: string, news: Partial<Tables<'news'>>) => {
    try {
      if (!auth.user) {
        throw new Error('Usuário não autenticado');
      }

      const { data, error } = await supabase
        .from('news')
        .update({
          ...news,
          updated_by: auth.user.id,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data as Tables<'news'>;
    } catch (error) {
      console.error('Erro ao atualizar notícia:', error);
      throw error;
    }
  };

  // Função para excluir uma notícia
  const deleteNews = async (id: string) => {
    try {
      const { error } = await supabase
        .from('news')
        .delete()
        .eq('id', id);

      if (error) {
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Erro ao excluir notícia:', error);
      throw error;
    }
  };

  // Função para buscar usuários
  const getUsers = async () => {
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
  };

  // Função para buscar um usuário pelo ID
  const getUserById = async (id: string) => {
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
  };

  // Função para atualizar um usuário
  const updateUser = async (id: string, user: Partial<Tables<'users_unified'>>) => {
    try {
      const { data, error } = await supabase
        .from('users_unified')
        .update(user)
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
  };

  // Função para buscar as permissões de um usuário
  const getUserPermissions = async (userId: string) => {
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
  };

  // Função para atualizar as permissões de um usuário
  const updateUserPermissions = async (userId: string, modules: string[]) => {
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
  };

  // Função para buscar as configurações
  const getSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*');

      if (error) {
        throw error;
      }

      return data as Tables<'settings'>[];
    } catch (error) {
      console.error('Erro ao buscar configurações:', error);
      throw error;
    }
  };

  // Função para buscar uma configuração pelo ID
  const getSettingByKey = async (key: string) => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('key', key)
        .single();

      if (error) {
        throw error;
      }

      return data as Tables<'settings'>;
    } catch (error) {
      console.error('Erro ao buscar configuração:', error);
      throw error;
    }
  };

  // Função para atualizar uma configuração
  const updateSetting = async (key: string, value: any) => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .update({ value })
        .eq('key', key)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data as Tables<'settings'>;
    } catch (error) {
      console.error('Erro ao atualizar configuração:', error);
      throw error;
    }
  };

  return {
    auth,
    getDocuments,
    getDocumentById,
    createDocument,
    updateDocument,
    deleteDocument,
    getNews,
    getNewsById,
    createNews,
    updateNews,
    deleteNews,
    getUsers,
    getUserById,
    updateUser,
    getUserPermissions,
    updateUserPermissions,
    getSettings,
    getSettingByKey,
    updateSetting,
  };
}
