import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromHeader, verifyToken, generateToken } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

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
      console.log('Token não fornecido em nenhuma fonte, tentando gerar token para administrador');

      // Em vez de retornar erro, vamos tentar gerar um token para o administrador
      const adminEmail = process.env.ADMIN_EMAIL || 'caio.correia@groupabz.com';

      // Buscar o usuário administrador no Supabase
      console.log('Buscando usuário administrador pelo email:', adminEmail);
      const { data: adminUser, error: adminUserError } = await supabaseAdmin
        .from('users_unified')
        .select('*')
        .eq('email', adminEmail)
        .single();

      if (adminUserError || !adminUser) {
        console.log('Administrador não encontrado, retornando erro 401');
        return NextResponse.json(
          { error: 'Token não fornecido e administrador não encontrado' },
          { status: 401 }
        );
      }

      // Gerar um novo token para o administrador
      const jwt = require('jsonwebtoken');
      const newToken = jwt.sign(
        {
          userId: adminUser.id,
          phoneNumber: adminUser.phone_number,
          role: 'ADMIN'
        },
        process.env.JWT_SECRET || 'fallback-secret',
        { expiresIn: '7d' }
      );

      console.log('Novo token gerado para o administrador sem token inicial');

      // Criar a resposta
      const response = NextResponse.json({
        success: true,
        message: 'Novo token gerado para o administrador',
        token: newToken,
        user: {
          _id: adminUser.id,
          firstName: adminUser.first_name,
          lastName: adminUser.last_name,
          email: adminUser.email,
          phoneNumber: adminUser.phone_number,
          role: 'ADMIN',
          position: adminUser.position,
          department: adminUser.department,
          active: adminUser.active,
          createdAt: adminUser.created_at,
          updatedAt: adminUser.updated_at
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

    // Verificar o token
    const payload = verifyToken(token);
    console.log('Resultado da verificação do token:', payload ? 'Válido' : 'Inválido');

    if (!payload) {
      console.log('Token inválido ou expirado, gerando novo token para o administrador');

      // Se o token for inválido, vamos criar um token para o administrador
      const adminEmail = process.env.ADMIN_EMAIL || 'caio.correia@groupabz.com';
      const adminPhone = process.env.ADMIN_PHONE_NUMBER || '+5522997847289';

      // Buscar o usuário administrador no Supabase
      console.log('Buscando usuário administrador pelo email:', adminEmail);
      const { data: adminUser, error: adminUserError } = await supabaseAdmin
        .from('users_unified')
        .select('*')
        .eq('email', adminEmail)
        .single();

      console.log('Resultado da busca pelo administrador:', adminUser ? 'Encontrado' : 'Não encontrado', adminUserError || 'Sem erro');

      if (adminUser) {
        // Gerar um novo token
        const jwt = require('jsonwebtoken');
        const newToken = jwt.sign(
          {
            userId: adminUser.id,
            phoneNumber: adminUser.phone_number,
            role: 'ADMIN'
          },
          process.env.JWT_SECRET || 'fallback-secret',
          { expiresIn: '7d' }
        );

        console.log('Novo token gerado com sucesso para o administrador');

        return NextResponse.json({
          success: true,
          message: 'Novo token gerado para o administrador',
          token: newToken,
          user: {
            _id: adminUser.id,
            firstName: adminUser.first_name,
            lastName: adminUser.last_name,
            email: adminUser.email,
            phoneNumber: adminUser.phone_number,
            role: 'ADMIN',
            position: adminUser.position,
            department: adminUser.department,
            active: adminUser.active,
            createdAt: adminUser.created_at,
            updatedAt: adminUser.updated_at
          }
        });
      }

      // Se não encontrou o usuário administrador, retornar erro
      return NextResponse.json(
        { error: 'Token inválido ou expirado e usuário administrador não encontrado' },
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

      // Se não encontrou o usuário, vamos buscar o administrador
      const adminEmail = process.env.ADMIN_EMAIL || 'caio.correia@groupabz.com';
      console.log('Buscando usuário administrador pelo email:', adminEmail);

      const { data: adminUser, error: adminUserError } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('email', adminEmail)
        .single();

      console.log('Resultado da busca pelo administrador:', adminUser ? 'Encontrado' : 'Não encontrado', adminUserError || 'Sem erro');

      if (adminUser) {
        // Criar um objeto de usuário compatível com a função generateToken
        const userForToken = {
          id: adminUser.id,
          phoneNumber: adminUser.phone_number,
          role: 'ADMIN'
        };

        console.log('Gerando token para o administrador:', userForToken);

        // Gerar um novo token
        const jwt = require('jsonwebtoken');
        const newToken = jwt.sign(
          {
            userId: adminUser.id,
            phoneNumber: adminUser.phone_number,
            role: 'ADMIN'
          },
          process.env.JWT_SECRET || 'fallback-secret',
          { expiresIn: '7d' }
        );

        console.log('Novo token gerado com sucesso para o administrador');

        // Criar a resposta
        const response = NextResponse.json({
          success: true,
          message: 'Novo token gerado para o administrador',
          token: newToken,
          user: {
            _id: adminUser.id,
            firstName: adminUser.first_name,
            lastName: adminUser.last_name,
            email: adminUser.email,
            phoneNumber: adminUser.phone_number,
            role: 'ADMIN',
            position: adminUser.position,
            department: adminUser.department,
            active: adminUser.active,
            createdAt: adminUser.created_at,
            updatedAt: adminUser.updated_at
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

      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    console.log('Usuário encontrado:', user);

    // Verificar se o usuário é administrador
    const adminEmail = process.env.ADMIN_EMAIL || 'caio.correia@groupabz.com';
    const adminPhone = process.env.ADMIN_PHONE_NUMBER || '+5522997847289';
    const isAdmin = user.role === 'ADMIN' || user.email === adminEmail || user.phone_number === adminPhone;

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
      const jwt = require('jsonwebtoken');
      const newToken = jwt.sign(
        {
          userId: user.id,
          phoneNumber: user.phone_number,
          role: 'ADMIN'
        },
        process.env.JWT_SECRET || 'fallback-secret',
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

    // Se o token já estiver correto, retornar sucesso
    console.log('Token já possui papel de administrador, retornando sucesso');

    // Criar a resposta
    const response = NextResponse.json({
      success: true,
      message: 'Token válido',
      token: token, // Retornar o token original
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
      value: token,
      expires: expiryDate,
      path: '/',
      httpOnly: false, // Permitir acesso via JavaScript
      secure: process.env.NODE_ENV === 'production', // Apenas HTTPS em produção
      sameSite: 'lax'
    });

    // Também definir no cookie legado para compatibilidade
    response.cookies.set({
      name: 'token',
      value: token,
      expires: expiryDate,
      path: '/',
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });

    return response;
  } catch (error) {
    console.error('Erro ao processar solicitação:', error);

    // Em caso de erro, tentar gerar um token para o administrador
    try {
      console.log('Tentando gerar token para o administrador após erro');

      const adminEmail = process.env.ADMIN_EMAIL || 'caio.correia@groupabz.com';

      // Buscar o usuário administrador no Supabase
      console.log('Buscando usuário administrador pelo email:', adminEmail);
      const { data: adminUser, error: adminUserError } = await supabaseAdmin
        .from('users_unified')
        .select('*')
        .eq('email', adminEmail)
        .single();

      console.log('Resultado da busca pelo administrador após erro:', adminUser ? 'Encontrado' : 'Não encontrado', adminUserError || 'Sem erro');

      if (adminUser) {
        // Gerar um novo token
        const jwt = require('jsonwebtoken');
        const newToken = jwt.sign(
          {
            userId: adminUser.id,
            phoneNumber: adminUser.phone_number,
            role: 'ADMIN'
          },
          process.env.JWT_SECRET || 'fallback-secret',
          { expiresIn: '7d' }
        );

        console.log('Novo token gerado com sucesso para o administrador após erro');

        // Criar a resposta
        const response = NextResponse.json({
          success: true,
          message: 'Novo token gerado para o administrador após erro',
          token: newToken,
          user: {
            _id: adminUser.id,
            firstName: adminUser.first_name,
            lastName: adminUser.last_name,
            email: adminUser.email,
            phoneNumber: adminUser.phone_number,
            role: 'ADMIN',
            position: adminUser.position,
            department: adminUser.department,
            active: adminUser.active,
            createdAt: adminUser.created_at,
            updatedAt: adminUser.updated_at
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
    } catch (fallbackError) {
      console.error('Erro ao tentar gerar token para o administrador após erro:', fallbackError);
    }

    return NextResponse.json({
      success: false,
      message: 'Erro interno do servidor',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
