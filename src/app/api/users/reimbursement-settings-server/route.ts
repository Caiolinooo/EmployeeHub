import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';

// POST - Atualizar configurações de email de reembolso de um usuário
export async function POST(request: NextRequest) {
  try {
    console.log('POST /api/users/reimbursement-settings-server - Iniciando processamento');

    // Verificar se o usuário é administrador
    const { isAdmin } = await import('@/lib/auth');
    const { isAdminFromRequest } = await import('@/lib/auth');
    const { userId: requestingUserId, isAdmin: userIsAdmin } = await isAdminFromRequest(request);

    if (!requestingUserId) {
      console.log('Usuário não autenticado');
      return NextResponse.json(
        { error: 'Usuário não autenticado' },
        { status: 401 }
      );
    }

    // Apenas administradores podem editar configurações de email de reembolso
    if (!userIsAdmin) {
      console.log('Acesso negado. Apenas administradores podem editar configurações de email de reembolso.');
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores podem editar configurações de email de reembolso.' },
        { status: 403 }
      );
    }

    console.log('Usuário autenticado:', requestingUserId, 'isAdmin:', userIsAdmin);

    // Obter dados do corpo da requisição
    const body = await request.json();
    console.log('Dados recebidos:', body);

    const { userId, email, enabled, recipients } = body;

    // Validar os dados de entrada
    if ((!userId && !email) || typeof enabled !== 'boolean' || !Array.isArray(recipients)) {
      console.error('Dados inválidos:', { userId, email, enabled, recipients });
      return NextResponse.json(
        { error: 'Dados inválidos' },
        { status: 400 }
      );
    }

    let userIdToUse = userId;

    // Se não tiver userId, buscar pelo email
    if (!userIdToUse && email) {
      try {
        const { data: userData, error: userError } = await supabaseAdmin
          .from('users_unified')
          .select('id')
          .eq('email', email)
          .single();

        if (userError) {
          console.error('Erro ao buscar usuário por email:', userError);
          return NextResponse.json(
            { error: `Usuário não encontrado: ${userError.message}` },
            { status: 404 }
          );
        }

        userIdToUse = userData.id;
        console.log(`Usuário encontrado pelo email ${email}: ${userIdToUse}`);
      } catch (error) {
        console.error('Erro ao buscar usuário:', error);
        return NextResponse.json(
          { error: 'Erro ao buscar usuário' },
          { status: 500 }
        );
      }
    }

    // Atualizar configurações do usuário
    try {
      const settings = { enabled, recipients };
      console.log(`Atualizando configurações para o usuário ${userIdToUse}:`, settings);

      try {
        const { data, error } = await supabaseAdmin
          .from('users_unified')
          .update({
            reimbursement_email_settings: settings,
            updated_at: new Date().toISOString()
          })
          .eq('id', userIdToUse)
          .select()
          .single();

        if (error) {
          console.error('Erro ao atualizar configurações:', error);

          // Se o erro for de coluna não existente, tentar adicionar a coluna
          if (error.code === '42703' && error.message.includes('reimbursement_email_settings')) {
            console.log('Coluna reimbursement_email_settings não existe, tentando adicionar...');

            // Tentar adicionar a coluna usando a API de setup
            try {
              const setupResponse = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL || ''}/api/setup-user-reimbursement-column`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                }
              });

              if (setupResponse.ok) {
                console.log('Coluna adicionada com sucesso, tentando atualizar novamente...');

                // Tentar atualizar novamente
                const { data: retryData, error: retryError } = await supabaseAdmin
                  .from('users_unified')
                  .update({
                    reimbursement_email_settings: settings,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', userIdToUse)
                  .select()
                  .single();

                if (!retryError) {
                  console.log('Configurações atualizadas com sucesso após adicionar coluna:', retryData);

                  return NextResponse.json({
                    success: true,
                    data: {
                      id: userIdToUse,
                      email: retryData.email || email || 'unknown',
                      reimbursement_email_settings: settings
                    }
                  });
                } else {
                  console.error('Erro ao atualizar configurações após adicionar coluna:', retryError);
                }
              } else {
                console.error('Erro ao adicionar coluna:', await setupResponse.text());
              }
            } catch (setupError) {
              console.error('Erro ao chamar API para adicionar coluna:', setupError);
            }

            // Usar API de fallback como último recurso
            try {
              console.log('Tentando usar API de fallback...');
              const fallbackResponse = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL || ''}/api/users/reimbursement-settings-local`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  userId: userIdToUse,
                  email,
                  enabled,
                  recipients
                })
              });

              if (fallbackResponse.ok) {
                const fallbackData = await fallbackResponse.json();
                console.log('Configurações salvas via API de fallback:', fallbackData);
                return NextResponse.json(fallbackData);
              } else {
                console.error('Erro ao usar API de fallback:', await fallbackResponse.text());
              }
            } catch (fallbackError) {
              console.error('Erro ao chamar API de fallback:', fallbackError);
            }

            // Retornar erro como último recurso
            return NextResponse.json(
              {
                error: `Erro ao atualizar configurações: ${error.message}`,
                note: 'Tentativas de adicionar coluna e usar fallback falharam'
              },
              { status: 500 }
            );
          }

          return NextResponse.json(
            { error: `Erro ao atualizar configurações: ${error.message}` },
            { status: 500 }
          );
        }

        console.log('Configurações atualizadas com sucesso:', data);

        // Retornar resultado
        return NextResponse.json({
          success: true,
          data: {
            id: userIdToUse,
            email: data.email || email || 'unknown',
            reimbursement_email_settings: settings
          }
        });
      } catch (updateError) {
        console.error('Erro ao executar atualização:', updateError);

        // Tentar usar API de fallback
        try {
          console.log('Tentando usar API de fallback após erro de atualização...');
          const fallbackResponse = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL || ''}/api/users/reimbursement-settings-local`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              userId: userIdToUse,
              email,
              enabled,
              recipients
            })
          });

          if (fallbackResponse.ok) {
            const fallbackData = await fallbackResponse.json();
            console.log('Configurações salvas via API de fallback:', fallbackData);
            return NextResponse.json(fallbackData);
          }
        } catch (fallbackError) {
          console.error('Erro ao chamar API de fallback:', fallbackError);
        }

        return NextResponse.json(
          { error: `Erro ao atualizar configurações: ${updateError instanceof Error ? updateError.message : String(updateError)}` },
          { status: 500 }
        );
      }
    } catch (error) {
      console.error('Erro ao atualizar configurações:', error);
      return NextResponse.json(
        { error: 'Erro ao atualizar configurações' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Erro ao processar requisição:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// GET - Obter configurações de email de reembolso de um usuário
export async function GET(request: NextRequest) {
  try {
    console.log('GET /api/users/reimbursement-settings-server - Iniciando processamento');

    // Obter ID do usuário da URL
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const email = searchParams.get('email');

    console.log('Parâmetros recebidos:', { userId, email });

    if (!userId && !email) {
      console.error('Nenhum parâmetro fornecido');
      return NextResponse.json(
        { error: 'É necessário fornecer userId ou email' },
        { status: 400 }
      );
    }

    // Buscar usuário - primeiro tentar sem a coluna reimbursement_email_settings
    let data: any = null;
    try {
      let query = supabaseAdmin
        .from('users_unified')
        .select('id, email');

      if (userId) {
        query = query.eq('id', userId);
      } else if (email) {
        query = query.eq('email', email);
      }

      const { data: queryData, error } = await query.single();

      if (error) {
        console.error('Erro ao buscar usuário:', error);

        // Se o usuário não for encontrado, retornar configurações padrão
        if (error.code === 'PGRST116') {
          console.log('Usuário não encontrado, retornando configurações padrão');
          return NextResponse.json({
            id: null,
            email: email || 'unknown',
            reimbursement_email_settings: {
              enabled: false,
              recipients: []
            },
            _note: 'Configurações padrão retornadas - usuário não encontrado'
          });
        }

        // Retornar configurações padrão para qualquer outro erro
        console.log('Erro ao buscar usuário, retornando configurações padrão');
        return NextResponse.json({
          id: null,
          email: email || 'unknown',
          reimbursement_email_settings: {
            enabled: false,
            recipients: []
          },
          _note: 'Configurações padrão retornadas devido a erro'
        });
      }

      data = queryData;

      // Tentar buscar configurações da coluna reimbursement_email_settings se existir
      try {
        const { data: settingsData, error: settingsError } = await supabaseAdmin
          .from('users_unified')
          .select('reimbursement_email_settings')
          .eq('id', data.id)
          .single();

        if (!settingsError && settingsData) {
          data.reimbursement_email_settings = settingsData.reimbursement_email_settings;
        }
      } catch (settingsErr) {
        console.log('Coluna reimbursement_email_settings não existe, usando configurações padrão');
      }

      // Retornar dados do usuário com configurações padrão se não existirem
      return NextResponse.json({
        id: data.id,
        email: data.email,
        reimbursement_email_settings: data.reimbursement_email_settings || {
          enabled: false,
          recipients: []
        }
      });
    } catch (queryError) {
      console.error('Erro ao executar consulta:', queryError);

      // Retornar configurações padrão em caso de erro
      return NextResponse.json({
        id: userId || null,
        email: email || 'unknown',
        reimbursement_email_settings: {
          enabled: false,
          recipients: []
        },
        _note: 'Configurações padrão retornadas devido a erro na consulta'
      });
    }

    console.log('Configurações encontradas:', data);

    // Retornar configurações
    // Adicionar cabeçalhos para evitar cache
    const headers = new Headers();
    headers.append('Cache-Control', 'no-cache, no-store, must-revalidate');
    headers.append('Pragma', 'no-cache');
    headers.append('Expires', '0');

    console.log('Retornando configurações para o usuário:', {
      id: data.id,
      email: data.email,
      settings: data.reimbursement_email_settings
    });

    return NextResponse.json({
      id: data.id,
      email: data.email,
      reimbursement_email_settings: data.reimbursement_email_settings || {
        enabled: false,
        recipients: []
      }
    }, { headers });
  } catch (error) {
    console.error('Erro ao processar requisição:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
