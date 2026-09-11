import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { EscalaEventoDia } from './embarque-status';
import {
  classificarCodigoEscalaParaAso,
  janelaSugestaoAso,
  sugerirDatasAso,
} from './aso-agendamento-sugestoes';
import { labelAsoAgendamentoStatus } from './aso-agendamento-status';

describe('classificarCodigoEscalaParaAso', () => {
  it('prefers STB and blocks exact ON / DBA', () => {
    assert.equal(classificarCodigoEscalaParaAso('STB').classe, 'stb');
    assert.equal(classificarCodigoEscalaParaAso('STB').bloqueado, false);
    assert.equal(classificarCodigoEscalaParaAso('ON').classe, 'on');
    assert.equal(classificarCodigoEscalaParaAso('ON').conflito_on, true);
    assert.equal(classificarCodigoEscalaParaAso('ON*').classe, 'on_previsto');
    assert.equal(classificarCodigoEscalaParaAso('DBA').bloqueado, true);
    assert.equal(classificarCodigoEscalaParaAso('').classe, 'livre');
  });
});

describe('janelaSugestaoAso', () => {
  it('opens 60 days before expiry and respects min lead', () => {
    const janela = janelaSugestaoAso({
      hoje: '2026-09-01',
      dataValidade: '2026-10-15',
      antecedenciaDias: 60,
      minLeadDias: 3,
    });
    assert.equal(janela.inicio, '2026-09-04');
    assert.equal(janela.fim, '2026-10-15');
  });

  it('uses a forward window when already expired', () => {
    const janela = janelaSugestaoAso({
      hoje: '2026-09-01',
      dataValidade: '2026-08-01',
      antecedenciaDias: 60,
      minLeadDias: 3,
    });
    assert.equal(janela.inicio, '2026-09-04');
    assert.equal(janela.fim, '2026-11-03');
  });
});

describe('sugerirDatasAso', () => {
  const eventos: EscalaEventoDia[] = [
    {
      id: 'on',
      tipo: 'normal',
      data_embarque: '2026-09-04',
      data_desembarque: '2026-09-17',
      observacoes: 'GT_EMBARQUE=real',
    },
    {
      id: 'stb',
      tipo: 'stb',
      data_embarque: '2026-09-18',
      data_desembarque: '2026-10-10',
      observacoes: '',
    },
  ];

  it('returns STB weekdays ahead of ON days', () => {
    const result = sugerirDatasAso({
      hoje: '2026-09-01',
      dataValidade: '2026-10-15',
      eventos,
      antecedenciaDias: 60,
      minLeadDias: 3,
      maxSugestoes: 5,
    });
    assert.ok(result.sugestoes.length > 0);
    assert.equal(result.sugestoes[0].classe, 'stb');
    assert.equal(result.sugestoes[0].conflito_on, false);
    assert.ok(result.sugestoes.every((s) => s.data >= '2026-09-04'));
  });
});

describe('labelAsoAgendamentoStatus', () => {
  it('covers every status', () => {
    assert.equal(labelAsoAgendamentoStatus('sugerido'), 'Sugerido');
    assert.equal(labelAsoAgendamentoStatus('solicitado'), 'Aguardando logística');
    assert.equal(labelAsoAgendamentoStatus('aprovado'), 'Aprovado');
    assert.equal(labelAsoAgendamentoStatus('reprovado'), 'Reprovado');
    assert.equal(labelAsoAgendamentoStatus('cancelado'), 'Cancelado');
    assert.equal(labelAsoAgendamentoStatus('marcado'), 'Marcado');
  });
});
