'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { getToken } from '@/lib/tokenStorage';
import DataCard from './DataCard';
import MobileShell from './MobileShell';
import TouchButton from './TouchButton';

type Channel = {
  id: string;
  name: string;
  description?: string | null;
  type?: string | null;
  last_activity?: string | null;
  member_count?: number | null;
  unreadCount?: number;
  permissions?: { isPublic?: boolean } | null;
};

type ChatMessage = {
  id: string;
  sender_id: string;
  sender_name?: string | null;
  content: string;
  type?: string;
  timestamp: string;
  is_system?: boolean;
};

const TYPE_LABEL: Record<string, string> = {
  direct: 'Conversa direta',
  text: 'Canal',
  announcement: 'Avisos',
};

function formatTime(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function MobileChat() {
  const { user, isAuthenticated, isLoading: authLoading } = useSupabaseAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [active, setActive] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgError, setMsgError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const authHeaders = (): Record<string, string> => {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const loadChannels = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/chat/channels', { headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) throw new Error(data.error || `HTTP ${res.status}`);
      setChannels(data.channels || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar as conversas.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async (channelId: string) => {
    setMsgError(null);
    try {
      const res = await fetch(`/api/chat/channels/${channelId}/messages?limit=50`, {
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) throw new Error(data.error || `HTTP ${res.status}`);
      setMessages(data.messages || []);
    } catch (e) {
      setMsgError(e instanceof Error ? e.message : 'Não foi possível carregar as mensagens.');
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) loadChannels();
    else if (!authLoading) setLoading(false);
  }, [isAuthenticated, authLoading, loadChannels]);

  useEffect(() => {
    if (!active) return undefined;
    setMsgLoading(true);
    loadMessages(active.id).finally(() => setMsgLoading(false));
    const interval = setInterval(() => loadMessages(active.id), 15000);
    return () => clearInterval(interval);
  }, [active, loadMessages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  const send = async () => {
    const content = draft.trim();
    if (!active || !content || sending) return;
    setSending(true);
    setMsgError(null);
    try {
      const res = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ channelId: active.id, content }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) throw new Error(data.error || `HTTP ${res.status}`);
      setDraft('');
      await loadMessages(active.id);
    } catch (e) {
      setMsgError(e instanceof Error ? e.message : 'Não foi possível enviar a mensagem.');
    } finally {
      setSending(false);
    }
  };

  if (active) {
    return (
      <MobileShell title={active.name || 'Conversa'}>
        <div className="flex flex-col gap-3 pb-24" data-abz-mobile-chat="">
          <TouchButton variant="ghost" className="self-start" onClick={() => setActive(null)}>
            ← Conversas
          </TouchButton>
          {msgError ? (
            <div className="abz-m-alert-error rounded-xl p-3 text-sm" role="alert">
              {msgError}
              <TouchButton variant="ghost" className="mt-1" onClick={() => loadMessages(active.id)}>
                Tentar de novo
              </TouchButton>
            </div>
          ) : null}
          {msgLoading ? (
            <p className="py-4 text-center text-sm text-gray-400">Carregando…</p>
          ) : null}
          {!msgLoading && messages.length === 0 && !msgError ? (
            <p className="py-8 text-center text-sm text-gray-500">Nenhuma mensagem ainda.</p>
          ) : null}
          {messages.map((m) => {
            const mine = m.sender_id === user?.id;
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 ${
                    mine ? 'bg-[#005B96] text-white' : 'bg-white text-gray-900 border border-gray-100'
                  }`}
                >
                  {!mine && m.sender_name ? (
                    <p className="text-xs font-semibold text-[#005B96]">{m.sender_name}</p>
                  ) : null}
                  <p className="whitespace-pre-wrap break-words text-sm">{m.content}</p>
                  <p className={`mt-1 text-[10px] ${mine ? 'text-blue-100' : 'text-gray-400'}`}>
                    {formatTime(m.timestamp)}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>
        <div
          className="fixed inset-x-0 z-20 border-t border-gray-200 bg-white px-3 py-2"
          style={{ bottom: 'calc(var(--mobile-nav-h) + env(safe-area-inset-bottom, 0px))' }}
          data-abz-mobile-chat-input=""
        >
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={1}
              placeholder="Mensagem…"
              className="min-h-[44px] flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-base"
            />
            <TouchButton type="submit" disabled={sending || !draft.trim()} className="min-h-[44px]">
              {sending ? '…' : 'Enviar'}
            </TouchButton>
          </form>
        </div>
      </MobileShell>
    );
  }

  return (
    <MobileShell title="Chat">
      <div className="flex flex-col gap-3" data-abz-mobile-chat="">
        {!isAuthenticated && !authLoading ? (
          <p className="py-8 text-center text-sm text-gray-500">Entre para acessar o chat.</p>
        ) : (
          <>
            {error ? (
              <div className="abz-m-alert-error rounded-xl p-3 text-sm" role="alert">
                {error}
                <TouchButton variant="ghost" className="mt-1" onClick={loadChannels}>
                  Tentar de novo
                </TouchButton>
              </div>
            ) : null}
            {loading ? (
              <p className="py-4 text-center text-sm text-gray-400">Carregando…</p>
            ) : null}
            {!loading && channels.length === 0 && !error ? (
              <p className="py-8 text-center text-sm text-gray-500">Nenhuma conversa disponível.</p>
            ) : null}
            {channels.map((ch) => (
              <DataCard
                key={ch.id}
                title={ch.name || 'Conversa'}
                subtitle={ch.description || TYPE_LABEL[ch.type || ''] || undefined}
                meta={ch.unreadCount ? `${ch.unreadCount}` : undefined}
                onClick={() => {
                  setMessages([]);
                  setDraft('');
                  setActive(ch);
                }}
              >
                <span className="mt-1 block text-xs text-gray-400">
                  {formatTime(ch.last_activity)}
                </span>
              </DataCard>
            ))}
          </>
        )}
      </div>
    </MobileShell>
  );
}
