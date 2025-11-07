import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { emails, phones, users } = await request.json();

    // Verificar se temos pelo menos um tipo de dados para verificar
    if ((!emails || !Array.isArray(emails)) &&
        (!phones || !Array.isArray(phones)) &&
        (!users || !Array.isArray(users))) {
      return NextResponse.json(
        { error: 'Dados inválidos para verificação de duplicatas' },
        { status: 400 }
      );
    }

    // Modo de verificação em lote (novo)
    if (emails || phones) {
      console.log(`Verificando duplicatas para ${emails?.length || 0} emails e ${phones?.length || 0} telefones`);

      const duplicateEmails: any[] = [];
      const duplicatePhones: any[] = [];

      // Verificar emails em lote
      if (emails && emails.length > 0) {
        const { data: usersByEmail } = await supabaseAdmin
          .from('users_unified')
          .select('*')
          .in('email', emails);

        if (usersByEmail && usersByEmail.length > 0) {
          duplicateEmails.push(...usersByEmail);
        }
      }

      // Verificar telefones em lote
      if (phones && phones.length > 0) {
        const { data: usersByPhone } = await supabaseAdmin
          .from('users_unified')
          .select('*')
          .in('phone_number', phones);

        if (usersByPhone && usersByPhone.length > 0) {
          duplicatePhones.push(...usersByPhone);
        }
      }

      return NextResponse.json({
        duplicateEmails,
        duplicatePhones,
        count: duplicateEmails.length + duplicatePhones.length
      });
    }

    // Modo de verificação individual (legado)
    if (users && users.length > 0) {
      console.log(`Verificando duplicatas para ${users.length} usuários (modo legado)`);

      const duplicates: any[] = [];

      // Verificar cada usuário
      for (const user of users) {
        // Verificar email
        if (user.email) {
          const { data: usersByEmail } = await supabaseAdmin
            .from('users_unified')
            .select('*')
            .eq('email', user.email);

          if (usersByEmail && usersByEmail.length > 0) {
            duplicates.push({
              field: 'email',
              value: user.email,
              existingUser: usersByEmail[0],
              importUser: user
            });
          }
        }

        // Verificar telefone
        if (user.phoneNumber) {
          const { data: usersByPhone } = await supabaseAdmin
            .from('users_unified')
            .select('*')
            .eq('phone_number', user.phoneNumber);

          if (usersByPhone && usersByPhone.length > 0) {
            // Evitar duplicatas (se o mesmo usuário já foi encontrado pelo email)
            const alreadyFound = duplicates.some(
              dup => dup.existingUser.id === usersByPhone[0].id && dup.importUser === user
            );

            if (!alreadyFound) {
              duplicates.push({
                field: 'phoneNumber',
                value: user.phoneNumber,
                existingUser: usersByPhone[0],
                importUser: user
              });
            }
          }
        }
      }

      return NextResponse.json({
        duplicates,
        count: duplicates.length
      });
    }

    return NextResponse.json({
      error: 'Nenhum dado válido fornecido para verificação'
    }, { status: 400 });
  } catch (error) {
    console.error('Erro ao verificar duplicatas:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
