import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { sendVerificationEmail } from '@/lib/email';
import { sendNewUserWelcomeEmail, sendAdminNotificationEmail } from '@/lib/notifications';
import { supabaseAdmin as supabase } from '@/lib/supabase';
import { checkIfUserIsBanned } from '@/lib/banned-users';

// Função para gerar número de protocolo
async function generateProtocolNumber() {
  const date = new Date();
  const year = date.getFullYear().toString().slice(2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const { randomBytes } = await import('crypto');
  const random = parseInt(randomBytes(2).toString('hex'), 16).toString().slice(0, 4).padStart(4, '0');
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
      position,
      department,
      inviteCode,
      cpf
    } = body;

    // Normalizar e validar
    const normalizedEmail = (email || '').trim().toLowerCase();
    const normalizedPhone = (phoneNumber || '').trim();
    const normalizedCpf = (cpf || '').trim();

    // Gerar número de protocolo cedo para estar disponível em todas as respostas de sucesso
    const protocol = await generateProtocolNumber();

    console.log('Dados recebidos para registro:', {
      email: normalizedEmail,
      phoneNumber: normalizedPhone,
      firstName,
      lastName,
      position,
      department,
      cpf: normalizedCpf || 'não informado',
      hasInviteCode: !!inviteCode
    });

    // Validar os dados de entrada
    if (!normalizedEmail || !normalizedPhone || !firstName || !lastName) {
      return NextResponse.json(
        { error: 'Todos os campos obrigatórios devem ser preenchidos' },
        { status: 400 }
      );
    }

    // Verificar se o usuário está banido permanentemente
    const banCheck = await checkIfUserIsBanned(normalizedEmail, normalizedPhone, normalizedCpf);
    if (banCheck.isBanned) {
      console.log('Tentativa de registro de usuário banido:', { email: normalizedEmail, phone: normalizedPhone, cpf: normalizedCpf });
      return NextResponse.json(
        {
          error: 'Este usuário foi banido permanentemente e não pode se cadastrar novamente. Entre em contato com o administrador se acredita que isso é um erro.',
          banned: true,
          banInfo: {
            bannedAt: banCheck.banInfo?.banned_at,
            reason: banCheck.banInfo?.ban_reason
          }
        },
        { status: 403 }
      );
    }

    // Verificar se o usuário já existe na tabela unificada
    const { data: existingUserByEmail, error: emailError } = await supabase
      .from('users_unified')
      .select('*')
      .eq('email', normalizedEmail)
      .single();

    const { data: existingUserByPhone, error: phoneError } = await supabase
      .from('users_unified')
      .select('*')
      .eq('phone_number', normalizedPhone)
      .single();

    if (existingUserByEmail) {
      // Se já existe, mas email não verificado, reenviar link de verificação e não bloquear fluxo
      if (!existingUserByEmail.email_verified) {
        try {
          const emailVerificationToken = uuidv4();
          const { error: updErr } = await supabase
            .from('users_unified')
            .update({
              email_verification_token: emailVerificationToken,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingUserByEmail.id);

          if (updErr) {
            console.error('Falha ao atualizar token para reenvio de verificação:', updErr);
          }

          const { sendEmailVerificationLink } = await import('@/lib/email-verification');
          const sendResult = await sendEmailVerificationLink(
            existingUserByEmail.email,
            existingUserByEmail.first_name || 'usuário',
            emailVerificationToken,
            request.headers
          );

          console.log('409 handled as resend verification (EMAIL_EXISTS_UNVERIFIED):', { userId: existingUserByEmail.id });
          return NextResponse.json({
            success: true,
            message: 'E-mail já cadastrado, mas não verificado. Reenviamos o link de verificação para sua caixa de entrada.',
            previewUrl: sendResult.previewUrl,
            emailVerificationRequired: true,
            protocol
          });
        } catch (e) {
          console.error('Erro ao reenviar verificação para conta existente:', e);
          return NextResponse.json(
            { error: 'E-mail já cadastrado. Use login ou a recuperação de senha.' },
            { status: 409 }
          );
        }
      }

      console.log('409 EMAIL_EXISTS_VERIFIED:', { email: normalizedEmail });
      return NextResponse.json(
        { error: 'E-mail já cadastrado. Use login ou a recuperação de senha.', code: 'EMAIL_EXISTS_VERIFIED' },
        { status: 409 }
      );
    }

    if (existingUserByPhone) {
      // Se o telefone pertence à mesma conta e o email não verificado, reenvie verificação
      if (existingUserByPhone.email === normalizedEmail && !existingUserByPhone.email_verified) {
        try {
          const emailVerificationToken = uuidv4();
          const { error: updErr2 } = await supabase
            .from('users_unified')
            .update({
              email_verification_token: emailVerificationToken,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingUserByPhone.id);
          if (updErr2) {
            console.error('Falha ao atualizar token (via phone duplicate):', updErr2);
          }
          const { sendEmailVerificationLink } = await import('@/lib/email-verification');
          const sendResult2 = await sendEmailVerificationLink(
            existingUserByPhone.email,
            existingUserByPhone.first_name || 'usuário',
            emailVerificationToken,
            request.headers
          );
          console.log('409 handled as resend verification (PHONE_EXISTS_SAME_EMAIL_UNVERIFIED):', { userId: existingUserByPhone.id });
          return NextResponse.json({
            success: true,
            message: 'Telefone já cadastrado para esta conta. Reenviamos o link de verificação de e-mail.',
            previewUrl: sendResult2.previewUrl,
            emailVerificationRequired: true,
            protocol
          });
        } catch (e2) {
          console.error('Erro ao reenviar verificação (via phone duplicate):', e2);
          return NextResponse.json(
            { error: 'Telefone já cadastrado. Use outro número ou atualize o cadastro existente.', code: 'PHONE_EXISTS' },
            { status: 409 }
          );
        }
      }
      console.log('409 PHONE_EXISTS:', { phone: normalizedPhone, emailTried: normalizedEmail, ownerEmail: existingUserByPhone.email });
      return NextResponse.json(
        { error: 'Telefone já cadastrado. Use outro número ou atualize o cadastro existente.', code: 'PHONE_EXISTS' },
        { status: 409 }
      );
    }

    // Gerar código de verificação
    const verificationCode = generateVerificationCode();

    // Calcular data de expiração (15 minutos por padrão)
    const expiryMinutes = parseInt(process.env.VERIFICATION_CODE_EXPIRY_MINUTES || '15');
    const verificationCodeExpires = new Date();
    verificationCodeExpires.setMinutes(verificationCodeExpires.getMinutes() + expiryMinutes);

    

    // Gerar senha temporária
    const temporaryPassword = uuidv4().substring(0, 8);

    // Verificar configurações de bypass de aprovação
    const { getUserApprovalSettings } = await import('@/lib/user-approval');
    const approvalSettings = await getUserApprovalSettings();
    console.log('Configurações de aprovação:', approvalSettings);

    // Verificar se o código de convite é válido (antes de criar usuário no Auth)
    let isInviteValid = false;
    let inviteData = null as any;
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

        if (invite.authorization_expires_at) {
          const expiryDate = new Date(invite.authorization_expires_at);
          if (expiryDate < new Date()) {
            console.log('Código de convite expirado');
            isInviteValid = false;
          }
        }

        if (invite.authorization_max_uses && invite.authorization_uses >= invite.authorization_max_uses) {
          console.log('Código de convite atingiu o número máximo de usos');
          isInviteValid = false;
        }
      }
    }

    // Se o bypass está ativo, ativar usuário automaticamente
    const shouldAutoActivate = approvalSettings.bypassApproval || isInviteValid;
    console.log('Deve ativar automaticamente:', shouldAutoActivate, {
      bypassApproval: approvalSettings.bypassApproval,
      isInviteValid
    });

    // Base de dados do usuário (sem id) para reuso em reconciliação e fluxo normal
    const baseUserData = {
      email: normalizedEmail,
      phone_number: normalizedPhone,
      first_name: firstName,
      last_name: lastName,
      position: position || 'Não informado',
      department: department || 'Não informado',
      tax_id: normalizedCpf || null, // CPF/CNPJ opcional
      role: 'USER',
      active: false, // Sempre inativo até verificar email
      is_authorized: true, // Autorizado para receber email de verificação
      authorization_status: 'pending', // Pendente até verificar email
      verification_code: verificationCode,
      verification_code_expires: verificationCodeExpires.toISOString(),
      protocol: protocol,
      invite_code: isInviteValid ? inviteCode : null,
      email_verified: false, // Email não verificado
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Criar usuário na autenticação do Supabase via Admin API (lado servidor)
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password: temporaryPassword,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        phone_number: normalizedPhone,
        role: 'USER'
      }
    });
    
    if (authError) {
      console.error('Erro ao criar usuário na autenticação (admin.createUser):', authError);
      const msg = (authError.message || '').toLowerCase();
      const isEmailExists = msg.includes('already registered') || msg.includes('already exists') || msg.includes('duplicate') || (authError as any)?.code === 'email_exists' || (authError as any)?.status === 422;
      if (isEmailExists) {
        // Não apagar contas automaticamente. Fluxo segue com reconciliação segura/local.
        // Tentar resolver pelo registro em users_unified
        const { data: existingUnifiedFull } = await supabase
          .from('users_unified')
          .select('*')
          .eq('email', normalizedEmail)
          .single();

        if (existingUnifiedFull) {
          if (!existingUnifiedFull.email_verified) {
            try {
              const emailVerificationToken = uuidv4();
              const { error: updErr3 } = await supabase
                .from('users_unified')
                .update({
                  email_verification_token: emailVerificationToken,
                  updated_at: new Date().toISOString()
                })
                .eq('id', existingUnifiedFull.id);
              if (updErr3) {
                console.error('Falha ao atualizar token (via email_exists):', updErr3);
              }
              const { sendEmailVerificationLink } = await import('@/lib/email-verification');
              const sendResult3 = await sendEmailVerificationLink(
                existingUnifiedFull.email,
                existingUnifiedFull.first_name || 'usuário',
                emailVerificationToken,
                request.headers
              );
              console.log('422/email_exists handled as resend verification:', { userId: existingUnifiedFull.id });
              return NextResponse.json({
                success: true,
                message: 'E-mail já cadastrado, mas não verificado. Reenviamos o link de verificação para sua caixa de entrada.',
                previewUrl: sendResult3.previewUrl,
                emailVerificationRequired: true,
                protocol
              });
            } catch (e3) {
              console.error('Erro ao reenviar verificação (via email_exists):', e3);
              return NextResponse.json(
                { error: 'E-mail já cadastrado. Use login ou a recuperação de senha.', code: 'EMAIL_EXISTS_VERIFIED' },
                { status: 409 }
              );
            }
          }
          console.log('409 EMAIL_EXISTS_VERIFIED (via email_exists):', { email: normalizedEmail });
          return NextResponse.json(
            { error: 'E-mail já cadastrado. Use login ou a recuperação de senha.', code: 'EMAIL_EXISTS_VERIFIED' },
            { status: 409 }
          );
        }

        // Não existe em users_unified: reconciliar com Auth usando Admin API
        try {
          // Buscar usuário via Supabase Admin API (sem depender de schema auth exposto)
          let authUser: any | null = null;
          const perPage = 200;
          // Tentar algumas páginas para ambientes com muitos usuários
          for (let page = 1; page <= 5 && !authUser; page++) {
            const listRes = await (supabase as any).auth.admin.listUsers({ page, perPage });
            const users = listRes?.data?.users || listRes?.users || [];
            authUser = users.find((u: any) => (u.email || '').toLowerCase() === normalizedEmail);
            if (users.length < perPage) break; // sem mais páginas
          }

          if (!authUser) {
            console.warn('email_exists, mas não localizado via Admin.listUsers(); retornando 409 simples');
            return NextResponse.json(
              { error: 'E-mail já registrado. Use login ou a recuperação de senha.' },
              { status: 409 }
            );
          }

          // Criar users_unified usando o id do Auth
          const authEmailVerified = !!(authUser.email_confirmed_at || authUser.confirmed_at);
          const unifiedInsert = {
            id: authUser.id,
            ...baseUserData,
            email_verified: authEmailVerified,
            active: false,
            authorization_status: authEmailVerified ? 'active' : 'pending',
            updated_at: new Date().toISOString(),
          } as any;

          const { error: insReconErr } = await supabase
            .from('users_unified')
            .insert(unifiedInsert);

          if (insReconErr) {
            console.error('Falha ao reconciliar criando users_unified:', insReconErr);
            return NextResponse.json(
              { error: 'E-mail já registrado. Use login ou a recuperação de senha.' },
              { status: 409 }
            );
          }

          // Sempre gerar e enviar link de verificação para fluxo de definição de senha,
          // independentemente do status atual do email no Auth, para "liberar" o cadastro.
          const emailVerificationToken = uuidv4();
          const { error: updReconErr } = await supabase
            .from('users_unified')
            .update({
              email_verification_token: emailVerificationToken,
              updated_at: new Date().toISOString(),
            })
            .eq('id', authUser.id);

          if (updReconErr) {
            console.error('Falha ao atualizar token após reconciliação:', updReconErr);
          }

          // Inserir permissões padrão para o usuário reconciliado
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
            user_id: authUser.id,
            module,
            feature: null
          }));
          const { error: permReconErr } = await supabase
            .from('user_permissions')
            .insert(permissionsToInsert);
          if (permReconErr) {
            console.error('Falha ao inserir permissões padrão (reconciliação):', permReconErr);
          }

          // Registrar histórico de acesso da reconciliação
          const { error: histReconErr } = await supabase
            .from('access_history')
            .insert({
              user_id: authUser.id,
              action: 'RECONCILIATION_CREATED',
              details: 'Conta reconciliada a partir do Supabase Auth (email_exists)',
              ip_address: request.headers.get('x-forwarded-for') || 'unknown',
              user_agent: request.headers.get('user-agent') || 'unknown'
            });
          if (histReconErr) {
            console.error('Falha ao registrar histórico (reconciliação):', histReconErr);
          }

          const { sendEmailVerificationLink } = await import('@/lib/email-verification');
          const sendResultRecon = await sendEmailVerificationLink(
            normalizedEmail,
            firstName || 'usuário',
            emailVerificationToken,
            request.headers
          );

          console.log('Reconciliação concluída: criado users_unified e enviado link de verificação/set-password', { authUserId: authUser.id });
          return NextResponse.json({
            success: true,
            message: 'Conta pré-existente reconciliada. Enviamos o link para verificar e definir sua senha.',
            previewUrl: sendResultRecon.previewUrl,
            emailVerificationRequired: true,
            protocol,
          });
        } catch (reconErr) {
          console.error('Erro durante reconciliação auth.users -> users_unified:', reconErr);
          return NextResponse.json(
            { error: 'E-mail já registrado. Use login ou a recuperação de senha.' },
            { status: 409 }
          );
        }
      }

      return NextResponse.json(
        { error: 'Erro ao criar usuário: ' + authError.message },
        { status: 400 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'Erro ao criar usuário - dados de autenticação inválidos' },
        { status: 500 }
      );
    }

    // Criar usuário na tabela users_unified
    // IMPORTANTE: Conta sempre inicia inativa, será ativada após verificação do email
    const userDataToInsert = { id: authData.user.id, ...baseUserData };

    const { data: userData, error: userError } = await supabase
      .from('users_unified')
      .insert(userDataToInsert)
      .select()
      .single();

    if (userError) {
      console.error('Erro ao criar usuário na tabela users_unified:', userError);
      // Mapear erros comuns
      const msg = (userError.message || '').toLowerCase();
      if (msg.includes('permission denied') || msg.includes('rls')) {
        return NextResponse.json(
          { error: 'Permissão negada ao criar usuário. Verifique RLS e uso da service role key no servidor.' },
          { status: 403 }
        );
      }
      if (msg.includes('column') && msg.includes('does not exist')) {
        return NextResponse.json(
          { error: 'Estrutura da tabela users_unified desatualizada. Aplique as migrações no Supabase.' },
          { status: 500 }
        );
      }
      return NextResponse.json(
        { error: 'Erro ao criar usuário na tabela: ' + userError.message },
        { status: 500 }
      );
    }

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
        details: `Usuário registrado via formulário. Protocolo: ${protocol}`,
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown'
      });

    if (historyError) {
      console.error('Erro ao registrar histórico de acesso:', historyError);
      // Não interromper o fluxo se o histórico falhar
    }

    // Sempre enviar email de verificação por link
    console.log('Enviando email de verificação por link para ativação da conta');

    // Gerar token de verificação por email
    const emailVerificationToken = uuidv4();

    // Armazenar token na tabela para validação posterior
    const { error: updateError } = await supabase
      .from('users_unified')
      .update({
        email_verification_token: emailVerificationToken,
        updated_at: new Date().toISOString()
      })
      .eq('id', userData.id);

    if (updateError) {
      console.error('Erro ao armazenar token de verificação:', updateError);
      // Continuar mesmo se não conseguir armazenar o token
    }

    // Enviar email com link de verificação
    const { sendEmailVerificationLink } = await import('@/lib/email-verification');
    const sendResult = await sendEmailVerificationLink(normalizedEmail, firstName, emailVerificationToken, request.headers);

    // Não enviar notificação para administrador - fluxo automático com verificação de email
    console.log('Fluxo de verificação por email ativo - não enviando notificação para administrador');

    return NextResponse.json({
      success: true,
      message: 'Registro realizado com sucesso. Verifique seu e-mail para ativar sua conta e fazer login.',
      protocol,
      previewUrl: sendResult.previewUrl,
      accountActive: false, // Conta sempre inativa até verificar email
      emailVerificationRequired: true // Verificação de email sempre obrigatória
    });
  } catch (error) {
    console.error('Erro ao registrar usuário:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
