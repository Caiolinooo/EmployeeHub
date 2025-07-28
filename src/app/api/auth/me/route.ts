import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromHeader, verifyToken, getDefaultPermissions } from '@/lib/auth';
import { Pool } from 'pg';

export async function GET(request: NextRequest) {
  try {
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

    // Conectar ao banco de dados PostgreSQL
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });

    try {
      // Buscar o usuário pelo ID
      console.log('Buscando usuário pelo ID:', payload.userId);
      const result = await pool.query(`
        SELECT * FROM "User" WHERE "id" = $1
      `, [payload.userId]);

      // Verificar se o usuário foi encontrado
      const user = result.rows.length > 0 ? result.rows[0] : null;
      console.log('Usuário encontrado:', user ? 'Sim' : 'Não');
      if (user) {
        console.log('Papel do usuário:', user.role);
      }

      if (!user) {
        await pool.end();
        return NextResponse.json(
          { error: 'Usuário não encontrado' },
          { status: 404 }
        );
      }

      // Criar uma cópia do usuário e remover dados sensíveis
      const userObj = { ...user };
      delete userObj.password;
      delete userObj.verificationCode;
      delete userObj.verificationCodeExpires;

    // Verificar se o usuário tem permissões definidas, caso contrário, definir permissões padrão
    console.log('Verificando permissões do usuário:', userObj.accessPermissions ? 'Existem' : 'Não existem');

    if (!userObj.accessPermissions) {
      console.log('Definindo permissões padrão para o papel:', userObj.role);
      userObj.accessPermissions = getDefaultPermissions(userObj.role);
      console.log('Permissões padrão definidas:', userObj.accessPermissions);

      // Atualizar o usuário no banco de dados com as permissões padrão
      await pool.query(`
        UPDATE "User"
        SET "accessPermissions" = $1, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = $2
      `, [JSON.stringify(userObj.accessPermissions), user.id]);
      console.log('Usuário atualizado com permissões padrão');
    } else {
      console.log('Permissões existentes:', userObj.accessPermissions);
    }

    console.log('Retornando usuário com papel:', userObj.role);
    console.log('Permissões de acesso:', userObj.accessPermissions);

    // Fechar a conexão com o banco de dados
    await pool.end();

    return NextResponse.json({ user: userObj });
    } catch (error) {
      console.error('Erro ao buscar usuário no PostgreSQL:', error);
      await pool.end();
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
