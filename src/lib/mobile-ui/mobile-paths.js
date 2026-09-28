/**
 * Fonte única da allowlist mobile (CJS — requerido por next.config.js).
 * Só entra aqui rota que TEM página em `src/app/(mobile)/m/...`.
 * Match EXATO (sem prefixo): subrotas sem página mobile caem no desktop,
 * evitando loop rewrite↔307 com o catch-all `/m/[...slug]`.
 * Ao criar `/m/<rota>` nova, adicionar a rota pública aqui.
 */
const MOBILE_IMPLEMENTED_PATHS = [
  '/login',
  '/dashboard',
  '/noticias',
  '/calendario',
  '/ia',
  '/ponto',
  '/contracheque',
  '/reembolso',
  '/kpi',
  '/avaliacao',
  '/epi',
  '/ferias',
  '/lista-presenca',
  '/contratos',
  '/academy',
  '/biblioteca',
  '/ajuda',
  '/manual',
  '/procedimentos',
  '/politicas',
  '/chat',
  '/wkradar',
  '/contatos',
  '/emergencia',
  '/guia_offshore',
  '/poliweb',
  '/folha-pagamento',
  '/admin',
  '/admin/notifications',
  '/admin/feedback',
  '/admin/metrics',
  '/admin/metrics/engagement',
  '/admin/integracao-erp',
  '/department/purchase-orders',
  '/department/man-schedule',
  '/department/gestao-tripulantes',
  '/department/e-social',
  '/department/indicadores',
  '/department/dp',
];

module.exports = { MOBILE_IMPLEMENTED_PATHS };
