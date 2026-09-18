/**
 * QA E2E (via API HTTP) — Recorte de marcações + exclusão parcial + autodesfazer (GT v5.80).
 *
 * Cenários (contra servidor HTTP real — npm run dev / next start):
 *   a. POST evento 14 dias → POST evento menor sobreposto NO MEIO (flags default)
 *      → head/tail fragmentados com datas certas, trilha create/delete/create,
 *      resposta com edicoes[].
 *   a2. Mesmo fluxo cobrindo o evento INTEIRO (recorte 'apagar') — documenta o
 *      comportamento do chain-undo (toast) nesse caso.
 *   b. Repetir com apagar_anteriores=true → head não existe (linha original
 *      encurtada in place, tail preservado).
 *   c. DELETE /embarques/{id} modo 'periodo' num dia do MEIO → evento vira 2
 *      blocos; trilha coerente (delete + 2 creates). Extras: 400 período
 *      invertido / sem datas / janela sem sobreposição (em evento VIVO).
 *   d. Rollback LIFO: reverter edicoes[] em ordem reversa via
 *      /escala-edicoes/{id}/reverter → estado original restaurado.
 *      Caso (c) (só delete+fragmentos): LIFO limpo. Casos (a)/(a2) (o evento
 *      salvo também está na trilha): documenta que a guarda de sobreposição
 *      quebra o chain-undo do toast no delete da original.
 *   e. Autodesfazer com usuário não-gestor: própria edição → 200
 *      (autodesfazer:true); edição de outro ator → 403; edição própria antiga
 *      superada → 409; desfazer duas vezes → falha fechada.
 *
 * Uso:
 *   node scripts/test-gt-recorte-exclusao.js            # usa GT_E2E_BASE_URL ou localhost:3000
 * O script cria colaborador de teste (marcado [_tmp_]) e faz HARD delete de
 * tudo que criou no fim (embarques, edições de auditoria, colaborador).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ---- env (.env.local primeiro — padrão dos scripts do repo) ----
for (const f of ['.env.local', '.env']) {
  const p = path.join(process.cwd(), f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[m[1]] && v) process.env[m[1]] = v;
  }
}

const BASE = process.env.GT_E2E_BASE_URL || 'http://localhost:3000';
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const JWT_SECRET = process.env.JWT_SECRET;

if (!SUPA_URL || !SUPA_KEY) {
  console.error('FALTA SUPABASE: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
if (!JWT_SECRET) {
  console.error('FALTA JWT_SECRET — não dá para mintar tokens de teste.');
  process.exit(1);
}

const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');
const sb = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } });

// ---- tokens (mesmo formato do src/lib/auth.ts generateToken/verifyToken) ----
const adminId = crypto.randomUUID();
const userId = crypto.randomUUID();
const mintToken = (uid, role) =>
  jwt.sign({ userId: uid, phoneNumber: `+5511${String(Date.now()).slice(-8)}`, role }, JWT_SECRET, {
    expiresIn: '2h',
  });
const TOKEN_ADMIN = mintToken(adminId, 'ADMIN');
const TOKEN_USER = mintToken(userId, 'USER'); // não-gestor (fora de FECHAMENTO_ROLES)

// ---- helpers ----
let PASS = 0;
let FAIL = 0;
function ok(cond, msg) {
  if (cond) {
    PASS++;
    console.log(`  PASS — ${msg}`);
  } else {
    FAIL++;
    console.log(`  FAIL — ${msg}`);
  }
}
async function api(method, urlPath, body, token) {
  const res = await fetch(`${BASE}${urlPath}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* corpo não-JSON */
  }
  return { status: res.status, json };
}
async function buscarEmbarque(id) {
  const { data } = await sb.from('gt_historico_embarques').select('*').eq('id', id).maybeSingle();
  return data;
}
async function vivosDoColaborador() {
  const { data } = await sb
    .from('gt_historico_embarques')
    .select('id, tipo, data_embarque, data_desembarque, deleted_at')
    .eq('colaborador_id', colaboradorId)
    .is('deleted_at', null)
    .order('data_embarque');
  return data || [];
}
const dia = (v) => String(v ?? '').slice(0, 10);
/**
 * Simula o chain-undo do toast (reverterEdicoesEmCadeia): ordem REVERSA,
 * PARA no primeiro erro (o frontend não continua depois de um erro).
 */
async function chainUndoFrontend(ids, motivo) {
  const passos = [];
  for (const id of [...ids].reverse()) {
    const r = await api('POST', `/api/gestao-tripulantes/escala-edicoes/${id}/reverter`, { motivo }, TOKEN_ADMIN);
    passos.push({ id, operacao: operacaoDaEdicao(id), status: r.status, error: r.json?.error || '' });
    console.log(`    reverter ${id.slice(0, 8)}… (${operacaoDaEdicao(id)}) → HTTP ${r.status}${r.json?.error ? ` — "${String(r.json.error).slice(0, 85)}…"` : ''}`);
    if (r.status !== 200) break; // mesma semântica do reverterEdicoesEmCadeia
  }
  return passos;
}
function operacaoDaEdicao(id) {
  return mapaOperacoes.get(id) || '?';
}
const mapaOperacoes = new Map();

let colaboradorId = null;
const CPF_TESTE = `9${String(Date.now()).slice(-10)}`; // sintético, 11 dígitos

async function criarEvento(token, ini, fim, extras = {}) {
  const r = await api('POST', '/api/gestao-tripulantes/embarques', {
    colaborador_cpf: CPF_TESTE,
    tipo: 'normal',
    data_embarque: ini,
    data_desembarque: fim,
    ...extras,
  }, token);
  ok(r.status === 200, `POST evento [${ini}..${fim}] → HTTP ${r.status}${r.status === 200 ? '' : ' ' + JSON.stringify(r.json)}`);
  for (const id of r.json?.edicoes || []) mapaOperacoes.set(id, 'create');
  return r.json;
}

async function main() {
  console.log(`Base URL: ${BASE}`);
  console.log(`Tokens mintados: admin=${adminId.slice(0, 8)}… (role ADMIN) | user=${userId.slice(0, 8)}… (role USER)\n`);

  // ---------- setup: colaborador de teste ----------
  const ins = await sb
    .from('gt_colaboradores')
    .insert({
      nome_completo: `[TESTE QA _tmp_ recorte-exclusao ${new Date().toISOString()}]`,
      cpf: CPF_TESTE,
      ativo: false,
    })
    .select('id')
    .single();
  if (ins.error) throw new Error(`criar colaborador de teste: ${ins.error.message}`);
  colaboradorId = ins.data.id;
  console.log(`Setup: colaborador _tmp_ ${colaboradorId} (cpf ${CPF_TESTE})\n`);

  // =====================================================================
  console.log('=== (a) POST 14 dias → POST menor no meio (flags false) → dividir ===');
  // evento original: 2026-10-01 → 2026-10-14 (14 dias, ON/rotação)
  const j1 = await criarEvento(TOKEN_ADMIN, '2026-10-01', '2026-10-14', { observacoes: 'QA original 14d' });
  const idOrig = j1?.data?.id;
  ok(Boolean(idOrig), `evento original criado id=${idOrig}`);
  ok(Array.isArray(j1?.edicoes) && j1.edicoes.length === 1, `edicoes[] do 1º POST = [create] (len ${j1?.edicoes?.length})`);
  mapaOperacoes.set(j1.edicoes[0], 'create');

  // evento menor NO MEIO: 2026-10-05 → 2026-10-08 (flags default false/false)
  const r2 = await api('POST', '/api/gestao-tripulantes/embarques', {
    colaborador_cpf: CPF_TESTE,
    tipo: 'normal',
    data_embarque: '2026-10-05',
    data_desembarque: '2026-10-08',
    observacoes: 'QA menor no meio',
  }, TOKEN_ADMIN);
  ok(r2.status === 200, `POST menor no meio → HTTP ${r2.status} ${r2.status === 200 ? '' : JSON.stringify(r2.json)}`);
  const edicoesA = r2.json?.edicoes || [];
  ok(Array.isArray(edicoesA) && edicoesA.length === 4, `resposta tem edicoes[] com 4 ids (create novo + delete orig + create head + create tail); veio ${edicoesA.length}`);
  ok((r2.json?.substituidos || []).length === 1, `substituidos = 1 (a original); veio ${(r2.json?.substituidos || []).length}`);

  // trilha em ordem: create (novo), delete (original), create (head), create (tail)
  const { data: trilhaA } = await sb
    .from('gt_escala_edicoes')
    .select('id, operacao, embarque_id, motivo')
    .in('id', edicoesA.length ? edicoesA : ['00000000-0000-0000-0000-000000000000']);
  const mapaA = new Map((trilhaA || []).map((e) => [e.id, e]));
  for (const e of trilhaA || []) mapaOperacoes.set(e.id, e.operacao);
  const opsA = edicoesA.map((id) => mapaA.get(id)?.operacao).join(',');
  ok(opsA === 'create,delete,create,create', `trilha 'update'/'delete'/'create' em ordem (create,delete,create,create); veio [${opsA}]`);
  const delOrigA = mapaA.get(edicoesA[1]);
  ok(Boolean(delOrigA && /Recorte|Substitu/i.test(delOrigA.motivo || '')), `delete da original com motivo de recorte: "${delOrigA ? delOrigA.motivo : '?'}"`);

  const origAposA = await buscarEmbarque(idOrig);
  ok(Boolean(origAposA?.deleted_at), 'original soft-deletada (deleted_at set)');
  const vivosA = await vivosDoColaborador();
  const fragsA = vivosA.filter((r) => r.id !== r2.json?.data?.id);
  const headA = fragsA.find((r) => dia(r.data_embarque) === '2026-10-01');
  const tailA = fragsA.find((r) => dia(r.data_desembarque) === '2026-10-14');
  ok(fragsA.length === 2, `2 fragmentos vivos (head+tail); veio ${fragsA.length}: ${fragsA.map((f) => `${dia(f.data_embarque)}→${dia(f.data_desembarque)}`).join(' | ')}`);
  ok(Boolean(headA && dia(headA.data_desembarque) === '2026-10-04'), `head = [2026-10-01..2026-10-04] (veio [${headA ? dia(headA.data_embarque) : '?'}..${headA ? dia(headA.data_desembarque) : '?'}])`);
  ok(Boolean(tailA && dia(tailA.data_embarque) === '2026-10-09'), `tail = [2026-10-09..2026-10-14] (veio [${tailA ? dia(tailA.data_embarque) : '?'}..${tailA ? dia(tailA.data_desembarque) : '?'}])`);
  ok(Boolean(headA && tailA && headA.tipo === 'normal' && tailA.tipo === 'normal'), 'fragmentos herdam tipo=normal');
  const embarquesTrilhaA = {
    novo: r2.json?.data?.id,
    head: headA?.id,
    tail: tailA?.id,
    orig: idOrig,
  };

  // =====================================================================
  console.log('\n=== (a2) POST cobrindo o evento inteiro (recorte apagar) ===');
  const ja2orig = await criarEvento(TOKEN_ADMIN, '2027-03-05', '2027-03-10', { observacoes: 'QA a2 orig' });
  const ja2 = await api('POST', '/api/gestao-tripulantes/embarques', {
    colaborador_cpf: CPF_TESTE,
    tipo: 'normal',
    data_embarque: '2027-03-01',
    data_desembarque: '2027-03-20',
    observacoes: 'QA a2 cobre tudo',
  }, TOKEN_ADMIN);
  ok(ja2.status === 200, `POST maior cobrindo tudo → HTTP ${ja2.status}`);
  const edicoesA2 = ja2.json?.edicoes || [];
  ok(edicoesA2.length === 2, `trilha = [create novo, delete original] (apagar = soft-delete total); veio ${edicoesA2.length}`);
  const origA2 = await buscarEmbarque(ja2orig?.data?.id);
  ok(Boolean(origA2?.deleted_at), 'a2: original coberta inteira → soft-delete total');
  const vivosA2 = await vivosDoColaborador();
  ok(!vivosA2.some((r) => dia(r.data_embarque) === '2027-03-05'), 'a2: nenhum fragmento sobrevive (apagar)');

  // =====================================================================
  console.log('\n=== (b) Repetir com apagar_anteriores=true → head não existe ===');
  const jb1 = await criarEvento(TOKEN_ADMIN, '2026-11-01', '2026-11-14', { observacoes: 'QA orig b 14d' });
  const idOrigB = jb1?.data?.id;
  const rb2 = await api('POST', '/api/gestao-tripulantes/embarques', {
    colaborador_cpf: CPF_TESTE,
    tipo: 'normal',
    data_embarque: '2026-11-05',
    data_desembarque: '2026-11-08',
    observacoes: 'QA menor no meio (apagar_anteriores)',
    apagar_anteriores: true,
  }, TOKEN_ADMIN);
  ok(rb2.status === 200, `POST menor no meio com apagar_anteriores=true → HTTP ${rb2.status} ${rb2.status === 200 ? '' : JSON.stringify(rb2.json)}`);
  const edicoesB = rb2.json?.edicoes || [];
  ok(edicoesB.length === 2, `trilha = [create novo, update original] (head descartado → encurtar in place); veio ${edicoesB.length}`);
  const origBApos = await buscarEmbarque(idOrigB);
  ok(
    !origBApos?.deleted_at && dia(origBApos?.data_embarque) === '2026-11-09',
    `original viva e encurtada: data_embarque=2026-11-09 (veio ${dia(origBApos?.data_embarque)}, deleted_at=${origBApos?.deleted_at ? 'set' : 'null'})`
  );
  ok(dia(origBApos?.data_desembarque) === '2026-11-14', `tail preservado: data_desembarque segue 2026-11-14 (veio ${dia(origBApos?.data_desembarque)})`);
  const vivosB = await vivosDoColaborador();
  const headRegionB = vivosB.filter((r) => r.id !== rb2.json?.data?.id && dia(r.data_embarque) < '2026-11-09' && dia(r.data_embarque) >= '2026-11-01');
  ok(headRegionB.length === 0, `nenhum fragmento de head vivo em [11-01..11-08] além do evento salvo; na região: ${headRegionB.length}`);
  const { data: trilhaB } = await sb
    .from('gt_escala_edicoes')
    .select('id, operacao, motivo')
    .in('id', edicoesB.length ? edicoesB : ['00000000-0000-0000-0000-000000000000']);
  for (const e of trilhaB || []) mapaOperacoes.set(e.id, e.operacao);
  const updMotivoB = (trilhaB || []).find((e) => e.operacao === 'update')?.motivo || '';
  ok(/ponta posterior/i.test(updMotivoB), `update da original com motivo de recorte: "${updMotivoB}"`);
  edicaoAdminB = edicoesB[1] || edicoesB[0]; // usada no (e): edição de OUTRO ator

  // =====================================================================
  console.log('\n=== (c) DELETE modo periodo num dia do MEIO → 2 blocos ===');
  const jc1 = await criarEvento(TOKEN_ADMIN, '2026-12-01', '2026-12-14', { observacoes: 'QA orig c 14d' });
  const idC = jc1?.data?.id;

  const rc2 = await api('DELETE', `/api/gestao-tripulantes/embarques/${idC}`, {
    modo: 'periodo',
    data_inicio: '2026-12-05',
    data_fim: '2026-12-06',
  }, TOKEN_ADMIN);
  ok(rc2.status === 200, `DELETE modo periodo (12-05..12-06) → HTTP ${rc2.status} ${rc2.status === 200 ? '' : JSON.stringify(rc2.json)}`);
  ok(rc2.json?.modo === 'periodo', `resposta tem modo='periodo' (veio ${rc2.json?.modo})`);
  ok(rc2.json?.recorte?.acao === 'dividir' && rc2.json?.recorte?.fragmentosCriados === 2, `recorte.acao='dividir', fragmentosCriados=2 (veio ${rc2.json?.recorte?.acao}/${rc2.json?.recorte?.fragmentosCriados})`);
  const edicoesC = rc2.json?.edicoes || [];
  ok(edicoesC.length === 3, `trilha coerente: 3 edições (delete + create + create); veio ${edicoesC.length}`);
  const { data: trilhaC } = await sb
    .from('gt_escala_edicoes')
    .select('id, operacao')
    .in('id', edicoesC.length ? edicoesC : ['00000000-0000-0000-0000-000000000000']);
  for (const e of trilhaC || []) mapaOperacoes.set(e.id, e.operacao);
  const opsC = edicoesC.map((id) => (trilhaC || []).find((e) => e.id === id)?.operacao).join(',');
  ok(opsC === 'delete,create,create', `trilha do DELETE em ordem (delete,create,create); veio [${opsC}]`);

  const origCApos = await buscarEmbarque(idC);
  ok(Boolean(origCApos?.deleted_at), 'original c soft-deletada');
  const vivosC = (await vivosDoColaborador()).filter((r) => r.id !== idC);
  const headC = vivosC.find((r) => dia(r.data_desembarque) === '2026-12-04');
  const tailC = vivosC.find((r) => dia(r.data_embarque) === '2026-12-07');
  ok(Boolean(headC && dia(headC.data_embarque) === '2026-12-01'), `bloco 1 = [2026-12-01..2026-12-04] (veio [${headC ? dia(headC.data_embarque) : '?'}..${headC ? dia(headC.data_desembarque) : '?'}])`);
  ok(Boolean(tailC && dia(tailC.data_desembarque) === '2026-12-14'), `bloco 2 = [2026-12-07..2026-12-14] (veio [${tailC ? dia(tailC.data_embarque) : '?'}..${tailC ? dia(tailC.data_desembarque) : '?'}])`);

  // caminhos de erro — em evento VIVO dedicado (a linha soft-deletada daria 404)
  const jerr = await criarEvento(TOKEN_ADMIN, '2027-04-01', '2027-04-10', { observacoes: 'QA erro paths' });
  const idErr = jerr?.data?.id;
  const rc3 = await api('DELETE', `/api/gestao-tripulantes/embarques/${idErr}`, {
    modo: 'periodo', data_inicio: '2027-04-10', data_fim: '2027-04-01',
  }, TOKEN_ADMIN);
  ok(rc3.status === 400, `DELETE período invertido → HTTP ${rc3.status} (esperado 400): "${rc3.json?.error}"`);
  const rc4 = await api('DELETE', `/api/gestao-tripulantes/embarques/${idErr}`, {
    modo: 'periodo', data_inicio: '2027-05-01', data_fim: '2027-05-05',
  }, TOKEN_ADMIN);
  ok(rc4.status === 400, `DELETE janela sem sobreposição → HTTP ${rc4.status} (esperado 400): "${rc4.json?.error}"`);
  const rc5 = await api('DELETE', `/api/gestao-tripulantes/embarques/${idErr}`, { modo: 'periodo' }, TOKEN_ADMIN);
  ok(rc5.status === 400, `DELETE modo periodo sem datas → HTTP ${rc5.status} (esperado 400): "${rc5.json?.error}"`);
  const rc5b = await api('DELETE', `/api/gestao-tripulantes/embarques/${idErr}`, undefined, TOKEN_ADMIN);
  ok(rc5b.status === 200, `DELETE sem body = modo completo → HTTP ${rc5b.status}, modo=${rc5b.json?.modo}`);
  const errFinal = await buscarEmbarque(idErr);
  ok(Boolean(errFinal?.deleted_at), 'modo completo: linha soft-deletada (comportamento inalterado)');

  // =====================================================================
  console.log('\n=== (d) Rollback LIFO dos ids de edicoes (reverso) ===');
  // (d.1) caso (c): edicoes = [delete orig, create head, create tail]; reverso:
  //   create tail → create head → delete orig (evento de volta).
  console.log('  (d.1) caso (c) — LIFO limpo (sem evento salvo na trilha):');
  for (const idEd of [...edicoesC].reverse()) {
    const r = await api('POST', `/api/gestao-tripulantes/escala-edicoes/${idEd}/reverter`, { motivo: 'QA e2e rollback LIFO' }, TOKEN_ADMIN);
    ok(r.status === 200, `reverter ${operacaoDaEdicao(idEd)} ${idEd.slice(0, 8)}… → HTTP ${r.status} ${r.status !== 200 ? JSON.stringify(r.json) : ''}`);
  }
  const origCFinal = await buscarEmbarque(idC);
  ok(!origCFinal?.deleted_at, 'após LIFO: delete revertido por último → evento c DE VOLTA (deleted_at null)');
  ok(dia(origCFinal?.data_embarque) === '2026-12-01' && dia(origCFinal?.data_desembarque) === '2026-12-14', `datas originais do evento c restauradas [2026-12-01..2026-12-14] (veio [${dia(origCFinal?.data_embarque)}..${dia(origCFinal?.data_desembarque)}])`);
  const headCpos = await buscarEmbarque(headC?.id);
  const tailCpos = await buscarEmbarque(tailC?.id);
  ok(Boolean(headCpos?.deleted_at && tailCpos?.deleted_at), 'fragmentos head/tail soft-deletados pelo rollback dos creates');

  // (d.2) caso (a): edicoes = [create novo, delete orig, create head, create tail].
  //   Chain-undo do toast (reverso, para no 1º erro): a guarda de sobreposição
  //   recusa o delete da original enquanto o evento salvo vive → cadeia quebra.
  console.log('  (d.2) caso (a) — chain-undo do toast (reverso, para no 1º erro):');
  const passosA = await chainUndoFrontend(edicoesA, 'QA e2e chain-undo (a)');
  const quebrou = passosA.length < edicoesA.length;
  const origAMeio = await buscarEmbarque(idOrig);
  if (quebrou) {
    ok(origAMeio?.deleted_at, `chain-undo PAROU no passo ${passosA.length}/${edicoesA.length} (409 guarda de sobreposição) e a original CONTINUA soft-deletada — estado ≠ pré-salvo (ACHADO)`);
    console.log('    NOTA QA: o create do evento salvo é revertido POR ÚLTIMO no LIFO; o delete da');
    console.log('    original o encontra vivo e a guarda devolve 409. Recuperação manual (na ordem');
    console.log('    certa) pela fila ainda funciona — provando abaixo:');
    const idxDeleteOrigA = edicoesA.findIndex((id) => mapaOperacoes.get(id) === 'delete');
    const resNovo = await api('POST', `/api/gestao-tripulantes/escala-edicoes/${edicoesA[0]}/reverter`, { motivo: 'QA e2e — reverter evento salvo antes do delete' }, TOKEN_ADMIN);
    ok(resNovo.status === 200, `manual: reverter create do evento salvo primeiro → HTTP ${resNovo.status}`);
    const resDelRetry = await api('POST', `/api/gestao-tripulantes/escala-edicoes/${edicoesA[idxDeleteOrigA]}/reverter`, { motivo: 'QA e2e — delete da original após remover salvo' }, TOKEN_ADMIN);
    ok(resDelRetry.status === 200, `manual: reverter delete da original → HTTP ${resDelRetry.status}`);
  } else {
    ok(!origAMeio?.deleted_at, 'chain-undo completo: original restaurada no fluxo LIFO estrito');
  }
  const origAFinal = await buscarEmbarque(idOrig);
  ok(!origAFinal?.deleted_at && dia(origAFinal?.data_embarque) === '2026-10-01' && dia(origAFinal?.data_desembarque) === '2026-10-14', `estado original do caso (a) restaurado: [${dia(origAFinal?.data_embarque)}..${dia(origAFinal?.data_desembarque)}], deleted_at=${origAFinal?.deleted_at ? 'set' : 'null'}`);
  const fragsAFinal = await Promise.all([embarquesTrilhaA.head, embarquesTrilhaA.tail, embarquesTrilhaA.novo].map((id) => buscarEmbarque(id)));
  ok(fragsAFinal.every((f) => f?.deleted_at), 'fragmentos head/tail + evento salvo do caso (a) soft-deletados');

  // (d.3) caso (a2) 'apagar': mesmo problema do chain-undo, agora já no 1º passo.
  console.log('  (d.3) caso (a2) — chain-undo do toast com recorte apagar:');
  const passosA2 = await chainUndoFrontend(edicoesA2, 'QA e2e chain-undo (a2)');
  ok(passosA2.length === 1 && passosA2[0].status === 409, `chain-undo 'apagar' quebra JÁ no 1º passo (delete da original → 409; veio ${passosA2.length} passo(s), status ${passosA2[0]?.status})`);
  const resNovoA2 = await api('POST', `/api/gestao-tripulantes/escala-edicoes/${edicoesA2[0]}/reverter`, { motivo: 'QA e2e — reverter evento salvo (a2)' }, TOKEN_ADMIN);
  ok(resNovoA2.status === 200, `manual (a2): reverter create do evento salvo → HTTP ${resNovoA2.status}`);
  const resDelA2 = await api('POST', `/api/gestao-tripulantes/escala-edicoes/${edicoesA2[1]}/reverter`, { motivo: 'QA e2e — delete da original (a2)' }, TOKEN_ADMIN);
  ok(resDelA2.status === 200, `manual (a2): reverter delete da original → HTTP ${resDelA2.status}`);
  const origA2Final = await buscarEmbarque(ja2orig?.data?.id);
  ok(!origA2Final?.deleted_at, 'a2: original restaurada após recuperação manual');

  // =====================================================================
  console.log('\n=== (e) Autodesfazer com usuário não-gestor ===');
  // (e.1) USER cria evento → reverte a PRÓPRIA edição recente sem motivo → 200
  const re1 = await api('POST', '/api/gestao-tripulantes/embarques', {
    colaborador_cpf: CPF_TESTE,
    tipo: 'normal',
    data_embarque: '2027-01-04',
    data_desembarque: '2027-01-05',
    observacoes: 'QA autodesfazer user',
  }, TOKEN_USER);
  ok(re1.status === 200, `POST evento pelo USER (não-gestor) → HTTP ${re1.status}`);
  const edOwn = (re1.json?.edicoes || [])[0];
  ok(Boolean(edOwn), `USER recebe edicoes[] (${(re1.json?.edicoes || []).length} id)`);
  const re2 = await api('POST', `/api/gestao-tripulantes/escala-edicoes/${edOwn}/reverter`, { motivo: '' }, TOKEN_USER);
  ok(re2.status === 200 && re2.json?.autodesfazer === true, `USER desfaz a PRÓPRIA edição → HTTP ${re2.status}, autodesfazer=${re2.json?.autodesfazer} (msg: "${re2.json?.message}")`);
  const embOwn = await buscarEmbarque(re1.json?.data?.id);
  ok(Boolean(embOwn?.deleted_at), 'rollback do create: evento do USER soft-deletado');
  const re3 = await api('POST', `/api/gestao-tripulantes/escala-edicoes/${edOwn}/reverter`, { motivo: 'de novo' }, TOKEN_USER);
  ok(re3.status === 403 || re3.status === 409, `desfazer 2x falha fechada → HTTP ${re3.status} (msg: "${String(re3.json?.error || '').slice(0, 80)}…")`);
  if (re3.status === 403) {
    console.log('    NOTA QA: no 2º desfazer o autor recebe 403 ("Apenas gestores…") — a edição já');
    console.log('    está revertida; a mensagem soa como falta de permissão (menor: semântica do');
    console.log('    erro; a ação falha fechada, sem efeito).');
  }

  // (e.2) USER tenta reverter edição de OUTRO ator (ADMIN) → 403
  if (edicaoAdminB) {
    const re4 = await api('POST', `/api/gestao-tripulantes/escala-edicoes/${edicaoAdminB}/reverter`, { motivo: 'não sou o autor' }, TOKEN_USER);
    ok(re4.status === 403, `USER tenta reverter edição do ADMIN → HTTP ${re4.status} (esperado 403): "${String(re4.json?.error || '').slice(0, 80)}…"`);
  } else {
    ok(false, 'sem id de edição do admin para o 403 (falhou antes)');
  }

  // (e.3) USER: só a edição MAIS RECENTE — create antigo superado por update → 409
  const re5 = await api('POST', '/api/gestao-tripulantes/embarques', {
    colaborador_cpf: CPF_TESTE, tipo: 'normal',
    data_embarque: '2027-02-01', data_desembarque: '2027-02-03', observacoes: 'QA supersessao',
  }, TOKEN_USER);
  const emb5 = re5.json?.data?.id;
  const ed5Create = (re5.json?.edicoes || [])[0];
  const re6 = await api('POST', '/api/gestao-tripulantes/embarques', {
    colaborador_cpf: CPF_TESTE, tipo: 'normal',
    data_embarque: '2027-02-01', data_desembarque: '2027-02-03', observacoes: 'QA supersessao EDITADA',
  }, TOKEN_USER);
  ok(re6.status === 200 && re6.json?.merged === true, `re-post mesmo período faz merge (update na mesma linha) → HTTP ${re6.status}, merged=${re6.json?.merged}`);
  const ed5Update = (re6.json?.edicoes || [])[0];
  const re7 = await api('POST', `/api/gestao-tripulantes/escala-edicoes/${ed5Create}/reverter`, { motivo: 'tento desfazer a antiga' }, TOKEN_USER);
  ok(re7.status === 409, `USER tenta desfazer create ANTIGO (superado pelo update) → HTTP ${re7.status} (esperado 409): "${String(re7.json?.error || '').slice(0, 80)}"`);
  const re8 = await api('POST', `/api/gestao-tripulantes/escala-edicoes/${ed5Update}/reverter`, { motivo: '' }, TOKEN_USER);
  ok(re8.status === 200 && re8.json?.autodesfazer === true, `USER desfaz a edição MAIS RECENTE (update) → HTTP ${re8.status}, autodesfazer=${re8.json?.autodesfazer}`);
  const re9 = await api('POST', `/api/gestao-tripulantes/escala-edicoes/${ed5Create}/reverter`, { motivo: 'agora sim' }, TOKEN_USER);
  ok(re9.status === 200, `depois do update revertido, create próprio volta a ser revertível → HTTP ${re9.status}`);
  const emb5Final = await buscarEmbarque(emb5);
  ok(Boolean(emb5Final?.deleted_at), 'cadeia completa do USER revertida: linha volta ao estado pré-salvo (soft-deletada pelo rollback do create)');

  // ---------- resumo ----------
  console.log('\n============================================');
  console.log(`RESULTADO: ${PASS} PASS / ${FAIL} FAIL`);
  console.log(FAIL === 0 ? 'GT_RECORTE_E2E_OK' : 'GT_RECORTE_E2E_COM_FALHAS');
  console.log('============================================');
  return FAIL === 0 ? 0 : 1;
}

let edicaoAdminB = null;

main()
  .then((code) => process.exitCode = code)
  .catch((err) => {
    console.error('ERRO FATAL:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    // limpeza total (hard delete) do que o teste criou
    if (!colaboradorId) return;
    const delEd = await sb.from('gt_escala_edicoes').delete().eq('colaborador_id', colaboradorId);
    const delEmb = await sb.from('gt_historico_embarques').delete().eq('colaborador_id', colaboradorId);
    const delCol = await sb.from('gt_colaboradores').delete().eq('id', colaboradorId);
    const falhas = [delEd.error, delEmb.error, delCol.error].filter(Boolean);
    if (falhas.length) console.error('AVISO limpeza:', falhas.map((e) => e.message).join('; '));
    else console.log('Limpeza: edições, embarques e colaborador de teste removidos (hard delete).');
    process.exit(process.exitCode || 0);
  });
