/**
 * Formatação rica de e-mails / Teams (Microsoft Graph) para tools LLM.
 * Cada item traz o máximo de campos práticos; listas limitadas (20–50) mas completas.
 */

const BODY_TEXT_CAP = 2000;
const BODY_PREVIEW_CAP = 500;

export type GraphRecipient = {
  nome?: string;
  email?: string;
};

export type EnrichedEmail = {
  id: string;
  conversationId?: string;
  internetMessageId?: string;
  assunto: string;
  de: GraphRecipient;
  para: GraphRecipient[];
  cc: GraphRecipient[];
  bcc?: GraphRecipient[];
  replyTo?: GraphRecipient[];
  /** ISO 8601 */
  data_recebido_iso?: string;
  /** ISO 8601 */
  data_enviado_iso?: string;
  /** ISO 8601 */
  data_criado_iso?: string;
  /** ISO 8601 */
  data_modificado_iso?: string;
  /** pt-BR legível */
  data_recebido?: string;
  data_enviado?: string;
  data_criado?: string;
  data_modificado?: string;
  preview: string;
  /** Texto plano truncado (HTML stripped); sem dumps HTML */
  corpo_texto?: string;
  corpo_tipo?: string;
  lido: boolean;
  rascunho?: boolean;
  anexos: boolean;
  importancia?: string;
  categorias?: string[];
  flag_status?: string;
  pasta_id?: string;
  pasta?: string;
  webLink?: string;
  inferenceClassification?: string;
};

export type EnrichedTeamsMessage = {
  id: string;
  chat_id?: string;
  chat_topico?: string;
  chat_tipo?: string;
  de: GraphRecipient;
  /** ISO 8601 */
  data_iso?: string;
  /** pt-BR */
  data?: string;
  preview: string;
  corpo_texto?: string;
  corpo_tipo?: string;
  importancia?: string;
  webLink?: string;
  messageType?: string;
};

export type EnrichedTeamsChat = {
  id: string;
  topico?: string;
  tipo?: string;
  data_atualizado_iso?: string;
  data_atualizado?: string;
  preview_ultima?: string;
  webLink?: string;
  participantes: GraphRecipient[];
  total_participantes?: number;
};

const WELL_KNOWN_FOLDERS: Record<string, string> = {
  inbox: 'Caixa de entrada',
  sentitems: 'Itens enviados',
  drafts: 'Rascunhos',
  deleteditems: 'Itens excluídos',
  junkemail: 'Lixo eletrônico',
  archive: 'Arquivo',
  outbox: 'Caixa de saída',
};

/** Converte ISO → data/hora pt-BR (America/Sao_Paulo quando possível). */
export function formatDatePtBr(iso?: string | null): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  try {
    return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  } catch {
    return d.toLocaleString('pt-BR');
  }
}

/** Remove HTML e normaliza whitespace; cap de caracteres. */
export function stripHtmlToText(htmlOrText?: string | null, maxChars = BODY_TEXT_CAP): string | undefined {
  if (!htmlOrText) return undefined;
  const text = String(htmlOrText)
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return undefined;
  return text.length > maxChars ? `${text.slice(0, maxChars)}…` : text;
}

function mapRecipient(r: any): GraphRecipient {
  const ea = r?.emailAddress || r;
  return {
    nome: ea?.name || ea?.displayName || undefined,
    email: ea?.address || ea?.email || ea?.mail || undefined,
  };
}

function mapRecipients(list: any[] | undefined | null): GraphRecipient[] {
  if (!Array.isArray(list)) return [];
  return list.map(mapRecipient).filter((r) => r.email || r.nome);
}

function resolveFolderLabel(folderIdOrWellKnown?: string | null): string | undefined {
  if (!folderIdOrWellKnown) return undefined;
  const key = String(folderIdOrWellKnown).toLowerCase();
  if (WELL_KNOWN_FOLDERS[key]) return WELL_KNOWN_FOLDERS[key];
  return folderIdOrWellKnown;
}

/**
 * Campos $select padrão para listagens Graph (completos, sem body HTML).
 */
export const GRAPH_EMAIL_SELECT_LIST =
  'id,conversationId,internetMessageId,subject,from,toRecipients,ccRecipients,bccRecipients,replyTo,' +
  'receivedDateTime,sentDateTime,createdDateTime,lastModifiedDateTime,' +
  'bodyPreview,isRead,isDraft,hasAttachments,importance,categories,flag,parentFolderId,webLink,inferenceClassification';

/**
 * Campos $select quando incluir_corpo=true (body + list fields).
 */
export const GRAPH_EMAIL_SELECT_WITH_BODY = `${GRAPH_EMAIL_SELECT_LIST},body`;

/**
 * Enriquece um message Graph (raw ou MSGraphEmail parcial) para o LLM.
 */
export function enrichGraphEmail(
  raw: any,
  options?: { includeBody?: boolean; folderHint?: string; bodyCap?: number }
): EnrichedEmail {
  const includeBody = !!options?.includeBody;
  const bodyCap = options?.bodyCap ?? BODY_TEXT_CAP;
  const bodyContent = raw?.body?.content ?? (typeof raw?.body === 'string' ? raw.body : undefined);
  const bodyType = raw?.body?.contentType ?? raw?.bodyType;
  const previewRaw = raw?.bodyPreview || '';
  const preview =
    stripHtmlToText(previewRaw, BODY_PREVIEW_CAP) ||
    (previewRaw ? String(previewRaw).slice(0, BODY_PREVIEW_CAP) : '');

  let corpo_texto: string | undefined;
  if (includeBody && bodyContent) {
    corpo_texto =
      bodyType === 'html' || /<[a-z][\s\S]*>/i.test(String(bodyContent))
        ? stripHtmlToText(bodyContent, bodyCap)
        : stripHtmlToText(String(bodyContent), bodyCap);
  } else if (raw?.corpo_texto) {
    corpo_texto = stripHtmlToText(String(raw.corpo_texto), bodyCap);
  }

  const received = raw?.receivedDateTime || raw?.data_recebido_iso;
  const sent = raw?.sentDateTime || raw?.data_enviado_iso;
  const created = raw?.createdDateTime || raw?.data_criado_iso;
  const modified = raw?.lastModifiedDateTime || raw?.data_modificado_iso;
  const folderId = raw?.parentFolderId || raw?.pasta_id;
  const folderHint = options?.folderHint || raw?.pasta;

  const fromSrc = raw?.from || (raw?.de ? { emailAddress: raw.de } : undefined);

  return {
    id: String(raw?.id || ''),
    conversationId: raw?.conversationId || undefined,
    internetMessageId: raw?.internetMessageId || undefined,
    assunto: raw?.subject || raw?.assunto || '(sem assunto)',
    de: mapRecipient(fromSrc),
    para: mapRecipients(raw?.toRecipients || raw?.para),
    cc: mapRecipients(raw?.ccRecipients || raw?.cc),
    bcc: mapRecipients(raw?.bccRecipients || raw?.bcc).length
      ? mapRecipients(raw?.bccRecipients || raw?.bcc)
      : undefined,
    replyTo: mapRecipients(raw?.replyTo).length ? mapRecipients(raw?.replyTo) : undefined,
    data_recebido_iso: received || undefined,
    data_enviado_iso: sent || undefined,
    data_criado_iso: created || undefined,
    data_modificado_iso: modified || undefined,
    data_recebido: formatDatePtBr(received),
    data_enviado: formatDatePtBr(sent),
    data_criado: formatDatePtBr(created),
    data_modificado: formatDatePtBr(modified),
    preview,
    corpo_texto,
    corpo_tipo: bodyType || (corpo_texto ? 'text' : undefined),
    lido: raw?.isRead ?? raw?.lido ?? false,
    rascunho: raw?.isDraft ?? raw?.rascunho ?? undefined,
    anexos: raw?.hasAttachments ?? raw?.anexos ?? false,
    importancia: raw?.importance || raw?.importancia || undefined,
    categorias: Array.isArray(raw?.categories) ? raw.categories : undefined,
    flag_status: raw?.flag?.flagStatus || raw?.flag_status || undefined,
    pasta_id: folderId || undefined,
    pasta: resolveFolderLabel(folderHint) || (folderId ? resolveFolderLabel(folderId) : undefined),
    webLink: raw?.webLink || undefined,
    inferenceClassification: raw?.inferenceClassification || undefined,
  };
}

export function enrichGraphEmails(
  rows: any[],
  options?: { includeBody?: boolean; folderHint?: string; bodyCap?: number; maxItems?: number }
): EnrichedEmail[] {
  const max = options?.maxItems ?? 50;
  return (rows || []).slice(0, max).map((r) => enrichGraphEmail(r, options));
}

function mapTeamsFrom(from: any): GraphRecipient {
  if (!from) return {};
  if (from.user) {
    return {
      nome: from.user.displayName || from.user.displayName,
      email: from.user.email || from.user.userIdentityType,
    };
  }
  if (from.emailAddress) return mapRecipient(from);
  if (from.displayName || from.email) {
    return { nome: from.displayName, email: from.email };
  }
  return mapRecipient(from);
}

export function enrichTeamsMessage(
  raw: any,
  chatMeta?: { id?: string; topic?: string; chatType?: string }
): EnrichedTeamsMessage {
  const bodyObj = typeof raw?.body === 'object' ? raw.body : null;
  const bodyContent =
    typeof raw?.body === 'string'
      ? raw.body
      : bodyObj?.content || raw?.bodyPreview || raw?.preview || '';
  const bodyType = bodyObj?.contentType || raw?.corpo_tipo;
  const text = stripHtmlToText(bodyContent, BODY_TEXT_CAP) || '';
  const created = raw?.createdDateTime || raw?.data_iso;

  return {
    id: String(raw?.id || ''),
    chat_id: chatMeta?.id || raw?.chatId || raw?.chat_id,
    chat_topico: chatMeta?.topic || raw?.chatTopic || raw?.chat_topico,
    chat_tipo: chatMeta?.chatType || raw?.chat_tipo,
    de: mapTeamsFrom(raw?.from) || {
      nome: typeof raw?.from === 'string' ? raw.from : undefined,
      email: undefined,
    },
    data_iso: created || undefined,
    data: formatDatePtBr(created),
    preview: text.slice(0, BODY_PREVIEW_CAP),
    corpo_texto: text.length > BODY_PREVIEW_CAP ? text : text || undefined,
    corpo_tipo: bodyType,
    importancia: raw?.importance || undefined,
    webLink: raw?.webUrl || raw?.webLink || undefined,
    messageType: raw?.messageType || undefined,
  };
}

export function enrichTeamsMessages(
  rows: any[],
  options?: { maxItems?: number; chatMeta?: { id?: string; topic?: string; chatType?: string } }
): EnrichedTeamsMessage[] {
  const max = options?.maxItems ?? 40;
  return (rows || []).slice(0, max).map((r) => enrichTeamsMessage(r, options?.chatMeta));
}

export function enrichTeamsChat(raw: any): EnrichedTeamsChat {
  const members = Array.isArray(raw?.members) ? raw.members : [];
  const participantes: GraphRecipient[] = members.map((m: any) => ({
    nome: m.displayName || m?.user?.displayName,
    email: m.email || m?.user?.email || m?.email || undefined,
  })).filter((p: GraphRecipient) => p.nome || p.email);

  const updated = raw?.lastUpdatedDateTime || raw?.data_atualizado_iso;

  return {
    id: String(raw?.id || ''),
    topico: raw?.topic || raw?.topico || undefined,
    tipo: raw?.chatType || raw?.tipo || undefined,
    data_atualizado_iso: updated || undefined,
    data_atualizado: formatDatePtBr(updated),
    preview_ultima: raw?.lastMessagePreview
      ? stripHtmlToText(String(raw.lastMessagePreview), BODY_PREVIEW_CAP)
      : undefined,
    webLink: raw?.webUrl || raw?.webLink || undefined,
    participantes,
    total_participantes: participantes.length || undefined,
  };
}

export function enrichTeamsChats(rows: any[], maxItems = 40): EnrichedTeamsChat[] {
  return (rows || []).slice(0, maxItems).map(enrichTeamsChat);
}

/** Payload padrão de lista de e-mails para tools. */
export function buildEmailListPayload(
  emails: any[],
  options?: {
    includeBody?: boolean;
    folderHint?: string;
    limiteAplicado?: number;
    hardCap?: number;
    maxItems?: number;
    extra?: Record<string, unknown>;
  }
): Record<string, unknown> {
  const maxItems = options?.maxItems ?? 50;
  const enriched = enrichGraphEmails(emails, {
    includeBody: options?.includeBody,
    folderHint: options?.folderHint,
    maxItems,
  });
  const withDates = enriched.filter((e) => e.data_recebido_iso).length;
  return {
    total: enriched.length,
    limite_aplicado: options?.limiteAplicado ?? enriched.length,
    ...(options?.hardCap != null ? { hard_cap: options.hardCap } : {}),
    detalhe: 'completo',
    campos: [
      'id',
      'conversationId',
      'assunto',
      'de',
      'para',
      'cc',
      'datas(iso+pt-BR)',
      'preview',
      'corpo_texto?',
      'lido',
      'anexos',
      'importancia',
      'pasta',
      'webLink',
    ],
    com_data: withDates,
    emails: enriched,
    ...(options?.extra || {}),
  };
}
