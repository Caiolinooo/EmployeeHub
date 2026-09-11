import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

// GET - Obter um usuário específico
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verificar autenticação
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader || undefined);

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { success: false, error: 'Token inválido ou expirado' },
        { status: 401 }
      );
    }

    // Obter o ID do usuário dos parâmetros da rota
    const { id: userId } = await params;

    // Buscar o usuário - dados básicos para qualquer usuário autenticado
    const { data: user, error: fetchError } = await supabaseAdmin
      .from('users_unified')
      .select('id, name, email, first_name, last_name, role, position, department, sector_id, phone_number, avatar, drive_photo_url, startup_splash_enabled, startup_splash_url, startup_sound_enabled, startup_sound_url')
      .eq('id', userId)
      .single();

    if (fetchError || !user) {
      return NextResponse.json(
        { success: false, error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // Mapear para camelCase para corresponder à interface User
    const mappedUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      position: user.position,
      department: user.department,
      sector_id: user.sector_id,
      avatar: user.avatar,
      drive_photo_url: user.drive_photo_url,
      phoneNumber: user.phone_number as string,
      startup_splash_enabled: user.startup_splash_enabled || false,
      startup_splash_url: user.startup_splash_url || '',
      startup_sound_enabled: user.startup_sound_enabled || false,
      startup_sound_url: user.startup_sound_url || ''
    };

    // Retornar dados básicos
    return NextResponse.json({
      success: true,
      data: mappedUser
    });
  } catch (error) {
    console.error('Erro ao obter usuário:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// PUT - Atualizar um usuário
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
      .select('id, role, first_name, last_name, email, phone_number, access_history')
      .eq('id', payload.userId)
      .single();

    if (userError || !requestingUser || requestingUser.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores podem atualizar usuários.' },
        { status: 403 }
      );
    }

    // Obter o ID do usuário dos parâmetros da rota
    const { id: userId } = await params;

    // Obter os dados do corpo da requisição
    const body = await request.json();
    console.log('Dados recebidos para atualização:', JSON.stringify(body, null, 2));

    const {
      firstName,
      lastName,
      email,
      phoneNumber,
      role,
      position,
      department,
      sector_id,
      active,
      accessPermissions,
      password,
      startup_splash_enabled,
      startup_splash_url,
      startup_sound_enabled,
      startup_sound_url,
      startupSplashEnabled,
      startupSplashUrl,
      startupSoundEnabled,
      startupSoundUrl
    } = body;

    console.log('Campo phoneNumber extraído:', phoneNumber);

    // Validar os dados
    if (!firstName || !lastName) {
      return NextResponse.json(
        { error: 'Nome e sobrenome são obrigatórios' },
        { status: 400 }
      );
    }

    // Buscar o usuário
    const { data: user, error: fetchError } = await supabaseAdmin
      .from('users_unified')
      .select('*')
      .eq('id', userId)
      .single();

    if (fetchError || !user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // Preparar os dados para atualização
    const now = new Date().toISOString();
    const updateData: any = {
      first_name: firstName,
      last_name: lastName,
      email,
      phone_number: phoneNumber,
      role: ['ADMIN', 'USER', 'MANAGER'].includes(role) ? role : user.role,
      position,
      department,
      sector_id,
      updated_at: now
    };

    if (startup_splash_enabled !== undefined || startupSplashEnabled !== undefined) {
      updateData.startup_splash_enabled = startup_splash_enabled !== undefined ? !!startup_splash_enabled : !!startupSplashEnabled;
    }
    if (startup_splash_url !== undefined || startupSplashUrl !== undefined) {
      const url = startup_splash_url !== undefined ? startup_splash_url : startupSplashUrl;
      updateData.startup_splash_url = url ? url : null;
    }
    if (startup_sound_enabled !== undefined || startupSoundEnabled !== undefined) {
      updateData.startup_sound_enabled = startup_sound_enabled !== undefined ? !!startup_sound_enabled : !!startupSoundEnabled;
    }
    if (startup_sound_url !== undefined || startupSoundUrl !== undefined) {
      const url = startup_sound_url !== undefined ? startup_sound_url : startupSoundUrl;
      updateData.startup_sound_url = url ? url : null;
    }

    console.log('Dados preparados para atualização:', JSON.stringify(updateData, null, 2));

    if (active !== undefined) {
      updateData.active = active;
    }

    if (accessPermissions) {
      updateData.access_permissions = accessPermissions;
    }

    if (password) {
      // Gerar hash da senha
      const hashed = await bcrypt.hash(password, 10);
      updateData.password = hashed;
      updateData.password_hash = hashed;
      updateData.password_last_changed = now;
    }

    // Obter o histórico de acesso atual
    const accessHistory = user.access_history || [];

    // Adicionar novo registro ao histórico
    updateData.access_history = [
      ...accessHistory,
      {
        timestamp: now,
        action: 'UPDATED',
        details: `Usuário atualizado por ${requestingUser.first_name} ${requestingUser.last_name}`
      }
    ];

    // Atualizar o usuário
    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from('users_unified')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('Erro ao atualizar usuário:', updateError);
      return NextResponse.json(
        { error: `Erro ao atualizar usuário: ${updateError.message}` },
        { status: 500 }
      );
    }

    // Registrar a ação no histórico do administrador
    const adminAccessHistory = requestingUser.access_history || [];
    const { error: adminUpdateError } = await supabaseAdmin
      .from('users_unified')
      .update({
        access_history: [
          ...adminAccessHistory,
          {
            timestamp: now,
            action: 'UPDATE_USER',
            details: `Atualizou o usuário ${user.first_name} ${user.last_name}`
          }
        ],
        updated_at: now
      })
      .eq('id', requestingUser.id);

    if (adminUpdateError) {
      console.error('Erro ao atualizar histórico do administrador:', adminUpdateError);
    }

    // Mapear os campos para o formato esperado pelo cliente
    const userResponse = {
      id: updatedUser.id,
      phoneNumber: updatedUser.phone_number,
      firstName: updatedUser.first_name,
      lastName: updatedUser.last_name,
      email: updatedUser.email,
      role: updatedUser.role,
      position: updatedUser.position,
      department: updatedUser.department,
      active: updatedUser.active,
      createdAt: updatedUser.created_at,
      updatedAt: updatedUser.updated_at,
      accessHistory: updatedUser.access_history,
      accessPermissions: updatedUser.access_permissions
    };

    return NextResponse.json(userResponse);
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// DELETE - Excluir um usuário
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
      .select('id, role, first_name, last_name, email, phone_number, access_history')
      .eq('id', payload.userId)
      .single();

    if (userError || !requestingUser || requestingUser.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores podem excluir usuários.' },
        { status: 403 }
      );
    }

    // Obter o ID do usuário dos parâmetros da rota
    const { id: userId } = await params;

    // Não permitir excluir o próprio usuário
    if (userId === payload.userId) {
      return NextResponse.json(
        { error: 'Não é possível excluir o próprio usuário' },
        { status: 400 }
      );
    }

    // Buscar o usuário
    const { data: user, error: fetchError } = await supabaseAdmin
      .from('users_unified')
      .select('*')
      .eq('id', userId)
      .single();

    if (fetchError || !user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // Armazenar informações do usuário para o log
    const userInfo = `${user.first_name} ${user.last_name} (${user.phone_number})`;

    // Remover avaliações onde o usuário é funcionário ou avaliador
    const { error: deleteAvaliacoesError } = await supabaseAdmin
      .from('avaliacoes_desempenho')
      .delete()
      .or(`funcionario_id.eq.${userId},avaliador_id.eq.${userId}`);

    if (deleteAvaliacoesError) {
      console.error('Erro ao remover avaliações do usuário:', deleteAvaliacoesError);
    }

    // Remover mapeamentos de gerentes
    const { error: deleteMapeamentosError } = await supabaseAdmin
      .from('avaliacao_colaborador_gerente')
      .delete()
      .or(`colaborador_id.eq.${userId},gerente_id.eq.${userId}`);

    if (deleteMapeamentosError) {
      console.error('Erro ao remover mapeamentos de gerentes:', deleteMapeamentosError);
    }

    // Banir usuário automaticamente ao excluir
    const { error: banError } = await supabaseAdmin
      .from('banned_users')
      .insert({
        email: user.email,
        phone_number: user.phone_number,
        cpf: user.cpf || user.tax_id, // Usar tax_id se cpf não estiver disponível direto
        first_name: user.first_name,
        last_name: user.last_name,
        banned_by: requestingUser.id,
        ban_reason: 'Usuário excluído do sistema (Banimento Automático)',
        original_user_id: user.id,
        banned_at: new Date().toISOString()
      });

    if (banError) {
      console.error('Erro ao banir usuário automaticamente:', banError);
      // Não impedir a exclusão, mas logar o erro
    } else {
      console.log(`Usuário ${userInfo} banido automaticamente após exclusão`);
    }

    // Excluir o usuário
    const { error: deleteError } = await supabaseAdmin
      .from('users_unified')
      .delete()
      .eq('id', userId);

    if (deleteError) {
      console.error('Erro ao excluir usuário:', deleteError);
      return NextResponse.json(
        { error: `Erro ao excluir usuário: ${deleteError.message}` },
        { status: 500 }
      );
    }

    // Registrar a ação no histórico do administrador
    const now = new Date().toISOString();
    const adminAccessHistory = requestingUser.access_history || [];
    const { error: adminUpdateError } = await supabaseAdmin
      .from('users_unified')
      .update({
        access_history: [
          ...adminAccessHistory,
          {
            timestamp: now,
            action: 'DELETE_USER',
            details: `Excluiu o usuário ${userInfo}`
          }
        ],
        updated_at: now
      })
      .eq('id', requestingUser.id);

    if (adminUpdateError) {
      console.error('Erro ao atualizar histórico do administrador:', adminUpdateError);
    }

    return NextResponse.json({
      success: true,
      message: 'Usuário excluído com sucesso'
    });
  } catch (error) {
    console.error('Erro ao excluir usuário:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
