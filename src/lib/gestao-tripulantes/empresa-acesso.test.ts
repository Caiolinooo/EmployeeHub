import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import dotenv from 'dotenv';

// env antes do import dinâmico (empresa-acesso → @/lib/supabase lê env no load)
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

let mod: typeof import('./empresa-acesso');

before(async () => {
  mod = await import('./empresa-acesso');
});

describe('empresa-acesso (ACL por empresa)', () => {
  it('roleBypassEmpresa: ADMIN/MANAGER/SUPERADMIN fazem bypass', () => {
    assert.equal(mod.roleBypassEmpresa('ADMIN'), true);
    assert.equal(mod.roleBypassEmpresa('manager'), true);
    assert.equal(mod.roleBypassEmpresa('SUPERADMIN'), true);
    assert.equal(mod.roleBypassEmpresa('USER'), false);
    assert.equal(mod.roleBypassEmpresa(null), false);
    assert.equal(mod.roleBypassEmpresa(undefined), false);
  });

  it('montarOrClauseEmpresa: inclui IS NULL (colaborador sem empresa visível) + IN', () => {
    const clause = mod.montarOrClauseEmpresa(['aaa-111', 'bbb-222']);
    assert.equal(clause, 'empresa_id.is.null,empresa_id.in.(aaa-111,bbb-222)');
  });

  it('montarOrClauseEmpresa: respeita nome de coluna customizado', () => {
    const clause = mod.montarOrClauseEmpresa(['aaa-111'], 'gt_colaboradores.empresa_id');
    assert.equal(clause, 'gt_colaboradores.empresa_id.is.null,gt_colaboradores.empresa_id.in.(aaa-111)');
  });

  it('aplicarFiltroEmpresa deixa o builder thenable sem executar e grava a cláusula', () => {
    let executou = false;
    const builder = {
      clause: '',
      or(filters: string) {
        this.clause = filters;
        return this;
      },
      then(resolve: (value: unknown) => void) {
        executou = true;
        resolve({ data: [{ id: 'executado' }] });
      },
    };

    const intacto = mod.aplicarFiltroEmpresa(builder, null);
    assert.equal(intacto, builder);
    assert.equal(builder.clause, '');
    assert.equal(executou, false);

    const filtrado = mod.aplicarFiltroEmpresa(builder, ['emp-1', 'emp-2']);
    assert.equal(filtrado, builder);
    assert.equal(builder.clause, 'empresa_id.is.null,empresa_id.in.(emp-1,emp-2)');
    assert.equal(executou, false);
  });
});
