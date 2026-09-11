import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  PORTAL_USER_SELECT,
  emailsMatchExact,
  hasSecondIdentityFactor,
  namesCorroborate,
  pickUniqueEmailMatch,
  pickUniqueNameCpfMatch,
  pickUniqueTaxIdMatch,
  portalDisplayName,
  resolveModuleUserIds,
  shouldAcceptPrimaryMatch,
  shouldBackfillUserId,
  taxIdDigitsMatch,
  uniqueUserIds,
  type PortalUser,
} from './portal-user-match';

const AISLAN_CPF = '13984165765';

const gmailUser: PortalUser = {
  id: '0d69cd7b-ec52-45ed-a87e-f452e6d2f152',
  first_name: 'AISLAN',
  last_name: 'ROCHA DE ARAUJO LEITE',
  email: 'aislan.roocha@gmail.com',
  role: 'USER',
  tax_id: AISLAN_CPF,
};

const corpUser: PortalUser = {
  id: 'd93d659d-70d4-4be0-bea9-6af2d5e1f486',
  first_name: 'Aislan',
  last_name: 'Rocha',
  email: 'aislan.rocha@groupabz.com',
  role: 'USER',
  tax_id: null,
};

describe('PORTAL_USER_SELECT', () => {
  it('selects tax_id and never cpf/full_name/phone', () => {
    assert.match(PORTAL_USER_SELECT, /\btax_id\b/);
    assert.match(PORTAL_USER_SELECT, /\bfirst_name\b/);
    assert.match(PORTAL_USER_SELECT, /\blast_name\b/);
    assert.match(PORTAL_USER_SELECT, /\bemail\b/);
    assert.doesNotMatch(PORTAL_USER_SELECT, /(^|,\s*)cpf(,|$)/);
    assert.doesNotMatch(PORTAL_USER_SELECT, /\bfull_name\b/);
    assert.doesNotMatch(PORTAL_USER_SELECT, /(^|,\s*)phone(,|$)/);
  });
});

describe('taxIdDigitsMatch', () => {
  it('matches Aislan CPF against digits or masked tax_id', () => {
    assert.equal(taxIdDigitsMatch('13984165765', AISLAN_CPF), true);
    assert.equal(taxIdDigitsMatch('139.841.657-65', AISLAN_CPF), true);
    assert.equal(taxIdDigitsMatch(null, AISLAN_CPF), false);
    assert.equal(taxIdDigitsMatch('00000000000', AISLAN_CPF), false);
  });
});

describe('emailsMatchExact', () => {
  it('is case-insensitive and exact', () => {
    assert.equal(emailsMatchExact('Aislan.Roocha@Gmail.com', 'aislan.roocha@gmail.com'), true);
    assert.equal(emailsMatchExact('aislan.rocha@groupabz.com', 'aislan.roocha@gmail.com'), false);
    assert.equal(emailsMatchExact('', 'aislan.roocha@gmail.com'), false);
  });
});

describe('pickUniqueTaxIdMatch', () => {
  it('links Aislan via tax_id even when a corporate clone has null tax_id', () => {
    const hit = pickUniqueTaxIdMatch([gmailUser, corpUser], AISLAN_CPF);
    assert.equal(hit?.id, gmailUser.id);
  });

  it('returns null when two users share the same CPF digits', () => {
    const clone = { ...corpUser, tax_id: '139.841.657-65' };
    assert.equal(pickUniqueTaxIdMatch([gmailUser, clone], AISLAN_CPF), null);
  });
});

describe('pickUniqueEmailMatch', () => {
  it('links the colaborador gmail exactly', () => {
    const hit = pickUniqueEmailMatch([gmailUser, corpUser], 'aislan.roocha@gmail.com');
    assert.equal(hit?.id, gmailUser.id);
  });
});

describe('pickUniqueNameCpfMatch', () => {
  it('requires both exact normalized name and CPF digits', () => {
    const hit = pickUniqueNameCpfMatch(
      [gmailUser, corpUser],
      'AISLAN ROCHA DE ARAUJO LEITE',
      AISLAN_CPF,
    );
    assert.equal(hit?.id, gmailUser.id);
    assert.equal(pickUniqueNameCpfMatch([gmailUser, corpUser], 'Aislan Rocha', AISLAN_CPF), null);
  });
});

describe('shouldBackfillUserId', () => {
  it('fills only when colaborador.user_id is empty', () => {
    assert.equal(shouldBackfillUserId(null, gmailUser.id), true);
    assert.equal(shouldBackfillUserId(gmailUser.id, corpUser.id), false);
    assert.equal(shouldBackfillUserId(undefined, null), false);
  });
});

describe('portalDisplayName / uniqueUserIds', () => {
  it('prefers first+last and de-dupes module ids', () => {
    assert.equal(portalDisplayName(gmailUser), 'AISLAN ROCHA DE ARAUJO LEITE');
    assert.deepEqual(uniqueUserIds(gmailUser.id, gmailUser.id, corpUser.id, null), [
      gmailUser.id,
      corpUser.id,
    ]);
  });
});

const strangerUser: PortalUser = {
  id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  first_name: 'Maria',
  last_name: 'Santos Oliveira',
  email: 'maria.santos@example.com',
  role: 'USER',
  tax_id: '39053344705',
};

const aislanLookup = {
  colaboradorNome: 'AISLAN ROCHA DE ARAUJO LEITE',
  colaboradorCpf: AISLAN_CPF,
  colaboradorEmail: 'aislan.roocha@gmail.com',
};

describe('namesCorroborate', () => {
  it('treats Aislan short and full names as the same person', () => {
    assert.equal(
      namesCorroborate('AISLAN ROCHA DE ARAUJO LEITE', 'Aislan Rocha'),
      true,
    );
    assert.equal(
      namesCorroborate(portalDisplayName(gmailUser), portalDisplayName(corpUser)),
      true,
    );
    assert.equal(namesCorroborate('AISLAN ROCHA DE ARAUJO LEITE', 'AISLAN ROCHA DE ARAUJO LEITE'), true);
  });

  it('rejects unrelated or first-name-only matches', () => {
    assert.equal(namesCorroborate('AISLAN ROCHA DE ARAUJO LEITE', 'Maria Santos Oliveira'), false);
    assert.equal(namesCorroborate('Aislan', 'AISLAN ROCHA DE ARAUJO LEITE'), false);
    assert.equal(namesCorroborate('Pedro Santos', 'Pedro Souza'), false);
    assert.equal(namesCorroborate('', 'Aislan Rocha'), false);
  });
});

describe('hasSecondIdentityFactor / shouldAcceptPrimaryMatch', () => {
  it('accepts the Aislan corporate clone via name even without shared tax_id', () => {
    assert.equal(
      hasSecondIdentityFactor(corpUser, {
        foundBy: 'email',
        confirmed: gmailUser,
        ...aislanLookup,
        colaboradorEmail: 'aislan.rocha@groupabz.com',
      }),
      true,
    );
    assert.equal(
      hasSecondIdentityFactor(gmailUser, {
        foundBy: 'tax_id',
        confirmed: corpUser,
        colaboradorNome: 'Aislan Rocha',
        colaboradorCpf: AISLAN_CPF,
        colaboradorEmail: 'aislan.rocha@groupabz.com',
      }),
      true,
    );
  });

  it('rejects a coincidental email/CPF hit with no name relation', () => {
    assert.equal(
      hasSecondIdentityFactor(strangerUser, {
        foundBy: 'email',
        confirmed: gmailUser,
        ...aislanLookup,
        colaboradorEmail: strangerUser.email || '',
      }),
      false,
    );
    assert.equal(
      hasSecondIdentityFactor(strangerUser, {
        foundBy: 'tax_id',
        confirmed: gmailUser,
        colaboradorNome: aislanLookup.colaboradorNome,
        colaboradorCpf: '39053344705',
        colaboradorEmail: aislanLookup.colaboradorEmail,
      }),
      false,
    );
    assert.equal(
      shouldAcceptPrimaryMatch(strangerUser, 'email', {
        nome: 'AISLAN ROCHA DE ARAUJO LEITE',
        cpf: AISLAN_CPF,
        email: 'maria.santos@example.com',
      }),
      false,
    );
  });

  it('accepts email-only or tax-only primary when a second factor exists', () => {
    assert.equal(
      shouldAcceptPrimaryMatch(gmailUser, 'email', {
        nome: 'AISLAN ROCHA DE ARAUJO LEITE',
        cpf: '',
        email: 'aislan.roocha@gmail.com',
      }),
      true,
    );
    assert.equal(
      shouldAcceptPrimaryMatch(gmailUser, 'tax_id', {
        nome: 'Aislan Rocha',
        cpf: AISLAN_CPF,
        email: '',
      }),
      true,
    );
    assert.equal(
      shouldAcceptPrimaryMatch(gmailUser, 'email', {
        nome: 'Outra Pessoa',
        cpf: AISLAN_CPF,
        email: 'aislan.roocha@gmail.com',
      }),
      true,
    );
  });
});

describe('resolveModuleUserIds', () => {
  it('keeps both Aislan portal ids when names corroborate', () => {
    assert.deepEqual(
      resolveModuleUserIds({
        primary: gmailUser,
        primaryReason: 'user_id',
        byTax: gmailUser,
        byEmail: corpUser,
        colaboradorNome: 'AISLAN ROCHA DE ARAUJO LEITE',
        colaboradorCpf: AISLAN_CPF,
        colaboradorEmail: 'aislan.rocha@groupabz.com',
      }),
      [gmailUser.id, corpUser.id],
    );
    assert.deepEqual(
      resolveModuleUserIds({
        primary: corpUser,
        primaryReason: 'user_id',
        byTax: gmailUser,
        byEmail: corpUser,
        colaboradorNome: 'Aislan Rocha',
        colaboradorCpf: AISLAN_CPF,
        colaboradorEmail: 'aislan.rocha@groupabz.com',
      }),
      [corpUser.id, gmailUser.id],
    );
  });

  it('does not merge a stranger found only by recycled/typo email or CPF', () => {
    assert.deepEqual(
      resolveModuleUserIds({
        primary: gmailUser,
        primaryReason: 'user_id',
        byTax: gmailUser,
        byEmail: strangerUser,
        colaboradorNome: 'AISLAN ROCHA DE ARAUJO LEITE',
        colaboradorCpf: AISLAN_CPF,
        colaboradorEmail: 'maria.santos@example.com',
      }),
      [gmailUser.id],
    );
    assert.deepEqual(
      resolveModuleUserIds({
        primary: gmailUser,
        primaryReason: 'user_id',
        byTax: strangerUser,
        byEmail: gmailUser,
        colaboradorNome: 'AISLAN ROCHA DE ARAUJO LEITE',
        colaboradorCpf: '39053344705',
        colaboradorEmail: 'aislan.roocha@gmail.com',
      }),
      [gmailUser.id],
    );
  });
});
