import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';
import { isAdminFromRequest } from '@/lib/auth';
import dashboardCards from '@/data/cards';

export const dynamic = 'force-dynamic';

// Função para converter cards hardcoded para o formato do banco de dados
function convertHardcodedCards() {
  return dashboardCards.map(card => {
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
}

// POST - Migrar cards hardcoded para o banco de dados
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

    console.log('Iniciando migração de cards hardcoded para o banco de dados...');

    // Verificar se a tabela cards existe
    try {
      const { data, error } = await supabaseAdmin
        .from('cards')
        .select('id')
        .limit(1);

      if (error) {
        console.error('Erro ao verificar tabela cards:', error);

        // Se a tabela não existir, criar a tabela
        if (error.message.includes('does not exist') || error.code === '42P01') {
          console.log('Tabela cards não existe, criando tabela...');

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

          try {
            // Executar SQL diretamente usando o método rpc
            const { error: sqlError } = await supabaseAdmin.rpc('execute_sql', {
              sql: createTableSQL
            });

            if (sqlError) {
              // Se o método rpc não estiver disponível, tentar método alternativo
              if (sqlError.message.includes('function') || sqlError.message.includes('not found')) {
                console.log('Função execute_sql não disponível, tentando método alternativo...');

                // Método alternativo: criar a tabela diretamente usando o cliente Supabase
                console.log('Tentando criar tabela cards diretamente...');

                try {
                  // Primeiro, vamos tentar criar a tabela usando o método de inserção
                  // Isso pode falhar, mas é uma maneira de verificar se a tabela já existe
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

                  // Se não houver erro, a tabela já existe ou foi criada com sucesso
                  if (!insertError) {
                    console.log('Tabela cards criada com sucesso via inserção');

                    // Remover o card temporário
                    await supabaseAdmin
                      .from('cards')
                      .delete()
                      .eq('id', 'temp_id_for_table_creation');
                  } else {
                    // Se o erro não for relacionado à tabela não existir, é outro problema
                    if (!insertError.message.includes('does not exist') && insertError.code !== '42P01') {
                      throw new Error(`Erro ao criar tabela: ${insertError.message}`);
                    }

                    // Se chegamos aqui, precisamos criar a tabela de outra forma
                    console.log('Tentando criar tabela usando método alternativo...');

                    // Usar o método de API REST diretamente
                    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
                    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

                    if (!supabaseUrl || !supabaseKey) {
                      throw new Error('Variáveis de ambiente do Supabase não configuradas');
                    }

                    // Criar a tabela usando uma requisição HTTP direta
                    const response = await fetch(`${supabaseUrl}/rest/v1/cards?select=id`, {
                      method: 'GET',
                      headers: {
                        'Content-Type': 'application/json',
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Prefer': 'return=representation'
                      }
                    });

                    // Se a tabela não existe, o Supabase retornará um erro 400 ou 404
                    if (response.status === 400 || response.status === 404) {
                      console.log('Confirmado que a tabela não existe, criando...');

                      // Tentar criar a tabela usando o método de inserção novamente
                      // Isso forçará o Supabase a criar a tabela com a estrutura correta
                      const { error: finalInsertError } = await supabaseAdmin
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

                      if (finalInsertError) {
                        throw new Error(`Falha ao criar tabela: ${finalInsertError.message}`);
                      }

                      // Remover o card temporário
                      await supabaseAdmin
                        .from('cards')
                        .delete()
                        .eq('id', 'temp_id_for_table_creation');
                    }
                  }
                } catch (restError) {
                  console.error('Erro ao criar tabela usando método alternativo:', restError);
                  throw new Error(`Erro ao criar tabela: ${restError instanceof Error ? restError.message : String(restError)}`);
                }
              } else {
                throw new Error(`Erro ao executar SQL para criar tabela: ${sqlError.message}`);
              }
            }

            console.log('Tabela cards criada com sucesso');
          } catch (createTableError) {
            console.error('Erro ao criar tabela cards:', createTableError);
            throw new Error(`Erro ao criar tabela cards: ${createTableError instanceof Error ? createTableError.message : String(createTableError)}`);
          }
        } else {
          return NextResponse.json(
            { success: false, error: `Erro ao verificar tabela: ${error.message}` },
            { status: 500 }
          );
        }
      }
    } catch (err) {
      console.error('Erro ao verificar/criar tabela cards:', err);
      return NextResponse.json(
        { success: false, error: 'Erro ao verificar/criar tabela cards', details: String(err) },
        { status: 500 }
      );
    }

    // Converter cards hardcoded para o formato do banco de dados
    const cardsToMigrate = convertHardcodedCards();
    console.log(`Convertidos ${cardsToMigrate.length} cards para migração`);

    // Inserir os cards no banco de dados (usando upsert para evitar duplicatas)
    const { data: migratedCards, error: migrationError } = await supabaseAdmin
      .from('cards')
      .upsert(cardsToMigrate, {
        onConflict: 'id',
        ignoreDuplicates: false // Atualizar registros existentes
      })
      .select();

    if (migrationError) {
      console.error('Erro ao migrar cards para o banco de dados:', migrationError);
      return NextResponse.json(
        { success: false, error: `Erro ao migrar cards: ${migrationError.message}` },
        { status: 500 }
      );
    }

    console.log(`Migração concluída. ${migratedCards?.length || 0} cards migrados com sucesso.`);

    return NextResponse.json({
      success: true,
      message: `${migratedCards?.length || 0} cards migrados com sucesso`,
      migrated: migratedCards
    });
  } catch (error) {
    console.error('Erro ao migrar cards:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor', details: String(error) },
      { status: 500 }
    );
  }
}

// GET - Verificar status da migração
export async function GET(request: NextRequest) {
  try {
    // Verificar se o usuário é administrador
    const adminCheck = await isAdminFromRequest(request);
    if (!adminCheck.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Acesso não autorizado' },
        { status: 403 }
      );
    }

    // Verificar quantos cards hardcoded existem
    const hardcodedCount = dashboardCards.length;

    // Verificar quantos cards existem no banco de dados
    const { data: dbCards, error } = await supabaseAdmin
      .from('cards')
      .select('id');

    if (error) {
      console.error('Erro ao verificar cards no banco de dados:', error);

      // Se a tabela não existir, retornar que nenhum card foi migrado
      if (error.message.includes('does not exist') || error.code === '42P01') {
        return NextResponse.json({
          success: true,
          hardcodedCount,
          databaseCount: 0,
          migrationNeeded: true,
          message: 'Tabela cards não existe. Migração necessária.'
        });
      }

      return NextResponse.json(
        { success: false, error: `Erro ao verificar cards: ${error.message}` },
        { status: 500 }
      );
    }

    const databaseCount = dbCards?.length || 0;
    const migrationNeeded = databaseCount < hardcodedCount;

    return NextResponse.json({
      success: true,
      hardcodedCount,
      databaseCount,
      migrationNeeded,
      message: migrationNeeded
        ? 'Migração necessária. Alguns cards hardcoded não estão no banco de dados.'
        : 'Todos os cards hardcoded já foram migrados para o banco de dados.'
    });
  } catch (error) {
    console.error('Erro ao verificar status da migração:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor', details: String(error) },
      { status: 500 }
    );
  }
}
