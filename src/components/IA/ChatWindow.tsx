'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { IAChatMessage, IAChatSession } from '@/types/ia';
import MessageBubble from './MessageBubble';
import ChatSidebar from './ChatSidebar';
import ExchangeIntegrationModal from './ExchangeIntegrationModal';
import GenerativeDashboard from './GenerativeDashboard';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Mic } from 'lucide-react';
import VoiceAssistantModal from './VoiceAssistantModal';
import ModalCloseButton from '@/components/ui/ModalCloseButton';
import { useRestoreFocus } from '@/hooks/useRestoreFocus';

interface Props {
  token: string;
}

export default function ChatWindow({ token }: Props) {
  const [sessions, setSessions] = useState<IAChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const activeSessionIdRef = useRef<string | null>(null);
  const [messages, setMessages] = useState<IAChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingStatus, setStreamingStatus] = useState<string | null>(null);
  const [streamingMetadata, setStreamingMetadata] = useState<any>(null);
  
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  const [showExchangeModal, setShowExchangeModal] = useState(false);
  const [hasExchange, setHasExchange] = useState(true);

  const [activeDashboard, setActiveDashboard] = useState<any>(null);
  const [showDashboard, setShowDashboard] = useState(false);
  
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const { markTrigger, restoreFocus } = useRestoreFocus();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const hdrs = useCallback(() => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  }), [token]);

  const parseApiJson = useCallback(async (res: Response) => {
    const contentType = res.headers.get('Content-Type') || '';
    const text = await res.text();
    const trimmed = text.trim();

    if (!trimmed) {
      throw new Error(res.ok ? 'Resposta vazia do servidor.' : `Erro ${res.status} no servidor.`);
    }

    try {
      const parsed = JSON.parse(trimmed);
      return parsed;
    } catch {
      if (
        contentType.includes('text/html') ||
        trimmed.startsWith('<!DOCTYPE') ||
        trimmed.startsWith('<!doctype') ||
        trimmed.startsWith('<html')
      ) {
        throw new Error(`Erro no servidor (${res.status}). Verifique a API Key e o Modelo no Painel Admin (/admin/ia-config).`);
      }
      throw new Error(`Resposta inválida do servidor (${res.status}).`);
    }
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, streamingContent, streamingStatus, scrollToBottom]);

  useEffect(() => { activeSessionIdRef.current = activeSessionId; }, [activeSessionId]);

  // Update active dashboard when new messages arrive with metadata
  useEffect(() => {
    const lastDashboardMsg = [...messages].reverse().find(m => m.metadata?.dashboard);
    if (lastDashboardMsg?.metadata?.dashboard) {
      setActiveDashboard(lastDashboardMsg.metadata.dashboard);
      setShowDashboard(true);
    }
  }, [messages]);

  // Update active dashboard during streaming
  useEffect(() => {
    if (streamingMetadata?.dashboard) {
      setActiveDashboard(streamingMetadata.dashboard);
      setShowDashboard(true);
    }
  }, [streamingMetadata]);

  // Sync sidebar state from metadata
  useEffect(() => {
    if (streamingMetadata?.sidebarOpen !== undefined) {
      setSidebarOpen(streamingMetadata.sidebarOpen);
    }
    const lastSidebarMsg = [...messages].reverse().find(m => m.metadata?.sidebarOpen !== undefined);
    if (lastSidebarMsg?.metadata?.sidebarOpen !== undefined) {
      setSidebarOpen(!!lastSidebarMsg.metadata.sidebarOpen);
    }
  }, [streamingMetadata?.sidebarOpen, messages]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const mq = window.matchMedia('(max-width: 1023px)');
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      setSidebarOpen(false);
    };
    const apply = () => {
      window.removeEventListener('keydown', onKey);
      if (mq.matches) window.addEventListener('keydown', onKey);
    };
    apply();
    mq.addEventListener('change', apply);
    return () => {
      mq.removeEventListener('change', apply);
      window.removeEventListener('keydown', onKey);
    };
  }, [sidebarOpen]);

  // Listen for dashboard actions
  useEffect(() => {
    const handleDashboardAction = (e: any) => {
      const { type, action, value, rowData, itemData } = e.detail;
      
      let message = '';
      if (type === 'metric_action') {
        message = `Me dê mais detalhes sobre ${action === 'details' ? 'esta métrica' : value}`;
      } else if (type === 'table_action') {
        const id = rowData.id || rowData.Protocolo || rowData.Nro;
        message = `Gostaria de ${action === 'approve' ? 'aprovar' : 'ver detalhes de'} ${id}`;
      } else if (type === 'list_action') {
        message = `Ver mais sobre: ${itemData.title}`;
      }

      if (message) {
        setInput(message);
        inputRef.current?.focus();
      }
    };

    window.addEventListener('ia-dashboard-action', handleDashboardAction);
    return () => window.removeEventListener('ia-dashboard-action', handleDashboardAction);
  }, []);

  // Load sessions
  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const res = await fetch('/api/ia/sessions', { headers: hdrs() });
      const data = await parseApiJson(res);
      const raw: any = data?.sessions;
      const sessionsArray: any[] = Array.isArray(raw)
        ? raw
        : Array.isArray((raw as any)?.items)
          ? (raw as any).items
          : [];
      setSessions(sessionsArray);
    } catch (err) { console.error('Erro sessões:', err); }
    finally { setSessionsLoading(false); }
  }, [hdrs, parseApiJson]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  // Load Integrations
  useEffect(() => {
    async function loadIntegrations() {
      try {
        const res = await fetch('/api/user/integrations', { headers: hdrs() });
        const data = await parseApiJson(res);
        const hasExch = data.integrations?.some((i: any) => i.provider === 'microsoft_exchange');
        setHasExchange(!!hasExch);
        if (!hasExch) {
          setTimeout(() => setShowExchangeModal(true), 1500);
        }
      } catch (err) {
        console.error('Erro ao carregar integrações:', err);
      }
    }
    loadIntegrations();
  }, [hdrs, parseApiJson]);

  // Load messages
  const loadMessages = useCallback(async (sid: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/ia/chat?session_id=${sid}`, { headers: hdrs() });
      const data = await parseApiJson(res);
      const raw: any = data?.messages;
      const messagesArray: any[] = Array.isArray(raw)
        ? raw
        : Array.isArray((raw as any)?.items)
          ? (raw as any).items
          : [];
      setMessages(messagesArray);
    } catch (err) { console.error('Erro msgs:', err); }
    finally { setIsLoading(false); }
  }, [hdrs, parseApiJson]);

  const handleSelectSession = useCallback((id: string) => {
    setActiveSessionId(id);
    loadMessages(id);
  }, [loadMessages]);

  const handleNewSession = useCallback(() => {
    setActiveSessionId(null);
    setMessages([]);
    setInput('');
    setActiveDashboard(null);
    setShowDashboard(false);
    inputRef.current?.focus();
  }, []);

  const handleDeleteSession = useCallback(async (id: string) => {
    await fetch(`/api/ia/sessions?id=${id}`, { method: 'DELETE', headers: hdrs() });
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeSessionId === id) { 
      setActiveSessionId(null); 
      setMessages([]); 
      setActiveDashboard(null);
      setShowDashboard(false);
    }
  }, [activeSessionId, hdrs]);

  // Send message
  const handleSend = useCallback(async () => {
    const msg = input.trim();
    if (!msg || isSending) return;
    setIsSending(true);
    setInput('');

    const currentSessionId = activeSessionIdRef.current;

    const tempMsg: IAChatMessage = {
      id: `temp-${Date.now()}`, session_id: currentSessionId || '',
      role: 'user', content: msg, tokens_used: null, response_time_ms: null,
      metadata: {}, created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempMsg]);

    try {
      const res = await fetch('/api/ia/chat', {
        method: 'POST', headers: hdrs(),
        body: JSON.stringify({ session_id: currentSessionId, message: msg, stream: true }),
      });

      const newSid = res.headers.get('X-Session-Id');

      if (res.headers.get('Content-Type')?.includes('text/event-stream')) {
        const reader = res.body?.getReader();
        if (!reader) throw new Error('Sem stream');
        const decoder = new TextDecoder();
        let content = '';
        let statusText = null;
        let metadata = null;
        let buffer = '';
        
        setStreamingContent('');
        setStreamingStatus(null);
        setStreamingMetadata(null);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const p = JSON.parse(line.slice(6));
              if (p.meta) { if (p.session_id && !currentSessionId) setActiveSessionId(p.session_id); loadSessions(); continue; }
              if (p.status) { setStreamingStatus(p.status); statusText = p.status; }
              if (p.metadata) { setStreamingMetadata(p.metadata); metadata = p.metadata; }
              if (p.content) { 
                content += p.content; 
                setStreamingContent(content); 
              }
              if (p.done && p.fullContent) {
                content = p.fullContent;
                if (p.metadata) metadata = p.metadata;
                if (!currentSessionId && newSid) setActiveSessionId(newSid);
              }
            } catch { /* skip */ }
          }
        }

        if (content || statusText) {
          setMessages(prev => [...prev, {
            id: `a-${Date.now()}`, session_id: currentSessionId || newSid || '',
            role: 'assistant', content, status: statusText || undefined,
            metadata: metadata || {}, created_at: new Date().toISOString(),
            tokens_used: null, response_time_ms: null,
          }]);
        }
        setStreamingContent('');
        setStreamingStatus(null);
        setStreamingMetadata(null);
      } else {
        const data = await parseApiJson(res);
        if (data.error) throw new Error(data.error);
        if (data.session_id && !currentSessionId) setActiveSessionId(data.session_id);
        if (data.message) setMessages(prev => [...prev, data.message]);
        loadSessions();
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Erro ao conectar';
      const friendly =
        raw.includes('Unexpected token') || raw.includes('<!DOCTYPE') || raw.includes('is not valid JSON')
          ? 'Não foi possível obter a resposta da IA agora. Tente novamente em instantes.'
          : raw;
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`, session_id: activeSessionId || '', role: 'assistant',
        content: `❌ ${friendly}`,
        tokens_used: null, response_time_ms: null, metadata: {}, created_at: new Date().toISOString(),
      }]);
    } finally { setIsSending(false); inputRef.current?.focus(); }
  }, [input, isSending, activeSessionId, hdrs, loadSessions, parseApiJson]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }, [handleSend]);

  const suggestions = [
    { icon: '📊', text: 'Como estão minhas avaliações?' },
    { icon: '🏖️', text: 'Tenho férias pendentes?' },
    { icon: '💰', text: 'Status dos meus reembolsos' },
    { icon: '📋', text: 'Quais são minhas pendências?' },
  ];

  return (
    <div className="flex h-full bg-white relative overflow-hidden">
      {/* Sidebar - Sessions History */}
      <AnimatePresence mode="wait">
        {sidebarOpen && (
          <motion.div 
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 288, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-r border-gray-100 bg-gray-50/30 overflow-hidden shrink-0 z-30 relative h-full hidden lg:block"
          >
            <ChatSidebar 
              sessions={sessions} 
              activeSessionId={activeSessionId}
              onSelectSession={handleSelectSession} 
              onNewSession={handleNewSession}
              onDeleteSession={handleDeleteSession} 
              isLoading={sessionsLoading} 
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Sidebar (Overlay) */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div 
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-50 lg:hidden flex"
          >
            <div data-modal-panel="" className="relative w-72 bg-white shadow-2xl h-full">
              <div className="absolute right-1 top-1 z-10">
                <ModalCloseButton onClick={() => setSidebarOpen(false)} />
              </div>
              <ChatSidebar 
                sessions={sessions} 
                activeSessionId={activeSessionId}
                onSelectSession={(id) => { handleSelectSession(id); setSidebarOpen(false); }} 
                onNewSession={() => { handleNewSession(); setSidebarOpen(false); }}
                onDeleteSession={handleDeleteSession} 
                isLoading={sessionsLoading} 
              />
            </div>
            <div className="flex-1 bg-black/20 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-white relative">
        <ExchangeIntegrationModal 
          isOpen={showExchangeModal} 
          onClose={() => {
            setShowExchangeModal(false);
            restoreFocus();
          }} 
          token={token} 
        />

        <VoiceAssistantModal 
          isOpen={showVoiceModal}
          onClose={() => {
            setShowVoiceModal(false);
            restoreFocus();
          }}
          authToken={token}
        />

        {/* Top Header Bar */}
        <div className="h-14 border-b border-gray-100 px-4 flex items-center justify-between bg-white/80 backdrop-blur-sm sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 max-md:min-h-11 max-md:min-w-11 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
              title="Menu Lateral"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex flex-col">
              <h3 className="text-sm font-bold text-gray-800">ABZ Assistant</h3>
              <div className="flex items-center gap-1.5 text-[10px] text-emerald-500 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Sistema Online
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeDashboard && (
              <button 
                onClick={() => setShowDashboard(!showDashboard)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  showDashboard 
                    ? 'bg-blue-50 text-blue-600 border border-blue-200 shadow-sm' 
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                <Activity className="w-4 h-4" />
                {showDashboard ? 'Ocultar Dashboard' : 'Ver Dashboard'}
              </button>
            )}
            <button 
              onClick={(event) => {
                markTrigger(event.currentTarget);
                setShowVoiceModal(true);
              }} 
              className="p-2 max-md:min-h-11 max-md:min-w-11 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors text-gray-500" 
              title="Conversa por Voz em Tempo Real"
            >
              <Mic className="w-5 h-5" />
            </button>
            <button onClick={handleNewSession} className="p-2 max-md:min-h-11 max-md:min-w-11 hover:bg-gray-100 rounded-lg transition-colors text-gray-500" title="Nova Conversa">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6 custom-scrollbar bg-gray-50/20">
          {messages.length === 0 && !isLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center mb-6 shadow-xl relative group">
                <div className="absolute inset-0 bg-white/20 rounded-2xl animate-pulse group-hover:animate-none transition-all" />
                <span className="text-3xl text-white font-bold relative z-10">IA</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Como posso ajudar hoje?</h2>
              <p className="text-gray-500 max-w-md mb-8 text-sm">
                Sou seu assistente especializado no Portal ABZ. Posso analisar dados, verificar pendências e gerar relatórios em tempo real.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg w-full">
                {suggestions.map((s, i) => (
                  <button key={i} onClick={() => { setInput(s.text); inputRef.current?.focus(); }}
                    className={`flex items-center gap-3 px-4 py-4 bg-white rounded-2xl border border-gray-100 hover:border-blue-300 hover:bg-blue-50 transition-all text-sm text-gray-700 text-left shadow-sm hover:shadow-md group`}>
                    <span className="text-xl bg-gray-50 group-hover:bg-blue-100 w-10 h-10 rounded-xl flex items-center justify-center transition-colors">{s.icon}</span>
                    <span className="font-medium">{s.text}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : isLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="max-w-4xl mx-auto w-full">
              {messages.map(m => <MessageBubble key={m.id} message={m} />)}
              {(streamingContent || streamingStatus) && (
                <MessageBubble isStreaming message={{
                  id: 'streaming', session_id: '', role: 'assistant', 
                  content: streamingContent,
                  status: streamingStatus || undefined,
                  metadata: streamingMetadata || {},
                  tokens_used: null, response_time_ms: null, created_at: new Date().toISOString(),
                }} />
              )}
              {isSending && !streamingContent && !streamingStatus && (
                <div className="flex justify-start mb-4">
                  <div className="flex-shrink-0 mr-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-md">
                      <span className="text-white text-[10px] font-bold">IA</span>
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl rounded-bl-none px-4 py-3 shadow-sm border border-gray-100">
                    <div className="flex gap-1.5">
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="border-t border-gray-100 bg-white p-4 lg:p-6">
          <div className="max-w-4xl mx-auto flex items-end gap-3 relative">
            <div className="flex-1 relative group">
              <textarea 
                ref={inputRef} 
                value={input} 
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown} 
                placeholder="Pergunte algo ao ABZ Assistant..." 
                rows={1}
                className="w-full resize-none rounded-2xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 px-4 py-4 pr-12 text-sm transition-all outline-none max-h-48 shadow-sm group-hover:shadow-md"
                style={{ minHeight: '56px' }} 
                disabled={isSending} 
              />
              <div className="absolute right-4 bottom-4 text-[10px] text-gray-400">
                Shift + Enter para nova linha
              </div>
            </div>
            <button 
              onClick={(event) => {
                markTrigger(event.currentTarget);
                setShowVoiceModal(true);
              }}
              className="flex-shrink-0 w-14 h-14 bg-slate-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-200 text-slate-600 hover:text-blue-600 rounded-2xl transition-all flex items-center justify-center group active:scale-95 shadow-sm hover:shadow"
              title="Iniciar conversa por Voz em Tempo Real"
            >
              <Mic className="w-5 h-5 group-hover:scale-110 transition-transform" />
            </button>
            <button 
              onClick={handleSend} 
              disabled={!input.trim() || isSending}
              className="flex-shrink-0 w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 disabled:from-gray-200 disabled:to-gray-300 text-white rounded-2xl transition-all shadow-lg hover:shadow-xl disabled:shadow-none flex items-center justify-center group"
            >
              <svg className={`w-6 h-6 transition-transform ${isSending ? 'scale-0' : 'group-hover:translate-x-0.5 group-hover:-translate-y-0.5'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              {isSending && <div className="absolute w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            </button>
          </div>
          <p className="text-center text-[10px] text-gray-400 mt-3">
            O ABZ Assistant pode cometer erros. Verifique informações importantes.
          </p>
        </div>
      </div>

      {/* Persistent Dashboard / Results Panel */}
      <AnimatePresence>
        {activeDashboard && showDashboard && (
          <motion.div 
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="w-full lg:w-[450px] xl:w-[550px] border-l border-gray-100 bg-gray-50 flex flex-col h-full z-40 fixed lg:relative right-0"
          >
            <div className="h-14 border-b border-gray-200 px-6 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-bold text-gray-800 text-sm">Painel Analítico</h3>
              </div>
              <button 
                onClick={() => setShowDashboard(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-[#f8fafc]">
              <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm mb-6">
                <h4 className="text-[11px] font-bold text-blue-600 uppercase tracking-wider mb-1">Insights em Tempo Real</h4>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Os dados abaixo foram atualizados com base na sua última solicitação.
                </p>
              </div>
              <GenerativeDashboard layout={activeDashboard} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
