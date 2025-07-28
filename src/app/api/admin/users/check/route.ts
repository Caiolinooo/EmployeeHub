import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';
import { isAdminFromRequest } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 API Users Check - Verificando sistema de usuários...');

    // Verificar se o usuário é administrador
    const adminCheck = await isAdminFromRequest(request);
    if (!adminCheck.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Acesso não autorizado' },
        { status: 403 }
      );
    }

    // Verificar se a tabela users_unified existe e contar usuários
    const { count, error } = await supabaseAdmin
      .from('users_unified')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('❌ Erro ao verificar usuários:', error);
      return NextResponse.json(
        { success: false, error: 'Erro ao verificar sistema de usuários' },
        { status: 500 }
      );
    }

    // Contar usuários por role
    const { data: adminUsers, error: adminError } = await supabaseAdmin
      .from('users_unified')
      .select('id')
      .eq('role', 'ADMIN');

    const { data: managerUsers, error: managerError } = await supabaseAdmin
      .from('users_unified')
      .select('id')
      .eq('role', 'MANAGER');

    const { data: userUsers, error: userError } = await supabaseAdmin
      .from('users_unified')
      .select('id')
      .eq('role', 'USER');

    console.log(`✅ Sistema de usuários funcionando: ${count} usuários total`);
    
    return NextResponse.json({
      success: true,
      userCount: count || 0,
      adminCount: adminUsers?.length || 0,
      managerCount: managerUsers?.length || 0,
      regularUserCount: userUsers?.length || 0,
      message: `Sistema funcionando com ${count} usuários`
    });

  } catch (error) {
    console.error('❌ Erro na API users check:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
