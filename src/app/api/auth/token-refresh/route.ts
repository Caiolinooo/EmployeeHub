import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromHeader, verifyToken, generateToken } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

console.log('API token-refresh - Inicializando cliente Supabase');

// POST - Renovar token
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
      console.log('Token não fornecido em nenhuma fonte, retornando erro 401');
      return NextResponse.json(
        { error: 'Token não fornecido' },
        { status: 401 }
      );
    }

    // Verificar o token
    const payload = verifyToken(token);
    console.log('Resultado da verificação do token:', payload ? 'Válido' : 'Inválido');

    if (!payload) {
      console.log('Token inválido ou expirado, retornando erro 401');
      return NextResponse.json(
        { error: 'Token inválido ou expirado' },
        { status: 401 }
      );
    }

    // Buscar o usuário no Supabase
    console.log('Buscando usuário no Supabase com ID:', payload.userId);

    try {
      // Buscar o usuário na tabela users_unified
      const { data: user, error: userError } = await supabaseAdmin
        .from('users_unified')
        .select('*')
        .eq('id', payload.userId)
        .single();

      if (userError) {
        console.error('Erro ao buscar usuário:', userError);

        // Verificar se é o administrador principal
        const adminEmail = process.env.ADMIN_EMAIL || 'caio.correia@groupabz.com';
        const adminPhone = process.env.ADMIN_PHONE_NUMBER || '+5522997847289';

        // Se o payload contiver o email ou telefone do administrador, gerar um token de administrador
        if (payload.phoneNumber === adminPhone ||
            (payload.email && payload.email === adminEmail)) {

          console.log('Usuário é o administrador principal. Gerando token de administrador...');

          // Definir tempo de expiração (24 horas)
          const expiresIn = 86400; // 24 horas em segundos

          // Gerar um novo token para o administrador
          const adminToken = generateToken({
            id: payload.userId,
            phone_number: adminPhone,
            role: 'ADMIN'
          });

          return NextResponse.json({
            success: true,
            token: adminToken,
            expiresIn: expiresIn,
            user: {
              id: payload.userId,
              firstName: process.env.ADMIN_FIRST_NAME || 'Caio',
              lastName: process.env.ADMIN_LAST_NAME || 'Correia',
              email: adminEmail,
              phoneNumber: adminPhone,
              role: 'ADMIN',
              position: 'Administrador do Sistema',
              department: 'TI',
              active: true,
              accessPermissions: {
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
              createdAt: new Date(),
              updatedAt: new Date()
            }
          });
        }

        return NextResponse.json(
          { error: 'Usuário não encontrado' },
          { status: 404 }
        );
      }

      // Corrigido: Retornar um NextResponse.json com o token e o usuário
      if (user) {
        // Definir tempo de expiração (24 horas)
        const expiresIn = 86400; // 24 horas em segundos

        // Gerar um novo token
        const newToken = generateToken({
          id: user.id,
          phone_number: user.phone_number,
          role: user.role
        });

        // Criar a resposta
        const response = NextResponse.json({
          success: true,
          token: newToken,
          expiresIn: expiresIn,
          user: {
            id: user.id,
            firstName: user.first_name,
            lastName: user.last_name,
            email: user.email,
            phoneNumber: user.phone_number,
            role: user.role,
            position: user.position,
            department: user.department,
            active: user.active,
            accessPermissions: user.access_permissions,
            createdAt: user.created_at,
            updatedAt: user.updated_at
          }
        });

        // Definir o token nos cookies
        const expiryDate = new Date();
        expiryDate.setSeconds(expiryDate.getSeconds() + expiresIn);

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
      } else {
        return NextResponse.json(
          { error: 'Usuário não encontrado após busca' },
          { status: 404 }
        );
      }
    } catch (error) {
      console.error('Erro ao buscar usuário no Supabase:', error);

      // Verificar se é o administrador principal
      const adminEmail = process.env.ADMIN_EMAIL || 'caio.correia@groupabz.com';
      const adminPhone = process.env.ADMIN_PHONE_NUMBER || '+5522997847289';

      // Se o payload contiver o email ou telefone do administrador, gerar um token de administrador
      if (payload.phoneNumber === adminPhone) {
        console.log('Usuário é o administrador principal pelo telefone. Gerando token de administrador...');

        // Definir tempo de expiração (24 horas)
        const expiresIn = 86400; // 24 horas em segundos

        // Gerar um novo token para o administrador
        const adminToken = generateToken({
          id: payload.userId,
          phone_number: adminPhone,
          role: 'ADMIN'
        });

        return NextResponse.json({
          success: true,
          token: adminToken,
          expiresIn: expiresIn,
          user: {
            id: payload.userId,
            firstName: process.env.ADMIN_FIRST_NAME || 'Caio',
            lastName: process.env.ADMIN_LAST_NAME || 'Correia',
            email: adminEmail,
            phoneNumber: adminPhone,
            role: 'ADMIN',
            position: 'Administrador do Sistema',
            department: 'TI',
            active: true,
            accessPermissions: {
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
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
      }

      return NextResponse.json(
        { error: 'Erro ao buscar usuário' },
        { status: 500 }
      );
    }

    // Este código nunca será alcançado devido aos retornos anteriores
    // Removido para evitar código morto
  } catch (error) {
    console.error('Erro ao renovar token:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
