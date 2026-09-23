/**
 * Gate G1 de integração (§10) — fluxo E2E do módulo Financeiro com sandbox
 * fake, SEM rede externa:
 *   folha aprovada (fixture) → fatura com itens de folha → emitida →
 *   render HTML/PDF/XLSX não vazios → NFS-e autorizada (provider proprietário
 *   apontado para servidor HTTP local) → cobrança boleto (fixture no banco —
 *   sem adapter de rede) → importar conciliação (CSV XP) → cobrança `liquidada`
 *   → eventos completos em fin_eventos.
 *
 * Idempotente: usa fixtures com chaves dedicadas e limpa ao iniciar.
 * Uso: npx tsx scripts/verify-financeiro-fluxo-e2e.ts  → FIN_FLUXO_E2E_OK
 */
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import ExcelJS from 'exceljs';
import dotenv from 'dotenv';
// Precisa rodar ANTES dos imports de src/lib (supabase.ts valida env no load).
dotenv.config({ path: '.env.local' });
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { gerarFaturaDaFolha, emitirFatura, emitirNfse, importarConciliacoes } from '@/lib/financeiro/service';
import { renderFaturaHtml } from '@/lib/financeiro/invoice/render-html';
import { renderFaturaPdf } from '@/lib/financeiro/invoice/render-pdf';
import { renderFaturaXlsx } from '@/lib/financeiro/invoice/render-xlsx';
import { parseCsvExtrato } from '@/lib/financeiro/banks/csv-extrato';
import { registrarEvento } from '@/lib/financeiro/eventos';
import type { FinFatura, FinNfseEmissao } from '@/types/financeiro';

const EMPRESA_CNPJ = '00.000.000/0001-99';
const EMPRESA_NOME = 'E2E Financeiro Fixture';
const CLIENTE_KEY = 'E2E_FIXTURE';
const ATOR = { userId: null, nome: 'e2e-financeiro' };

function falhar(msg: string): never {
  console.error(`FIN_FLUXO_E2E_FAIL: ${msg}`);
  process.exit(1);
}

function loadEnvFiles(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const f of ['.env.local', '.env', '.env.production']) {
    const p = path.join(process.cwd(), f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (m && !env[m[1]] && m[2].trim()) {
        env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
      }
    }
  }
  return env;
}

function criarCliente(): SupabaseClient {
  const env = loadEnvFiles();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    env.SUPABASE_SERVICE_KEY;
  if (!url || !key) falhar('Supabase env ausente');
  return createClient(url!, key!, { auth: { persistSession: false } });
}

/** Servidor HTTP local que simula o webservice proprietário (resposta autorizada). */
async function iniciarMockNfse(): Promise<{ url: string; fechar: () => Promise<void> }> {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        numero_nfse: 'E2E1',
        codigo_verificacao: 'E2E-COD',
        protocolo: 'E2E-PROTO-1',
        situacao: 'autorizado',
      }),
    );
  });
  const escuta = Promise.withResolvers<void>();
  server.on('listening', escuta.resolve);
  server.listen(0, '127.0.0.1');
  await escuta.promise;
  const addr = server.address() as { port: number };
  const fechado = Promise.withResolvers<void>();
  return {
    url: `http://127.0.0.1:${addr.port}/nfse`,
    fechar: () => {
      server.close(() => fechado.resolve());
      return fechado.promise;
    },
  };
}

async function main() {
  const supabase = criarCliente();
  const hoje = new Date();
  const mes = hoje.getMonth() + 1;
  const ano = hoje.getFullYear();

  // ---------- 0. limpeza de execuções anteriores (fixtures dedicadas) ----------
  const { data: empresaVelha } = await supabase
    .from('payroll_companies')
    .select('id')
    .eq('cnpj', EMPRESA_CNPJ)
    .maybeSingle();
  if (empresaVelha) {
    const empresaId = (empresaVelha as { id: string }).id;
    // Ordem imposta pelas FKs: conciliações→cobranças→emissões→faturas→clientes;
    // pagamentos→folhas; contas bancárias por último.
    const { data: faturasVelhas, error: errFaturasQ } = await supabase.from('fin_faturas').select('id').eq('empresa_id', empresaId);
    if (errFaturasQ) falhar(`limpeza (query faturas): ${errFaturasQ.message}`);
    const ids = ((faturasVelhas || []) as { id: string }[]).map((f) => f.id);
    if (ids.length > 0) {
      const { data: cobrancasVelhas, error: errCobQ } = await supabase.from('fin_cobrancas').select('id').in('fatura_id', ids);
      if (errCobQ) falhar(`limpeza (query cobranças): ${errCobQ.message}`);
      const idsCob = ((cobrancasVelhas || []) as { id: string }[]).map((c) => c.id);
      const passos: Array<[string, { error: { message: string } | null }]> = [];
      if (idsCob.length > 0) {
        passos.push(['fin_conciliacoes', await supabase.from('fin_conciliacoes').delete().in('cobranca_id', idsCob)]);
      }
      passos.push(
        ['fin_eventos', await supabase.from('fin_eventos').delete().in('entidade_id', [...ids, ...idsCob])],
        ['fin_nfse_emissoes', await supabase.from('fin_nfse_emissoes').delete().in('fatura_id', ids)],
        ['fin_cobrancas', await supabase.from('fin_cobrancas').delete().in('fatura_id', ids)],
        ['fin_faturas', await supabase.from('fin_faturas').delete().in('id', ids)],
      );
      for (const [tabela, r] of passos) {
        if (r.error) falhar(`limpeza (${tabela}): ${r.error.message}`);
      }
    }
    const { data: sheetsVelhas } = await supabase.from('payroll_sheets').select('id').eq('company_id', empresaId);
    const sheetIds = ((sheetsVelhas || []) as { id: string }[]).map((s) => s.id);
    const passosFolha: Array<[string, { error: { message: string } | null }]> = [];
    if (sheetIds.length > 0) {
      passosFolha.push(['fin_pagamentos', await supabase.from('fin_pagamentos').delete().in('origem_id', sheetIds)]);
      for (const s of sheetIds) {
        passosFolha.push(
          ['payroll_employee_summaries', await supabase.from('payroll_employee_summaries').delete().eq('sheet_id', s)],
          ['payroll_sheet_items', await supabase.from('payroll_sheet_items').delete().eq('sheet_id', s)],
        );
      }
    }
    const { data: contasVelhas, error: errContasQ } = await supabase.from('fin_contas_bancarias').select('id').eq('empresa_id', empresaId);
    if (errContasQ) falhar(`limpeza (query contas): ${errContasQ.message}`);
    const contaIds = ((contasVelhas || []) as { id: string }[]).map((c) => c.id);
    if (contaIds.length > 0) {
      const rConc = await supabase.from('fin_conciliacoes').delete().in('conta_bancaria_id', contaIds);
      if (rConc.error) falhar(`limpeza (fin_conciliacoes/conta): ${rConc.error.message}`);
    }
    passosFolha.push(
      ['payroll_sheets', await supabase.from('payroll_sheets').delete().eq('company_id', empresaId)],
      ['payroll_employees', await supabase.from('payroll_employees').delete().eq('company_id', empresaId)],
      ['fin_nfse_config', await supabase.from('fin_nfse_config').delete().eq('empresa_id', empresaId)],
      ['fin_clientes', await supabase.from('fin_clientes').delete().eq('empresa_id', empresaId)],
      ['fin_contas_bancarias', await supabase.from('fin_contas_bancarias').delete().eq('empresa_id', empresaId)],
    );
    for (const [tabela, r] of passosFolha) {
      if (r.error) falhar(`limpeza (${tabela}): ${r.error.message}`);
    }
  }

  // ---------- 1. fixtures: empresa, cliente, folha aprovada ----------
  const { data: empresa, error: errEmpresa } = await supabase
    .from('payroll_companies')
    .upsert({ name: EMPRESA_NOME, cnpj: EMPRESA_CNPJ }, { onConflict: 'cnpj' })
    .select('id')
    .single();
  if (errEmpresa) falhar(`fixture empresa: ${errEmpresa.message}`);
  const empresaId = (empresa as { id: string }).id;
  console.log(`Fixture empresa: ${empresaId}`);

  const { data: cliente, error: errCliente } = await supabase
    .from('fin_clientes')
    .upsert(
      { empresa_id: empresaId, client_key: CLIENTE_KEY, nome: 'Cliente E2E Ltd', documento: '12345678000190', moeda: 'BRL' },
      { onConflict: 'empresa_id,client_key' },
    )
    .select('id')
    .single();
  if (errCliente) falhar(`fixture cliente: ${errCliente.message}`);
  const clienteId = (cliente as { id: string }).id;

  const { data: employee, error: errEmp } = await supabase
    .from('payroll_employees')
    .insert({ company_id: empresaId, name: 'Tripulante E2E', cpf: '52998224725', base_salary: 10000, status: 'active' })
    .select('id')
    .single();
  if (errEmp) falhar(`fixture employee: ${errEmp.message}`);
  const employeeId = (employee as { id: string }).id;

  const primeiroDia = `${ano}-${String(mes).padStart(2, '0')}-01`;
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const { data: sheet, error: errSheet } = await supabase
    .from('payroll_sheets')
    .upsert(
      {
        company_id: empresaId,
        reference_month: mes,
        reference_year: ano,
        period_start: primeiroDia,
        period_end: `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`,
        status: 'approved',
        total_employees: 1,
        total_gross: 12000,
        total_net: 9500,
      },
      { onConflict: 'company_id,reference_month,reference_year' },
    )
    .select('id')
    .single();
  if (errSheet) falhar(`fixture sheet: ${errSheet.message}`);
  const sheetId = (sheet as { id: string }).id;
  const { error: errSummary } = await supabase.from('payroll_employee_summaries').insert({
    sheet_id: sheetId,
    employee_id: employeeId,
    gross_salary: 12000,
    net_salary: 9500,
    base_salary: 10000,
  });
  if (errSummary) falhar(`fixture summary: ${errSummary.message}`);
  console.log(`Fixture folha approved: ${sheetId}`);

  // ---------- 2. folha → fatura com itens de folha ----------
  const fatura: FinFatura = await gerarFaturaDaFolha({ sheetId, clienteId }, ATOR);
  if (fatura.origem_tipo !== 'folha' || (fatura.itens || []).length !== 1) {
    falhar('fatura da folha deveria ter 1 item origem=folha');
  }
  if (Number(fatura.valor_total) !== 12000) falhar(`valor_total esperado 12000, veio ${fatura.valor_total}`);
  console.log(`Fatura criada (rascunho): ${fatura.numero}/${fatura.ano} — itens de folha OK`);

  // ---------- 3. emitir → snapshot + evento ----------
  const emitida = await emitirFatura(fatura.id, ATOR);
  if (emitida.status !== 'emitida') falhar(`fatura deveria estar emitida, veio ${emitida.status}`);
  if ((emitida.cliente_snapshot as { nome?: string } | null)?.nome !== 'Cliente E2E Ltd') {
    falhar('snapshot do cliente ausente/incorreto na emissão');
  }
  console.log('Fatura emitida: snapshot do cliente gravado');

  // ---------- 4. renders HTML/PDF/XLSX não vazios ----------
  const html = renderFaturaHtml({
    fatura: { numero: emitida.numero, ano: emitida.ano, moeda: 'BRL', valorTotal: Number(emitida.valor_total), status: emitida.status, dataEmissao: emitida.data_emissao || undefined },
    emissor: { razaoSocial: EMPRESA_NOME, cnpj: EMPRESA_CNPJ },
    cliente: { nome: 'Cliente E2E Ltd', documento: '12345678000190' },
    itens: (emitida.itens || []).map((it) => ({
      descricao: it.descricao,
      referencia: it.referencia || undefined,
      quantidade: Number(it.quantidade),
      valorUnitario: Number(it.valor_unitario),
      valorTotal: Number(it.valor_total),
    })),
  });
  if (html.length < 1500) falhar('HTML render vazio/truncado');

  const pdf = await renderFaturaPdf({
    fatura: { numero: emitida.numero, ano: emitida.ano, moeda: 'BRL', valorTotal: Number(emitida.valor_total), status: emitida.status },
    emissor: { razaoSocial: EMPRESA_NOME, cnpj: EMPRESA_CNPJ },
    cliente: { nome: 'Cliente E2E Ltd' },
    itens: [{ descricao: 'Tripulante E2E', quantidade: 1, valorUnitario: 12000, valorTotal: 12000 }],
  });
  if (pdf.subarray(0, 5).toString() !== '%PDF-' || pdf.length < 1000) falhar('PDF render inválido');

  // xlsx: mini-template local com as convenções do Template_Invoice_Geral
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Planilha1');
  ws.getCell('C12').value = 'Invoice date:';
  ws.getCell('C13').value = 'Invoice No:';
  ws.getCell('A12').value = 'Client:';
  const tmpTemplate = path.join(os.tmpdir(), `e2e-template-${Date.now()}.xlsx`);
  await wb.xlsx.writeFile(tmpTemplate);
  const xlsx = await renderFaturaXlsx(
    {
      fatura: { numero: emitida.numero, ano: emitida.ano, moeda: 'BRL', valorTotal: Number(emitida.valor_total), status: emitida.status, dataEmissao: emitida.data_emissao || undefined },
      emissor: { razaoSocial: EMPRESA_NOME, cnpj: EMPRESA_CNPJ },
      cliente: { nome: 'Cliente E2E Ltd' },
      itens: [{ descricao: 'Tripulante E2E', referencia: '08/2026', quantidade: 1, valorUnitario: 12000, valorTotal: 12000 }],
    },
    {
      storagePath: tmpTemplate,
      tipo: 'xlsx',
      mapping: {
        celulas: { invoice_no: 'C13', invoice_date: 'C12', cliente: 'A12' },
        servicos: { linhaInicial: 17, linhaFinal: 29, colunas: { descricao: 'A', referencia: 'A', valor: 'D' } },
        totais: { celula: 'D30' },
      },
    },
  );
  fs.unlinkSync(tmpTemplate);
  if (xlsx.subarray(0, 2).toString() !== 'PK' || xlsx.length < 1000) falhar('XLSX render inválido');
  console.log(`Renders: HTML=${html.length}B, PDF=${pdf.length}B, XLSX=${xlsx.length}B — todos não vazios`);

  // ---------- 5. NFS-e autorizada (provider proprietário + mock local Macaé) ----------
  const mock = await iniciarMockNfse();
  try {
    const { data: configNfse, error: errCfg } = await supabase
      .from('fin_nfse_config')
      .insert({
        empresa_id: empresaId,
        municipio_id: '3302403',
        provider_key: 'proprietario',
        inscricao_municipal: 'E2E-IM',
        aliquota_iss: 2,
        config: { wsdl_url: mock.url, authTipo: 'none', codigo_lc116_padrao: '14.01' },
        rps_serie: 'E2E',
      })
      .select('id')
      .single();
    if (errCfg) falhar(`fixture nfse config: ${errCfg.message}`);

    const emissao: FinNfseEmissao = await emitirNfse(fatura.id, ATOR);
    if (emissao.status !== 'autorizado') {
      falhar(`emissão deveria autorizar via mock, veio ${emissao.status} (${JSON.stringify(emissao.mensagem_erro)})`);
    }
    if (emissao.numero_nfse !== 'E2E1') falhar(`numero_nfse esperado E2E1, veio ${emissao.numero_nfse}`);
    const { data: faturaPos } = await supabase.from('fin_faturas').select('status').eq('id', fatura.id).single();
    if ((faturaPos as { status: string }).status !== 'nfse_emitida') falhar('fatura deveria virar nfse_emitida');
    console.log(`NFS-e autorizada (mock proprietário Macaé): RPS ${emissao.rps_numero} série ${emissao.rps_serie}`);

    // ---------- 6. cobrança boleto (fixture direta — sem adapter de rede) ----------
    const { data: conta, error: errConta } = await supabase
      .from('fin_contas_bancarias')
      .insert({
        empresa_id: empresaId,
        banco_codigo: '341',
        banco_nome: 'Itaú (fixture)',
        agencia: '1234',
        conta: '56789',
        digito: '0',
        tipo: 'corrente',
        titular_nome: EMPRESA_NOME,
        titular_documento: '00000000000199',
      })
      .select('id')
      .single();
    if (errConta) falhar(`fixture conta: ${errConta.message}`);
    const contaId = (conta as { id: string }).id;

    const { data: cobranca, error: errCob } = await supabase
      .from('fin_cobrancas')
      .insert({
        fatura_id: fatura.id,
        conta_bancaria_id: contaId,
        tipo: 'boleto',
        valor: 12000,
        vencimento: new Date().toISOString().slice(0, 10),
        status: 'gerada',
        nosso_numero: 'E2E-NN-1',
      })
      .select('id')
      .single();
    if (errCob) falhar(`fixture cobrança: ${errCob.message}`);
    const cobrancaId = (cobranca as { id: string }).id;
    console.log(`Cobrança boleto (fixture gerada no banco): ${cobrancaId}`);

    // ---------- 7. importar conciliação (CSV XP) → liquidada ----------
    const hojeIso = new Date().toISOString().slice(0, 10);
    const csv = [
      'Data;Descricao;Valor;Tipo;IdExterno',
      `${hojeIso};Recebimento boleto E2E;R$ 12.000,00;credito;E2E-MOV-1`,
      `${hojeIso};Tarifa bancaria;R$ 25,00;debito;E2E-MOV-2`,
    ].join('\n');
    const movimentos = parseCsvExtrato(csv);
    if (movimentos.length !== 2) falhar(`CSV deveria gerar 2 movimentos, gerou ${movimentos.length}`);
    const resultado = await importarConciliacoes({ contaBancariaId: contaId, movimentos, origem: 'csv' }, ATOR);
    if (resultado.importados !== 2 || resultado.conciliadosAutomaticos !== 1) {
      falhar(`conciliação esperada: 2 importados / 1 automático, veio ${JSON.stringify(resultado)}`);
    }
    const { data: cobrancaPos } = await supabase.from('fin_cobrancas').select('status').eq('id', cobrancaId).single();
    if ((cobrancaPos as { status: string }).status !== 'liquidada') falhar('cobrança deveria estar liquidada');
    console.log(`Conciliação automática: ${resultado.importados} importados, ${resultado.conciliadosAutomaticos} conciliado(s), cobrança liquidada`);

    // ---------- 8. eventos completos em fin_eventos ----------
    const { data: eventos } = await supabase
      .from('fin_eventos')
      .select('tipo')
      .in('entidade_id', [fatura.id, emissao.id, cobrancaId]);
    const tipos = new Set((eventos || []).map((e) => e.tipo));
    const esperados = ['fatura.criada', 'fatura.emitida', 'nfse.enviado', 'nfse.autorizada', 'cobranca.liquidada'];
    for (const t of esperados) {
      if (!tipos.has(t)) falhar(`evento '${t}' ausente em fin_eventos (vistos: ${[...tipos].join(', ')})`);
    }
    console.log(`Eventos OK: ${esperados.join(' · ')}`);

    await registrarEvento({ entidade: 'fatura', entidadeId: fatura.id, tipo: 'fatura.e2e_ok', payload: { fluxo: 'completo' }, ator: ATOR });
    console.log('FIN_FLUXO_E2E_OK');
  } finally {
    await mock.fechar();
  }
}

main().catch((e) => {
  console.error('FIN_FLUXO_E2E_FAIL:', e);
  process.exit(1);
});
