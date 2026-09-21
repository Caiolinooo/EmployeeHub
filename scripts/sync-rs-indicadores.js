/**
 * Sync do módulo Indicadores R&S com o restante do sistema — idempotente
 * (re-executar nunca duplica; insere o que falta e completa o que mudou).
 *
 * O que garante:
 *   1. Card do menu lateral (tabela `cards`) — o menu do portal é gerado
 *      desses cards; sem ele o módulo não aparece na sidebar.
 *   2. Permissões ACL (tabela `acl_permissions`) — mesmo seed de
 *      POST /api/acl/init, derivado de SYSTEM_MODULES (src/config/modules.ts).
 *   3. Grants por role (tabela `role_acl_permissions`) — view/edit/import
 *      p/ ADMIN+MANAGER, admin p/ ADMIN.
 *   4. Setores R&S-like (tabela `sectors`): 'indicadores' entra em
 *      allowed_modules de todo setor cujo nome casa com
 *      /(recrutamento|sele[çc][ãa]o|r&s|rh)/i — mesmo regex de
 *      src/lib/indicadores/permissoes.ts.
 *
 * Uso: node scripts/sync-rs-indicadores.js
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const MODULO = 'indicadores';
const CARD_ID = MODULO;
const RS_SETOR_REGEX = /(recrutamento|sele[çc][ãa]o|r&s|rh)/i;

const PERMISSOES = [
  { name: 'indicadores.view', resource: MODULO, action: 'view', description: 'Visualizar indicadores R&S', level: 0, roles: ['ADMIN', 'MANAGER'] },
  { name: 'indicadores.edit', resource: MODULO, action: 'edit', description: 'Editar linhas das planilhas', level: 2, roles: ['ADMIN', 'MANAGER'] },
  { name: 'indicadores.import', resource: MODULO, action: 'import', description: 'Importar planilhas e gerenciar datasets', level: 2, roles: ['ADMIN', 'MANAGER'] },
  { name: 'indicadores.admin', resource: MODULO, action: 'admin', description: 'Admin total', level: 3, roles: ['ADMIN'] },
];

const CARD = {
  id: CARD_ID,
  title: 'Indicadores R&S',
  title_en: 'R&S Indicators',
  description: 'Indicadores e controle de vagas do Recrutamento & Seleção — planilhas, KPIs e avaliação de eficácia',
  description_en: 'Recruitment & Selection vacancy control and indicators — spreadsheets, KPIs and efficacy review',
  href: '/department/indicadores',
  icon_name: 'FiBarChart2',
  color: 'bg-abz-blue',
  hover_color: 'hover:bg-blue-800',
  external: false,
  enabled: true,
  admin_only: false,
  manager_only: false,
  module_key: MODULO,
  category: 'department',
};

function loadEnvFiles() {
  const files = ['.env.local', '.env', '.env.production'];
  const env = {};
  for (const f of files) {
    const p = path.join(process.cwd(), f);
    if (!fs.existsSync(p)) continue;
    const raw = fs.readFileSync(p, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!m) continue;
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!env[m[1]] && val) env[m[1]] = val;
    }
  }
  return env;
}

const env = loadEnvFiles();
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;
if (!supabaseUrl || !serviceKey) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios (.env.local)');
  process.exit(1);
}
const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

async function syncCard() {
  const { data: existing } = await supabase
    .from('cards')
    .select('id')
    .eq('id', CARD_ID)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from('cards').update(CARD).eq('id', CARD_ID);
    if (error) throw new Error(`cards update: ${error.message}`);
    console.log('♻️  Card do menu atualizado:', CARD_ID);
    return;
  }

  const { data: ultimo } = await supabase
    .from('cards')
    .select('order')
    .order('order', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase
    .from('cards')
    .insert({ ...CARD, order: (ultimo?.order ?? 0) + 1 });
  if (error) throw new Error(`cards insert: ${error.message}`);
  console.log('✅ Card do menu criado:', CARD_ID, `(order ${(ultimo?.order ?? 0) + 1})`);
}

async function syncAcl() {
  for (const perm of PERMISSOES) {
    const { data: existing } = await supabase
      .from('acl_permissions')
      .select('id')
      .eq('name', perm.name)
      .maybeSingle();

    let permissionId = existing?.id;
    if (!permissionId) {
      const { data: inserted, error } = await supabase
        .from('acl_permissions')
        .insert({
          name: perm.name,
          resource: perm.resource,
          action: perm.action,
          description: perm.description,
          level: perm.level,
          enabled: true,
          created_at: new Date().toISOString(),
        })
        .select('id')
        .single();
      if (error) throw new Error(`acl_permissions insert ${perm.name}: ${error.message}`);
      permissionId = inserted.id;
      console.log('✅ Permissão ACL criada:', perm.name);
    }

    for (const role of perm.roles) {
      const { data: grant } = await supabase
        .from('role_acl_permissions')
        .select('id')
        .eq('role', role)
        .eq('permission_id', permissionId)
        .maybeSingle();
      if (grant) continue;
      const { error } = await supabase.from('role_acl_permissions').insert({
        role,
        permission_id: permissionId,
        created_at: new Date().toISOString(),
      });
      if (error) throw new Error(`role_acl_permissions insert ${role}/${perm.name}: ${error.message}`);
      console.log(`✅ Permissão ${perm.name} atribuída ao role ${role}`);
    }
  }
}

async function syncSetores() {
  const { data: setores, error } = await supabase.from('sectors').select('id, name, allowed_modules');
  if (error) throw new Error(`sectors select: ${error.message}`);

  for (const setor of setores || []) {
    if (!RS_SETOR_REGEX.test(String(setor.name || ''))) continue;
    const lista = Array.isArray(setor.allowed_modules) ? setor.allowed_modules : [];
    if (lista.some((m) => String(m || '').trim().toLowerCase() === MODULO)) continue;

    const { error: upd } = await supabase
      .from('sectors')
      .update({ allowed_modules: [...lista, MODULO] })
      .eq('id', setor.id);
    if (upd) throw new Error(`sectors update ${setor.name}: ${upd.message}`);
    console.log(`✅ Setor "${setor.name}": 'indicadores' adicionado a allowed_modules`);
  }
}

async function verificar() {
  const { data: card } = await supabase.from('cards').select('id, href, category').eq('id', CARD_ID).maybeSingle();
  const { count: perms } = await supabase
    .from('acl_permissions')
    .select('id', { count: 'exact', head: true })
    .eq('resource', MODULO);
  const { count: grants } = await supabase
    .from('role_acl_permissions')
    .select('id', { count: 'exact', head: true })
    .in('permission_id', (await supabase.from('acl_permissions').select('id').eq('resource', MODULO)).data.map((p) => p.id));
  const { data: setores } = await supabase
    .from('sectors')
    .select('name, allowed_modules')
    .ilike('name', '%recrut%');

  console.log('\n—— Verificação ——');
  console.log('card:', JSON.stringify(card));
  console.log('acl_permissions do módulo:', perms);
  console.log('role grants do módulo:', grants);
  console.log(
    'setores R&S:',
    JSON.stringify((setores || []).map((s) => ({ n: s.name, ok: (s.allowed_modules || []).includes(MODULO) }))),
  );
}

async function main() {
  console.log(`🔧 Sync Indicadores R&S → ${supabaseUrl}\n`);
  await syncCard();
  await syncAcl();
  await syncSetores();
  await syncFolha();
  await verificar();
  console.log('\n✅ Sync concluído');
}

// ============================================================
// Módulo Folha de Pagamento (plano dp-rubricas-wkradar, passo 2)
// Card 'folha-pagamento' JÁ EXISTE na tabela cards — não tocar.
// Aqui: 4 acl_permissions + role grants + setores DP-like.
// ============================================================

const FOLHA_MODULO = 'folha';
const FOLHA_SETOR_REGEX = /(departamento.*pessoal|\bdp\b|\brh\b)/i;

const FOLHA_PERMISSOES = [
  { name: 'folha.view', resource: FOLHA_MODULO, action: 'view', description: 'Visualizar folha de pagamento', level: 0, roles: ['ADMIN', 'MANAGER'] },
  { name: 'folha.edit', resource: FOLHA_MODULO, action: 'edit', description: 'Editar lançamentos e rubricas', level: 2, roles: ['ADMIN', 'MANAGER'] },
  { name: 'folha.approve', resource: FOLHA_MODULO, action: 'approve', description: 'Aprovar ou rejeitar folhas', level: 2, roles: ['ADMIN', 'MANAGER'] },
  { name: 'folha.admin', resource: FOLHA_MODULO, action: 'admin', description: 'Admin total', level: 3, roles: ['ADMIN'] },
];

async function syncFolha() {
  console.log('\n🧾 Sync módulo Folha de Pagamento:');
  for (const perm of FOLHA_PERMISSOES) {
    const { data: existing } = await supabase
      .from('acl_permissions')
      .select('id')
      .eq('name', perm.name)
      .maybeSingle();

    let permissionId = existing?.id;
    if (!permissionId) {
      const { data: inserted, error } = await supabase
        .from('acl_permissions')
        .insert({
          name: perm.name,
          resource: perm.resource,
          action: perm.action,
          description: perm.description,
          level: perm.level,
          enabled: true,
          created_at: new Date().toISOString(),
        })
        .select('id')
        .single();
      if (error) throw new Error(`acl_permissions insert ${perm.name}: ${error.message}`);
      permissionId = inserted.id;
      console.log('✅ Permissão ACL criada:', perm.name);
    }

    for (const role of perm.roles) {
      const { data: grant } = await supabase
        .from('role_acl_permissions')
        .select('id')
        .eq('role', role)
        .eq('permission_id', permissionId)
        .maybeSingle();
      if (grant) continue;
      const { error } = await supabase.from('role_acl_permissions').insert({
        role,
        permission_id: permissionId,
        created_at: new Date().toISOString(),
      });
      if (error) throw new Error(`role_acl_permissions insert ${role}/${perm.name}: ${error.message}`);
      console.log(`✅ Permissão ${perm.name} atribuída ao role ${role}`);
    }
  }

  const { data: setores, error } = await supabase.from('sectors').select('id, name, allowed_modules');
  if (error) throw new Error(`sectors select (folha): ${error.message}`);
  for (const setor of setores || []) {
    if (!FOLHA_SETOR_REGEX.test(String(setor.name || ''))) continue;
    const lista = Array.isArray(setor.allowed_modules) ? setor.allowed_modules : [];
    if (lista.some((m) => String(m || '').trim().toLowerCase() === FOLHA_MODULO)) continue;
    const { error: upd } = await supabase
      .from('sectors')
      .update({ allowed_modules: [...lista, FOLHA_MODULO] })
      .eq('id', setor.id);
    if (upd) throw new Error(`sectors update (folha) ${setor.name}: ${upd.message}`);
    console.log(`✅ Setor "${setor.name}": 'folha' adicionado a allowed_modules`);
  }

  const { data: permsFolha } = await supabase
    .from('acl_permissions')
    .select('id, name')
    .eq('resource', FOLHA_MODULO);
  console.log(`🔍 Verificação folha: ${permsFolha?.length || 0} acl_permissions (${(permsFolha || []).map((p) => p.name).join(', ')})`);
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
