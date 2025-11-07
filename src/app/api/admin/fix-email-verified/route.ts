import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';

/**
 * API Route temporária para marcar email_verified=true em usuários criados pelo admin
 *
 * IMPORTANTE: Esta rota deve ser executada uma única vez e depois removida
 */
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader || undefined);

    if (!token) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: 'Token inválido ou expirado' },
        { status: 401 }
      );
    }

    // Verificar se o usuário é administrador
    const { data: requestingUser, error: userError } = await supabaseAdmin
      .from('users_unified')
      .select('id, role, email')
      .eq('id', payload.userId)
      .single();

    if (userError || !requestingUser || requestingUser.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores podem executar esta operação.' },
        { status: 403 }
      );
    }

    console.log(`🔧 Executando fix de email_verified por ${requestingUser.email}...\n`);

    // Data de corte: 2025-11-07 23:00:00 UTC
    const cutoffDate = '2025-11-07T23:00:00.000Z';

    // Buscar todos os usuários criados antes da data de corte com email_verified = false
    const { data: users, error: fetchError } = await supabaseAdmin
      .from('users_unified')
      .select('id, email, first_name, last_name, email_verified, created_at, access_history')
      .lt('created_at', cutoffDate)
      .eq('email_verified', false);

    if (fetchError) {
      console.error('❌ Erro ao buscar usuários:', fetchError);
      return NextResponse.json(
        { error: 'Erro ao buscar usuários', details: fetchError.message },
        { status: 500 }
      );
    }

    console.log(`📊 Encontrados ${users.length} usuários com email_verified=false\n`);

    // Filtrar apenas os criados por admin
    const adminCreatedUsers = users.filter(user => {
      if (!user.access_history || !Array.isArray(user.access_history)) {
        return false;
      }

      return user.access_history.some((item: any) =>
        item.action === 'CREATED' &&
        item.details &&
        item.details.includes('Usuário criado por')
      );
    });

    console.log(`👤 ${adminCreatedUsers.length} usuários foram criados pelo admin\n`);

    if (adminCreatedUsers.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nenhum usuário precisa ser atualizado',
        updated: 0,
        users: []
      });
    }

    // Atualizar cada usuário
    const updatedUsers = [];
    let successCount = 0;
    let errorCount = 0;

    for (const user of adminCreatedUsers) {
      const { error: updateError } = await supabaseAdmin
        .from('users_unified')
        .update({
          email_verified: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (updateError) {
        console.error(`❌ Erro ao atualizar ${user.email}:`, updateError);
        errorCount++;
      } else {
        console.log(`✅ ${user.first_name} ${user.last_name} (${user.email}) → email_verified = true`);
        updatedUsers.push({
          id: user.id,
          email: user.email,
          name: `${user.first_name} ${user.last_name}`
        });
        successCount++;
      }
    }

    console.log('\n📊 RESULTADO:');
    console.log(`   ✅ Sucesso: ${successCount}`);
    console.log(`   ❌ Erro: ${errorCount}`);
    console.log(`   📝 Total: ${adminCreatedUsers.length}\n`);

    return NextResponse.json({
      success: true,
      message: `${successCount} usuários atualizados com sucesso`,
      updated: successCount,
      errors: errorCount,
      users: updatedUsers
    });

  } catch (error) {
    console.error('❌ Erro ao executar fix:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
