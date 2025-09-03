import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Iniciando migração da tabela SiteConfig...');

    // Primeiro, vamos tentar fazer uma consulta simples na tabela para verificar se existe
    const { data: testData, error: testError } = await supabaseAdmin
      .from('SiteConfig')
      .select('id')
      .limit(1);

    if (testError) {
      console.error('Erro ao verificar tabela SiteConfig:', testError);

      // Se a tabela não existir, retornar instruções para criar
      if (testError.code === 'PGRST116' || testError.message?.includes('does not exist')) {
      return NextResponse.json({
        error: 'Tabela SiteConfig não encontrada',
        message: 'A tabela SiteConfig precisa existir antes de executar a migração',
        sql: `
-- Criar tabela SiteConfig se não existir
CREATE TABLE IF NOT EXISTS "SiteConfig" (
  id VARCHAR(50) PRIMARY KEY DEFAULT 'default',
  title VARCHAR(255) NOT NULL DEFAULT 'Painel ABZ Group',
  description TEXT DEFAULT 'Painel centralizado para colaboradores da ABZ Group',
  logo VARCHAR(500) DEFAULT '/images/LC1_Azul.png',
  favicon VARCHAR(500) DEFAULT '/favicon.ico',
  "primaryColor" VARCHAR(7) DEFAULT '#005dff',
  "secondaryColor" VARCHAR(7) DEFAULT '#6339F5',
  "companyName" VARCHAR(255) DEFAULT 'ABZ Group',
  "contactEmail" VARCHAR(255) DEFAULT 'contato@groupabz.com',
  "footerText" TEXT DEFAULT '© 2024 ABZ Group. Todos os direitos reservados.',
  "dashboardTitle" VARCHAR(255) DEFAULT 'Painel de Logística ABZ Group',
  "googleClientId" TEXT DEFAULT '',
  "googleClientSecret" TEXT DEFAULT '',
  "googleRedirectUri" TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inserir configuração padrão
INSERT INTO "SiteConfig" (
  id, title, description, logo, favicon, "primaryColor", "secondaryColor", 
  "companyName", "contactEmail", "footerText", "dashboardTitle",
  "googleClientId", "googleClientSecret", "googleRedirectUri"
) VALUES (
  'default',
  'Painel ABZ Group',
  'Painel centralizado para colaboradores da ABZ Group',
  '/images/LC1_Azul.png',
  '/favicon.ico',
  '#005dff',
  '#6339F5',
  'ABZ Group',
  'contato@groupabz.com',
  '© 2024 ABZ Group. Todos os direitos reservados.',
  'Painel de Logística ABZ Group',
  '',
  '',
  ''
) ON CONFLICT (id) DO NOTHING;
        `
      }, { status: 400 });
      }

      // Para outros erros, retornar erro genérico
      return NextResponse.json({
        error: 'Erro ao verificar tabela SiteConfig',
        details: testError
      }, { status: 500 });
    }

    console.log('✅ Tabela SiteConfig encontrada, verificando colunas...');

    // Tentar fazer uma consulta para verificar se as colunas existem
    const { data: configData, error: configError } = await supabaseAdmin
      .from('SiteConfig')
      .select('*')
      .limit(1);

    if (configError) {
      console.error('Erro ao verificar configuração:', configError);
      return NextResponse.json({
        error: 'Erro ao verificar dados da tabela SiteConfig',
        details: configError
      }, { status: 500 });
    }

    // Verificar quais colunas existem baseado nos dados retornados
    const existingColumns = configData && configData.length > 0 ? Object.keys(configData[0]) : [];
    console.log('Colunas existentes:', existingColumns);

    // Colunas que precisamos adicionar
    const requiredColumns = [
      { name: 'dashboardTitle', type: 'VARCHAR(255)', default: "'Painel de Logística ABZ Group'" },
      { name: 'dashboardDescription', type: 'TEXT', default: "'Bem-vindo ao centro de recursos para colaboradores da logística.'" },
      { name: 'googleClientId', type: 'TEXT', default: "''" },
      { name: 'googleClientSecret', type: 'TEXT', default: "''" },
      { name: 'googleRedirectUri', type: 'TEXT', default: "''" }
    ];

    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col.name));

    if (missingColumns.length === 0) {
      return NextResponse.json({
        message: 'Todas as colunas já existem na tabela SiteConfig',
        existingColumns: existingColumns
      });
    }

    console.log('Colunas que serão adicionadas:', missingColumns.map(col => col.name));

    // Gerar SQL para adicionar as colunas
    const alterStatements = missingColumns.map(col => 
      `ALTER TABLE "SiteConfig" ADD COLUMN IF NOT EXISTS "${col.name}" ${col.type} DEFAULT ${col.default};`
    );

    const sqlScript = alterStatements.join('\n');

    return NextResponse.json({
      message: 'Migração necessária - Execute o SQL abaixo no Supabase Dashboard',
      missingColumns: missingColumns.map(col => col.name),
      existingColumns: existingColumns,
      sql: sqlScript,
      instructions: [
        '1. Acesse o Supabase Dashboard',
        '2. Vá para SQL Editor',
        '3. Execute o SQL fornecido acima',
        '4. Tente salvar as configurações novamente'
      ]
    });

  } catch (error) {
    console.error('❌ Erro na migração:', error);
    return NextResponse.json({
      error: 'Erro interno na migração',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'API para migração da tabela SiteConfig',
    description: 'Use POST para verificar e gerar SQL de migração',
    endpoints: {
      POST: 'Verifica colunas faltantes e gera SQL de migração'
    }
  });
}
