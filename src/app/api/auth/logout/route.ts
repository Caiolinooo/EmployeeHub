import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { Pool } from 'pg';

export async function POST(request: NextRequest) {
  try {
    // Extrair o token do cabeçalho
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader || undefined);

    if (!token) {
      return NextResponse.json(
        { message: 'Logout realizado com sucesso' },
        { status: 200 }
      );
    }

    // Verificar o token
    const payload = verifyToken(token);
    if (!payload || !payload.userId) {
      return NextResponse.json(
        { message: 'Logout realizado com sucesso' },
        { status: 200 }
      );
    }

    // Conectar ao banco de dados PostgreSQL
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });

    try {
      // Registrar o logout no histórico de acesso do usuário
      console.log('Registrando logout para o usuário:', payload.userId);
      
      // Primeiro, buscar o histórico de acesso atual
      const userResult = await pool.query(`
        SELECT "accessHistory" FROM "User" WHERE "id" = $1
      `, [payload.userId]);
      
      if (userResult.rows.length > 0) {
        const user = userResult.rows[0];
        let accessHistory = user.accessHistory || [];
        
        // Se não for um array, converter para array
        if (!Array.isArray(accessHistory)) {
          accessHistory = [];
        }
        
        // Adicionar o evento de logout
        accessHistory.push({
          timestamp: new Date(),
          action: 'LOGOUT',
          details: 'Logout realizado via API'
        });
        
        // Atualizar o histórico de acesso
        await pool.query(`
          UPDATE "User"
          SET "accessHistory" = $1, "updatedAt" = CURRENT_TIMESTAMP
          WHERE "id" = $2
        `, [JSON.stringify(accessHistory), payload.userId]);
        
        console.log('Logout registrado com sucesso');
      }
      
      // Fechar a conexão com o banco de dados
      await pool.end();
      
      return NextResponse.json(
        { message: 'Logout realizado com sucesso' },
        { status: 200 }
      );
    } catch (error) {
      console.error('Erro ao registrar logout no PostgreSQL:', error);
      await pool.end();
      return NextResponse.json(
        { message: 'Logout realizado com sucesso, mas houve um erro ao registrar' },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error('Erro ao processar logout:', error);
    return NextResponse.json(
      { message: 'Logout realizado com sucesso, mas houve um erro interno' },
      { status: 200 }
    );
  }
}
