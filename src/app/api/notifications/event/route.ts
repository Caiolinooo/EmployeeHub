import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Configurar transporte de email
const transporter = nodemailer.createTransporter({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: 'apiabzgroup@gmail.com',
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

export async function POST(request: NextRequest) {
  try {
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

    const results = {
      emailsSent: 0,
      notificationsSent: 0,
      errors: []
    };

    // Formatar data
    const eventDate = new Date(startDate);
    const formattedDate = eventDate.toLocaleString('pt-BR', {
      dateStyle: 'full',
      timeStyle: 'short'
    });

    // Enviar emails se solicitado
    if (sendEmail && attendees && attendees.length > 0) {
      for (const email of attendees) {
        try {
          await transporter.sendMail({
            from: '"ABZ Group" <apiabzgroup@gmail.com>',
            to: email,
            subject: `📅 Convite: ${title}`,
            html: `
              <!DOCTYPE html>
              <html>
              <head>
                <style>
                  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                  .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                  .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
                  .event-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981; }
                  .detail-row { margin: 10px 0; }
                  .detail-label { font-weight: bold; color: #10b981; }
                  .button { display: inline-block; padding: 12px 30px; background: #10b981; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
                  .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 12px; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h1 style="margin: 0;">📅 Novo Evento</h1>
                  </div>
                  <div class="content">
                    <p>Olá!</p>
                    <p>Você foi convidado para o seguinte evento:</p>
                    
                    <div class="event-details">
                      <h2 style="margin-top: 0; color: #10b981;">${title}</h2>
                      
                      <div class="detail-row">
                        <span class="detail-label">📅 Data e Hora:</span><br>
                        ${formattedDate}
                      </div>
                      
                      ${location ? `
                      <div class="detail-row">
                        <span class="detail-label">📍 Local:</span><br>
                        ${location}
                      </div>
                      ` : ''}
                      
                      ${description ? `
                      <div class="detail-row">
                        <span class="detail-label">📝 Descrição:</span><br>
                        ${description}
                      </div>
                      ` : ''}
                    </div>
                    
                    <p>Não esqueça de adicionar este evento ao seu calendário!</p>
                    
                    <div class="footer">
                      <p>Esta é uma mensagem automática do sistema ABZ Group.</p>
                      <p>Por favor, não responda a este email.</p>
                    </div>
                  </div>
                </div>
              </body>
              </html>
            `
          });
          
          results.emailsSent++;
          console.log(`✅ Email enviado para ${email}`);
        } catch (error) {
          console.error(`❌ Erro ao enviar email para ${email}:`, error);
          results.errors.push(`Email para ${email}: ${error}`);
        }
      }
    }

    // Enviar notificações internas se solicitado
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

