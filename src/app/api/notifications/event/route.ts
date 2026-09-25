import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { eventInviteTemplate } from '@/lib/emailTemplates';

export async function POST(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Supabase configuration is missing' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const {
      eventId,
      title,
      description,
      startDate,
      location,
      attendees,
      sendEmail,
      sendInternalNotification
    } = body;

    console.log('📧 Enviando notificações de evento:', title);
    console.log('📋 Dados recebidos:', {
      eventId,
      sendEmail,
      sendInternalNotification,
      attendeesCount: attendees?.length || 0,
      attendees
    });

    const results = {
      emailsSent: 0,
      notificationsSent: 0,
      errors: [] as string[]
    };

    // Formatar data
    const eventDate = new Date(startDate);
    const formattedDate = eventDate.toLocaleString('pt-BR', {
      dateStyle: 'full',
      timeStyle: 'short'
    });

    // Enviar emails se solicitado
    console.log(`📬 Verificando envio de emails: sendEmail=${sendEmail}, attendees=${attendees?.length || 0}`);
    if (sendEmail && attendees && attendees.length > 0) {
      const { sendEmail: sendEmailService } = await import('@/lib/email');

      for (const email of attendees) {
        try {
          await sendEmailService(
            email,
            `📅 Convite: ${title}`,
            `Você foi convidado para o evento: ${title}. Data: ${formattedDate}`,
            eventInviteTemplate(title, formattedDate, location, description)
          );

          results.emailsSent++;
          console.log(`✅ Email enviado para ${email}`);
        } catch (error) {
          console.error('Erro ao enviar email para %s:', email, error);
          results.errors.push(`Email para ${email}: ${error}`);
        }
      }
    }

    // Enviar notificações internas se solicitado
    console.log(`🔔 Verificando notificações internas: sendInternalNotification=${sendInternalNotification}, attendees=${attendees?.length || 0}`);
    if (sendInternalNotification && attendees && attendees.length > 0) {
      // Buscar IDs dos usuários pelos emails
      const { data: users, error: usersError } = await supabaseAdmin
        .from('users_unified')
        .select('id, email')
        .in('email', attendees);

      if (usersError) {
        console.error('Erro ao buscar usuários:', usersError);
        results.errors.push(`Erro ao buscar usuários: ${usersError.message}`);
      } else if (users && users.length > 0) {
        // Criar notificações para cada usuário
        for (const user of users) {
          try {
            const { error: notifError } = await supabaseAdmin
              .from('notifications')
              .insert({
                user_id: user.id,
                type: 'event',
                title: `📅 Novo Evento: ${title}`,
                message: `Você foi convidado para "${title}" em ${formattedDate}${location ? ` no local: ${location}` : ''}`,
                data: {
                  eventId,
                  title,
                  description,
                  startDate,
                  location
                },
                read: false,
                created_at: new Date().toISOString()
              });

            if (notifError) {
              console.error(`❌ Erro ao criar notificação para ${user.email}:`, notifError);
              results.errors.push(`Notificação para ${user.email}: ${notifError.message}`);
            } else {
              results.notificationsSent++;
              console.log(`✅ Notificação criada para ${user.email}`);
            }
          } catch (error) {
            console.error(`❌ Erro ao processar notificação para ${user.email}:`, error);
            results.errors.push(`Notificação para ${user.email}: ${error}`);
          }
        }
      }
    }

    console.log('📊 Resultado das notificações:', results);

    return NextResponse.json({
      success: true,
      message: 'Notificações processadas',
      results
    });

  } catch (error) {
    console.error('❌ Erro ao enviar notificações de evento:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro ao enviar notificações',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}

