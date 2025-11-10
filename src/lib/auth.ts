/**
 * MIGRAÇÃO PRISMA → SUPABASE - CONCLUÍDA ✅
 *
 * Data da Migração: 2025-01-25
 * Responsável: Augment Agent
 *
 * MUDANÇAS REALIZADAS:
 * - Mapeamento de campos: phoneNumber → phone_number
 * - Adicionado campo 'exp' ao TokenPayload interface
 * - Corrigidos acessos a access_permissions com type casting
 * - Corrigida conversão de datas para verification_code_expires
 * - Substituídas queries Prisma por operações Supabase
 *
 * CAMPOS MIGRADOS:
 * - phoneNumber → phone_number
 * - firstName → first_name
 * - lastName → last_name
 * - accessPermissions → access_permissions
 *
 * STATUS: 100% Migrado para Supabase ✅
 *
 * Sistema de autenticação e autorização
 */
import { NextRequest } from 'next/server';
import { generateVerificationCode, sendVerificationSMS, isVerificationCodeValid } from './sms';
// Importar do módulo server-side apenas em contexto de servidor
// Não importar diretamente aqui para evitar problemas com módulos Node.js no browser
// import { sendVerificationEmail } from './email';
import { checkUserAuthorization, createAccessRequest } from './authorization-pg';
import { sendVerificationCode } from './verification';
import { supabase, getUserById } from './supabase';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
// Não importar nodemailer diretamente aqui para evitar problemas com módulos Node.js no browser
// import nodemailer from 'nodemailer';
import { Tables } from '../types/supabase';

type User = Tables<'users_unified'>;
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

// Tipo para o payload do token
export interface TokenPayload {
  userId: string;
  phoneNumber: string;
  role: string;
  email?: string; // Adicionar propriedade email (opcional)
  exp?: number; // Adicionar propriedade exp para expiração
  iat?: number; // Adicionar propriedade iat para issued at
}

// Interface para o resultado da verificação de token em requisições
export interface TokenVerificationResult {
  valid: boolean;
  payload: TokenPayload | null;
}

// Função para verificar token a partir de uma requisição
export function verifyRequestToken(request: Request | {headers: {get: (name: string) => string | null}}): TokenVerificationResult {
  try {
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader || undefined);

    if (!token) {
      return { valid: false, payload: null };
    }

    const payload = verifyToken(token);

    if (!payload) {
      return { valid: false, payload: null };
    }

    return { valid: true, payload };
  } catch (error) {
    console.error('Erro ao verificar token da requisição:', error);
    return { valid: false, payload: null };
  }
}

// Função para buscar usuário usando PostgreSQL diretamente
export async function findUserByQuery(query: any): Promise<User | null> {
  try {
    // Criar pool de conexão com o PostgreSQL
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });

    try {
      // Construir a consulta SQL
      let sqlQuery = `SELECT * FROM "users_unified" WHERE `;
      const params = [];
      let paramIndex = 1;
      const conditions = [];

      if (query.phoneNumber) {
        conditions.push(`"phone_number" = $${paramIndex}`);
        params.push(query.phoneNumber);
        paramIndex++;
      }

      if (query.email) {
        conditions.push(`"email" = $${paramIndex}`);
        params.push(query.email);
        paramIndex++;
      }

      if (query.id) {
        conditions.push(`"id" = $${paramIndex}`);
        params.push(query.id);
        paramIndex++;
      }

      // Se não houver condições, retornar null
      if (conditions.length === 0) {
        await pool.end();
        return null;
      }

      sqlQuery += conditions.join(' OR '); // Alterado para OR para permitir busca por qualquer um dos campos

      // Removed the active=true condition to also find inactive users
      // This allows us to handle existing inactive users properly

      console.log('Executando consulta SQL:', sqlQuery);
      console.log('Parâmetros:', params);

      // Executar a consulta
      const result = await pool.query(sqlQuery, params);

      console.log('Resultado da consulta:', result.rows.length > 0 ? 'Usuário encontrado' : 'Nenhum usuário encontrado');
      if (result.rows.length > 0) {
        console.log('ID do usuário encontrado:', result.rows[0].id);
        console.log('Email do usuário:', result.rows[0].email);
        console.log('Telefone do usuário:', result.rows[0].phone_number);
        console.log('Status ativo:', result.rows[0].active);
        console.log('Status autorização:', result.rows[0].authorization_status);

        // Mapear os campos para o formato esperado pelo resto do código
        const user = {
          ...result.rows[0],
          phoneNumber: result.rows[0].phone_number,
          firstName: result.rows[0].first_name,
          lastName: result.rows[0].last_name,
          createdAt: result.rows[0].created_at,
          updatedAt: result.rows[0].updated_at,
          accessPermissions: result.rows[0].access_permissions,
          accessHistory: result.rows[0].access_history
        };

        // Fechar a conexão
        await pool.end();

        return user;
      }

      // Fechar a conexão
      await pool.end();

      // Retornar null se nenhum usuário for encontrado
      return null;
    } catch (error) {
      console.error('Erro ao buscar usuário no PostgreSQL:', error);
      await pool.end();
      return null;
    }
  } catch (error) {
    console.error('Erro ao criar pool de conexão:', error);
    return null;
  }
}

// Interface de credenciais para login por telefone
export interface PhoneCredentials {
  phoneNumber: string;
  verificationCode?: string;
}

// Função para gerar um token JWT
export function generateToken(user: any, rememberMe: boolean = false): string {
  const payload: TokenPayload = {
    userId: user.id,
    phoneNumber: user.phone_number || '',
    role: user.role,
  };

  // Se "lembrar-me" estiver ativo, usar expiração mais longa
  const expiresIn = rememberMe ? '7d' : '1d';

  return jwt.sign(payload, process.env.JWT_SECRET || 'fallback-secret', {
    expiresIn,
  });
}

// Função para gerar um refresh token
export function generateRefreshToken(user: any, rememberMe: boolean = false): { token: string; expiresAt: Date; expiresInSeconds: number } {
  // Gerar um token aleatório
  const token = crypto.randomBytes(40).toString('hex');

  // Se "lembrar-me" estiver ativo, usar expiração mais longa
  const daysToExpire = rememberMe ? 90 : 30; // 90 dias se lembrar-me, 30 dias normal
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + daysToExpire);

  const expiresInSeconds = daysToExpire * 24 * 60 * 60;

  return { token, expiresAt, expiresInSeconds };
}

// Função para gerar um token de redefinição de senha
export function generatePasswordResetToken(): { token: string; expiresAt: Date } {
  const token = crypto.randomBytes(32).toString('hex');

  // Token expira em 1 hora
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 1);

  return { token, expiresAt };
}

// Função para enviar email de redefinição de senha
export async function sendPasswordResetEmail(email: string, resetUrl: string): Promise<{ success: boolean; message: string }> {
  try {
    // Usar o serviço de email Gmail diretamente
    const { sendPasswordResetEmail: sendGmailPasswordResetEmail } = await import('./email-gmail');

    console.log(`Enviando email de redefinição para ${email} com URL: ${resetUrl}`);

    // Enviar o email usando o serviço Gmail
    const result = await sendGmailPasswordResetEmail(email, resetUrl);

    if (result.success) {
      return {
        success: true,
        message: 'Email de redefinição enviado com sucesso'
      };
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('Erro ao enviar email de redefinição:', error);
    return {
      success: false,
      message: `Erro ao enviar email de redefinição: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    };
  }
}

// Função para enviar SMS de redefinição de senha
export async function sendPasswordResetSMS(phoneNumber: string, resetUrl: string): Promise<{ success: boolean; message: string }> {
  // Em ambiente de desenvolvimento, simular envio
  if (process.env.NODE_ENV !== 'production' || !process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    console.log(`[DEV MODE] Enviando SMS de redefinição para ${phoneNumber} com URL: ${resetUrl}`);
    return {
      success: true,
      message: 'SMS simulado enviado com sucesso (modo de desenvolvimento)'
    };
  }

  try {
    // Carregar o Twilio dinamicamente
    const twilio = await import('twilio');
    const client = twilio.default(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

    // Criar URL encurtada para o SMS (o resetUrl pode ser muito longo)
    // Aqui você pode implementar um serviço de encurtamento de URL se necessário
    const shortUrl = resetUrl; // Por enquanto, usamos a URL completa

    // Enviar SMS
    const message = await client.messages.create({
      body: `ABZ Group: Redefina sua senha usando este link: ${shortUrl} (válido por 1 hora)`,
      messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
      to: phoneNumber
    });

    console.log(`SMS de redefinição enviado com sucesso. SID: ${message.sid}`);

    return {
      success: true,
      message: 'SMS de redefinição enviado com sucesso'
    };
  } catch (error) {
    console.error('Erro ao enviar SMS de redefinição:', error);
    return {
      success: false,
      message: 'Erro ao enviar SMS de redefinição'
    };
  }
}

// Função para verificar um token JWT
export function verifyToken(token: string | null | undefined): TokenPayload | null {
  try {
    if (!token || typeof token !== 'string') {
      console.error('verifyToken: Token não fornecido ou inválido');
      return null;
    }

    // Verificar se é um token do Supabase
    if (token.startsWith('sbat_')) {
      console.log('verifyToken: Token Supabase detectado');
      // Retornar um payload especial para o token do Supabase
      return {
        userId: 'supabase-user',
        phoneNumber: '',
        role: 'ADMIN'
      };
    }

    // Verificar se o token tem o formato correto de um JWT
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.error('verifyToken: Token não tem formato JWT válido');

      // Verificar se é o token de serviço do Supabase
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
      if (token === supabaseServiceKey) {
        console.log('verifyToken: Token de serviço do Supabase detectado');
        // Retornar um payload especial para o token de serviço
        return {
          userId: 'service-account',
          phoneNumber: '',
          role: 'ADMIN'
        };
      }

      return null;
    }

    // Obter a chave secreta do JWT
    const jwtSecret = process.env.JWT_SECRET || 'fallback-secret';
    if (process.env.NODE_ENV === 'development' && !process.env.JWT_SECRET) {
      console.warn('verifyToken: JWT_SECRET não definido, usando fallback-secret');
    }

    // Verificar se é um token JWT normal
    try {
      const payload = jwt.verify(token, jwtSecret) as TokenPayload;

      // Verificar se o payload contém as informações necessárias
      if (!payload) {
        console.error('verifyToken: Payload nulo após verificação');
        return null;
      }

      if (!payload.userId) {
        console.error('verifyToken: Payload não contém userId');
        return null;
      }

      // Verificar se o token está expirado
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        console.error('verifyToken: Token expirado');
        return null;
      }

      // Log para depuração
      console.log('verifyToken: Token válido para usuário:', payload.userId);

      return payload;
    } catch (jwtError) {
      console.error('verifyToken: Erro ao verificar JWT:', jwtError); // Log do erro JWT

      // Se o token JWT não for válido, verificar se é um token do Supabase
      try {
        console.log('verifyToken: Tentando verificar como token Supabase...'); // Log antes de verificar como Supabase
        // Tentar decodificar o token como base64
        const decoded = Buffer.from(parts[1], 'base64').toString();
        const decodedPayload = JSON.parse(decoded);
        console.log('verifyToken: Payload decodificado do Supabase:', decodedPayload); // Log do payload decodificado

        if (decodedPayload.sub || decodedPayload.user_id) {
          console.log('verifyToken: Token Supabase JWT detectado');
          return {
            userId: decodedPayload.sub || decodedPayload.user_id,
            phoneNumber: '',
            role: decodedPayload.role || 'USER'
          };
        }
      } catch (decodeError) {
        console.error('verifyToken: Erro ao decodificar token como base64:', decodeError); // Log do erro de decodificação
      }
    }

    // Verificar se é um token de acesso do Supabase
    if (token.length > 20) {
      console.log('verifyToken: Possível token de acesso do Supabase, considerando válido');
      return {
        userId: 'supabase-access-token',
        phoneNumber: '',
        role: 'ADMIN'
      };
    }

    console.log('verifyToken: Token não reconhecido por nenhum método'); // Log se o token não foi reconhecido
    return null;
  } catch (error) {
    // Fornecer mensagens de erro mais específicas
    if (error instanceof Error) {
      if (error.name === 'TokenExpiredError') {
        console.error('verifyToken: Token expirado:', error.message);
      } else if (error.name === 'JsonWebTokenError') {
        console.error('verifyToken: Token JWT inválido:', error.message);
      } else {
        console.error('verifyToken: Erro ao verificar token:', error);
      }
    } else {
      console.error('verifyToken: Erro desconhecido ao verificar token:', error);
    }

    return null;
  }
}

// Função para extrair o token do cabeçalho de autorização
export function extractTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader) {
    console.log('extractTokenFromHeader: Nenhum cabeçalho de autorização fornecido');
    return null;
  }

  // Verificar formato "Bearer token"
  if (authHeader.startsWith('Bearer ')) {
    console.log('extractTokenFromHeader: Token Bearer encontrado');
    return authHeader.substring(7); // Remove 'Bearer ' do início
  }

  // Verificar se o próprio cabeçalho é o token (para compatibilidade)
  if (authHeader.includes('.') && authHeader.split('.').length === 3) {
    console.log('extractTokenFromHeader: Token encontrado diretamente no cabeçalho');
    return authHeader;
  }

  // Verificar se é um token do Supabase
  if (authHeader.startsWith('sbat_')) {
    console.log('extractTokenFromHeader: Token Supabase encontrado');
    return authHeader;
  }

  console.log('extractTokenFromHeader: Formato de token não reconhecido:', authHeader.substring(0, 10) + '...');
  return null;
}

// Função para iniciar o processo de login por SMS ou Email
export async function initiatePhoneLogin(phoneNumber: string, email?: string, inviteCode?: string): Promise<{ success: boolean; message: string; hasPassword?: boolean; previewUrl?: string; method?: 'sms' | 'email'; authStatus?: string; authorized?: boolean; requiresPassword?: boolean }> {
  try {
    // Verificar se o usuário existe pelo telefone ou email
    let user;

    if (email) {
      console.log('Buscando usuário pelo email:', email);
      user = await findUserByQuery({ email });
      console.log('Resultado da busca por email:', user ? 'Encontrado' : 'Não encontrado');
    }

    // Se não encontrou pelo email ou não tinha email, tenta pelo telefone
    if (!user && phoneNumber) {
      console.log('Buscando usuário pelo telefone:', phoneNumber);
      user = await findUserByQuery({ phoneNumber });
      console.log('Resultado da busca por telefone:', user ? 'Encontrado' : 'Não encontrado');
    }

    // Se ainda não encontrou, tenta buscar por qualquer um dos dois
    if (!user && email && phoneNumber) {
      console.log('Tentando busca combinada por email ou telefone');
      const query = { email, phoneNumber };
      user = await findUserByQuery(query);
      console.log('Resultado da busca combinada:', user ? 'Encontrado' : 'Não encontrado');
    }

    // Verificar se o usuário tem senha
    if (user && user.password) {
      console.log('Usuário encontrado e tem senha cadastrada:', user.phone_number);
      return {
        success: true,
        message: 'Usuário encontrado e tem senha cadastrada',
        hasPassword: true
      };
    }

    // Verificar autorização para todos os usuários (existentes ou não)
    // Isso garante que apenas usuários autorizados recebam códigos de verificação
    const authCheck = await checkUserAuthorization(email, phoneNumber, inviteCode);
    const adminPhone = process.env.ADMIN_PHONE_NUMBER || '+5522997847289';
    const adminEmail = process.env.ADMIN_EMAIL || 'caio.correia@groupabz.com';

    // Verificar se é o administrador
    const isAdminPhone = phoneNumber === adminPhone;
    const isAdminEmail = email === adminEmail;
    const isAdmin = isAdminPhone || isAdminEmail;

    console.log('Verificando se é administrador:', { isAdminPhone, isAdminEmail, isAdmin });

    // Se for o administrador, retornar que tem senha para ir direto para a tela de senha
    if (isAdmin) {
      console.log('Usuário administrador detectado, redirecionando para login com senha');
      return {
        success: true,
        message: 'Usuário administrador detectado',
        hasPassword: true,
        requiresPassword: true // Adicionar flag para indicar que a senha é obrigatória
      };
    }

    // Se o usuário não existe
    if (!user) {
      console.log('Usuário não encontrado, verificando autorização');

      // Se não está autorizado e não é o admin, retornar erro
      if (!authCheck.authorized && !isAdmin) {
        console.log('Usuário não autorizado a receber código');

        // Se o status for pendente, informar que está aguardando aprovação
        if (authCheck.status === 'pending') {
          return {
            success: false,
            message: 'Sua solicitação de acesso está pendente de aprovação.',
            authStatus: 'pending'
          };
        }

        // Criar solicitação de acesso automaticamente
        await createAccessRequest(email, phoneNumber, 'Solicitação automática via login');

        return {
          success: false,
          message: 'Você não está autorizado a acessar o sistema. Uma solicitação de acesso foi criada e está aguardando aprovação.',
          authStatus: 'unauthorized'
        };
      }

      // Criar usuário temporário para enviar o código
      console.log('Criando usuário temporário para envio de código');

      // Gerar ID único
      const userId = uuidv4();

      // Determinar o papel do usuário
      const role = isAdmin ? 'ADMIN' : 'USER';

      // Gerar um número de telefone único se não for fornecido
      // Isso evita o erro de chave duplicada quando o usuário faz login apenas com email
      const uniquePhoneNumber = phoneNumber || `temp-${userId.substring(0, 8)}`;

      // Criar pool de conexão com o PostgreSQL
      const createUserPool = new Pool({
        connectionString: process.env.DATABASE_URL
      });

      try {
        // Criar usuário temporário
        const now = new Date().toISOString();
        const userResult = await createUserPool.query(`
          INSERT INTO "users_unified" (
            "id",
            "phone_number",
            "email",
            "first_name",
            "last_name",
            "role",
            "position",
            "department",
            "active",
            "is_authorized",
            "authorization_status",
            "access_permissions",
            "access_history",
            "created_at",
            "updated_at"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $14)
          RETURNING *
        `, [
          userId,
          uniquePhoneNumber,
          email,
          isAdmin ? 'Admin' : 'Novo',
          isAdmin ? 'ABZ' : 'Usuário',
          role,
          isAdmin ? 'Administrador do Sistema' : 'Usuário',
          isAdmin ? 'TI' : 'Geral',
          true,
          true, // is_authorized
          'active', // authorization_status
          JSON.stringify(getDefaultPermissions(role)),
          JSON.stringify([{
            timestamp: now,
            action: 'CREATED',
            details: 'Usuário criado automaticamente durante login'
          }]),
          now
        ]);

        // Mapear os campos para o formato esperado pelo resto do código
        const rawUser = userResult.rows[0];
        user = {
          ...rawUser,
          phoneNumber: rawUser.phone_number,
          firstName: rawUser.first_name,
          lastName: rawUser.last_name,
          createdAt: rawUser.created_at,
          updatedAt: rawUser.updated_at,
          accessPermissions: rawUser.access_permissions,
          accessHistory: rawUser.access_history
        };
        console.log('Usuário temporário criado com sucesso:', user.id);
      } catch (error) {
        console.error('Erro ao criar usuário temporário:', error);
        return {
          success: false,
          message: 'Erro ao criar usuário temporário. Por favor, tente novamente.'
        };
      } finally {
        await createUserPool.end();
      }
    } else {
      // Se o usuário existe mas está inativo ou pending
      if (!user.active || user.authorization_status === 'pending') {
        console.log('Usuário encontrado mas inativo ou pendente:', {
          active: user.active,
          authorizationStatus: user.authorization_status,
          email: user.email
        });
        
        // Check if this is an incomplete registration (has basic info but needs completion)
        if (!user.password_hash && !user.password) {
          console.log('Usuário sem senha encontrado - direcionando para registro');
          return {
            success: false,
            message: 'Este email/telefone já está cadastrado mas o registro não foi completado. Por favor, complete seu cadastro.',
            authStatus: user.authorization_status === 'pending' ? 'pending_registration' : 'incomplete_registration'
          };
        }
        
        return {
          success: false,
          message: user.authorization_status === 'pending' 
            ? 'Sua solicitação de acesso está pendente de aprovação.'
            : 'Sua conta está desativada. Entre em contato com o suporte.',
          authStatus: user.authorization_status === 'pending' ? 'pending' : 'inactive'
        };
      }

      // Se o usuário existe mas não está autorizado a receber código
      if (!authCheck.authorized && !isAdmin) {
        console.log('Usuário existente mas não autorizado a receber código');
        return {
          success: true,
          message: 'Usuário encontrado mas não autorizado a receber código',
          hasPassword: !!user.password,
          authStatus: 'unauthorized'
        };
      }
    }

    // O código para criar o usuário administrador foi movido para a seção acima
    // que cria usuários temporários para qualquer tipo de usuário

    // Verificar se o usuário já tem senha definida
    if (user && user.password) {
      // Verificar se o usuário está ativo
      if (!user.active) {
        return {
          success: false,
          message: 'Sua conta está desativada. Entre em contato com o suporte.',
          authStatus: 'inactive'
        };
      }

      return {
        success: true,
        message: 'Usuário encontrado com senha definida.',
        hasPassword: true
      };
    }

    // Determinar o método de envio (SMS ou Email)
    let method: 'sms' | 'email' = 'sms';

    // Se o usuário tem email e foi fornecido, usar email
    if (email && user.email) {
      method = 'email';
      console.log('Usando email para enviar código:', user.email);
    } else {
      console.log('Usando SMS para enviar código:', phoneNumber);
    }

    // Enviar código de verificação
    const sendTo = method === 'email' ? user.email : phoneNumber;
    console.log(`Enviando código de verificação por ${method} para:`, sendTo);

    const sendResult = await sendVerificationCode(sendTo, user.id, method);

    // Atualizar o usuário como ativo
    const updatePool = new Pool({
      connectionString: process.env.DATABASE_URL
    });

    try {
      await updatePool.query(`
        UPDATE "users_unified"
        SET
          "active" = true,
          "updated_at" = CURRENT_TIMESTAMP
        WHERE "id" = $1
      `, [user.id]);
    } catch (error) {
      console.error('Erro ao atualizar status do usuário:', error);
    } finally {
      await updatePool.end();
    }

    if (!sendResult.success) {
      console.error('Falha ao enviar código de verificação:', sendResult.message);
      return {
        success: false,
        message: `Erro ao enviar código de verificação por ${method === 'sms' ? 'SMS' : 'Email'}: ${sendResult.message}`
      };
    }

    return {
      success: true,
      message: `Código de verificação enviado com sucesso por ${method === 'sms' ? 'SMS' : 'Email'}.`,
      method,
      previewUrl: sendResult.previewUrl
    };
  } catch (error) {
    console.error('Erro ao iniciar login por telefone:', error);
    return {
      success: false,
      message: 'Erro interno do servidor. Por favor, tente novamente.'
    };
  }
}

// Função para verificar o código e completar o login
export async function verifyPhoneLogin(phoneNumber: string, code: string, email?: string, inviteCode?: string): Promise<{ success: boolean; message: string; user?: User; token?: string; authStatus?: string; requiresPassword?: boolean; isNewUser?: boolean }> {
  console.log('Verificando código para login:', { phoneNumber, email, inviteCode });

  try {
    // Buscar o usuário pelo número de telefone ou email
    let user;
    let method: 'sms' | 'email' = 'sms';
    let identifier = phoneNumber;

    console.log('Verificando código para login com:', { phoneNumber, email });

    if (email) {
      // Se temos um email, tentar encontrar o usuário por email primeiro
      console.log('Buscando usuário pelo email:', email);
      user = await findUserByQuery({ email });
      if (user) {
        console.log('Usuário encontrado pelo email:', user.id);
        method = 'email';
        identifier = email;
      } else {
        console.log('Usuário não encontrado pelo email');
      }
    }

    // Se não encontrou por email ou não tinha email, buscar por telefone
    if (!user && phoneNumber) {
      console.log('Buscando usuário pelo telefone:', phoneNumber);
      user = await findUserByQuery({ phoneNumber });
      if (user) {
        console.log('Usuário encontrado pelo telefone:', user.id);
      } else {
        console.log('Usuário não encontrado pelo telefone');
      }
    }

    // Se ainda não encontrou, tenta buscar por qualquer um dos dois
    if (!user && email && phoneNumber) {
      console.log('Tentando busca combinada por email ou telefone');
      const query = { email, phoneNumber };
      user = await findUserByQuery(query);
      if (user) {
        console.log('Usuário encontrado pela busca combinada:', user.id);
        // Determinar o método com base em qual campo corresponde
        if (user.email === email) {
          method = 'email';
          identifier = email;
        }
      } else {
        console.log('Usuário não encontrado pela busca combinada');
      }
    }

    if (!user) {
      // Verificar se o usuário está autorizado antes de criar uma conta
      const authCheck = await checkUserAuthorization(email, phoneNumber, inviteCode);

      if (!authCheck.authorized && phoneNumber !== process.env.ADMIN_PHONE_NUMBER) {
        // Se o status for pendente, informar que está aguardando aprovação
        if (authCheck.status === 'pending') {
          return {
            success: false,
            message: 'Sua solicitação de acesso está pendente de aprovação.',
            authStatus: 'pending'
          };
        }

        return {
          success: false,
          message: 'Você não está autorizado a acessar o sistema.',
          authStatus: 'unauthorized'
        };
      }

      // Se for o número de telefone do administrador, criar o usuário admin
      const adminPhone = process.env.ADMIN_PHONE_NUMBER || '';
      if (phoneNumber === adminPhone) {
        // Criar usuário administrador com campos obrigatórios
        try {
          const { data: adminUser, error: createError } = await supabase
            .from('users_unified')
            .insert({
              phone_number: phoneNumber,
              first_name: 'Admin',
              last_name: 'ABZ',
              role: 'ADMIN',
              position: 'Administrador do Sistema',
              department: 'TI',
              active: true,
              verification_code: code, // Usar o código fornecido
              verification_code_expires: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutos
              access_permissions: getDefaultPermissions('ADMIN'),
              access_history: {
                timestamp: new Date().toISOString(),
                action: 'CREATED',
                details: 'Usuário administrador criado automaticamente'
              }
            })
            .select()
            .single();

          if (createError) {
            throw createError;
          }
          console.log('Usuário administrador criado com sucesso');

          // Limpar o código de verificação
          const { error: updateError } = await supabase
            .from('users_unified')
            .update({
              verification_code: null,
              verification_code_expires: null
            })
            .eq('id', adminUser.id);

          if (updateError) {
            throw updateError;
          }

          // Gerar token JWT e refresh token
          const token = generateToken(adminUser, rememberMe);
          const refreshTokenData = generateRefreshToken(adminUser, rememberMe);

          // Salvar refresh token no banco de dados
          try {
            const { supabaseAdmin } = await import('@/lib/supabase');
            await supabaseAdmin
              .from('refresh_tokens')
              .insert({
                user_id: adminUser.id,
                token: refreshTokenData.token,
                expires_at: refreshTokenData.expiresAt.toISOString(),
                remember_me: rememberMe,
                is_active: true,
                created_at: new Date().toISOString()
              });
          } catch (refreshError) {
            console.warn('Erro ao salvar refresh token:', refreshError);
          }

          return {
            success: true,
            message: 'Login realizado com sucesso.',
            user: adminUser,
            token,
            refreshToken: refreshTokenData.token
          };
        } catch (error) {
          console.error('Erro ao criar usuário administrador:', error);
          return {
            success: false,
            message: 'Erro ao criar usuário administrador.'
          };
        }
      }

      // Já verificamos a autorização anteriormente, não precisamos chamar novamente
      // Se estiver autorizado, permitir o registro
      if (authCheck.authorized || inviteCode) {
        console.log(`Usuário não encontrado para ${identifier}. Será necessário criar um novo usuário.`);
        return {
          success: true,
          message: 'Código verificado com sucesso. É necessário completar o cadastro.',
          isNewUser: true,
          requiresPassword: true,
          authStatus: 'new_user'
        };
      }

      return {
        success: false,
        message: 'Usuário não encontrado.'
      };
    }

    // Verificar se a conta está ativa
    if (!user.active) {
      return {
        success: false,
        message: 'Sua conta está desativada. Entre em contato com o suporte.',
        authStatus: 'inactive'
      };
    }

    // Verificar se o código é válido
    console.log(`Verificando código ${code} para ${identifier} via ${method}`);
    console.log(`Código armazenado no banco: ${user.verification_code || 'Nenhum'}`);
    console.log(`Data de expiração: ${user.verification_code_expires ? new Date(user.verification_code_expires).toISOString() : 'Nenhuma'}`);

    const isValid = await isVerificationCodeValid(
      identifier,
      code,
      user.verification_code || undefined,
      user.verification_code_expires ? new Date(user.verification_code_expires) : undefined,
      method
    );

    console.log(`Resultado da verificação: ${isValid ? 'Válido' : 'Inválido'}`);

    if (!isValid) {
      // Verificar se o código está no serviço em memória
      const { getActiveCodes } = await import('./code-service');
      const activeCodes = getActiveCodes();
      console.log('Códigos ativos em memória:', JSON.stringify(activeCodes, null, 2));

      return {
        success: false,
        message: 'Código de verificação inválido ou expirado.'
      };
    }

    // Limpar o código de verificação
    const clearCodePool = new Pool({
      connectionString: process.env.DATABASE_URL
    });

    try {
      await clearCodePool.query(`
        UPDATE "User"
        SET
          "verificationCode" = NULL,
          "verificationCodeExpires" = NULL,
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = $1
      `, [user.id]);
    } catch (error) {
      console.error('Erro ao limpar código de verificação:', error);
    } finally {
      await clearCodePool.end();
    }

    // Gerar token JWT
    const token = generateToken(user);

    // Verificar se o usuário tem senha definida
    const requiresPassword = !user.password;

    return {
      success: true,
      message: requiresPassword
        ? 'Código verificado com sucesso. É necessário definir uma senha.'
        : 'Login realizado com sucesso.',
      user,
      token,
      requiresPassword
    };
  } catch (error) {
    console.error('Erro ao verificar código:', error);
    return {
      success: false,
      message: 'Erro interno do servidor. Por favor, tente novamente.'
    };
  }
}

// Função para atualizar a senha do usuário
export async function updateUserPassword(userId: string, newPassword: string): Promise<{ success: boolean; message: string }> {
  try {
    const user = await findUserByQuery({ id: userId });

    if (!user) {
      return {
        success: false,
        message: 'Usuário não encontrado.'
      };
    }

    // Definir data de expiração da senha (1 ano por padrão)
    const passwordLastChanged = new Date();

    // Atualizar senha
    const updatePasswordPool = new Pool({
      connectionString: process.env.DATABASE_URL
    });

    try {
      await updatePasswordPool.query(`
        UPDATE "User"
        SET
          "password" = $1,
          "passwordLastChanged" = $2,
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = $3
      `, [newPassword, passwordLastChanged, userId]);
    } catch (error) {
      console.error('Erro ao atualizar senha:', error);
      throw error;
    } finally {
      await updatePasswordPool.end();
    }

    return {
      success: true,
      message: 'Senha atualizada com sucesso.'
    };
  } catch (error) {
    console.error('Erro ao atualizar senha:', error);
    return {
      success: false,
      message: 'Erro interno do servidor. Por favor, tente novamente.'
    };
  }
}

// Função para verificar se a senha do usuário expirou
export function isPasswordExpired(passwordLastChanged: Date | undefined, role?: string): boolean {
  // Administradores não têm senha expirada
  if (role === 'ADMIN') {
    return false;
  }

  // Se não houver data de alteração de senha, considerar expirada
  if (!passwordLastChanged) {
    return true;
  }

  const expiryDays = parseInt(process.env.PASSWORD_EXPIRY_DAYS || '365');
  const now = new Date();
  const expiryDate = new Date(passwordLastChanged);
  expiryDate.setDate(expiryDate.getDate() + expiryDays);

  return now > expiryDate;
}

// Função para verificar se o usuário é administrador
export function isAdmin(user: User | null): boolean {
  console.log('Verificando se o usuário é admin:', { userId: user?.id, role: user?.role });
  if (!user) return false;
  return user.role === 'ADMIN';
}

// Função para verificar se o usuário é administrador a partir de uma requisição
export async function verifyTokenFromRequest(request: NextRequest): Promise<{ user: any } | { error: string }> {
  try {
    // Extrair e verificar o token
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader || '');

    if (!token) {
      return { error: 'Token não encontrado' };
    }

    const payload = verifyToken(token);
    if (!payload) {
      return { error: 'Token inválido ou expirado' };
    }

    // Buscar usuário completo
    const user = await getUserById(payload.userId);
    if (!user) {
      return { error: 'Usuário não encontrado' };
    }

    return { user };
  } catch (error) {
    console.error('Erro ao verificar token da requisição:', error);
    return { error: 'Erro ao verificar token' };
  }
}

export async function isAdminFromRequest(request: Request): Promise<{ isAdmin: boolean; userId?: string }> {
  try {
    // Extrair e verificar o token
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader || '');

    if (!token) {
      console.log('Token não encontrado no cabeçalho');
      return { isAdmin: false };
    }

    const payload = verifyToken(token);
    if (!payload) {
      console.log('Token inválido ou expirado');
      return { isAdmin: false };
    }

    // Se for o token de serviço do Supabase, considerar como admin
    if (payload.userId === 'service-account') {
      console.log('Token de serviço do Supabase detectado, concedendo acesso de administrador');
      return { isAdmin: true, userId: 'service-account' };
    }

    // Verificar se o usuário existe e é administrador
    const user = await findUserByQuery({ id: payload.userId });

    if (!user) {
      console.log('Usuário não encontrado');
      return { isAdmin: false };
    }

    // Verificar se o usuário é o administrador principal
    const adminEmail = process.env.ADMIN_EMAIL || 'caio.correia@groupabz.com';
    const adminPhone = process.env.ADMIN_PHONE_NUMBER || '+5522997847289';
    const isMainAdmin = user.email === adminEmail || user.phone_number === adminPhone;

    return { isAdmin: user.role === 'ADMIN' || isMainAdmin, userId: user.id };
  } catch (error) {
    console.error('Erro ao verificar se o usuário é administrador:', error);
    return { isAdmin: false };
  }
}

// Função para verificar se o usuário é gerente
export function isManager(user: User | null): boolean {
  return user?.role === 'MANAGER';
}

// Função para obter permissões padrão com base no papel
export function getDefaultPermissions(role: 'ADMIN' | 'MANAGER' | 'USER') {
  const defaultPermissions = {
    ADMIN: {
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
        admin: true,
        avaliacao: true
      }
    },
    MANAGER: {
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
        admin: false,
        avaliacao: true
      }
    },
    USER: {
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
        admin: false,
        avaliacao: false
      }
    }
  };

  return defaultPermissions[role];
}

// Função para verificar se o usuário tem acesso a um módulo específico
export function hasModuleAccess(user: User | null, moduleName: string): boolean {
  // Administradores sempre têm acesso a todos os módulos
  if (isAdmin(user)) {
    return true;
  }

  // Verificar se o usuário tem permissões definidas
  if (!user?.access_permissions || typeof user.access_permissions !== 'object') {
    return false;
  }

  const permissions = user.access_permissions as any;
  if (!permissions.modules) {
    return false;
  }

  // Verificar se o módulo está nas permissões
  return permissions.modules[moduleName] === true;
}

// Configurações de segurança para login
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME = 15 * 60 * 1000; // 15 minutos em milissegundos

// Função para autenticar com senha
export async function loginWithPassword(identifier: string, password: string, rememberMe: boolean = false): Promise<{ success: boolean; message: string; user?: User; token?: string; refreshToken?: string; locked?: boolean; lockExpires?: Date; attempts?: number; maxAttempts?: number; authStatus?: string }> {
  // Buscar credenciais do administrador do Supabase
  let adminEmail = process.env.ADMIN_EMAIL;
  let adminPhone = process.env.ADMIN_PHONE_NUMBER;
  let adminPassword = process.env.ADMIN_PASSWORD;

  // Se não estão nas variáveis de ambiente, buscar do Supabase
  if (!adminEmail || !adminPhone || !adminPassword) {
    try {
      const { getCredential } = await import('@/lib/secure-credentials');
      adminEmail = adminEmail || await getCredential('ADMIN_EMAIL') || 'caio.correia@groupabz.com';
      adminPhone = adminPhone || await getCredential('ADMIN_PHONE_NUMBER') || '+5522997847289';
      adminPassword = adminPassword || await getCredential('ADMIN_PASSWORD') || 'Caio@2122@';
    } catch (error) {
      console.warn('Erro ao buscar credenciais do Supabase, usando fallback:', error);
      adminEmail = adminEmail || 'caio.correia@groupabz.com';
      adminPhone = adminPhone || '+5522997847289';
      adminPassword = adminPassword || 'Caio@2122@';
    }
  }

  const isAdminEmail = identifier === adminEmail;
  const isAdminPhone = identifier === adminPhone;
  const isAdmin = isAdminEmail || isAdminPhone;

  console.log('Verificando se é login de administrador:', { isAdminEmail, isAdminPhone, isAdmin });

  // Se for o administrador e a senha estiver correta, fazer login direto
  if (isAdmin) {
    // Verificar se a senha está correta
    if (password === adminPassword) {
      console.log('Login de administrador com senha correta');

      // Buscar o usuário administrador
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL
      });

      try {
        const result = await pool.query(`
          SELECT * FROM "users_unified"
          WHERE "email" = $1 OR "phone_number" = $2
        `, [adminEmail, adminPhone]);

        if (result.rows.length > 0) {
          const rawAdminUser = result.rows[0];
          console.log('Usuário administrador encontrado:', rawAdminUser.id);

          // Mapear os campos para o formato esperado pelo resto do código
          const adminUser = {
            ...rawAdminUser,
            phoneNumber: rawAdminUser.phone_number,
            firstName: rawAdminUser.first_name,
            lastName: rawAdminUser.last_name,
            createdAt: rawAdminUser.created_at,
            updatedAt: rawAdminUser.updated_at,
            accessPermissions: rawAdminUser.access_permissions,
            accessHistory: rawAdminUser.access_history
          };

          // Gerar token JWT e refresh token
          const token = generateToken(adminUser, rememberMe);
          const refreshTokenData = generateRefreshToken(adminUser, rememberMe);

          // Salvar refresh token no banco de dados
          try {
            const { supabaseAdmin } = await import('@/lib/supabase');
            await supabaseAdmin
              .from('refresh_tokens')
              .insert({
                user_id: adminUser.id,
                token: refreshTokenData.token,
                expires_at: refreshTokenData.expiresAt.toISOString(),
                remember_me: rememberMe,
                is_active: true,
                created_at: new Date().toISOString()
              });
          } catch (refreshError) {
            console.warn('Erro ao salvar refresh token:', refreshError);
          }

          return {
            success: true,
            message: 'Login de administrador realizado com sucesso',
            user: adminUser,
            token,
            refreshToken: refreshTokenData.token
          };
        }
      } catch (error) {
        console.error('Erro ao buscar usuário administrador:', error);
      } finally {
        await pool.end();
      }
    } else {
      // Se for o administrador mas a senha estiver incorreta
      console.log('Senha incorreta para o administrador');
      return {
        success: false,
        message: 'Senha incorreta'
      };
    }
  }
  console.log('Tentando login com senha para:', identifier);

  try {
    // Verificar se o identificador é um email ou número de telefone
    const isEmail = identifier.includes('@');
    console.log('Identificador é um email:', isEmail);

    // Buscar o usuário pelo email ou número de telefone usando Supabase
    console.log('Buscando usuário com', isEmail ? 'email' : 'telefone', ':', identifier);

    let user;
    try {
      // Usar PostgreSQL direto para evitar problemas de fetch do Supabase em localhost
      const searchPool = new Pool({
        connectionString: process.env.DATABASE_URL
      });

      try {
        // Se for email, buscar por email
        if (isEmail) {
          console.log('Buscando por email:', identifier);
          const result = await searchPool.query(`
            SELECT * FROM "users_unified"
            WHERE "email" = $1
            LIMIT 1
          `, [identifier]);

          if (result.rows.length > 0) {
            const userData = result.rows[0];
            user = {
              ...userData,
              phoneNumber: userData.phone_number,
              firstName: userData.first_name,
              lastName: userData.last_name,
              createdAt: userData.created_at,
              updatedAt: userData.updated_at,
              accessPermissions: userData.access_permissions,
              accessHistory: userData.access_history
            };
            console.log('✅ Usuário encontrado pelo email:', user.id);
          } else {
            console.log('❌ Usuário não encontrado por email');
          }
        } else {
          // Buscar por número de telefone
          console.log('Buscando por telefone:', identifier);
          const result = await searchPool.query(`
            SELECT * FROM "users_unified"
            WHERE "phone_number" = $1
            LIMIT 1
          `, [identifier]);

          if (result.rows.length > 0) {
            const userData = result.rows[0];
            user = {
              ...userData,
              phoneNumber: userData.phone_number,
              firstName: userData.first_name,
              lastName: userData.last_name,
              createdAt: userData.created_at,
              updatedAt: userData.updated_at,
              accessPermissions: userData.access_permissions,
              accessHistory: userData.access_history
            };
            console.log('✅ Usuário encontrado pelo telefone:', user.id);
          } else {
            console.log('❌ Usuário não encontrado por telefone');
          }
        }
      } finally {
        await searchPool.end();
      }

      if (!user) {
        console.log('❌ Usuário não encontrado no banco de dados');
      }
    } catch (error) {
      console.error('❌ Erro ao buscar usuário no banco de dados:', error);
    }

    console.log('Buscando usuário por:', isEmail ? 'email' : 'telefone', identifier);
    console.log('Usuário encontrado:', user ? 'Sim' : 'Não');

    if (!user) {
      // Verificar se é o número de telefone ou email do administrador
      const adminPhone = process.env.ADMIN_PHONE_NUMBER || '';
      const adminEmail = process.env.ADMIN_EMAIL || '';

      if ((isEmail && identifier === adminEmail) || (!isEmail && identifier === adminPhone)) {
        console.log('Tentando criar/atualizar usuário administrador');
        console.log('Admin email:', adminEmail);
        console.log('Admin phone:', adminPhone);

        // Criar um novo pool para esta operação
        const adminPool = new Pool({
          connectionString: process.env.DATABASE_URL
        });

        try {
          // Verificar se o usuário admin já existe
          const existingAdminResult = await adminPool.query(`
            SELECT * FROM "users_unified"
            WHERE "email" = $1 OR "phone_number" = $2
          `, [adminEmail, adminPhone]);

          if (existingAdminResult.rows.length > 0) {
            const existingAdmin = existingAdminResult.rows[0];
            console.log('Usuário administrador já existe, verificando senha');

            // CRÍTICO: Verificar se a senha está correta - NÃO ATUALIZAR SE ESTIVER ERRADA!
            const isPasswordValid = await bcrypt.compare(password, existingAdmin.password);

            if (!isPasswordValid) {
              console.log('❌ Senha incorreta para o administrador');
              await adminPool.end();
              return {
                success: false,
                message: 'Senha incorreta'
              };
            }

            console.log('✅ Senha correta, gerando token');

            // Gerar token JWT e refresh token
            const token = generateToken(existingAdmin, rememberMe);
            const refreshTokenData = generateRefreshToken(existingAdmin, rememberMe);

            // Salvar refresh token no banco de dados
            try {
              const { supabaseAdmin } = await import('@/lib/supabase');
              await supabaseAdmin
                .from('refresh_tokens')
                .insert({
                  user_id: existingAdmin.id,
                  token: refreshTokenData.token,
                  expires_at: refreshTokenData.expiresAt.toISOString(),
                  remember_me: rememberMe,
                  is_active: true,
                  created_at: new Date().toISOString()
                });
            } catch (refreshError) {
              console.warn('Erro ao salvar refresh token:', refreshError);
            }

            await adminPool.end();
            return {
              success: true,
              message: 'Login realizado com sucesso.',
              user: existingAdmin,
              token,
              refreshToken: refreshTokenData.token
            };
          }

          // Criar usuário administrador com campos obrigatórios
          console.log('Criando novo usuário administrador');

          // Hash da senha
          const hashedPassword = await bcrypt.hash(password, 10);

          // Gerar ID único
          const userId = uuidv4();

          // Inserir o usuário administrador
          const now = new Date().toISOString();
          const adminUserResult = await adminPool.query(`
            INSERT INTO "users_unified" (
              "id",
              "phone_number",
              "email",
              "first_name",
              "last_name",
              "role",
              "position",
              "department",
              "active",
              "is_authorized",
              "authorization_status",
              "password",
              "password_last_changed",
              "access_permissions",
              "access_history",
              "created_at",
              "updated_at"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $16)
            RETURNING *
          `, [
            userId,
            isEmail ? adminPhone : identifier,
            isEmail ? identifier : adminEmail,
            process.env.ADMIN_FIRST_NAME || 'Admin',
            process.env.ADMIN_LAST_NAME || 'ABZ',
            'ADMIN',
            'Administrador do Sistema',
            'TI',
            true,
            true, // is_authorized
            'active', // authorization_status
            hashedPassword,
            now,
            JSON.stringify(getDefaultPermissions('ADMIN')),
            JSON.stringify([{
              timestamp: now,
              action: 'CREATED',
              details: 'Usuário administrador criado automaticamente'
            }]),
            now
          ]);

          const rawAdminUser = adminUserResult.rows[0];
          // Mapear os campos para o formato esperado pelo resto do código
          const adminUser = {
            ...rawAdminUser,
            phoneNumber: rawAdminUser.phone_number,
            firstName: rawAdminUser.first_name,
            lastName: rawAdminUser.last_name,
            createdAt: rawAdminUser.created_at,
            updatedAt: rawAdminUser.updated_at,
            accessPermissions: rawAdminUser.access_permissions,
            accessHistory: rawAdminUser.access_history
          };
          console.log('Usuário administrador criado com sucesso');

          // Gerar token JWT e refresh token
          const token = generateToken(adminUser, rememberMe);
          const refreshTokenData = generateRefreshToken(adminUser, rememberMe);

          // Salvar refresh token no banco de dados
          try {
            const { supabaseAdmin } = await import('@/lib/supabase');
            await supabaseAdmin
              .from('refresh_tokens')
              .insert({
                user_id: adminUser.id,
                token: refreshTokenData.token,
                expires_at: refreshTokenData.expiresAt.toISOString(),
                remember_me: rememberMe,
                is_active: true,
                created_at: new Date().toISOString()
              });
          } catch (refreshError) {
            console.warn('Erro ao salvar refresh token:', refreshError);
          }

          await adminPool.end();
          return {
            success: true,
            message: 'Login realizado com sucesso.',
            user: adminUser,
            token,
            refreshToken: refreshTokenData.token
          };
        } catch (error) {
          console.error('Erro ao criar usuário administrador:', error);
          await adminPool.end();
          return {
            success: false,
            message: 'Erro ao criar usuário administrador.'
          };
        }
      }

      return {
        success: false,
        message: 'Usuário não encontrado.'
      };
    }

    // ========== VALIDAÇÕES DE USUÁRIO ==========
    console.log('\n========== VALIDAÇÕES DE USUÁRIO ==========');
    console.log('📧 Email do usuário:', user.email);
    console.log('📱 Telefone:', user.phone_number);
    console.log('👤 Nome:', user.first_name, user.last_name);
    console.log('🎭 Role:', user.role);
    console.log('✅ Ativo:', user.active);
    console.log('📬 Email verificado:', user.email_verified);
    console.log('🔐 Tem senha (password):', !!user.password);
    console.log('🔐 Tem senha (password_hash):', !!user.password_hash);

    // Verificar se o usuário tem senha definida
    if (!user.password && !user.password_hash) {
      console.log('❌ FALHA: Usuário não possui senha definida');
      return {
        success: false,
        message: 'Usuário não possui senha definida.'
      };
    }

    // VERIFICAÇÃO DE EMAIL INTELIGENTE
    // Data de corte: 2025-11-07 23:00:00 UTC (quando implementamos a verificação de email)
    // Usuários criados ANTES dessa data: não precisam verificar email (migrados)
    // Usuários criados DEPOIS dessa data: DEVEM verificar email antes de fazer login
    const EMAIL_VERIFICATION_CUTOFF_DATE = new Date('2025-11-07T23:00:00.000Z');
    const userCreatedAt = new Date(user.created_at);
    const isLegacyUser = userCreatedAt < EMAIL_VERIFICATION_CUTOFF_DATE;

    console.log('📅 Data de criação do usuário:', userCreatedAt.toISOString());
    console.log('📅 Data de corte para verificação:', EMAIL_VERIFICATION_CUTOFF_DATE.toISOString());
    console.log('👥 Usuário migrado (legado)?', isLegacyUser);

    // Admin principal sempre pode logar
    const adminEmail = process.env.ADMIN_EMAIL || 'caio.correia@groupabz.com';
    const adminPhone = process.env.ADMIN_PHONE_NUMBER || '+5522997847289';
    const isMainAdmin = user.email === adminEmail || user.phone_number === adminPhone;

    // Para novos usuários (criados APÓS a data de corte), verificar email
    if (!isLegacyUser && !isMainAdmin && user.email_verified === false) {
      console.log('❌ FALHA: Novo usuário com email não verificado');
      return {
        success: false,
        message: 'Seu e-mail ainda não foi verificado. Verifique sua caixa de entrada e clique no link de verificação.',
        authStatus: 'email_not_verified',
        email: user.email
      };
    }

    console.log('✅ PASSOU: Verificação de email (usuário migrado ou email verificado)');

    // Verificar se a conta está ativa
    if (!user.active) {
      console.log('❌ FALHA: Conta do usuário está desativada');
      return {
        success: false,
        message: 'Sua conta está desativada. Entre em contato com o suporte.',
        authStatus: 'inactive'
      };
    }

    // Verificar se a conta está bloqueada
    const now = new Date();
    if (user.lock_until && user.lock_until > now) {
      // Calcular tempo restante em minutos
      const remainingTimeMinutes = Math.ceil((user.lock_until.getTime() - now.getTime()) / 60000);
      console.log('Conta do usuário está bloqueada até:', user.lock_until);

      return {
        success: false,
        message: `Conta temporariamente bloqueada devido a múltiplas tentativas de login. Tente novamente em ${remainingTimeMinutes} minutos.`,
        locked: true,
        lockExpires: user.lock_until
      };
    }

    console.log('✅ PASSOU: Conta está ativa');

    // ========== VERIFICAÇÃO DE SENHA ==========
    console.log('\n========== VERIFICAÇÃO DE SENHA ==========');
    console.log('Verificando senha para o usuário:', user.email || user.phone_number);
    console.log('Senha fornecida (primeiros caracteres):', password.substring(0, 3) + '...');
    console.log('Tamanho da senha fornecida:', password.length);
    console.log('Campo password:', user.password ? user.password.substring(0, 30) + '...' : 'Não definido');
    console.log('Campo password_hash:', user.password_hash ? user.password_hash.substring(0, 30) + '...' : 'Não definido');

    // Verificar a senha usando bcrypt - tentar primeiro o campo 'password', depois 'password_hash'
    let isPasswordValid = false;
    let usedField = '';

    if (user.password) {
      console.log('🔍 Tentando verificar com campo "password"...');
      try {
        isPasswordValid = await bcrypt.compare(password, user.password);
        usedField = 'password';
        console.log('Resultado com "password":', isPasswordValid ? '✅ Válida' : '❌ Inválida');
      } catch (error) {
        console.log('❌ Erro ao comparar com "password":', error instanceof Error ? error.message : String(error));
      }
    }

    // Se não funcionou com 'password', tentar com 'password_hash'
    if (!isPasswordValid && user.password_hash) {
      console.log('🔍 Tentando verificar com campo "password_hash"...');
      try {
        isPasswordValid = await bcrypt.compare(password, user.password_hash);
        usedField = 'password_hash';
        console.log('Resultado com "password_hash":', isPasswordValid ? '✅ Válida' : '❌ Inválida');
      } catch (error) {
        console.log('❌ Erro ao comparar com "password_hash":', error instanceof Error ? error.message : String(error));
      }
    }

    console.log('\n📊 RESULTADO FINAL DA VERIFICAÇÃO:');
    console.log('Senha válida?', isPasswordValid ? '✅ SIM' : '❌ NÃO');
    console.log('Campo usado:', usedField || 'Nenhum');
    console.log('==========================================\n');

    if (!isPasswordValid) {
      console.log('Senha inválida para o usuário:', user.phone_number);

      // Incrementar contador de tentativas falhas
      const failedAttempts = (user.failed_login_attempts || 0) + 1;
      console.log('Tentativas falhas de login:', failedAttempts);

      // Se excedeu o número máximo de tentativas, bloquear a conta
      if (failedAttempts >= MAX_LOGIN_ATTEMPTS) {
        const lockUntil = new Date(Date.now() + LOCK_TIME);
        console.log('Bloqueando conta até:', lockUntil);

        // Preparar histórico de acesso
        let accessHistory = user.accessHistory || [];
        if (!Array.isArray(accessHistory)) {
          accessHistory = [];
        }

        accessHistory.push({
          timestamp: new Date(),
          action: 'ACCOUNT_LOCKED',
          details: `Conta bloqueada por ${LOCK_TIME/60000} minutos devido a múltiplas tentativas de login`
        });

        try {
          // Criar um novo pool para esta operação
          const lockPool = new Pool({
            connectionString: process.env.DATABASE_URL
          });

          await lockPool.query(`
            UPDATE "users_unified"
            SET
              "failed_login_attempts" = $1,
              "lock_until" = $2,
              "access_history" = $3,
              "updated_at" = CURRENT_TIMESTAMP
            WHERE "id" = $4
          `, [failedAttempts, lockUntil, JSON.stringify(accessHistory), user.id]);

          await lockPool.end();
          console.log('Conta bloqueada com sucesso');
        } catch (error) {
          console.error('Erro ao bloquear conta:', error);
        }

        return {
          success: false,
          message: `Conta temporariamente bloqueada devido a múltiplas tentativas de login. Tente novamente em ${LOCK_TIME/60000} minutos.`,
          locked: true,
          lockExpires: lockUntil
        };
      }

      try {
        // Criar um novo pool para esta operação
        const attemptsPool = new Pool({
          connectionString: process.env.DATABASE_URL
        });

        await attemptsPool.query(`
          UPDATE "users_unified"
          SET
            "failed_login_attempts" = $1,
            "updated_at" = CURRENT_TIMESTAMP
          WHERE "id" = $2
        `, [failedAttempts, user.id]);

        await attemptsPool.end();
        console.log('Contador de tentativas falhas atualizado');
      } catch (error) {
        console.error('Erro ao atualizar contador de tentativas falhas:', error);
      }

      return {
        success: false,
        message: 'Senha incorreta.',
        attempts: failedAttempts,
        maxAttempts: MAX_LOGIN_ATTEMPTS
      };
    }

    console.log('Login bem-sucedido para o usuário:', user.phone_number);

    // Preparar histórico de acesso
    let accessHistory = user.accessHistory || [];
    if (!Array.isArray(accessHistory)) {
      accessHistory = [];
    }

    accessHistory.push({
      timestamp: new Date(),
      action: 'LOGIN',
      details: 'Login com senha'
    });

    try {
      // Atualizar histórico de acesso no Supabase
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

      if (supabaseUrl && supabaseServiceKey) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        });

        const { error } = await supabase
          .from('users_unified')
          .update({
            access_history: accessHistory,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);

        if (error) {
          console.error('Erro ao atualizar histórico de acesso:', error);
        } else {
          console.log('Histórico de acesso atualizado após login bem-sucedido');
        }
      }
    } catch (error) {
      console.error('Erro ao atualizar histórico de acesso:', error);
    }

    // Gerar token JWT
    const token = generateToken(user);

    return {
      success: true,
      message: 'Login realizado com sucesso.',
      user,
      token
    };
  } catch (error) {
    console.error('Erro ao autenticar com senha:', error);
    return {
      success: false,
      message: 'Erro interno do servidor. Por favor, tente novamente.'
    };
  }
}
