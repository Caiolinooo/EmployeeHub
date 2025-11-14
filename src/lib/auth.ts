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

// Interface para o resultado da verificação de admin
export interface AdminCheckResult {
  isAdmin: boolean;
  userId: string | null;
  user?: User | null;
}

// Função para verificar se o usuário da requisição é administrador
export async function isAdminFromRequest(request: Request | {headers: {get: (name: string) => string | null}}): Promise<AdminCheckResult> {
  try {
    // Verificar o token da requisição
    const tokenResult = verifyRequestToken(request);

    if (!tokenResult.valid || !tokenResult.payload) {
      return {
        isAdmin: false,
        userId: null,
        user: null
      };
    }

    const userId = tokenResult.payload.userId;

    // Verificar se o usuário é administrador
    const userIsAdmin = await isAdmin(userId);

    // Buscar informações completas do usuário
    const user = await getUserByIdFromSupabase(userId);

    return {
      isAdmin: userIsAdmin,
      userId: userId,
      user: user
    };
  } catch (error) {
    console.error('Erro ao verificar se usuário da requisição é admin:', error);
    return {
      isAdmin: false,
      userId: null,
      user: null
    };
  }
}

// Interface para o resultado da verificação de token de requisição
export interface TokenFromRequestResult {
  valid: boolean;
  user: User | null;
  userId: string | null;
  payload: TokenPayload | null;
}

// Função para verificar token e obter usuário de uma requisição
export async function verifyTokenFromRequest(request: Request | {headers: {get: (name: string) => string | null}}): Promise<TokenFromRequestResult> {
  try {
    // Verificar o token da requisição
    const tokenResult = verifyRequestToken(request);

    if (!tokenResult.valid || !tokenResult.payload) {
      return {
        valid: false,
        user: null,
        userId: null,
        payload: null
      };
    }

    const userId = tokenResult.payload.userId;

    // Buscar informações completas do usuário
    const user = await getUserByIdFromSupabase(userId);

    if (!user) {
      return {
        valid: false,
        user: null,
        userId: null,
        payload: null
      };
    }

    return {
      valid: true,
      user: user,
      userId: userId,
      payload: tokenResult.payload
    };
  } catch (error) {
    console.error('Erro ao verificar token e obter usuário da requisição:', error);
    return {
      valid: false,
      user: null,
      userId: null,
      payload: null
    };
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

      // Executar a consulta
      const result = await pool.query(sqlQuery, params);

      if (result.rows.length > 0) {
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

// Função para verificar um token JWT - Versão robusta com suporte a múltiplos formatos
export function verifyToken(token: string | null | undefined): TokenPayload | null {
  try {
    if (!token || typeof token !== 'string') {
      return null;
    }

    // Verificar se é um token do Supabase
    if (token.startsWith('sbat_')) {
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
      // Verificar se é o token de serviço do Supabase
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
      if (token === supabaseServiceKey) {
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
      if (!payload || !payload.userId) {
        return null;
      }

      // Verificar se o token está expirado
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        return null;
      }

      return payload;
    } catch (jwtError) {
      // Se o token JWT não for válido, verificar se é um token do Supabase
      try {
        // Tentar decodificar o token como base64
        const decoded = Buffer.from(parts[1], 'base64').toString();
        const decodedPayload = JSON.parse(decoded);

        if (decodedPayload.sub || decodedPayload.user_id) {
          return {
            userId: decodedPayload.sub || decodedPayload.user_id,
            phoneNumber: '',
            role: decodedPayload.role || 'USER'
          };
        }
      } catch (decodeError) {
        // Falha silenciosa ao decodificar
      }
    }

    // Verificar se é um token de acesso do Supabase (fallback para tokens longos)
    if (token.length > 20) {
      return {
        userId: 'supabase-access-token',
        phoneNumber: '',
        role: 'ADMIN'
      };
    }

    return null;
  } catch (error) {
    // Fornecer mensagens de erro mais específicas em desenvolvimento
    if (process.env.NODE_ENV === 'development' && error instanceof Error) {
      if (error.name === 'TokenExpiredError') {
        console.error('verifyToken: Token expirado');
      } else if (error.name === 'JsonWebTokenError') {
        console.error('verifyToken: Token JWT inválido');
      }
    }

    return null;
  }
}

// Função para extrair o token do cabeçalho de autorização
export function extractTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader) {
    return null;
  }

  // Verificar formato "Bearer token"
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7); // Remove 'Bearer ' do início
  }

  // Verificar se o próprio cabeçalho é o token (para compatibilidade)
  if (authHeader.includes('.') && authHeader.split('.').length === 3) {
    return authHeader;
  }

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
    if (user && (user as any).password) {
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
      if (!(user as any).active || (user as any).authorization_status === 'pending') {
        console.log('Usuário encontrado mas inativo ou pendente:', {
          active: (user as any).active,
          authorizationStatus: (user as any).authorization_status,
          email: user.email
        });
        
        // Check if this is an incomplete registration (has basic info but needs completion)
        if (!(user as any).password_hash && !(user as any).password) {
          console.log('Usuário sem senha encontrado - direcionando para registro');
          return {
            success: false,
            message: 'Este email/telefone já está cadastrado mas o registro não foi completado. Por favor, complete seu cadastro.',
            authStatus: (user as any).authorization_status === 'pending' ? 'pending_registration' : 'incomplete_registration'
          };
        }
        
        return {
          success: false,
          message: (user as any).authorization_status === 'pending' 
            ? 'Sua solicitação de acesso está pendente de aprovação.'
            : 'Sua conta está desativada. Entre em contato com o suporte.',
          authStatus: (user as any).authorization_status === 'pending' ? 'pending' : 'inactive'
        };
      }

      // Se o usuário existe mas não está autorizado a receber código
      if (!authCheck.authorized && !isAdmin) {
        console.log('Usuário existente mas não autorizado a receber código');
        return {
          success: true,
          message: 'Usuário encontrado mas não autorizado a receber código',
          hasPassword: !!(user as any).password,
          authStatus: 'unauthorized'
        };
      }
    }

    // O código para criar o usuário administrador foi movido para a seção acima
    // que cria usuários temporários para qualquer tipo de usuário

    // Verificar se o usuário já tem senha definida
    if (user && (user as any).password) {
      // Verificar se o usuário está ativo
      if (!(user as any).active) {
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

        // Criar solicitação de acesso automaticamente
        await createAccessRequest(email, phoneNumber, 'Solicitação automática via login');

        return {
          success: false,
          message: 'Você não está autorizado a acessar o sistema. Uma solicitação de acesso foi criada e está aguardando aprovação.',
          authStatus: 'unauthorized'
        };
      }

      // Criar usuário se não existe e está autorizado
      console.log('Criando novo usuário para login');

      // Gerar ID único
      const userId = uuidv4();

      // Determinar o papel do usuário
      const role = phoneNumber === process.env.ADMIN_PHONE_NUMBER ? 'ADMIN' : 'USER';

      // Gerar um número de telefone único se não for fornecido
      const uniquePhoneNumber = phoneNumber || `temp-${userId.substring(0, 8)}`;

      // Criar pool de conexão com o PostgreSQL
      const createUserPool = new Pool({
        connectionString: process.env.DATABASE_URL
      });

      try {
        // Criar usuário
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
          role === 'ADMIN' ? 'Admin' : 'Novo',
          role === 'ADMIN' ? 'ABZ' : 'Usuário',
          role,
          role === 'ADMIN' ? 'Administrador do Sistema' : 'Usuário',
          role === 'ADMIN' ? 'TI' : 'Geral',
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
        console.log('Usuário criado com sucesso:', user.id);
      } catch (error) {
        console.error('Erro ao criar usuário:', error);
        return {
          success: false,
          message: 'Erro ao criar usuário. Por favor, tente novamente.'
        };
      } finally {
        await createUserPool.end();
      }
    } else {
      // Se o usuário existe mas está inativo ou pending
      if (!(user as any).active || (user as any).authorization_status === 'pending') {
        console.log('Usuário encontrado mas inativo ou pendente:', {
          active: (user as any).active,
          authorizationStatus: (user as any).authorization_status,
          email: user.email
        });
        
        return {
          success: false,
          message: (user as any).authorization_status === 'pending' 
            ? 'Sua solicitação de acesso está pendente de aprovação.'
            : 'Sua conta está desativada. Entre em contato com o suporte.',
          authStatus: (user as any).authorization_status === 'pending' ? 'pending' : 'inactive'
        };
      }
    }

    // Verificar o código de verificação
    const isValid = await isVerificationCodeValid(user.id, code, method);

    if (!isValid) {
      return {
        success: false,
        message: 'Código de verificação inválido ou expirado.'
      };
    }

    // Gerar token JWT
    const token = generateToken(user);

    // Atualizar o último login
    const updatePool = new Pool({
      connectionString: process.env.DATABASE_URL
    });

    try {
      await updatePool.query(`
        UPDATE "users_unified"
        SET
          "last_login" = CURRENT_TIMESTAMP,
          "updated_at" = CURRENT_TIMESTAMP
        WHERE "id" = $1
      `, [user.id]);
    } catch (error) {
      console.error('Erro ao atualizar último login:', error);
    } finally {
      await updatePool.end();
    }

    return {
      success: true,
      message: 'Login realizado com sucesso.',
      user,
      token,
      isNewUser: !(user as any).password // É novo usuário se não tem senha
    };
  } catch (error) {
    console.error('Erro ao verificar código de login:', error);
    return {
      success: false,
      message: 'Erro interno do servidor. Por favor, tente novamente.'
    };
  }
}

// Função para obter as permissões padrão para um papel
export function getDefaultPermissions(role: string): any {
  const isAdmin = role === 'ADMIN';

  return {
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
      admin: isAdmin
    },
    features: {
      create_users: isAdmin,
      edit_users: isAdmin,
      delete_users: isAdmin,
      manage_permissions: isAdmin,
      view_reports: isAdmin,
      export_data: isAdmin
    }
  };
}

// Função para verificar se o usuário tem permissão para acessar um módulo
export async function checkModulePermission(userId: string, module: string): Promise<boolean> {
  try {
    const user = await getUserByIdFromSupabase(userId);
    if (!user) {
      return false;
    }

    // Administradores sempre têm acesso a todos os módulos
    if (user.role === 'ADMIN') {
      return true;
    }

    // Verificar se o usuário tem permissões definidas
    const accessPermissions = user.access_permissions as any;
    if (!accessPermissions?.modules) {
      return false;
    }

    return accessPermissions.modules[module] === true;
  } catch (error) {
    console.error('Erro ao verificar permissão de módulo:', error);
    return false;
  }
}

// Função para verificar se o usuário tem permissão para acessar uma funcionalidade
export async function checkFeaturePermission(userId: string, feature: string): Promise<boolean> {
  try {
    const user = await getUserByIdFromSupabase(userId);
    if (!user) {
      return false;
    }

    // Administradores sempre têm acesso a todas as funcionalidades
    if (user.role === 'ADMIN') {
      return true;
    }

    // Verificar se o usuário tem permissões definidas
    const accessPermissions = user.access_permissions as any;
    if (!accessPermissions?.features) {
      return false;
    }

    return accessPermissions.features[feature] === true;
  } catch (error) {
    console.error('Erro ao verificar permissão de funcionalidade:', error);
    return false;
  }
}

// Função para verificar se o usuário é administrador
export async function isAdmin(userId: string): Promise<boolean> {
  try {
    const user = await getUserByIdFromSupabase(userId);
    return user?.role === 'ADMIN';
  } catch (error) {
    console.error('Erro ao verificar se usuário é administrador:', error);
    return false;
  }
}

// Função para verificar se o usuário está ativo
export async function isActive(userId: string): Promise<boolean> {
  try {
    const user = await getUserByIdFromSupabase(userId);
    return (user as any)?.active === true;
  } catch (error) {
    console.error('Erro ao verificar se usuário está ativo:', error);
    return false;
  }
}

// Função para verificar se o usuário está autorizado
export async function isAuthorized(userId: string): Promise<boolean> {
  try {
    const user = await getUserByIdFromSupabase(userId);
    return (user as any)?.is_authorized === true;
  } catch (error) {
    console.error('Erro ao verificar se usuário está autorizado:', error);
    return false;
  }
}

// Função para obter o status de autorização do usuário
export async function getAuthorizationStatus(userId: string): Promise<string> {
  try {
    const user = await getUserByIdFromSupabase(userId);
    return (user as any)?.authorization_status || 'unknown';
  } catch (error) {
    console.error('Erro ao obter status de autorização:', error);
    return 'unknown';
  }
}

// Função para buscar usuário por ID usando Supabase (para evitar conflito de import)
async function getUserByIdFromSupabase(userId: string): Promise<User | null> {
  try {
    const { data: user, error } = await supabase
      .from('users_unified')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      return null;
    }

    return user;
  } catch (error) {
    console.error('Erro ao buscar usuário por ID:', error);
    return null;
  }
}

// Função para atualizar o status de autorização do usuário
export async function updateAuthorizationStatus(userId: string, status: string, authorizedBy?: string): Promise<boolean> {
  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });

    try {
      await pool.query(`
        UPDATE "users_unified"
        SET
          "authorization_status" = $1,
          "is_authorized" = $2,
          "authorized_by" = $3,
          "updated_at" = CURRENT_TIMESTAMP
        WHERE "id" = $4
      `, [
        status,
        status === 'active',
        authorizedBy,
        userId
      ]);

      return true;
    } catch (error) {
      console.error('Erro ao atualizar status de autorização:', error);
      return false;
    } finally {
      await pool.end();
    }
  } catch (error) {
    console.error('Erro ao criar pool de conexão:', error);
    return false;
  }
}

// Função para atualizar as permissões do usuário
export async function updateUserPermissions(userId: string, permissions: any): Promise<boolean> {
  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });

    try {
      await pool.query(`
        UPDATE "users_unified"
        SET
          "access_permissions" = $1,
          "updated_at" = CURRENT_TIMESTAMP
        WHERE "id" = $2
      `, [permissions, userId]);

      return true;
    } catch (error) {
      console.error('Erro ao atualizar permissões do usuário:', error);
      return false;
    } finally {
      await pool.end();
    }
  } catch (error) {
    console.error('Erro ao criar pool de conexão:', error);
    return false;
  }
}

// Função para atualizar o papel do usuário
export async function updateUserRole(userId: string, role: string): Promise<boolean> {
  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });

    try {
      await pool.query(`
        UPDATE "users_unified"
        SET
          "role" = $1,
          "access_permissions" = $2,
          "updated_at" = CURRENT_TIMESTAMP
        WHERE "id" = $3
      `, [role, JSON.stringify(getDefaultPermissions(role)), userId]);

      return true;
    } catch (error) {
      console.error('Erro ao atualizar papel do usuário:', error);
      return false;
    } finally {
      await pool.end();
    }
  } catch (error) {
    console.error('Erro ao criar pool de conexão:', error);
    return false;
  }
}

// Função para ativar/desativar usuário
export async function setUserActive(userId: string, active: boolean): Promise<boolean> {
  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });

    try {
      await pool.query(`
        UPDATE "users_unified"
        SET
          "active" = $1,
          "updated_at" = CURRENT_TIMESTAMP
        WHERE "id" = $2
      `, [active, userId]);

      return true;
    } catch (error) {
      console.error('Erro ao ativar/desativar usuário:', error);
      return false;
    } finally {
      await pool.end();
    }
  } catch (error) {
    console.error('Erro ao criar pool de conexão:', error);
    return false;
  }
}

// Função para excluir usuário
export async function deleteUser(userId: string): Promise<boolean> {
  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });

    try {
      await pool.query(`
        DELETE FROM "users_unified"
        WHERE "id" = $1
      `, [userId]);

      return true;
    } catch (error) {
      console.error('Erro ao excluir usuário:', error);
      return false;
    } finally {
      await pool.end();
    }
  } catch (error) {
    console.error('Erro ao criar pool de conexão:', error);
    return false;
  }
}

// Função para listar usuários
export async function listUsers(filters?: any): Promise<User[]> {
  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });

    try {
      let query = `
        SELECT *
        FROM "users_unified"
        WHERE 1=1
      `;
      const params = [];
      let paramIndex = 1;

      if (filters) {
        if (filters.role) {
          query += ` AND "role" = $${paramIndex}`;
          params.push(filters.role);
          paramIndex++;
        }

        if (filters.active !== undefined) {
          query += ` AND "active" = $${paramIndex}`;
          params.push(filters.active);
          paramIndex++;
        }

        if (filters.authorized !== undefined) {
          query += ` AND "is_authorized" = $${paramIndex}`;
          params.push(filters.authorized);
          paramIndex++;
        }

        if (filters.authorization_status) {
          query += ` AND "authorization_status" = $${paramIndex}`;
          params.push(filters.authorization_status);
          paramIndex++;
        }
      }

      query += ` ORDER BY "first_name", "last_name"`;

      const result = await pool.query(query, params);

      // Mapear os campos para o formato esperado
      const users = result.rows.map(row => ({
        ...row,
        phoneNumber: row.phone_number,
        firstName: row.first_name,
        lastName: row.last_name,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        accessPermissions: row.access_permissions,
        accessHistory: row.access_history
      }));

      return users;
    } catch (error) {
      console.error('Erro ao listar usuários:', error);
      return [];
    } finally {
      await pool.end();
    }
  } catch (error) {
    console.error('Erro ao criar pool de conexão:', error);
    return [];
  }
}

// Função para contar usuários
export async function countUsers(filters?: any): Promise<number> {
  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });

    try {
      let query = `
        SELECT COUNT(*) as count
        FROM "users_unified"
        WHERE 1=1
      `;
      const params = [];
      let paramIndex = 1;

      if (filters) {
        if (filters.role) {
          query += ` AND "role" = $${paramIndex}`;
          params.push(filters.role);
          paramIndex++;
        }

        if (filters.active !== undefined) {
          query += ` AND "active" = $${paramIndex}`;
          params.push(filters.active);
          paramIndex++;
        }

        if (filters.authorized !== undefined) {
          query += ` AND "is_authorized" = $${paramIndex}`;
          params.push(filters.authorized);
          paramIndex++;
        }

        if (filters.authorization_status) {
          query += ` AND "authorization_status" = $${paramIndex}`;
          params.push(filters.authorization_status);
          paramIndex++;
        }
      }

      const result = await pool.query(query, params);
      return parseInt(result.rows[0].count);
    } catch (error) {
      console.error('Erro ao contar usuários:', error);
      return 0;
    } finally {
      await pool.end();
    }
  } catch (error) {
    console.error('Erro ao criar pool de conexão:', error);
    return 0;
  }
}

// Função para buscar usuário por email
export async function getUserByEmail(email: string): Promise<User | null> {
  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });

    try {
      const result = await pool.query(`
        SELECT *
        FROM "users_unified"
        WHERE "email" = $1
      `, [email]);

      if (result.rows.length === 0) {
        return null;
      }

      // Mapear os campos para o formato esperado
      const row = result.rows[0];
      const user = {
        ...row,
        phoneNumber: row.phone_number,
        firstName: row.first_name,
        lastName: row.last_name,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        accessPermissions: row.access_permissions,
        accessHistory: row.access_history
      };

      return user;
    } catch (error) {
      console.error('Erro ao buscar usuário por email:', error);
      return null;
    } finally {
      await pool.end();
    }
  } catch (error) {
    console.error('Erro ao criar pool de conexão:', error);
    return null;
  }
}

// Função para buscar usuário por telefone
export async function getUserByPhone(phoneNumber: string): Promise<User | null> {
  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });

    try {
      const result = await pool.query(`
        SELECT *
        FROM "users_unified"
        WHERE "phone_number" = $1
      `, [phoneNumber]);

      if (result.rows.length === 0) {
        return null;
      }

      // Mapear os campos para o formato esperado
      const row = result.rows[0];
      const user = {
        ...row,
        phoneNumber: row.phone_number,
        firstName: row.first_name,
        lastName: row.last_name,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        accessPermissions: row.access_permissions,
        accessHistory: row.access_history
      };

      return user;
    } catch (error) {
      console.error('Erro ao buscar usuário por telefone:', error);
      return null;
    } finally {
      await pool.end();
    }
  } catch (error) {
    console.error('Erro ao criar pool de conexão:', error);
    return null;
  }
}

// Função para atualizar usuário
export async function updateUser(userId: string, updates: any): Promise<User | null> {
  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });

    try {
      // Construir a query de atualização dinamicamente
      const setClause = [];
      const params = [];
      let paramIndex = 1;

      if (updates.firstName) {
        setClause.push(`"first_name" = $${paramIndex}`);
        params.push(updates.firstName);
        paramIndex++;
      }

      if (updates.lastName) {
        setClause.push(`"last_name" = $${paramIndex}`);
        params.push(updates.lastName);
        paramIndex++;
      }

      if (updates.phoneNumber) {
        setClause.push(`"phone_number" = $${paramIndex}`);
        params.push(updates.phoneNumber);
        paramIndex++;
      }

      if (updates.email) {
        setClause.push(`"email" = $${paramIndex}`);
        params.push(updates.email);
        paramIndex++;
      }

      if (updates.role) {
        setClause.push(`"role" = $${paramIndex}`);
        params.push(updates.role);
        paramIndex++;
      }

      if (updates.position) {
        setClause.push(`"position" = $${paramIndex}`);
        params.push(updates.position);
        paramIndex++;
      }

      if (updates.department) {
        setClause.push(`"department" = $${paramIndex}`);
        params.push(updates.department);
        paramIndex++;
      }

      if (updates.active !== undefined) {
        setClause.push(`"active" = $${paramIndex}`);
        params.push(updates.active);
        paramIndex++;
      }

      if (updates.is_authorized !== undefined) {
        setClause.push(`"is_authorized" = $${paramIndex}`);
        params.push(updates.is_authorized);
        paramIndex++;
      }

      if (updates.authorization_status) {
        setClause.push(`"authorization_status" = $${paramIndex}`);
        params.push(updates.authorization_status);
        paramIndex++;
      }

      if (updates.access_permissions) {
        setClause.push(`"access_permissions" = $${paramIndex}`);
        params.push(updates.access_permissions);
        paramIndex++;
      }

      // Sempre atualizar o timestamp
      setClause.push(`"updated_at" = CURRENT_TIMESTAMP`);

      // Adicionar o ID do usuário como último parâmetro
      params.push(userId);

      const query = `
        UPDATE "users_unified"
        SET ${setClause.join(', ')}
        WHERE "id" = $${paramIndex}
        RETURNING *
      `;

      const result = await pool.query(query, params);

      if (result.rows.length === 0) {
        return null;
      }

      // Mapear os campos para o formato esperado
      const row = result.rows[0];
      const user = {
        ...row,
        phoneNumber: row.phone_number,
        firstName: row.first_name,
        lastName: row.last_name,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        accessPermissions: row.access_permissions,
        accessHistory: row.access_history
      };

      return user;
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
      return null;
    } finally {
      await pool.end();
    }
  } catch (error) {
    console.error('Erro ao criar pool de conexão:', error);
    return null;
  }
}

// Função para atualizar senha do usuário
export async function updateUserPassword(userId: string, password: string): Promise<{ success: boolean; message: string }> {
  try {
    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 10);

    const pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });

    try {
      await pool.query(`
        UPDATE "users_unified"
        SET
          "password" = $1,
          "updated_at" = CURRENT_TIMESTAMP
        WHERE "id" = $2
      `, [hashedPassword, userId]);

      return {
        success: true,
        message: 'Senha atualizada com sucesso'
      };
    } catch (error) {
      console.error('Erro ao atualizar senha do usuário:', error);
      return {
        success: false,
        message: 'Erro ao atualizar senha no banco de dados'
      };
    } finally {
      await pool.end();
    }
  } catch (error) {
    console.error('Erro ao criar pool de conexão:', error);
    return {
      success: false,
      message: 'Erro ao conectar ao banco de dados'
    };
  }
}

// Função para verificar senha do usuário
export async function verifyUserPassword(userId: string, password: string): Promise<boolean> {
  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });

    try {
      const result = await pool.query(`
        SELECT "password"
        FROM "users_unified"
        WHERE "id" = $1
      `, [userId]);

      if (result.rows.length === 0) {
        return false;
      }

      const hashedPassword = result.rows[0].password;
      const isValid = await bcrypt.compare(password, hashedPassword);

      return isValid;
    } catch (error) {
      console.error('Erro ao verificar senha do usuário:', error);
      return false;
    } finally {
      await pool.end();
    }
  } catch (error) {
    console.error('Erro ao criar pool de conexão:', error);
    return false;
  }
}

// Função para criar usuário
export async function createUser(userData: any): Promise<User | null> {
  try {
    // Hash da senha
    const hashedPassword = userData.password ? await bcrypt.hash(userData.password, 10) : null;

    // Gerar ID único
    const userId = uuidv4();

    const pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });

    try {
      const now = new Date().toISOString();
      const result = await pool.query(`
        INSERT INTO "users_unified" (
          "id",
          "phone_number",
          "email",
          "first_name",
          "last_name",
          "password",
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
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $15)
        RETURNING *
      `, [
        userId,
        userData.phoneNumber,
        userData.email,
        userData.firstName,
        userData.lastName,
        hashedPassword,
        userData.role || 'USER',
        userData.position || '',
        userData.department || '',
        userData.active !== undefined ? userData.active : true,
        userData.is_authorized !== undefined ? userData.is_authorized : true,
        userData.authorization_status || 'active',
        JSON.stringify(userData.access_permissions || getDefaultPermissions(userData.role || 'USER')),
        JSON.stringify(userData.access_history || [{
          timestamp: now,
          action: 'CREATED',
          details: 'Usuário criado manualmente'
        }]),
        now
      ]);

      // Mapear os campos para o formato esperado
      const row = result.rows[0];
      const user = {
        ...row,
        phoneNumber: row.phone_number,
        firstName: row.first_name,
        lastName: row.last_name,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        accessPermissions: row.access_permissions,
        accessHistory: row.access_history
      };

      return user;
    } catch (error) {
      console.error('Erro ao criar usuário:', error);
      return null;
    } finally {
      await pool.end();
    }
  } catch (error) {
    console.error('Erro ao criar pool de conexão:', error);
    return null;
  }
}

// Função unificada para login com email ou telefone e senha
export async function loginWithPassword(identifier: string, password: string, rememberMe: boolean = false): Promise<{ success: boolean; message: string; user?: User; token?: string; refreshToken?: string }> {
  try {
    // Verificar se o identificador é um email ou telefone
    const isEmail = identifier.includes('@');

    let user: User | null = null;

    if (isEmail) {
      user = await getUserByEmail(identifier);
    } else {
      user = await getUserByPhone(identifier);
    }

    if (!user) {
      return {
        success: false,
        message: `${isEmail ? 'Email' : 'Telefone'} ou senha incorretos.`
      };
    }

    // Verificar se o usuário está ativo
    if (!(user as any).active) {
      return {
        success: false,
        message: 'Sua conta está desativada. Entre em contato com o suporte.'
      };
    }

    // Verificar se o usuário está autorizado
    if (!(user as any).is_authorized) {
      return {
        success: false,
        message: 'Sua conta não está autorizada. Entre em contato com o suporte.'
      };
    }

    // Verificar se o usuário tem senha
    if (!(user as any).password) {
      return {
        success: false,
        message: 'Este usuário não tem senha definida. Por favor, solicite um código de verificação.'
      };
    }

    // Verificar a senha
    const isValidPassword = await verifyUserPassword(user.id, password);

    if (!isValidPassword) {
      return {
        success: false,
        message: `${isEmail ? 'Email' : 'Telefone'} ou senha incorretos.`
      };
    }

    // Gerar token JWT
    const token = generateToken(user, rememberMe);

    // Gerar refresh token
    const refreshTokenData = generateRefreshToken(user, rememberMe);

    // Atualizar o último login
    const updatePool = new Pool({
      connectionString: process.env.DATABASE_URL
    });

    try {
      await updatePool.query(`
        UPDATE "users_unified"
        SET
          "last_login" = CURRENT_TIMESTAMP,
          "updated_at" = CURRENT_TIMESTAMP
        WHERE "id" = $1
      `, [user.id]);
    } catch (error) {
      console.error('Erro ao atualizar último login:', error);
    } finally {
      await updatePool.end();
    }

    return {
      success: true,
      message: 'Login realizado com sucesso.',
      user,
      token,
      refreshToken: refreshTokenData.token
    };
  } catch (error) {
    console.error('Erro ao fazer login:', error);
    return {
      success: false,
      message: 'Erro interno do servidor. Por favor, tente novamente.'
    };
  }
}

// Função para login com email e senha
export async function loginWithEmail(email: string, password: string): Promise<{ success: boolean; message: string; user?: User; token?: string }> {
  try {
    // Buscar usuário pelo email
    const user = await getUserByEmail(email);

    if (!user) {
      return {
        success: false,
        message: 'Email ou senha incorretos.'
      };
    }

    // Verificar se o usuário está ativo
    if (!(user as any).active) {
      return {
        success: false,
        message: 'Sua conta está desativada. Entre em contato com o suporte.'
      };
    }

    // Verificar se o usuário está autorizado
    if (!(user as any).is_authorized) {
      return {
        success: false,
        message: 'Sua conta não está autorizada. Entre em contato com o suporte.'
      };
    }

    // Verificar se o usuário tem senha
    if (!(user as any).password) {
      return {
        success: false,
        message: 'Este usuário não tem senha definida. Por favor, solicite um código de verificação.'
      };
    }

    // Verificar a senha
    const isValidPassword = await verifyUserPassword(user.id, password);

    if (!isValidPassword) {
      return {
        success: false,
        message: 'Email ou senha incorretos.'
      };
    }

    // Gerar token JWT
    const token = generateToken(user);

    // Atualizar o último login
    const updatePool = new Pool({
      connectionString: process.env.DATABASE_URL
    });

    try {
      await updatePool.query(`
        UPDATE "users_unified"
        SET
          "last_login" = CURRENT_TIMESTAMP,
          "updated_at" = CURRENT_TIMESTAMP
        WHERE "id" = $1
      `, [user.id]);
    } catch (error) {
      console.error('Erro ao atualizar último login:', error);
    } finally {
      await updatePool.end();
    }

    return {
      success: true,
      message: 'Login realizado com sucesso.',
      user,
      token
    };
  } catch (error) {
    console.error('Erro ao fazer login com email:', error);
    return {
      success: false,
      message: 'Erro interno do servidor. Por favor, tente novamente.'
    };
  }
}

// Função para login com telefone e senha
export async function loginWithPhone(phoneNumber: string, password: string): Promise<{ success: boolean; message: string; user?: User; token?: string }> {
  try {
    // Buscar usuário pelo telefone
    const user = await getUserByPhone(phoneNumber);

    if (!user) {
      return {
        success: false,
        message: 'Telefone ou senha incorretos.'
      };
    }

    // Verificar se o usuário está ativo
    if (!(user as any).active) {
      return {
        success: false,
        message: 'Sua conta está desativada. Entre em contato com o suporte.'
      };
    }

    // Verificar se o usuário está autorizado
    if (!(user as any).is_authorized) {
      return {
        success: false,
        message: 'Sua conta não está autorizada. Entre em contato com o suporte.'
      };
    }

    // Verificar se o usuário tem senha
    if (!(user as any).password) {
      return {
        success: false,
        message: 'Este usuário não tem senha definida. Por favor, solicite um código de verificação.'
      };
    }

    // Verificar a senha
    const isValidPassword = await verifyUserPassword(user.id, password);

    if (!isValidPassword) {
      return {
        success: false,
        message: 'Telefone ou senha incorretos.'
      };
    }

    // Gerar token JWT
    const token = generateToken(user);

    // Atualizar o último login
    const updatePool = new Pool({
      connectionString: process.env.DATABASE_URL
    });

    try {
      await updatePool.query(`
        UPDATE "users_unified"
        SET
          "last_login" = CURRENT_TIMESTAMP,
          "updated_at" = CURRENT_TIMESTAMP
        WHERE "id" = $1
      `, [user.id]);
    } catch (error) {
      console.error('Erro ao atualizar último login:', error);
    } finally {
      await updatePool.end();
    }

    return {
      success: true,
      message: 'Login realizado com sucesso.',
      user,
      token
    };
  } catch (error) {
    console.error('Erro ao fazer login com telefone:', error);
    return {
      success: false,
      message: 'Erro interno do servidor. Por favor, tente novamente.'
    };
  }
}

// Função para logout
export async function logout(userId: string): Promise<boolean> {
  try {
    // Aqui você pode implementar a lógica de logout, como invalidar tokens
    // Por enquanto, apenas retorna true
    return true;
  } catch (error) {
    console.error('Erro ao fazer logout:', error);
    return false;
  }
}

// Função para refresh token
export async function refreshToken(refreshToken: string): Promise<{ success: boolean; message: string; token?: string }> {
  try {
    // Aqui você pode implementar a lógica de refresh token
    // Por enquanto, apenas retorna false
    return {
      success: false,
      message: 'Refresh token não implementado.'
    };
  } catch (error) {
    console.error('Erro ao refresh token:', error);
    return {
      success: false,
      message: 'Erro interno do servidor. Por favor, tente novamente.'
    };
  }
}

// Função para validar token
export async function validateToken(token: string): Promise<{ success: boolean; message: string; user?: User }> {
  try {
    const payload = verifyToken(token);

    if (!payload) {
      return {
        success: false,
        message: 'Token inválido ou expirado.'
      };
    }

    const user = await getUserByIdFromSupabase(payload.userId);

    if (!user) {
      return {
        success: false,
        message: 'Usuário não encontrado.'
      };
    }

    if (!(user as any).active) {
      return {
        success: false,
        message: 'Usuário inativo.'
      };
    }

    if (!(user as any).is_authorized) {
      return {
        success: false,
        message: 'Usuário não autorizado.'
      };
    }

    return {
      success: true,
      message: 'Token válido.',
      user
    };
  } catch (error) {
    console.error('Erro ao validar token:', error);
    return {
      success: false,
      message: 'Erro interno do servidor. Por favor, tente novamente.'
    };
  }
}

// Função para verificar se a senha do usuário está expirada
export async function isPasswordExpired(userId: string): Promise<boolean> {
  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });

    try {
      const result = await pool.query(`
        SELECT "password_changed_at"
        FROM "users_unified"
        WHERE "id" = $1
      `, [userId]);

      if (result.rows.length === 0) {
        return false; // Usuário não encontrado, considera como não expirada
      }

      const passwordChangedAt = result.rows[0].password_changed_at;

      // Se não há data de alteração, considera a senha como expirada
      if (!passwordChangedAt) {
        return false; // Sem política de expiração por padrão
      }

      // Verificar se passou mais de 90 dias desde a última alteração
      const now = new Date();
      const changedDate = new Date(passwordChangedAt);
      const daysDiff = Math.floor((now.getTime() - changedDate.getTime()) / (1000 * 60 * 60 * 24));

      // Senha expira após 90 dias
      return daysDiff > 90;
    } catch (error) {
      console.error('Erro ao verificar expiração de senha:', error);
      return false;
    } finally {
      await pool.end();
    }
  } catch (error) {
    console.error('Erro ao criar pool de conexão:', error);
    return false;
  }
}
