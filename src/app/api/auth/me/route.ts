import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromHeader, verifyToken, getDefaultPermissions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// Force this route to be dynamic
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

    // Extrair o token do cabeçalho
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader || undefined);

    if (!token) {
      return NextResponse.json(
        { error: 'Token não fornecido' },
        { status: 401 }
      );
    }

    // Verificar o token
    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: 'Token inválido ou expirado' },
        { status: 401 }
      );
    }

    try {
      // Buscar o usuário pelo ID na tabela users_unified
      console.log('Buscando usuário pelo ID:', payload.userId);
      const { data: user, error } = await supabaseAdmin
        .from('users_unified')
        .select('*')
        .eq('id', payload.userId)
        .single();

      console.log('Usuário encontrado:', user ? 'Sim' : 'Não');
      if (user) {
        console.log('Papel do usuário:', user.role);
      }

      if (error || !user) {
        console.error('Erro ao buscar usuário:', error);
        return NextResponse.json(
          { error: 'Usuário não encontrado' },
          { status: 404 }
        );
      }

      // Criar uma cópia do usuário e remover dados sensíveis
      const userObj = { ...user };
      delete userObj.password;
      delete userObj.verification_code;
      delete userObj.verification_code_expires;

      // Verificar se o usuário tem permissões definidas, caso contrário, definir permissões padrão
      console.log('Verificando permissões do usuário:', userObj.access_permissions ? 'Existem' : 'Não existem');

      if (!userObj.access_permissions) {
        console.log('Definindo permissões padrão para o papel:', userObj.role);
        const defaultPermissions = getDefaultPermissions(userObj.role);
        console.log('Permissões padrão definidas:', defaultPermissions);

        // Atualizar o usuário no banco de dados com as permissões padrão
        const { error: updateError } = await supabaseAdmin
          .from('users_unified')
          .update({
            access_permissions: defaultPermissions,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);

        if (updateError) {
          console.error('Erro ao atualizar permissões do usuário:', updateError);
        } else {
          console.log('Usuário atualizado com permissões padrão');
          userObj.access_permissions = defaultPermissions;
        }
      } else {
        console.log('Permissões existentes:', userObj.access_permissions);
      }

      // Converter para formato compatível com o frontend
      const responseUser = {
        ...userObj,
        accessPermissions: userObj.access_permissions
      };

      console.log('Retornando usuário com papel:', responseUser.role);
      console.log('Permissões de acesso:', responseUser.accessPermissions);

      return NextResponse.json({ user: responseUser });
    } catch (error) {
      console.error('Erro ao buscar usuário no Supabase:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar usuário' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Erro ao obter dados do usuário:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
