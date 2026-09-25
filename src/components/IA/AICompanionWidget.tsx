'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  FiMic,
  FiMicOff,
  FiX,
  FiSend,
  FiVolume2,
  FiVolumeX,
  FiZap,
  FiLoader,
} from 'react-icons/fi';
import { useRouter } from 'next/navigation';
import AnimatedABZLogo, { AICompanionStatus } from './AnimatedABZLogo';
import GenerativeDashboard from './GenerativeDashboard';
import { renderChatMarkdown, stripReasoningBlocks } from './chatMarkdown';
import { portalActionBus, AICommandPayload } from '@/lib/ia/portal-action-bus';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useCompanionSession } from '@/contexts/CompanionSessionContext';
import type { IADashboardLayout } from '@/types/ia';
import toast from 'react-hot-toast';
import { useEscapeToClose } from '@/hooks/useEscapeToClose';
import { useEscapeCapture } from '@/hooks/useEscapeCapture';
import { useRestoreFocus } from '@/hooks/useRestoreFocus';

export default function AICompanionWidget() {
  const { getToken } = useSupabaseAuth();
  const {
    sessionId,
    setSessionId,
    messages,
    setMessages,
    isOpen,
    setIsOpen,
    hydrated,
  } = useCompanionSession();
  const { markTrigger, restoreFocus } = useRestoreFocus();
  const closeCompanion = useCallback(() => {
    setIsOpen(false);
    restoreFocus();
  }, [setIsOpen, restoreFocus]);
  useEscapeToClose(isOpen, closeCompanion);
  useEscapeCapture(isOpen, closeCompanion);
  const router = useRouter();
  const [status, setStatus] = useState<AICompanionStatus>('idle');
  const [actionLabel, setActionLabel] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(false);
  const statusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    portalActionBus.setRouter(router);
  }, [router]);

  useEffect(() => {
    const unsubscribe = portalActionBus.subscribe((cmd: AICommandPayload) => {
      if (cmd.label) {
        setActionLabel(cmd.label);
        setStatus('executing');
        if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
        statusTimeoutRef.current = setTimeout(() => {
          setStatus('idle');
          setActionLabel(null);
          statusTimeoutRef.current = null;
        }, 3500);
      }
    });
    return () => {
      unsubscribe();
      if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
    };
  }, []);

  // Scroll to latest messages on open / rehydrate, and while chatting
  useEffect(() => {
    if (!isOpen || !hydrated) {
      wasOpenRef.current = false;
      return;
    }

    const justOpened = !wasOpenRef.current;
    wasOpenRef.current = true;
    // Instant jump when panel opens or session hydrates; smooth only for ongoing chat
    const behavior: ScrollBehavior = justOpened ? 'auto' : 'smooth';

    const scrollToEnd = () => {
      messagesEndRef.current?.scrollIntoView({ behavior });
    };

    const raf = requestAnimationFrame(() => {
      scrollToEnd();
      // Second pass after flex layout settles (open / mount with history)
      if (justOpened) {
        requestAnimationFrame(scrollToEnd);
      }
    });

    return () => cancelAnimationFrame(raf);
  }, [isOpen, hydrated, messages.length, isSending]);

  const handleSendMessage = useCallback(async () => {
    if (!inputText.trim() || isSending) return;

    const userQuery = inputText.trim();
    setInputText('');
    const historySnapshot = messages.slice(-8);
    setMessages(prev => [...prev, { sender: 'user', text: userQuery }]);
    setIsSending(true);
    // API wait = calm thinking (executing), NOT speaking/lip-sync spam
    setStatus('executing');

    try {
      const token = getToken();
      if (!token) {
        toast.error('Sessão expirada. Faça login novamente.');
        setStatus('idle');
        return;
      }

      const history = historySnapshot.map(m => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text,
      }));

      const res = await fetch('/api/ia/companion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          prompt: userQuery,
          history,
          session_id: sessionId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro no assistente');

      if (data.session_id) setSessionId(data.session_id);

      setMessages(prev => [
        ...prev,
        {
          sender: 'ai',
          text: data.reply || 'Pronto.',
          dashboard:
            data.dashboard &&
            typeof data.dashboard === 'object' &&
            Array.isArray((data.dashboard as IADashboardLayout).widgets)
              ? (data.dashboard as IADashboardLayout)
              : null,
        },
      ]);

      if (Array.isArray(data.commands) && data.commands.length > 0) {
        data.commands.forEach((cmd: AICommandPayload) => {
          portalActionBus.dispatch(cmd);
        });
      } else if (data.navigation?.path && data.navigation?.confidence === 'high') {
        // Fallback: API sinalizou destino claro sem array commands (não deve ocorrer após safety net)
        portalActionBus.dispatch({
          action: 'NAVIGATE',
          target: data.navigation.path,
          label: `Abrindo ${data.navigation.label || data.navigation.path}...`,
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao comunicar com o assistente';
      console.error('[AI Companion Widget]', err);
      toast.error(message);
      setMessages(prev => [
        ...prev,
        {
          sender: 'ai',
          text: `Não consegui processar agora: ${message}`,
        },
      ]);
    } finally {
      setIsSending(false);
      setStatus('idle');
    }
  }, [inputText, isSending, getToken, messages, sessionId, setMessages, setSessionId]);

  const toggleVoiceMode = useCallback(() => {
    if (status === 'listening') {
      setStatus('idle');
      toast.success('Microfone desativado');
    } else {
      setStatus('listening');
      toast('Modo voz em breve — por enquanto digite o comando.', { icon: '🎙️' });
      setTimeout(() => setStatus('idle'), 2000);
    }
  }, [status]);

  return (
    <>
      {actionLabel && (
        <div data-fab-companion-action="" className="fixed bottom-24 right-24 z-[70] bg-gray-900/90 backdrop-blur-md text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-2xl border border-blue-500/40 flex items-center gap-2.5 animate-bounce">
          <FiZap className="w-4 h-4 text-emerald-400 animate-spin" />
          <span>{actionLabel}</span>
        </div>
      )}

      <button
        type="button"
        onClick={(event) => {
          if (!isOpen) markTrigger(event.currentTarget);
          if (isOpen) closeCompanion();
          else setIsOpen(true);
        }}
        data-fab-companion=""
        className={`fixed bottom-6 right-[5.25rem] md:right-24 z-[60] w-16 h-16 rounded-full flex items-center justify-center transition-transform duration-300 bg-transparent border-0 p-0 ${
          status === 'executing'
            ? 'scale-110'
            : status === 'listening'
              ? 'scale-105'
              : 'hover:scale-110'
        }`}
        style={{
          filter: 'drop-shadow(0 8px 20px rgba(0, 91, 150, 0.28))',
        }}
        title="Companion ABZ"
        aria-label="Abrir Companion ABZ"
      >
        {isOpen ? (
          <span className="flex items-center justify-center w-14 h-14 rounded-full bg-white shadow-lg border border-gray-100">
            <FiX className="w-6 h-6 text-[#005B96]" />
          </span>
        ) : (
          <AnimatedABZLogo status={status} size={60} />
        )}
      </button>

      {isOpen && (
        <div data-fab-companion-panel="" data-modal-panel="" className="fixed bottom-24 right-24 z-[70] w-[390px] h-[520px] max-h-[85vh] bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300">
          <div className="bg-gradient-to-r from-[#005B96] via-[#0A7AB8] to-[#005B96] p-4 text-white flex items-center justify-between shadow-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-inner overflow-hidden">
                <AnimatedABZLogo status={status} size={36} />
              </div>
              <div>
                <h3 className="font-semibold text-sm leading-tight flex items-center gap-1.5">
                  Companion ABZ
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
                </h3>
                <p className="text-[11px] text-blue-100/90">Sessão global · memória ativa</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsAudioMuted(!isAudioMuted)}
                className="p-1.5 hover:bg-white/15 rounded-lg transition-colors text-white/80 hover:text-white"
                title={isAudioMuted ? 'Ativar Áudio' : 'Mutar Áudio'}
              >
                {isAudioMuted ? <FiVolumeX className="w-4 h-4" /> : <FiVolume2 className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-white/15 rounded-lg transition-colors text-white/80 hover:text-white"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="bg-gradient-to-b from-blue-50/80 to-white px-4 py-4 border-b flex flex-col items-center justify-center">
            <AnimatedABZLogo status={status} size={80} />
            <p className="text-xs font-medium text-gray-600 mt-2">
              {status === 'idle' && !isSending && 'Pronto — digite ou peça para abrir um módulo'}
              {isSending && 'Consultando a IA...'}
              {status === 'speaking' && !isSending && 'Respondendo...'}
              {status === 'listening' && !isSending && 'Ouvindo...'}
              {status === 'executing' && !isSending && 'Executando no portal...'}
            </p>
          </div>

          <div className="flex-1 p-4 overflow-y-auto space-y-3 text-sm min-h-0 bg-gray-50/50">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[95%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed shadow-sm ${
                    msg.sender === 'user'
                      ? 'bg-[#005B96] text-white rounded-br-none whitespace-pre-wrap max-w-[82%]'
                      : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none w-full'
                  }`}
                >
                  {msg.sender === 'user' ? (
                    <div className="whitespace-pre-wrap">{msg.text}</div>
                  ) : (
                    <div className="text-xs leading-relaxed text-gray-800 min-w-0">
                      {renderChatMarkdown(stripReasoningBlocks(msg.text))}
                    </div>
                  )}
                  {msg.sender === 'ai' && msg.dashboard?.widgets?.length ? (
                    <div className="mt-2 -mx-1 scale-[0.92] origin-top-left max-h-64 overflow-y-auto">
                      <GenerativeDashboard layout={msg.dashboard} />
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
            {isSending && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-100 px-3 py-2 rounded-2xl rounded-bl-none text-xs text-gray-500 flex items-center gap-2">
                  <FiLoader className="w-3.5 h-3.5 animate-spin text-[#005B96]" />
                  Pensando com a IA...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 bg-white border-t flex items-center gap-2">
            <button
              onClick={toggleVoiceMode}
              className={`p-2.5 rounded-xl transition-all ${
                status === 'listening'
                  ? 'bg-red-500 text-white animate-bounce'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
              title="Microfone"
            >
              {status === 'listening' ? <FiMicOff className="w-4 h-4" /> : <FiMic className="w-4 h-4" />}
            </button>

            <input
              type="text"
              placeholder='Ex: "abre ferias", "kpi", "meus reembolsos"...'
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
              disabled={isSending}
              className="flex-1 bg-gray-100 border-0 rounded-xl px-3.5 py-2.5 text-xs focus:ring-2 focus:ring-[#005B96] focus:bg-white transition-all outline-none disabled:opacity-60"
            />

            <button
              onClick={handleSendMessage}
              disabled={!inputText.trim() || isSending}
              className="p-2.5 bg-[#005B96] hover:bg-[#004a7a] disabled:opacity-40 text-white rounded-xl transition-colors shadow-sm"
            >
              {isSending ? <FiLoader className="w-4 h-4 animate-spin" /> : <FiSend className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
