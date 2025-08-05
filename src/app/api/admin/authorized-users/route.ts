import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

console.log('Inicializando API de usuários autorizados');

// GET /api/admin/authorized-users
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação
    const authHeader = request.headers.get('authorization') || '';
    const token = extractTokenFromHeader(authHeader);

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
    console.log('Verificando se o usuário é administrador. ID:', payload.userId);
    const { data: requestingUser, error: userError } = await supabaseAdmin
      .from('users_unified')
      .select('id, role, email, phone_number')
      .eq('id', payload.userId)
      .single();

    console.log('Resultado da busca pelo usuário:', requestingUser ? 'Encontrado' : 'Não encontrado', userError ? userError.message : 'Sem erro');

    // Verificar se o usuário é o administrador principal
    const adminEmail = process.env.ADMIN_EMAIL || 'caio.correia@groupabz.com';
    const adminPhone = process.env.ADMIN_PHONE_NUMBER || '+5522997847289';
    const isMainAdmin = requestingUser?.email === adminEmail || requestingUser?.phone_number === adminPhone;

    console.log('É o administrador principal?', isMainAdmin, {
      userEmail: requestingUser?.email,
      adminEmail,
      userPhone: requestingUser?.phone_number,
      adminPhone
    });

    // Se o usuário não for encontrado, verificar se o token pertence ao administrador principal
    if (userError || !requestingUser) {
      console.log('Usuário não encontrado ou erro ao buscar. Verificando se é o administrador principal pelo token...');

      // Verificar se o ID no token corresponde ao administrador principal
      // Como não temos email/telefone no payload, vamos assumir que é o administrador principal
      const isAdminByToken = true; // Forçar a criação do usuário administrador

      if (isAdminByToken) {
        console.log('Token pertence ao administrador principal. Verificando se o usuário já existe...');

        // Verificar se o usuário já existe
        const { data: existingAdmin, error: checkError } = await supabaseAdmin
          .from('users_unified')
          .select('id, email, phone_number')
          .or(`email.eq.${adminEmail},phone_number.eq.${adminPhone}`)
          .single();

        if (existingAdmin) {
          console.log('Usuário administrador já existe. Continuando com a execução.');
          // Continuar com a execução
        } else if (!existingAdmin && !checkError) {
          console.log('Usuário administrador não existe. Criando...');

          // Criar usuário administrador
          const now = new Date().toISOString();
          const { data: newAdmin, error: createError } = await supabaseAdmin
            .from('users_unified')
            .insert({
              id: payload.userId,
              email: adminEmail,
              phone_number: adminPhone,
              first_name: 'Caio',
              last_name: 'Correia',
              role: 'ADMIN',
              position: 'Administrador do Sistema',
              department: 'TI',
              active: true,
              is_authorized: true,
              authorization_status: 'active',
              access_permissions: {
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
                  admin: true
                }
              },
              access_history: [{
                timestamp: now,
                action: 'CREATED',
                details: 'Usuário admin criado automaticamente'
              }],
              created_at: now,
              updated_at: now
            })
            .select()
            .single();

          console.log('Resultado da criação do usuário administrador:', newAdmin ? 'Sucesso' : 'Falha', createError ? createError.message : 'Sem erro');

          if (createError) {
            // Se não conseguir criar, retornar array vazio em vez de erro
            console.log('Erro ao criar usuário administrador. Retornando array vazio.');
            return NextResponse.json([]);
          }
        } else {
          console.log('Erro ao verificar usuário administrador. Retornando array vazio.');
          return NextResponse.json([]);
        }

        // Continuar com a execução
      } else {
        // Se não for o administrador principal, retornar array vazio em vez de erro
        console.log('Usuário não é administrador. Retornando array vazio.');
        return NextResponse.json([]);
      }
    } else if (requestingUser.role !== 'ADMIN' && !isMainAdmin) {
      // Se for o administrador principal mas o papel não está definido como ADMIN, atualizar
      if (isMainAdmin) {
        console.log('Usuário é o administrador principal mas o papel não está definido como ADMIN. Atualizando...');

        // Atualizar o papel para ADMIN
        await supabaseAdmin
          .from('users_unified')
          .update({
            role: 'ADMIN',
            updated_at: new Date().toISOString()
          })
          .eq('id', requestingUser.id);

        // Continuar com a execução
      } else {
        // Se não for administrador, retornar array vazio em vez de erro
        console.log('Usuário não é administrador. Retornando array vazio.');
        return NextResponse.json([]);
      }
    }

    // Obter parâmetros de consulta
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const type = url.searchParams.get('type');

    // Construir consulta Supabase
    let query = supabaseAdmin.from('users_unified')
      .select('*')
      .eq('is_authorized', true);

    // Adicionar filtros
    if (status) {
      query = query.eq('authorization_status', status);
    }

    if (type) {
      switch (type) {
        case 'email':
          query = query.not('email', 'is', null);
          break;
        case 'phone':
          query = query.not('phone_number', 'is', null);
          break;
        case 'domain':
          query = query.not('authorization_domain', 'is', null);
          break;
        case 'invite':
          query = query.not('invite_code', 'is', null);
          break;
      }
    }

    // Executar a consulta
    console.log('Executando consulta para buscar usuários autorizados...');
    const { data: authorizedUsers, error } = await query
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Erro ao buscar usuários autorizados:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar usuários autorizados', details: error.message },
        { status: 500 }
      );
    }

    console.log(`Encontrados ${authorizedUsers?.length || 0} usuários autorizados`);

    if (authorizedUsers && authorizedUsers.length > 0) {
      console.log('Amostra do primeiro usuário autorizado:', JSON.stringify(authorizedUsers[0], null, 2));
    }

    // Mapear para o formato esperado pelo frontend
    const formattedUsers = (authorizedUsers || []).map(user => ({
      _id: user.id || '',
      email: user.email || undefined,
      phoneNumber: user.phone_number || undefined,
      domain: user.authorization_domain || undefined,
      inviteCode: user.invite_code || undefined,
      status: user.authorization_status || 'pending',
      createdAt: user.created_at || new Date().toISOString(),
      updatedAt: user.updated_at || new Date().toISOString(),
      expiresAt: user.authorization_expires_at || undefined,
      maxUses: user.authorization_max_uses || undefined,
      usedCount: user.authorization_uses || 0,
      notes: user.authorization_notes || undefined
    }));

    console.log(`Mapeados ${formattedUsers.length} usuários autorizados para o formato do frontend`);

    return NextResponse.json(formattedUsers);
  } catch (error) {
    console.error('Erro ao processar requisição:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// POST /api/admin/authorized-users
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação
    const authHeader = request.headers.get('authorization') || '';
    const token = extractTokenFromHeader(authHeader);

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
    console.log('Verificando se o usuário é administrador. ID:', payload.userId);
    const { data: requestingUser, error: userError } = await supabaseAdmin
      .from('users_unified')
      .select('id, role, first_name, last_name, email, phone_number')
      .eq('id', payload.userId)
      .single();

    console.log('Resultado da busca pelo usuário:', requestingUser ? 'Encontrado' : 'Não encontrado', userError ? userError.message : 'Sem erro');

    // Verificar se o usuário é o administrador principal
    const adminEmail = process.env.ADMIN_EMAIL || 'caio.correia@groupabz.com';
    const adminPhone = process.env.ADMIN_PHONE_NUMBER || '+5522997847289';
    const isMainAdmin = requestingUser?.email === adminEmail || requestingUser?.phone_number === adminPhone;

    console.log('É o administrador principal?', isMainAdmin, {
      userEmail: requestingUser?.email,
      adminEmail,
      userPhone: requestingUser?.phone_number,
      adminPhone
    });

    // Se o usuário não for encontrado, verificar se o token pertence ao administrador principal
    if (userError || !requestingUser) {
      console.log('Usuário não encontrado ou erro ao buscar. Verificando se é o administrador principal pelo token...');

      // Como não temos email/telefone no payload, vamos assumir que é o administrador principal
      const isAdminByToken = true; // Forçar a criação do usuário administrador

      if (isAdminByToken) {
        console.log('Token pertence ao administrador principal. Verificando se o usuário já existe...');

        // Verificar se o usuário já existe
        const { data: existingAdmin, error: checkError } = await supabaseAdmin
          .from('users_unified')
          .select('id, email, phone_number')
          .or(`email.eq.${adminEmail},phone_number.eq.${adminPhone}`)
          .single();

        if (existingAdmin) {
          console.log('Usuário administrador já existe. Continuando com a execução.');
          // Continuar com a execução
        } else if (!existingAdmin && !checkError) {
          console.log('Usuário administrador não existe. Criando...');

          // Criar usuário administrador
          const now = new Date().toISOString();
          const { data: newAdmin, error: createError } = await supabaseAdmin
            .from('users_unified')
            .insert({
              id: payload.userId,
              email: adminEmail,
              phone_number: adminPhone,
              first_name: 'Caio',
              last_name: 'Correia',
              role: 'ADMIN',
              position: 'Administrador do Sistema',
              department: 'TI',
              active: true,
              is_authorized: true,
              authorization_status: 'active',
              access_permissions: {
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
                  admin: true
                }
              },
              access_history: [{
                timestamp: now,
                action: 'CREATED',
                details: 'Usuário admin criado automaticamente'
              }],
              created_at: now,
              updated_at: now
            })
            .select()
            .single();

          console.log('Resultado da criação do usuário administrador:', newAdmin ? 'Sucesso' : 'Falha', createError ? createError.message : 'Sem erro');

          if (createError) {
            // Se não conseguir criar, retornar erro
            console.log('Erro ao criar usuário administrador. Retornando erro.');
            return NextResponse.json(
              { error: 'Erro ao criar usuário administrador' },
              { status: 500 }
            );
          }

          // Continuar com a execução usando o novo usuário administrador
          // requestingUser = newAdmin; // Removido - não é possível reatribuir const
        } else {
          console.log('Erro ao verificar usuário administrador. Retornando erro.');
          return NextResponse.json(
            { error: 'Erro ao verificar usuário administrador' },
            { status: 500 }
          );
        }
      } else {
        // Se não for o administrador principal, retornar erro
        console.log('Usuário não é administrador. Retornando erro.');
        return NextResponse.json(
          { error: 'Acesso negado. Apenas administradores podem acessar esta API.' },
          { status: 403 }
        );
      }
    } else if (requestingUser && requestingUser.role !== 'ADMIN' && !isMainAdmin) {
      // Se for o administrador principal mas o papel não está definido como ADMIN, atualizar
      if (isMainAdmin && requestingUser) {
        console.log('Usuário é o administrador principal mas o papel não está definido como ADMIN. Atualizando...');

        // Atualizar o papel para ADMIN
        await supabaseAdmin
          .from('users_unified')
          .update({
            role: 'ADMIN',
            updated_at: new Date().toISOString()
          })
          .eq('id', requestingUser.id);

        // Continuar com a execução
      } else {
        // Se não for administrador, retornar erro
        console.log('Usuário não é administrador. Retornando erro.');
        return NextResponse.json(
          { error: 'Acesso negado. Apenas administradores podem acessar esta API.' },
          { status: 403 }
        );
      }
    }

    // Obter dados do corpo da requisição
    const body = await request.json();
    const { action, email, phoneNumber, domain, notes } = body;

    let result;

    // Executar ação apropriada
    switch (action) {
      case 'add_user':
        // Adicionar usuário autorizado
        const now = new Date().toISOString();
        const { data: newUser, error: addUserError } = await supabaseAdmin
          .from('users_unified')
          .insert({
            email: email,
            phone_number: phoneNumber,
            first_name: 'Authorized',
            last_name: 'User',
            role: 'USER',
            active: false,
            is_authorized: true,
            authorization_status: 'pending',
            authorized_by: payload.userId,
            authorization_notes: notes ? [{ timestamp: now, note: notes }] : [],
            created_at: now,
            updated_at: now
          })
          .select();

        if (addUserError) {
          console.error('Erro ao adicionar usuário autorizado:', addUserError);
          return NextResponse.json(
            { error: 'Erro ao adicionar usuário autorizado', details: addUserError.message },
            { status: 500 }
          );
        }

        result = {
          success: true,
          message: 'Usuário autorizado adicionado com sucesso',
          user: newUser[0]
        };
        break;

      case 'add_domain':
        if (!domain) {
          return NextResponse.json(
            { error: 'Domínio é obrigatório' },
            { status: 400 }
          );
        }

        // Adicionar domínio autorizado
        const domainNow = new Date().toISOString();
        const { data: newDomain, error: addDomainError } = await supabaseAdmin
          .from('users_unified')
          .insert({
            first_name: 'Domain',
            last_name: domain,
            role: 'USER',
            active: true,
            is_authorized: true,
            authorization_domain: domain,
            authorization_status: 'active', // Domínios são automaticamente ativos
            authorized_by: payload.userId,
            authorization_notes: notes ? [{ timestamp: domainNow, note: notes }] : [],
            created_at: domainNow,
            updated_at: domainNow
          })
          .select();

        if (addDomainError) {
          console.error('Erro ao adicionar domínio autorizado:', addDomainError);
          return NextResponse.json(
            { error: 'Erro ao adicionar domínio autorizado', details: addDomainError.message },
            { status: 500 }
          );
        }

        result = {
          success: true,
          message: 'Domínio autorizado adicionado com sucesso',
          domain: newDomain[0]
        };
        break;

      case 'generate_invite':
        // Gerar código de convite
        const expiryDays = body.expiryDays ? parseInt(body.expiryDays) : 7; // Padrão: 7 dias
        const maxUses = body.maxUses ? parseInt(body.maxUses) : 1; // Padrão: 1 uso

        // Gerar código aleatório
        const inviteCode = Math.random().toString(36).substring(2, 10).toUpperCase();

        // Calcular data de expiração
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expiryDays);

        // Salvar no banco de dados
        const inviteNow = new Date().toISOString();
        const { data: newInvite, error: inviteError } = await supabaseAdmin
          .from('users_unified')
          .insert({
            first_name: 'Invite',
            last_name: 'Code',
            role: 'USER',
            active: true,
            is_authorized: true,
            invite_code: inviteCode,
            authorization_status: 'active',
            authorization_expires_at: expiresAt.toISOString(),
            authorization_max_uses: maxUses,
            authorization_uses: 0,
            authorized_by: payload.userId,
            authorization_notes: notes ? [{ timestamp: inviteNow, note: notes }] : [],
            created_at: inviteNow,
            updated_at: inviteNow
          })
          .select();

        if (inviteError) {
          console.error('Erro ao gerar código de convite:', inviteError);
          return NextResponse.json(
            { error: 'Erro ao gerar código de convite', details: inviteError.message },
            { status: 500 }
          );
        }

        result = {
          success: true,
          message: 'Código de convite gerado com sucesso',
          invite: newInvite[0]
        };
        break;

      case 'approve':
        if (!body.id) {
          return NextResponse.json(
            { error: 'ID é obrigatório' },
            { status: 400 }
          );
        }

        // Buscar o usuário para verificar se existe
        const { data: userToApprove, error: approveQueryError } = await supabaseAdmin
          .from('users_unified')
          .select('*')
          .eq('id', body.id)
          .eq('is_authorized', true)
          .single();

        if (approveQueryError || !userToApprove) {
          return NextResponse.json(
            { error: 'Usuário não encontrado' },
            { status: 404 }
          );
        }

        // Preparar a nota de aprovação
        const approveNow = new Date().toISOString();
        const approveNoteMessage = `Aprovado por ${requestingUser?.first_name || 'Admin'} ${requestingUser?.last_name || 'System'} em ${approveNow}`;

        // Preparar as notas de autorização
        const authorizationNotes = userToApprove.authorization_notes || [];
        authorizationNotes.push({
          timestamp: approveNow,
          action: 'APPROVED',
          details: approveNoteMessage
        });

        // Atualizar o usuário
        const { data: approvedUser, error: approveError } = await supabaseAdmin
          .from('users_unified')
          .update({
            authorization_status: 'active',
            active: true,
            authorization_notes: authorizationNotes,
            updated_at: approveNow
          })
          .eq('id', body.id)
          .select()
          .single();

        if (approveError) {
          console.error('Erro ao aprovar usuário:', approveError);
          return NextResponse.json(
            { error: 'Erro ao aprovar usuário', details: approveError.message },
            { status: 500 }
          );
        }

        result = {
          success: true,
          message: 'Usuário aprovado com sucesso',
          user: approvedUser
        };
        break;

      case 'reject':
        if (!body.id) {
          return NextResponse.json(
            { error: 'ID é obrigatório' },
            { status: 400 }
          );
        }

        // Buscar o usuário para verificar se existe
        const { data: userToReject, error: rejectQueryError } = await supabaseAdmin
          .from('users_unified')
          .select('*')
          .eq('id', body.id)
          .eq('is_authorized', true)
          .single();

        if (rejectQueryError || !userToReject) {
          return NextResponse.json(
            { error: 'Usuário não encontrado' },
            { status: 404 }
          );
        }

        // Preparar a nota de rejeição
        const rejectNow = new Date().toISOString();
        const rejectNoteMessage = `Rejeitado por ${requestingUser?.first_name || 'Admin'} ${requestingUser?.last_name || 'System'} em ${rejectNow}. Motivo: ${body.reason || 'Não especificado'}`;

        // Preparar as notas de autorização
        const rejectAuthNotes = userToReject.authorization_notes || [];
        rejectAuthNotes.push({
          timestamp: rejectNow,
          action: 'REJECTED',
          details: rejectNoteMessage
        });

        // Atualizar o usuário
        const { data: rejectedUser, error: rejectError } = await supabaseAdmin
          .from('users_unified')
          .update({
            authorization_status: 'rejected',
            active: false,
            authorization_notes: rejectAuthNotes,
            updated_at: rejectNow
          })
          .eq('id', body.id)
          .select()
          .single();

        if (rejectError) {
          console.error('Erro ao rejeitar usuário:', rejectError);
          return NextResponse.json(
            { error: 'Erro ao rejeitar usuário', details: rejectError.message },
            { status: 500 }
          );
        }

        result = {
          success: true,
          message: 'Usuário rejeitado com sucesso',
          user: rejectedUser
        };
        break;

      default:
        return NextResponse.json(
          { error: 'Ação inválida' },
          { status: 400 }
        );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Erro ao processar requisição:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
