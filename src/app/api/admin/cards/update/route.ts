import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';
import { isAdminFromRequest } from '@/lib/auth';
import * as Icons from 'react-icons/fi';
import { IconType } from 'react-icons';

export const dynamic = 'force-dynamic';

// Função para converter cards do banco de dados para o formato da aplicação
function convertDatabaseCard(card: any) {
  // Converter o nome do ícone para o componente do ícone
  let icon: IconType = Icons.FiGrid;

  if (card.icon && typeof card.icon === 'string') {
    // Garantir que o nome do ícone esteja no formato correto (PascalCase)
    // Se o nome não começar com 'Fi', adicionar o prefixo
    const iconName = card.icon.startsWith('Fi') ? card.icon : `Fi${card.icon}`;

    // Verificar se o ícone existe no objeto Icons
    if (Icons[iconName as keyof typeof Icons]) {
      icon = Icons[iconName as keyof typeof Icons];
    } else {
      console.warn(`Ícone não encontrado: ${iconName}, usando FiGrid como fallback`);
      icon = Icons.FiGrid;
    }
  }

  return {
    id: card.id,
    title: card.title,
    description: card.description,
    href: card.href,
    icon: icon,
    color: card.color,
    hoverColor: card.hover_color,
    external: card.external,
    enabled: card.enabled,
    order: card.order,
    adminOnly: card.admin_only,
    managerOnly: card.manager_only,
    allowedRoles: card.allowed_roles,
    allowedUserIds: card.allowed_user_ids
  };
}

// POST - Atualizar um card existente
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

    // Obter os dados do card do corpo da requisição
    const body = await request.json();
    const id = body.id;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID do card não fornecido' },
        { status: 400 }
      );
    }

    console.log(`Atualizando card com ID: ${id}`, body);
    console.log('adminOnly:', body.adminOnly);

    // Verificar se o card existe
    const { data: existingCard, error: checkError } = await supabaseAdmin
      .from('cards')
      .select('id')
      .eq('id', id)
      .single();

    // Se o card não existir no banco de dados, pode ser um card hardcoded
    // Vamos tentar migrar o card para o banco de dados primeiro
    if (checkError) {
      console.log('Card não encontrado no banco de dados. Verificando se é um card hardcoded...');

      // Tentar migrar o card específico para o banco de dados
      try {
        // Processar o ícone primeiro para evitar o erro de referência
        // Verificar se o ícone é um objeto (componente React) e extrair o nome
        let migrationIconName = 'FiGrid';
        if (body.icon) {
          if (typeof body.icon === 'string') {
            migrationIconName = body.icon.startsWith('Fi') ? body.icon : `Fi${body.icon}`;
          } else if (typeof body.icon === 'object' && body.icon.displayName) {
            migrationIconName = body.icon.displayName;
          }
        }

        console.log(`Ícone para migração: ${migrationIconName}`);

        // Preparar os dados para inserção
        const cardToInsert = {
          id: body.id,
          title: body.title,
          description: body.description || '',
          href: body.href,
          icon: migrationIconName,
          color: body.color || 'blue',
          hover_color: body.hoverColor || 'blue',
          enabled: body.enabled !== undefined ? body.enabled : true,
          order: body.order || 0,
          admin_only: body.adminOnly !== undefined ? body.adminOnly : false,
          manager_only: body.managerOnly !== undefined ? body.managerOnly : false,
          external: body.external !== undefined ? body.external : false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        console.log('Tentando inserir card no banco de dados:', cardToInsert);

        // Inserir o card no banco de dados
        try {
          const { data: insertedCard, error: insertError } = await supabaseAdmin
            .from('cards')
            .insert(cardToInsert)
            .select()
            .single();

          if (insertError) {
            // Se o erro for que a tabela não existe, tentar criar a tabela primeiro
            if (insertError.message.includes('does not exist') || insertError.code === '42P01') {
              console.log('Tabela cards não existe, tentando criar a tabela...');

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
                // Tentar executar SQL diretamente
                const { error: sqlError } = await supabaseAdmin.rpc('execute_sql', {
                  sql: createTableSQL
                });

                if (sqlError) {
                  console.error('Erro ao criar tabela usando SQL:', sqlError);
                  throw sqlError;
                }

                // Tentar inserir o card novamente após criar a tabela
                const { data: retryCard, error: retryError } = await supabaseAdmin
                  .from('cards')
                  .insert(cardToInsert)
                  .select()
                  .single();

                if (retryError) {
                  console.error('Erro ao inserir card após criar tabela:', retryError);
                  throw retryError;
                }

                console.log('Card inserido com sucesso após criar tabela:', retryCard);

                // Converter o card inserido para o formato da aplicação
                const formattedCard = convertDatabaseCard(retryCard);

                return NextResponse.json({
                  success: true,
                  card: formattedCard,
                  message: 'Tabela criada e card migrado com sucesso'
                });
              } catch (tableError) {
                console.error('Erro ao criar tabela ou inserir card:', tableError);
                return NextResponse.json(
                  { success: false, error: 'Erro ao criar tabela ou inserir card', details: String(tableError) },
                  { status: 500 }
                );
              }
            } else {
              console.error('Erro ao inserir card no banco de dados:', insertError);
              return NextResponse.json(
                { success: false, error: 'Card não encontrado e não foi possível migrá-lo para o banco de dados', details: insertError.message },
                { status: 404 }
              );
            }
          }

          // Se chegou aqui, o card foi inserido com sucesso
          console.log('Card migrado com sucesso para o banco de dados:', insertedCard);

          // Converter o card inserido para o formato da aplicação
          const formattedCard = convertDatabaseCard(insertedCard);

          return NextResponse.json({
            success: true,
            card: formattedCard,
            message: 'Card migrado e atualizado com sucesso'
          });
        } catch (migrationError) {
          console.error('Erro ao migrar card para o banco de dados:', migrationError);
          return NextResponse.json(
            { success: false, error: 'Card não encontrado e ocorreu um erro ao migrá-lo para o banco de dados' },
            { status: 404 }
          );
        }
      } catch (migrationError) {
        console.error('Erro ao migrar card para o banco de dados:', migrationError);
        return NextResponse.json(
          { success: false, error: 'Card não encontrado e ocorreu um erro ao migrá-lo para o banco de dados' },
          { status: 404 }
        );
      }
    }

    // Preparar os dados para atualização
    // Verificar se o ícone é um objeto (componente React) e extrair o nome
    let iconName = 'FiGrid';
    if (body.icon) {
      if (typeof body.icon === 'string') {
        iconName = body.icon.startsWith('Fi') ? body.icon : `Fi${body.icon}`;
      } else if (typeof body.icon === 'object' && body.icon.displayName) {
        iconName = body.icon.displayName;
      }
    }

    console.log(`Ícone para atualização: ${iconName}`);
    console.log('adminOnly antes da atualização:', body.adminOnly);

    // Atualizar o card usando Supabase
    const { data: updatedCard, error } = await supabaseAdmin
      .from('cards')
      .update({
        title: body.title,
        description: body.description || '',
        href: body.href,
        icon: iconName,
        color: body.color || 'blue',
        hover_color: body.hoverColor || 'blue', // Nota: Supabase usa snake_case
        enabled: body.enabled !== undefined ? body.enabled : true,
        order: body.order || 0,
        admin_only: body.adminOnly !== undefined ? body.adminOnly : false, // Nota: Supabase usa snake_case
        manager_only: body.managerOnly !== undefined ? body.managerOnly : false,
        external: body.external !== undefined ? body.external : false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar card no Supabase:', error);
      return NextResponse.json(
        { success: false, error: `Erro ao atualizar card: ${error.message}` },
        { status: 500 }
      );
    }

    // Converter o card atualizado para o formato da aplicação
    const formattedCard = convertDatabaseCard(updatedCard);

    console.log('Card atualizado com sucesso:', formattedCard.id);
    console.log('adminOnly após atualização:', formattedCard.adminOnly);

    return NextResponse.json({
      success: true,
      card: formattedCard
    });
  } catch (error) {
    console.error('Erro ao atualizar card:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor', details: String(error) },
      { status: 500 }
    );
  }
}
