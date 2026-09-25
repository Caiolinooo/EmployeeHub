'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LiveKitRoom, 
  RoomAudioRenderer, 
  useVoiceAssistant,
  BarVisualizer,
  useLocalParticipant,
  useConnectionState,
  useRemoteParticipants
} from '@livekit/components-react';
import { Track, ConnectionState } from 'livekit-client';
import { X, Mic, MicOff, PhoneOff, Loader2, Wifi, Volume2, ShieldAlert } from 'lucide-react';
import ModalCloseButton from '@/components/ui/ModalCloseButton';
import { useEscapeToClose } from '@/hooks/useEscapeToClose';
import { useEscapeCapture } from '@/hooks/useEscapeCapture';

// Interface do token retornado pelo nosso backend
interface LiveKitConnectionDetails {
  token: string;
  roomName: string;
  serverUrl: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  authToken: string; // Token do Portal ABZ
}

// ---------------------------------------------------------------------------
// Estados de permissão do microfone
// ---------------------------------------------------------------------------
type MicPermission = 'pending' | 'requesting' | 'granted' | 'denied' | 'error';

export default function VoiceAssistantModal({ isOpen, onClose, authToken }: Props) {
  const [connDetails, setConnDetails] = useState<LiveKitConnectionDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [micPermission, setMicPermission] = useState<MicPermission>('pending');

  // Reset ao fechar
  useEffect(() => {
    if (!isOpen) {
      setConnDetails(null);
      setError(null);
      setMicPermission('pending');
      return;
    }

    // Ao abrir, checar estado atual da permissão (sem solicitar)
    checkMicPermission();
  }, [isOpen]);

  // Checa o estado da permissão sem disparar o prompt
  const checkMicPermission = useCallback(async () => {
    try {
      // navigator.permissions.query não é suportado em todos os browsers mobile
      // mas funciona em Chrome. Safari ignora — vai para 'pending'.
      if (navigator.permissions && navigator.permissions.query) {
        const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        if (result.state === 'granted') {
          setMicPermission('granted');
          fetchToken(); // já tem permissão, pega o token direto
          return;
        }
        if (result.state === 'denied') {
          setMicPermission('denied');
          return;
        }
      }
      // state === 'prompt' ou API indisponível → ficar em 'pending'
      setMicPermission('pending');
    } catch {
      // API não suportada (Safari iOS) → ficar em 'pending'
      setMicPermission('pending');
    }
  }, [authToken]);

  // Solicita permissão de microfone com getUserMedia (requer user gesture)
  const requestMicPermission = useCallback(async () => {
    setMicPermission('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Permissão concedida — liberar tracks para não manter o mic preso
      stream.getTracks().forEach(t => t.stop());
      setMicPermission('granted');
      fetchToken();
    } catch (err: any) {
      console.error('[Voice] Mic permission denied:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setMicPermission('denied');
      } else {
        setMicPermission('error');
        setError(`Erro ao acessar microfone: ${err.message}`);
      }
    }
  }, [authToken]);

  // Busca o token do LiveKit
  const fetchToken = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ia/voice/token', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Erro ao obter autorização de voz.');
      }
      
      const data = await res.json();

      // Validar serverUrl antes de montar o LiveKitRoom
      const serverUrl = (data.serverUrl || '').trim();
      console.log('[Voice] serverUrl recebida:', JSON.stringify(serverUrl));
      console.log('[Voice] dispatchStatus:', data.dispatchStatus);
      console.log('[Voice] roomName:', data.roomName);

      if (!serverUrl) {
        throw new Error('Servidor de voz não configurado (NEXT_PUBLIC_LIVEKIT_URL ausente no ambiente).');
      }

      // Tentar parsear para garantir que é uma URL válida
      try {
        new URL(serverUrl);
      } catch {
        throw new Error(`URL do servidor de voz inválida: "${serverUrl}". Verifique NEXT_PUBLIC_LIVEKIT_URL no Vercel.`);
      }

      setConnDetails({ ...data, serverUrl });
    } catch (err: any) {
      console.error('[Voice Assistant] Token Fetch Error:', err);
      setError(err.message || 'Não foi possível conectar ao servidor de voz.');
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  useEscapeToClose(isOpen, onClose);
  useEscapeCapture(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-2xl p-4 md:p-6"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 250 }}
          data-modal-panel=""
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-lg h-[550px] max-md:h-auto max-md:max-h-[100dvh] md:h-[650px] bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
        >
          {/* Header do Modal */}
          <div className="absolute top-6 left-6 right-6 z-20 flex items-center justify-between text-slate-400">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full animate-pulse ${
                micPermission === 'granted' && connDetails ? 'bg-emerald-500' : 
                micPermission === 'denied' ? 'bg-red-500' : 'bg-amber-500'
              }`} />
              <span className="text-xs font-medium uppercase tracking-widest text-slate-400">ABZ Live Voice</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-slate-800/50 rounded-full transition-all text-slate-400 hover:text-white max-md:hidden"
            >
              <X className="w-5 h-5" />
            </button>
            <ModalCloseButton onClick={onClose} mobileOnly mountOnlyWhenMobile className="text-slate-400 hover:text-white hover:bg-slate-800/50" />
          </div>

          {/* Conteúdo Principal */}
          <div className="flex-1 flex flex-col items-center justify-center pt-12 px-6 relative">
            {/* GATE 1: Permissão de microfone pendente — mostrar CTA */}
            {micPermission === 'pending' || micPermission === 'requesting' ? (
              <div className="text-center space-y-6 max-w-xs">
                <div className="relative flex items-center justify-center">
                  <div className="w-24 h-24 bg-gradient-to-br from-blue-600/20 to-indigo-600/20 rounded-full flex items-center justify-center border border-blue-500/20">
                    <Mic className="w-10 h-10 text-blue-400" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-white font-bold text-lg">Permissão de Microfone</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    Para conversar por voz com a ABZ, precisamos de acesso ao seu microfone.
                  </p>
                </div>
                <button
                  onClick={requestMicPermission}
                  disabled={micPermission === 'requesting'}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:opacity-60 text-white rounded-2xl text-sm font-semibold transition-all flex items-center gap-2 mx-auto shadow-lg shadow-blue-500/20"
                >
                  {micPermission === 'requesting' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Aguardando permissão...
                    </>
                  ) : (
                    <>
                      <Mic className="w-4 h-4" />
                      Permitir Microfone
                    </>
                  )}
                </button>
              </div>

            ) : micPermission === 'denied' ? (
              /* GATE 2: Permissão negada — instrução ao usuário */
              <div className="text-center space-y-4 max-w-xs">
                <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center mx-auto">
                  <ShieldAlert className="w-8 h-8 text-red-400" />
                </div>
                <h3 className="text-white font-bold text-base">Microfone Bloqueado</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  O acesso ao microfone foi negado. Para usar o assistente de voz, permita o acesso nas configurações do navegador e tente novamente.
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => { setMicPermission('pending'); }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition-colors"
                  >
                    Tentar novamente
                  </button>
                  <button 
                    onClick={onClose}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl text-xs font-semibold transition-colors"
                  >
                    Fechar
                  </button>
                </div>
              </div>

            ) : loading ? (
              /* GATE 3: Buscando token */
              <div className="text-center space-y-4">
                <div className="relative flex items-center justify-center">
                  <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                  <Wifi className="w-6 h-6 text-blue-400 absolute animate-pulse" />
                </div>
                <p className="text-slate-400 text-sm font-medium animate-pulse">Iniciando conexão criptografada...</p>
              </div>

            ) : error ? (
              /* GATE 4: Erro */
              <div className="text-center space-y-4 max-w-xs">
                <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-2">
                  <X className="w-6 h-6 text-red-500" />
                </div>
                <h3 className="text-white font-bold text-base">Falha na Conexão</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{error}</p>
                <button 
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition-colors mt-2"
                >
                  Fechar
                </button>
              </div>

            ) : connDetails ? (
              /* GATE 5: Tudo OK — montar LiveKitRoom */
              <LiveKitRoom
                token={connDetails.token}
                serverUrl={connDetails.serverUrl}
                connect={true}
                audio={true}
                video={false}
                className="flex-1 flex flex-col items-center justify-center w-full"
              >
                <VoiceAssistantInner onClose={onClose} />
                {/* Componente exigido pelo LiveKit para tocar o áudio recebido */}
                <RoomAudioRenderer />
              </LiveKitRoom>
            ) : null}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Interface interna conectada ao contexto da sala LiveKit
function VoiceAssistantInner({ onClose }: { onClose: () => void }) {
  const { state, audioTrack, agent } = useVoiceAssistant();
  const { isMicrophoneEnabled, localParticipant } = useLocalParticipant();
  const connectionState = useConnectionState();
  const remoteParticipants = useRemoteParticipants();

  // === DIAGNÓSTICO DETALHADO ===
  useEffect(() => {
    console.log('[Voice] === DIAGNÓSTICO ===');
    console.log('[Voice] connectionState:', connectionState);
    console.log('[Voice] agent detected:', !!agent, agent?.identity);
    console.log('[Voice] audioTrack:', !!audioTrack, audioTrack?.source);
    console.log('[Voice] state:', state);
    console.log('[Voice] remoteParticipants:', remoteParticipants.length,
      remoteParticipants.map(p => ({
        identity: p.identity,
        audioTracks: p.audioTrackPublications.size,
        trackSIDs: Array.from(p.audioTrackPublications.values()).map(t => ({
          sid: t.trackSid,
          subscribed: t.isSubscribed,
          enabled: t.isEnabled,
          muted: t.isMuted,
        }))
      }))
    );
    console.log('[Voice] localParticipant mic:', isMicrophoneEnabled);
    console.log('[Voice] ==================');
  }, [connectionState, agent, audioTrack, state, remoteParticipants, isMicrophoneEnabled]);
  
  // Mapear estados para mensagens elegantes
  const getStatusText = () => {
    if (connectionState === ConnectionState.Connecting) {
      return 'Estabelecendo canal de voz...';
    }
    if (connectionState === ConnectionState.Reconnecting) {
      return 'Instabilidade na rede. Reconectando...';
    }
    if (connectionState === ConnectionState.Disconnected) {
      return 'Conexão encerrada.';
    }
    if (!agent) {
      return 'Aguardando o Agente de IA conectar...';
    }
    switch (state) {
      case 'connecting': return 'Estabelecendo canal de voz...';
      case 'listening': return 'Ouvindo você...';
      case 'thinking': return 'Processando resposta...';
      case 'speaking': return 'ABZ Assistant falando';
      default: return 'Conectado e Pronto';
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-between w-full py-10">
      {/* Indicador superior */}
      <div className="text-center space-y-1">
        <h2 className="text-white text-lg font-medium tracking-wide">
          {state === 'speaking' ? 'Atendente Virtual' : 'ABZ Assistant'}
        </h2>
        <p className="text-slate-400 text-xs transition-all">
          {getStatusText()}
        </p>
      </div>

      {/* Visualizador Visual de Alto Nível (Estilo ChatGPT/Gemini) */}
      <div className="relative w-full flex items-center justify-center flex-1 min-h-[250px]">
        {/* Círculos de Glow de Fundo baseados no Estado */}
        <div className="absolute w-64 h-64 bg-blue-600/10 rounded-full blur-[80px] transition-all duration-700 mix-blend-screen"
          style={{
            transform: state === 'speaking' ? 'scale(1.3)' : state === 'thinking' ? 'scale(1.1)' : 'scale(1.0)',
            background: state === 'speaking' ? 'rgba(99, 102, 241, 0.15)' : state === 'thinking' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(59, 130, 246, 0.10)'
          }}
        />
        
        <div className="absolute w-48 h-48 bg-indigo-600/10 rounded-full blur-[60px] transition-all duration-700"
          style={{
            transform: state === 'listening' ? 'scale(1.2)' : 'scale(1.0)',
          }}
        />

        {/* O ORBE / WAVEFORM PRINCIPAL */}
        <div className="relative z-10 flex items-center justify-center w-48 h-48">
          <AnimatePresence mode="wait">
            {/* Animação de "Pensando" (Thinking) - Rotação Hipnótica */}
            {state === 'thinking' && (
              <motion.div
                key="thinking"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <div className="w-28 h-28 rounded-full border-2 border-t-indigo-500 border-r-purple-500 border-b-blue-500 border-l-transparent animate-spin duration-[1.5s]" />
                <div className="absolute w-20 h-20 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-full blur-md opacity-40 animate-pulse" />
              </motion.div>
            )}

            {/* Animação de "Ouvindo" (Listening) ou "Inativo" (Idle) - Orbe que Pulsa Leve */}
            {(state === 'listening' || state === 'idle') && (
              <motion.div
                key="idle-listening"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="relative w-24 h-24 flex items-center justify-center"
              >
                {/* Ondas concêntricas leves que expandem no listening */}
                {state === 'listening' && (
                  <>
                    <motion.div 
                      animate={{ scale: [1, 1.6], opacity: [0.3, 0] }}
                      transition={{ repeat: Infinity, duration: 2, ease: "easeOut" }}
                      className="absolute inset-0 rounded-full bg-blue-500/20"
                    />
                    <motion.div 
                      animate={{ scale: [1, 2.2], opacity: [0.15, 0] }}
                      transition={{ repeat: Infinity, duration: 2, ease: "easeOut", delay: 0.6 }}
                      className="absolute inset-0 rounded-full bg-blue-400/10"
                    />
                  </>
                )}
                
                {/* Orbe Sólido Minimalista com Degradê Dinâmico */}
                <motion.div 
                  animate={state === 'listening' ? {
                    scale: [1, 1.05, 1],
                    borderRadius: ["42% 58% 70% 30% / 45% 45% 55% 55%", "55% 45% 41% 59% / 39% 53% 47% 61%", "42% 58% 70% 30% / 45% 45% 55% 55%"]
                  } : { scale: 1 }}
                  transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                  className="w-20 h-20 bg-gradient-to-tr from-blue-600 to-cyan-500 rounded-full shadow-[0_0_30px_rgba(59,130,246,0.5)] flex items-center justify-center z-20"
                >
                  {state === 'listening' ? <Mic className="w-7 h-7 text-white animate-pulse" /> : <Volume2 className="w-7 h-7 text-white opacity-80" />}
                </motion.div>
              </motion.div>
            )}

            {/* Animação de "Falando" (Speaking) - Visualizer Real da Voz da IA */}
            {state === 'speaking' && (
              <motion.div
                key="speaking"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="w-full max-w-xs flex flex-col items-center justify-center"
              >
                {/* Círculo central que pulsa suave */}
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(99,102,241,0.4)] mb-8 z-10">
                  <Volume2 className="w-6 h-6 text-white" />
                </div>
                
                {/* O Visualizador de Barras reativo do LiveKit */}
                <div className="w-full h-16 flex justify-center">
                  <BarVisualizer 
                    trackRef={audioTrack} 
                    barCount={9}
                    className="h-full w-48 flex items-center gap-1.5 lk-bar-visualizer"
                    style={{
                      ['--lk-va-bar-width' as any]: '6px',
                      ['--lk-va-bar-radius' as any]: '999px',
                      ['--lk-va-bar-color' as any]: '#6366f1', // Indigo-500
                    }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Rodapé com Ações (Controles minimalistas) */}
      <div className="w-full flex flex-col items-center gap-6">
        {/* Informação sobre transcrição ou dica caso a IA fale */}
        <div className="h-6 text-center px-4">
          {state === 'listening' && (
            <p className="text-slate-500 text-xs animate-pulse">Diga algo como "verificar meus chamados"...</p>
          )}
        </div>

        <div className="flex items-center gap-8">
          {/* Botão Mute/Unmute customizado usando useLocalParticipant */}
          <button
            onClick={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
            className="w-12 h-12 rounded-full border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800/60 transition-all"
            title={isMicrophoneEnabled ? 'Mutar microfone' : 'Ativar microfone'}
          >
            {isMicrophoneEnabled ? (
              <Mic className="w-5 h-5" />
            ) : (
              <MicOff className="w-5 h-5 text-red-400" />
            )}
          </button>

          {/* Botão de Encerrar Chamada */}
          <button
            onClick={onClose}
            className="w-16 h-16 bg-red-500 hover:bg-red-600 active:bg-red-700 rounded-full flex items-center justify-center text-white shadow-lg shadow-red-500/20 hover:shadow-red-500/30 transition-all transform hover:scale-105 active:scale-95"
            title="Encerrar conversa"
          >
            <PhoneOff className="w-6 h-6 fill-current" />
          </button>

          {/* Espaçador ou botão de configurações no futuro */}
          <div className="w-12 h-12 flex items-center justify-center text-slate-600">
            {/* Vazio por enquanto para manter simetria visual perfeita */}
          </div>
        </div>
      </div>

      {/* Custom CSS injetado para as Barras do Visualizer do LiveKit */}
      <style jsx global>{`
        .lk-bar-visualizer div {
          background: linear-gradient(to top, #4f46e5, #8b5cf6);
          width: 6px !important;
          border-radius: 99px !important;
          transition: height 0.05s ease;
        }
      `}</style>
    </div>
  );
}
