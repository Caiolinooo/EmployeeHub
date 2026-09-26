import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromHeader, verifyToken, verifyTokenAllowExpired, generateToken } from '@/lib/auth';
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

console.log('Inicializando cliente Supabase para fix-token');

export async function POST(request: NextRequest) {
  try {
    // Extrair o token do cabeçalho
    const authHeader = request.headers.get('authorization');
    console.log('Cabeçalho de autorização recebido:', authHeader ? 'Presente' : 'Ausente');

    // Tentar obter o token do cabeçalho
    let token = extractTokenFromHeader(authHeader || undefined);
    console.log('Token extraído do cabeçalho:', token ? 'Presente' : 'Ausente');

    // Se não houver token no cabeçalho, tentar obter do corpo da requisição
    if (!token) {
      try {
        const body = await request.json();
        if (body && body.token) {
          token = body.token;
          console.log('Token extraído do corpo da requisição:', 'Presente');
        }
      } catch (parseError) {
        console.log('Erro ao analisar corpo da requisição:', parseError);
      }
    }

    // Se ainda não houver token, tentar obter dos cookies
    if (!token) {
      const tokenCookie = request.cookies.get('abzToken') || request.cookies.get('token');
      if (tokenCookie) {
        token = tokenCookie.value;
        console.log('Token extraído dos cookies:', 'Presente');
      }
    }

    if (!token) {
      return NextResponse.json(
        { error: 'Token não fornecido' },
        { status: 401 }
      );
    }

    // Verificar o token (aceita token expirado com assinatura válida dentro da janela de graça)
    let payload = verifyToken(token);
    let tokenExpiredButValid = false;
    if (!payload) {
      payload = verifyTokenAllowExpired(token);
      if (payload) {
        tokenExpiredButValid = true;
        console.log('Token expirado aceito dentro da janela de graça para correção');
      }
    }
    console.log('Resultado da verificação do token:', payload ? 'Válido' : 'Inválido');

    if (!payload) {
      return NextResponse.json(
        { error: 'Token inválido ou expirado' },
        { status: 401 }
      );
    }

    console.log('Payload do token:', payload);

    // Buscar o usuário no Supabase
    console.log('Buscando usuário com ID:', payload.userId);

    const { data: user, error: userError } = await supabaseAdmin
      .from('users_unified')
      .select('*')
      .eq('id', payload.userId)
      .single();

    console.log('Usuário encontrado:', user ? 'Sim' : 'Não', 'Erro:', userError ? userError.message : 'Nenhum');

    if (userError || !user) {
      console.error('Erro ao buscar usuário:', userError);
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    console.log('Usuário encontrado:', user);

    // Verificar se o usuário é administrador
    const adminEmail = (process.env.ADMIN_EMAIL || '').trim();
    const adminPhone = (process.env.ADMIN_PHONE_NUMBER || '').trim();
    const isAdmin =
      user.role === 'ADMIN' ||
      (!!adminEmail && user.email === adminEmail) ||
      (!!adminPhone && user.phone_number === adminPhone);

    console.log('Verificando se é administrador:', {
      isAdmin,
      userRole: user.role,
      userEmail: user.email,
      adminEmail,
      userPhone: user.phone_number,
      adminPhone
    });

    // Se o usuário for administrador mas o token não tiver essa informação, gerar um novo token
    if (isAdmin && payload.role !== 'ADMIN') {
      console.log('Gerando novo token com papel de administrador');

      // Gerar um novo token
      // const jwt = require('jsonwebtoken'); // Já importado no topo
      const newToken = jwt.sign(
        {
          userId: user.id,
          phoneNumber: user.phone_number,
          role: 'ADMIN'
        },
        (process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? (() => { throw new Error('JWT_SECRET required'); })() : 'dev-only-jwt-secret-not-for-production')),
        { expiresIn: '7d' }
      );

      console.log('Novo token gerado com sucesso');

      // Criar a resposta
      const response = NextResponse.json({
        success: true,
        message: 'Token atualizado com papel de administrador',
        token: newToken,
        user: {
          _id: user.id,
          firstName: user.first_name,
          lastName: user.last_name,
          email: user.email,
          phoneNumber: user.phone_number,
          role: 'ADMIN',
          position: user.position,
          department: user.department,
          active: user.active,
          createdAt: user.created_at,
          updatedAt: user.updated_at
        }
      });

      // Definir o token nos cookies
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 7); // 7 dias

      // Definir o cookie com o token
      response.cookies.set({
        name: 'abzToken',
        value: newToken,
        expires: expiryDate,
        path: '/',
        httpOnly: false, // Permitir acesso via JavaScript
        secure: process.env.NODE_ENV === 'production', // Apenas HTTPS em produção
        sameSite: 'lax'
      });

      // Também definir no cookie legado para compatibilidade
      response.cookies.set({
        name: 'token',
        value: newToken,
        expires: expiryDate,
        path: '/',
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
      });

      return response;
    }

    // Se o token original estava expirado (aceito pela janela de graça), emitir um novo token;
    // caso contrário, retornar o token original que ainda é válido
    const tokenToReturn = tokenExpiredButValid
      ? generateToken({ id: user.id, phone_number: user.phone_number, role: user.role })
      : token;
    console.log(tokenExpiredButValid ? 'Token expirado substituído por um novo' : 'Token válido, retornando sucesso');

    // Criar a resposta
    const response = NextResponse.json({
      success: true,
      message: tokenExpiredButValid ? 'Token renovado' : 'Token válido',
      token: tokenToReturn,
      user: {
        _id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        phoneNumber: user.phone_number,
        role: user.role,
        position: user.position,
        department: user.department,
        active: user.active,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      }
    });

    // Definir o token nos cookies
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 7); // 7 dias

    // Definir o cookie com o token
    response.cookies.set({
      name: 'abzToken',
      value: tokenToReturn,
      expires: expiryDate,
      path: '/',
      httpOnly: false, // Permitir acesso via JavaScript
      secure: process.env.NODE_ENV === 'production', // Apenas HTTPS em produção
      sameSite: 'lax'
    });

    // Também definir no cookie legado para compatibilidade
    response.cookies.set({
      name: 'token',
      value: tokenToReturn,
      expires: expiryDate,
      path: '/',
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });

    return response;
  } catch (error) {
    console.error('Erro ao processar solicitação:', error);

    return NextResponse.json({
      success: false,
      error: 'Erro ao processar solicitação',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
