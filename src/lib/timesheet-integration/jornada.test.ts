import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  acoesExpediente,
  calcularJornada,
  faseExpediente,
  formatarMinutos,
  montarHojeAposBatida,
  paraRelogio,
  dataTrabalho,
  rejeitarBatida,
  resumoHoje,
} from './jornada';

describe('jornada do ponto', () => {
  it('08:00–17:00 desconta 1h de almoço e não avisa', () => {
    const dia = calcularJornada('08:00', '17:00');
    assert.ok(dia);
    assert.equal(dia.grossMinutes, 9 * 60);
    assert.equal(dia.lunchMinutes, 60);
    assert.equal(dia.netMinutes, 8 * 60);
    assert.equal(dia.lunchApplied, true);
    assert.equal(dia.belowEightHours, false);
  });

  it('08:00–16:00 fica abaixo de 8h depois do almoço', () => {
    const dia = calcularJornada('08:00', '16:00');
    assert.ok(dia);
    assert.equal(dia.lunchMinutes, 60);
    assert.equal(dia.netMinutes, 7 * 60);
    assert.equal(dia.belowEightHours, true);
    assert.equal(resumoHoje({ date: '2026-10-07', open: false, horaIni: '08:00', horaFim: '16:00' }).avisoMenosDeOitoHoras, true);
  });

  it('turno inteiro fora de 12:00–13:00 não desconta almoço fantasma', () => {
    const tarde = calcularJornada('14:00', '22:00');
    assert.ok(tarde);
    assert.equal(tarde.lunchMinutes, 0);
    assert.equal(tarde.lunchApplied, false);
    assert.equal(tarde.netMinutes, 8 * 60);
    assert.equal(tarde.belowEightHours, false);

    const manha = calcularJornada('07:00', '12:00');
    assert.ok(manha);
    assert.equal(manha.lunchMinutes, 0);
    assert.equal(manha.netMinutes, 5 * 60);
    assert.equal(manha.belowEightHours, true);

    const depois = calcularJornada('13:00', '21:00');
    assert.ok(depois);
    assert.equal(depois.lunchMinutes, 0);
    assert.equal(depois.netMinutes, 8 * 60);
  });

  it('sobreposição parcial desconta só o trecho dentro de 12:00–13:00', () => {
    const dia = calcularJornada('11:30', '12:30');
    assert.ok(dia);
    assert.equal(dia.lunchMinutes, 30);
    assert.equal(dia.netMinutes, 30);
    assert.equal(dia.belowEightHours, true);

    const umMinuto = calcularJornada('08:00', '12:01');
    assert.ok(umMinuto);
    assert.equal(umMinuto.lunchMinutes, 1);
  });

  it('8h exatas não disparam o aviso', () => {
    const dia = calcularJornada('09:00', '18:00');
    assert.ok(dia);
    assert.equal(dia.netMinutes, 8 * 60);
    assert.equal(dia.belowEightHours, false);
    assert.equal(formatarMinutos(dia.netMinutes), '8h00');
    assert.equal(formatarMinutos(7 * 60 + 53), '7h53');
  });

  it('rejeita data ambígua e converte ISO com fuso para America/Sao_Paulo', () => {
    assert.equal(paraRelogio('10/08/2026'), null);
    assert.equal(paraRelogio('08:00:00'), '08:00');
    assert.equal(paraRelogio('2026-10-07T15:00:00.000Z'), '12:00');
    assert.equal(dataTrabalho('2026-10-07T15:00:00.000Z', '2026-10-07T15:00:00.000Z'), '2026-10-07');
    assert.equal(dataTrabalho('2026-10-08', '2026-10-07T15:00:00.000Z'), '2026-10-08');
    assert.equal(dataTrabalho('10/08/2026', '2026-10-07T15:00:00.000Z'), '2026-10-07');
    assert.equal(calcularJornada('10/08/2026', '17:00'), null);
    assert.equal(calcularJornada('17:00', '08:00'), null);
  });

  it('início e fim seguem a fase do dia', () => {
    assert.deepEqual(acoesExpediente('aguardando_inicio'), { inicio: true, fim: false });
    assert.deepEqual(acoesExpediente('em_aberto'), { inicio: false, fim: true });
    assert.deepEqual(acoesExpediente('encerrado'), { inicio: false, fim: false });
    assert.equal(faseExpediente({ open: false, horaIni: null, horaFim: null }), 'aguardando_inicio');
    assert.equal(faseExpediente({ open: true, horaIni: '08:00', horaFim: null }), 'em_aberto');
    assert.equal(faseExpediente({ open: false, horaIni: '08:00', horaFim: '17:00' }), 'encerrado');
    assert.equal(rejeitarBatida('aguardando_inicio', 'out'), 'Marque o início do expediente antes do fim.');
    assert.equal(rejeitarBatida('em_aberto', 'out'), null);
    assert.equal(rejeitarBatida('encerrado', 'in'), 'O início do expediente já foi registrado hoje.');
  });

  it('batida sem relógio do PontoFlow ainda preenche Hoje pelo instante', () => {
    const inicio = montarHojeAposBatida({
      kind: 'in',
      at: '2026-10-07T11:12:00.000Z',
      previous: { date: '2026-10-07', open: false, horaIni: null, horaFim: null },
      returnedIni: null,
      returnedFim: null,
      date: '2026-10-07',
    });
    assert.equal(inicio.horaIni, '08:12');
    assert.equal(inicio.open, true);

    const fim = montarHojeAposBatida({
      kind: 'out',
      at: '2026-10-07T20:05:00.000Z',
      previous: inicio,
      returnedIni: null,
      returnedFim: null,
      date: '2026-10-07',
    });
    assert.equal(fim.horaIni, '08:12');
    assert.equal(fim.horaFim, '17:05');
    assert.equal(fim.open, false);
    assert.equal(resumoHoje(fim).avisoMenosDeOitoHoras, true);
  });

  it('dia em aberto não avisa jornada curta', () => {
    assert.equal(
      resumoHoje({ date: '2026-10-07', open: true, horaIni: '08:00', horaFim: null }).avisoMenosDeOitoHoras,
      false,
    );
  });
});
