import { NextRequest, NextResponse } from 'next/server';
import { sendVerificationEmail } from '@/lib/email';
import { sendNewUserWelcomeEmail, sendAdminNotificationEmail } from '@/lib/notifications';
import bcrypt from 'bcryptjs';
import { supabaseAdmin as supabase } from '@/lib/supabase';

// Função para gerar número de protocolo
function generateProtocolNumber() {
  const date = new Date();
  const year = date.getFullYear().toString().slice(2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `REG-${year}${month}${day}-${random}`;
}

// Função para gerar código de verificação
function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      email,
      phoneNumber,
      firstName,
      lastName,
      cpf,
      position,
      password,
      inviteCode
    } = body;

    console.log('Dados recebidos para registro rápido:', {
      email,
      phoneNumber,
      firstName,
      lastName,
      hasPassword: !!password,
      hasInviteCode: !!inviteCode
    });

    // Validar os dados de entrada
    if ((!email && !phoneNumber) || !firstName || !lastName || !cpf || !position || !password) {
      return NextResponse.json(
        { error: 'Todos os campos obrigatórios devem ser preenchidos (nome, sobrenome, CPF, cargo, telefone/email e senha)' },
        { status: 400 }
      );
    }

    // Validar formato do CPF
    if (cpf && cpf.replace(/\D/g, '').length !== 11) {
      return NextResponse.json(
        { error: 'CPF deve ter 11 dígitos' },
        { status: 400 }
      );
    }

    // Verificar se o usuário já existe
    let existingUser = null;
    let emailError = null;
    let phoneError = null;

    if (email) {
      const { data, error } = await supabase
        .from('users_unified')
        .select('*')
        .eq('email', email)
        .single();

      existingUser = data;
      emailError = error;
    }

    if (phoneNumber && !existingUser) {
      const { data, error } = await supabase
        .from('users_unified')
        .select('*')
        .eq('phone_number', phoneNumber)
        .single();

      existingUser = data;
      phoneError = error;
    }

    // Se o usuário existe, verificar se pode completar o registro
    if (existingUser) {
      // Verificar se é um registro incompleto (sem senha ou pendente)
      const isIncompleteRegistration = !existingUser.password_hash && 
                                      (existingUser.authorization_status === 'pending' || !existingUser.active);
      
      if (isIncompleteRegistration) {
        console.log('Completando registro de usuário existente:', existingUser.id);
        
        // Hash da nova senha
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Verificar se o código de convite é válido
        let isInviteValid = false;
        let inviteData = null;

        if (inviteCode) {
          console.log('Verificando código de convite:', inviteCode);

          const { data: invite, error: inviteError } = await supabase
            .from('users_unified')
            .select('*')
            .eq('invite_code', inviteCode)
            .eq('is_authorized', true)
            .single();

          if (inviteError) {
            console.log('Erro ao verificar código de convite:', inviteError.message);
          } else if (invite) {
            console.log('Código de convite válido:', invite.id);
            isInviteValid = true;
            inviteData = invite;

            // Verificar se o convite expirou
            if (invite.authorization_expires_at) {
              const expiryDate = new Date(invite.authorization_expires_at);
              if (expiryDate < new Date()) {
                console.log('Código de convite expirado');
                isInviteValid = false;
              }
            }

            // Verificar se o convite atingiu o número máximo de usos
            if (invite.authorization_max_uses && invite.authorization_uses >= invite.authorization_max_uses) {
              console.log('Código de convite atingiu o número máximo de usos');
              isInviteValid = false;
            }
          }
        }
        
        // Atualizar o usuário existente com as novas informações
        const { data: updatedUserData, error: updateError } = await supabase
          .from('users_unified')
          .update({
            first_name: firstName,
            last_name: lastName,
            cpf: cpf,
            position: position,
            password_hash: hashedPassword,
            active: isInviteValid, // Ativo imediatamente se o convite for válido
            is_authorized: isInviteValid, // Autorizado imediatamente se o convite for válido
            authorization_status: isInviteValid ? 'active' : 'pending',
            invite_code: isInviteValid ? inviteCode : null,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingUser.id)
          .select()
          .single();

        if (updateError) {
          console.error('Erro ao atualizar usuário existente:', updateError);
          return NextResponse.json(
            { error: 'Erro ao completar registro: ' + updateError.message },
            { status: 500 }
          );
        }

        // Se o convite for válido, incrementar o contador de usos
        if (isInviteValid && inviteData) {
          const { error: updateInviteError } = await supabase
            .from('users_unified')
            .update({
              authorization_uses: (inviteData.authorization_uses || 0) + 1,
              updated_at: new Date().toISOString()
            })
            .eq('id', inviteData.id);

          if (updateInviteError) {
            console.error('Erro ao atualizar contador de usos do convite:', updateInviteError);
          }
        }

        // Verificar se já tem permissões, se não, adicionar
        const { data: existingPermissions } = await supabase
          .from('user_permissions')
          .select('*')
          .eq('user_id', existingUser.id);

        if (!existingPermissions || existingPermissions.length === 0) {
          // Adicionar permissões padrão
          const defaultModules = [
            'dashboard',
            'manual',
            'procedimentos',
            'politicas',
            'calendario',
            'noticias',
            'reembolso',
            'contracheque',
            'ponto'
          ];

          const permissionsToInsert = defaultModules.map(module => ({
            user_id: existingUser.id,
            module,
            feature: null
          }));

          const { error: permissionsError } = await supabase
            .from('user_permissions')
            .insert(permissionsToInsert);

          if (permissionsError) {
            console.error('Erro ao adicionar permissões:', permissionsError);
          }
        }

        // Registrar histórico de acesso
        const { error: historyError } = await supabase
          .from('access_history')
          .insert({
            user_id: existingUser.id,
            action: 'REGISTRATION_COMPLETED',
            details: `Registro completado via formulário rápido.`,
            ip_address: request.headers.get('x-forwarded-for') || 'unknown',
            user_agent: request.headers.get('user-agent') || 'unknown'
          });

        if (historyError) {
          console.error('Erro ao registrar histórico de acesso:', historyError);
        }

        // Enviar e-mail de confirmação se tiver email
        if (email) {
          try {
            console.log(`Enviando email de confirmação para ${email}`);
            const emailResult = await sendNewUserWelcomeEmail(email, firstName);
            console.log(`Resultado do envio de email: ${emailResult.success ? 'Sucesso' : 'Falha'}`);
          } catch (emailError) {
            console.error('Erro ao enviar email de confirmação:', emailError);
          }
        }

        // Enviar notificação para o administrador
        try {
          await sendAdminNotificationEmail(
            process.env.ADMIN_EMAIL || 'caio.correia@groupabz.com',
            {
              name: `${firstName} ${lastName}`,
              email: email || 'Não informado',
              phoneNumber: phoneNumber || 'Não informado',
              position: 'Não informado',
              department: 'Não informado',
              protocol: existingUser.protocol || 'N/A'
            }
          );
        } catch (notifyError) {
          console.error('Erro ao enviar notificação para o administrador:', notifyError);
        }

        return NextResponse.json({
          success: true,
          message: isInviteValid
            ? 'Registro completado com sucesso. Sua conta já está ativa e você pode fazer login imediatamente.'
            : 'Registro completado com sucesso. Aguarde a aprovação do administrador.',
          protocol: existingUser.protocol,
          accountActive: isInviteValid
        });
      } else {
        // Usuário já possui registro completo
        return NextResponse.json(
          { error: 'Usuário já cadastrado com este e-mail ou telefone' },
          { status: 400 }
        );
      }
    }

    // Gerar código de verificação
    const verificationCode = generateVerificationCode();

    // Calcular data de expiração (15 minutos por padrão)
    const expiryMinutes = parseInt(process.env.VERIFICATION_CODE_EXPIRY_MINUTES || '15');
    const verificationCodeExpires = new Date();
    verificationCodeExpires.setMinutes(verificationCodeExpires.getMinutes() + expiryMinutes);

    // Gerar número de protocolo
    const protocol = generateProtocolNumber();

    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 10);

    // Criar usuário na autenticação do Supabase
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email || undefined,
      phone: phoneNumber || undefined,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          phone_number: phoneNumber,
          role: 'USER'
        }
      }
    });

    if (authError) {
      console.error('Erro ao criar usuário na autenticação:', authError);
      return NextResponse.json(
        { error: 'Erro ao criar usuário: ' + authError.message },
        { status: 500 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'Erro ao criar usuário' },
        { status: 500 }
      );
    }

    // Verificar se o código de convite é válido
    let isInviteValid = false;
    let inviteData = null;

    if (inviteCode) {
      console.log('Verificando código de convite:', inviteCode);

      const { data: invite, error: inviteError } = await supabase
        .from('users_unified')
        .select('*')
        .eq('invite_code', inviteCode)
        .eq('is_authorized', true)
        .single();

      if (inviteError) {
        console.log('Erro ao verificar código de convite:', inviteError.message);
      } else if (invite) {
        console.log('Código de convite válido:', invite.id);
        isInviteValid = true;
        inviteData = invite;

        // Verificar se o convite expirou
        if (invite.authorization_expires_at) {
          const expiryDate = new Date(invite.authorization_expires_at);
          if (expiryDate < new Date()) {
            console.log('Código de convite expirado');
            isInviteValid = false;
          }
        }

        // Verificar se o convite atingiu o número máximo de usos
        if (invite.authorization_max_uses && invite.authorization_uses >= invite.authorization_max_uses) {
          console.log('Código de convite atingiu o número máximo de usos');
          isInviteValid = false;
        }
      }
    }

    // Verificar configurações de bypass de aprovação
    const { getUserApprovalSettings } = await import('@/lib/user-approval');
    const approvalSettings = await getUserApprovalSettings();
    console.log('Configurações de aprovação:', approvalSettings);

    // Se o bypass está ativo, ativar usuário automaticamente
    const shouldAutoActivate = approvalSettings.bypassApproval || isInviteValid;
    console.log('Deve ativar automaticamente:', shouldAutoActivate, {
      bypassApproval: approvalSettings.bypassApproval,
      isInviteValid
    });

    // Criar usuário na tabela users_unified
    const { data: userData, error: userError } = await supabase
      .from('users_unified')
      .insert({
        id: authData.user.id,
        email: email || null,
        phone_number: phoneNumber || null,
        first_name: firstName,
        last_name: lastName,
        cpf: cpf,
        position: position || 'Não informado',
        department: 'Não informado',
        role: 'USER',
        active: shouldAutoActivate, // Ativo se bypass estiver ativo ou convite válido
        is_authorized: shouldAutoActivate, // Autorizado se bypass estiver ativo ou convite válido
        authorization_status: shouldAutoActivate ? 'active' : 'pending',
        verification_code: verificationCode,
        verification_code_expires: verificationCodeExpires.toISOString(),
        protocol: protocol,
        invite_code: isInviteValid ? inviteCode : null,
        password_hash: hashedPassword,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    // Se o convite for válido, incrementar o contador de usos
    if (isInviteValid && inviteData) {
      const { error: updateError } = await supabase
        .from('users_unified')
        .update({
          authorization_uses: (inviteData.authorization_uses || 0) + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', inviteData.id);

      if (updateError) {
        console.error('Erro ao atualizar contador de usos do convite:', updateError);
      }
    }

    if (userError) {
      console.error('Erro ao criar usuário na tabela users_unified:', userError);
      return NextResponse.json(
        { error: 'Erro ao criar usuário: ' + userError.message },
        { status: 500 }
      );
    }

    // Adicionar permissões padrão
    const defaultModules = [
      'dashboard',
      'manual',
      'procedimentos',
      'politicas',
      'calendario',
      'noticias',
      'reembolso',
      'contracheque',
      'ponto'
    ];

    const permissionsToInsert = defaultModules.map(module => ({
      user_id: authData.user?.id || '',
      module,
      feature: null
    }));

    const { data: permissionsData, error: permissionsError } = await supabase
      .from('user_permissions')
      .insert(permissionsToInsert);

    if (permissionsError) {
      console.error('Erro ao adicionar permissões:', permissionsError);
      // Não interromper o fluxo se as permissões falharem
    }

    // Registrar histórico de acesso
    const { data: historyData, error: historyError } = await supabase
      .from('access_history')
      .insert({
        user_id: authData.user.id,
        action: 'REGISTERED',
        details: `Usuário registrado via formulário rápido. Protocolo: ${protocol}`,
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown'
      });

    if (historyError) {
      console.error('Erro ao registrar histórico de acesso:', historyError);
      // Não interromper o fluxo se o histórico falhar
    }

    // Enviar código de verificação por e-mail se tiver email
    let sendResult: any = { success: false, previewUrl: undefined };
    if (email) {
      sendResult = await sendVerificationEmail(email, verificationCode);
    }

    // Enviar e-mail de confirmação para o usuário se tiver email
    if (email) {
      try {
        console.log(`Enviando email de confirmação para ${email}`);
        const emailResult = await sendNewUserWelcomeEmail(email, firstName);
        console.log(`Resultado do envio de email: ${emailResult.success ? 'Sucesso' : 'Falha'}`);
      } catch (emailError) {
        console.error('Erro ao enviar email de confirmação:', emailError);
        // Não interromper o fluxo se o email falhar
      }
    }

    // Enviar notificação para o administrador
    try {
      await sendAdminNotificationEmail(
        process.env.ADMIN_EMAIL || 'caio.correia@groupabz.com',
        {
          name: `${firstName} ${lastName}`,
          email: email || 'Não informado',
          phoneNumber: phoneNumber || 'Não informado',
          position: 'Não informado',
          department: 'Não informado',
          protocol
        }
      );
    } catch (notifyError) {
      console.error('Erro ao enviar notificação para o administrador:', notifyError);
      // Não interromper o fluxo se a notificação falhar
    }

    return NextResponse.json({
      success: true,
      message: isInviteValid
        ? 'Registro realizado com sucesso. Sua conta já está ativa e você pode fazer login imediatamente.'
        : 'Registro realizado com sucesso. Aguarde a aprovação do administrador.',
      protocol,
      previewUrl: sendResult.previewUrl,
      accountActive: isInviteValid
    });
  } catch (error) {
    console.error('Erro ao registrar usuário:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
