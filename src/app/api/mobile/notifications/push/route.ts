import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyToken } from '@/lib/auth';
import { MobilePushNotification } from '@/types/api-mobile';

export const runtime = 'nodejs';

// Configuração do Firebase Admin (seria necessário configurar)
// import admin from 'firebase-admin';

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação
    const authResult = await verifyToken(request);
    if (!authResult.valid || !authResult.payload) {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 });
    }

    // Verificar permissões de admin
    const { data: user } = await supabase
      .from('users_unified')
      .select('role, access_permissions')
      .eq('id', authResult.payload.userId)
      .single();

    if (!user || (user.role !== 'ADMIN' && !user.access_permissions?.['notifications.push.send'])) {
      return NextResponse.json({
        success: false,
        error: 'Sem permissão para enviar notificações push'
      }, { status: 403 });
    }

    const notification: MobilePushNotification = await request.json();
    const { to, title, body, data, badge, sound, category, priority, ttl } = notification;

    // Validar campos obrigatórios
    if (!to || !title || !body) {
      return NextResponse.json({
        success: false,
        error: 'Campos obrigatórios: to, title, body'
      }, { status: 400 });
    }

    const recipients = Array.isArray(to) ? to : [to];
    const results = [];

    for (const recipient of recipients) {
      try {
        // Buscar tokens de push do usuário/dispositivo
        let pushTokens: string[] = [];

        if (recipient.includes('@')) {
          // É um email - buscar tokens por usuário
          const { data: userDevices } = await supabase
            .from('mobile_devices')
            .select('push_token')
            .eq('user_email', recipient)
            .eq('is_active', true)
            .not('push_token', 'is', null);

          pushTokens = userDevices?.map(d => d.push_token).filter(Boolean) || [];
        } else {
          // É um deviceId - buscar token específico
          const { data: device } = await supabase
            .from('mobile_devices')
            .select('push_token, user_id')
            .eq('id', recipient)
            .eq('is_active', true)
            .single();

          if (device?.push_token) {
            pushTokens = [device.push_token];
          }
        }

        if (pushTokens.length === 0) {
          results.push({
            recipient,
            success: false,
            error: 'Nenhum token de push encontrado'
          });
          continue;
        }

        // Enviar notificação para cada token
        for (const token of pushTokens) {
          const result = await sendPushNotification({
            token,
            title,
            body,
            data,
            badge,
            sound,
            category,
            priority,
            ttl
          });

          results.push({
            recipient,
            token: token.substring(0, 10) + '...',
            success: result.success,
            error: result.error,
            messageId: result.messageId
          });

          // Salvar notificação no banco
          if (result.success) {
            await supabase
              .from('mobile_notifications')
              .insert({
                user_id: recipient.includes('@') ? null : recipient,
                user_email: recipient.includes('@') ? recipient : null,
                title,
                message: body,
                data: data || {},
                push_token: token,
                message_id: result.messageId,
                sent_at: new Date().toISOString(),
                status: 'sent'
              });
          }
        }

      } catch (error) {
        console.error(`Erro ao enviar para ${recipient}:`, error);
        results.push({
          recipient,
          success: false,
          error: error.message
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;

    return NextResponse.json({
      success: successCount > 0,
      message: `${successCount}/${totalCount} notificações enviadas com sucesso`,
      results
    });

  } catch (error) {
    console.error('Erro ao enviar notificações push:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
}

async function sendPushNotification(params: {
  token: string;
  title: string;
  body: string;
  data?: any;
  badge?: number;
  sound?: string;
  category?: string;
  priority?: 'high' | 'normal';
  ttl?: number;
}): Promise<{ success: boolean; error?: string; messageId?: string }> {
  try {
    // Aqui seria implementada a integração com Firebase Cloud Messaging
    // Por enquanto, vamos simular o envio
    
    // Exemplo de implementação com Firebase Admin SDK:
    /*
    const message = {
      token: params.token,
      notification: {
        title: params.title,
        body: params.body
      },
      data: params.data ? Object.fromEntries(
        Object.entries(params.data).map(([k, v]) => [k, String(v)])
      ) : undefined,
      android: {
        priority: params.priority === 'high' ? 'high' : 'normal',
        ttl: params.ttl ? params.ttl * 1000 : undefined,
        notification: {
          sound: params.sound || 'default',
          channelId: params.category || 'default'
        }
      },
      apns: {
        payload: {
          aps: {
            badge: params.badge,
            sound: params.sound || 'default',
            category: params.category
          }
        }
      }
    };

    const response = await admin.messaging().send(message);
    return { success: true, messageId: response };
    */

    // Simulação para desenvolvimento
    console.log('Enviando notificação push:', {
      token: params.token.substring(0, 10) + '...',
      title: params.title,
      body: params.body
    });

    // Simular delay de rede
    await new Promise(resolve => setTimeout(resolve, 100));

    // Simular sucesso (90% das vezes)
    if (Math.random() > 0.1) {
      return {
        success: true,
        messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };
    } else {
      return {
        success: false,
        error: 'Token inválido ou expirado'
      };
    }

  } catch (error) {
    console.error('Erro ao enviar notificação push:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Endpoint para registrar token de push
export async function PUT(request: NextRequest) {
  try {
    const authResult = await verifyToken(request);
    if (!authResult.valid || !authResult.payload) {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 });
    }

    const { deviceId, pushToken } = await request.json();

    if (!deviceId || !pushToken) {
      return NextResponse.json({
        success: false,
        error: 'deviceId e pushToken são obrigatórios'
      }, { status: 400 });
    }

    // Atualizar token de push do dispositivo
    const { error } = await supabase
      .from('mobile_devices')
      .update({
        push_token: pushToken,
        updated_at: new Date().toISOString()
      })
      .eq('id', deviceId)
      .eq('user_id', authResult.payload.userId);

    if (error) {
      console.error('Erro ao atualizar token de push:', error);
      return NextResponse.json({
        success: false,
        error: 'Erro ao atualizar token de push'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Token de push atualizado com sucesso'
    });

  } catch (error) {
    console.error('Erro ao registrar token de push:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
}

// Endpoint para remover token de push
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await verifyToken(request);
    if (!authResult.valid || !authResult.payload) {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 });
    }

    const url = new URL(request.url);
    const deviceId = url.searchParams.get('deviceId');

    if (!deviceId) {
      return NextResponse.json({
        success: false,
        error: 'deviceId é obrigatório'
      }, { status: 400 });
    }

    // Remover token de push do dispositivo
    const { error } = await supabase
      .from('mobile_devices')
      .update({
        push_token: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', deviceId)
      .eq('user_id', authResult.payload.userId);

    if (error) {
      console.error('Erro ao remover token de push:', error);
      return NextResponse.json({
        success: false,
        error: 'Erro ao remover token de push'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Token de push removido com sucesso'
    });

  } catch (error) {
    console.error('Erro ao remover token de push:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
}
