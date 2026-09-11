import { NextRequest, NextResponse } from 'next/server';
import { verifyRequestToken } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { displayNameFromUser } from '@/lib/gestao-tripulantes/fechamento-assinatura';
import { AccessToken, AgentDispatchClient, RoomServiceClient } from 'livekit-server-sdk';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 1. Autenticação
    const tokenResult = verifyRequestToken(request);
    if (!tokenResult.valid || !tokenResult.payload) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const userId = tokenResult.payload.userId;

    // 2. Buscar dados complementares do usuário para personalizar
    const { data: profile } = await supabaseAdmin
      .from('users_unified')
      .select('first_name, last_name, name, email')
      .eq('id', userId)
      .single();

    const userName = displayNameFromUser(profile || {});

    // 3. Verificar variáveis de ambiente do LiveKit
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    let livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || '';
    
    console.log('[LiveKit API] Env check:', {
      hasKey: !!apiKey,
      hasSecret: !!apiSecret,
      rawUrl: livekitUrl,
      urlLength: livekitUrl.length,
    });

    if (!apiKey || !apiSecret || !livekitUrl) {
      console.error('[LiveKit API] Variáveis LIVEKIT não configuradas.');
      return NextResponse.json({ 
        error: 'Configuração do servidor de voz ausente.',
        debug: {
          hasKey: !!apiKey,
          hasSecret: !!apiSecret,
          hasUrl: !!livekitUrl,
        }
      }, { status: 500 });
    }

    // Sanitizar URL — remover espaços, garantir protocolo wss://
    livekitUrl = livekitUrl.trim();
    if (!livekitUrl.startsWith('wss://') && !livekitUrl.startsWith('ws://')) {
      livekitUrl = `wss://${livekitUrl}`;
    }
    // Remover trailing slash
    livekitUrl = livekitUrl.replace(/\/+$/, '');

    // Validar que a URL é parseable
    try {
      new URL(livekitUrl);
    } catch {
      console.error(`[LiveKit API] URL inválida após sanitização: "${livekitUrl}"`);
      return NextResponse.json({ 
        error: 'URL do servidor de voz mal formatada.',
      }, { status: 500 });
    }

    console.log(`[LiveKit API] URL sanitizada: ${livekitUrl}`);

    // 4. Criar identificador de Sala único por usuário para conversa privada
    const roomName = `abz_voice_${userId.slice(0, 8)}`;

    // 5. Criar Token de Acesso LiveKit
    const at = new AccessToken(apiKey, apiSecret, {
      identity: `user_${userId.slice(0, 8)}_${Math.random().toString(36).substring(2, 7)}`,
      name: userName,
    });

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();

    // 6. Garantir que a sala existe e despachar o agente explicitamente
    const httpUrl = livekitUrl.replace('wss://', 'https://').replace('ws://', 'http://');
    let dispatchStatus = 'pending';
    
    try {
      const roomSvc = new RoomServiceClient(httpUrl, apiKey, apiSecret);
      await roomSvc.createRoom({ name: roomName, emptyTimeout: 300 });
      console.log(`[LiveKit] Sala criada/verificada: ${roomName}`);

      const dispatch = new AgentDispatchClient(httpUrl, apiKey, apiSecret);
      await dispatch.createDispatch(roomName, 'abz-voice');
      dispatchStatus = 'dispatched';
      console.log(`[LiveKit] Agente 'abz-voice' despachado para sala: ${roomName}`);
    } catch (dispatchErr: any) {
      dispatchStatus = `error: ${dispatchErr.message}`;
      console.error(`[LiveKit] FALHA CRÍTICA ao despachar agente:`, dispatchErr);
    }

    return NextResponse.json({
      token,
      roomName,
      serverUrl: livekitUrl,
      dispatchStatus,
    });

  } catch (error: any) {
    console.error('[LiveKit Token Error]', error);
    return NextResponse.json({ error: 'Falha ao gerar token de acesso em tempo real.' }, { status: 500 });
  }
}
