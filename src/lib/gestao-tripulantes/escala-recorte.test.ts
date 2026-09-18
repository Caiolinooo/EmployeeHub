import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  computarRecorte,
  diaAnterior,
  diaISO,
  diaSeguinte,
  somarDiasISO,
  type EventoRecorteInput,
  type ResultadoRecorte,
} from './escala-recorte';

const ev = (ini: string, fim: string | null): EventoRecorteInput => ({
  data_embarque: ini,
  data_desembarque: fim,
});
const periodo = (ini: string, fim: string) => ({ inicio: ini, fim });
const FLAGS = { apagarAnteriores: false, apagarPosteriores: false };

/** Evento ON 01→20/09 (ciclo fechado de 14/20 dias). */
const CICLO = ev('2026-09-01', '2026-09-20');

describe('somarDiasISO / diaAnterior / diaSeguinte — aritmética civil sem Date', () => {
  it('atravessa mês, virada de ano e fevereiro (bissexto e não bissexto)', () => {
    assert.equal(somarDiasISO('2026-09-01', -1), '2026-08-31');
    assert.equal(somarDiasISO('2026-08-31', 1), '2026-09-01');
    assert.equal(somarDiasISO('2026-12-31', 1), '2027-01-01');
    assert.equal(somarDiasISO('2026-01-01', -1), '2025-12-31');
    assert.equal(somarDiasISO('2024-02-28', 1), '2024-02-29'); // 2024 é bissexto
    assert.equal(somarDiasISO('2024-02-29', 1), '2024-03-01');
    assert.equal(somarDiasISO('2026-02-28', 1), '2026-03-01'); // 2026 não é
    assert.equal(diaAnterior('2026-03-01'), '2026-02-28');
    assert.equal(diaSeguinte('2026-02-28'), '2026-03-01');
  });

  it('diaISO normaliza e rejeita lixo', () => {
    assert.equal(diaISO('2026-09-11T14:00:00Z'), '2026-09-11');
    assert.equal(diaISO(' 2026-09-11 '), '2026-09-11');
    assert.equal(diaISO('11/09/2026'), null);
    assert.equal(diaISO(''), null);
    assert.equal(diaISO(null), null);
    assert.equal(diaISO(42), null);
  });
});

describe('computarRecorte — recorte em torno do período salvo', () => {
  it('HEAD SÓ: recorte até depois do fim do evento preserva a ponta anterior (encurtar_fim)', () => {
    const r = computarRecorte(CICLO, periodo('2026-09-10', '2026-09-25'), FLAGS);
    assert.equal(r.acao, 'encurtar_fim');
    if (r.acao === 'encurtar_fim') assert.equal(r.novaDataDesembarque, '2026-09-09');
    assert.deepEqual(r.fragmentos, []);
  });

  it('TAIL SÓ: recorte que começa no início do evento preserva a ponta posterior (encurtar_inicio)', () => {
    const r = computarRecorte(CICLO, periodo('2026-09-01', '2026-09-10'), FLAGS);
    assert.equal(r.acao, 'encurtar_inicio');
    if (r.acao === 'encurtar_inicio') assert.equal(r.novaDataEmbarque, '2026-09-11');
    assert.deepEqual(r.fragmentos, []);
  });

  it('HEAD+TAIL: recorte no meio do evento → dividir com head [01→09] e tail [16→20]', () => {
    const r = computarRecorte(CICLO, periodo('2026-09-10', '2026-09-15'), FLAGS);
    assert.equal(r.acao, 'dividir');
    if (r.acao === 'dividir') {
      assert.deepEqual(r.fragmentos, [
        { papel: 'head', inicio: '2026-09-01', fim: '2026-09-09' },
        { papel: 'tail', inicio: '2026-09-16', fim: '2026-09-20' },
      ]);
    }
  });

  it('NENHUM: período maior que o evento cobre tudo → apagar (soft-delete total)', () => {
    const r = computarRecorte(CICLO, periodo('2026-08-15', '2026-09-30'), FLAGS);
    assert.equal(r.acao, 'apagar');
    assert.deepEqual(r.fragmentos, []);
  });

  it('PERÍODO IDÊNTICO ao evento cobre o evento inteiro → apagar', () => {
    // Nas rotas esse caso NUNCA chega aqui: o match "keep" (merge in place) roda
    // antes e o resultado operacional é "nada é tombado". O recorte, se chamado,
    // devolve apagar — contrato do DELETE modo período ("clipe cobre o evento
    // inteiro → soft-delete total").
    const r = computarRecorte(CICLO, periodo('2026-09-01', '2026-09-20'), FLAGS);
    assert.equal(r.acao, 'apagar');
  });

  it('recorte de 1 dia no meio → dividir com head e tail de 1 dia cada (se existirem)', () => {
    const r = computarRecorte(ev('2026-09-10', '2026-09-14'), periodo('2026-09-12', '2026-09-12'), FLAGS);
    assert.equal(r.acao, 'dividir');
    if (r.acao === 'dividir') {
      assert.deepEqual(r.fragmentos, [
        { papel: 'head', inicio: '2026-09-10', fim: '2026-09-11' },
        { papel: 'tail', inicio: '2026-09-13', fim: '2026-09-14' },
      ]);
    }
  });

  it('BORDAS: encostando — início salvo = data_embarque → SEM head; fim salvo = data_desembarque → SEM tail', () => {
    const semHead = computarRecorte(CICLO, periodo('2026-09-01', '2026-09-05'), FLAGS);
    assert.equal(semHead.acao, 'encurtar_inicio');
    const semTail = computarRecorte(CICLO, periodo('2026-09-15', '2026-09-20'), FLAGS);
    assert.equal(semTail.acao, 'encurtar_fim');
    if (semTail.acao === 'encurtar_fim') assert.equal(semTail.novaDataDesembarque, '2026-09-14');
  });

  it('evento de 1 dia: recortar o próprio dia → apagar; dias vizinhos → nada', () => {
    const umDia = ev('2026-09-11', '2026-09-11');
    assert.equal(computarRecorte(umDia, periodo('2026-09-11', '2026-09-11'), FLAGS).acao, 'apagar');
    assert.equal(computarRecorte(umDia, periodo('2026-09-10', '2026-09-15'), FLAGS).acao, 'apagar');
    assert.equal(computarRecorte(umDia, periodo('2026-09-09', '2026-09-10'), FLAGS).acao, 'nada');
    assert.equal(computarRecorte(umDia, periodo('2026-09-12', '2026-09-15'), FLAGS).acao, 'nada');
  });

  it('sem sobreposição → nada (defensivo: o SQL já filtrou, mas nunca cortar linha alheia)', () => {
    assert.equal(computarRecorte(CICLO, periodo('2026-09-21', '2026-09-30'), FLAGS).acao, 'nada');
    assert.equal(computarRecorte(CICLO, periodo('2026-08-01', '2026-08-31'), FLAGS).acao, 'nada');
  });

  it('LINHA ABERTA (data_desembarque NULL): recorte no meio gera tail ABERTO [fim+1..NULL]', () => {
    const aberto = ev('2026-09-01', null);
    const r = computarRecorte(aberto, periodo('2026-09-10', '2026-09-15'), FLAGS);
    assert.equal(r.acao, 'dividir');
    if (r.acao === 'dividir') {
      assert.deepEqual(r.fragmentos, [
        { papel: 'head', inicio: '2026-09-01', fim: '2026-09-09' },
        { papel: 'tail', inicio: '2026-09-16', fim: null },
      ]);
    }
  });

  it('LINHA ABERTA: recorte colado ao início → só tail aberto (encurtar_inicio, linha segue aberta)', () => {
    const aberto = ev('2026-09-01', null);
    const r = computarRecorte(aberto, periodo('2026-09-01', '2026-09-15'), FLAGS);
    assert.equal(r.acao, 'encurtar_inicio');
    if (r.acao === 'encurtar_inicio') assert.equal(r.novaDataEmbarque, '2026-09-16');
  });

  it('LINHA ABERTA: apagarPosteriores fecha o evento no dia anterior ao recorte (encurtar_fim)', () => {
    const aberto = ev('2026-09-01', null);
    const r = computarRecorte(aberto, periodo('2026-09-10', '2026-09-15'), {
      apagarAnteriores: false,
      apagarPosteriores: true,
    });
    assert.equal(r.acao, 'encurtar_fim');
    if (r.acao === 'encurtar_fim') assert.equal(r.novaDataDesembarque, '2026-09-09');
  });
});

describe('computarRecorte — flags apagar_anteriores / apagar_posteriores', () => {
  it('apagarAnteriores descarta o head: recorte na ponta final vira soft-delete total', () => {
    // período 10→25 sobre 01→20 com head suprimido → nem head nem tail → apagar
    const r = computarRecorte(CICLO, periodo('2026-09-10', '2026-09-25'), {
      apagarAnteriores: true,
      apagarPosteriores: false,
    });
    assert.equal(r.acao, 'apagar');
  });

  it('apagarPosteriores descarta o tail: recorte na ponta inicial vira soft-delete total', () => {
    const r = computarRecorte(CICLO, periodo('2026-09-01', '2026-09-10'), {
      apagarAnteriores: false,
      apagarPosteriores: true,
    });
    assert.equal(r.acao, 'apagar');
  });

  it('ambas as flags: recorte no meio vira soft-delete total (comportamento antigo)', () => {
    const r = computarRecorte(CICLO, periodo('2026-09-10', '2026-09-15'), {
      apagarAnteriores: true,
      apagarPosteriores: true,
    });
    assert.equal(r.acao, 'apagar');
  });

  it('flags NÃO afetam dividir quando só uma ponta existiria: head suprimido mantém o tail', () => {
    // período 10→15 sobre 01→20 com apagarAnteriores → só tail → encurtar_inicio
    const r = computarRecorte(CICLO, periodo('2026-09-10', '2026-09-15'), {
      apagarAnteriores: true,
      apagarPosteriores: false,
    });
    assert.equal(r.acao, 'encurtar_inicio');
    if (r.acao === 'encurtar_inicio') assert.equal(r.novaDataEmbarque, '2026-09-16');
  });

  it('tail suprimido mantém o head (encurtar_fim)', () => {
    const r = computarRecorte(CICLO, periodo('2026-09-10', '2026-09-15'), {
      apagarAnteriores: false,
      apagarPosteriores: true,
    });
    assert.equal(r.acao, 'encurtar_fim');
    if (r.acao === 'encurtar_fim') assert.equal(r.novaDataDesembarque, '2026-09-09');
  });
});

describe('computarRecorte — fronteiras de calendário e entradas ruins', () => {
  it('recorte atravessando a virada de mês gera fragmentos civis corretos', () => {
    const r = computarRecorte(ev('2026-08-25', '2026-09-10'), periodo('2026-09-01', '2026-09-05'), FLAGS);
    assert.equal(r.acao, 'dividir');
    if (r.acao === 'dividir') {
      assert.deepEqual(r.fragmentos, [
        { papel: 'head', inicio: '2026-08-25', fim: '2026-08-31' },
        { papel: 'tail', inicio: '2026-09-06', fim: '2026-09-10' },
      ]);
    }
  });

  it('recorte na virada do ano e em fevereiro bissexto', () => {
    const rAno = computarRecorte(ev('2026-12-20', '2027-01-10'), periodo('2026-12-28', '2027-01-03'), FLAGS);
    assert.equal(rAno.acao, 'dividir');
    if (rAno.acao === 'dividir') {
      assert.deepEqual(rAno.fragmentos, [
        { papel: 'head', inicio: '2026-12-20', fim: '2026-12-27' },
        { papel: 'tail', inicio: '2027-01-04', fim: '2027-01-10' },
      ]);
    }
    const rFev = computarRecorte(ev('2024-02-01', '2024-03-10'), periodo('2024-02-28', '2024-02-29'), FLAGS);
    assert.equal(rFev.acao, 'dividir');
    if (rFev.acao === 'dividir') {
      assert.deepEqual(rFev.fragmentos, [
        { papel: 'head', inicio: '2024-02-01', fim: '2024-02-27' },
        { papel: 'tail', inicio: '2024-03-01', fim: '2024-03-10' },
      ]);
    }
  });

  it('datas com hora/timestamp são fatiadas para o dia civil', () => {
    const r = computarRecorte(
      { data_embarque: '2026-09-01T03:00:00.000Z', data_desembarque: '2026-09-20T21:00:00.000Z' },
      periodo('2026-09-10T00:00:00.000Z', '2026-09-12T23:59:59.999Z'),
      FLAGS,
    );
    assert.equal(r.acao, 'dividir');
    if (r.acao === 'dividir') {
      assert.deepEqual(r.fragmentos, [
        { papel: 'head', inicio: '2026-09-01', fim: '2026-09-09' },
        { papel: 'tail', inicio: '2026-09-13', fim: '2026-09-20' },
      ]);
    }
  });

  it('entradas inválidas/ausentes → nada (nunca lança)', () => {
    const ruins: Array<[EventoRecorteInput, { inicio: string; fim: string } | null | undefined]> = [
      [{ data_embarque: '', data_desembarque: '2026-09-20' }, periodo('2026-09-10', '2026-09-15')],
      [{ data_embarque: '11/09/2026', data_desembarque: null }, periodo('2026-09-10', '2026-09-15')],
      [CICLO, null],
      [CICLO, undefined],
      [CICLO, { inicio: '', fim: '2026-09-15' }],
      [CICLO, { inicio: '2026-09-15', fim: 'lixo' }],
    ];
    for (const [e, p] of ruins) {
      const r: ResultadoRecorte = computarRecorte(e, p as { inicio: string; fim: string }, FLAGS);
      assert.equal(r.acao, 'nada');
    }
    // período invertido → nada (as rotas já rejeitam com 400)
    assert.equal(computarRecorte(CICLO, periodo('2026-09-15', '2026-09-10'), FLAGS).acao, 'nada');
  });
});
