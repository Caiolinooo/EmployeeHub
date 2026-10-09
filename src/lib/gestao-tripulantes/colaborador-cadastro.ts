/**
 * Shared create/update payload for gt_colaboradores.
 * DP and GT mutate the same table via POST|PUT /colaboradores.
 */
import { isValidCpf, normalizeCpf } from '@/lib/utils/identity';
import {
  PRAZO_CONTRATO_DATA_FIELDS,
  PRAZO_CONTRATO_DIAS_FIELDS,
  prazoContratoExigeProrrogacao,
  prazoContratoExigeVigencia,
  prazoContratoZeraDatas,
} from './prazo-contrato';
import { persistirCamposEscala } from './regime-escala';

export const ALLOWED_COLAB_FIELDS = [
  'nome_completo', 'cpf', 'rg', 'orgao_emissor', 'data_emissao_rg',
  'data_nascimento', 'sexo', 'genero', 'estado_civil', 'peso', 'altura',
  'raca_cor', 'escolaridade', 'deficiencia', 'deficiencia_cid',
  'nacionalidade', 'naturalidade', 'naturalidade_uf', 'pais_nascimento',
  'nome_mae', 'nome_pai', 'email', 'email_corporativo', 'telefone', 'telefone_2', 'foto_url',
  'endereco_logradouro', 'endereco_numero', 'endereco_complemento',
  'endereco_bairro', 'endereco_cidade', 'endereco_uf', 'endereco_cep',
  'dados_bancarios', 'pis_pasep', 'ctps', 'ctps_serie', 'ctps_uf',
  'cnh', 'cnh_categoria', 'cnh_validade', 'cnh_uf',
  'titulo_eleitor', 'titulo_eleitor_zona', 'titulo_eleitor_sessao',
  'certidao_tipo', 'certidao_numero', 'certidao_cartorio',
  'rnm_rne', 'rnm_rne_emissao', 'rnm_rne_validade',
  'matricula', 'matricula_esocial', 'departamento', 'departamento_id',
  'cargo_id', 'centro_custo_id', 'empresa_id', 'embarcacao_atual_id',
  'data_admissao', 'data_demissao', 'motivo_demissao',
  'salario', 'tipo_salario', 'forma_pagamento', 'sindicato', 'cbo',
  'salario_moeda', 'salario_periodo', 'salario_natureza',
  'jornada_semanal', 'jornada_mensal', 'tipo_contrato', 'prazo_contrato',
  'prazo_contrato_dias', 'prazo_contrato_termino',
  'prazo_contrato_prorrog_dias', 'prazo_contrato_prorrog_termino',
  'categoria_contrato', 'tipo_trabalho', 'tipo_mao_de_obra', 'regime_trabalho',
  'escala_embarque', 'escala_folga', 'status_embarque', 'standby', 'ativo',
  'data_ultimo_embarque', 'data_ultimo_desembarque', 'data_proximo_embarque',
  'dados_saude', 'tipo_admissao', 'natureza_atividade', 'tipo_jornada', 'tipo_lotacao',
  'contabilizar_timesheet',
] as const;

export type AllowedColabField = (typeof ALLOWED_COLAB_FIELDS)[number];

export const ALLOWED_COLAB_FIELD_SET = new Set<string>(ALLOWED_COLAB_FIELDS);

export const BOOLEAN_COLAB_FIELDS = new Set(['standby', 'ativo', 'contabilizar_timesheet']);
export const NUMBER_COLAB_FIELDS = new Set([
  'peso', 'altura', 'salario', 'escala_embarque', 'escala_folga',
]);
/** Campos de escala NxN: e-Social manda "14x21" — extrai o primeiro inteiro. */
export const ESCALA_NXN_COLAB_FIELDS = new Set(['escala_embarque', 'escala_folga']);
export const JSON_COLAB_FIELDS = new Set(['dados_bancarios', 'dados_saude']);
const PRAZO_DIAS_FIELDS = new Set<string>(PRAZO_CONTRATO_DIAS_FIELDS);
const PRAZO_DATA_FIELDS = new Set<string>(PRAZO_CONTRATO_DATA_FIELDS);

export const MENSAGEM_CADASTRO_NEGADO =
  'Apenas o DP pode cadastrar ou alterar colaborador. É necessário ser gestor (ADMIN/MANAGER) ou pertencer a um setor de Departamento Pessoal / RH com o módulo Gestão de Tripulantes.';

export type CadastroValidacaoOk = { ok: true; nome: string; cpf: string };
export type CadastroValidacaoErro = { ok: false; error: string; status: 400 };
export type CadastroValidacao = CadastroValidacaoOk | CadastroValidacaoErro;

export function validarCadastroMinimo(
  body: Record<string, unknown>,
  opts?: { requireNome?: boolean; requireCpf?: boolean },
): CadastroValidacao {
  const requireNome = opts?.requireNome !== false;
  const requireCpf = opts?.requireCpf !== false;
  const hasNome = Object.prototype.hasOwnProperty.call(body, 'nome_completo');
  const hasCpf = Object.prototype.hasOwnProperty.call(body, 'cpf');

  let nome = '';
  if (requireNome || hasNome) {
    nome = body.nome_completo == null ? '' : String(body.nome_completo).trim();
    if (!nome) {
      return { ok: false, error: 'Nome completo é obrigatório', status: 400 };
    }
  }

  let cpf = '';
  if (requireCpf || hasCpf) {
    const rawCpf = body.cpf == null ? '' : String(body.cpf);
    if (!rawCpf.trim()) {
      return { ok: false, error: 'CPF é obrigatório', status: 400 };
    }
    if (!isValidCpf(rawCpf)) {
      return { ok: false, error: 'CPF inválido', status: 400 };
    }
    cpf = normalizeCpf(rawCpf);
  }

  return { ok: true, nome, cpf };
}

const EMAIL_OPCIONAL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Vazio é válido. Texto preenchido precisa parecer e-mail. Não altera o e-mail pessoal. */
export function normalizarEmailOpcional(
  value: unknown,
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (value == null) return { ok: true, value: null };
  const text = String(value).trim();
  if (!text) return { ok: true, value: null };
  if (text.length > 320 || !EMAIL_OPCIONAL_RE.test(text)) {
    return { ok: false, error: 'E-mail corporativo inválido' };
  }
  return { ok: true, value: text };
}

export function resolverMatriculaEsocial(body: Record<string, unknown>): string | null {
  const eso = body.matricula_esocial == null ? '' : String(body.matricula_esocial).trim();
  if (eso) return eso;
  const mat = body.matricula == null ? '' : String(body.matricula).trim();
  return mat || null;
}

function prazoDoBody(body: Record<string, unknown>): string {
  if (!Object.prototype.hasOwnProperty.call(body, 'prazo_contrato')) return '';
  return body.prazo_contrato == null ? '' : String(body.prazo_contrato);
}

function campoPrazoDescartado(body: Record<string, unknown>, key: string): boolean {
  const prazo = prazoDoBody(body);
  if (!Object.prototype.hasOwnProperty.call(body, 'prazo_contrato')) return false;
  if (prazoContratoZeraDatas(prazo)) return true;
  const prorrog = key === 'prazo_contrato_prorrog_dias' || key === 'prazo_contrato_prorrog_termino';
  return prorrog && prazoContratoExigeVigencia(prazo) && !prazoContratoExigeProrrogacao(prazo);
}

function coerceField(
  key: string,
  value: unknown,
  body: Record<string, unknown>,
): { ok: true; value: unknown } | { ok: false; error: string } {
  if (PRAZO_DIAS_FIELDS.has(key) || PRAZO_DATA_FIELDS.has(key)) {
    if (campoPrazoDescartado(body, key)) return { ok: true, value: null };
  }

  if (PRAZO_DIAS_FIELDS.has(key)) {
    if (value == null || value === '') return { ok: true, value: null };
    const n = typeof value === 'number' ? value : Number(String(value).trim());
    if (!Number.isInteger(n) || n < 0) {
      return { ok: false, error: `Campo ${key} deve ser um inteiro maior ou igual a zero` };
    }
    return { ok: true, value: n };
  }

  if (PRAZO_DATA_FIELDS.has(key)) {
    if (value == null) return { ok: true, value: null };
    const text = String(value).trim();
    if (!text) return { ok: true, value: null };
    const iso = text.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      return { ok: false, error: `Campo ${key} deve ser uma data` };
    }
    return { ok: true, value: iso };
  }

  if (BOOLEAN_COLAB_FIELDS.has(key)) {
    if (typeof value === 'boolean') return { ok: true, value };
    if (value === 'true' || value === 'false') return { ok: true, value: value === 'true' };
    if (value == null || value === '') return { ok: true, value: false };
    return { ok: true, value: Boolean(value) };
  }

  if (NUMBER_COLAB_FIELDS.has(key)) {
    if (value == null || value === '') return { ok: true, value: null };
    if (ESCALA_NXN_COLAB_FIELDS.has(key) && typeof value === 'string') {
      // e-Social manda o par NxN ("14x21", "14/21", "14:21", "14 - 21"):
      // extrai o primeiro inteiro em vez de quebrar o cadastro com NaN.
      const nxn = value.trim().match(/^(\d+)\s*[xX/:\-]\s*\d+$/);
      if (nxn) return { ok: true, value: parseInt(nxn[1], 10) };
    }
    const n = Number(value);
    if (Number.isNaN(n)) {
      return { ok: false, error: `Campo ${key} deve ser numérico` };
    }
    return { ok: true, value: n };
  }

  if (JSON_COLAB_FIELDS.has(key)) {
    if (value == null || value === '') return { ok: true, value: null };
    if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value as object).length === 0) {
      return { ok: true, value: null };
    }
    return { ok: true, value };
  }

  if (typeof value === 'string' && value.trim() === '') {
    return { ok: true, value: null };
  }
  return { ok: true, value };
}

export type MontarPayloadOk = { ok: true; data: Record<string, unknown> };
export type MontarPayloadErro = { ok: false; error: string; status: 400 };
export type MontarPayloadResult = MontarPayloadOk | MontarPayloadErro;

export function montarPayloadCadastro(
  body: Record<string, unknown>,
  mode: 'create' | 'update',
): MontarPayloadResult {
  const requireAll = mode === 'create';
  const validacao = validarCadastroMinimo(body, {
    requireNome: requireAll,
    requireCpf: requireAll,
  });
  if (!validacao.ok) return validacao;

  const data: Record<string, unknown> = {};

  if (mode === 'create') {
    data.nome_completo = validacao.nome;
    data.cpf = validacao.cpf;
    data.origem = 'manual';
    data.nacionalidade =
      body.nacionalidade == null || String(body.nacionalidade).trim() === ''
        ? 'BRASILEIRA'
        : String(body.nacionalidade).trim();
    data.pais_nascimento =
      body.pais_nascimento == null || String(body.pais_nascimento).trim() === ''
        ? 'Brasil'
        : String(body.pais_nascimento).trim();
    data.status_embarque =
      body.status_embarque == null || String(body.status_embarque).trim() === ''
        ? 'desembarcado'
        : body.status_embarque;
  } else {
    if (Object.prototype.hasOwnProperty.call(body, 'nome_completo')) {
      data.nome_completo = validacao.nome;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'cpf')) {
      data.cpf = validacao.cpf;
    }
    data.updated_at = new Date().toISOString();
  }

  for (const [key, value] of Object.entries(body)) {
    if (!ALLOWED_COLAB_FIELD_SET.has(key)) continue;
    if (key === 'cpf' || key === 'nome_completo') continue;
    if (key === 'email_corporativo') {
      const emailCorp = normalizarEmailOpcional(value);
      if (!emailCorp.ok) return { ok: false, error: emailCorp.error, status: 400 };
      data.email_corporativo = emailCorp.value;
      continue;
    }
    if (mode === 'create' && (key === 'nacionalidade' || key === 'pais_nascimento' || key === 'status_embarque')) {
      if (value == null || String(value).trim() === '') continue;
    }
    const coerced = coerceField(key, value, body);
    if (!coerced.ok) return { ok: false, error: coerced.error, status: 400 };
    data[key] = coerced.value;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'prazo_contrato')) {
    const prazo = data.prazo_contrato == null ? '' : String(data.prazo_contrato);
    if (prazoContratoZeraDatas(prazo)) {
      data.prazo_contrato_dias = null;
      data.prazo_contrato_termino = null;
      data.prazo_contrato_prorrog_dias = null;
      data.prazo_contrato_prorrog_termino = null;
    } else if (prazoContratoExigeVigencia(prazo) && !prazoContratoExigeProrrogacao(prazo)) {
      data.prazo_contrato_prorrog_dias = null;
      data.prazo_contrato_prorrog_termino = null;
    }
  }

  const shouldPersistEscala =
    mode === 'create' ||
    Object.prototype.hasOwnProperty.call(body, 'regime_trabalho') ||
    Object.prototype.hasOwnProperty.call(body, 'escala_embarque') ||
    Object.prototype.hasOwnProperty.call(body, 'escala_folga');

  if (shouldPersistEscala) {
    const persistido = persistirCamposEscala({
      regime_trabalho: (data.regime_trabalho ?? body.regime_trabalho) as string | null,
      escala_embarque: (data.escala_embarque ?? body.escala_embarque) as number | string | null,
      escala_folga: (data.escala_folga ?? body.escala_folga) as number | string | null,
    });
    data.regime_trabalho = persistido.regime_trabalho;
    data.escala_embarque = persistido.escala_embarque;
    data.escala_folga = persistido.escala_folga;
  }

  if (
    mode === 'create' ||
    Object.prototype.hasOwnProperty.call(body, 'matricula') ||
    Object.prototype.hasOwnProperty.call(body, 'matricula_esocial')
  ) {
    data.matricula_esocial = resolverMatriculaEsocial({
      matricula: data.matricula ?? body.matricula,
      matricula_esocial: data.matricula_esocial ?? body.matricula_esocial,
    });
  }

  return { ok: true, data };
}
