/**
 * Persistência client-side da sessão do Companion (STM).
 * LTM fica no DB (ia_user_memory) e NÃO é limpa aqui.
 */
import type { IADashboardLayout } from '@/types/ia';

export type CompanionChatMsg = {
  sender: 'user' | 'ai';
  text: string;
  /** Layout normalizado de render_dashboard (opcional; omitido em persistência antiga) */
  dashboard?: IADashboardLayout | null;
};

export type CompanionSessionSnapshot = {
  userId: string;
  sessionId: string | null;
  messages: CompanionChatMsg[];
  isOpen?: boolean;
  updatedAt: string;
};

const PREFIX = 'abz:companion:session:';

export function companionStorageKey(userId: string) {
  return `${PREFIX}${userId}`;
}

/** Strip bulky dashboard payloads except last 2 AI messages (STM quota). */
function slimMessagesForStorage(messages: CompanionChatMsg[]): CompanionChatMsg[] {
  const sliced = messages.slice(-40);
  let aiWithDashLeft = 2;
  const out: CompanionChatMsg[] = [];
  for (let i = sliced.length - 1; i >= 0; i--) {
    const m = sliced[i];
    if (m.sender === 'ai' && m.dashboard && aiWithDashLeft > 0) {
      out.unshift(m);
      aiWithDashLeft -= 1;
    } else if (m.dashboard) {
      const { dashboard: _d, ...rest } = m;
      out.unshift(rest);
    } else {
      out.unshift(m);
    }
  }
  return out;
}

export function loadCompanionSession(userId: string): CompanionSessionSnapshot | null {
  if (typeof window === 'undefined' || !userId) return null;
  try {
    const raw = localStorage.getItem(companionStorageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CompanionSessionSnapshot;
    if (!parsed || parsed.userId !== userId) return null;
    if (!Array.isArray(parsed.messages)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveCompanionSession(snap: CompanionSessionSnapshot): void {
  if (typeof window === 'undefined' || !snap.userId) return;
  try {
    const payload: CompanionSessionSnapshot = {
      ...snap,
      messages: slimMessagesForStorage(snap.messages),
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(companionStorageKey(snap.userId), JSON.stringify(payload));
  } catch {
    /* quota / private mode — retry without dashboards */
    try {
      const stripped = snap.messages.map(({ dashboard: _d, ...rest }) => rest);
      localStorage.setItem(
        companionStorageKey(snap.userId),
        JSON.stringify({
          ...snap,
          messages: stripped.slice(-40),
          updatedAt: new Date().toISOString(),
        })
      );
    } catch {
      /* ignore */
    }
  }
}

/** Limpa STM do Companion para um usuário (chamar no logout) */
export function clearCompanionSession(userId?: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (userId) {
      localStorage.removeItem(companionStorageKey(userId));
    }
    // Limpa leftovers de outros users neste browser
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX)) keys.push(k);
    }
    keys.forEach(k => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}
