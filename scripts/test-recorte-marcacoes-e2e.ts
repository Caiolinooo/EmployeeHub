/**
 * E2E do recorte de marcações + exclusão parcial + autodesfazer (v5.80).
 *
 * Valida o encadeamento LIFO da trilha gt_escala_edicoes com as guardas
 * existentes de reverterEdicaoEscala:
 *   1. cria colaborador sintético + evento de 14 dias;
 *   2. recorte NO MEIO do evento (aplicarRecorteEmSobreposto, flags false/false)
 *      → delete da original + 2 creates (fragmentos head/tail);
 *   3. reverter os creates dos fragmentos (mais novos primeiro);
 *   4. reverter o delete da original (guarda de sobreposição passa — nenhum
 *      evento vivo sobreposto) → ESTADO ORIGINAL RESTAURADO;
 *   5. confere edicaoEhDoProprioAutorAplicada (base do AUTODESFAZER);
 *   7. desfazer EM CADEIA do toast sobre um SAVE que recorta sobreposto
 *      same-type (trilha [create do salvo, ...efeitos]; ordem de desfazer =
 *      salvo PRIMEIRO, efeitos em ordem reversa — `salvarEventoPrimeiro` de
 *      reverter-edicoes.ts): sem 409 da guarda de sobreposição e estado
 *      pré-salvo restaurado (em LIFO puro o un-delete da original encontra o
 *      salvo ainda vivo e quebra no meio da cadeia);
 *   6. limpa TODAS as linhas de teste (hard delete).
 *
 * Uso: npx tsx scripts/test-recorte-marcacoes-e2e.ts
 * (lê SUPABASE env de .env.local/.env/.env.production — padrão dos scripts/)
 * Sucesso: imprime RECORTE_E2E_OK.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

function loadEnvFiles(): void {
  const files = ['.env.local', '.env', '.env.production'];
  for (const f of files) {
    const p = path.join(process.cwd(), f);
    if (!fs.existsSync(p)) continue;
    const raw = fs.readFileSync(p, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!m) continue;
      let val = m[2].trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[m[1]] && val) process.env[m[1]] = val;
    }
  }
}

loadEnvFiles();

// EscalaEdicaoAtor (type-only import falha em import() dinâmico no esbuild antigo).
interface AtorE2E {
  id: string;
  nome: string;
  role: string;
  ip: string;
}

const assert = (cond: unknown, msg: string): void => {
  if (!cond) throw new Error(`FALHA E2E: ${msg}`);
  console.log(`  ok — ${msg}`);
};

async function main(): Promise<void> {
  // Imports dos módulos do servidor — SÓ depois do env (supabaseAdmin é eager).
  const { supabaseAdmin } = await import('../src/lib/supabase');
  const {
    aplicarRecorteEmSobreposto,
    buscarEmbarquePorId,
    edicaoEhDoProprioAutorAplicada,
    registrarEdicaoEscala,
    reverterEdicaoEscala,
    snapshotEmbarque,
  } = await import('../src/lib/gestao-tripulantes/escala-audit-writer');

  const ATOR: AtorE2E = {
    id: crypto.randomUUID(),
    nome: 'E2E Recorte (script)',
    role: 'admin',
    ip: '127.0.0.1',
  };

  const cpfTeste = `9${String(Date.now()).slice(-10)}`; // sintético, único
  let colaboradorId: string | null = null;

  try {
    // 1) Colaborador sintético (FK de gt_historico_embarques/gt_escala_edicoes).
    const insColab = await supabaseAdmin
      .from('gt_colaboradores')
      .insert({
        nome_completo: '[TESTE E2E] Recorte de marcações (pode excluir)',
        cpf: cpfTeste,
        ativo: false,
      })
      .select('id')
      .single();
    if (insColab.error) throw new Error(`criar colaborador: ${insColab.error.message}`);
    colaboradorId = (insColab.data as { id: string }).id;
    console.log(`1) colaborador sintético criado ${colaboradorId} (cpf ${cpfTeste})`);

    // Evento de 14 dias (01→14/10/2026).
    const insEmb = await supabaseAdmin
      .from('gt_historico_embarques')
      .insert({
        colaborador_id: colaboradorId,
        tipo: 'normal',
        data_embarque: '2026-10-01',
        data_desembarque: '2026-10-14',
        local_embarque: 'E2E-ORIGEM',
        local_desembarque: 'E2E-DESTINO',
        observacoes: 'evento original 14 dias (e2e recorte)',
        exibir_dia_inicio: true,
        origem: 'local',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single();
    if (insEmb.error) throw new Error(`criar embarque: ${insEmb.error.message}`);
    const originalId = (insEmb.data as { id: string }).id;
    console.log(`2) evento original 14 dias criado ${originalId} [2026-10-01..2026-10-14]`);

    // 2) Recorte NO MEIO: período 05→10/10 → dividir (delete + head + tail).
    const efeito = await aplicarRecorteEmSobreposto({
      row: insEmb.data as Record<string, unknown>,
      periodo: { inicio: '2026-10-05', fim: '2026-10-10' },
      apagarAnteriores: false,
      apagarPosteriores: false,
      ator: ATOR,
      colaboradorId,
      now: new Date().toISOString(),
      motivos: { delete: 'Exclusão parcial de período (modo período)' },
    });
    assert(efeito.acao === 'dividir', `ação do recorte no meio é 'dividir' (veio '${efeito.acao}')`);
    assert(efeito.edicoes.length === 3, `trilha gravou 3 edições (delete + 2 creates); veio ${efeito.edicoes.length}`);
    assert(efeito.fragmentos.length === 2, `2 fragmentos criados; veio ${efeito.fragmentos.length}`);
    const fragHead = efeito.fragmentos[0];
    const fragTail = efeito.fragmentos[1];
    assert(fragHead.data_embarque === '2026-10-01' && fragHead.data_desembarque === '2026-10-04', `head [2026-10-01..2026-10-04] (veio [${fragHead.data_embarque}..${fragHead.data_desembarque}])`);
    assert(fragTail.data_embarque === '2026-10-11' && fragTail.data_desembarque === '2026-10-14', `tail [2026-10-11..2026-10-14] (veio [${fragTail.data_embarque}..${fragTail.data_desembarque}])`);
    assert(fragHead.tipo === 'normal' && fragHead.origem === 'local' && fragHead.observacoes === 'evento original 14 dias (e2e recorte)', 'fragmentos copiam tipo/origem/observacoes');
    const { data: originalAposRecorte } = await supabaseAdmin
      .from('gt_historico_embarques')
      .select('deleted_at')
      .eq('id', originalId)
      .single();
    assert(Boolean((originalAposRecorte as { deleted_at?: string } | null)?.deleted_at), 'original soft-deletada pelo recorte');
    console.log(`   edicoes (ordem de gravação): ${efeito.edicoes.join(', ')}`);

    // 5) Autodesfazer: as edições desta ação são do próprio ator e estão aplicadas.
    for (const idEdicao of efeito.edicoes) {
      assert(
        (await edicaoEhDoProprioAutorAplicada(idEdicao, ATOR.id as string)) === true,
        `autodesfazer liberado para o próprio autor (edição ${idEdicao.slice(0, 8)}…)`,
      );
      assert(
        (await edicaoEhDoProprioAutorAplicada(idEdicao, crypto.randomUUID())) === false,
        `autodesfazer NEGADO para outro usuário (edição ${idEdicao.slice(0, 8)}…)`,
      );
    }

    // 3) ROLLBACK LIFO: reverter creates dos fragmentos, mais novos primeiro.
    const { data: aplicadas } = await supabaseAdmin
      .from('gt_escala_edicoes')
      .select('id, operacao, embarque_id, created_at')
      .in('embarque_id', [String(fragHead.id), String(fragTail.id), originalId])
      .eq('status', 'aplicada')
      .in('operacao', ['create', 'update', 'delete', 'restore'])
      .order('created_at', { ascending: false })
      .order('id', { ascending: false });
    const fila = (aplicadas || []) as Array<{ id: string; operacao: string; embarque_id: string }>;
    assert(fila.length === 3, `fila LIFO com 3 edições aplicadas; veio ${fila.length}`);
    assert(fila[0].operacao === 'create' && fila[1].operacao === 'create' && fila[2].operacao === 'delete', 'ordem LIFO: create, create, delete');

    for (const ed of fila) {
      const res = await reverterEdicaoEscala({
        edicaoId: ed.id,
        motivo: 'teste e2e — desfazer encadeamento do recorte',
        ator: ATOR,
        operacao: 'reversao',
      });
      assert(res.ok, `reverter ${ed.operacao} do embarque ${ed.embarque_id.slice(0, 8)}… (${res.ok ? 'ok' : (res as { error?: string }).error})`);
    }

    // 4) Estado original restaurado.
    const originalFinal = await buscarEmbarquePorId(originalId);
    assert(originalFinal && !originalFinal.deleted_at, 'original viva de novo (deleted_at null)');
    assert(originalFinal?.data_embarque === '2026-10-01' && originalFinal?.data_desembarque === '2026-10-14', 'datas originais restauradas [2026-10-01..2026-10-14]');
    for (const frag of [fragHead, fragTail]) {
      const linha = await buscarEmbarquePorId(String(frag.id));
      assert(linha && Boolean(linha.deleted_at), `fragmento ${String(frag.id).slice(0, 8)}… soft-deletado pelo rollback do create`);
    }

    // 7) DESFAZER EM CADEIA do toast sobre SAVE que RECORTA (ordem corrigida).
    //    Reproduz o contrato do POST/PUT /embarques: trilha gravada como
    //    [create do evento salvo, ...efeitos do recorte] — aqui o evento salvo
    //    [2026-10-05..2026-10-10] cai no MEIO da original restaurada acima
    //    (recorte 'dividir': delete da original + head + tail). Em LIFO puro o
    //    un-delete da original encontra o salvo ainda VIVO → 409 da guarda de
    //    sobreposição. Ordem do toast (`salvarEventoPrimeiro`, reverter-edicoes
    //    .ts): salvo primeiro, efeitos em ordem reversa.
    const insSalvo = await supabaseAdmin
      .from('gt_historico_embarques')
      .insert({
        colaborador_id: colaboradorId,
        tipo: 'normal',
        data_embarque: '2026-10-05',
        data_desembarque: '2026-10-10',
        local_embarque: 'E2E-SALVO',
        local_desembarque: 'E2E-SALVO',
        observacoes: 'evento salvo sobre o original (e2e recorte)',
        exibir_dia_inicio: true,
        origem: 'local',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single();
    if (insSalvo.error) throw new Error(`criar evento salvo: ${insSalvo.error.message}`);
    const salvoId = (insSalvo.data as { id: string }).id;
    console.log(`7) evento salvo sobreposto criado ${salvoId} [2026-10-05..2026-10-10]`);

    // Mesma ordem de gravação da rota: 1º a linha do evento salvo…
    const idSalvo = await registrarEdicaoEscala({
      embarqueId: salvoId,
      colaboradorId,
      operacao: 'create',
      status: 'aplicada',
      dadosAnteriores: null,
      dadosNovos: snapshotEmbarque((insSalvo.data ?? {}) as Record<string, unknown>),
      motivo: 'Evento de escala criado',
      ator: ATOR,
    });
    assert(Boolean(idSalvo), 'trilha gravou o create do evento salvo');
    // …depois os efeitos de recorte sobre a original.
    const efeitoSalvo = await aplicarRecorteEmSobreposto({
      row: insEmb.data as Record<string, unknown>,
      periodo: { inicio: '2026-10-05', fim: '2026-10-10' },
      apagarAnteriores: false,
      apagarPosteriores: false,
      ator: ATOR,
      colaboradorId,
      now: new Date().toISOString(),
      motivos: { delete: 'Substituído pelo evento salvo (overlap-replace)' },
    });
    assert(efeitoSalvo.acao === 'dividir', `recorte do save é 'dividir' (veio '${efeitoSalvo.acao}')`);
    assert(efeitoSalvo.edicoes.length === 3, `efeitos do save gravaram 3 edições; veio ${efeitoSalvo.edicoes.length}`);

    // Fila do Desfazer exatamente como o helper agora monta ([salvo, ...efeitos
    // em ordem reversa]) e reversão completo SEM 409.
    const edicoesDaAcao = [idSalvo as string, ...efeitoSalvo.edicoes];
    const filaDesfazer = [edicoesDaAcao[0], ...edicoesDaAcao.slice(1).reverse()];
    assert(filaDesfazer.length === 4, `fila do desfazer com 4 edições; veio ${filaDesfazer.length}`);
    for (const idEdicao of filaDesfazer) {
      const res = await reverterEdicaoEscala({
        edicaoId: idEdicao,
        motivo: 'teste e2e — desfazer em cadeia do save (evento salvo primeiro)',
        ator: ATOR,
        operacao: 'reversao',
      });
      assert(res.ok, `reverter em cadeia sem 409 (${res.ok ? 'ok' : (res as { error?: string }).error})`);
    }

    // 7b) Estado pré-salvo restaurado: original viva com as datas de origem;
    //     evento salvo e fragmentos soft-deletados.
    const originalAposDesfazer = await buscarEmbarquePorId(originalId);
    assert(originalAposDesfazer && !originalAposDesfazer.deleted_at, 'original viva após o desfazer em cadeia');
    assert(originalAposDesfazer?.data_embarque === '2026-10-01' && originalAposDesfazer?.data_desembarque === '2026-10-14', 'datas da original restauradas após o desfazer em cadeia');
    const salvoAposDesfazer = await buscarEmbarquePorId(salvoId);
    assert(salvoAposDesfazer && Boolean(salvoAposDesfazer.deleted_at), 'evento salvo soft-deletado pelo desfazer');
    for (const frag of efeitoSalvo.fragmentos) {
      const linha = await buscarEmbarquePorId(String(frag.id));
      assert(linha && Boolean(linha.deleted_at), `fragmento do save ${String(frag.id).slice(0, 8)}… soft-deletado pelo desfazer`);
    }

    console.log('RECORTE_E2E_OK');
  } finally {
    // 6) Limpeza total das linhas de teste.
    if (colaboradorId) {
      const delEd = await supabaseAdmin.from('gt_escala_edicoes').delete().eq('colaborador_id', colaboradorId);
      const delEmb = await supabaseAdmin.from('gt_historico_embarques').delete().eq('colaborador_id', colaboradorId);
      const delColab = await supabaseAdmin.from('gt_colaboradores').delete().eq('id', colaboradorId);
      const falhas = [delEd.error, delEmb.error, delColab.error].filter(Boolean);
      if (falhas.length > 0) {
        console.error('AVISO: limpeza com falhas:', falhas.map((e) => (e as { message: string }).message).join('; '));
      } else {
        console.log('limpeza concluída (edições, embarques e colaborador de teste removidos)');
      }
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
