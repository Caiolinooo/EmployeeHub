import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Verificando estado das senhas no banco de dados...');

    // Buscar todos os usuários
    const { data: users, error } = await supabaseAdmin
      .from('users_unified')
      .select('id, email, phone_number, first_name, last_name, password, password_hash, email_verified, active')
      .order('email');

    if (error) {
      console.error('❌ Erro ao buscar usuários:', error);
      return NextResponse.json({ error: 'Erro ao buscar usuários', details: error }, { status: 500 });
    }

    if (!users || users.length === 0) {
      return NextResponse.json({ message: '⚠️  Nenhum usuário encontrado', users: [] });
    }

    const result = users.map(user => {
      const hasPassword = !!user.password;
      const hasPasswordHash = !!user.password_hash;

      let passwordStatus = 'none';
      let passwordHashStatus = 'none';

      if (hasPassword) {
        const isBcrypt = user.password.startsWith('$2a$') || user.password.startsWith('$2b$') || user.password.startsWith('$2y$');
        passwordStatus = isBcrypt ? 'bcrypt' : 'plaintext';
      }

      if (hasPasswordHash) {
        const isBcrypt = user.password_hash.startsWith('$2a$') || user.password_hash.startsWith('$2b$') || user.password_hash.startsWith('$2y$');
        passwordHashStatus = isBcrypt ? 'bcrypt' : 'plaintext';
      }

      return {
        id: user.id,
        email: user.email || 'N/A',
        phone: user.phone_number || 'N/A',
        name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'N/A',
        password: {
          exists: hasPassword,
          status: passwordStatus,
          preview: hasPassword ? user.password.substring(0, 30) + '...' : 'N/A'
        },
        passwordHash: {
          exists: hasPasswordHash,
          status: passwordHashStatus,
          preview: hasPasswordHash ? user.password_hash.substring(0, 30) + '...' : 'N/A'
        },
        emailVerified: user.email_verified,
        active: user.active
      };
    });

    const stats = {
      total: users.length,
      withPassword: users.filter(u => u.password).length,
      withPasswordHash: users.filter(u => u.password_hash).length,
      withBcryptPassword: users.filter(u => {
        if (!u.password) return false;
        return u.password.startsWith('$2a$') || u.password.startsWith('$2b$') || u.password.startsWith('$2y$');
      }).length,
      withPlaintextPassword: users.filter(u => {
        if (!u.password) return false;
        return !(u.password.startsWith('$2a$') || u.password.startsWith('$2b$') || u.password.startsWith('$2y$'));
      }).length,
      noPassword: users.filter(u => !u.password && !u.password_hash).length
    };

    return NextResponse.json({
      success: true,
      message: `✅ Encontrados ${users.length} usuários`,
      users: result,
      stats
    });

  } catch (error) {
    console.error('❌ Erro durante a verificação:', error);
    return NextResponse.json({ error: 'Erro interno', details: error }, { status: 500 });
  }
}
