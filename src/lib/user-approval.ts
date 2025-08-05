import { supabaseAdmin } from '@/lib/db';

/**
 * Interface para configurações de aprovação de usuários
 */
export interface UserApprovalSettings {
  bypassApproval: boolean;
  autoActivateOnEmailVerification: boolean;
}

/**
 * Obter configurações de aprovação de usuários
 */
export async function getUserApprovalSettings(): Promise<UserApprovalSettings> {
  const defaultSettings: UserApprovalSettings = {
    bypassApproval: false,
    autoActivateOnEmailVerification: false
  };

  try {
    const { data, error } = await supabaseAdmin
      .from('settings')
      .select('value')
      .eq('key', 'user_approval_settings')
      .single();

    if (error || !data) {
      console.log('Configurações de aprovação não encontradas, usando padrão');
      return defaultSettings;
    }

    return {
      bypassApproval: data.value.bypassApproval || false,
      autoActivateOnEmailVerification: data.value.autoActivateOnEmailVerification || false
    };
  } catch (error) {
    console.error('Erro ao obter configurações de aprovação:', error);
    return defaultSettings;
  }
}

/**
 * Ativar usuário automaticamente após verificação de email
 */
export async function activateUserAfterEmailVerification(userId: string): Promise<boolean> {
  try {
    // Verificar se o bypass está ativado
    const settings = await getUserApprovalSettings();
    
    if (!settings.bypassApproval || !settings.autoActivateOnEmailVerification) {
      console.log('Bypass de aprovação não está ativado');
      return false;
    }

    // Ativar o usuário
    const { error } = await supabaseAdmin
      .from('users_unified')
      .update({
        active: true,
        is_authorized: true,
        authorization_status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) {
      console.error('Erro ao ativar usuário:', error);
      return false;
    }

    console.log(`Usuário ${userId} ativado automaticamente após verificação de email`);
    return true;
  } catch (error) {
    console.error('Erro ao ativar usuário automaticamente:', error);
    return false;
  }
}

/**
 * Verificar se um usuário deve ser ativado automaticamente no registro
 */
export async function shouldAutoActivateOnRegistration(): Promise<boolean> {
  try {
    const settings = await getUserApprovalSettings();
    return settings.bypassApproval && settings.autoActivateOnEmailVerification;
  } catch (error) {
    console.error('Erro ao verificar configurações de auto-ativação:', error);
    return false;
  }
}
