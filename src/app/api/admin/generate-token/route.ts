import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    console.log('Gerando token JWT para o administrador...');
    
    // Obter configurações
    const DATABASE_URL = process.env.DATABASE_URL;
    const JWT_SECRET = process.env.JWT_SECRET;
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'caio.correia@groupabz.com';
    const ADMIN_PHONE_NUMBER = process.env.ADMIN_PHONE_NUMBER || '+5522997847289';
    
    // Verificar configurações
    if (!DATABASE_URL || !JWT_SECRET) {
      return NextResponse.json({
        success: false,
        error: 'Configurações incompletas'
      }, { status: 500 });
    }
    
    // Criar pool de conexão
    const pool = new Pool({
      connectionString: DATABASE_URL
    });
    
    try {
      // Buscar o usuário administrador
      console.log('Buscando usuário administrador...');
      
      const result = await pool.query(`
        SELECT * FROM "users" 
        WHERE email = $1 OR phone_number = $2
      `, [ADMIN_EMAIL, ADMIN_PHONE_NUMBER]);
      
      if (result.rows.length === 0) {
        await pool.end();
        return NextResponse.json({
          success: false,
          error: 'Usuário administrador não encontrado'
        }, { status: 404 });
      }
      
      const adminUser = result.rows[0];
      console.log('Usuário administrador encontrado:', adminUser.id);
      
      // Gerar token JWT
      const payload = {
        userId: adminUser.id,
        email: adminUser.email,
        phoneNumber: adminUser.phone_number,
        role: 'ADMIN',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 dias
      };
      
      const token = jwt.sign(payload, JWT_SECRET);
      console.log('Token JWT gerado com sucesso');
      
      // Fechar pool de conexão
      await pool.end();
      
      return NextResponse.json({
        success: true,
        token,
        user: {
          id: adminUser.id,
          email: adminUser.email,
          phoneNumber: adminUser.phone_number,
          firstName: adminUser.first_name,
          lastName: adminUser.last_name,
          role: adminUser.role
        }
      });
    } catch (error) {
      console.error('Erro ao gerar token JWT:', error);
      
      // Fechar pool de conexão
      await pool.end();
      
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Erro não tratado:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
