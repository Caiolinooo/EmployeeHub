import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// Force this route to be dynamic
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

console.log('API de usuários Supabase inicializada - Versão corrigida');

// GET - Obter todos os usuários
export async function GET(request: NextRequest) {
  try {
    // Runtime check to ensure this only runs during actual HTTP requests
    if (typeof window !== 'undefined') {
      return NextResponse.json(
        { error: 'Esta rota só pode ser executada no servidor' },
        { status: 500 }
      );
    }

    // Check if we're in a static generation context
    if (!request || !request.headers) {
      return NextResponse.json(
        { error: 'Rota não disponível durante geração estática' },
        { status: 503 }
      );
    }

    // Verificar autenticação
    const authHeader = request.headers.get('authorization') || '';
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      console.log('Token não fornecido');
      return NextResponse.json(
        { error: 'Não autorizado. Token não fornecido.' },
        { status: 401 }
      );
    }

    // Verificar se o token é válido
    let payload;
    try {
      payload = verifyToken(token);
      if (!payload) {
        console.log('Token inválido ou expirado');
        return NextResponse.json(
          { error: 'Token inválido ou expirado' },
          { status: 401 }
        );
      }
      console.log('Token válido para usuário:', payload.userId);
    } catch (tokenError) {
      console.error('Erro ao verificar token:', tokenError);
      return NextResponse.json(
        { error: 'Erro ao verificar token de autenticação' },
        { status: 401 }
      );
    }

    // Definir o administrador principal
    const adminEmail = process.env.ADMIN_EMAIL || 'caio.correia@groupabz.com';
    const adminPhone = process.env.ADMIN_PHONE_NUMBER || '+5522997847289';

    // Verificar se o usuário existe no Supabase
    console.log('Buscando usuário no Supabase com ID:', payload.userId);
    const { data: requestingUser, error: userError } = await supabaseAdmin
      .from('users_unified')
      .select('id, role, email, phone_number, first_name, last_name, access_permissions')
      .eq('id', payload.userId)
      .single();

    if (userError) {
      console.error('Erro ao buscar usuário:', userError.message);
    }

    // Se o usuário não for encontrado ou não for admin, verificar se é o admin principal
    let isAdmin = false;

    if (requestingUser) {
      console.log('Usuário encontrado:', requestingUser.email, 'Papel:', requestingUser.role);
      isAdmin = requestingUser.role === 'ADMIN' ||
                requestingUser.email === adminEmail ||
                requestingUser.phone_number === adminPhone;
    } else {
      console.log('Usuário não encontrado no banco de dados. Verificando se é o admin principal...');
      console.log('Admin email:', adminEmail);
      console.log('Admin phone:', adminPhone);

      // Verificar se o usuário é o admin principal pelo payload
      console.log('Payload:', JSON.stringify(payload));

      // Forçar acesso para o administrador principal
      if (payload.userId === 'c9b1e9a2-3c80-4b3d-9f75-fc7a00d7cdbb') {
        console.log('Usuário identificado como admin principal pelo ID');
        isAdmin = true;

        // Criar o usuário admin se não existir
        try {
          console.log('Tentando criar usuário admin...');
          const now = new Date().toISOString();
          const { data: newAdmin, error: createError } = await supabaseAdmin
            .from('users_unified')
            .insert({
              id: payload.userId,
              email: adminEmail,
              phone_number: adminPhone,
              first_name: 'Caio',
              last_name: 'Correia',
              role: 'ADMIN',
              position: 'Administrador do Sistema',
              department: 'TI',
              active: true,
              is_authorized: true,
              authorization_status: 'active',
              access_permissions: {
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
                  admin: true
                }
              },
              access_history: [{
                timestamp: now,
                action: 'CREATED',
                details: 'Usuário admin criado automaticamente'
              }],
              created_at: now,
              updated_at: now
            })
            .select();

          if (createError) {
            console.error('Erro ao criar usuário admin:', createError.message);
          } else {
            console.log('Usuário admin criado com sucesso');
          }
        } catch (createError) {
          console.error('Exceção ao criar usuário admin:', createError);
        }

        // Renovar o token com o papel correto
        try {
          const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/token-refresh`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          if (response.ok) {
            console.log('Token renovado com sucesso');
          } else {
            console.log('Falha ao renovar token, mas continuando com a verificação');
          }
        } catch (refreshError) {
          console.error('Erro ao tentar renovar token:', refreshError);
        }
      }
    }

    // Verificação adicional para o email do administrador
    if (!isAdmin && payload.userId) {
      console.log('Verificação adicional para o administrador principal');
      try {
        const { data: adminCheck } = await supabaseAdmin
          .from('users_unified')
          .select('*')
          .eq('email', adminEmail)
          .single();

        if (adminCheck && adminCheck.id === payload.userId) {
          console.log('Usuário é o administrador principal pelo ID');
          isAdmin = true;
        }
      } catch (adminCheckError) {
        console.error('Erro na verificação adicional do administrador:', adminCheckError);
      }
    }

    // Verificar se o usuário tem permissão
    if (!isAdmin) {
      console.log('Acesso negado. Usuário não é administrador.');
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores podem listar usuários.' },
        { status: 403 }
      );
    }

    console.log('Usuário autenticado e autorizado. Buscando lista de usuários...');

    // Buscar todos os usuários
    try {
      // Adicionar timestamp para evitar cache
      const timestamp = new Date().getTime();
      console.log('Buscando usuários com timestamp:', timestamp);

      // Adicionar logs para depuração
      console.log('Executando consulta com supabaseAdmin:', supabaseAdmin ? 'Cliente inicializado' : 'Cliente não inicializado');

      // Verificar se o cliente supabaseAdmin está inicializado corretamente
      if (!supabaseAdmin) {
        console.error('Cliente supabaseAdmin não está inicializado');
        return NextResponse.json(
          { error: 'Erro interno: cliente Supabase não inicializado' },
          { status: 500 }
        );
      }

      // Executar a consulta com tratamento de erro mais detalhado
      console.log('Executando consulta para buscar usuários na tabela users_unified...');

      // Verificar se a tabela existe
      const { data: tableInfo, error: tableError } = await supabaseAdmin
        .from('users_unified')
        .select('id')
        .limit(1);

      if (tableError) {
        console.error('Erro ao verificar tabela users_unified:', tableError.message);
        console.log('Detalhes do erro:', tableError);

        // Tentar buscar informações sobre as tabelas disponíveis
        try {
          const { data: tables } = await supabaseAdmin
            .rpc('get_tables')
            .select('*');
          console.log('Tabelas disponíveis:', tables);
        } catch (tablesError) {
          console.error('Não foi possível listar tabelas:', tablesError);
        }

        return NextResponse.json(
          { error: 'Erro ao acessar tabela de usuários', details: tableError.message },
          { status: 500 }
        );
      }

      console.log('Tabela users_unified verificada com sucesso');

      // Executar a consulta principal
      const { data, error } = await supabaseAdmin
        .from('users_unified')
        .select('id, first_name, last_name, email, phone_number, role, position, department, active, created_at, updated_at, access_permissions')
        .order('created_at', { ascending: false });

      // Log do resultado da consulta
      console.log('Resultado da consulta:', error ? `Erro: ${error.message}` : `Sucesso: ${data?.length || 0} registros`);

      if (data && data.length > 0) {
        console.log('Amostra do primeiro usuário:', JSON.stringify(data[0], null, 2));
      }

      // Se houver erro, retornar erro
      if (error) {
        console.error('Erro ao buscar usuários:', error);
        return NextResponse.json(
          { error: 'Erro ao buscar usuários', details: error.message },
          { status: 500 }
        );
      }

      // Verificar se a consulta retornou dados
      if (!data) {
        console.error('Consulta não retornou dados (data é null ou undefined)');
        return NextResponse.json(
          { error: 'Erro ao buscar usuários: dados não retornados' },
          { status: 500 }
        );
      }

      console.log('Consulta executada com sucesso, retornou', data.length, 'usuários');

      // Se não houver usuários, retornar array vazio
      if (data.length === 0) {
        console.log('Nenhum usuário encontrado, retornando array vazio');
        return NextResponse.json([]);
      }

      // Mapear para o formato esperado pelo frontend
      console.log('Mapeando usuários para o formato esperado pelo frontend...');

      // Não precisamos mais buscar permissões separadamente, pois agora elas estão na tabela unificada
      console.log(`Processando permissões para ${data.length} usuários...`);

      const formattedUsers = data.map((user: any) => {
        // Obter permissões do usuário ou criar um objeto padrão
        const accessPermissions = user.access_permissions || {
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
            admin: user.role === 'ADMIN'
          }
        };

        return {
          _id: user.id || '',
          firstName: user.first_name || 'Usuário',
          lastName: user.last_name || (user.id ? user.id.substring(0, 8) : ''),
          email: user.email || '',
          phoneNumber: user.phone_number || '',
          role: user.role || 'USER',
          position: user.position || '',
          department: user.department || '',
          active: user.active !== undefined ? user.active : true,
          createdAt: user.created_at || new Date().toISOString(),
          updatedAt: user.updated_at || new Date().toISOString(),
          accessPermissions: accessPermissions
        };
      });

      console.log('Usuários mapeados com sucesso, retornando', formattedUsers.length, 'usuários');

      // Log da estrutura de dados retornada
      if (formattedUsers.length > 0) {
        console.log('Estrutura do primeiro usuário formatado:', Object.keys(formattedUsers[0]));
        console.log('Amostra do primeiro usuário formatado:', JSON.stringify(formattedUsers[0], null, 2));
      }

      // Definir cabeçalhos para evitar cache
      const headers = new Headers();
      headers.append('Cache-Control', 'no-cache, no-store, must-revalidate');
      headers.append('Pragma', 'no-cache');
      headers.append('Expires', '0');

      return NextResponse.json(formattedUsers, { headers });
    } catch (queryError) {
      console.error('Exceção ao executar consulta:', queryError);
      return NextResponse.json(
        { error: 'Erro ao executar consulta de usuários', details: queryError instanceof Error ? queryError.message : String(queryError) },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Erro ao obter usuários:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
