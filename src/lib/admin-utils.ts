/**
 * Utilitários para gerenciamento de usuários administradores
 */
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import { getDefaultPermissions } from './auth';
import { v4 as uuidv4 } from 'uuid';

/**
 * Verifica se o usuário administrador existe e o cria se necessário
 */
export async function ensureAdminUser(): Promise<boolean> {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'caio.correia@groupabz.com';
    const adminPhone = process.env.ADMIN_PHONE_NUMBER || '+5522997847289';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Caio@2122@';
    
    console.log('Verificando usuário administrador:', { adminEmail, adminPhone });
    
    // Criar pool de conexão com o PostgreSQL
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
    
    try {
      // Verificar se o usuário admin já existe
      const existingAdminResult = await pool.query(`
        SELECT * FROM "User"
        WHERE "email" = $1 OR "phoneNumber" = $2
      `, [adminEmail, adminPhone]);
      
      if (existingAdminResult.rows.length > 0) {
        const existingAdmin = existingAdminResult.rows[0];
        console.log('Usuário administrador já existe:', existingAdmin.id);
        
        // Verificar se a senha está definida
        if (!existingAdmin.password) {
          console.log('Atualizando senha do administrador');
          const hashedPassword = await bcrypt.hash(adminPassword, 10);
          
          await pool.query(`
            UPDATE "User"
            SET
              "password" = $1,
              "updatedAt" = CURRENT_TIMESTAMP
            WHERE "id" = $2
          `, [hashedPassword, existingAdmin.id]);
          
          console.log('Senha do administrador atualizada com sucesso');
        }
        
        await pool.end();
        return true;
      }
      
      // Criar usuário administrador
      console.log('Criando novo usuário administrador');
      
      // Hash da senha
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      
      // Gerar ID único
      const userId = uuidv4();
      
      // Inserir o usuário administrador
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
        process.env.ADMIN_FIRST_NAME || 'Caio',
        process.env.ADMIN_LAST_NAME || 'Correia',
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
          details: 'Usuário administrador criado automaticamente'
        }])
      ]);
      
      console.log('Usuário administrador criado com sucesso:', adminUserResult.rows[0].id);
      
      await pool.end();
      return true;
    } catch (error) {
      console.error('Erro ao verificar/criar usuário administrador:', error);
      await pool.end();
      return false;
    }
  } catch (error) {
    console.error('Erro ao criar pool de conexão:', error);
    return false;
  }
}
