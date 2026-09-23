/**
 * Service do módulo Financeiro (§5/§6 do design) — camada entre as rotas
 * /api/financeiro/** e o banco/adapters:
 *
 *   - monta BankContext/NfseContext decifrando app_secrets via
 *     secure-credentials (NUNCA devolve segredo em resposta/log);
 *   - resolve adapters/providers pelos registries dos irmãos
 *     (./banks/registry e ./nfse/registry — contratos §3.1/§3.2);
 *   - regras transacionais de fatura (nº sequencial com advisory lock),
 *     RPS (UPDATE ... RETURNING, §5.2.2), emissão/consulta/cancelamento
 *     NFS-e, cobranças, conciliação automática (§6) e lote de pagamentos;
 *   - estados/regras puras vivem em ./regras-financeiro (testadas com tsx).
 *
 * DB: supabaseAdmin (service_role, padrão do repo) para CRUD; pg direto
 * (DATABASE_URL) onde o design exige transação/atômico (nº fatura, RPS,
 * importação de conciliação).
 */
import fs from 'fs';
import crypto from 'crypto';
import os from 'os';
import path from 'path';
import { Client } from 'pg';
import { supabaseAdmin } from '@/lib/supabase';
import { getCredential, getAllCredentials } from '@/lib/secure-credentials';
import { getBankAdapter } from './banks/registry';
import type {
  BankContext,
  BankAdapter,
  ConciliacaoMovimento,
  PagamentoLoteItem,
} from './banks/types';
import { getNfseProvider } from './nfse/registry';
import type { NfseContext, NfseRpsInput } from './nfse/types';
import { registrarEvento, EventoAtor } from './eventos';
import {
  calcularItensFatura,
  parseCompetencia,
  podeEmitirFatura,
  podeCobrarFatura,
  podeAtualizarCobranca,
  podeReemitirNfse,
  podeConsultarNfse,
  podeCancelarNfse,
  verificarEmissaoNfse,
  transicaoNfseValida,
  eventoDeTransicaoNfse,
  statusFaturaAposNfse,
  conciliarMovimento,
  type CobrancaConciliavel,
  type ResultadoConciliacao,
} from './regras-financeiro';
import type {
  FinCobranca,
  FinConciliacaoImportarResultado,
  FinFatura,
  FinFaturaItem,
  FinFaturaOrigem,
  FinIntegracaoBanco,
  FinNfseConfig,
  FinNfseEmissao,
  FinNfseProviderKey,
  FinPagamentoLoteResponse,
} from '@/types/financeiro';

// ============================================================
// Erros → mapeamento HTTP nas rotas
// ============================================================

export class FinanceiroHttpError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'FinanceiroHttpError';
    this.status = status;
    this.code = code;
  }
}

const erro400 = (code: string, message: string) => new FinanceiroHttpError(400, code, message);
const erro404 = (code: string, message: string) => new FinanceiroHttpError(404, code, message);
const erro409 = (code: string, message: string) => new FinanceiroHttpError(409, code, message);
const erro422 = (code: string, message: string) => new FinanceiroHttpError(422, code, message);
export { erro400, erro404, erro409, erro422 };

// ============================================================
// pg direto (transacional)
// ============================================================

function databaseUrl(): string {
  const url = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || process.env.POSTGRES_URL || process.env.DIRECT_URL;
  if (!url) {
    throw new FinanceiroHttpError(500, 'db_indisponivel', 'DATABASE_URL ausente no ambiente do servidor');
  }
  return url;
}

async function comPg<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: databaseUrl(), ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

// ============================================================
// Contextos — credenciais decifradas de app_secrets (§2.3)
// ============================================================

const BUCKET_CERTIFICADOS = 'financeiro-certificados';

/** Baixa o .pfx do bucket privado para arquivo temporário (server-side apenas). */
async function baixarCertificadoParaArquivo(storagePath: string): Promise<string> {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET_CERTIFICADOS).download(storagePath);
  if (error || !data) {
    throw erro400('certificado_indisponivel', `Falha ao baixar certificado do bucket: ${error?.message || 'vazio'}`);
  }
  const buf = Buffer.from(await data.arrayBuffer());
  const tmp = path.join(os.tmpdir(), `fin-cert-${Date.now()}-${Math.random().toString(36).slice(2)}.pfx`);
  fs.writeFileSync(tmp, buf);
  return tmp;
}

interface CertContext {
  pfxPath: string;
  pfxPassphrase: string;
  fingerprint: string;
}

async function montarCertificado(
  certPath: string | null | undefined,
  fingerprint: string | null | undefined,
  senhaKey: string,
): Promise<CertContext | undefined> {
  if (!certPath) return undefined;
  const pfxPassphrase = await getCredential(senhaKey);
  if (!pfxPassphrase) {
    throw erro400('credencial_ausente', `Senha do certificado ausente em app_secrets (${senhaKey})`);
  }
  return {
    pfxPath: await baixarCertificadoParaArquivo(certPath),
    pfxPassphrase,
    fingerprint: fingerprint || '',
  };
}

/** §3.1 — BankContext montado pelo service (credenciais já decifradas). */
export async function montarBankContext(
  integracaoId: string,
  opts: { contaId?: string } = {},
): Promise<{
  ctx: BankContext;
  adapter: BankAdapter;
  integracao: FinIntegracaoBanco;
}> {
  const { data: integracao, error } = await supabaseAdmin
    .from('fin_integracoes_banco')
    .select('*')
    .eq('id', integracaoId)
    .eq('is_active', true) // integração desativada não é utilizável (review P1-8)
    .maybeSingle();
  if (error || !integracao) throw erro404('integracao_ausente', 'Integração de banco não encontrada ou desativada');
  const integ = integracao as FinIntegracaoBanco;

  const adapter = getBankAdapter(integ.adapter_key); // lança CapacidadeNaoSuportadaError se key desconhecida
  const meta = adapter.meta;

  const credenciais: Record<string, string> = {};
  for (const campo of meta.credentialSchema) {
    const valor = await getCredential(`fin_banco_${integ.id}_${campo.key}`);
    if (valor) credenciais[campo.key] = valor;
    else if (campo.required) {
      throw erro400('credencial_ausente', `Credencial obrigatória ausente: ${campo.key}`);
    }
  }

  // Conta: a informada (validada contra a integração) ou a primeira ativa.
  let queryConta = supabaseAdmin
    .from('fin_contas_bancarias')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1);
  queryConta = opts.contaId
    ? queryConta.eq('id', opts.contaId).eq('integracao_id', integ.id)
    : queryConta.eq('integracao_id', integ.id);
  const { data: conta, error: errConta } = await queryConta.maybeSingle();
  if (errConta || !conta) {
    throw erro400(
      'conta_ausente',
      opts.contaId
        ? 'Conta bancária não encontrada, inativa ou não vinculada a esta integração'
        : 'Nenhuma conta bancária ativa vinculada à integração',
    );
  }
  const c = conta as {
    banco_codigo: string; agencia: string | null; conta: string | null;
    digito: string | null; titular_nome: string; titular_documento: string;
  };

  const certificado = await montarCertificado(
    integ.certificado_path,
    integ.certificado_fingerprint,
    `fin_banco_${integ.id}_pfx_senha`,
  );

  const ctx: BankContext = {
    integracaoId: integ.id,
    ambiente: integ.ambiente === 'producao' ? 'producao' : 'sandbox',
    credenciais,
    certificado,
    conta: {
      bancoCodigo: c.banco_codigo,
      agencia: c.agencia || '',
      conta: c.conta || '',
      digito: c.digito || '',
      titularNome: c.titular_nome,
      titularDocumento: c.titular_documento,
    },
  };
  return { ctx, adapter, integracao: integ };
}

/** §3.2 — NfseContext montado pelo service (credenciais já decifradas). */
export async function montarNfseContext(nfseConfigId: string): Promise<{
  ctx: NfseContext;
  config: FinNfseConfig;
}> {
  const { data: config, error } = await supabaseAdmin
    .from('fin_nfse_config')
    .select('*, municipio:fin_municipios(codigo_ibge, nome, uf, wsdl_url, ambiente_urls)')
    .eq('id', nfseConfigId)
    .maybeSingle();
  if (error || !config) throw erro404('nfse_config_ausente', 'Configuração NFS-e não encontrada');
  const cfg = config as FinNfseConfig & { municipio?: { codigo_ibge: string; wsdl_url?: string | null; ambiente_urls?: Record<string, string> | null } | null };

  const { data: empresa } = await supabaseAdmin
    .from('payroll_companies')
    .select('name, cnpj')
    .eq('id', cfg.empresa_id)
    .maybeSingle();
  if (!empresa) throw erro404('empresa_ausente', 'Empresa emissora não encontrada');

  // Credenciais do provider: todas as chaves app_secrets com prefixo
  // fin_nfse_<configId>_<campo> (ex: usuario/token de webservice proprietário, senha do pfx).
  const prefixo = `fin_nfse_${cfg.id}_`;
  const todas = await getAllCredentials();
  const credenciais: Record<string, string> = {};
  for (const [chave, valor] of Object.entries(todas)) {
    if (chave.startsWith(prefixo) && valor) credenciais[chave.slice(prefixo.length)] = valor;
  }

  const certificado = await montarCertificado(
    cfg.certificado_path,
    cfg.certificado_fingerprint,
    `${prefixo}pfx_senha`,
  );

  const configExtra: Record<string, unknown> = { ...(cfg.config || {}) };
  const municipio = cfg.municipio;
  if (municipio) {
    if (municipio.wsdl_url && !configExtra.wsdl_url) configExtra.wsdl_url = municipio.wsdl_url;
    if (municipio.ambiente_urls && !configExtra.ambiente_urls) configExtra.ambiente_urls = municipio.ambiente_urls;
  }

  const ctx: NfseContext = {
    config: {
      nfseConfigId: cfg.id,
      empresaId: cfg.empresa_id,
      municipioIbge: cfg.municipio_id,
      providerKey: cfg.provider_key as FinNfseProviderKey,
      cnpj: String((empresa as { cnpj?: string }).cnpj || ''),
      razaoSocial: String((empresa as { name?: string }).name || ''),
      inscricaoMunicipal: cfg.inscricao_municipal || undefined,
      regimeEspecial: cfg.regime_especial || undefined,
      optanteSimples: !!cfg.optante_simples,
      incentivoFiscal: !!cfg.incentivo_fiscal,
      aliquotaIss: cfg.aliquota_iss != null ? Number(cfg.aliquota_iss) : undefined,
      issRetidoPadrao: !!cfg.iss_retido_padrao,
      rpsSerie: cfg.rps_serie,
      ambiente: (configExtra.ambiente as string) === 'producao' ? 'producao' : 'homologacao',
      configExtra,
    },
    credenciais,
    certificado,
  };
  return { ctx, config: cfg };
}

// ============================================================
// Faturas — criação transacional (nº sequencial), emissão, folha
// ============================================================

export interface CriarFaturaInput {
  empresaId: string;
  clienteId?: string;
  origemTipo: FinFaturaOrigem;
  payrollSheetId?: string;
  competencia?: string;
  templateId?: string;
  moeda?: string;
  dataVencimento?: string;
  callOff?: string;
  observacoes?: string;
  condicaoPagamento?: string;
  itens: { descricao: string; referencia?: string; quantidade?: number; valor_unitario: number }[];
}

/**
 * Cria fatura `rascunho` com nº sequencial transacional por (empresa, ano):
 * advisory lock + INSERT numero = COALESCE(MAX)+1 dentro da mesma transação —
 * concorrência nunca gera número duplicado (UNIQUE empresa_id+ano+numero).
 */
export async function criarFatura(input: CriarFaturaInput, ator: EventoAtor): Promise<FinFatura> {
  const calculo = calcularItensFatura(input.itens);
  if (!calculo.ok) throw erro400('itens_invalidos', calculo.erro);

  const comps = parseCompetencia(input.competencia);
  const { data: empresa } = await supabaseAdmin
    .from('payroll_companies')
    .select('id')
    .eq('id', input.empresaId)
    .maybeSingle();
  if (!empresa) throw erro404('empresa_ausente', 'Empresa não encontrada');

  let clienteSnapshot: Record<string, unknown> | null = null;
  if (input.clienteId) {
    const { data: cliente } = await supabaseAdmin
      .from('fin_clientes')
      .select('*')
      .eq('id', input.clienteId)
      .maybeSingle();
    if (!cliente) throw erro404('cliente_ausente', 'Cliente não encontrado');
    if ((cliente as { empresa_id: string }).empresa_id !== input.empresaId) {
      throw erro409('cliente_outra_empresa', 'Cliente pertence a outra empresa');
    }
    clienteSnapshot = {
      id: (cliente as { id: string }).id,
      nome: (cliente as { nome: string }).nome,
      documento: (cliente as { documento?: string }).documento,
      endereco: (cliente as { endereco?: unknown }).endereco,
      moeda: (cliente as { moeda: string }).moeda,
    };
  }

  const ano = comps?.ano ?? new Date().getFullYear();
  const moeda = (input.moeda || (clienteSnapshot?.moeda as string) || 'BRL').toUpperCase();

  const fatura = await comPg(async (client) => {
    await client.query('BEGIN');
    try {
      await client.query("SELECT pg_advisory_xact_lock(hashtext('fin_faturas:' || $1 || ':' || $2))", [
        input.empresaId,
        ano,
      ]);
      const { rows } = await client.query(
        `INSERT INTO public.fin_faturas
          (empresa_id, cliente_id, ano, numero, competencia_mes, competencia_ano,
           origem_tipo, payroll_sheet_id, template_id, moeda, valor_total, data_vencimento,
           condicao_pagamento, call_off, cliente_snapshot, observacoes, status, created_by)
         SELECT $1, $2, $3, COALESCE(MAX(f.numero), 0) + 1, $4, $5, $6, $7, $8, $9, $10,
                $11, $12, $13, $14, $15, 'rascunho', $16
         FROM (SELECT numero FROM public.fin_faturas WHERE empresa_id = $1 AND ano = $3) f
         RETURNING *`,
        [
          input.empresaId,
          input.clienteId ?? null,
          ano,
          comps?.mes ?? null,
          comps?.ano ?? null,
          input.origemTipo,
          input.payrollSheetId ?? null,
          input.templateId ?? null,
          moeda,
          calculo.total,
          input.dataVencimento ?? null,
          input.condicaoPagamento ?? null,
          input.callOff ?? null,
          clienteSnapshot,
          input.observacoes ?? null,
          ator.userId ?? null,
        ],
      );
      const criada = rows[0];

      const valores: unknown[] = [];
      const placeholders = calculo.itens.map((it, i) => {
        const base = i * 6;
        valores.push(criada.id, i, it.descricao, it.referencia ?? null, it.quantidade, it.valor_unitario);
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`;
      });
      await client.query(
        `INSERT INTO public.fin_fatura_itens (fatura_id, ordem, descricao, referencia, quantidade, valor_unitario, valor_total, origem)
         SELECT p.fatura_id::uuid, p.ordem::int, p.descricao, p.referencia, p.quantidade::numeric, p.valor_unitario::numeric,
                ROUND(p.quantidade::numeric * p.valor_unitario::numeric, 2), $${valores.length + 1}
         FROM (VALUES ${placeholders.join(', ')}) AS p(fatura_id, ordem, descricao, referencia, quantidade, valor_unitario)`,
        [...valores, input.origemTipo],
      );
      await client.query('COMMIT');
      return criada;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    }
  });

  const itens = await listarItens(fatura.id);
  await registrarEvento({
    entidade: 'fatura',
    entidadeId: fatura.id,
    tipo: 'fatura.criada',
    payload: { numero: Number(fatura.numero), ano: Number(fatura.ano), valor_total: calculo.total, origem: input.origemTipo },
    ator,
  });
  return montarFatura(fatura, itens);
}

async function listarItens(faturaId: string): Promise<FinFaturaItem[]> {
  const { data, error } = await supabaseAdmin
    .from('fin_fatura_itens')
    .select('*')
    .eq('fatura_id', faturaId)
    .order('ordem', { ascending: true });
  if (error) throw new FinanceiroHttpError(500, 'db_erro', error.message);
  return (data || []) as unknown as FinFaturaItem[];
}

type FaturaRow = Record<string, unknown>;

function montarFatura(row: FaturaRow, itens: FinFaturaItem[]): FinFatura {
  return {
    ...(row as unknown as FinFatura),
    valor_total: Number(row.valor_total ?? 0),
    numero: Number(row.numero ?? 0),
    ano: Number(row.ano ?? 0),
    itens,
  };
}

export async function obterFatura(id: string): Promise<FinFatura> {
  const { data, error } = await supabaseAdmin.from('fin_faturas').select('*').eq('id', id).maybeSingle();
  if (error || !data) throw erro404('fatura_ausente', 'Fatura não encontrada');
  return montarFatura(data as FaturaRow, await listarItens(id));
}

/**
 * §6 emitir — fatura `rascunho` → `emitida`: grava snapshot do cliente no dia,
 * data de emissão e evento fatura.emitida. O nº sequencial já foi reservado
 * transacionalmente na criação (ver criarFatura).
 */
export async function emitirFatura(id: string, ator: EventoAtor): Promise<FinFatura> {
  const fatura = await obterFatura(id);
  if (!podeEmitirFatura(fatura.status)) {
    throw erro409('fatura_status_invalido', `Fatura em status '${fatura.status}' não pode ser emitida`);
  }

  let snapshot = fatura.cliente_snapshot || null;
  if (fatura.cliente_id) {
    const { data: cliente } = await supabaseAdmin
      .from('fin_clientes')
      .select('id, nome, documento, email, endereco, moeda, condicao_pagamento, pais, tax_id, inscricao_municipal, inscricao_estadual')
      .eq('id', fatura.cliente_id)
      .maybeSingle();
    if (cliente) snapshot = cliente as unknown as Record<string, unknown>;
  }

  const hoje = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabaseAdmin
    .from('fin_faturas')
    .update({ status: 'emitida', data_emissao: hoje, cliente_snapshot: snapshot, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new FinanceiroHttpError(500, 'db_erro', error.message);

  await registrarEvento({
    entidade: 'fatura',
    entidadeId: id,
    tipo: 'fatura.emitida',
    payload: { numero: fatura.numero, ano: fatura.ano, valor_total: fatura.valor_total, moeda: fatura.moeda },
    ator,
  });
  return montarFatura(data as FaturaRow, fatura.itens || []);
}

/**
 * §6 gerar-da-folha — agrega payroll_employee_summaries da sheet `approved|paid`
 * (agrupamento por colaborador; base de cobrança = gross_salary/proventos) e
 * cria a fatura com itens origem='folha'. Exige cliente vinculado à empresa da folha.
 */
export async function gerarFaturaDaFolha(
  input: { sheetId: string; clienteId: string; templateId?: string },
  ator: EventoAtor,
): Promise<FinFatura> {
  const { data: sheet } = await supabaseAdmin
    .from('payroll_sheets')
    .select('*')
    .eq('id', input.sheetId)
    .maybeSingle();
  if (!sheet) throw erro404('folha_ausente', 'Folha não encontrada');
  const sh = sheet as {
    status: string; company_id: string; reference_month: number; reference_year: number;
  };
  if (sh.status !== 'approved' && sh.status !== 'paid') {
    throw erro409('folha_nao_aprovada', 'A folha precisa estar aprovada para gerar fatura');
  }

  const { data: cliente } = await supabaseAdmin
    .from('fin_clientes')
    .select('*')
    .eq('id', input.clienteId)
    .maybeSingle();
  if (!cliente) throw erro404('cliente_ausente', 'Cliente não encontrado');
  if ((cliente as { empresa_id: string }).empresa_id !== sh.company_id) {
    throw erro409('cliente_outra_empresa', 'Cliente não pertence à empresa da folha');
  }

  const { data: summaries } = await supabaseAdmin
    .from('payroll_employee_summaries')
    .select('employee_id, gross_salary, net_salary')
    .eq('sheet_id', input.sheetId);
  const lista = (summaries || []) as { employee_id: string; gross_salary: number; net_salary: number }[];
  if (lista.length === 0) {
    throw erro409('folha_sem_itens', 'Folha sem resumos de colaboradores para faturar');
  }

  const { data: employees } = await supabaseAdmin
    .from('payroll_employees')
    .select('id, name, registration_number')
    .in('id', lista.map((s) => s.employee_id));
  const nomes = new Map((employees || []).map((e) => [e.id, e as { name: string; registration_number?: string }]));

  const competencia = `${String(sh.reference_month).padStart(2, '0')}/${sh.reference_year}`;
  const itens = lista
    .map((s) => {
      const emp = nomes.get(s.employee_id);
      const valor = Number(s.gross_salary || 0);
      return {
        descricao: emp?.name || 'Colaborador',
        referencia: [emp?.registration_number, competencia].filter(Boolean).join(' · '),
        quantidade: 1,
        valor_unitario: valor,
      };
    })
    .filter((it) => it.valor_unitario > 0);
  if (itens.length === 0) {
    throw erro409('folha_sem_itens', 'Folha sem proventos para faturar');
  }

  return criarFatura(
    {
      empresaId: sh.company_id,
      clienteId: input.clienteId,
      origemTipo: 'folha',
      payrollSheetId: input.sheetId,
      competencia: `${sh.reference_year}-${String(sh.reference_month).padStart(2, '0')}`,
      templateId: input.templateId,
      itens,
    },
    ator,
  );
}

// ============================================================
// NFS-e — §5.2 (RPS transacional, estados, eventos)
// ============================================================

/**
 * §5.2.2 — reserva do número de RPS + criação da emissão `rps_gerado` na
 * MESMA transação pg: rollback libera o número se a emissão não for criada.
 */
export async function criarEmissaoTransacional(
  emissao: {
    faturaId: string;
    nfseConfigId: string;
    providerKey: string;
    ambiente: 'homologacao' | 'producao';
    rpsSerie: string;
  },
): Promise<FinNfseEmissao> {
  return comPg(async (client) => {
    await client.query('BEGIN');
    try {
      const { rows: upd } = await client.query(
        `UPDATE public.fin_nfse_config
           SET proximo_numero_rps = proximo_numero_rps + 1, updated_at = NOW()
         WHERE id = $1
         RETURNING proximo_numero_rps`,
        [emissao.nfseConfigId],
      );
      if (upd.length === 0) throw erro404('nfse_config_ausente', 'Configuração NFS-e não encontrada');
      const rpsNumero = Number(upd[0].proximo_numero_rps) - 1;
      const { rows: ins } = await client.query(
        `INSERT INTO public.fin_nfse_emissoes
           (fatura_id, nfse_config_id, provider_key, ambiente, status, rps_numero, rps_serie)
         VALUES ($1, $2, $3, $4, 'rps_gerado', $5, $6)
         RETURNING *`,
        [
          emissao.faturaId,
          emissao.nfseConfigId,
          emissao.providerKey,
          emissao.ambiente,
          rpsNumero,
          emissao.rpsSerie,
        ],
      );
      await client.query('COMMIT');
      return ins[0] as FinNfseEmissao;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    }
  });
}

/** Cadastro fiscal do tomador (fin_clientes) — §5 do design dp-folha. */
interface TomadorCadastro {
  nome?: string | null;
  documento?: string | null;
  email?: string | null;
  pais?: string | null;
  tax_id?: string | null;
  inscricao_municipal?: string | null;
  endereco?: {
    codigo_ibge_municipio?: string;
    logradouro?: string; numero?: string; complemento?: string; bairro?: string; cep?: string;
  } | null;
}

function montarRpsInput(
  fatura: FinFatura,
  ctx: NfseContext,
  rpsNumero: number,
  codigoLc116Padrao: string,
  tomadorCadastro: TomadorCadastro | null,
): NfseRpsInput {
  const snapshot = (fatura.cliente_snapshot || {}) as {
    nome?: string; documento?: string; email?: string;
    endereco?: { codigo_ibge_municipio?: string; logradouro?: string; numero?: string; complemento?: string; bairro?: string; cep?: string };
  };
  // §5 (a): sanitização \D só para tomador BR; exterior preserva tax_id alfanumérico.
  const pais = (tomadorCadastro?.pais || 'BR').toUpperCase();
  const exterior = pais !== 'BR';
  const documentoBruto = exterior
    ? String(tomadorCadastro?.tax_id || tomadorCadastro?.documento || snapshot.documento || '')
    : String(snapshot.documento || tomadorCadastro?.documento || '');
  const documento = exterior ? documentoBruto.trim() : documentoBruto.replace(/\D/g, '');
  // §5 (b): código IBGE do tomador vem do cadastro fin_clientes.endereco
  // (snapshot é cópia do cadastro no dia da emissão); ausente + BR → 422,
  // NUNCA fallback para o município do prestador; exterior → sem IBGE.
  const enderecoCadastro = tomadorCadastro?.endereco || snapshot.endereco;
  let municipioIbge = '';
  let endereco: NfseRpsInput['tomador']['endereco'];
  if (!exterior) {
    const ibge = enderecoCadastro?.codigo_ibge_municipio;
    if (!ibge) {
      throw erro422(
        'fatura_tomador_sem_ibge',
        'Tomador sem código IBGE do município no cadastro (fin_clientes.endereco.codigo_ibge_municipio)',
      );
    }
    municipioIbge = ibge;
    endereco = enderecoCadastro?.logradouro
      ? {
          logradouro: enderecoCadastro.logradouro || '',
          numero: enderecoCadastro.numero || '',
          complemento: enderecoCadastro.complemento,
          bairro: enderecoCadastro.bairro || '',
          cep: enderecoCadastro.cep || '',
        }
      : undefined;
  }
  const aliquotaIss = ctx.config.aliquotaIss ?? 0;
  return {
    rpsNumero,
    rpsSerie: ctx.config.rpsSerie,
    dataEmissao: fatura.data_emissao || new Date().toISOString().slice(0, 10),
    competencia: fatura.competencia_ano && fatura.competencia_mes
      ? `${fatura.competencia_ano}-${String(fatura.competencia_mes).padStart(2, '0')}`
      : new Date().toISOString().slice(0, 7),
    tomador: {
      nome: String(snapshot.nome || tomadorCadastro?.nome || 'Tomador'),
      documento,
      email: snapshot.email || tomadorCadastro?.email || undefined,
      municipioIbge,
      inscricaoMunicipal: tomadorCadastro?.inscricao_municipal || undefined,
      endereco,
    },
    // §5 (c): LC 116 e alíquota por item, com fallback ao padrão da config.
    itens: (fatura.itens || []).map((it: FinFaturaItem) => {
      const codigoLc116 = it.codigo_lc116 || codigoLc116Padrao;
      if (!codigoLc116) {
        throw erro400(
          'codigo_lc116_ausente',
          `Item '${it.descricao}' sem codigo_lc116 e config.codigo_lc116_padrao ausente (LC 116/2003)`,
        );
      }
      return {
        codigoLc116,
        descricao: it.descricao,
        quantidade: Number(it.quantidade),
        valorUnitario: Number(it.valor_unitario),
        tributavel: true,
        aliquotaIss: it.aliquota_iss != null ? Number(it.aliquota_iss) : aliquotaIss,
      };
    }),
    valorServicos: Number(fatura.valor_total),
    aliquotaIss,
    issRetido: ctx.config.issRetidoPadrao,
    discriminacao: `Fatura ${fatura.numero}/${fatura.ano}${fatura.call_off ? ` · call-off ${fatura.call_off}` : ''}`,
    faturaId: fatura.id,
    faturaNumero: fatura.numero,
  };
}

/**
 * §5.2.1/6 POST /nfse/emissoes — exige fatura `emitida` + config ativa; moeda
 * ≠ BRL → 409 fatura_moeda_invalida. RPS alocado transacionalmente; estados
 * rps_gerado → enviado → autorizado|rejeitado com eventos em fin_eventos.
 * Reemissão (§5.2.5) reusa emissão em `rps_gerado|rejeitado`.
 */
export async function emitirNfse(faturaId: string, ator: EventoAtor): Promise<FinNfseEmissao> {
  const fatura = await obterFatura(faturaId);
  const bloqueio = verificarEmissaoNfse({ status: fatura.status, moeda: fatura.moeda });
  if (!bloqueio.ok) {
    if (bloqueio.motivo === 'fatura_moeda_invalida') {
      throw erro409('fatura_moeda_invalida', 'NFS-e só é emitida para faturas em BRL');
    }
    throw erro409('fatura_status_invalido', `Fatura em status '${fatura.status}' não pode emitir NFS-e`);
  }

  const { data: configs } = await supabaseAdmin
    .from('fin_nfse_config')
    .select('*')
    .eq('empresa_id', fatura.empresa_id)
    .eq('is_active', true)
    .limit(1);
  const config = (configs || [])[0] as FinNfseConfig | undefined;
  if (!config) throw erro409('nfse_config_ausente', 'Nenhuma configuração NFS-e ativa para a empresa');

  const { data: existentes } = await supabaseAdmin
    .from('fin_nfse_emissoes')
    .select('*')
    .eq('fatura_id', faturaId)
    .order('created_at', { ascending: false })
    .limit(1);
  const existente = (existentes || [])[0] as FinNfseEmissao | undefined;
  if (existente) {
    if (!podeReemitirNfse(existente.status)) {
      throw erro409('nfse_status_invalido', `Emissão em status '${existente.status}' — só rps_gerado/rejeitado podem reemitir`);
    }
  }

  const { ctx } = await montarNfseContext(config.id);
  const provider = getNfseProvider(ctx.config.providerKey);

  // §5 (c): o padrão da config é fallback — itens com codigo_lc116 próprio
  // dispensam codigo_lc116_padrao; a exigência é validada por item em montarRpsInput.
  const codigoLc116Padrao = String((config.config || {}).codigo_lc116_padrao || '');

  // Reemissão mantém o RPS (§5.2.5); emissão nova reserva número + cria a
  // emissão numa única transação (rollback libera o número — §5.2.2).
  let emissao: FinNfseEmissao;
  if (existente) {
    emissao = existente;
  } else {
    emissao = await criarEmissaoTransacional({
      faturaId,
      nfseConfigId: config.id,
      providerKey: ctx.config.providerKey,
      ambiente: ctx.config.ambiente,
      rpsSerie: ctx.config.rpsSerie,
    });
  }
  const rpsNumero = emissao.rps_numero;
  // §5 (a/b): país, tax_id, IM e código IBGE do tomador vêm do cadastro
  // fin_clientes (snapshot é cópia do dia da emissão, usado como fallback).
  let tomadorCadastro: TomadorCadastro | null = null;
  if (fatura.cliente_id) {
    const { data: tomador } = await supabaseAdmin
      .from('fin_clientes')
      .select('nome, documento, email, endereco, pais, tax_id, inscricao_municipal')
      .eq('id', fatura.cliente_id)
      .maybeSingle();
    tomadorCadastro = (tomador as TomadorCadastro | null) ?? null;
  }
  const rpsInput = montarRpsInput(fatura, ctx, rpsNumero, codigoLc116Padrao, tomadorCadastro);

  // enviado
  const { data: enviadoRow } = await supabaseAdmin
    .from('fin_nfse_emissoes')
    .update({ status: 'enviado', tentativas: (emissao.tentativas || 0) + 1, mensagem_erro: null, updated_at: new Date().toISOString() })
    .eq('id', emissao.id)
    .select('*')
    .single();
  emissao = enviadoRow as FinNfseEmissao;
  await registrarEvento({
    entidade: 'nfse',
    entidadeId: emissao.id,
    tipo: 'nfse.enviado',
    payload: { fatura_id: faturaId, rps_numero: rpsNumero, provider: ctx.config.providerKey, ambiente: ctx.config.ambiente },
    ator,
  });

  let resultado;
  try {
    resultado = await provider.emitirRps(ctx, rpsInput);
  } catch (e) {
    await supabaseAdmin
      .from('fin_nfse_emissoes')
      .update({
        mensagem_erro: { codigo: 'provider_error', mensagem: (e as Error).message },
        updated_at: new Date().toISOString(),
      })
      .eq('id', emissao.id);
    throw new FinanceiroHttpError(502, 'provider_error', `Falha no provider NFS-e: ${(e as Error).message}`);
  }

  if (resultado.ok) {
    const valorIss = Math.round(Number(fatura.valor_total) * (rpsInput.aliquotaIss || 0)) / 100;
    const { data: row } = await supabaseAdmin
      .from('fin_nfse_emissoes')
      .update({
        status: 'autorizado',
        protocolo: resultado.protocolo || null,
        numero_nfse: resultado.numeroNfse || null,
        codigo_verificacao: resultado.codigoVerificacao || null,
        xml_nfse: resultado.xmlNfse || null,
        resumo_tributos: {
          valorServicos: Number(fatura.valor_total),
          aliquotaIss: rpsInput.aliquotaIss,
          valorIss,
          issRetido: rpsInput.issRetido,
          baseCalculo: Number(fatura.valor_total),
        },
        mensagem_erro: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', emissao.id)
      .select('*')
      .single();
    emissao = row as FinNfseEmissao;
    const novoStatusFatura = statusFaturaAposNfse('autorizado');
    if (novoStatusFatura) {
      await supabaseAdmin.from('fin_faturas').update({ status: novoStatusFatura, updated_at: new Date().toISOString() }).eq('id', faturaId);
    }
    await registrarEvento({
      entidade: 'nfse',
      entidadeId: emissao.id,
      tipo: 'nfse.autorizada',
      payload: { fatura_id: faturaId, numero_nfse: resultado.numeroNfse, protocolo: resultado.protocolo },
      ator,
    });
    return emissao;
  }

  // rejeitado
  const { data: rowRej } = await supabaseAdmin
    .from('fin_nfse_emissoes')
    .update({
      status: 'rejeitado',
      mensagem_erro: { codigo: resultado.erro?.codigo || 'rejeitado', mensagem: resultado.erro?.mensagem || 'Emissão rejeitada pelo provider' },
      updated_at: new Date().toISOString(),
    })
    .eq('id', emissao.id)
    .select('*')
    .single();
  await registrarEvento({
    entidade: 'nfse',
    entidadeId: emissao.id,
    tipo: 'nfse.rejeitada',
    payload: { fatura_id: faturaId, erro: resultado.erro },
    ator,
  });
  return rowRej as FinNfseEmissao;
}

/** §6 consultar — estado atualizado no provider; tentativas sempre incrementa. */
export async function consultarNfse(emissaoId: string, ator: EventoAtor): Promise<FinNfseEmissao> {
  const { data: emissaoRow } = await supabaseAdmin
    .from('fin_nfse_emissoes')
    .select('*')
    .eq('id', emissaoId)
    .maybeSingle();
  if (!emissaoRow) throw erro404('emissao_ausente', 'Emissão não encontrada');
  let emissao = emissaoRow as FinNfseEmissao;
  if (!podeConsultarNfse(emissao.status)) {
    throw erro409('nfse_status_invalido', 'Emissão cancelada não pode ser consultada');
  }

  const { ctx } = await montarNfseContext(emissao.nfse_config_id);
  const provider = getNfseProvider(ctx.config.providerKey);

  let resultado;
  try {
    resultado = await provider.consultar(ctx, {
      protocolo: emissao.protocolo || undefined,
      numeroNfse: emissao.numero_nfse || undefined,
      rpsNumero: emissao.rps_numero,
      rpsSerie: emissao.rps_serie,
    });
  } catch (e) {
    await supabaseAdmin
      .from('fin_nfse_emissoes')
      .update({ tentativas: emissao.tentativas + 1, mensagem_erro: { codigo: 'provider_error', mensagem: (e as Error).message }, updated_at: new Date().toISOString() })
      .eq('id', emissaoId);
    throw new FinanceiroHttpError(502, 'provider_error', `Falha no provider NFS-e: ${(e as Error).message}`);
  }

  const novoStatus = resultado.situacao;
  if (novoStatus && novoStatus !== 'nao_encontrado' && novoStatus !== emissao.status && transicaoNfseValida(emissao.status, novoStatus)) {
    const updates: Record<string, unknown> = {
      status: novoStatus,
      tentativas: emissao.tentativas + 1,
      updated_at: new Date().toISOString(),
    };
    if (resultado.numeroNfse) updates.numero_nfse = resultado.numeroNfse;
    if (resultado.codigoVerificacao) updates.codigo_verificacao = resultado.codigoVerificacao;
    if (resultado.xmlNfse) updates.xml_nfse = resultado.xmlNfse;
    if (resultado.erro) updates.mensagem_erro = { codigo: resultado.erro.codigo, mensagem: resultado.erro.mensagem };
    const { data: row } = await supabaseAdmin
      .from('fin_nfse_emissoes')
      .update(updates)
      .eq('id', emissaoId)
      .select('*')
      .single();
    emissao = row as FinNfseEmissao;

    const novoStatusFatura = statusFaturaAposNfse(novoStatus);
    if (novoStatusFatura) {
      await supabaseAdmin.from('fin_faturas').update({ status: novoStatusFatura, updated_at: new Date().toISOString() }).eq('id', emissao.fatura_id);
    }
    const tipoEvento = eventoDeTransicaoNfse(novoStatus);
    if (tipoEvento) {
      await registrarEvento({
        entidade: 'nfse',
        entidadeId: emissaoId,
        tipo: tipoEvento,
        payload: { fatura_id: emissao.fatura_id, via_consulta: true },
        ator,
      });
    }
  } else {
    await supabaseAdmin
      .from('fin_nfse_emissoes')
      .update({ tentativas: emissao.tentativas + 1, updated_at: new Date().toISOString() })
      .eq('id', emissaoId);
    emissao = { ...emissao, tentativas: emissao.tentativas + 1 };
  }
  return emissao;
}

/** §5.2 — só autorizada cancela; volta fatura para `emitida`; grava xml_cancelamento. */
export async function cancelarNfse(
  emissaoId: string,
  motivo: string,
  codigoCancelamento: string | undefined,
  ator: EventoAtor,
): Promise<FinNfseEmissao> {
  if (!motivo || !motivo.trim()) throw erro400('motivo_obrigatorio', 'Motivo do cancelamento é obrigatório');
  if (!codigoCancelamento || !codigoCancelamento.trim()) {
    // Webservices municipais (ABRASF/proprietário) exigem código da tabela de
    // cancelamento (ex.: 1..4 ABRASF) — nunca enviar vazio (review P1-10).
    throw erro400('codigo_cancelamento_obrigatorio', 'Código de cancelamento é obrigatório (tabela do provider)');
  }
  const { data: emissaoRow } = await supabaseAdmin
    .from('fin_nfse_emissoes')
    .select('*')
    .eq('id', emissaoId)
    .maybeSingle();
  if (!emissaoRow) throw erro404('emissao_ausente', 'Emissão não encontrada');
  const emissao = emissaoRow as FinNfseEmissao;
  if (!podeCancelarNfse(emissao.status)) {
    throw erro409('nfse_status_invalido', `Emissão em status '${emissao.status}' não pode ser cancelada`);
  }

  const { ctx } = await montarNfseContext(emissao.nfse_config_id);
  const provider = getNfseProvider(ctx.config.providerKey);

  let resultado;
  try {
    resultado = await provider.cancelar(ctx, {
      numeroNfse: emissao.numero_nfse || '',
      codigoCancelamento: codigoCancelamento || '',
      motivo,
    });
  } catch (e) {
    throw new FinanceiroHttpError(502, 'provider_error', `Falha no provider NFS-e: ${(e as Error).message}`);
  }
  if (!resultado.ok) {
    throw erro409('cancelamento_recusado', resultado.erro?.mensagem || 'Cancelamento recusado pelo provider');
  }

  const { data: row } = await supabaseAdmin
    .from('fin_nfse_emissoes')
    .update({
      status: 'cancelado',
      xml_cancelamento: resultado.xmlCancelamento || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', emissaoId)
    .select('*')
    .single();
  await supabaseAdmin
    .from('fin_faturas')
    .update({ status: 'emitida', updated_at: new Date().toISOString() })
    .eq('id', emissao.fatura_id);
  await registrarEvento({
    entidade: 'nfse',
    entidadeId: emissaoId,
    tipo: 'nfse.cancelada',
    payload: { fatura_id: emissao.fatura_id, motivo },
    ator,
  });
  return row as FinNfseEmissao;
}

// ============================================================
// Cobranças — boleto/pix via adapter + atualização por conciliação
// ============================================================

const round2Fin = (v: number): number => Math.round(v * 100) / 100;

/**
 * P1-2 — após liquidar cobrança(s) de uma fatura: quando o total recebido
 * (soma das cobranças `liquidada`, que podem ser parciais) atinge
 * valor_total e a fatura está emitida/nfse_emitida → status `paga` + evento
 * fatura.paga. Best-effort: não derruba a liquidação.
 */
export async function aposLiquidacaoVerificarFaturaPaga(faturaId: string, ator: EventoAtor): Promise<void> {
  try {
    const { data: fatura } = await supabaseAdmin
      .from('fin_faturas')
      .select('status, valor_total')
      .eq('id', faturaId)
      .maybeSingle();
    if (!fatura) return;
    const fin = fatura as { status: FinFatura['status']; valor_total: number };
    if (fin.status !== 'emitida' && fin.status !== 'nfse_emitida') return;

    const { data: liquidadas } = await supabaseAdmin
      .from('fin_cobrancas')
      .select('valor')
      .eq('fatura_id', faturaId)
      .eq('status', 'liquidada');
    const recebido = round2Fin(((liquidadas || []) as { valor: number }[]).reduce((s, c) => s + Number(c.valor || 0), 0));
    if (recebido < round2Fin(Number(fin.valor_total))) return;

    await supabaseAdmin
      .from('fin_faturas')
      .update({ status: 'paga', updated_at: new Date().toISOString() })
      .eq('id', faturaId);
    await registrarEvento({
      entidade: 'fatura',
      entidadeId: faturaId,
      tipo: 'fatura.paga',
      payload: { recebido, valor_total: Number(fin.valor_total) },
      ator,
    });
  } catch (e) {
    console.error('[financeiro] falha ao transicionar fatura para paga (best-effort):', e);
  }
}

/** Identificadores locais para nosso_numero (boleto) e txid (pix). */
function gerarIdentificadorCobranca(prefixo: string): string {
  const rand = crypto.randomBytes(6).toString('hex').toUpperCase();
  return `${prefixo}${Date.now().toString(36).toUpperCase()}${rand}`.slice(0, 25);
}

export interface GerarCobrancaInput {
  faturaId: string;
  contaBancariaId: string;
  tipo: 'boleto' | 'pix';
  vencimento?: string;
  valor?: number;
}

export async function gerarCobranca(input: GerarCobrancaInput, ator: EventoAtor): Promise<FinCobranca> {
  const fatura = await obterFatura(input.faturaId);
  if (!podeCobrarFatura(fatura.status)) {
    throw erro409('fatura_status_invalido', `Fatura em status '${fatura.status}' não pode receber cobrança`);
  }

  const { data: conta } = await supabaseAdmin
    .from('fin_contas_bancarias')
    .select('*')
    .eq('id', input.contaBancariaId)
    .maybeSingle();
  if (!conta) throw erro404('conta_ausente', 'Conta bancária não encontrada');
  const contaRow = conta as { integracao_id: string | null; is_active: boolean };
  if (!contaRow.integracao_id) throw erro400('conta_sem_integracao', 'Conta bancária sem integração de banco vinculada');
  if (!contaRow.is_active) throw erro409('conta_inativa', 'Conta bancária desativada não pode gerar cobrança (review P1-8)');

  // O contexto usa EXATAMENTE a conta escolhida (review P1-1), não a primeira da integração.
  const { ctx, adapter } = await montarBankContext(contaRow.integracao_id, { contaId: input.contaBancariaId });

  const snapshot = (fatura.cliente_snapshot || {}) as { nome?: string; documento?: string; email?: string };
  const pagador = {
    nome: String(snapshot.nome || 'Cliente'),
    documento: String(snapshot.documento || '').replace(/\D/g, ''),
    email: snapshot.email,
  };
  const valor = input.valor != null ? Math.round(Number(input.valor) * 100) / 100 : Number(fatura.valor_total);
  const vencimento = input.vencimento || fatura.data_vencimento || new Date().toISOString().slice(0, 10);
  const descricao = `Fatura ${fatura.numero}/${fatura.ano}`;
  const nossoNumeroBoleto = input.tipo === 'boleto' ? gerarIdentificadorCobranca('FIN') : '';

  if (input.tipo === 'boleto' && !adapter.gerarCobrancaBoleto) {
    throw erro400('capacidade_nao_suportada', `Adapter '${adapter.meta.key}' não suporta cobrança boleto`);
  }
  if (input.tipo === 'pix' && !adapter.gerarCobrancaPix) {
    throw erro400('capacidade_nao_suportada', `Adapter '${adapter.meta.key}' não suporta cobrança pix`);
  }
  const gerada =
    input.tipo === 'boleto'
      ? await chamarCapacidade(() => adapter.gerarCobrancaBoleto!(ctx, { valor, vencimento, pagador, descricao, faturaId: fatura.id, nossoNumero: nossoNumeroBoleto }))
      : await chamarCapacidade(() => adapter.gerarCobrancaPix!(ctx, { valor, pagador, descricao, faturaId: fatura.id }));

  // P1-3 — identificadores persistidos: nosso_numero (boleto, enviado ao
  // adapter e/ou devolvido no raw) e txid (pix, do adapter ou gerado local).
  const rawNosso = (gerada.raw as { nosso_numero?: unknown } | undefined)?.nosso_numero;
  const nossoNumero =
    input.tipo === 'boleto'
      ? (typeof rawNosso === 'string' && rawNosso ? rawNosso : nossoNumeroBoleto)
      : null;
  const txid = gerada.txid || (input.tipo === 'pix' ? gerarIdentificadorCobranca('FIN') : null);

  const { data: cobranca, error } = await supabaseAdmin
    .from('fin_cobrancas')
    .insert({
      fatura_id: fatura.id,
      conta_bancaria_id: input.contaBancariaId,
      tipo: input.tipo,
      valor,
      vencimento,
      status: 'gerada',
      id_externo: gerada.idExterno,
      nosso_numero: nossoNumero,
      linha_digitavel: gerada.linhaDigitavel || null,
      txid,
      qr_code_emv: gerada.qrCodeEmv || null,
      resposta_adapter: gerada.raw || {},
    })
    .select('*')
    .single();
  if (error) throw new FinanceiroHttpError(500, 'db_erro', error.message);

  await registrarEvento({
    entidade: 'cobranca',
    entidadeId: (cobranca as { id: string }).id,
    tipo: 'cobranca.gerada',
    payload: { fatura_id: fatura.id, tipo: input.tipo, valor, id_externo: gerada.idExterno },
    ator,
  });
  return cobranca as FinCobranca;
}

async function chamarCapacidade<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if ((e as Error).name === 'CapacidadeNaoSuportadaError') {
      throw erro400('capacidade_nao_suportada', (e as Error).message);
    }
    throw new FinanceiroHttpError(502, 'banco_indisponivel', `Falha no adapter de banco: ${(e as Error).message}`);
  }
}

/**
 * §6 atualizar cobrança — "reconsulta adapter → status": o contrato §3.1 não
 * tem consulta unitária de cobrança, então a reconsulta roda a conciliação
 * automática (listarConciliacao da conta) contra a cobrança alvo.
 */
export async function atualizarCobranca(cobrancaId: string, ator: EventoAtor): Promise<FinCobranca> {
  const { data: cobrancaRow } = await supabaseAdmin
    .from('fin_cobrancas')
    .select('*')
    .eq('id', cobrancaId)
    .maybeSingle();
  if (!cobrancaRow) throw erro404('cobranca_ausente', 'Cobrança não encontrada');
  const cobranca = cobrancaRow as FinCobranca;
  if (!podeAtualizarCobranca(cobranca.status)) {
    throw erro409('cobranca_status_invalido', `Cobrança em status '${cobranca.status}' não pode ser atualizada`);
  }

  const { data: conta } = await supabaseAdmin
    .from('fin_contas_bancarias')
    .select('integracao_id')
    .eq('id', cobranca.conta_bancaria_id)
    .maybeSingle();
  const integracaoId = (conta as { integracao_id: string | null } | null)?.integracao_id;
  if (!integracaoId) return cobranca;

  const { ctx, adapter } = await montarBankContext(integracaoId);
  const criadaEm = cobranca.created_at.slice(0, 10);
  const hoje = new Date().toISOString().slice(0, 10);
  const movimentos = await chamarCapacidade(() => adapter.listarConciliacao(ctx, { de: criadaEm, ate: hoje }));

  const alvo: CobrancaConciliavel[] = [cobrancaParaConciliacao(cobranca)];
  let hit: ResultadoConciliacao = { cobrancaId: null, criterio: null };
  let movimento: ConciliacaoMovimento | undefined;
  for (const m of movimentos) {
    const r = conciliarMovimento(m, alvo);
    if (r.cobrancaId) {
      hit = r;
      movimento = m;
      break;
    }
  }
  if (!hit.cobrancaId) return cobranca;

  const { data: atualizada } = await supabaseAdmin
    .from('fin_cobrancas')
    .update({ status: 'liquidada', updated_at: new Date().toISOString() })
    .eq('id', cobrancaId)
    .select('*')
    .single();
  if (movimento) {
    await supabaseAdmin
      .from('fin_conciliacoes')
      .update({ status: 'conciliado', cobranca_id: cobrancaId })
      .eq('conta_bancaria_id', cobranca.conta_bancaria_id)
      .eq('id_externo', movimento.idExterno);
  }
  await registrarEvento({
    entidade: 'cobranca',
    entidadeId: cobrancaId,
    tipo: 'cobranca.liquidada',
    payload: { via: 'atualizar', criterio: hit.criterio },
    ator,
  });
  await aposLiquidacaoVerificarFaturaPaga(cobranca.fatura_id, ator);
  return atualizada as FinCobranca;
}

function cobrancaParaConciliacao(c: FinCobranca): CobrancaConciliavel {
  return {
    id: c.id,
    valor: Number(c.valor),
    vencimento: c.vencimento || null,
    nosso_numero: c.nosso_numero || null,
    txid: c.txid || null,
    status: c.status,
  };
}

// ============================================================
// Conciliação — importação (API/CSV) com casamento automático (§6)
// ============================================================

/**
 * Importa movimentos para fin_conciliacoes (idempotente por UNIQUE
 * conta+id_externo) e casa créditos contra cobranças `gerada` por
 * txid / nossoNumero / valor+data → cobrança `liquidada` + evento.
 */
export async function importarConciliacoes(
  input: {
    contaBancariaId: string;
    movimentos: ConciliacaoMovimento[];
    origem: 'api' | 'csv';
  },
  ator: EventoAtor,
): Promise<FinConciliacaoImportarResultado> {
  if (input.movimentos.length === 0) return { importados: 0, conciliadosAutomaticos: 0 };

  const { data: cobrancasRows } = await supabaseAdmin
    .from('fin_cobrancas')
    .select('id, valor, vencimento, nosso_numero, txid, status')
    .eq('conta_bancaria_id', input.contaBancariaId)
    .eq('status', 'gerada');
  // Estado local: cobrança liquidada no batch NÃO casa com outro movimento
  // (review P1-6) — cada id é consumido no primeiro casamento.
  const abertas = new Map<string, CobrancaConciliavel>();
  for (const c of (cobrancasRows || []) as unknown as CobrancaConciliavel[]) {
    abertas.set(c.id, { ...c, status: 'gerada' });
  }

  let conciliados = 0;
  const faturasLiquidadas = new Set<string>();
  return comPg(async (client) => {
    await client.query('BEGIN');
    try {
      let importados = 0;
      for (const mov of input.movimentos) {
        const { rows } = await client.query(
          `INSERT INTO public.fin_conciliacoes
             (conta_bancaria_id, data_movimento, tipo, valor, descricao, id_externo, origem, raw)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (conta_bancaria_id, id_externo) DO UPDATE
             SET descricao = EXCLUDED.descricao, raw = EXCLUDED.raw
           RETURNING id, status, cobranca_id, (xmax = 0) AS inserido`,
          [
            input.contaBancariaId,
            mov.data,
            mov.tipo,
            mov.valor,
            mov.descricao || null,
            mov.idExterno,
            input.origem,
            JSON.stringify(mov.raw || {}),
          ],
        );
        const row = rows[0] as { id: string; status: string; cobranca_id: string | null; inserido: boolean };
        if (row.inserido) importados += 1;

        // Movimento já conciliado/ignorado (ou vinculado a cobrança) nunca remacha.
        if (row.status !== 'nao_conciliado' || row.cobranca_id) continue;

        const candidatas = [...abertas.values()];
        const hit = conciliarMovimento(mov, candidatas);
        if (hit.cobrancaId) {
          await client.query(
            `UPDATE public.fin_conciliacoes SET status = 'conciliado', cobranca_id = $2 WHERE id = $1`,
            [row.id, hit.cobrancaId],
          );
          await client.query(
            `UPDATE public.fin_cobrancas SET status = 'liquidada', updated_at = NOW() WHERE id = $1 AND status = 'gerada'`,
            [hit.cobrancaId],
          );
          conciliados += 1;
          abertas.delete(hit.cobrancaId); // consome a cobrança no batch
          const fid = await client.query('SELECT fatura_id FROM public.fin_cobrancas WHERE id = $1', [hit.cobrancaId]);
          if (fid.rows[0]?.fatura_id) faturasLiquidadas.add(String(fid.rows[0].fatura_id));
          await client.query(
            `INSERT INTO public.fin_eventos (entidade, entidade_id, tipo, payload, ator_id, ator_nome)
             VALUES ('cobranca', $1, 'cobranca.liquidada', $2, $3, $4)`,
            [
              hit.cobrancaId,
              JSON.stringify({ via: 'importar_conciliacoes', criterio: hit.criterio, movimento: mov.idExterno }),
              ator.userId ?? null,
              ator.nome || 'system',
            ],
          );
        }
      }
      await client.query('COMMIT');
      // P1-2 — fatura vira `paga` quando o recebido atinge o total (best-effort, pós-commit).
      for (const faturaId of faturasLiquidadas) {
        await aposLiquidacaoVerificarFaturaPaga(faturaId, ator);
      }
      return { importados, conciliadosAutomaticos: conciliados };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    }
  });
}

// ============================================================
// Pagamentos em lote (folha → colaboradores)
// ============================================================

export async function enviarPagamentoLote(
  input: {
    origemTipo: 'payroll_sheet' | 'manual';
    origemId?: string;
    contaBancariaId: string;
    dataPrevista?: string;
  },
  ator: EventoAtor,
): Promise<FinPagamentoLoteResponse> {
  const { data: conta } = await supabaseAdmin
    .from('fin_contas_bancarias')
    .select('*')
    .eq('id', input.contaBancariaId)
    .maybeSingle();
  if (!conta) throw erro404('conta_ausente', 'Conta bancária não encontrada');
  const contaRow = conta as { integracao_id: string | null };
  if (!contaRow.integracao_id) throw erro400('conta_sem_integracao', 'Conta bancária sem integração de banco vinculada');
  const { ctx, adapter } = await montarBankContext(contaRow.integracao_id);

  let favorecidos: { nome: string; documento: string; banco: string; agencia: string; conta: string; digito?: string; valor: number }[] = [];

  if (input.origemTipo === 'payroll_sheet') {
    if (!input.origemId) throw erro400('origem_obrigatoria', 'origemId é obrigatório para lote de folha');
    const { data: sheet } = await supabaseAdmin
      .from('payroll_sheets')
      .select('status, company_id')
      .eq('id', input.origemId)
      .maybeSingle();
    if (!sheet) throw erro404('folha_ausente', 'Folha não encontrada');
    const st = (sheet as { status: string }).status;
    if (st !== 'approved' && st !== 'paid') {
      throw erro409('folha_nao_aprovada', 'A folha precisa estar aprovada para pagamento em lote');
    }
    const { data: summaries } = await supabaseAdmin
      .from('payroll_employee_summaries')
      .select('employee_id, net_salary')
      .eq('sheet_id', input.origemId);
    const nets = (summaries || []) as { employee_id: string; net_salary: number }[];
    if (nets.length === 0) throw erro409('folha_sem_itens', 'Folha sem resumos para pagamento');
    const { data: employees } = await supabaseAdmin
      .from('payroll_employees')
      .select('id, name, cpf, bank_code, bank_agency, bank_account')
      .in('id', nets.map((n) => n.employee_id));
    const porId = new Map((employees || []).map((e) => [e.id, e as {
      name: string; cpf?: string; bank_code?: string; bank_agency?: string; bank_account?: string;
    }]));
    favorecidos = nets
      .map((n) => {
        const emp = porId.get(n.employee_id);
        return {
          nome: emp?.name || 'Colaborador',
          documento: String(emp?.cpf || '').replace(/\D/g, ''),
          banco: emp?.bank_code || '',
          agencia: emp?.bank_agency || '',
          conta: emp?.bank_account || '',
          digito: '',
          valor: Number(n.net_salary || 0),
        };
      })
      .filter((f) => f.valor > 0);
  }

  if (favorecidos.length === 0) throw erro400('lote_vazio', 'Nenhum favorecido com valor > 0');

  // grava fin_pagamentos pendente e envia só quem tem dados bancários completos
  const dataPrevista = input.dataPrevista || new Date().toISOString().slice(0, 10);
  const completos = favorecidos.filter((f) => f.banco && f.agencia && f.conta && f.documento);
  const insercoes = favorecidos.map((f) => ({
    origem_tipo: input.origemTipo,
    origem_id: input.origemId ?? null,
    conta_bancaria_id: input.contaBancariaId,
    favorecido: f,
    valor: f.valor,
    data_prevista: dataPrevista,
    status: 'pendente',
  }));
  const { data: pagamentos, error } = await supabaseAdmin
    .from('fin_pagamentos')
    .insert(insercoes)
    .select('id, favorecido, valor');
  if (error) throw new FinanceiroHttpError(500, 'db_erro', error.message);
  const pagamentosRows = (pagamentos || []) as unknown as { id: string; favorecido: typeof favorecidos[number]; valor: number }[];

  const enviaveis = pagamentosRows.filter((p) =>
    completos.some((f) => f.nome === p.favorecido.nome && f.valor === Number(p.valor)),
  );

  const itens: FinPagamentoLoteResponse['itens'] = pagamentosRows.map((p) => {
    const completo = !!p.favorecido.banco && !!p.favorecido.agencia && !!p.favorecido.conta && !!p.favorecido.documento;
    return { idLocal: p.id, aceito: false, ...(completo ? {} : { erro: 'Dados bancários incompletos' }) };
  });

  if (enviaveis.length > 0) {
    const loteItens: PagamentoLoteItem[] = enviaveis.map((p) => ({
      idLocal: p.id,
      favorecido: {
        nome: p.favorecido.nome,
        documento: p.favorecido.documento,
        tipoConta: 'cc',
        banco: p.favorecido.banco,
        agencia: p.favorecido.agencia,
        conta: p.favorecido.conta,
        digitoConta: p.favorecido.digito || '',
      },
      valor: Number(p.valor),
      dataPrevista,
      descricao: input.origemTipo === 'payroll_sheet' ? 'Pagamento de folha' : 'Pagamento manual',
    }));
    if (!adapter.enviarPagamentoLote) {
      throw erro400('capacidade_nao_suportada', `Adapter '${adapter.meta.key}' não suporta pagamento em lote`);
    }
    const resultado = await chamarCapacidade(() => adapter.enviarPagamentoLote!(ctx, loteItens));
    for (const item of resultado.itens) {
      const alvo = itens.find((i) => i.idLocal === item.idLocal);
      if (!alvo) continue;
      alvo.aceito = item.aceito;
      if (item.idExternoBanco) alvo.idExternoBanco = item.idExternoBanco;
      if (item.erro) alvo.erro = item.erro;
      await supabaseAdmin
        .from('fin_pagamentos')
        .update({
          status: item.aceito ? 'enviado' : 'rejeitado',
          lote_id_externo: resultado.loteIdExterno || null,
          id_externo: item.idExternoBanco || null,
          resposta_adapter: item.erro ? { erro: item.erro } : {},
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.idLocal);
    }
    await registrarEvento({
      entidade: 'pagamento',
      entidadeId: input.origemId ?? null,
      tipo: 'pagamento.enviado',
      payload: {
        lote: resultado.loteIdExterno,
        enviados: resultado.itens.filter((i) => i.aceito).length,
        rejeitados: resultado.itens.filter((i) => !i.aceito).length,
        conta_bancaria_id: input.contaBancariaId,
      },
      ator,
    });
    return { loteId: resultado.loteIdExterno || null, loteIdExterno: resultado.loteIdExterno, itens };
  }

  await registrarEvento({
    entidade: 'pagamento',
    entidadeId: input.origemId ?? null,
    tipo: 'pagamento.rejeitado',
    payload: { motivo: 'dados bancarios incompletos', conta_bancaria_id: input.contaBancariaId },
    ator,
  });
  return { loteId: null, itens };
}
