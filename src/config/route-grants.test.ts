import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getAclRoleGrants, getAclSeedPermissions, type UserRole } from './modules';

const S: UserRole[] = ['ADMIN', 'MANAGER'];
const O: UserRole[] = ['ADMIN'];
const N: UserRole[] = [];

/**
 * Grants ligados em rota via `canWithGrant` (ou wrapper) → papéis que já passavam no gate
 * daquela rota antes do grant. O seed (`POST /api/acl/init`) não pode dar o grant a mais ninguém.
 */
const WIRED: Record<string, UserRole[]> = {
  'ferias.view_all': S,
  'ferias.pdf_all': S,
  'ferias.reject': S,
  'financeiro.faturas.create': S,
  'financeiro.faturas.cancel': S,
  'financeiro.export': S,
  'financeiro.nfse.emit': S,
  'financeiro.nfse.cancel': S,
  'financeiro.bancos.manage': S,
  'financeiro.certificado.manage': O,
  'financeiro.cobrancas.generate': S,
  'financeiro.conciliacao.run': S,
  'financeiro.clientes.manage': S,
  'financeiro.templates.manage': O,
  'financeiro.folha.import': S,
  'financeiro.folha.export': S,
  'financeiro.rubricas.manage': S,
  'contracheque.view_all': S,
  'recrutamento.vagas.view': S,
  'recrutamento.candidatos.view': S,
  'recrutamento.vagas.sync': S,
  'recrutamento.inhire.configure': S,
  'ponto.settings.manage': O,
  'calendario.company.config': S,
  'calendario.manage': S,
  'calendario.create': S,
  'calendario.update': S,
  'calendario.delete': S,
  'calendario.notify': S,
  'news.categories.manage': S,
  'news.attachments.upload': S,
  'news.comments.moderate': S,
  'notifications.send': S,
  'notifications.delete': S,
  'notifications.purge': O,
  'news.create': S,
  'news.update': S,
  'news.update.all': S,
  'news.delete': S,
  'news.delete.all': S,
  'news.viewers.view': O,
  'notifications.push.manage': S,
  'notifications.templates.manage': S,
  'notifications.broadcast': S,
  'notifications.manage': S,
  'biblioteca.create': O,
  'biblioteca.update': O,
  'biblioteca.delete': O,
  'biblioteca.manage': O,
  'social.delete.any': O,
};

describe('route-wired grants', () => {
  const seeded = new Set(getAclSeedPermissions().map((perm) => perm.name));
  const roleGrants = getAclRoleGrants();

  it('exist in the live catalog', () => {
    for (const name of Object.keys(WIRED)) assert.equal(seeded.has(name), true, `${name} not in catalog`);
  });

  it('seed only to roles that already passed the route gate', () => {
    for (const [name, passedBefore] of Object.entries(WIRED)) {
      for (const role of ['ADMIN', 'MANAGER', 'USER'] as const) {
        if (!roleGrants[role].includes(name)) continue;
        assert.equal(role === 'ADMIN' || passedBefore.includes(role), true, `${name} seeds ${role}`);
      }
    }
  });

  it('never seed USER', () => {
    for (const name of Object.keys(WIRED)) assert.equal(roleGrants.USER.includes(name), false, name);
  });

  it('keep MANAGER out of ADMIN-only gates', () => {
    const adminOnly = Object.entries(WIRED).filter(([, roles]) => roles === O || roles === N);
    for (const [name] of adminOnly) assert.equal(roleGrants.MANAGER.includes(name), false, name);
  });
});
