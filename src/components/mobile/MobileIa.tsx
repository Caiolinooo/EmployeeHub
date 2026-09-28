'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { getToken } from '@/lib/tokenStorage';
import MobileShell from './MobileShell';
import TouchButton from './TouchButton';

type IaMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export default function MobileIa() {
  const { isAuthenticated, isLoading: authLoading } = useSupabaseAuth();
  const [messages, setMessages] = useState<IaMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, sending]);

  const send = async () => {
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    setError(null);
    setMessages((prev) => [...prev, { role: 'user', content }]);
    setDraft('');
    try {
      const token = getToken();
      const res = await fetch('/api/ia/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: content,
          ...(sessionId ? { session_id: sessionId } : {}),
          stream: false,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if (data.session_id) setSessionId(data.session_id);
      const answer = data.message?.content || 'Sem resposta no momento.';
      setMessages((prev) => [...prev, { role: 'assistant', content: answer }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível obter resposta do assistente.');
    } finally {
      setSending(false);
    }
  };

  const reset = () => {
    setMessages([]);
    setSessionId(null);
    setDraft('');
    setError(null);
  };

  return (
    <MobileShell title="Assistente IA">
      <div className="flex flex-col gap-3 pb-24" data-abz-mobile-ia="">
        {!isAuthenticated && !authLoading ? (
          <p className="py-8 text-center text-sm text-gray-500">Entre para conversar com o assistente.</p>
        ) : (
          <>
            <TouchButton
              variant="ghost"
              className="self-start"
              onClick={reset}
              disabled={messages.length === 0 && !sessionId}
            >
              Nova conversa
            </TouchButton>
            {error ? (
              <div className="abz-m-alert-error rounded-xl p-3 text-sm" role="alert">
                {error}
              </div>
            ) : null}
            {messages.length === 0 && !sending ? (
              <p className="py-8 text-center text-sm text-gray-500">
                Pergunte algo ao assistente ABZ.
              </p>
            ) : null}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                    m.role === 'user'
                      ? 'bg-[#005B96] text-white'
                      : 'bg-white text-gray-900 border border-gray-100'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words text-sm">{m.content}</p>
                </div>
              </div>
            ))}
            {sending ? (
              <p className="py-2 text-center text-sm text-gray-400">Assistente pensando…</p>
            ) : null}
            <div ref={endRef} />
          </>
        )}
      </div>
      {isAuthenticated ? (
        <div
          className="fixed inset-x-0 z-20 border-t border-gray-200 bg-white px-3 py-2"
          style={{ bottom: 'calc(var(--mobile-nav-h) + env(safe-area-inset-bottom, 0px))' }}
          data-abz-mobile-ia-input=""
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
              placeholder="Pergunte ao assistente…"
              className="min-h-[44px] flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-base"
            />
            <TouchButton type="submit" disabled={sending || !draft.trim()} className="min-h-[44px]">
              {sending ? '…' : 'Enviar'}
            </TouchButton>
          </form>
        </div>
      ) : null}
    </MobileShell>
  );
}
