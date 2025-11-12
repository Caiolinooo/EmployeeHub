import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Fix avaliacao schema request received');

    // Verificar autenticação e se é administrador
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader || '');

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

    if (payload.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Acesso negado: Requer privilégios de administrador' },
        { status: 403 }
      );
    }

    console.log('✅ Admin user authenticated, executing schema fixes...');

    // Lista de comandos SQL para executar
    const sqlCommands = [
      // Adicionar coluna deleted_at à users_unified
      'ALTER TABLE users_unified ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;',

      // Adicionar colunas à notifications se a tabela existir
      `
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications' AND table_schema = 'public') THEN
                ALTER TABLE notifications ADD COLUMN IF NOT EXISTS email_sent BOOLEAN DEFAULT FALSE;
                ALTER TABLE notifications ADD COLUMN IF NOT EXISTS push_sent BOOLEAN DEFAULT FALSE;
                ALTER TABLE notifications ADD COLUMN IF NOT EXISTS "read" BOOLEAN DEFAULT FALSE;
                ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type VARCHAR(100) DEFAULT 'info';
                ALTER TABLE notifications ADD COLUMN IF NOT EXISTS data JSONB NULL;
                RAISE NOTICE 'Colunas adicionadas à tabela notifications';
            ELSE
                RAISE NOTICE 'Tabela notifications não encontrada';
            END IF;
        END $$;
      `
    ];

    const results = [];

    for (let i = 0; i < sqlCommands.length; i++) {
      const sql = sqlCommands[i];
      console.log(`\n${i + 1}. Executando comando SQL...`);

      try {
        // Usar sql.raw para executar SQL direto via Supabase Admin
        const { data, error } = await supabaseAdmin
          .from('')
          .select('*');

        // Como não temos método direto, vamos usar a via HTTP para o PostgreSQL
        // Vamos tentar usar o método via raw query
        const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            'apikey': process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            query: sql
          })
        });

        if (response.ok || response.status === 204) {
          console.log(`✅ Comando ${i + 1} executado com sucesso`);
          results.push({ command: i + 1, status: 'success' });
        } else {
          const errorText = await response.text();
          console.log(`❌ Erro no comando ${i + 1}:`, errorText);
          results.push({ command: i + 1, status: 'error', error: errorText });
        }
      } catch (error) {
        console.log(`❌ Erro no comando ${i + 1}:`, error instanceof Error ? error.message : String(error));
        results.push({ command: i + 1, status: 'error', error: error instanceof Error ? error.message : String(error) });
      }
    }

    // Verificação final
    console.log('\n🔍 Realizando verificação final...');

    const verificationResults = {};

    // Verificar users_unified.deleted_at
    try {
      const { data: userData, error: userError } = await supabaseAdmin
        .from('users_unified')
        .select('id, deleted_at')
        .limit(1);

      if (userError) {
        verificationResults.users_unified_deleted_at = { status: 'error', error: userError.message };
      } else {
        const hasColumn = userData && userData.length > 0 && userData[0].hasOwnProperty('deleted_at');
        verificationResults.users_unified_deleted_at = {
          status: hasColumn ? 'present' : 'absent',
          message: hasColumn ? 'Coluna presente' : 'Coluna ausente'
        };
      }
    } catch (e) {
      verificationResults.users_unified_deleted_at = { status: 'error', error: String(e) };
    }

    // Verificar notifications columns
    try {
      const { data: notifData, error: notifError } = await supabaseAdmin
        .from('notifications')
        .select('id, email_sent, push_sent')
        .limit(1);

      if (notifError) {
        verificationResults.notifications_columns = { status: 'error', error: notifError.message };
      } else {
        const hasEmailSent = notifData && notifData.length > 0 && notifData[0].hasOwnProperty('email_sent');
        const hasPushSent = notifData && notifData.length > 0 && notifData[0].hasOwnProperty('push_sent');
        verificationResults.notifications_columns = {
          status: 'checked',
          email_sent: hasEmailSent ? 'present' : 'absent',
          push_sent: hasPushSent ? 'present' : 'absent'
        };
      }
    } catch (e) {
      verificationResults.notifications_columns = { status: 'error', error: String(e) };
    }

    return NextResponse.json({
      success: true,
      message: 'Schema fix execution completed',
      results,
      verification: verificationResults
    });

  } catch (error) {
    console.error('❌ Error processing fix request:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}