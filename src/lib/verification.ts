/**
 * Utilitários para envio e verificação de códigos
 */
// Importar do módulo server-side apenas em contexto de servidor
import { sendVerificationEmail } from './email';
import { sendVerificationSMS } from './sms';
import { Pool } from 'pg';
import { registerCode, verifyCode as verifyCodeService } from './code-service';

/**
 * Envia um código de verificação por email ou SMS
 * @param identifier Email ou telefone do usuário
 * @param userId ID do usuário
 * @param method Método de envio (email ou sms)
 * @returns Resultado do envio
 */
export async function sendVerificationCode(
  identifier: string,
  userId: string,
  method: 'email' | 'sms' = 'sms'
): Promise<{
  success: boolean;
  message: string;
  code?: string;
  previewUrl?: string;
}> {
  try {
    // Registrar código de verificação usando o serviço in-house
    const { code: verificationCode, expires: verificationCodeExpires } = registerCode(identifier, method);

    // Registrar o código no console para facilitar o desenvolvimento
    console.log('[VERIFICATION] Código gerado para %s via %s (código redigido)', identifier, method);
    console.log(`[VERIFICATION] Expira em: ${verificationCodeExpires.toISOString()}`);
    console.log(`[VERIFICATION] Acesse http://localhost:3000/debug/codes para ver todos os códigos`);

    // Verificar se o código foi registrado corretamente
    const { getActiveCodes } = await import('./code-service');
    const activeCodes = getActiveCodes();
    const codeRegistered = activeCodes.some(c =>
      c.identifier === identifier &&
      c.method === method &&
      c.code === verificationCode
    );

    if (!codeRegistered) {
      console.error(`[VERIFICATION] ERRO: Código não foi registrado corretamente no serviço em memória!`);
    } else {
      console.log(`[VERIFICATION] Código registrado com sucesso no serviço em memória`);
    }

    // Enviar código pelo método escolhido
    let sendResult: any = { success: false };

    if (method === 'email') {
      console.log(`Enviando código de verificação por email para: ${identifier}`);
      sendResult = await sendVerificationEmail(identifier, verificationCode);
    } else {
      console.log(`Enviando código de verificação por SMS para: ${identifier}`);
      sendResult = await sendVerificationSMS(identifier, verificationCode);
    }

    // Se o envio falhou, retornar erro
    if (!sendResult.success) {
      console.error('Falha ao enviar código por %s:', method, sendResult.message);
      return {
        success: false,
        message: `Erro ao enviar código de verificação por ${method === 'email' ? 'email' : 'SMS'}: ${sendResult.message}`
      };
    }

    // Atualizar o usuário com o código de verificação
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });

    try {
      console.log(`Atualizando usuário ${userId} com código de verificação`);
      await pool.query(`
        UPDATE "User"
        SET
          "verificationCode" = $1,
          "verificationCodeExpires" = $2,
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = $3
      `, [verificationCode, verificationCodeExpires, userId]);

      console.log('Usuário atualizado com código de verificação');

      // Em ambiente de desenvolvimento, retornar o código para facilitar testes
      const codeForResponse = process.env.NODE_ENV !== 'production' ? verificationCode : undefined;

      return {
        success: true,
        message: `Código de verificação enviado com sucesso por ${method === 'email' ? 'email' : 'SMS'}.`,
        code: codeForResponse,
        previewUrl: sendResult.previewUrl
      };
    } catch (error) {
      console.error('Erro ao atualizar usuário com código de verificação:', error);
      return {
        success: false,
        message: 'Erro ao salvar código de verificação no banco de dados.'
      };
    } finally {
      await pool.end();
    }
  } catch (error) {
    console.error('Erro ao enviar código de verificação:', error);
    return {
      success: false,
      message: 'Erro interno ao processar envio de código de verificação.'
    };
  }
}

/**
 * Verifica se um código de verificação é válido
 * @param code Código fornecido pelo usuário
 * @param userId ID do usuário
 * @returns Resultado da verificação
 */
export async function verifyCode(
  code: string,
  userId: string
): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    // Buscar o usuário para obter o identificador
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });

    try {
      console.log(`Verificando código para usuário ${userId}`);
      const result = await pool.query(`
        SELECT "email", "phoneNumber"
        FROM "User"
        WHERE "id" = $1
      `, [userId]);

      if (result.rows.length === 0) {
        console.log('Usuário não encontrado');
        return {
          success: false,
          message: 'Usuário não encontrado.'
        };
      }

      const user = result.rows[0];

      // Determinar qual identificador usar (email ou telefone)
      const identifier = user.email || user.phoneNumber;
      if (!identifier) {
        console.log('Usuário não tem email ou telefone cadastrado');
        return {
          success: false,
          message: 'Usuário não tem email ou telefone cadastrado.'
        };
      }

      // Verificar o código usando o serviço in-house
      // Tentar verificar com ambos os métodos (email e SMS)
      const isValidEmail = user.email ? verifyCodeService(user.email, code, 'email') : false;
      const isValidSMS = user.phoneNumber ? verifyCodeService(user.phoneNumber, code, 'sms') : false;

      if (isValidEmail || isValidSMS) {
        console.log('Código verificado com sucesso');

        // Limpar o código de verificação no banco de dados (para compatibilidade)
        await pool.query(`
          UPDATE "User"
          SET
            "verificationCode" = NULL,
            "verificationCodeExpires" = NULL,
            "updatedAt" = CURRENT_TIMESTAMP
          WHERE "id" = $1
        `, [userId]);

        return {
          success: true,
          message: 'Código verificado com sucesso.'
        };
      } else {
        console.log('Código de verificação inválido ou expirado');
        return {
          success: false,
          message: 'Código de verificação inválido ou expirado. Solicite um novo código.'
        };
      }
    } catch (error) {
      console.error('Erro ao verificar código:', error);
      return {
        success: false,
        message: 'Erro ao verificar código de verificação.'
      };
    } finally {
      await pool.end();
    }
  } catch (error) {
    console.error('Erro ao processar verificação de código:', error);
    return {
      success: false,
      message: 'Erro interno ao processar verificação de código.'
    };
  }
}

/**
 * Reenvia um código de verificação
 * @param userId ID do usuário
 * @param method Método de envio (email ou sms)
 * @returns Resultado do reenvio
 */
export async function resendVerificationCode(
  userId: string,
  method: 'email' | 'sms' = 'sms'
): Promise<{
  success: boolean;
  message: string;
  code?: string;
  previewUrl?: string;
}> {
  try {
    // Buscar o usuário
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });

    try {
      console.log(`Buscando usuário ${userId} para reenvio de código`);
      const result = await pool.query(`
        SELECT "email", "phoneNumber"
        FROM "User"
        WHERE "id" = $1
      `, [userId]);

      if (result.rows.length === 0) {
        console.log('Usuário não encontrado');
        return {
          success: false,
          message: 'Usuário não encontrado.'
        };
      }

      const user = result.rows[0];

      // Verificar se o usuário tem o método de contato escolhido
      if (method === 'email' && !user.email) {
        console.log('Usuário não tem email cadastrado');
        return {
          success: false,
          message: 'Usuário não tem email cadastrado.'
        };
      }

      if (method === 'sms' && !user.phoneNumber) {
        console.log('Usuário não tem telefone cadastrado');
        return {
          success: false,
          message: 'Usuário não tem telefone cadastrado.'
        };
      }

      // Enviar novo código
      const identifier = method === 'email' ? user.email : user.phoneNumber;
      return await sendVerificationCode(identifier, userId, method);
    } catch (error) {
      console.error('Erro ao buscar usuário para reenvio de código:', error);
      return {
        success: false,
        message: 'Erro ao buscar usuário para reenvio de código.'
      };
    } finally {
      await pool.end();
    }
  } catch (error) {
    console.error('Erro ao reenviar código de verificação:', error);
    return {
      success: false,
      message: 'Erro interno ao reenviar código de verificação.'
    };
  }
}
