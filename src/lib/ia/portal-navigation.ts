/**
 * Resolução de navegação do portal ABZ
 * — aliases, sinônimos, contextos e tolerância a erros de digitação (Levenshtein)
 */

export interface PortalRoute {
  id: string;
  path: string;
  label: string;
  /** Palavras-chave exatas / stems (já normalizadas) */
  keywords: string[];
  /** Frases de contexto (ex.: "aprovacao de ferias") */
  contexts: string[];
}

export interface PortalNavMatch {
  route: PortalRoute;
  score: number;
  matchedOn: string;
  confidence: 'high' | 'medium' | 'low';
}

/** Catálogo canônico de destinos do Companion / navegar_portal */
export const PORTAL_ROUTES: PortalRoute[] = [
  {
    id: 'ferias',
    path: '/ferias',
    label: 'Férias',
    keywords: ['ferias', 'feria', 'feririas', 'ferias', 'vacation', 'leave', 'afastamento ferias', 'gozo'],
    contexts: [
      'aprovacao de ferias',
      'solicitar ferias',
      'minhas ferias',
      'saldo de ferias',
      'pedido de ferias',
      'quero tirar ferias',
      'ver ferias',
    ],
  },
  {
    id: 'ferias-aprovacoes',
    path: '/ferias?tab=approvals',
    label: 'Aprovações de Férias',
    keywords: ['aprovacoes', 'aprovar ferias', 'pendencias ferias', 'aprovar'],
    contexts: ['aprovar ferias', 'ferias pendentes', 'aprovacao pendente', 'aprovações de férias'],
  },
  {
    id: 'reembolso',
    path: '/reembolso',
    label: 'Reembolsos',
    keywords: [
      'reembolso', 'reembolsos', 'reemboso', 'reembouso', 'despesa', 'despesas',
      'prestacao de contas', 'expense',
    ],
    contexts: [
      'pedir reembolso',
      'status reembolso',
      'aprovacao reembolso',
      'novo reembolso',
      'meus reembolsos',
      'enviar despesa',
    ],
  },
  {
    id: 'dashboard',
    path: '/dashboard',
    label: 'Dashboard',
    keywords: ['dashboard', 'inicio', 'home', 'painel', 'principal', 'dash', 'home dashboard'],
    contexts: [
      'voltar ao inicio',
      'pagina inicial',
      'tela inicial',
      'voltar pro painel',
      'me leva ao dashboard',
      'me leva a home',
      'abrir dashboard',
      'comecar pela home',
      'comecar pelo dashboard',
      'vamos comecar pela home',
      'vamos comecar pelo dashboard',
    ],
  },
  {
    id: 'admin',
    path: '/admin',
    label: 'Painel Administrativo',
    keywords: ['admin', 'administracao', 'painel admin', 'gestao admin', 'administrativo'],
    contexts: ['configuracoes admin', 'painel administrativo', 'abrir admin'],
  },
  {
    id: 'tripulantes',
    path: '/department/gestao-tripulantes',
    label: 'Gestão de Tripulantes',
    keywords: [
      'tripulantes', 'tripulante', 'tripuentes', 'tripulate', 'gestao tripulantes',
      'crew', 'offshore', 'embarcacao', 'aso', 'man schedule', 'manschedule',
    ],
    contexts: [
      'cadastro tripulante',
      'documentos aso',
      'matriz colaboradores',
      'embarque',
      'escala tripulantes',
      'abrir gestao de tripulantes',
    ],
  },
  {
    id: 'dp',
    path: '/department/dp',
    label: 'Departamento Pessoal (DP)',
    keywords: [
      'dp', 'departamento pessoal', 'pessoal', 'folha', 'fechamento folha',
      'colaboradores dp', 'quadro de pessoal', 'rh', 'recursos humanos',
    ],
    contexts: [
      'abrir dp',
      'departamento pessoal',
      'cadastros de funcionarios',
      'fechamento de escala',
      'fechamento dp',
      'quadro de colaboradores',
      'ver funcionarios',
    ],
  },
  {
    id: 'esocial',
    path: '/department/e-social',
    label: 'e-Social',
    keywords: ['esocial', 'e-social', 'e social', 'cat', 's-2210', 's-2230', 's-2220', 'compliance'],
    contexts: ['evento esocial', 'enviar esocial', 'afastamento esocial', 'abrir esocial'],
  },
  {
    id: 'academy',
    path: '/academy',
    label: 'Academy',
    keywords: ['academy', 'academia', 'curso', 'cursos', 'treinamento', 'certificado', 'abz academy'],
    contexts: ['fazer curso', 'meus cursos', 'certificado academy', 'abrir academy'],
  },
  {
    id: 'epi',
    path: '/epi',
    label: 'EPI',
    keywords: ['epi', 'epis', 'equipamento', 'protecao', 'epi ca', 'numero ca'],
    contexts: ['entrega epi', 'estoque epi', 'solicitar epi', 'abrir epi'],
  },
  {
    id: 'ponto',
    path: '/ponto',
    label: 'Ponto',
    keywords: ['ponto', 'presenca', 'frequencia', 'bater ponto', 'folha ponto'],
    contexts: ['registro de ponto', 'lista de presenca', 'horas trabalhadas', 'abrir ponto'],
  },
  {
    id: 'lista-presenca',
    path: '/lista-presenca',
    label: 'Lista de Presença',
    keywords: ['lista de presenca', 'lista presenca', 'presenca lista'],
    contexts: ['abrir lista de presenca', 'marcar presenca'],
  },
  {
    id: 'compras',
    path: '/compras',
    label: 'Compras / Suprimentos',
    keywords: ['compra', 'compras', 'suprimento', 'suprimentos', 'rqf', 'pedido', 'procurement'],
    contexts: ['solicitacao de compra', 'ordem de compra', 'aprovacao compra', 'abrir compras'],
  },
  {
    id: 'calendario',
    path: '/calendario',
    label: 'Calendário',
    keywords: ['calendario', 'calenadrio', 'agenda', 'evento', 'reuniao', 'calendar'],
    contexts: ['meus eventos', 'agendar reuniao', 'ver agenda', 'abrir calendario'],
  },
  {
    id: 'avaliacao',
    path: '/avaliacao',
    label: 'Avaliação de Desempenho',
    keywords: ['avaliacao', 'avaliacoes', 'desempenho', 'performance', '360', 'avaliacão'],
    contexts: ['autoavaliacao', 'avaliacao pendente', 'ciclo avaliacao', 'abrir avaliacao'],
  },
  {
    id: 'noticias',
    path: '/noticias',
    label: 'Notícias',
    keywords: ['noticia', 'noticias', 'feed', 'comunicado', 'news'],
    contexts: ['ler noticias', 'ultimas noticias', 'abrir noticias'],
  },
  {
    id: 'biblioteca',
    path: '/biblioteca',
    label: 'Biblioteca',
    keywords: ['biblioteca', 'documentos', 'arquivos', 'repositorio'],
    contexts: ['abrir biblioteca', 'buscar documento'],
  },
  {
    id: 'contracheque',
    path: '/contracheque',
    label: 'Contracheque',
    keywords: ['contracheque', 'holerite', 'folha', 'pagamento', 'contra cheque'],
    contexts: ['ver contracheque', 'meu holerite', 'abrir contracheque'],
  },
  {
    id: 'ia',
    path: '/ia',
    label: 'Chat IA',
    keywords: ['ia', 'chat ia', 'assistente', 'inteligencia artificial', 'chat completo', 'openai'],
    contexts: ['abrir chat', 'falar com ia', 'chat da ia'],
  },
  {
    id: 'kpi',
    path: '/kpi',
    label: 'KPIs',
    keywords: ['kpi', 'kpis', 'indicadores', 'metricas'],
    contexts: ['ver kpis', 'mostrar indicadores', 'status do sistema', 'abrir kpi', 'me leva ao kpi'],
  },
  {
    id: 'email-settings',
    path: '/admin/email-settings',
    label: 'Configurações de E-mail',
    keywords: ['email settings', 'config email', 'smtp', 'configuracao email'],
    contexts: ['configurar email', 'senha smtp'],
  },
];

const NAV_INTENT_VERBS = [
  'abrir', 'abre', 'abra', 'ir', 'vai', 'va', 'levar', 'leve', 'mostrar', 'mostra',
  'acessar', 'acesse', 'navegar', 'navegue', 'entrar', 'entre', 'ir para', 'vai para',
  'quero ir', 'preciso ir', 'me leve', 'me leva', 'redirecionar', 'goto', 'go to',
  'traz', 'traga', 'leva', 'leve me', 'me mostre', 'quero ver', 'quero abrir',
];

/** Frases de tour / guia do portal (primeiro hop = Dashboard) */
const TOUR_INTENT_PHRASES = [
  'tour',
  'passeio',
  'guia do portal',
  'guia pelo portal',
  'modulo a modulo',
  'modulo em modulo',
  'modulos um a um',
  'um modulo por vez',
  'conhecer o portal',
  'apresentar o portal',
  'mostrar o portal',
  'mostra o portal',
  'me mostra o portal',
  'vamos comecar',
  'comece pela',
  'comecar pela',
  'comecar pelo',
  'passe pelos modulos',
  'percorrer o portal',
  'recorrer o portal',
];

/** Linguagem de promessa de navegação na resposta do Companion */
const REPLY_NAV_PROMISE_PHRASES = [
  'vou te levar',
  'vou levar',
  'te levando',
  'vou abrir',
  'abrindo',
  'navegando',
  'indo para',
  'indo pra',
  'vamos comecar',
  'vamos iniciar',
  'comecamos pela',
  'comecei pela',
  'primeiro passo',
  'primeira parada',
  'levar voce',
  'levando voce',
];

export function normalizeText(input: string): string {
  return (input || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s\-\/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    let prev = i + 1;
    for (let j = 0; j < b.length; j++) {
      const cur = a[i] === b[j] ? row[j] : Math.min(row[j], row[j + 1], prev) + 1;
      row[j] = prev;
      prev = cur;
    }
    row[b.length] = prev;
  }
  return row[b.length];
}

/** Similaridade 0–1 (1 = idêntico) */
function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (!maxLen) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

function tokenFuzzyIncludes(haystack: string, needle: string): number {
  if (!needle) return 0;

  // Keywords curtos (≤3): só match como token inteiro (evita "ca"∈"calendario")
  if (needle.length <= 3) {
    const tokens = haystack.split(/\s+/);
    if (tokens.includes(needle)) return 1;
    // Fuzzy só se o token tem o mesmo tamanho ±1 e similaridade alta
    let best = 0;
    for (const t of tokens) {
      if (Math.abs(t.length - needle.length) > 1) continue;
      const s = similarity(t, needle);
      if (s >= 0.85 && s > best) best = s;
    }
    return best;
  }

  if (haystack.includes(needle)) return 1;

  const tokens = haystack.split(/\s+/);
  let best = 0;
  for (const t of tokens) {
    if (t.length < 3) continue;
    const s = similarity(t, needle);
    if (s > best) best = s;
  }
  // Também compara n-grams do haystack do tamanho do needle (±2)
  if (needle.length >= 4 && haystack.length >= needle.length) {
    for (let i = 0; i <= haystack.length - needle.length; i++) {
      const slice = haystack.slice(i, i + needle.length);
      const s = similarity(slice, needle);
      if (s > best) best = s;
    }
  }
  return best;
}

export function isTourIntent(prompt: string): boolean {
  const n = normalizeText(prompt);
  if (!n) return false;
  if (TOUR_INTENT_PHRASES.some(p => n.includes(normalizeText(p)))) return true;
  // "portal" + verbo de mostrar/conhecer/guiar
  if (
    n.includes('portal') &&
    /(tour|passeio|guia|conhecer|apresent|mostrar|mostra|percorr|recorr|modulo)/.test(n)
  ) {
    return true;
  }
  return false;
}

export function isNavigationIntent(prompt: string): boolean {
  const n = normalizeText(prompt);
  if (isTourIntent(n)) return true;
  if (NAV_INTENT_VERBS.some(v => n.includes(v))) return true;
  // Frases curtas só com destino: "ferias", "reembolso"
  if (n.split(/\s+/).length <= 4) {
    return PORTAL_ROUTES.some(r =>
      r.keywords.some(k => tokenFuzzyIncludes(n, k) >= 0.82)
    );
  }
  return false;
}

/** Resposta do LLM promete abrir/levar sem necessariamente ter chamado a tool */
export function replyImpliesNavigation(reply: string): boolean {
  const n = normalizeText(reply);
  if (!n) return false;
  if (REPLY_NAV_PROMISE_PHRASES.some(p => n.includes(normalizeText(p)))) return true;
  // "vamos começar pela **Home/Dashboard**" etc.
  if (/comec(ar|amos|ei)? pela|primeira (parada|tela|etapa)/.test(n)) return true;
  return false;
}

export function getDashboardNavMatch(): PortalNavMatch {
  const route = PORTAL_ROUTES.find(r => r.id === 'dashboard')!;
  return {
    route,
    score: 1,
    matchedOn: 'tour-first-stop',
    confidence: 'high',
  };
}

/**
 * Garante pelo menos um NAVIGATE quando o usuário pediu tour/ir a um módulo
 * ou a resposta promete navegação sem commands. Retorna o match usado (se injetou).
 */
export function ensureNavigationCommand(opts: {
  prompt: string;
  reply?: string;
  commands: Array<{ action: string; target?: string; label?: string; value?: unknown }>;
  navMatch?: PortalNavMatch | null;
}): PortalNavMatch | null {
  const hasNavigate = opts.commands.some(
    c => c.action === 'NAVIGATE' && typeof c.target === 'string' && c.target.length > 0
  );
  if (hasNavigate) return null;

  const tour = isTourIntent(opts.prompt);
  const navIntent = isNavigationIntent(opts.prompt);
  const replyPromise = opts.reply ? replyImpliesNavigation(opts.reply) : false;

  if (tour) {
    const first = getDashboardNavMatch();
    opts.commands.push(buildNavCommand(first));
    return first;
  }

  if (opts.navMatch && (navIntent || replyPromise) && opts.navMatch.score >= 0.78) {
    opts.commands.push(buildNavCommand(opts.navMatch));
    return opts.navMatch;
  }

  if (replyPromise && opts.reply) {
    const fromReply = resolvePortalNavigation(opts.reply);
    if (fromReply && fromReply.score >= 0.78) {
      opts.commands.push(buildNavCommand(fromReply));
      return fromReply;
    }
    // Prometeu home/dashboard sem match forte → dashboard
    const n = normalizeText(opts.reply);
    if (/(home|dashboard|inicio|painel principal)/.test(n)) {
      const first = getDashboardNavMatch();
      opts.commands.push(buildNavCommand(first));
      return first;
    }
  }

  if (navIntent && opts.navMatch && opts.navMatch.score >= 0.78) {
    opts.commands.push(buildNavCommand(opts.navMatch));
    return opts.navMatch;
  }

  return null;
}

/**
 * Resolve o melhor destino de navegação a partir do texto do usuário.
 * Tolerante a typos (ex.: "feririas", "reemboso", "tripulantes").
 */
export function resolvePortalNavigation(prompt: string): PortalNavMatch | null {
  const n = normalizeText(prompt);
  if (!n) return null;

  // Path absoluto explícito
  if (n.startsWith('/') && n.length > 1) {
    const path = prompt.trim().split(/\s+/)[0];
    return {
      route: {
        id: 'custom',
        path,
        label: path,
        keywords: [],
        contexts: [],
      },
      score: 1,
      matchedOn: path,
      confidence: 'high',
    };
  }

  let best: PortalNavMatch | null = null;

  for (const route of PORTAL_ROUTES) {
    for (const kw of route.keywords) {
      const score = tokenFuzzyIncludes(n, normalizeText(kw));
      if (score < 0.78) continue;
      if (!best || score > best.score) {
        best = {
          route,
          score,
          matchedOn: kw,
          confidence: score >= 0.95 ? 'high' : score >= 0.85 ? 'medium' : 'low',
        };
      }
    }
    for (const ctx of route.contexts) {
      const ctxN = normalizeText(ctx);
      const score = n.includes(ctxN)
        ? 0.98
        : similarity(n, ctxN) > 0.75
          ? similarity(n, ctxN)
          : tokenFuzzyIncludes(n, ctxN);
      if (score < 0.8) continue;
      if (!best || score > best.score) {
        best = {
          route,
          score,
          matchedOn: ctx,
          confidence: score >= 0.92 ? 'high' : 'medium',
        };
      }
    }
  }

  // Preferência contextual: se fala em aprovação + férias → aba approvals
  if (best && best.route.id === 'ferias') {
    if (/aprov|penden/.test(n)) {
      const approvals = PORTAL_ROUTES.find(r => r.id === 'ferias-aprovacoes');
      if (approvals) {
        return {
          route: approvals,
          score: Math.max(best.score, 0.9),
          matchedOn: 'aprovacao ferias',
          confidence: 'high',
        };
      }
    }
  }

  return best;
}

export function aliasToPath(destino: string): string {
  const n = normalizeText(destino);
  if (n.startsWith('/')) return destino.trim();

  const match = resolvePortalNavigation(destino);
  if (match && match.score >= 0.78) return match.route.path;

  return `/${destino.replace(/^\//, '')}`;
}

export function buildNavCommand(match: PortalNavMatch) {
  return {
    action: 'NAVIGATE' as const,
    target: match.route.path,
    label: `Abrindo ${match.route.label}...`,
  };
}
