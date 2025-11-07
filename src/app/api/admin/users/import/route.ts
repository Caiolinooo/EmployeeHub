import { NextRequest, NextResponse } from 'next/server';
import { generateVerificationCode } from '@/lib/email';
import { sendInviteWithRegisterLinkEmail } from '@/lib/notifications';
import { sendInviteSMS } from '@/lib/sms';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const {
      users,
      sendInvites = false,
      sendSMS = false,
      defaultRole = 'USER',
      skipDuplicates = true
    } = await request.json();

    if (!users || !Array.isArray(users) || users.length === 0) {
      return NextResponse.json(
        { error: 'Dados de usuários inválidos' },
        { status: 400 }
      );
    }

    console.log(`Importando ${users.length} usuários. Enviar convites por email: ${sendInvites ? 'Sim' : 'Não'}, por SMS: ${sendSMS ? 'Sim' : 'Não'}, Função padrão: ${defaultRole}, Ignorar duplicatas: ${skipDuplicates ? 'Sim' : 'Não'}`);

    // Exibir dados de exemplo para debug
    if (users.length > 0) {
      console.log('Exemplo de dados recebidos:', JSON.stringify(users[0]));
    }

    const results = {
      success: 0,
      error: 0,
      invitesSent: 0,
      smsSent: 0,
      skipped: 0,
      details: [] as any[],
    };

    // Processar cada usuário no lote
    for (const userData of users) {
      try {
        // Normalizar dados
        const normalizedUser = normalizeUserData(userData);

        // Validar dados
        const validationResult = validateUserData(normalizedUser);
        if (!validationResult.isValid) {
          results.error++;
          results.details.push({
            user: normalizedUser,
            success: false,
            error: validationResult.error,
          });
          continue;
        }

        // Verificar se o usuário já existe
        let existingUser = null;
        if (normalizedUser.email) {
          const { data: userByEmail } = await supabaseAdmin
            .from('users_unified')
            .select('*')
            .eq('email', normalizedUser.email)
            .single();

          if (userByEmail) {
            existingUser = userByEmail;
          }
        }

        if (!existingUser && normalizedUser.phoneNumber) {
          const { data: userByPhone } = await supabaseAdmin
            .from('users_unified')
            .select('*')
            .eq('phone_number', normalizedUser.phoneNumber)
            .single();

          if (userByPhone) {
            existingUser = userByPhone;
          }
        }

        if (existingUser) {
          // Verificar se deve ignorar duplicatas
          if (skipDuplicates) {
            console.log(`Ignorando usuário duplicado: ${normalizedUser.email || normalizedUser.phoneNumber}`);
            results.skipped++;
            results.details.push({
              user: normalizedUser,
              success: true,
              action: 'skipped',
              reason: 'duplicate'
            });
            continue;
          }

          // Atualizar usuário existente
          const { error: updateError } = await supabaseAdmin
            .from('users_unified')
            .update({
              first_name: normalizedUser.name.split(' ')[0] || existingUser.first_name,
              last_name: normalizedUser.name.split(' ').slice(1).join(' ') || existingUser.last_name,
              email: normalizedUser.email || existingUser.email,
              phone_number: normalizedUser.phoneNumber || existingUser.phone_number,
              department: normalizedUser.department || existingUser.department,
              position: normalizedUser.position || existingUser.position,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingUser.id);

          if (updateError) {
            throw new Error(`Erro ao atualizar usuário: ${updateError.message}`);
          }

          results.success++;
          results.details.push({
            user: normalizedUser,
            success: true,
            action: 'updated',
          });
        } else {
          // Criar novo usuário
          const inviteCode = generateVerificationCode();
          const userId = crypto.randomUUID();
          const now = new Date().toISOString();

          // Dividir o nome em primeiro nome e sobrenome
          const nameParts = normalizedUser.name.split(' ');
          const firstName = nameParts[0] || '';
          const lastName = nameParts.slice(1).join(' ') || '';

          // Inserir novo usuário na tabela users_unified
          const { data: newUser, error: insertError } = await supabaseAdmin
            .from('users_unified')
            .insert({
              id: userId,
              first_name: firstName,
              last_name: lastName,
              email: normalizedUser.email,
              phone_number: normalizedUser.phoneNumber,
              department: normalizedUser.department,
              position: normalizedUser.position,
              role: defaultRole,
              active: true,
              verification_code: inviteCode,
              verification_code_expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 horas
              created_at: now,
              updated_at: now
            })
            .select()
            .single();

          if (insertError) {
            throw new Error(`Erro ao criar usuário: ${insertError.message}`);
          }

          // Sempre enviar e-mail de convite para novos usuários com email
          if (normalizedUser.email) {
            try {
              console.log(`Enviando convite para ${normalizedUser.email}`);
              const emailResult = await sendInviteWithRegisterLinkEmail(
                normalizedUser.email,
                inviteCode
              );

              console.log(`Resultado do envio de convite para ${normalizedUser.email}: ${emailResult.success ? 'Sucesso' : 'Falha'}`);
              if (emailResult.previewUrl) {
                console.log(`URL de preview: ${emailResult.previewUrl}`);
              }

              if (emailResult.success) {
                results.invitesSent++;
              }
            } catch (emailError) {
              console.error('Erro ao enviar e-mail de convite:', emailError);
              // Continuar mesmo se o e-mail falhar
            }
          } else {
            console.log(`Não foi possível enviar convite por email: usuário não possui email`);
          }

          // Enviar SMS de convite se a opção estiver ativada
          if (sendSMS && normalizedUser.phoneNumber) {
            try {
              console.log(`Enviando SMS de convite para ${normalizedUser.phoneNumber}`);
              const smsResult = await sendInviteSMS(
                normalizedUser.phoneNumber,
                inviteCode,
                normalizedUser.name
              );

              console.log(`Resultado do envio de SMS para ${normalizedUser.phoneNumber}: ${smsResult.success ? 'Sucesso' : 'Falha'}`);

              if (smsResult.success) {
                results.smsSent++;
              }
            } catch (smsError) {
              console.error('Erro ao enviar SMS de convite:', smsError);
              // Continuar mesmo se o SMS falhar
            }
          } else if (normalizedUser.phoneNumber) {
            console.log(`SMS de convite não enviado para ${normalizedUser.phoneNumber} (opção desativada)`);
          }

          results.success++;
          results.details.push({
            user: normalizedUser,
            success: true,
            action: 'created',
          });
        }
      } catch (userError) {
        console.error('Erro ao processar usuário:', userError);
        results.error++;
        results.details.push({
          user: userData,
          success: false,
          error: 'Erro interno ao processar usuário',
        });
      }
    }

    return NextResponse.json({
      ...results,
      total: users.length,
      processed: results.success + results.error + results.skipped
    });
  } catch (error) {
    console.error('Erro na importação de usuários:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// Normalizar dados do usuário
function normalizeUserData(userData: any) {
  console.log('Normalizando dados do usuário:', JSON.stringify(userData));

  // Mapear campos com diferentes nomes possíveis
  const nameFields = ['nome', 'name', 'fullName', 'nome_completo', 'colaborador', 'Nome', 'Nome para exibição'];
  const emailFields = ['email', 'e-mail', 'correio', 'email_corporativo', 'Nome UPN'];
  const phoneFields = ['telefone', 'phone', 'celular', 'mobile', 'fone', 'Telefone Celular', 'Número de telefone'];
  const departmentFields = ['departamento', 'department', 'setor', 'area', 'centro_custo', 'Departamento'];
  const positionFields = ['cargo', 'position', 'funcao', 'job_title', 'Título'];
  const lastNameFields = ['sobrenome', 'last_name', 'lastname', 'surname', 'Sobrenome'];
  const firstNameFields = ['primeiro_nome', 'first_name', 'firstname', 'Nome'];
  const cityFields = ['cidade', 'city', 'Cidade'];
  const stateFields = ['estado', 'state', 'uf', 'StateOrProvince'];
  const countryFields = ['pais', 'country', 'CountryOrRegion'];
  const addressFields = ['endereco', 'address', 'Endereço'];
  const zipFields = ['cep', 'zip', 'zip_code', 'CEP'];

  // Função para encontrar o primeiro campo válido
  const findFirstValidField = (obj: any, fields: string[]) => {
    for (const field of fields) {
      if (obj[field] !== undefined && obj[field] !== null && obj[field] !== '') {
        return obj[field];
      }
    }
    return null;
  };

  // Normalizar telefone
  const normalizePhone = (phone: string | null) => {
    if (!phone) return null;

    // Remover caracteres não numéricos
    const digits = phone.replace(/\D/g, '');

    // Garantir que tenha o formato correto
    if (digits.length >= 10) {
      // Adicionar código do país se não tiver
      if (digits.length === 10 || digits.length === 11) {
        return `+55${digits}`;
      }
      return `+${digits}`;
    }

    return null;
  };

  // Verificar se o objeto já está no formato esperado
  if (userData.name && (userData.email || userData.phoneNumber)) {
    return {
      name: userData.name,
      email: userData.email || null,
      phoneNumber: normalizePhone(userData.phoneNumber || userData.telefone),
      department: userData.department || userData.departamento || null,
      position: userData.position || userData.cargo || null,
    };
  }

  // Lidar com formato Office 365
  let fullName = '';
  const firstName = findFirstValidField(userData, firstNameFields);
  const lastName = findFirstValidField(userData, lastNameFields);

  // Construir nome completo a partir de nome e sobrenome se disponíveis
  if (firstName && lastName) {
    fullName = `${firstName} ${lastName}`;
  } else {
    // Caso contrário, tentar encontrar o nome completo diretamente
    fullName = findFirstValidField(userData, nameFields) || '';
  }

  // Se ainda não tiver nome completo, usar o email como último recurso
  if (!fullName) {
    const email = findFirstValidField(userData, emailFields);
    if (email && email.includes('@')) {
      fullName = email.split('@')[0].replace(/[._]/g, ' ');
    }
  }

  const normalizedData = {
    name: fullName,
    email: findFirstValidField(userData, emailFields) || null,
    phoneNumber: normalizePhone(findFirstValidField(userData, phoneFields)),
    department: findFirstValidField(userData, departmentFields) || null,
    position: findFirstValidField(userData, positionFields) || null,
    // Dados adicionais que podem ser úteis
    city: findFirstValidField(userData, cityFields) || null,
    state: findFirstValidField(userData, stateFields) || null,
    country: findFirstValidField(userData, countryFields) || null,
    address: findFirstValidField(userData, addressFields) || null,
    zipCode: findFirstValidField(userData, zipFields) || null,
  };

  console.log('Dados normalizados:', JSON.stringify(normalizedData));
  return normalizedData;
}

// Validar dados do usuário
function validateUserData(userData: any) {
  console.log('Validando dados do usuário:', JSON.stringify(userData));

  // Verificar se tem pelo menos nome e um contato (email ou telefone)
  if (!userData.name || userData.name.trim() === '') {
    return {
      isValid: false,
      error: 'Nome é obrigatório',
    };
  }

  if (!userData.email && !userData.phoneNumber) {
    return {
      isValid: false,
      error: 'É necessário pelo menos um contato (email ou telefone)',
    };
  }

  // Validar formato de email
  if (userData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userData.email)) {
    return {
      isValid: false,
      error: 'Formato de email inválido',
    };
  }

  return {
    isValid: true,
    normalizedData: userData
  };
}
