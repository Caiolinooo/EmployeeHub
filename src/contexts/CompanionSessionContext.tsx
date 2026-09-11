'use client';

/**
 * Contexto global do Companion — sobrevive à navegação entre módulos.
 * STM: localStorage + React state
 * LTM: ia_user_memory (servidor) — não limpa no logout
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { usePathname } from 'next/navigation';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import AICompanionWidget from '@/components/IA/AICompanionWidget';
import {
  clearCompanionSession,
  CompanionChatMsg,
  loadCompanionSession,
  saveCompanionSession,
} from '@/lib/ia/companion-session-storage';

type CompanionSessionContextValue = {
  sessionId: string | null;
  setSessionId: (id: string | null) => void;
  messages: CompanionChatMsg[];
  setMessages: React.Dispatch<React.SetStateAction<CompanionChatMsg[]>>;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  userId: string | null;
  hydrated: boolean;
  clearLocalSession: () => void;
};

const CompanionSessionContext = createContext<CompanionSessionContextValue | null>(null);

const DEFAULT_GREETING: CompanionChatMsg = {
  sender: 'ai',
  text: 'Olá! Sou o Companion ABZ — conectado à IA do portal. Posso buscar dados, abrir módulos (mesmo com erro de digitação) e te guiar. Como posso ajudar?',
};

export function CompanionSessionProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading } = useSupabaseAuth();
  const pathname = usePathname();
  const userId = user?.id || null;

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<CompanionChatMsg[]>([DEFAULT_GREETING]);
  const [isOpen, setIsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Hidrata STM ao logar / troca de usuário
  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated || !userId) {
      setSessionId(null);
      setMessages([DEFAULT_GREETING]);
      setIsOpen(false);
      setHydrated(true);
      return;
    }

    const snap = loadCompanionSession(userId);
    if (snap) {
      setSessionId(snap.sessionId);
      setMessages(snap.messages.length ? snap.messages : [DEFAULT_GREETING]);
      setIsOpen(!!snap.isOpen);
    } else {
      setSessionId(null);
      setMessages([DEFAULT_GREETING]);
      setIsOpen(false);
    }
    setHydrated(true);
  }, [isAuthenticated, userId, isLoading]);

  // Persiste STM a cada mudança
  useEffect(() => {
    if (!hydrated || !userId || !isAuthenticated) return;
    saveCompanionSession({
      userId,
      sessionId,
      messages,
      isOpen,
      updatedAt: new Date().toISOString(),
    });
  }, [hydrated, userId, isAuthenticated, sessionId, messages, isOpen]);

  const clearLocalSession = useCallback(() => {
    clearCompanionSession(userId);
    setSessionId(null);
    setMessages([DEFAULT_GREETING]);
    setIsOpen(false);
  }, [userId]);

  const value = useMemo(
    () => ({
      sessionId,
      setSessionId,
      messages,
      setMessages,
      isOpen,
      setIsOpen,
      userId,
      hydrated,
      clearLocalSession,
    }),
    [sessionId, messages, isOpen, userId, hydrated, clearLocalSession]
  );

  const isAuthRoute =
    !!pathname &&
    (pathname.startsWith('/login') ||
      pathname.startsWith('/register') ||
      pathname.startsWith('/set-password') ||
      pathname.startsWith('/reset-password') ||
      pathname.startsWith('/verify-email') ||
      pathname.startsWith('/auth'));

  const showCompanion = hydrated && isAuthenticated && !isLoading && !isAuthRoute && !!userId;

  return (
    <CompanionSessionContext.Provider value={value}>
      {children}
      {showCompanion && <AICompanionWidget />}
    </CompanionSessionContext.Provider>
  );
}

export function useCompanionSession() {
  const ctx = useContext(CompanionSessionContext);
  if (!ctx) {
    throw new Error('useCompanionSession must be used within CompanionSessionProvider');
  }
  return ctx;
}

/** Versão segura para widget (não quebra se provider ausente em testes) */
export function useCompanionSessionOptional() {
  return useContext(CompanionSessionContext);
}
