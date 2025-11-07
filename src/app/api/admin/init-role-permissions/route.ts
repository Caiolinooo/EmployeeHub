import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// POST - Criar tabela role_permissions e inserir dados padrão
export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Inicializando tabela role_permissions...');

    // Verificar se a tabela já existe
    const { data: existingTable, error: checkError } = await supabaseAdmin
      .from('role_permissions')
      .select('id')
      .limit(1);

    if (!checkError) {
      console.log('✅ Tabela role_permissions já existe');
      return NextResponse.json({
        success: true,
        message: 'Tabela role_permissions já existe',
        already_exists: true
      });
    }

    console.log('📝 Tentando criar tabela role_permissions...');

    // Como não podemos executar DDL diretamente via API, vamos retornar instruções
    return NextResponse.json({
      success: false,
      error: 'Tabela role_permissions não existe',
      instructions: 'Execute o script scripts/create-role-permissions-table.sql no Supabase SQL Editor',
      sql_script: `-- Execute este SQL no Supabase SQL Editor:

CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  role VARCHAR(50) NOT NULL UNIQUE,
  modules JSONB DEFAULT '{}',
  features JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role);

INSERT INTO role_permissions (role, modules, features) VALUES
(
  'ADMIN',
  '{
    "dashboard": true,
    "manual": true,
    "procedimentos": true,
    "politicas": true,
    "calendario": true,
    "noticias": true,
    "reembolso": true,
    "contracheque": true,
    "ponto": true,
    "admin": true,
    "avaliacao": true
  }',
  '{
    "reimbursement_approval": true,
    "reimbursement_edit": true,
    "reimbursement_view": true
  }'
),
(
  'MANAGER',
  '{
    "dashboard": true,
    "manual": true,
    "procedimentos": true,
    "politicas": true,
    "calendario": true,
    "noticias": true,
    "reembolso": true,
    "contracheque": true,
    "ponto": true,
    "admin": false,
    "avaliacao": true
  }',
  '{
    "reimbursement_approval": true,
    "reimbursement_view": true,
    "reimbursement_edit": false
  }'
),
(
  'USER',
  '{
    "dashboard": true,
    "manual": true,
    "procedimentos": true,
    "politicas": true,
    "calendario": true,
    "noticias": true,
    "reembolso": true,
    "contracheque": true,
    "ponto": true,
    "admin": false,
    "avaliacao": false
  }',
  '{
    "reimbursement_approval": false,
    "reimbursement_view": true,
    "reimbursement_edit": false
  }'
)
ON CONFLICT (role) DO UPDATE SET
  modules = EXCLUDED.modules,
  features = EXCLUDED.features,
  updated_at = NOW();`
    }, { status: 400 });

    // Se chegou até aqui, a tabela existe, então vamos apenas inserir os dados
    console.log('📝 Inserindo dados padrão...');

    const defaultRoles = [
      {
        role: 'ADMIN',
        modules: {
          dashboard: true,
          manual: true,
          procedimentos: true,
          politicas: true,
          calendario: true,
          noticias: true,
          reembolso: true,
          contracheque: true,
          ponto: true,
          admin: true,
          avaliacao: true
        },
        features: {
          reimbursement_approval: true,
          reimbursement_edit: true,
          reimbursement_view: true
        }
      },
      {
        role: 'MANAGER',
        modules: {
          dashboard: true,
          manual: true,
          procedimentos: true,
          politicas: true,
          calendario: true,
          noticias: true,
          reembolso: true,
          contracheque: true,
          ponto: true,
          admin: false,
          avaliacao: true
        },
        features: {
          reimbursement_approval: true,
          reimbursement_view: true,
          reimbursement_edit: false
        }
      },
      {
        role: 'USER',
        modules: {
          dashboard: true,
          manual: true,
          procedimentos: true,
          politicas: true,
          calendario: true,
          noticias: true,
          reembolso: true,
          contracheque: true,
          ponto: true,
          admin: false,
          avaliacao: false
        },
        features: {
          reimbursement_approval: false,
          reimbursement_view: true,
          reimbursement_edit: false
        }
      }
    ];

    for (const roleData of defaultRoles) {
      const { error: insertError } = await supabaseAdmin
        .from('role_permissions')
        .upsert(roleData, {
          onConflict: 'role',
          ignoreDuplicates: false
        });

      if (insertError) {
        console.error(`Erro ao inserir role ${roleData.role}:`, insertError);
      } else {
        console.log(`✅ Role ${roleData.role} inserido/atualizado`);
      }
    }

    console.log('✅ Dados inseridos na tabela role_permissions');

    return NextResponse.json({
      success: true,
      message: 'Dados inseridos na tabela role_permissions com sucesso',
      roles_created: defaultRoles.length
    });

  } catch (error) {
    console.error('Erro ao inicializar role_permissions:', error);
    return NextResponse.json(
      { 
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}

// GET - Verificar status da tabela role_permissions
export async function GET() {
  try {
    const { data: roles, error } = await supabaseAdmin
      .from('role_permissions')
      .select('role, modules, features, created_at')
      .order('role');

    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json({
          exists: false,
          error: 'Tabela role_permissions não existe',
          message: 'Execute POST /api/admin/init-role-permissions para criar a tabela'
        });
      }
      
      return NextResponse.json(
        { error: 'Erro ao verificar tabela' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      exists: true,
      roles_count: roles?.length || 0,
      roles: roles || []
    });

  } catch (error) {
    console.error('Erro ao verificar role_permissions:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
