import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';
import { isAdminFromRequest } from '@/lib/auth';
import dashboardCards from '@/data/cards';

export const dynamic = 'force-dynamic';

// POST - Criar a tabela cards e inserir dados iniciais
export async function POST(request: NextRequest) {
  try {
    // Verificar se o usuário é administrador
    const adminCheck = await isAdminFromRequest(request);
    if (!adminCheck.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Acesso não autorizado' },
        { status: 403 }
      );
    }

    // Criar a tabela cards usando SQL
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS cards (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        href TEXT NOT NULL,
        icon TEXT,
        color TEXT,
        hover_color TEXT,
        external BOOLEAN DEFAULT false,
        enabled BOOLEAN DEFAULT true,
        "order" INTEGER,
        admin_only BOOLEAN DEFAULT false,
        manager_only BOOLEAN DEFAULT false,
        allowed_roles JSONB,
        allowed_user_ids JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    // Executar SQL para criar a tabela
    try {
      console.log('Verificando se a tabela cards já existe...');

      // Primeiro, verificar se a tabela já existe
      const { data: tableCheck, error: tableCheckError } = await supabaseAdmin
        .from('cards')
        .select('id')
        .limit(1);

      // Se não houver erro, a tabela já existe
      if (!tableCheckError) {
        console.log('Tabela cards já existe');
      } else if (tableCheckError.message.includes('does not exist') || tableCheckError.code === '42P01') {
        // A tabela não existe, vamos criar
        console.log('Tabela cards não existe, criando...');

        // Método 1: Tentar usar a função execute_sql
        try {
          console.log('Tentando criar tabela usando execute_sql...');
          const { error: createTableError } = await supabaseAdmin.rpc('execute_sql', {
            sql: createTableSQL
          });

          if (!createTableError) {
            console.log('Tabela cards criada com sucesso via execute_sql');
          } else {
            // Se a função execute_sql não existir, usar método alternativo
            if (createTableError.message.includes('function') || createTableError.message.includes('not found')) {
              console.log('Função execute_sql não existe, usando método alternativo');

              // Método 2: Tentar usar a API REST diretamente
              const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
              const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

              if (!supabaseUrl || !supabaseKey) {
                throw new Error('Variáveis de ambiente do Supabase não configuradas');
              }

              // Método 3: Inserir um card temporário para forçar a criação da tabela
              console.log('Tentando criar tabela inserindo um card temporário...');
              const { error: insertError } = await supabaseAdmin
                .from('cards')
                .insert([{
                  id: 'temp_id_for_table_creation',
                  title: 'Temporary Card',
                  description: 'This card is used to create the table and will be deleted',
                  href: '/temp',
                  icon: 'FiGrid',
                  color: 'blue',
                  hover_color: 'blue',
                  enabled: true,
                  order: 0,
                  admin_only: false,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                }]);

              if (insertError) {
                console.error('Erro ao criar tabela via inserção:', insertError);
                throw new Error(`Erro ao criar tabela: ${insertError.message}`);
              }

              console.log('Tabela cards criada com sucesso via inserção');

              // Se a tabela foi criada com sucesso, remover o card temporário
              await supabaseAdmin
                .from('cards')
                .delete()
                .eq('id', 'temp_id_for_table_creation');
            } else {
              // Se for outro erro, lançar exceção
              console.error('Erro ao criar tabela via execute_sql:', createTableError);
              throw new Error(`Erro ao criar tabela: ${createTableError.message}`);
            }
          }
        } catch (createError) {
          console.error('Erro ao criar tabela cards:', createError);
          throw createError;
        }
      } else {
        // Se for outro erro, lançar exceção
        console.error('Erro ao verificar tabela cards:', tableCheckError);
        throw new Error(`Erro ao verificar tabela: ${tableCheckError.message}`);
      }
    } catch (error) {
      console.error('Erro ao criar tabela cards:', error);
      // Continuar mesmo com erro, pois a tabela pode já existir
    }

    // Verificar se a tabela foi criada com sucesso
    const { data: tableCheck, error: tableCheckError } = await supabaseAdmin
      .from('cards')
      .select('id')
      .limit(1);

    if (tableCheckError) {
      console.error('Erro ao verificar se a tabela foi criada:', tableCheckError);
      return NextResponse.json(
        { success: false, error: `Erro ao verificar tabela: ${tableCheckError.message}` },
        { status: 500 }
      );
    }

    // Inserir dados iniciais
    const initialCards = dashboardCards.map(card => {
      // Obter o nome do ícone a partir do objeto do ícone
      let iconName = 'FiGrid';

      // Verificar se o ícone é um componente válido
      if (card.icon && typeof card.icon === 'function') {
        // Tentar obter o displayName do componente
        iconName = (card.icon as any).displayName || card.icon.name || 'FiGrid';

        // Garantir que o nome do ícone esteja no formato correto (PascalCase)
        if (!iconName.startsWith('Fi')) {
          iconName = `Fi${iconName}`;
        }
      }

      return {
        id: card.id,
        title: card.title,
        description: card.description,
        href: card.href,
        icon: iconName,
        color: card.color,
        hover_color: card.hoverColor,
        external: card.external,
        enabled: card.enabled,
        order: card.order,
        admin_only: card.adminOnly || false,
        manager_only: card.managerOnly || false,
        allowed_roles: card.allowedRoles || null,
        allowed_user_ids: card.allowedUserIds || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    });

    // Inserir os cards iniciais
    const { error: insertError } = await supabaseAdmin
      .from('cards')
      .upsert(initialCards, { onConflict: 'id' });

    if (insertError) {
      console.error('Erro ao inserir cards iniciais:', insertError);
      return NextResponse.json(
        { success: false, error: `Erro ao inserir cards iniciais: ${insertError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Tabela cards criada e dados iniciais inseridos com sucesso'
    });
  } catch (error) {
    console.error('Erro ao criar tabela cards:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor', details: String(error) },
      { status: 500 }
    );
  }
}
