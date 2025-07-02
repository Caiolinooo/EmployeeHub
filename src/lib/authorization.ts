import { prisma } from './db';

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
  status?: 'active' | 'pending' | 'rejected';
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
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email },
          { phoneNumber: phoneNumber }
        ]
      }
    });

    // Se o usuário já existe e está ativo, está autorizado
    if (existingUser && existingUser.active) {
      return {
        authorized: true,
        method: existingUser.email === email ? 'email' : 'phoneNumber',
        status: 'active',
        message: 'Usuário já cadastrado e ativo'
      };
    }

    // Verificar se o email ou telefone está na lista de autorizados
    let authorizedEntry = null;

    // 1. Verificar por email ou telefone exato
    if (email || phoneNumber) {
      authorizedEntry = await prisma.authorizedUser.findFirst({
        where: {
          OR: [
            { email: email },
            { phoneNumber: phoneNumber }
          ],
          status: 'active'
        }
      });

      if (authorizedEntry) {
        return {
          authorized: true,
          method: authorizedEntry.email === email ? 'email' : 'phoneNumber',
          status: 'active',
          message: 'Usuário autorizado por email/telefone'
        };
      }
    }

    // 2. Verificar por domínio de email
    if (email && email.includes('@')) {
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

      if (domainAuth) {
        return {
          authorized: true,
          method: 'domain',
          status: 'active',
          message: `Usuário autorizado pelo domínio ${domain}`
        };
      }
    }

    // 3. Verificar por código de convite
    if (inviteCode) {
      const inviteAuth = await prisma.authorizedUser.findFirst({
        where: {
          inviteCode: inviteCode,
          status: 'active'
        }
      });

      if (inviteAuth) {
        // Verificar se o código expirou
        const now = new Date();
        if (inviteAuth.expiresAt && inviteAuth.expiresAt < now) {
          // Atualizar status para expirado
          await prisma.authorizedUser.update({
            where: { id: inviteAuth.id },
            data: { status: 'expired' }
          });

          return {
            authorized: false,
            method: 'inviteCode',
            status: 'expired',
            message: 'Código de convite expirado'
          };
        }

        // Verificar se o código já atingiu o número máximo de usos
        if (inviteAuth.maxUses && inviteAuth.usedCount >= inviteAuth.maxUses) {
          return {
            authorized: false,
            method: 'inviteCode',
            status: 'expired',
            message: 'Código de convite já foi utilizado o número máximo de vezes'
          };
        }

        // Incrementar o contador de uso
        await prisma.authorizedUser.update({
          where: { id: inviteAuth.id },
          data: { usedCount: inviteAuth.usedCount + 1 }
        });

        // Se o código atingiu o número máximo de usos após este uso, marcar como expirado
        if (inviteAuth.maxUses && inviteAuth.usedCount + 1 >= inviteAuth.maxUses) {
          await prisma.authorizedUser.update({
            where: { id: inviteAuth.id },
            data: { status: 'expired' }
          });
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
    const pendingRequest = await prisma.authorizedUser.findFirst({
      where: {
        OR: [
          { email: email },
          { phoneNumber: phoneNumber }
        ],
        status: 'pending'
      }
    });

    if (pendingRequest) {
      return {
        authorized: false,
        method: pendingRequest.email === email ? 'email' : 'phoneNumber',
        status: 'pending',
        message: 'Solicitação de acesso pendente de aprovação'
      };
    }

    // Se chegou até aqui, o usuário não está autorizado
    return {
      authorized: false,
      status: 'rejected',
      message: 'Usuário não autorizado'
    };
  } catch (error) {
    console.error('Erro ao verificar autorização:', error);
    return {
      authorized: false,
      message: 'Erro ao verificar autorização'
    };
  }
}

/**
 * Cria uma solicitação de acesso pendente
 * @param email Email do usuário
 * @param phoneNumber Número de telefone do usuário
 * @param notes Notas adicionais
 * @returns Objeto com resultado da operação
 */
export async function createAccessRequest(
  email?: string,
  phoneNumber?: string,
  notes?: string
): Promise<{ success: boolean; message: string }> {
  try {
    // Verificar se já existe uma solicitação para este email/telefone
    const existingRequest = await prisma.authorizedUser.findFirst({
      where: {
        OR: [
          { email: email },
          { phoneNumber: phoneNumber }
        ]
      }
    });

    if (existingRequest) {
      if (existingRequest.status === 'active') {
        return {
          success: false,
          message: 'Este usuário já está autorizado'
        };
      } else if (existingRequest.status === 'pending') {
        return {
          success: false,
          message: 'Já existe uma solicitação pendente para este usuário'
        };
      } else {
        // Atualizar solicitação rejeitada para pendente
        const noteToAdd = notes ? [notes] : [];
        const currentNotes = existingRequest.notes as string[] || [];

        await prisma.authorizedUser.update({
          where: { id: existingRequest.id },
          data: {
            status: 'pending',
            notes: [...currentNotes, ...noteToAdd]
          }
        });

        return {
          success: true,
          message: 'Solicitação de acesso atualizada para pendente'
        };
      }
    }

    // Criar nova solicitação
    await prisma.authorizedUser.create({
      data: {
        email,
        phoneNumber,
        status: 'pending',
        notes: notes ? [notes] : []
      }
    });

    // Aqui você poderia adicionar código para notificar administradores
    // sobre a nova solicitação de acesso

    return {
      success: true,
      message: 'Solicitação de acesso criada com sucesso'
    };
  } catch (error) {
    console.error('Erro ao criar solicitação de acesso:', error);
    return {
      success: false,
      message: 'Erro ao criar solicitação de acesso'
    };
  }
}

/**
 * Gera um código de convite único
 * @param createdBy ID do usuário que está criando o convite
 * @param notes Notas sobre o convite
 * @param expiryDays Número de dias até a expiração (opcional, usa o valor padrão do .env se não for fornecido)
 * @param maxUses Número máximo de usos (opcional, usa o valor padrão do .env se não for fornecido)
 * @returns Código de convite gerado
 */
export async function generateInviteCode(
  createdBy?: string,
  notes?: string,
  expiryDays?: number,
  maxUses?: number
): Promise<{ success: boolean; inviteCode?: string; message: string; expiresAt?: Date; maxUses?: number }> {
  try {
    // Definir valores padrão para expiração e número máximo de usos
    const defaultExpiryDays = parseInt(process.env.INVITE_CODE_EXPIRY_DAYS || '30');
    const defaultMaxUses = parseInt(process.env.INVITE_CODE_MAX_USES || '1');

    // Usar valores fornecidos ou padrões
    const finalExpiryDays = expiryDays || defaultExpiryDays;
    const finalMaxUses = maxUses || defaultMaxUses;

    // Calcular data de expiração
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + finalExpiryDays);

    // Gerar código aleatório de 8 caracteres
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let inviteCode = '';

    // Tentar até encontrar um código único
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 5) {
      inviteCode = '';
      for (let i = 0; i < 8; i++) {
        inviteCode += characters.charAt(Math.floor(Math.random() * characters.length));
      }

      console.log('Tentando gerar código de convite:', inviteCode);

      try {
        // Verificar se o código já existe
        const existingCode = await prisma.authorizedUser.findUnique({
          where: { inviteCode }
        });

        if (!existingCode) {
          isUnique = true;
          console.log('Código de convite único gerado:', inviteCode);
        } else {
          console.log('Código já existe, tentando novamente');
        }
      } catch (error) {
        console.error('Erro ao verificar código existente:', error);
      }

      attempts++;
    }

    if (!isUnique) {
      return {
        success: false,
        message: 'Não foi possível gerar um código único'
      };
    }

    // Salvar o código no banco de dados
    console.log('Salvando código de convite no banco de dados:', {
      inviteCode,
      expiresAt,
      maxUses: finalMaxUses
    });

    try {
      await prisma.authorizedUser.create({
        data: {
          inviteCode,
          status: 'active',
          expiresAt,
          maxUses: finalMaxUses,
          usedCount: 0,
          createdBy,
          notes: notes ? [notes] : []
        }
      });

      console.log('Código de convite salvo com sucesso');
    } catch (error) {
      console.error('Erro ao salvar código de convite:', error);
      throw error; // Propagar o erro para ser capturado no catch externo
    }

    return {
      success: true,
      inviteCode,
      expiresAt,
      maxUses: finalMaxUses,
      message: `Código de convite gerado com sucesso. Expira em ${finalExpiryDays} dias e pode ser usado ${finalMaxUses} ${finalMaxUses === 1 ? 'vez' : 'vezes'}.`
    };
  } catch (error) {
    console.error('Erro ao gerar código de convite:', error);
    return {
      success: false,
      message: 'Erro ao gerar código de convite'
    };
  }
}

/**
 * Adiciona um domínio autorizado
 * @param domain Domínio a ser autorizado
 * @param createdBy ID do usuário que está adicionando o domínio
 * @param notes Notas sobre o domínio
 * @returns Resultado da operação
 */
export async function addAuthorizedDomain(
  domain: string,
  createdBy?: string,
  notes?: string
): Promise<{ success: boolean; message: string }> {
  try {
    // Verificar se o domínio já está cadastrado
    const existingDomain = await prisma.authorizedUser.findFirst({
      where: { domain }
    });

    if (existingDomain) {
      if (existingDomain.status === 'active') {
        return {
          success: false,
          message: 'Este domínio já está autorizado'
        };
      } else {
        // Atualizar domínio para ativo
        const noteToAdd = notes ? [notes] : [];
        const currentNotes = existingDomain.notes as string[] || [];

        await prisma.authorizedUser.update({
          where: { id: existingDomain.id },
          data: {
            status: 'active',
            notes: [...currentNotes, ...noteToAdd]
          }
        });

        return {
          success: true,
          message: 'Domínio atualizado para ativo'
        };
      }
    }

    // Adicionar novo domínio
    await prisma.authorizedUser.create({
      data: {
        domain,
        status: 'active',
        createdBy,
        notes: notes ? [notes] : []
      }
    });

    return {
      success: true,
      message: 'Domínio autorizado adicionado com sucesso'
    };
  } catch (error) {
    console.error('Erro ao adicionar domínio autorizado:', error);
    return {
      success: false,
      message: 'Erro ao adicionar domínio autorizado'
    };
  }
}

/**
 * Adiciona um usuário autorizado por email ou telefone
 * @param email Email do usuário
 * @param phoneNumber Número de telefone do usuário
 * @param createdBy ID do usuário que está adicionando a autorização
 * @param notes Notas sobre a autorização
 * @returns Resultado da operação
 */
export async function addAuthorizedUser(
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
    const existingAuth = await prisma.authorizedUser.findFirst({
      where: {
        OR: [
          { email: email },
          { phoneNumber: phoneNumber }
        ]
      }
    });

    if (existingAuth) {
      if (existingAuth.status === 'active') {
        return {
          success: false,
          message: 'Este usuário já está autorizado'
        };
      } else {
        // Atualizar para ativo
        const noteToAdd = notes ? [notes] : [];
        const currentNotes = existingAuth.notes as string[] || [];

        await prisma.authorizedUser.update({
          where: { id: existingAuth.id },
          data: {
            status: 'active',
            notes: [...currentNotes, ...noteToAdd]
          }
        });

        return {
          success: true,
          message: 'Usuário atualizado para ativo'
        };
      }
    }

    // Adicionar novo usuário autorizado
    await prisma.authorizedUser.create({
      data: {
        email,
        phoneNumber,
        status: 'active',
        createdBy,
        notes: notes ? [notes] : []
      }
    });

    return {
      success: true,
      message: 'Usuário autorizado adicionado com sucesso'
    };
  } catch (error) {
    console.error('Erro ao adicionar usuário autorizado:', error);
    return {
      success: false,
      message: 'Erro ao adicionar usuário autorizado'
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
