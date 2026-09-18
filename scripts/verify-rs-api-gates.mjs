/**
 * Gate G4 — gates de API e permissões do módulo Indicadores R&S.
 * Pré-condição: servidor de produção no ar (default http://localhost:80,
 * override via env RS_BASE). Sem token as rotas DEVEM negar (401); a página
 * deve servir (200); as 3 permissões ACL `indicadores.*` devem estar ativas.
 * Uso: node scripts/verify-rs-api-gates.mjs
 */
const BASE = process.env.RS_BASE || 'http://localhost:80';
const UUID_FALSO = '00000000-0000-0000-0000-000000000000';

function falhar(msg) {
  console.error('RS_API_GATES_FAIL:', msg);
  process.exit(1);
}

async function codigo(path, init) {
  const res = await fetch(BASE + path, { ...init, redirect: 'manual' });
  return res.status;
}

async function main() {
  // 1) Sem token → 401 em toda rota de escrita/leitura do módulo.
  const form = new FormData();
  const verificacoes = [
    ['GET /planilhas sem token', () => codigo('/api/indicadores/planilhas')],
    ['GET /abas/[id]/linhas sem token', () => codigo(`/api/indicadores/abas/${UUID_FALSO}/linhas?pagina=1&porPagina=10`)],
    ['POST /import/analyze sem token', () => codigo('/api/indicadores/import/analyze', { method: 'POST', body: form })],
    ['POST /abas/[id]/linhas sem token', () => codigo(`/api/indicadores/abas/${UUID_FALSO}/linhas`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"dados":{}}' })],
    ['PUT /linhas/[id] sem token', () => codigo(`/api/indicadores/linhas/${UUID_FALSO}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{"dados":{}}' })],
    ['DELETE /linhas/[id] sem token', () => codigo(`/api/indicadores/linhas/${UUID_FALSO}`, { method: 'DELETE' })],
    ['DELETE /planilhas/[id] sem token', () => codigo(`/api/indicadores/planilhas/${UUID_FALSO}`, { method: 'DELETE' })],
  ];
  for (const [nome, fn] of verificacoes) {
    const status = await fn();
    if (status !== 401) falhar(`${nome}: esperado 401, veio ${status}`);
    console.log(`OK 401 — ${nome}`);
  }

  // 2) Token inválido também nega.
  const statusInvalido = await codigo('/api/indicadores/planilhas', {
    headers: { Authorization: 'Bearer token-lixo' },
  });
  if (statusInvalido !== 401) falhar(`token inválido: esperado 401, veio ${statusInvalido}`);
  console.log('OK 401 — token inválido');

  // 3) Página do módulo serve.
  const pagina = await codigo('/department/indicadores');
  if (pagina !== 200) falhar(`/department/indicadores: esperado 200, veio ${pagina}`);
  console.log('OK 200 — /department/indicadores');

  // 4) Permissões ACL do módulo ativas (semeadas via /api/acl/init).
  const resAcl = await fetch(`${BASE}/api/acl/permissions?resource=indicadores`);
  if (!resAcl.ok) falhar(`/api/acl/permissions: status ${resAcl.status}`);
  const perms = await resAcl.json();
  const lista = Array.isArray(perms) ? perms : perms.permissions || [];
  const acoes = new Set(lista.filter((p) => p.enabled !== false).map((p) => p.action));
  for (const acao of ['view', 'edit', 'import']) {
    if (!acoes.has(acao)) falhar(`ACL indicadores.${acao} ausente/inativa no banco`);
    console.log(`OK ACL — indicadores.${acao}`);
  }

  console.log('RS_API_GATES_OK');
}

main().catch((e) => {
  console.error('RS_API_GATES_FAIL:', e);
  process.exit(1);
});
