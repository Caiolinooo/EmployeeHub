/**
 * Sinais de comunicação (Email + Teams) para enriquecer KPIs.
 * Quando há pendências / conclusões no portal, varre Graph por evidências correlatas.
 * Payloads ricos: datas ISO+pt-BR, ids, previews, participantes, links.
 */
import { msGraphClient, resolveGraphLimit } from './microsoft/client';
import {
  enrichGraphEmail,
  enrichTeamsMessage,
  formatDatePtBr,
} from './graph-comms-format';

export type KpiSignalDomain =
  | 'ferias'
  | 'reembolso'
  | 'compras'
  | 'avaliacao'
  | 'epi'
  | 'pendencia'
  | 'conclusao'
  | 'geral';

export interface KpiCommSignal {
  fonte: 'email' | 'teams';
  dominio: KpiSignalDomain;
  relevancia: 'alta' | 'media' | 'baixa';
  assunto_ou_preview: string;
  preview?: string;
  de?: string;
  de_nome?: string;
  para?: string[];
  /** ISO 8601 */
  data_iso?: string;
  /** pt-BR */
  data?: string;
  chat_id?: string;
  chat_topico?: string;
  message_id?: string;
  email_id?: string;
  conversationId?: string;
  webLink?: string;
  importancia?: string;
  lido?: boolean;
  anexos?: boolean;
  pasta?: string;
  motivo: string;
  /** Detalhe estruturado opcional (e-mail/Teams enriquecido) */
  detalhe?: Record<string, unknown>;
}

export interface KpiCommsScanOptions {
  /** Mailbox / UPN a monitorar (ex: rh@groupabz.com ou o próprio admin) */
  emailUsuario: string;
  /** Domínios a pesquisar; se vazio, infere a partir de pendências */
  dominios?: KpiSignalDomain[];
  /** Limite por fonte (email e teams) */
  limite?: number;
  /** Dias para trás (filtro de data e-mail) */
  dias?: number;
}

const DOMAIN_QUERIES: Record<KpiSignalDomain, string[]> = {
  ferias: ['férias', 'ferias', 'leave', 'vacation', 'aprovação de férias', 'solicitação de férias'],
  reembolso: ['reembolso', 'reimbursement', 'despesa', 'prestação de contas', 'aprovação reembolso'],
  compras: ['compra', 'RQF', 'purchase request', 'pedido de compra', 'cotação'],
  avaliacao: ['avaliação', 'avaliacao', 'desempenho', 'performance review', 'feedback 360'],
  epi: ['EPI', 'equipamento de proteção', 'CA vencido', 'entrega de EPI'],
  pendencia: ['pendente', 'aguardando aprovação', 'favor aprovar', 'solicito aprovação', 'pending approval'],
  conclusao: ['aprovado', 'concluído', 'concluido', 'pago', 'finalizado', 'assinado', 'processado'],
  geral: ['ABZ', 'portal', 'aprovação'],
};

function daysAgoIso(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() - Math.max(1, dias));
  return d.toISOString().slice(0, 10);
}

function classifyRelevance(text: string, dominio: KpiSignalDomain): 'alta' | 'media' | 'baixa' {
  const t = text.toLowerCase();
  const pendingHits = DOMAIN_QUERIES.pendencia.some(k => t.includes(k.toLowerCase()));
  const doneHits = DOMAIN_QUERIES.conclusao.some(k => t.includes(k.toLowerCase()));
  const domainHits = DOMAIN_QUERIES[dominio].filter(k => t.includes(k.toLowerCase())).length;

  if ((pendingHits || doneHits) && domainHits > 0) return 'alta';
  if (domainHits > 0 || pendingHits || doneHits) return 'media';
  return 'baixa';
}

function inferDomainsFromPendencies(pendencias: Record<string, number | null | undefined>): KpiSignalDomain[] {
  const domains: KpiSignalDomain[] = [];
  if ((pendencias.ferias_pendentes || 0) > 0) domains.push('ferias', 'pendencia');
  if ((pendencias.reembolsos_pendentes || 0) > 0) domains.push('reembolso', 'pendencia');
  if ((pendencias.compras_pendentes || 0) > 0) domains.push('compras', 'pendencia');
  if ((pendencias.avaliacoes_pendentes || 0) > 0) domains.push('avaliacao', 'pendencia');
  if ((pendencias.epis_pendentes || 0) > 0) domains.push('epi', 'pendencia');
  if (domains.length === 0) {
    domains.push('pendencia', 'conclusao', 'geral');
  } else {
    domains.push('conclusao');
  }
  return Array.from(new Set(domains));
}

/**
 * Busca e-mails relacionados aos domínios de KPI.
 */
export async function scanEmailsForKpiSignals(
  options: KpiCommsScanOptions
): Promise<KpiCommSignal[]> {
  const limit = resolveGraphLimit(options.limite, 30);
  const dias = options.dias ?? 14;
  const dominios = options.dominios?.length ? options.dominios : (['pendencia', 'conclusao'] as KpiSignalDomain[]);
  const dateFrom = daysAgoIso(dias);
  const signals: KpiCommSignal[] = [];

  for (const dominio of dominios) {
    const terms = DOMAIN_QUERIES[dominio].slice(0, 4);
    const consulta = terms.join(' OR ');

    const emails = await msGraphClient.searchEmails(options.emailUsuario, consulta, {
      dateFrom,
      top: Math.min(Math.ceil(limit / Math.max(dominios.length, 1)) + 5, limit),
    });

    for (const e of emails) {
      const rich = enrichGraphEmail(e);
      const text = `${rich.assunto || ''} ${rich.preview || ''}`;
      const relevancia = classifyRelevance(text, dominio);
      if (relevancia === 'baixa' && dominio === 'geral') continue;

      signals.push({
        fonte: 'email',
        dominio,
        relevancia,
        assunto_ou_preview: rich.assunto || rich.preview?.slice(0, 160) || '(sem assunto)',
        preview: rich.preview,
        de: rich.de.email,
        de_nome: rich.de.nome,
        para: rich.para.map((p) => p.email || p.nome || '').filter(Boolean),
        data_iso: rich.data_recebido_iso,
        data: rich.data_recebido,
        email_id: rich.id,
        conversationId: rich.conversationId,
        webLink: rich.webLink,
        importancia: rich.importancia,
        lido: rich.lido,
        anexos: rich.anexos,
        pasta: rich.pasta,
        motivo: `E-mail correlacionado a ${dominio}`,
        detalhe: rich as unknown as Record<string, unknown>,
      });
    }
  }

  return dedupeSignals(signals).slice(0, limit);
}

/**
 * Varre chats recentes do Teams e filtra mensagens por keywords de KPI.
 */
export async function scanTeamsForKpiSignals(
  options: KpiCommsScanOptions
): Promise<KpiCommSignal[]> {
  const limit = resolveGraphLimit(options.limite, 30);
  const dominios = options.dominios?.length ? options.dominios : (['pendencia', 'conclusao'] as KpiSignalDomain[]);
  const keywords = Array.from(
    new Set(dominios.flatMap(d => DOMAIN_QUERIES[d].map(k => k.toLowerCase())))
  );

  const chats = await msGraphClient.listTeamsChats(options.emailUsuario);
  const signals: KpiCommSignal[] = [];

  for (const chat of chats.slice(0, 15)) {
    if (signals.length >= limit) break;
    const messages = await msGraphClient.listChatMessages(chat.id, 25);

    for (const m of messages) {
      const rich = enrichTeamsMessage(m, {
        id: chat.id,
        topic: chat.topic,
        chatType: chat.chatType,
      });
      const bodyText = rich.corpo_texto || rich.preview || '';
      const lower = bodyText.toLowerCase();
      const hit = keywords.find(k => lower.includes(k));
      if (!hit) continue;

      const dominio =
        dominios.find(d => DOMAIN_QUERIES[d].some(k => lower.includes(k.toLowerCase()))) ||
        'pendencia';

      signals.push({
        fonte: 'teams',
        dominio,
        relevancia: classifyRelevance(bodyText, dominio),
        assunto_ou_preview: bodyText.replace(/\s+/g, ' ').trim().slice(0, 200),
        preview: rich.preview,
        de: rich.de.email || rich.de.nome,
        de_nome: rich.de.nome,
        data_iso: rich.data_iso,
        data: rich.data || formatDatePtBr(rich.data_iso),
        chat_id: chat.id,
        chat_topico: chat.topic,
        message_id: rich.id,
        webLink: rich.webLink,
        importancia: rich.importancia,
        motivo: `Mensagem Teams com termo "${hit}" (chat: ${chat.topic || chat.id})`,
        detalhe: rich as unknown as Record<string, unknown>,
      });

      if (signals.length >= limit) break;
    }
  }

  return dedupeSignals(signals).slice(0, limit);
}

/**
 * Scan completo: e-mail + Teams, opcionalmente inferindo domínios a partir de contagens de pendência.
 */
export async function collectKpiCommunicationSignals(
  options: KpiCommsScanOptions & { pendencias?: Record<string, number | null | undefined> }
): Promise<{
  email_sinais: KpiCommSignal[];
  teams_sinais: KpiCommSignal[];
  dominios: KpiSignalDomain[];
  resumo: string;
  detalhe: 'completo';
}> {
  const dominios =
    options.dominios?.length
      ? options.dominios
      : options.pendencias
        ? inferDomainsFromPendencies(options.pendencias)
        : (['pendencia', 'conclusao'] as KpiSignalDomain[]);

  const [email_sinais, teams_sinais] = await Promise.all([
    scanEmailsForKpiSignals({ ...options, dominios }),
    scanTeamsForKpiSignals({ ...options, dominios }),
  ]);

  const altas = [...email_sinais, ...teams_sinais].filter(s => s.relevancia === 'alta').length;
  const resumo =
    email_sinais.length + teams_sinais.length === 0
      ? 'Nenhum sinal de e-mail/Teams correlacionado às pendências/conclusões no período.'
      : `Encontrados ${email_sinais.length} e-mail(s) e ${teams_sinais.length} mensagem(ns) Teams` +
        (altas > 0 ? ` (${altas} de relevância alta).` : '.');

  return { email_sinais, teams_sinais, dominios, resumo, detalhe: 'completo' };
}

function dedupeSignals(signals: KpiCommSignal[]): KpiCommSignal[] {
  const seen = new Set<string>();
  const out: KpiCommSignal[] = [];
  for (const s of signals) {
    const key = `${s.fonte}|${s.email_id || s.message_id || s.assunto_ou_preview}|${s.dominio}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out.sort((a, b) => {
    const order = { alta: 0, media: 1, baixa: 2 };
    return order[a.relevancia] - order[b.relevancia];
  });
}

export { inferDomainsFromPendencies, DOMAIN_QUERIES };
