import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import dotenv from 'dotenv';
import { NextRequest } from 'next/server';

// env antes dos imports dinâmicos (rotas → @/lib/supabase lê env no load)
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

type Usuario = { id: string; role: string; token: string; colaboradorIds: string[] };

let listarColaboradores: typeof import('@/app/api/gestao-tripulantes/colaboradores/route').GET;
let criarDocumento: typeof import('@/app/api/gestao-tripulantes/colaboradores/[id]/documentos/route').POST;
let buscarHub: typeof import('@/app/api/employee-hub/search/route').GET;
let asoPorCpf: typeof import('@/app/api/gestao-tripulantes/aso/route').GET;
let logistica: Usuario;
let dp: Usuario;
let vinculado: Usuario;
let terceiro: { id: string; cpf: string };
let totalColaboradores: number;

const req = (url: string, token: string, init?: { method: string; body: unknown }) =>
  new NextRequest(`http://localhost${url}`, {
    method: init?.method ?? 'GET',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: init ? JSON.stringify(init.body) : undefined,
  });

before(async () => {
  const [{ supabaseAdmin }, { generateToken }, escopoMod] = await Promise.all([
    import('@/lib/supabase'),
    import('@/lib/auth'),
    import('./documento-escopo'),
  ]);
  ({ GET: listarColaboradores } = await import('@/app/api/gestao-tripulantes/colaboradores/route'));
  ({ POST: criarDocumento } = await import('@/app/api/gestao-tripulantes/colaboradores/[id]/documentos/route'));
  ({ GET: buscarHub } = await import('@/app/api/employee-hub/search/route'));
  ({ GET: asoPorCpf } = await import('@/app/api/gestao-tripulantes/aso/route'));

  const usuarioDoSetor = async (setor: string): Promise<Usuario> => {
    const { data } = await supabaseAdmin
      .from('users_unified')
      .select('id, role, sectors!inner(name)')
      .eq('active', true)
      .eq('role', 'USER')
      .ilike('sectors.name', setor)
      .limit(1)
      .single();
    assert.ok(data, `USER ativo do setor ${setor}`);
    const escopo = await escopoMod.resolverEscopoDocumentosGt(data.id, data.role);
    return { id: data.id, role: data.role, token: generateToken(data), colaboradorIds: escopo.colaboradorIds };
  };
  [logistica, dp] = await Promise.all([usuarioDoSetor('%log%stica%'), usuarioDoSetor('Departamento Pessoal')]);
  assert.equal((await escopoMod.resolverEscopoDocumentosGt(logistica.id, logistica.role)).escopo, 'proprios');

  const { data: vinculos } = await supabaseAdmin
    .from('gt_colaboradores')
    .select('user_id')
    .is('deleted_at', null)
    .not('user_id', 'is', null)
    .limit(200);
  const { data: comVinculo } = await supabaseAdmin
    .from('users_unified')
    .select('id, role')
    .in('id', (vinculos || []).map((v) => v.user_id as string))
    .eq('active', true)
    .eq('role', 'USER')
    .is('sector_id', null)
    .limit(1)
    .single();
  assert.ok(comVinculo, 'USER sem setor com colaborador vinculado');
  const escopoVinculado = await escopoMod.resolverEscopoDocumentosGt(comVinculo.id, comVinculo.role);
  assert.equal(escopoVinculado.escopo, 'proprios');
  assert.ok(escopoVinculado.colaboradorIds.length > 0);
  vinculado = {
    id: comVinculo.id,
    role: comVinculo.role,
    token: generateToken(comVinculo),
    colaboradorIds: escopoVinculado.colaboradorIds,
  };
  assert.equal((await escopoMod.resolverEscopoDocumentosGt(dp.id, dp.role)).escopo, 'todos');

  const { data: outro } = await supabaseAdmin
    .from('gt_colaboradores')
    .select('id, cpf')
    .is('deleted_at', null)
    .not('cpf', 'is', null)
    .not('id', 'in', `(${['00000000-0000-0000-0000-000000000000', ...logistica.colaboradorIds].join(',')})`)
    .limit(1)
    .single();
  assert.ok(outro, 'colaborador de terceiro');
  terceiro = outro as { id: string; cpf: string };

  const { count } = await supabaseAdmin
    .from('gt_colaboradores')
    .select('id', { count: 'exact', head: true })
    .is('deleted_at', null);
  totalColaboradores = count ?? 0;
});

describe('escopo de documentos nas rotas GT (live)', () => {
  for (const [nome, usuario] of [['da Logística', () => logistica], ['sem setor com vínculo', () => vinculado]] as const) {
    it(`USER ${nome} lista só os colaboradores vinculados a ele`, async () => {
      const { token, colaboradorIds } = usuario();
      const res = await listarColaboradores(req('/api/gestao-tripulantes/colaboradores?limit=500', token));
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.deepEqual((json.data as Array<{ id: string }>).map((c) => c.id).sort(), [...colaboradorIds].sort());
      assert.equal(json.pagination.total, colaboradorIds.length);
    });
  }

  it('USER do DP lista todos os colaboradores', async () => {
    const res = await listarColaboradores(req('/api/gestao-tripulantes/colaboradores?limit=1', dp.token));
    assert.equal(res.status, 200);
    assert.equal((await res.json()).pagination.total, totalColaboradores);
  });

  it('POST documento em colaborador de terceiro sem escopo → 403', async () => {
    const res = await criarDocumento(
      req(`/api/gestao-tripulantes/colaboradores/${terceiro.id}/documentos`, logistica.token, {
        method: 'POST',
        body: { tipo_documento: 'outro', titulo: 'escopo-test' },
      }),
      { params: Promise.resolve({ id: terceiro.id }) },
    );
    assert.equal(res.status, 403);
  });

  it('employee-hub/search e aso?cpf= não expõem terceiros ao USER da Logística', async () => {
    const hub = await (await buscarHub(req('/api/employee-hub/search?nome=a&limit=50', logistica.token))).json();
    for (const r of hub.results as Array<{ id: string }>) assert.ok(logistica.colaboradorIds.includes(r.id));
    const aso = await asoPorCpf(req(`/api/gestao-tripulantes/aso?cpf=${terceiro.cpf.replace(/\D/g, '')}`, logistica.token));
    assert.equal(aso.status, 403);
    const asoDp = await asoPorCpf(req(`/api/gestao-tripulantes/aso?cpf=${terceiro.cpf.replace(/\D/g, '')}`, dp.token));
    assert.equal(asoDp.status, 200);
  });
});
