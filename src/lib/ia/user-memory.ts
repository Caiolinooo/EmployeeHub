/**
 * Memória de longo prazo por usuário (Hermes-like MEMORY/USER)
 * — persiste entre sessões/logins
 * — injetada no system prompt do Companion / Chat
 */
import { supabaseAdmin } from '@/lib/supabase';

export type MemoryKind =
  | 'preference'
  | 'fact'
  | 'goal'
  | 'correction'
  | 'context'
  | 'skill';

export interface UserMemoryEntry {
  id: string;
  user_id: string;
  kind: MemoryKind;
  content: string;
  importance: number;
  source: string;
  source_ref: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
}

const MAX_PROMPT_MEMORIES = 24;
const MAX_CONTENT_LEN = 500;

export async function listUserMemories(
  userId: string,
  opts?: { limit?: number; kind?: MemoryKind }
): Promise<UserMemoryEntry[]> {
  let q = supabaseAdmin
    .from('ia_user_memory')
    .select('*')
    .eq('user_id', userId)
    .eq('active', true)
    .order('importance', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(opts?.limit ?? MAX_PROMPT_MEMORIES);

  if (opts?.kind) q = q.eq('kind', opts.kind);

  const { data, error } = await q;
  if (error) {
    console.warn('[UserMemory] list error:', error.message);
    return [];
  }
  return (data || []) as UserMemoryEntry[];
}

export async function saveUserMemory(input: {
  userId: string;
  content: string;
  kind?: MemoryKind;
  importance?: number;
  source?: string;
  sourceRef?: string;
}): Promise<UserMemoryEntry | null> {
  const content = (input.content || '').trim().slice(0, MAX_CONTENT_LEN);
  if (!content || content.length < 3) return null;

  // Evita duplicata óbvia (mesmo texto ativo)
  const { data: existing } = await supabaseAdmin
    .from('ia_user_memory')
    .select('id')
    .eq('user_id', input.userId)
    .eq('active', true)
    .ilike('content', content)
    .maybeSingle();

  if (existing?.id) {
    const { data } = await supabaseAdmin
      .from('ia_user_memory')
      .update({
        importance: Math.max(input.importance ?? 5, 5),
        updated_at: new Date().toISOString(),
        last_used_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single();
    return data as UserMemoryEntry;
  }

  const { data, error } = await supabaseAdmin
    .from('ia_user_memory')
    .insert({
      user_id: input.userId,
      kind: input.kind || 'fact',
      content,
      importance: Math.min(10, Math.max(1, input.importance ?? 5)),
      source: input.source || 'companion',
      source_ref: input.sourceRef || null,
    })
    .select()
    .single();

  if (error) {
    console.warn('[UserMemory] save error:', error.message);
    return null;
  }
  return data as UserMemoryEntry;
}

export async function deactivateUserMemory(
  userId: string,
  memoryId: string
): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from('ia_user_memory')
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq('id', memoryId)
    .eq('user_id', userId);
  return !error;
}

/** Texto para injetar no system prompt (Hermes MEMORY block) */
export async function buildUserMemoryPromptBlock(userId: string): Promise<string> {
  const memories = await listUserMemories(userId, { limit: MAX_PROMPT_MEMORIES });
  if (!memories.length) return '';

  // touch last_used (best-effort, fire-and-forget)
  const ids = memories.map(m => m.id);
  void supabaseAdmin
    .from('ia_user_memory')
    .update({ last_used_at: new Date().toISOString() })
    .in('id', ids);

  const lines = memories.map(
    m => `- [${m.kind}|i${m.importance}] ${m.content}`
  );

  return (
    `\n\n## Memória do usuário (fatos importantes — use e atualize via tool salvar_memoria_usuario)\n` +
    `Estas informações persistem entre sessões. Não invente além delas.\n` +
    lines.join('\n')
  );
}

/**
 * Extrai pontos-chave simples da última troca (heurística + opcional LLM later).
 * Guarda preferências/fatos explícitos ("meu nome é", "prefiro", "lembre que").
 */
export async function extractAndSaveMemoriesFromTurn(opts: {
  userId: string;
  userMessage: string;
  assistantReply: string;
  source?: string;
  sessionId?: string;
}): Promise<number> {
  const text = `${opts.userMessage}\n${opts.assistantReply}`;
  const candidates: Array<{ content: string; kind: MemoryKind; importance: number }> = [];

  const patterns: Array<{ re: RegExp; kind: MemoryKind; importance: number }> = [
    { re: /(?:lembre(?:[- ]se)?|guarde|anote|não esqueça)(?:\s+(?:que|de))?[:\s]+(.{8,180})/gi, kind: 'fact', importance: 8 },
    { re: /(?:eu prefiro|prefiro|minha preferência(?: é)?)[:\s]+(.{5,160})/gi, kind: 'preference', importance: 7 },
    { re: /(?:meu nome é|pode me chamar de)\s+([A-Za-zÀ-ÿ]{2,40})/gi, kind: 'fact', importance: 9 },
    { re: /(?:trabalho (?:no|na|em)|meu departamento(?: é)?|sou da)\s+(.{3,80})/gi, kind: 'context', importance: 6 },
    { re: /(?:meu objetivo(?: é)?|quero (?:focar|priorizar))\s+(.{5,160})/gi, kind: 'goal', importance: 7 },
  ];

  for (const { re, kind, importance } of patterns) {
    let m: RegExpExecArray | null;
    const r = new RegExp(re.source, re.flags);
    while ((m = r.exec(opts.userMessage)) !== null) {
      const content = (m[1] || m[0]).trim().replace(/[.!?]+$/, '');
      if (content.length >= 5) candidates.push({ content, kind, importance });
    }
  }

  // Também captura se o user disse explicitamente no texto completo
  if (/sempre\s+(me\s+)?(lembre|avise|notifique)/i.test(opts.userMessage)) {
    candidates.push({
      content: opts.userMessage.trim().slice(0, 200),
      kind: 'preference',
      importance: 7,
    });
  }

  let saved = 0;
  const seen = new Set<string>();
  for (const c of candidates.slice(0, 5)) {
    const key = c.content.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const row = await saveUserMemory({
      userId: opts.userId,
      content: c.content,
      kind: c.kind,
      importance: c.importance,
      source: opts.source || 'companion',
      sourceRef: opts.sessionId,
    });
    if (row) saved += 1;
  }

  // Silencia unused text warning in some builds
  void text;
  return saved;
}
