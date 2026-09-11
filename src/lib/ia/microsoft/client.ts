/**
 * Cliente Microsoft Graph API
 * Portal ABZ - Integração completa com Microsoft 365
 */
import type { 
  MSGraphUser, 
  MSGraphEmail, 
  MSGraphCalendarEvent,
  MSGraphChat,
  MSGraphTeamsMessage 
} from '@/types/ia-global';
import {
  GRAPH_EMAIL_SELECT_LIST,
  GRAPH_EMAIL_SELECT_WITH_BODY,
  stripHtmlToText,
} from '../graph-comms-format';

const MS_CLIENT_ID = process.env.MS_GRAPH_CLIENT_ID || '';
const MS_CLIENT_SECRET = process.env.MS_GRAPH_CLIENT_SECRET || '';
const MS_TENANT_ID = process.env.MS_GRAPH_TENANT_ID || 'common';

/** Mapeia message Graph bruto → MSGraphEmail (campos completos para enrichers). */
function mapRawMessageToEmail(m: any, includeBody = false): MSGraphEmail {
  const bodyContent = includeBody ? m.body?.content : undefined;
  const bodyType = includeBody ? m.body?.contentType : undefined;
  const preview =
    includeBody && bodyContent
      ? stripHtmlToText(bodyContent, 2000) || m.bodyPreview
      : m.bodyPreview;

  return {
    id: m.id,
    conversationId: m.conversationId,
    internetMessageId: m.internetMessageId,
    subject: m.subject,
    from: m.from,
    receivedDateTime: m.receivedDateTime,
    sentDateTime: m.sentDateTime,
    createdDateTime: m.createdDateTime,
    lastModifiedDateTime: m.lastModifiedDateTime,
    bodyPreview: preview,
    body: bodyContent,
    bodyType,
    isRead: m.isRead,
    isDraft: m.isDraft,
    hasAttachments: m.hasAttachments,
    importance: m.importance,
    categories: m.categories,
    flag: m.flag,
    parentFolderId: m.parentFolderId,
    webLink: m.webLink,
    inferenceClassification: m.inferenceClassification,
    toRecipients: m.toRecipients,
    ccRecipients: m.ccRecipients,
    bccRecipients: m.bccRecipients,
    replyTo: m.replyTo,
  };
}

interface TokenCache {
  accessToken: string;
  expiresAt: Date;
}

let appTokenCache: TokenCache | null = null;

/**
 * Obtém token de acesso via Client Credentials (Application)
 */
async function getAppAccessToken(): Promise<string> {
  // Verificar cache
  if (appTokenCache && appTokenCache.expiresAt > new Date()) {
    return appTokenCache.accessToken;
  }

  const params = new URLSearchParams({
    client_id: MS_CLIENT_ID,
    client_secret: MS_CLIENT_SECRET,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  const response = await fetch(`https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  const data = await response.json();
  
  if (!data.access_token) {
    throw new Error(`Failed to get app token: ${JSON.stringify(data)}`);
  }

  appTokenCache = {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + (data.expires_in - 60) * 1000),
  };

  return appTokenCache.accessToken;
}

/** Cap absoluto para evitar timeouts / payloads gigantes no agente IA */
export const GRAPH_HARD_CAP = 1000;
/** Tamanho de página Graph (máx. prático por request) */
const GRAPH_PAGE_SIZE = 100;

/**
 * Faz chamada genérica para Microsoft Graph
 */
async function graphCall<T>(
  endpoint: string,
  method: string = 'GET',
  body?: unknown,
  extraHeaders?: Record<string, string>
): Promise<T> {
  const token = await getAppAccessToken();
  
  const response = await fetch(`https://graph.microsoft.com/v1.0${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Graph API error (${response.status}): ${error}`);
  }

  return response.json();
}

/**
 * Segue @odata.nextLink até atingir maxItems (extração completa sob demanda).
 */
async function graphCallPaginated<T = any>(
  initialEndpoint: string,
  maxItems: number,
  extraHeaders?: Record<string, string>
): Promise<T[]> {
  const cap = Math.min(Math.max(1, maxItems), GRAPH_HARD_CAP);
  const results: T[] = [];
  let nextUrl: string | null = null;
  let relativeEndpoint: string | null = initialEndpoint;

  while (results.length < cap && (relativeEndpoint || nextUrl)) {
    const token = await getAppAccessToken();
    const url: string = nextUrl
      ? nextUrl
      : `https://graph.microsoft.com/v1.0${relativeEndpoint}`;

    const response: Response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...extraHeaders,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Graph API error (${response.status}): ${error}`);
    }

    const data: { value?: T[]; '@odata.nextLink'?: string } = await response.json();
    const page: T[] = data.value || [];
    results.push(...page);

    nextUrl = data['@odata.nextLink'] || null;
    relativeEndpoint = null;

    if (!nextUrl || page.length === 0) break;
  }

  return results.slice(0, cap);
}

/** Normaliza limite pedido pelo LLM (ex.: "tudo" → hard cap). */
export function resolveGraphLimit(limite?: number | null, fallback = 50): number {
  if (limite == null || Number.isNaN(Number(limite))) return fallback;
  const n = Number(limite);
  if (n <= 0) return GRAPH_HARD_CAP; // 0 / negativo = "trazer tudo" até o cap
  return Math.min(n, GRAPH_HARD_CAP);
}

// =====================================================
// Users / Directory
// =====================================================

/**
 * Busca usuário por email ou ID
 */
export async function getUser(userIdOrEmail: string): Promise<MSGraphUser | null> {
  try {
    const data = await graphCall<any>(`/users/${userIdOrEmail}`);
    return {
      id: data.id,
      displayName: data.displayName,
      mail: data.mail || data.userPrincipalName,
      userPrincipalName: data.userPrincipalName,
      jobTitle: data.jobTitle,
      department: data.department,
    };
  } catch (error) {
    console.error('[MS Graph] Error getting user:', error);
    return null;
  }
}

/**
 * Busca usuários por nome
 */
export async function searchUsers(searchTerm: string, limit: number = 10): Promise<MSGraphUser[]> {
  try {
    const data = await graphCall<any>(
      `/users?$filter=startswith(displayName,'${searchTerm}')&$top=${limit}&$select=id,displayName,mail,userPrincipalName,jobTitle,department`
    );
    return (data.value || []).map((u: any) => ({
      id: u.id,
      displayName: u.displayName,
      mail: u.mail || u.userPrincipalName,
      userPrincipalName: u.userPrincipalName,
      jobTitle: u.jobTitle,
      department: u.department,
    }));
  } catch (error) {
    console.error('[MS Graph] Error searching users:', error);
    return [];
  }
}

/**
 * Busca gerente de um usuário
 */
export async function getUserManager(userId: string): Promise<MSGraphUser | null> {
  try {
    const data = await graphCall<any>(`/users/${userId}/manager`);
    return {
      id: data.id,
      displayName: data.displayName,
      mail: data.mail || data.userPrincipalName,
      userPrincipalName: data.userPrincipalName,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Busca equipe direta de um usuário
 */
export async function getDirectReports(userId: string): Promise<MSGraphUser[]> {
  try {
    const data = await graphCall<any>(`/users/${userId}/directReports`);
    return (data.value || []).map((u: any) => ({
      id: u.id,
      displayName: u.displayName,
      mail: u.mail || u.userPrincipalName,
      userPrincipalName: u.userPrincipalName,
    }));
  } catch (error) {
    return [];
  }
}

/**
 * Lista todos os usuários do tenant
 */
export async function listUsers(limit: number = 100): Promise<MSGraphUser[]> {
  try {
    const data = await graphCall<any>(`/users?$top=${limit}&$select=id,displayName,mail,userPrincipalName,jobTitle,department`);
    return (data.value || []).map((u: any) => ({
      id: u.id,
      displayName: u.displayName,
      mail: u.mail || u.userPrincipalName,
      userPrincipalName: u.userPrincipalName,
      jobTitle: u.jobTitle,
      department: u.department,
    }));
  } catch (error) {
    return [];
  }
}

// =====================================================
// Mail / Email
// =====================================================

/**
 * Lista e-mails de um usuário (paginado conforme limite solicitado)
 */
export async function listEmails(userId: string, top: number = 10): Promise<MSGraphEmail[]> {
  try {
    const limit = resolveGraphLimit(top, 10);
    const pageTop = Math.min(limit, GRAPH_PAGE_SIZE);
    const rows = await graphCallPaginated<any>(
      `/users/${userId}/messages?$top=${pageTop}&$select=${GRAPH_EMAIL_SELECT_LIST}&$orderby=receivedDateTime desc`,
      limit
    );
    return rows.map((m: any) => mapRawMessageToEmail(m, false));
  } catch (error) {
    console.error('[MS Graph] Error listing emails:', error);
    return [];
  }
}

/**
 * Lê um e-mail específico (inclui corpo completo)
 */
export async function getEmail(userId: string, messageId: string): Promise<(MSGraphEmail & { body?: string; bodyType?: string }) | null> {
  try {
    const data = await graphCall<any>(
      `/users/${userId}/messages/${messageId}?$select=${GRAPH_EMAIL_SELECT_WITH_BODY}`
    );
    return mapRawMessageToEmail(data, true);
  } catch (error) {
    return null;
  }
}

/**
 * Envia e-mail
 */
export async function sendEmail(
  userId: string,
  to: string[],
  subject: string,
  body: string,
  cc?: string[]
): Promise<boolean> {
  try {
    const message = {
      subject,
      body: {
        contentType: 'HTML',
        content: body,
      },
      toRecipients: to.map(email => ({
        emailAddress: { address: email },
      })),
      ...(cc && {
        ccRecipients: cc.map(email => ({
          emailAddress: { address: email },
        })),
      }),
    };

    await graphCall(`/users/${userId}/sendMail`, 'POST', { message });
    return true;
  } catch (error) {
    console.error('[MS Graph] Error sending email:', error);
    return false;
  }
}

// =====================================================
// Calendar
// =====================================================

/**
 * Lista eventos do calendário (paginado conforme limite / período solicitado)
 */
export async function listCalendarEvents(
  userId: string,
  startDate?: string,
  endDate?: string,
  top: number = 50
): Promise<MSGraphCalendarEvent[]> {
  const limit = resolveGraphLimit(top, 50);
  const pageTop = Math.min(limit, GRAPH_PAGE_SIZE);
  let query = `/users/${userId}/calendar/events?$top=${pageTop}&$select=id,subject,start,end,location,organizer,isAllDay,bodyPreview&$orderby=start/dateTime`;

  if (startDate && endDate) {
    query += `&$filter=start/dateTime ge '${startDate}' and end/dateTime le '${endDate}'`;
  } else if (startDate) {
    query += `&$filter=start/dateTime ge '${startDate}'`;
  } else if (endDate) {
    query += `&$filter=end/dateTime le '${endDate}'`;
  }

  try {
    const rows = await graphCallPaginated<any>(query, limit);
    return rows.map((e: any) => ({
      id: e.id,
      subject: e.subject,
      start: e.start,
      end: e.end,
      location: e.location,
      organizer: e.organizer,
      isAllDay: e.isAllDay,
      bodyPreview: e.bodyPreview,
    }));
  } catch (error) {
    console.error('[MS Graph] Error listing calendar events:', error);
    return [];
  }
}

/**
 * Cria evento no calendário
 */
export async function createCalendarEvent(
  userId: string,
  event: {
    subject: string;
    start: string;
    end: string;
    location?: string;
    body?: string;
    attendees?: string[];
  }
): Promise<MSGraphCalendarEvent | null> {
  try {
    const graphEvent = {
      subject: event.subject,
      start: { dateTime: event.start, timeZone: 'America/Sao_Paulo' },
      end: { dateTime: event.end, timeZone: 'America/Sao_Paulo' },
      ...(event.location && { location: { displayName: event.location } }),
      ...(event.body && {
        body: { contentType: 'HTML', content: event.body },
      }),
      ...(event.attendees && {
        attendees: event.attendees.map(a => ({
          emailAddress: { address: a },
          type: 'required',
        })),
      }),
    };

    const data = await graphCall<any>(`/users/${userId}/calendar/events`, 'POST', graphEvent);
    return {
      id: data.id,
      subject: data.subject,
      start: data.start,
      end: data.end,
      location: data.location,
      organizer: data.organizer,
      isAllDay: data.isAllDay,
    };
  } catch (error) {
    console.error('[MS Graph] Error creating calendar event:', error);
    return null;
  }
}

/**
 * Atualiza evento
 */
export async function updateCalendarEvent(
  userId: string,
  eventId: string,
  updates: Partial<{
    subject: string;
    start: string;
    end: string;
    location: string;
    body: string;
  }>
): Promise<boolean> {
  try {
    const graphUpdates: any = {};
    if (updates.subject) graphUpdates.subject = updates.subject;
    if (updates.start) graphUpdates.start = { dateTime: updates.start, timeZone: 'America/Sao_Paulo' };
    if (updates.end) graphUpdates.end = { dateTime: updates.end, timeZone: 'America/Sao_Paulo' };
    if (updates.location) graphUpdates.location = { displayName: updates.location };
    if (updates.body) graphUpdates.body = { contentType: 'HTML', content: updates.body };

    await graphCall(`/users/${userId}/calendar/events/${eventId}`, 'PATCH', graphUpdates);
    return true;
  } catch (error) {
    console.error('[MS Graph] Error updating calendar event:', error);
    return false;
  }
}

/**
 * Cancela evento
 */
export async function deleteCalendarEvent(userId: string, eventId: string): Promise<boolean> {
  try {
    await graphCall(`/users/${userId}/calendar/events/${eventId}`, 'DELETE');
    return true;
  } catch (error) {
    return false;
  }
}

// =====================================================
// Teams
// =====================================================

/**
 * Lista chats do Teams de um usuário (app permissions: Chat.Read.All)
 */
export async function listTeamsChats(userId: string): Promise<MSGraphChat[]> {
  try {
    const limit = resolveGraphLimit(50, 50);
    const pageTop = Math.min(limit, GRAPH_PAGE_SIZE);
    // Preferir escopo do usuário; fallback para /chats se a app tiver permissão ampla
    let rows: any[] = [];
    try {
      rows = await graphCallPaginated<any>(
        `/users/${userId}/chats?$expand=members&$top=${pageTop}&$select=id,topic,chatType,lastUpdatedDateTime`,
        limit
      );
    } catch {
      rows = await graphCallPaginated<any>(
        `/chats?$expand=members&$top=${pageTop}`,
        Math.min(limit, 50)
      );
    }
    return rows.map((c: any) => ({
      id: c.id,
      topic: c.topic,
      lastMessagePreview: c.lastMessagePreview,
      members: c.members || [],
      chatType: c.chatType,
      lastUpdatedDateTime: c.lastUpdatedDateTime,
    }));
  } catch (error) {
    console.error('[MS Graph] Error listing Teams chats:', error);
    return [];
  }
}

/**
 * Pesquisa mensagens em chats do Teams por texto / período.
 */
export async function searchTeamsMessages(
  userId: string,
  options?: {
    consulta?: string;
    limite?: number;
    maxChats?: number;
  }
): Promise<Array<{
  chatId: string;
  chatTopic?: string;
  chatType?: string;
  id: string;
  bodyPreview: string;
  body?: { contentType?: string; content?: string };
  from?: any;
  createdDateTime?: string;
  importance?: string;
  messageType?: string;
  webUrl?: string;
}>> {
  const limit = resolveGraphLimit(options?.limite, 40);
  const maxChats = Math.min(options?.maxChats || 12, 25);
  const needle = (options?.consulta || '').toLowerCase().trim();
  const chats = await listTeamsChats(userId);
  const results: Array<{
    chatId: string;
    chatTopic?: string;
    chatType?: string;
    id: string;
    bodyPreview: string;
    body?: { contentType?: string; content?: string };
    from?: any;
    createdDateTime?: string;
    importance?: string;
    messageType?: string;
    webUrl?: string;
  }> = [];

  for (const chat of chats.slice(0, maxChats)) {
    if (results.length >= limit) break;
    const messages = await listChatMessages(chat.id, 30);
    for (const m of messages) {
      const bodyContent =
        typeof m.body === 'string'
          ? m.body
          : (m.body as any)?.content
            ? String((m.body as any).content)
            : '';
      const preview = stripHtmlToText(bodyContent, 2000) || '';
      if (needle && !preview.toLowerCase().includes(needle)) continue;

      results.push({
        chatId: chat.id,
        chatTopic: chat.topic,
        chatType: chat.chatType,
        id: m.id,
        bodyPreview: preview.slice(0, 500),
        body: typeof m.body === 'object' ? (m.body as any) : { contentType: 'text', content: bodyContent },
        from: m.from,
        createdDateTime: m.createdDateTime,
        importance: (m as any).importance,
        messageType: (m as any).messageType,
        webUrl: (m as any).webUrl,
      });
      if (results.length >= limit) break;
    }
  }

  return results;
}

/**
 * Lista mensagens de um chat
 */
export async function listChatMessages(chatId: string, top: number = 20): Promise<MSGraphTeamsMessage[]> {
  try {
    const limit = resolveGraphLimit(top, 20);
    const pageTop = Math.min(limit, GRAPH_PAGE_SIZE);
    const rows = await graphCallPaginated<any>(
      `/chats/${chatId}/messages?$top=${pageTop}&$select=id,body,from,createdDateTime,importance,messageType,webUrl`,
      limit
    );
    return rows.map((m: any) => ({
      id: m.id,
      body: m.body,
      from: m.from,
      createdDateTime: m.createdDateTime,
      importance: m.importance,
      messageType: m.messageType,
      webUrl: m.webUrl,
    } as MSGraphTeamsMessage & { importance?: string; messageType?: string; webUrl?: string }));
  } catch (error) {
    console.error('[MS Graph] Error listing chat messages:', error);
    return [];
  }
}

/**
 * Envia mensagem no Teams
 */
export async function sendTeamsMessage(chatId: string, message: string): Promise<boolean> {
  try {
    await graphCall(`/chats/${chatId}/messages`, 'POST', {
      body: { contentType: 'html', content: message },
    });
    return true;
  } catch (error) {
    console.error('[MS Graph] Error sending Teams message:', error);
    return false;
  }
}

// =====================================================
// OneDrive / Files
// =====================================================

/**
 * Lista arquivos do OneDrive
 */
export async function listOneDriveFiles(userId: string, path: string = ''): Promise<any[]> {
  try {
    const endpoint = path 
      ? `/users/${userId}/drive/root:/${path}:/children`
      : `/users/${userId}/drive/root/children`;
    const data = await graphCall<any>(endpoint);
    return data.value || [];
  } catch (error) {
    console.error('[MS Graph] Error listing OneDrive files:', error);
    return [];
  }
}

/**
 * Pesquisa arquivos no OneDrive
 */
export async function searchOneDriveFiles(userId: string, query: string): Promise<any[]> {
  try {
    const data = await graphCall<any>(
      `/users/${userId}/drive/root/search(q='${query}')`
    );
    return data.value || [];
  } catch (error) {
    console.error('[MS Graph] Error searching OneDrive files:', error);
    return [];
  }
}

/**
 * Baixa arquivo
 */
export async function downloadOneDriveFile(userId: string, itemId: string): Promise<string | null> {
  try {
    const data = await graphCall<any>(`/users/${userId}/drive/items/${itemId}`);
    return data['@microsoft.graph.downloadUrl'] || null;
  } catch (error) {
    return null;
  }
}

// =====================================================
// Presence
// =====================================================

/**
 * Atualiza presença do usuário
 */
export async function setPresence(userId: string, availability: string): Promise<boolean> {
  try {
    await graphCall(`/users/${userId}/presence/setPresence`, 'POST', {
      availability,
      activity: 'available',
    });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Obtém presença de usuários
 */
export async function getPresences(userIds: string[]): Promise<Record<string, any>> {
  try {
    const data = await graphCall<any>('/communications/getPresencesByUserId', 'POST', {
      ids: userIds,
    });
    const result: Record<string, any> = {};
    for (const p of data.value || []) {
      result[p.id] = p;
    }
    return result;
  } catch (error) {
    return {};
  }
}

// =====================================================
// Contacts
// =====================================================
export async function listContacts(userId: string, top = 20): Promise<any[]> {
  try {
    const limit = resolveGraphLimit(top, 20);
    const pageTop = Math.min(limit, GRAPH_PAGE_SIZE);
    return await graphCallPaginated(
      `/users/${userId}/contacts?$top=${pageTop}&$select=id,displayName,emailAddresses,businessPhones,companyName,jobTitle`,
      limit
    );
  } catch { return []; }
}

// =====================================================
// Groups
// =====================================================
export async function listGroups(top = 50): Promise<any[]> {
  try {
    const limit = resolveGraphLimit(top, 50);
    const pageTop = Math.min(limit, GRAPH_PAGE_SIZE);
    return await graphCallPaginated(
      `/groups?$top=${pageTop}&$select=id,displayName,description,groupTypes,mail,membershipRule`,
      limit
    );
  } catch { return []; }
}
export async function getGroupMembers(groupId: string): Promise<any[]> {
  try {
    const data = await graphCall<any>(`/groups/${groupId}/members?$select=id,displayName,mail,userPrincipalName`);
    return data.value || [];
  } catch { return []; }
}

// =====================================================
// Directory / Organization
// =====================================================
export async function getOrganization(): Promise<any> {
  try {
    const data = await graphCall<any>('/organization?$select=id,displayName,verifiedDomains,country,city');
    return data.value?.[0] || null;
  } catch { return null; }
}
export async function listDomains(): Promise<any[]> {
  try {
    const data = await graphCall<any>('/domains');
    return data.value || [];
  } catch { return []; }
}
export async function listAdminUnits(top = 50): Promise<any[]> {
  try {
    const data = await graphCall<any>(`/directory/administrativeUnits?$top=${top}`);
    return data.value || [];
  } catch { return []; }
}

// =====================================================
// Security
// =====================================================
export async function listSecurityAlerts(top = 20): Promise<any[]> {
  try {
    const limit = resolveGraphLimit(top, 20);
    const pageTop = Math.min(limit, GRAPH_PAGE_SIZE);
    return await graphCallPaginated(
      `/security/alerts_v2?$top=${pageTop}&$orderby=createdDateTime desc`,
      limit
    );
  } catch { return []; }
}
export async function getSecurityIncidents(top = 10): Promise<any[]> {
  try {
    const limit = resolveGraphLimit(top, 10);
    const pageTop = Math.min(limit, GRAPH_PAGE_SIZE);
    return await graphCallPaginated(
      `/security/incidents?$top=${pageTop}&$orderby=createdDateTime desc`,
      limit
    );
  } catch { return []; }
}

// =====================================================
// Audit Logs
// =====================================================
export async function getAuditLogs(top = 20): Promise<any[]> {
  try {
    const limit = resolveGraphLimit(top, 20);
    const pageTop = Math.min(limit, GRAPH_PAGE_SIZE);
    return await graphCallPaginated(
      `/auditLogs/directoryAudits?$top=${pageTop}&$orderby=activityDateTime desc`,
      limit
    );
  } catch { return []; }
}
export async function getSignInLogs(top = 20): Promise<any[]> {
  try {
    const limit = resolveGraphLimit(top, 20);
    const pageTop = Math.min(limit, GRAPH_PAGE_SIZE);
    return await graphCallPaginated(
      `/auditLogs/signIns?$top=${pageTop}&$orderby=createdDateTime desc`,
      limit
    );
  } catch { return []; }
}

// =====================================================
// Applications
// =====================================================
export async function listApplications(top = 50): Promise<any[]> {
  try {
    const limit = resolveGraphLimit(top, 50);
    const pageTop = Math.min(limit, GRAPH_PAGE_SIZE);
    return await graphCallPaginated(
      `/applications?$top=${pageTop}&$select=id,displayName,appId,signInAudience,createdDateTime`,
      limit
    );
  } catch { return []; }
}

// =====================================================
// Devices
// =====================================================
export async function listDevices(top = 50): Promise<any[]> {
  try {
    const limit = resolveGraphLimit(top, 50);
    const pageTop = Math.min(limit, GRAPH_PAGE_SIZE);
    return await graphCallPaginated(
      `/devices?$top=${pageTop}&$select=id,displayName,operatingSystem,operatingSystemVersion,isCompliant,isManaged`,
      limit
    );
  } catch { return []; }
}

// =====================================================
// Access Reviews (Compliance)
// =====================================================
export async function listAccessReviews(): Promise<any[]> {
  try {
    const data = await graphCall<any>('/identityGovernance/accessReviews/definitions?$top=20');
    return data.value || [];
  } catch { return []; }
}

// =====================================================
// Notes (OneNote)
// =====================================================
export async function listNotebooks(userId: string): Promise<any[]> {
  try {
    const data = await graphCall<any>(`/users/${userId}/onenote/notebooks?$select=id,displayName,createdDateTime,lastModifiedDateTime`);
    return data.value || [];
  } catch { return []; }
}

// =====================================================
// Tasks (To Do)
// =====================================================
export async function listTaskLists(userId: string): Promise<any[]> {
  try {
    const data = await graphCall<any>(`/users/${userId}/todo/lists`);
    return data.value || [];
  } catch { return []; }
}
export async function listTasks(userId: string, listId: string): Promise<any[]> {
  try {
    const data = await graphCall<any>(`/users/${userId}/todo/lists/${listId}/tasks?$top=50`);
    return data.value || [];
  } catch { return []; }
}

// =====================================================
// SharePoint Sites
// =====================================================
export async function listSites(search?: string): Promise<any[]> {
  try {
    const q = search ? `/sites?search=${encodeURIComponent(search)}&$top=20` : '/sites?$top=20';
    const data = await graphCall<any>(q);
    return data.value || [];
  } catch { return []; }
}
export async function getSiteLists(siteId: string): Promise<any[]> {
  try {
    const data = await graphCall<any>(`/sites/${siteId}/lists?$select=id,displayName,description,createdDateTime`);
    return data.value || [];
  } catch { return []; }
}

// =====================================================
// Bookings
// =====================================================
export async function listBookingBusinesses(): Promise<any[]> {
  try {
    const data = await graphCall<any>('/solutions/bookingBusinesses');
    return data.value || [];
  } catch { return []; }
}

// =====================================================
// Teams Channels
// =====================================================
export async function listTeamChannels(teamId: string): Promise<any[]> {
  try {
    const data = await graphCall<any>(`/teams/${teamId}/channels?$select=id,displayName,description,membershipType`);
    return data.value || [];
  } catch { return []; }
}
export async function listChannelMessages(teamId: string, channelId: string, top = 20): Promise<any[]> {
  try {
    const limit = resolveGraphLimit(top, 20);
    const pageTop = Math.min(limit, GRAPH_PAGE_SIZE);
    return await graphCallPaginated(
      `/teams/${teamId}/channels/${channelId}/messages?$top=${pageTop}`,
      limit
    );
  } catch { return []; }
}

// =====================================================
// Online Meetings
// =====================================================
export async function listOnlineMeetings(userId: string): Promise<any[]> {
  try {
    const data = await graphCall<any>(`/users/${userId}/onlineMeetings?$top=20&$orderby=startDateTime desc`);
    return data.value || [];
  } catch { return []; }
}

// =====================================================
// Service Health (Management APIs)
// =====================================================
export async function getServiceHealth(): Promise<any[]> {
  try {
    const data = await graphCall<any>('/admin/serviceAnnouncement/healthOverviews');
    return data.value || [];
  } catch { return []; }
}
export async function getServiceIssues(): Promise<any[]> {
  try {
    const data = await graphCall<any>('/admin/serviceAnnouncement/issues?$top=20&$orderby=startDateTime desc');
    return data.value || [];
  } catch { return []; }
}

// =====================================================
// Advanced Mail Search
// =====================================================

export interface SearchEmailsOptions {
  from?: string;
  to?: string;
  subject?: string;
  dateFrom?: string;
  dateTo?: string;
  folder?: string;
  hasAttachments?: boolean;
  isRead?: boolean;
  /** Quantidade desejada. 0/negativo = tudo até GRAPH_HARD_CAP. */
  top?: number;
  /** Inclui corpo completo de cada mensagem (mais lento / pesado). */
  includeBody?: boolean;
}

/**
 * Busca avançada de e-mails com filtros OData + paginação.
 * Extrai conforme a solicitação: filtros de remetente/assunto/data/pasta e limite flexível.
 */
export async function searchEmails(
  userId: string,
  query?: string,
  options?: SearchEmailsOptions
): Promise<MSGraphEmail[]> {
  try {
    const top = resolveGraphLimit(options?.top, 50);
    const pageTop = Math.min(top, GRAPH_PAGE_SIZE);
    const selectFields = options?.includeBody
      ? GRAPH_EMAIL_SELECT_WITH_BODY
      : GRAPH_EMAIL_SELECT_LIST;

    const filters: string[] = [];
    const escapeOData = (v: string) => v.replace(/'/g, "''");

    if (options?.from) {
      filters.push(`from/emailAddress/address eq '${escapeOData(options.from)}'`);
    }
    if (options?.to) {
      filters.push(`toRecipients/any(r:r/emailAddress/address eq '${escapeOData(options.to)}')`);
    }
    if (options?.subject) {
      filters.push(`contains(subject, '${escapeOData(options.subject)}')`);
    }
    if (options?.dateFrom) {
      filters.push(`receivedDateTime ge ${options.dateFrom}T00:00:00Z`);
    }
    if (options?.dateTo) {
      filters.push(`receivedDateTime le ${options.dateTo}T23:59:59Z`);
    }
    if (options?.hasAttachments !== undefined) {
      filters.push(`hasAttachments eq ${options.hasAttachments}`);
    }
    if (options?.isRead !== undefined) {
      filters.push(`isRead eq ${options.isRead}`);
    }

    const basePath = options?.folder
      ? `/users/${userId}/mailFolders/${options.folder}/messages`
      : `/users/${userId}/messages`;

    let endpoint: string;
    let extraHeaders: Record<string, string> | undefined;

    // $search não combina bem com $filter/$orderby — prioriza busca textual quando sem filtros estruturados de subject
    if (query && !options?.subject && filters.length === 0) {
      endpoint = `${basePath}?$top=${pageTop}&$search="${encodeURIComponent(query)}"&$select=${selectFields}`;
      extraHeaders = { ConsistencyLevel: 'eventual' };
    } else if (query && !options?.subject && filters.length > 0) {
      // Combina: $search + filtros via KQL no search quando possível; senão filter-only
      const kqlParts = [query];
      if (options?.from) kqlParts.push(`from:${options.from}`);
      if (options?.dateFrom) kqlParts.push(`received>=${options.dateFrom}`);
      if (options?.dateTo) kqlParts.push(`received<=${options.dateTo}`);
      if (options?.hasAttachments) kqlParts.push('hasAttachments:true');
      endpoint = `${basePath}?$top=${pageTop}&$search="${encodeURIComponent(kqlParts.join(' '))}"&$select=${selectFields}`;
      extraHeaders = { ConsistencyLevel: 'eventual' };
    } else {
      endpoint = `${basePath}?$top=${pageTop}&$select=${selectFields}&$orderby=receivedDateTime desc`;
      if (filters.length > 0) {
        endpoint += `&$filter=${filters.join(' and ')}`;
      }
    }

    const rows = await graphCallPaginated<any>(endpoint, top, extraHeaders);
    return rows.map((m: any) => mapRawMessageToEmail(m, !!options?.includeBody));
  } catch (error) {
    console.error('[MS Graph] Error searching emails:', error);
    return [];
  }
}

// =====================================================
// OneNote - Create Page
// =====================================================

/**
 * Cria uma página no OneNote
 */
export async function createOneNotePage(
  userId: string,
  sectionId: string,
  title: string,
  htmlContent: string
): Promise<any> {
  try {
    const pageHtml = `
      <!DOCTYPE html>
      <html>
        <head><title>${title}</title></head>
        <body>
          <h1>${title}</h1>
          ${htmlContent}
          <p style="color: gray; font-size: 10px;">Criado pelo Assistente IA — ABZ Group Portal — ${new Date().toLocaleString('pt-BR')}</p>
        </body>
      </html>
    `;

    const token = await getAppAccessToken();
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/users/${userId}/onenote/sections/${sectionId}/pages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/xhtml+xml',
        },
        body: pageHtml,
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OneNote API error (${response.status}): ${error}`);
    }

    const data = await response.json();
    return { id: data.id, title: data.title, link: data.links?.oneNoteWebUrl?.href };
  } catch (error) {
    console.error('[MS Graph] Error creating OneNote page:', error);
    return null;
  }
}

/**
 * Lista seções de um notebook do OneNote
 */
export async function listNotebookSections(userId: string, notebookId: string): Promise<any[]> {
  try {
    const data = await graphCall<any>(`/users/${userId}/onenote/notebooks/${notebookId}/sections?$select=id,displayName`);
    return data.value || [];
  } catch { return []; }
}

// =====================================================
// To Do - Create Task
// =====================================================

/**
 * Cria uma tarefa no Microsoft To Do
 */
export async function createToDoTask(
  userId: string,
  listId: string,
  task: {
    title: string;
    body?: string;
    dueDate?: string;
    importance?: 'low' | 'normal' | 'high';
    reminderDateTime?: string;
  }
): Promise<any> {
  try {
    const taskBody: any = {
      title: task.title,
      importance: task.importance || 'normal',
    };

    if (task.body) {
      taskBody.body = { content: task.body, contentType: 'text' };
    }

    if (task.dueDate) {
      taskBody.dueDateTime = {
        dateTime: `${task.dueDate}T23:59:00`,
        timeZone: 'America/Sao_Paulo',
      };
    }

    if (task.reminderDateTime) {
      taskBody.isReminderOn = true;
      taskBody.reminderDateTime = {
        dateTime: task.reminderDateTime,
        timeZone: 'America/Sao_Paulo',
      };
    }

    const data = await graphCall<any>(`/users/${userId}/todo/lists/${listId}/tasks`, 'POST', taskBody);
    return { id: data.id, title: data.title, status: data.status };
  } catch (error) {
    console.error('[MS Graph] Error creating To Do task:', error);
    return null;
  }
}

// Exporta o cliente
export const msGraphClient = {
  // Limits
  GRAPH_HARD_CAP, resolveGraphLimit,
  // Users
  getUser, searchUsers, getUserManager, getDirectReports, listUsers,
  // Mail
  listEmails, getEmail, sendEmail, searchEmails,
  // Calendar
  listCalendarEvents, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent,
  // Contacts
  listContacts,
  // Groups
  listGroups, getGroupMembers,
  // Directory
  getOrganization, listDomains, listAdminUnits,
  // Teams
  listTeamsChats, listChatMessages, sendTeamsMessage, listTeamChannels, listChannelMessages, searchTeamsMessages,
  // Calls/Meetings
  listOnlineMeetings,
  // Files
  listOneDriveFiles, searchOneDriveFiles, downloadOneDriveFile,
  // SharePoint
  listSites, getSiteLists,
  // Notes
  listNotebooks, listNotebookSections, createOneNotePage,
  // Tasks
  listTaskLists, listTasks, createToDoTask,
  // Security
  listSecurityAlerts, getSecurityIncidents,
  // Audit
  getAuditLogs, getSignInLogs,
  // Applications
  listApplications,
  // Devices
  listDevices,
  // Compliance
  listAccessReviews,
  // Bookings
  listBookingBusinesses,
  // Presence
  setPresence, getPresences,
  // Service Health
  getServiceHealth, getServiceIssues,
};

export default msGraphClient;