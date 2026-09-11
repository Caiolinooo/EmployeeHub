/**
 * Skills procedurais por usuário (Hermes Agent–like procedural memory)
 * — persistem entre sessões/logins (como LTM)
 * — injetadas no system prompt do Companion / Chat
 * — criadas via tool ou heurística pós-turno
 */
import { supabaseAdmin } from '@/lib/supabase';

export interface UserSkillEntry {
  id: string;
  user_id: string;
  name: string;
  description: string;
  procedure: string;
  tags: string[];
  source: string;
  is_active: boolean;
  use_count: number;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
}

const MAX_SKILLS_PER_USER = 30;
const MAX_PROMPT_SKILLS = 8;
const MAX_NAME_LEN = 80;
const MAX_DESC_LEN = 200;
const MAX_PROCEDURE_LEN = 4000;
const MAX_TAGS = 8;

const SECRET_PATTERNS = [
  /password\s*[:=]/i,
  /senha\s*[:=]/i,
  /api[_-]?key\s*[:=]/i,
  /secret\s*[:=]/i,
  /bearer\s+[a-z0-9\-._~+/]+=*/i,
  /eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]+\./, // JWT-ish
  /supabase.*service.?role/i,
];

function sanitizeText(input: string, max: number): string {
  return (input || '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim()
    .slice(0, max);
}

function looksLikeSecret(text: string): boolean {
  return SECRET_PATTERNS.some((re) => re.test(text));
}

function normalizeName(name: string): string {
  return sanitizeText(name, MAX_NAME_LEN)
    .toLowerCase()
    .replace(/[^a-z0-9à-ÿ\s\-_/]/gi, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function normalizeTags(tags?: string[] | string): string[] {
  const arr = Array.isArray(tags)
    ? tags
    : String(tags || '')
        .split(/[,;|]/)
        .map((t) => t.trim());
  return [...new Set(arr.map((t) => sanitizeText(t, 32).toLowerCase()).filter(Boolean))].slice(
    0,
    MAX_TAGS
  );
}

export async function countActiveSkills(userId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('ia_user_skills')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_active', true);
  if (error) {
    console.warn('[UserSkills] count error:', error.message);
    return 0;
  }
  return count ?? 0;
}

export async function listUserSkills(
  userId: string,
  opts?: { limit?: number; query?: string }
): Promise<UserSkillEntry[]> {
  let q = supabaseAdmin
    .from('ia_user_skills')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('use_count', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(opts?.limit ?? MAX_PROMPT_SKILLS);

  const { data, error } = await q;
  if (error) {
    console.warn('[UserSkills] list error:', error.message);
    return [];
  }

  let rows = (data || []) as UserSkillEntry[];
  const query = (opts?.query || '').trim().toLowerCase();
  if (query) {
    rows = rows.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.description.toLowerCase().includes(query) ||
        (s.tags || []).some((t) => t.includes(query)) ||
        s.procedure.toLowerCase().includes(query)
    );
  }
  return rows;
}

export async function createUserSkill(input: {
  userId: string;
  name: string;
  description?: string;
  procedure: string;
  tags?: string[] | string;
  source?: string;
}): Promise<{ skill: UserSkillEntry | null; error?: string }> {
  const name = normalizeName(input.name);
  const description = sanitizeText(input.description || '', MAX_DESC_LEN);
  const procedure = sanitizeText(input.procedure, MAX_PROCEDURE_LEN);
  const tags = normalizeTags(input.tags);

  if (!name || name.length < 2) {
    return { skill: null, error: 'Nome da skill inválido (mín. 2 caracteres).' };
  }
  if (!procedure || procedure.length < 10) {
    return { skill: null, error: 'Procedimento muito curto (mín. 10 caracteres).' };
  }
  if (looksLikeSecret(procedure) || looksLikeSecret(description) || looksLikeSecret(name)) {
    return {
      skill: null,
      error: 'Skill rejeitada: não armazene senhas, tokens ou secrets em skills.',
    };
  }

  const active = await countActiveSkills(input.userId);
  if (active >= MAX_SKILLS_PER_USER) {
    return {
      skill: null,
      error: `Limite de ${MAX_SKILLS_PER_USER} skills ativas atingido. Esqueça uma skill antes de criar outra.`,
    };
  }

  // Upsert por nome (reativa se existir inativa com mesmo nome)
  const { data: existing } = await supabaseAdmin
    .from('ia_user_skills')
    .select('*')
    .eq('user_id', input.userId)
    .ilike('name', name)
    .maybeSingle();

  if (existing?.id) {
    const { data, error } = await supabaseAdmin
      .from('ia_user_skills')
      .update({
        description: description || existing.description,
        procedure,
        tags: tags.length ? tags : existing.tags,
        source: input.source || existing.source || 'companion',
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .eq('user_id', input.userId)
      .select()
      .single();

    if (error) {
      console.warn('[UserSkills] update error:', error.message);
      return { skill: null, error: error.message };
    }
    return { skill: data as UserSkillEntry };
  }

  const { data, error } = await supabaseAdmin
    .from('ia_user_skills')
    .insert({
      user_id: input.userId,
      name,
      description,
      procedure,
      tags,
      source: input.source || 'companion',
    })
    .select()
    .single();

  if (error) {
    console.warn('[UserSkills] create error:', error.message);
    return { skill: null, error: error.message };
  }
  return { skill: data as UserSkillEntry };
}

export async function useUserSkill(
  userId: string,
  skillIdOrName: string
): Promise<{ skill: UserSkillEntry | null; promptBlock: string; error?: string }> {
  const key = (skillIdOrName || '').trim();
  if (!key) return { skill: null, promptBlock: '', error: 'Informe id ou nome da skill.' };

  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key);

  let q = supabaseAdmin
    .from('ia_user_skills')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true);

  q = isUuid ? q.eq('id', key) : q.ilike('name', normalizeName(key) || key);

  const { data, error } = await q.maybeSingle();
  if (error || !data) {
    return { skill: null, promptBlock: '', error: 'Skill não encontrada.' };
  }

  const skill = data as UserSkillEntry;
  void supabaseAdmin
    .from('ia_user_skills')
    .update({
      use_count: (skill.use_count || 0) + 1,
      last_used_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', skill.id)
    .eq('user_id', userId);

  const promptBlock =
    `\n\n## Skill ativa: ${skill.name}\n` +
    (skill.description ? `${skill.description}\n` : '') +
    `Siga este procedimento:\n${skill.procedure}\n`;

  return { skill, promptBlock };
}

export async function forgetUserSkill(
  userId: string,
  skillIdOrName: string
): Promise<boolean> {
  const key = (skillIdOrName || '').trim();
  if (!key) return false;

  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key);

  let q = supabaseAdmin
    .from('ia_user_skills')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('user_id', userId);

  q = isUuid ? q.eq('id', key) : q.ilike('name', normalizeName(key) || key);

  const { error } = await q;
  return !error;
}

/** Texto para injetar no system prompt (índice de skills — progressive disclosure) */
export async function buildUserSkillsPromptBlock(userId: string): Promise<string> {
  const skills = await listUserSkills(userId, { limit: MAX_PROMPT_SKILLS });
  if (!skills.length) return '';

  const lines = skills.map(
    (s) =>
      `- **${s.name}**${s.description ? `: ${s.description}` : ''}` +
      (s.tags?.length ? ` [${s.tags.join(', ')}]` : '') +
      ` (uses=${s.use_count || 0})`
  );

  return (
    `\n\n## Skills do usuário (procedimentos reutilizáveis — Hermes-like)\n` +
    `Estas skills persistem entre sessões. Quando o fluxo bater, chame \`usar_skill\` com o nome.\n` +
    `Crie skills novas com \`criar_skill_usuario\` quando o usuário ensinar um fluxo ou você descobrir um procedimento multi-passos útil no portal.\n` +
    `Não armazene senhas/tokens. Limite ~${MAX_SKILLS_PER_USER} skills.\n` +
    lines.join('\n')
  );
}

/**
 * Heurística: se o usuário ensinou um fluxo explícito, cria skill automaticamente.
 */
export async function extractAndSaveSkillsFromTurn(opts: {
  userId: string;
  userMessage: string;
  assistantReply: string;
  source?: string;
}): Promise<number> {
  const msg = opts.userMessage || '';
  const candidates: Array<{ name: string; description: string; procedure: string; tags: string[] }> =
    [];

  // "ensine/salve/crie skill: ..." ou "sempre que X faça Y"
  const teachRe =
    /(?:ensine|salve|guarde|crie|aprenda)\s+(?:uma?\s+)?(?:skill|procedimento|fluxo|workflow)?[:\s]+(.{15,400})/gi;
  let m: RegExpExecArray | null;
  while ((m = teachRe.exec(msg)) !== null) {
    const body = (m[1] || '').trim();
    if (body.length < 15) continue;
    const nameGuess =
      body
        .split(/[:.\-–—]/)[0]
        .trim()
        .slice(0, 40) || 'procedimento-portal';
    candidates.push({
      name: nameGuess,
      description: `Ensinado pelo usuário`,
      procedure: body,
      tags: ['ensinado', 'usuario'],
    });
  }

  const alwaysRe =
    /(?:sempre que|quando eu|se eu)\s+(.{5,120}?),\s*(?:você|vc|voce)?\s*(?:deve|faça|faz|abra|use|chame)\s+(.{10,200})/gi;
  while ((m = alwaysRe.exec(msg)) !== null) {
    const trigger = (m[1] || '').trim();
    const action = (m[2] || '').trim();
    if (trigger.length < 4 || action.length < 8) continue;
    candidates.push({
      name: `quando-${trigger.slice(0, 30)}`,
      description: `Quando: ${trigger}`,
      procedure: `## When to use\n- ${trigger}\n\n## Steps\n1. ${action}\n`,
      tags: ['regra', 'portal'],
    });
  }

  // Procedimento numerado explícito no pedido do usuário
  if (/(?:passo\s*1|1\)|1\.)\s*.{5,}(?:passo\s*2|2\)|2\.)/i.test(msg) && msg.length > 40) {
    candidates.push({
      name: 'procedimento-ensinado',
      description: 'Fluxo multi-passos ensinado pelo usuário',
      procedure: msg.trim().slice(0, MAX_PROCEDURE_LEN),
      tags: ['multi-passo', 'usuario'],
    });
  }

  let saved = 0;
  const seen = new Set<string>();
  for (const c of candidates.slice(0, 2)) {
    const key = normalizeName(c.name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const { skill } = await createUserSkill({
      userId: opts.userId,
      name: c.name,
      description: c.description,
      procedure: c.procedure,
      tags: c.tags,
      source: opts.source || 'companion-auto',
    });
    if (skill) saved += 1;
  }

  void opts.assistantReply;
  return saved;
}
