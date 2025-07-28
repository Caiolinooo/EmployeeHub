/**
 * Módulo para verificação de usuários e definição de senha
 */
import { supabase } from './supabase';
import bcrypt from 'bcryptjs';
import { Pool } from 'pg';
import { sendVerificationEmail } from './email';
import { generateCode } from './code-service';

/**
 * Verifica se um usuário existe e retorna suas informações
 * @param identifier Email ou telefone do usuário
 * @returns Informações do usuário ou null se não existir
 */
export async function checkUserExists(identifier: string) {
  try {
    // Verificar se o identificador é um email ou telefone
    const isEmail = identifier.includes('@');

    // Buscar o usuário
    const { data: user, error } = await supabase
      .from('users_unified')
      .select('*')
      .or(isEmail ? `email.eq.${identifier}` : `phone_number.eq.${identifier}`)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Erro ao buscar usuário:', error);
      return null;
    }

    return user;
  } catch (error) {
    console.error('Erro ao verificar existência do usuário:', error);
    return null;
  }
}

/**
 * Verifica se um usuário tem senha definida
 * @param userId ID do usuário
 * @returns Verdadeiro se o usuário tem senha definida
 */
export async function hasPasswordDefined(userId: string) {
  try {
    const { data: user, error } = await supabase
      .from('users_unified')
      .select('password, password_hash')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Erro ao buscar usuário:', error);
      return false;
    }

    return !!(user?.password || user?.password_hash);
  } catch (error) {
    console.error('Erro ao verificar se usuário tem senha definida:', error);
    return false;
  }
}

/**
 * Define a senha para um usuário
 * @param userId ID do usuário
 * @param password Nova senha
 * @returns Resultado da operação
 */
export async function setUserPassword(userId: string, password: string) {
  try {
    // Verificar se a senha atende aos requisitos mínimos
    if (password.length < 8) {
      return {
        success: false,
        message: 'A senha deve ter pelo menos 8 caracteres'
      };
    }

    // Gerar hash da senha
    const hashedPassword = await bcrypt.hash(password, 10);

    // Atualizar usuário
    const { error } = await supabase
      .from('users_unified')
      .update({
        password: hashedPassword,
        password_hash: hashedPassword,
        password_last_changed: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) {
      console.error('Erro ao atualizar senha:', error);
      return {
        success: false,
        message: 'Erro ao definir senha'
      };
    }

    return {
      success: true,
      message: 'Senha definida com sucesso'
    };
  } catch (error) {
    console.error('Erro ao definir senha:', error);
    return {
      success: false,
      message: 'Erro ao definir senha'
    };
  }
}

/**
 * Verifica se um usuário é externo (não tem conta pré-definida)
 * @param identifier Email ou telefone do usuário
 * @returns Verdadeiro se o usuário é externo
 */
export async function isExternalUser(identifier: string) {
  try {
    const user = await checkUserExists(identifier);

    // Se o usuário não existe, é considerado externo
    if (!user) {
      return true;
    }

    // Se o usuário existe mas não tem senha definida, é considerado importado
    if (!user.password && !user.password_hash) {
      return false;
    }

    // Se o usuário existe e tem senha definida, não é externo
    return false;
  } catch (error) {
    console.error('Erro ao verificar se usuário é externo:', error);
    return false;
  }
}

/**
 * Cria um novo usuário externo
 * @param userData Dados do usuário
 * @returns Resultado da operação
 */
export async function createExternalUser(userData: {
  email?: string;
  phoneNumber?: string;
  firstName: string;
  lastName: string;
  password: string;
}) {
  try {
    const { email, phoneNumber, firstName, lastName, password } = userData;

    // Verificar se já existe um usuário com este email ou telefone
    const { data: existingUser, error: searchError } = await supabase
      .from('users_unified')
      .select('id')
      .or(email ? `email.eq.${email}` : `phone_number.eq.${phoneNumber}`)
      .single();

    if (existingUser && !searchError) {
      return {
        success: false,
        message: 'Já existe um usuário com este email ou telefone'
      };
    }

    // Gerar hash da senha
    const hashedPassword = await bcrypt.hash(password, 10);

    // Criar o usuário
    const { data: user, error } = await supabase
      .from('users_unified')
      .insert({
        email: email || '',
        phone_number: phoneNumber || '',
        first_name: firstName,
        last_name: lastName,
        password: hashedPassword,
        password_hash: hashedPassword,
        role: 'USER', // Sempre USER para usuários externos
        active: true,
        password_last_changed: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar usuário:', error);
      return {
        success: false,
        message: 'Erro ao criar usuário'
      };
    }

    return {
      success: true,
      message: 'Usuário criado com sucesso',
      user
    };
  } catch (error) {
    console.error('Erro ao criar usuário externo:', error);
    return {
      success: false,
      message: 'Erro ao criar usuário'
    };
  }
}

/**
 * Envia um código de verificação para definição de senha
 * @param userId ID do usuário
 * @param email Email do usuário
 * @returns Resultado da operação
 */
export async function sendPasswordSetupCode(userId: string, email: string) {
  try {
    // Gerar código de verificação
    const code = generateCode();

    // Calcular data de expiração (10 minutos)
    const expires = new Date();
    expires.setMinutes(expires.getMinutes() + 10);

    // Atualizar usuário com o código
    const { error } = await supabase
      .from('users_unified')
      .update({
        verification_code: code,
        verification_code_expires: expires.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) {
      console.error('Erro ao atualizar código de verificação:', error);
      return {
        success: false,
        message: 'Erro ao gerar código de verificação'
      };
    }

    // Enviar email com o código
    const result = await sendVerificationEmail(email, code);

    return {
      success: result.success,
      message: result.success ? 'Código enviado com sucesso' : 'Erro ao enviar código'
    };
  } catch (error) {
    console.error('Erro ao enviar código de verificação:', error);
    return {
      success: false,
      message: 'Erro ao enviar código de verificação'
    };
  }
}
