/**
 * Formata resultados de tools para o LLM: summary curto + payload útil, com cap de tamanho.
 * Metadados (`_metadata`) são preservados no JSON bruto para o client acumular; a versão
 * enviada ao modelo pode omitir blobs grandes sem perder o sinal.
 *
 * Tools de e-mail/Teams usam cap maior e NÃO descartam o array detalhado (datas, participantes, etc.).
 */

const DEFAULT_MAX_CHARS = 10_000;
const COMMS_MAX_CHARS = 28_000;
const ARRAY_PREVIEW = 25;
const COMMS_ARRAY_PREVIEW = 40;

const COMMS_TOOLS = new Set([
  'meus_emails',
  'ler_email_funcionario',
  'pesquisar_emails_outlook',
  'minhas_conversas_teams',
  'pesquisar_mensagens_teams',
  'buscar_sinais_kpi_comunicacao',
]);

function isCommsTool(toolName: string): boolean {
  return COMMS_TOOLS.has(toolName);
}

function countHint(value: unknown): string | null {
  if (Array.isArray(value)) return `${value.length} item(ns)`;
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    if (typeof o.total === 'number') return `total=${o.total}`;
    if (typeof o.total_pendencias === 'number') return `pendencias=${o.total_pendencias}`;
    if (Array.isArray(o.data)) return `${o.data.length} em data`;
    if (Array.isArray(o.emails)) return `${o.emails.length} e-mail(s)`;
    if (Array.isArray(o.mensagens)) return `${o.mensagens.length} mensagem(ns)`;
    if (Array.isArray(o.chats)) return `${o.chats.length} chat(s)`;
    if (Array.isArray(o.email_sinais)) return `${o.email_sinais.length} sinal(is) e-mail`;
    if (Array.isArray(o.pendentes)) return `${o.pendentes.length} pendente(s)`;
  }
  return null;
}

function buildCommsSummary(toolName: string, parsed: unknown): string {
  if (!parsed || typeof parsed !== 'object') return `${toolName}: (vazio)`;
  const o = parsed as Record<string, unknown>;
  if (o.success === false || o.error) {
    return `${toolName}: ERRO — ${String(o.error || o.message || 'falhou')}`;
  }

  const parts: string[] = [toolName];
  const emails = Array.isArray(o.emails) ? o.emails : [];
  const mensagens = Array.isArray(o.mensagens) ? o.mensagens : [];
  const chats = Array.isArray(o.chats) ? o.chats : [];
  const emailSinais = Array.isArray(o.email_sinais) ? o.email_sinais : [];
  const teamsSinais = Array.isArray(o.teams_sinais) ? o.teams_sinais : [];

  if (emails.length) {
    parts.push(`${emails.length} e-mail(s)`);
    const sample = emails.slice(0, 3).map((e: any) => {
      const data = e.data_recebido || e.data || e.date || e.data_recebido_iso || '?';
      const de = e.de?.email || e.de?.nome || e.de || e.from || '?';
      const assunto = e.assunto || e.subject || '(sem assunto)';
      return `[${data}] ${assunto} ← ${de}`;
    });
    parts.push(sample.join(' | '));
  }
  if (mensagens.length) {
    parts.push(`${mensagens.length} msg Teams`);
    const sample = mensagens.slice(0, 2).map((m: any) => {
      const data = m.data || m.data_iso || '?';
      const de = m.de?.nome || m.de?.email || m.from || '?';
      return `[${data}] ${String(m.preview || '').slice(0, 80)} ← ${de}`;
    });
    parts.push(sample.join(' | '));
  }
  if (chats.length) parts.push(`${chats.length} chat(s)`);
  if (emailSinais.length || teamsSinais.length) {
    parts.push(`sinais email=${emailSinais.length} teams=${teamsSinais.length}`);
    if (typeof o.resumo === 'string') parts.push(o.resumo.slice(0, 160));
  }
  if (typeof o.com_data === 'number') parts.push(`com_data=${o.com_data}`);

  return parts.join(' | ').slice(0, 700);
}

function buildSummary(toolName: string, parsed: unknown): string {
  if (isCommsTool(toolName)) return buildCommsSummary(toolName, parsed);

  if (parsed == null) return `${toolName}: (vazio)`;
  if (typeof parsed === 'string') {
    const t = parsed.trim();
    if (!t) return `${toolName}: (vazio)`;
    if (t.length <= 220) return `${toolName}: ${t}`;
    return `${toolName}: ${t.slice(0, 200)}…`;
  }
  if (typeof parsed !== 'object') return `${toolName}: ${String(parsed)}`;

  const o = parsed as Record<string, unknown>;
  if (o.success === false || o.error) {
    return `${toolName}: ERRO — ${String(o.error || o.message || 'falhou')}`;
  }

  const parts: string[] = [toolName];
  if (typeof o.message === 'string' && o.message.trim()) {
    parts.push(o.message.trim().slice(0, 180));
  }
  if (o.resumo_geral && typeof o.resumo_geral === 'object') {
    const r = o.resumo_geral as Record<string, unknown>;
    if (typeof r.mensagem === 'string') parts.push(String(r.mensagem).slice(0, 200));
  }
  const hint = countHint(parsed);
  if (hint) parts.push(hint);

  // Contagens comuns de KPI / pendências
  for (const key of [
    'ferias_pendentes',
    'reembolsos_pendentes',
    'compras_pendentes',
    'avaliacoes_pendentes',
    'epis_pendentes',
    'total_pendencias',
    'total_usuarios',
  ]) {
    if (typeof o[key] === 'number') parts.push(`${key}=${o[key]}`);
  }

  if (o.ferias && typeof o.ferias === 'object') {
    const f = o.ferias as Record<string, unknown>;
    if (Array.isArray(f.pendentes)) parts.push(`ferias_pend=${f.pendentes.length}`);
  }
  if (o.reembolsos && typeof o.reembolsos === 'object') {
    const r = o.reembolsos as Record<string, unknown>;
    if (Array.isArray(r.pendentes)) parts.push(`reemb_pend=${r.pendentes.length}`);
    if (typeof r.total_pendente === 'number') parts.push(`R$_pend=${r.total_pendente}`);
  }

  return parts.join(' | ').slice(0, 480);
}

function truncateDeep(value: unknown, depth = 0, arrayPreview = ARRAY_PREVIEW): unknown {
  if (depth > 6) return '[…]';
  if (typeof value === 'string') {
    // Comms: allow longer body previews / corpo_texto (already capped at source ~2k)
    const maxStr = arrayPreview >= COMMS_ARRAY_PREVIEW ? 2200 : 1500;
    return value.length > maxStr ? `${value.slice(0, maxStr - 100)}…[truncado]` : value;
  }
  if (Array.isArray(value)) {
    const head = value.slice(0, arrayPreview).map((v) => truncateDeep(v, depth + 1, arrayPreview));
    if (value.length > arrayPreview) {
      return [...head, { _truncated: true, omitted: value.length - arrayPreview }];
    }
    return head;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === '_metadata') continue; // client já extraiu; não poluir contexto do LLM
      out[k] = truncateDeep(v, depth + 1, arrayPreview);
    }
    return out;
  }
  return value;
}

export type FormattedToolResult = {
  /** Conteúdo a enviar na mensagem role=tool */
  contentForLlm: string;
  /** JSON parseado (se houver) — útil para metadata */
  parsed: unknown | null;
};

/**
 * Prepara resultado de tool para o loop do LLM.
 * - Sempre inclui `_summary` legível
 * - Corta arrays/strings longos
 * - Cap total de caracteres (maior para e-mail/Teams)
 * - Nunca descarta o array `emails`/`mensagens` em favor só do summary
 */
export function formatToolResultForLLM(
  toolName: string,
  rawResult: string,
  options?: { maxChars?: number; keepRawForTools?: string[] }
): FormattedToolResult {
  const comms = isCommsTool(toolName);
  const maxChars = options?.maxChars ?? (comms ? COMMS_MAX_CHARS : DEFAULT_MAX_CHARS);
  const arrayPreview = comms ? COMMS_ARRAY_PREVIEW : ARRAY_PREVIEW;
  const keepRaw = options?.keepRawForTools || [];

  let parsed: unknown | null = null;
  try {
    parsed = JSON.parse(rawResult);
  } catch {
    parsed = null;
  }

  // Tools cujo payload completo já é curto / essencial
  if (keepRaw.includes(toolName) && rawResult.length <= maxChars) {
    return { contentForLlm: rawResult, parsed };
  }

  if (parsed == null) {
    const text =
      rawResult.length > maxChars
        ? `${rawResult.slice(0, maxChars - 80)}\n…[truncado ${rawResult.length - maxChars} chars]`
        : rawResult;
    return {
      contentForLlm: JSON.stringify({
        _summary: buildSummary(toolName, text),
        resultado: text,
      }),
      parsed: null,
    };
  }

  const summary = buildSummary(toolName, parsed);
  const slim = truncateDeep(parsed, 0, arrayPreview);
  const payload = {
    _summary: summary,
    ...(typeof slim === 'object' && slim && !Array.isArray(slim)
      ? (slim as Record<string, unknown>)
      : { data: slim }),
  };

  let content = JSON.stringify(payload);
  if (content.length > maxChars) {
    // Fallback: summary + arrays de alto sinal (e-mail/Teams preservados)
    const o = parsed as Record<string, unknown>;
    const compact: Record<string, unknown> = { _summary: summary };
    const preferKeys = comms
      ? [
          'success',
          'message',
          'total',
          'limite_aplicado',
          'detalhe',
          'campos',
          'com_data',
          'emails',
          'mensagens',
          'chats',
          'email_sinais',
          'teams_sinais',
          'dominios',
          'resumo',
          'comunicacao',
        ]
      : [
          'success',
          'message',
          'resumo_geral',
          'total',
          'total_pendencias',
          'ferias_pendentes',
          'reembolsos_pendentes',
          'comunicacao',
          'usuario',
          'commands',
          'instrucao_companion',
        ];

    for (const k of preferKeys) {
      if (o[k] !== undefined) compact[k] = truncateDeep(o[k], 0, arrayPreview);
    }
    content = JSON.stringify(compact);
    if (content.length > maxChars) {
      // Ainda grande: reduzir arrays mas manter amostra rica
      if (comms) {
        for (const key of ['emails', 'mensagens', 'chats', 'email_sinais', 'teams_sinais'] as const) {
          if (Array.isArray(compact[key]) && (compact[key] as unknown[]).length > 12) {
            const arr = compact[key] as unknown[];
            compact[key] = [
              ...arr.slice(0, 12).map((v) => truncateDeep(v, 0, arrayPreview)),
              { _truncated: true, omitted: arr.length - 12 },
            ];
          }
        }
        content = JSON.stringify(compact);
      }
      if (content.length > maxChars) {
        content = JSON.stringify({
          _summary: summary,
          _note: `Resultado truncado (${rawResult.length} chars originais). Use os números/datas do _summary; peça filtros/limite menor se precisar de mais detalhe.`,
          ...(comms && Array.isArray(o.emails)
            ? { emails: truncateDeep((o.emails as unknown[]).slice(0, 8), 0, arrayPreview) }
            : {}),
          ...(comms && Array.isArray(o.mensagens)
            ? { mensagens: truncateDeep((o.mensagens as unknown[]).slice(0, 8), 0, arrayPreview) }
            : {}),
        });
      }
    }
  }

  return { contentForLlm: content, parsed };
}
