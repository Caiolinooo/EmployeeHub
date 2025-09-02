import { supabaseAdmin } from '@/lib/supabase';

/**
 * Verifica se um usuário está banido permanentemente
 * @param email Email do usuário
 * @param phoneNumber Telefone do usuário
 * @param cpf CPF do usuário
 * @returns Promise<{isBanned: boolean, banInfo?: any}>
 */
export async function checkIfUserIsBanned(
  email?: string, 
  phoneNumber?: string, 
  cpf?: string
): Promise<{isBanned: boolean, banInfo?: any}> {
  try {
    if (!email && !phoneNumber && !cpf) {
      return { isBanned: false };
    }

    // Construir query para verificar banimento
    let query = supabaseAdmin.from('banned_users').select('*');
    
    const conditions = [];
    if (email) conditions.push(`email.eq.${email}`);
    if (phoneNumber) conditions.push(`phone_number.eq.${phoneNumber}`);
    if (cpf) conditions.push(`cpf.eq.${cpf}`);
    
    if (conditions.length > 0) {
      query = query.or(conditions.join(','));
    }

    const { data: bannedUsers, error } = await query;

    if (error) {
      console.error('Erro ao verificar usuário banido:', error);
      return { isBanned: false }; // Em caso de erro, permitir registro
    }

    if (bannedUsers && bannedUsers.length > 0) {
      return { 
        isBanned: true, 
        banInfo: bannedUsers[0] 
      };
    }

    return { isBanned: false };
  } catch (error) {
    console.error('Erro ao verificar banimento:', error);
    return { isBanned: false }; // Em caso de erro, permitir registro
  }
}

/**
 * Adiciona um usuário à lista de banidos
 * @param userData Dados do usuário a ser banido
 * @param bannedBy ID do administrador que aplicou o banimento
 * @param reason Motivo do banimento
 */
export async function banUser(
  userData: {
    id: string;
    email?: string;
    phone_number?: string;
    cpf?: string;
    first_name?: string;
    last_name?: string;
  },
  bannedBy: string,
  reason: string = 'Usuário banido pelo administrador'
): Promise<{success: boolean, error?: string}> {
  try {
    const { error } = await supabaseAdmin
      .from('banned_users')
      .insert({
        email: userData.email,
        phone_number: userData.phone_number,
        cpf: userData.cpf,
        banned_by: bannedBy,
        ban_reason: reason,
        original_user_id: userData.id,
        first_name: userData.first_name,
        last_name: userData.last_name,
        banned_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error('Erro ao banir usuário:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Erro ao banir usuário:', error);
    return { success: false, error: 'Erro interno' };
  }
}

/**
 * Remove um usuário da lista de banidos
 * @param email Email do usuário
 * @param phoneNumber Telefone do usuário
 * @param cpf CPF do usuário
 */
export async function unbanUser(
  email?: string, 
  phoneNumber?: string, 
  cpf?: string
): Promise<{success: boolean, error?: string}> {
  try {
    if (!email && !phoneNumber && !cpf) {
      return { success: false, error: 'Nenhum identificador fornecido' };
    }

    const conditions = [];
    if (email) conditions.push(`email.eq.${email}`);
    if (phoneNumber) conditions.push(`phone_number.eq.${phoneNumber}`);
    if (cpf) conditions.push(`cpf.eq.${cpf}`);

    const { error } = await supabaseAdmin
      .from('banned_users')
      .delete()
      .or(conditions.join(','));

    if (error) {
      console.error('Erro ao desbanir usuário:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Erro ao desbanir usuário:', error);
    return { success: false, error: 'Erro interno' };
  }
}

/**
 * Lista todos os usuários banidos
 */
export async function getBannedUsers(): Promise<{success: boolean, data?: any[], error?: string}> {
  try {
    const { data, error } = await supabaseAdmin
      .from('banned_users')
      .select(`
        *,
        banned_by_user:users_unified!banned_by(first_name, last_name, email)
      `)
      .order('banned_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar usuários banidos:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Erro ao buscar usuários banidos:', error);
    return { success: false, error: 'Erro interno' };
  }
}
