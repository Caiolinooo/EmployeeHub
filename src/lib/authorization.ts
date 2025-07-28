/**
 * MIGRAÇÃO PRISMA → SUPABASE - CONCLUÍDA ✅
 *
 * Data da Migração: 2025-01-25
 * Responsável: Augment Agent
 *
 * MUDANÇAS REALIZADAS:
 * - Substituição completa do Prisma ORM por Supabase client
 * - Conversão de todas as queries para sintaxe Supabase
 * - Mapeamento de campos: camelCase → snake_case
 * - Implementação de tratamento de erros { data, error }
 * - Manutenção da compatibilidade de API
 *
 * FUNÇÕES MIGRADAS:
 * - checkUserAuthorization()
 * - requestUserAuthorization()
 * - generateInviteCode()
 * - authorizeDomain()
 * - authorizeUser()
 *
 * TABELAS UTILIZADAS:
 * - users_unified (usuários principais)
 * - authorized_users (autorizações)
 *
 * STATUS: 100% Migrado para Supabase ✅
 */

import { supabase, supabaseAdmin } from './supabase';

/**
 * Verifica se um usuário está autorizado a acessar o sistema
 * @param email Email do usuário
 * @param phoneNumber Número de telefone do usuário
 * @param inviteCode Código de convite (opcional)
 * @returns Objeto com resultado da verificação
 */
export async function checkUserAuthorization(
  email?: string,
  phoneNumber?: string,
  inviteCode?: string
): Promise<{
  authorized: boolean;
  method?: 'email' | 'phoneNumber' | 'inviteCode' | 'domain' | 'admin_approval';
  status?: 'active' | 'pending' | 'rejected' | 'expired';
  message: string;
}> {
  try {
    // Se não temos nenhuma informação para verificar, retorna não autorizado
    if (!email && !phoneNumber && !inviteCode) {
      return {
        authorized: false,
        message: 'Nenhuma informação de identificação fornecida'
      };
    }

    // Verificar se o usuário já existe no sistema
    const { data: existingUser, error: userError } = await supabase
      .from('users_unified')
      .select('id, email, phone_number, active')
      .or(email ? `email.eq.${email}` : `phone_number.eq.${phoneNumber}`)
      .single();

    // Se o usuário já existe e está ativo, está autorizado
    if (!userError && existingUser && existingUser.active) {
      return {
        authorized: true,
        method: 'admin_approval',
        status: 'active',
        message: 'Usuário já cadastrado e ativo no sistema'
      };
    }

    // Verificar se o usuário já existe mas está inativo
    if (!userError && existingUser && !existingUser.active) {
      return {
        authorized: false,
        method: 'admin_approval',
        status: 'pending',
        message: 'Usuário cadastrado mas aguardando aprovação do administrador'
      };
    }

    // Verificar se o email ou telefone está na lista de autorizados
    let authorizedEntry = null;

    // 1. Verificar por email ou telefone exato
    if (email || phoneNumber) {
      const { data: authorizedEntries, error } = await supabaseAdmin
        .from('authorized_users')
        .select('*')
        .eq('status', 'active')
        .or(email ? `email.eq.${email}` : `phone_number.eq.${phoneNumber}`);

      if (!error && authorizedEntries && authorizedEntries.length > 0) {
        authorizedEntry = authorizedEntries[0];
        return {
          authorized: true,
          method: email ? 'email' : 'phoneNumber',
          status: 'active',
          message: 'Usuário autorizado'
        };
      }
    }

    // 2. Verificar por domínio de email
    if (email && email.includes('@')) {
<<<<<<< HEAD
      const domain = getEmailDomain(email);
  if (!domain) {
    return {
      authorized: false,
      message: 'Formato de email inválido'
    };
  }
      const domainAuth = await prisma.authorizedUser.findFirst({
        where: {
          domain: domain,
          status: 'active'
        }
      });
=======
      const domain = email.split('@')[1];
      const { data: domainAuth, error } = await supabaseAdmin
        .from('authorized_users')
        .select('*')
        .eq('domain', domain)
        .eq('status', 'active')
        .single();
>>>>>>> 4ccb41d (Fix: Corrigir anexos de reembolso - remover arquivos de teste e corrigir estrutura de dados no PDF)

      if (!error && domainAuth) {
        return {
          authorized: true,
          method: 'domain',
          status: 'active',
          message: 'Usuário autorizado por domínio'
        };
      }
    }

    // 3. Verificar por código de convite
    if (inviteCode) {
      const { data: inviteAuth, error } = await supabaseAdmin
        .from('authorized_users')
        .select('*')
        .eq('invite_code', inviteCode)
        .eq('status', 'active')
        .single();

      if (!error && inviteAuth) {
        // Verificar se o código expirou
        const now = new Date();
        if (inviteAuth.expires_at && new Date(inviteAuth.expires_at) < now) {
          // Atualizar status para expirado
          await supabaseAdmin
            .from('authorized_users')
            .update({ status: 'expired' })
            .eq('id', inviteAuth.id);

          return {
            authorized: false,
            method: 'inviteCode',
            status: 'expired',
            message: 'Código de convite expirado'
          };
        }

        // Verificar se o código já foi usado o número máximo de vezes
        if (inviteAuth.max_uses && inviteAuth.used_count >= inviteAuth.max_uses) {
          return {
            authorized: false,
            method: 'inviteCode',
            status: 'expired',
            message: 'Código de convite já foi utilizado o número máximo de vezes'
          };
        }

        // Incrementar o contador de uso
        await supabaseAdmin
          .from('authorized_users')
          .update({ used_count: (inviteAuth.used_count || 0) + 1 })
          .eq('id', inviteAuth.id);

        // Se o código atingiu o número máximo de usos após este uso, marcar como expirado
        if (inviteAuth.max_uses && (inviteAuth.used_count || 0) + 1 >= inviteAuth.max_uses) {
          await supabaseAdmin
            .from('authorized_users')
            .update({ status: 'expired' })
            .eq('id', inviteAuth.id);
        }

        return {
          authorized: true,
          method: 'inviteCode',
          status: 'active',
          message: 'Usuário autorizado por código de convite'
        };
      }
    }

    // 4. Verificar se há uma solicitação pendente
    const { data: pendingRequest, error: pendingError } = await supabaseAdmin
      .from('authorized_users')
      .select('*')
      .eq('status', 'pending')
      .or(email ? `email.eq.${email}` : `phone_number.eq.${phoneNumber}`)
      .single();

    if (!pendingError && pendingRequest) {
      return {
        authorized: false,
        method: 'admin_approval',
        status: 'pending',
        message: 'Solicitação de acesso pendente de aprovação'
      };
    }

    // Se chegou até aqui, o usuário não está autorizado
    return {
      authorized: false,
      message: 'Usuário não autorizado. Entre em contato com o administrador.'
    };

  } catch (error) {
    console.error('Erro ao verificar autorização:', error);
    return {
      authorized: false,
      message: 'Erro interno ao verificar autorização'
    };
  }
}

/**
 * Solicita autorização para um usuário
 */
export async function requestUserAuthorization(
  email?: string,
  phoneNumber?: string,
  notes?: string
): Promise<{ success: boolean; message: string }> {
  try {
    // Verificar se já existe uma solicitação para este email/telefone
    const { data: existingRequest, error } = await supabaseAdmin
      .from('authorized_users')
      .select('*')
      .or(email ? `email.eq.${email}` : `phone_number.eq.${phoneNumber}`)
      .single();

    if (!error && existingRequest) {
      if (existingRequest.status === 'active') {
        return {
          success: false,
          message: 'Usuário já está autorizado'
        };
      } else if (existingRequest.status === 'pending') {
        return {
          success: false,
          message: 'Já existe uma solicitação pendente para este usuário'
        };
      } else {
        // Atualizar solicitação rejeitada para pendente
        const noteToAdd = notes ? [notes] : [];
        const currentNotes = (existingRequest.notes as string[]) || [];

        await supabaseAdmin
          .from('authorized_users')
          .update({
            status: 'pending',
            notes: [...currentNotes, ...noteToAdd],
            updated_at: new Date().toISOString()
          })
          .eq('id', existingRequest.id);

        return {
          success: true,
          message: 'Solicitação de autorização atualizada com sucesso'
        };
      }
    }

    // Criar nova solicitação
    await supabaseAdmin
      .from('authorized_users')
      .insert({
        email,
        phone_number: phoneNumber,
        status: 'pending',
        notes: notes ? [notes] : [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    return {
      success: true,
      message: 'Solicitação de autorização criada com sucesso'
    };

  } catch (error) {
    console.error('Erro ao solicitar autorização:', error);
    return {
      success: false,
      message: 'Erro interno ao solicitar autorização'
    };
  }
}

/**
 * Gera um código de convite único
 */
export async function generateInviteCode(
  expiresAt?: Date,
  maxUses?: number,
  createdBy?: string,
  notes?: string
): Promise<{ success: boolean; inviteCode?: string; message: string }> {
  try {
    // Gerar código único
    let inviteCode = '';
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      attempts++;
      
      // Gerar código de 8 caracteres alfanuméricos
      inviteCode = Math.random().toString(36).substring(2, 10).toUpperCase();

      console.log('Tentando gerar código de convite:', inviteCode);

      try {
        // Verificar se o código já existe
        const { data: existingCode, error } = await supabaseAdmin
          .from('authorized_users')
          .select('id')
          .eq('invite_code', inviteCode)
          .single();

        if (error && error.code === 'PGRST116') {
          // Código não encontrado, é único
          isUnique = true;
        }
      } catch (error) {
        console.error('Erro ao verificar código existente:', error);
      }
    }

    if (!isUnique) {
      return {
        success: false,
        message: 'Não foi possível gerar um código único após várias tentativas'
      };
    }

    // Definir valores padrão
    const finalMaxUses = maxUses || 1;

    console.log('Criando código de convite:', {
      inviteCode,
      expiresAt,
      maxUses: finalMaxUses
    });

    await supabaseAdmin
      .from('authorized_users')
      .insert({
        invite_code: inviteCode,
        status: 'active',
        expires_at: expiresAt?.toISOString(),
        max_uses: finalMaxUses,
        used_count: 0,
        created_by: createdBy,
        notes: notes ? [notes] : [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    return {
      success: true,
      inviteCode,
      message: 'Código de convite gerado com sucesso'
    };

  } catch (error) {
    console.error('Erro ao gerar código de convite:', error);
    return {
      success: false,
      message: 'Erro interno ao gerar código de convite'
    };
  }
}

/**
 * Autoriza um domínio para acesso automático
 */
export async function authorizeDomain(
  domain: string,
  createdBy?: string,
  notes?: string
): Promise<{ success: boolean; message: string }> {
  try {
    // Verificar se o domínio já está cadastrado
    const { data: existingDomain, error } = await supabaseAdmin
      .from('authorized_users')
      .select('*')
      .eq('domain', domain)
      .single();

    if (!error && existingDomain) {
      if (existingDomain.status === 'active') {
        return {
          success: false,
          message: 'Domínio já está autorizado'
        };
      } else {
        // Atualizar domínio para ativo
        const noteToAdd = notes ? [notes] : [];
        const currentNotes = (existingDomain.notes as string[]) || [];

        await supabaseAdmin
          .from('authorized_users')
          .update({
            status: 'active',
            notes: [...currentNotes, ...noteToAdd],
            updated_at: new Date().toISOString()
          })
          .eq('id', existingDomain.id);

        return {
          success: true,
          message: 'Domínio reativado com sucesso'
        };
      }
    }

    // Adicionar novo domínio
    await supabaseAdmin
      .from('authorized_users')
      .insert({
        domain,
        status: 'active',
        created_by: createdBy,
        notes: notes ? [notes] : [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    return {
      success: true,
      message: 'Domínio autorizado com sucesso'
    };

  } catch (error) {
    console.error('Erro ao autorizar domínio:', error);
    return {
      success: false,
      message: 'Erro interno ao autorizar domínio'
    };
  }
}

/**
 * Autoriza um usuário específico
 */
export async function authorizeUser(
  email?: string,
  phoneNumber?: string,
  createdBy?: string,
  notes?: string
): Promise<{ success: boolean; message: string }> {
  try {
    if (!email && !phoneNumber) {
      return {
        success: false,
        message: 'É necessário fornecer email ou telefone'
      };
    }

    // Verificar se o usuário já está cadastrado
    const { data: existingAuth, error } = await supabaseAdmin
      .from('authorized_users')
      .select('*')
      .or(email ? `email.eq.${email}` : `phone_number.eq.${phoneNumber}`)
      .single();

    if (!error && existingAuth) {
      if (existingAuth.status === 'active') {
        return {
          success: false,
          message: 'Usuário já está autorizado'
        };
      } else {
        // Atualizar para ativo
        const noteToAdd = notes ? [notes] : [];
        const currentNotes = (existingAuth.notes as string[]) || [];

        await supabaseAdmin
          .from('authorized_users')
          .update({
            status: 'active',
            notes: [...currentNotes, ...noteToAdd],
            updated_at: new Date().toISOString()
          })
          .eq('id', existingAuth.id);

        return {
          success: true,
          message: 'Usuário autorizado com sucesso'
        };
      }
    }

    // Adicionar novo usuário autorizado
    await supabaseAdmin
      .from('authorized_users')
      .insert({
        email,
        phone_number: phoneNumber,
        status: 'active',
        created_by: createdBy,
        notes: notes ? [notes] : [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    return {
      success: true,
      message: 'Usuário autorizado com sucesso'
    };

  } catch (error) {
    console.error('Erro ao autorizar usuário:', error);
    return {
      success: false,
      message: 'Erro interno ao autorizar usuário'
    };
  }
}

export function getEmailDomain(email: string): string | null {
  if (!email || typeof email !== 'string') {
    return null;
  }
  
  const emailParts = email.split('@');
  if (emailParts.length !== 2) {
    return null; // Invalid email format
  }
  
  const domain = emailParts[1];
  return domain && domain.length > 0 ? domain : null;
}
