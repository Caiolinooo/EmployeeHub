/**
 * Gate G4 — gates de API do módulo Financeiro (§10 do design).
 * Pré-condição: servidor de produção no ar (default http://localhost:80,
 * override via env FIN_BASE). Sem token as rotas DEVEM negar (401); token
 * inválido também (401); com FIN_TOKEN_SEM_PERMISSAO no ambiente, um GET
 * autenticado de usuário sem nível deve dar 403.
 *
 * Uso: node scripts/verify-financeiro-api-gates.mjs   → FIN_API_GATES_OK
 */
const BASE = process.env.FIN_BASE || 'http://localhost:80';
const UUID_FALSO = '00000000-0000-0000-0000-000000000000';

function falhar(msg) {
  console.error('FIN_API_GATES_FAIL:', msg);
  process.exit(1);
}

async function codigo(path, init) {
  const res = await fetch(BASE + path, { ...init, redirect: 'manual' });
  return res.status;
}

async function main() {
  // 1) Sem token → 401 em TODA rota do módulo (amostra ≥ 12 rotas, todas as famílias §6).
  const json = (body) => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const verificacoes = [
    ['GET /visao-geral sem token', () => codigo('/api/financeiro/visao-geral?empresaId=' + UUID_FALSO)],
    ['GET /clientes sem token', () => codigo('/api/financeiro/clientes')],
    ['POST /clientes sem token', () => codigo('/api/financeiro/clientes', json({}))],
    ['GET /clientes/[id] sem token', () => codigo(`/api/financeiro/clientes/${UUID_FALSO}`)],
    ['GET /faturas sem token', () => codigo('/api/financeiro/faturas')],
    ['POST /faturas sem token', () => codigo('/api/financeiro/faturas', json({}))],
    ['POST /faturas/gerar-da-folha sem token', () => codigo('/api/financeiro/faturas/gerar-da-folha', json({}))],
    ['POST /faturas/[id]/emitir sem token', () => codigo(`/api/financeiro/faturas/${UUID_FALSO}/emitir`, { method: 'POST' })],
    ['GET /faturas/[id]/render sem token', () => codigo(`/api/financeiro/faturas/${UUID_FALSO}/render`)],
    ['GET /faturas/[id]/pdf sem token', () => codigo(`/api/financeiro/faturas/${UUID_FALSO}/pdf`)],
    ['GET /faturas/[id]/xlsx sem token', () => codigo(`/api/financeiro/faturas/${UUID_FALSO}/xlsx`)],
    ['GET /templates sem token', () => codigo('/api/financeiro/templates')],
    ['GET /nfse/config sem token', () => codigo('/api/financeiro/nfse/config')],
    ['POST /nfse/config sem token', () => codigo('/api/financeiro/nfse/config', json({}))],
    ['POST /nfse/config/[id]/credenciais sem token', () => codigo(`/api/financeiro/nfse/config/${UUID_FALSO}/credenciais`, json({}))],
    ['GET /nfse/municipios sem token', () => codigo('/api/financeiro/nfse/municipios')],
    ['PUT /nfse/municipios/[ibge] sem token', () => codigo('/api/financeiro/nfse/municipios/3302403', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{}' })],
    ['GET /nfse/emissoes sem token', () => codigo('/api/financeiro/nfse/emissoes')],
    ['POST /nfse/emissoes sem token', () => codigo('/api/financeiro/nfse/emissoes', json({}))],
    ['POST /nfse/emissoes/[id]/consultar sem token', () => codigo(`/api/financeiro/nfse/emissoes/${UUID_FALSO}/consultar`, { method: 'POST' })],
    ['POST /nfse/emissoes/[id]/cancelar sem token', () => codigo(`/api/financeiro/nfse/emissoes/${UUID_FALSO}/cancelar`, json({}))],
    ['GET /bancos/catalogo sem token', () => codigo('/api/financeiro/bancos/catalogo')],
    ['GET /bancos/integracoes sem token', () => codigo('/api/financeiro/bancos/integracoes')],
    ['POST /bancos/integracoes/[id]/credenciais sem token', () => codigo(`/api/financeiro/bancos/integracoes/${UUID_FALSO}/credenciais`, json({}))],
    ['POST /bancos/integracoes/[id]/certificados sem token', () => codigo(`/api/financeiro/bancos/integracoes/${UUID_FALSO}/certificados`, { method: 'POST' })],
    ['POST /bancos/integracoes/[id]/testar sem token', () => codigo(`/api/financeiro/bancos/integracoes/${UUID_FALSO}/testar`, { method: 'POST' })],
    ['GET /bancos/contas sem token', () => codigo('/api/financeiro/bancos/contas')],
    ['GET /cobrancas sem token', () => codigo('/api/financeiro/cobrancas')],
    ['POST /cobrancas sem token', () => codigo('/api/financeiro/cobrancas', json({}))],
    ['POST /cobrancas/[id]/atualizar sem token', () => codigo(`/api/financeiro/cobrancas/${UUID_FALSO}/atualizar`, { method: 'POST' })],
    ['POST /pagamentos/lote sem token', () => codigo('/api/financeiro/pagamentos/lote', json({}))],
    ['GET /pagamentos sem token', () => codigo('/api/financeiro/pagamentos')],
    ['POST /conciliacoes/importar sem token', () => codigo('/api/financeiro/conciliacoes/importar', json({}))],
    ['POST /conciliacoes/upload-csv sem token', () => codigo('/api/financeiro/conciliacoes/upload-csv', { method: 'POST' })],
    ['GET /conciliacoes sem token', () => codigo('/api/financeiro/conciliacoes')],
    ['POST /conciliacoes/[id]/vincular sem token', () => codigo(`/api/financeiro/conciliacoes/${UUID_FALSO}/vincular`, json({}))],
    ['POST /conciliacoes/[id]/ignorar sem token', () => codigo(`/api/financeiro/conciliacoes/${UUID_FALSO}/ignorar`, { method: 'POST' })],
    ['GET /eventos sem token', () => codigo('/api/financeiro/eventos')],
  ];

  for (const [nome, fn] of verificacoes) {
    const status = await fn();
    if (status !== 401) falhar(`${nome}: esperado 401, veio ${status}`);
    console.log(`OK 401 — ${nome}`);
  }

  // 2) Token inválido também nega (amostra nas famílias principais).
  const invalidas = [
    '/api/financeiro/visao-geral?empresaId=' + UUID_FALSO,
    '/api/financeiro/faturas',
    '/api/financeiro/bancos/catalogo',
    '/api/financeiro/nfse/municipios',
    '/api/financeiro/conciliacoes',
    '/api/financeiro/eventos',
  ];
  for (const rota of invalidas) {
    const status = await codigo(rota, { headers: { Authorization: 'Bearer token-lixo' } });
    if (status !== 401) falhar(`token inválido ${rota}: esperado 401, veio ${status}`);
    console.log(`OK 401 — token inválido ${rota}`);
  }

  // 3) Token sem permissão do módulo → 403 (opcional: requer token de usuário
  //    sem financeiro.view no ambiente; o orquestrador exporta quando houver).
  if (process.env.FIN_TOKEN_SEM_PERMISSAO) {
    const status = await codigo('/api/financeiro/faturas', {
      headers: { Authorization: `Bearer ${process.env.FIN_TOKEN_SEM_PERMISSAO}` },
    });
    if (status !== 403) falhar(`token sem permissão: esperado 403, veio ${status}`);
    console.log('OK 403 — token sem permissão financeiro.view');
  } else {
    console.log('NOTA — FIN_TOKEN_SEM_PERMISSAO ausente: verificação de 403 fica para a integração.');
  }

  console.log('FIN_API_GATES_OK');
}

main().catch((e) => {
  console.error('FIN_API_GATES_FAIL:', e);
  process.exit(1);
});
