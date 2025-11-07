import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { generateToken, generateRefreshToken } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import { 
  MobileAuthRequest, 
  MobileAuthResponse, 
  MobileUser,
  MobileAppSettings,
  SyncData 
} from '@/types/api-mobile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body: MobileAuthRequest = await request.json();
    const { 
      email, 
      password, 
      deviceId, 
      deviceName, 
      deviceType, 
      pushToken,
      biometricEnabled 
    } = body;

    // Validar campos obrigatórios
    if (!email || !password || !deviceId || !deviceName || !deviceType) {
      return NextResponse.json({
        success: false,
        error: 'Campos obrigatórios: email, password, deviceId, deviceName, deviceType'
      }, { status: 400 });
    }

    // Buscar usuário
    const { data: user, error: userError } = await supabase
      .from('users_unified')
      .select(`
        id,
        email,
        password_hash,
        name,
        last_name,
        phone,
        role,
        department,
        position,
        avatar_url,
        is_active,
        last_login,
        access_permissions,
        profile_data
      `)
      .eq('email', email.toLowerCase())
      .single();

    if (userError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Credenciais inválidas'
      }, { status: 401 });
    }

    // Verificar se usuário está ativo
    if (!user.is_active) {
      return NextResponse.json({
        success: false,
        error: 'Conta desativada. Entre em contato com o administrador.'
      }, { status: 403 });
    }

    // Verificar senha
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return NextResponse.json({
        success: false,
        error: 'Credenciais inválidas'
      }, { status: 401 });
    }

    // Registrar/atualizar dispositivo
    const { error: deviceError } = await supabase
      .from('mobile_devices')
      .upsert({
        id: deviceId,
        user_id: user.id,
        name: deviceName,
        type: deviceType,
        push_token: pushToken,
        app_version: request.headers.get('app-version') || '1.0.0',
        is_active: true,
        last_seen: new Date().toISOString()
      }, {
        onConflict: 'id'
      });

    if (deviceError) {
      console.error('Erro ao registrar dispositivo:', deviceError);
    }

    // Atualizar último login
    await supabase
      .from('users_unified')
      .update({ 
        last_login: new Date().toISOString(),
        profile_data: {
          ...user.profile_data,
          mobile_device_id: deviceId,
          biometric_enabled: biometricEnabled
        }
      })
      .eq('id', user.id);

    // Gerar tokens
    const token = generateToken({
      userId: user.id,
      role: user.role,
      phoneNumber: user.phone
    });

    const refreshToken = generateRefreshToken({
      userId: user.id,
      deviceId
    });

    // Preparar dados do usuário
    const mobileUser: MobileUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      lastName: user.last_name,
      phone: user.phone,
      role: user.role,
      department: user.department || '',
      position: user.position || '',
      avatar: user.avatar_url,
      isActive: user.is_active,
      lastLogin: user.last_login,
      preferences: {
        language: user.profile_data?.language || 'pt-BR',
        notifications: user.profile_data?.notifications || {
          push: true,
          email: true,
          avaliacoes: true,
          reembolsos: true,
          noticias: true,
          eventos: true,
          lembretes: true,
          sound: true,
          vibration: true,
          quietHours: {
            enabled: false,
            start: '22:00',
            end: '07:00'
          }
        },
        theme: user.profile_data?.theme || 'auto',
        biometricAuth: biometricEnabled || false,
        offlineMode: user.profile_data?.offline_mode || true,
        syncFrequency: user.profile_data?.sync_frequency || 30
      }
    };

    // Obter permissões
    const permissions = Object.keys(user.access_permissions || {})
      .filter(key => user.access_permissions[key] === true);

    // Configurações do app
    const appSettings: MobileAppSettings = {
      version: '1.0.0',
      minVersion: '1.0.0',
      forceUpdate: false,
      maintenanceMode: false,
      features: {
        avaliacoes: true,
        reembolsos: true,
        noticias: true,
        calendario: true,
        perfil: true,
        offline: true,
        biometric: deviceType === 'ios' || deviceType === 'android'
      },
      endpoints: {
        base: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api',
        websocket: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3000/ws',
        upload: process.env.NEXT_PUBLIC_UPLOAD_URL || 'http://localhost:3000/api/upload'
      },
      limits: {
        maxFileSize: 10 * 1024 * 1024, // 10MB
        maxFilesPerUpload: 5,
        offlineDataDays: 30
      }
    };

    // Dados de sincronização inicial
    const syncData = await getSyncData(user.id, deviceId);

    // Registrar login no log
    await supabase
      .from('mobile_auth_logs')
      .insert({
        user_id: user.id,
        device_id: deviceId,
        action: 'login',
        ip_address: request.headers.get('x-forwarded-for') || 
                   request.headers.get('x-real-ip') || 
                   'unknown',
        user_agent: request.headers.get('user-agent'),
        success: true,
        timestamp: new Date().toISOString()
      });

    const response: MobileAuthResponse = {
      success: true,
      token,
      refreshToken,
      user: mobileUser,
      permissions,
      settings: appSettings,
      syncData
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Erro no login mobile:', error);
    
    // Registrar erro no log
    try {
      const body = await request.json();
      await supabase
        .from('mobile_auth_logs')
        .insert({
          user_id: null,
          device_id: body.deviceId,
          action: 'login',
          ip_address: request.headers.get('x-forwarded-for') || 'unknown',
          user_agent: request.headers.get('user-agent'),
          success: false,
          error_message: error.message,
          timestamp: new Date().toISOString()
        });
    } catch (logError) {
      console.error('Erro ao registrar log:', logError);
    }

    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
}

async function getSyncData(userId: string, deviceId: string): Promise<SyncData> {
  try {
    // Buscar última sincronização
    const { data: lastSync } = await supabase
      .from('mobile_sync_logs')
      .select('last_sync, version')
      .eq('user_id', userId)
      .eq('device_id', deviceId)
      .order('last_sync', { ascending: false })
      .limit(1)
      .single();

    const lastSyncDate = lastSync?.last_sync || new Date(0).toISOString();
    const version = (lastSync?.version || 0) + 1;

    // Buscar avaliações
    const { data: avaliacoes } = await supabase
      .from('vw_avaliacoes_mobile')
      .select('*')
      .or(`funcionario_id.eq.${userId},avaliador_id.eq.${userId}`)
      .gte('updated_at', lastSyncDate)
      .limit(100);

    // Buscar reembolsos
    const { data: reembolsos } = await supabase
      .from('vw_reembolsos_mobile')
      .select('*')
      .eq('user_id', userId)
      .gte('updated_at', lastSyncDate)
      .limit(100);

    // Buscar notícias
    const { data: noticias } = await supabase
      .from('vw_noticias_mobile')
      .select('*')
      .eq('ativo', true)
      .gte('updated_at', lastSyncDate)
      .limit(50);

    // Buscar eventos
    const { data: eventos } = await supabase
      .from('vw_eventos_mobile')
      .select('*')
      .gte('data_inicio', new Date().toISOString())
      .gte('updated_at', lastSyncDate)
      .limit(50);

    // Buscar notificações
    const { data: notificacoes } = await supabase
      .from('mobile_notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('read', false)
      .gte('created_at', lastSyncDate)
      .limit(100);

    // Buscar IDs deletados
    const { data: deletedIds } = await supabase
      .from('mobile_deleted_items')
      .select('entity_type, entity_id')
      .eq('user_id', userId)
      .gte('deleted_at', lastSyncDate);

    const deletedByType = {
      avaliacoes: [],
      reembolsos: [],
      noticias: [],
      eventos: []
    };

    deletedIds?.forEach(item => {
      if (deletedByType[item.entity_type]) {
        deletedByType[item.entity_type].push(item.entity_id);
      }
    });

    // Atualizar log de sincronização
    await supabase
      .from('mobile_sync_logs')
      .upsert({
        user_id: userId,
        device_id: deviceId,
        last_sync: new Date().toISOString(),
        version,
        items_synced: {
          avaliacoes: avaliacoes?.length || 0,
          reembolsos: reembolsos?.length || 0,
          noticias: noticias?.length || 0,
          eventos: eventos?.length || 0,
          notificacoes: notificacoes?.length || 0
        }
      }, {
        onConflict: 'user_id,device_id'
      });

    return {
      lastSync: new Date().toISOString(),
      version,
      data: {
        avaliacoes: avaliacoes || [],
        reembolsos: reembolsos || [],
        noticias: noticias || [],
        eventos: eventos || [],
        notificacoes: notificacoes || []
      },
      deletedIds: deletedByType
    };

  } catch (error) {
    console.error('Erro ao obter dados de sincronização:', error);
    return {
      lastSync: new Date().toISOString(),
      version: 1,
      data: {
        avaliacoes: [],
        reembolsos: [],
        noticias: [],
        eventos: [],
        notificacoes: []
      },
      deletedIds: {
        avaliacoes: [],
        reembolsos: [],
        noticias: [],
        eventos: []
      }
    };
  }
}
