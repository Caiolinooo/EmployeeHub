import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import { getDefaultPermissions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Obter dados do administrador das variáveis de ambiente
    const adminPhone = process.env.ADMIN_PHONE_NUMBER || '+5522997847289';
    const adminEmail = process.env.ADMIN_EMAIL || 'caio.correia@groupabz.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Caio@2122@';

    if (!adminPhone || !adminEmail || !adminPassword) {
      return NextResponse.json(
        { error: 'Configurações de administrador incompletas nas variáveis de ambiente' },
        { status: 500 }
      );
    }

    // Criar pool de conexão com o PostgreSQL
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });

    try {
      // Verificar se o usuário admin já existe
      const existingUserResult = await pool.query(`
        SELECT * FROM "User"
        WHERE "email" = $1 OR "phoneNumber" = $2
      `, [adminEmail, adminPhone]);

      const existingUser = existingUserResult.rows.length > 0 ? existingUserResult.rows[0] : null;

      if (existingUser) {
        await pool.end();
        return NextResponse.json(
          { message: 'Usuário administrador já existe', user: existingUser },
          { status: 200 }
        );
      }

      // Gerar hash da senha
      const hashedPassword = await bcrypt.hash(adminPassword, 10);

      // Gerar ID único
      const { v4: uuidv4 } = await import('uuid');
      const userId = uuidv4();

      // Criar usuário administrador no PostgreSQL
      const adminUserResult = await pool.query(`
        INSERT INTO "User" (
          "id",
          "phoneNumber",
          "email",
          "firstName",
          "lastName",
          "role",
          "position",
          "department",
          "active",
          "password",
          "passwordLastChanged",
          "accessPermissions",
          "accessHistory",
          "createdAt",
          "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *
      `, [
        userId,
        adminPhone,
        adminEmail,
        process.env.ADMIN_FIRST_NAME || 'Admin',
        process.env.ADMIN_LAST_NAME || 'ABZ',
        'ADMIN',
        'Administrador do Sistema',
        'TI',
        true,
        hashedPassword,
        new Date(),
        JSON.stringify(getDefaultPermissions('ADMIN')),
        JSON.stringify([{
          timestamp: new Date(),
          action: 'CREATED',
          details: 'Usuário administrador criado via API'
        }])
      ]);

      const adminUser = adminUserResult.rows[0];

      // Fechar a conexão com o banco de dados
      await pool.end();

      return NextResponse.json(
        { message: 'Usuário administrador criado com sucesso', user: adminUser },
        { status: 201 }
      );
    } catch (error) {
      console.error('Erro ao criar usuário administrador no PostgreSQL:', error);
      if (pool) await pool.end();
      return NextResponse.json(
        { error: 'Erro ao criar usuário administrador' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Erro ao criar usuário administrador:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
