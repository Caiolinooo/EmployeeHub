/**
 * Cliente tipado das rotas /api/financeiro/** (§6 do design financeiro).
 * Consumido por src/components/financeiro/** e páginas; tipos espelham o banco
 * via src/types/financeiro.ts (dev-Back). Nenhuma credencial/segredo passa por
 * aqui — valores sensíveis vão por POST {campo, valor} e nunca voltam em GET.
 */
import { fetchWithToken } from '@/lib/tokenStorage';
import type {
  FinApiResponse,
  FinPaginatedResponse,
  FinCliente,
  FinClienteForm,
  FinFatura,
  FinFaturaCreateInput,
  FinFaturaUpdateInput,
  FinFaturaTemplate,
  FinVisaoGeral,
  FinIntegracaoBanco,
  FinIntegracaoBancoComCredenciais,
  FinBancoCatalogoItem,
  FinBancoTestarResultado,
  FinCertificadoUploadResultado,
  FinContaBancaria,
  FinContaBancariaForm,
  FinCobranca,
  FinCobrancaCreateInput,
  FinPagamento,
  FinPagamentoLoteResponse,
  FinConciliacao,
  FinConciliacaoImportarResultado,
  FinEvento,
  FinEventoEntidade,
  FinMunicipio,
  FinMunicipiosResponse,
  FinNfseConfig,
  FinNfseConfigForm,
  FinNfseCredencialInput,
  FinNfseEmissao,
  FinNfseEmissaoDetalhe,
  FinGerarDaFolhaInput,
  FinIntegracaoAmbiente,
} from '@/types/financeiro';

const BASE = '/api/financeiro';

class FinanceiroApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'FinanceiroApiError';
    this.status = status;
  }
}

function qs(params?: Record<string, string | number | boolean | undefined | null>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) {
    if (v !== undefined && v !== null && v !== '') usp.set(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : '';
}

/** Executa a chamada e desembrulha FinApiResponse — lança em !success/HTTP erro. */
async function unwrap<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetchWithToken(`${BASE}${path}`, init);
  let body: FinApiResponse<T> | null = null;
  try {
    body = (await res.json()) as FinApiResponse<T>;
  } catch {
    /* resposta não-JSON cai no erro abaixo */
  }
  if (!res.ok || !body?.success) {
    throw new FinanceiroApiError(body?.error || `Erro HTTP ${res.status} em ${path}`, res.status);
  }
  return body.data as T;
}

/** Listas paginadas (data.items) com fallback a data em array. */
async function unwrapList<T>(path: string, init?: RequestInit): Promise<T[]> {
  const res = await fetchWithToken(`${BASE}${path}`, init);
  let body: FinPaginatedResponse<T> | FinApiResponse<T[]> | null = null;
  try {
    body = (await res.json()) as FinPaginatedResponse<T> | FinApiResponse<T[]>;
  } catch {
    /* idem */
  }
  if (!res.ok || !body?.success) {
    throw new FinanceiroApiError(body?.error || `Erro HTTP ${res.status} em ${path}`, res.status);
  }
  const data = body.data;
  if (Array.isArray(data)) return data;
  return (data as { items?: T[] })?.items ?? [];
}

function jsonInit(method: string, payload: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload ?? {}),
  };
}

// ============================================================
// Visão geral
// ============================================================

export function getVisaoGeral(params?: { competencia?: string; empresaId?: string }): Promise<FinVisaoGeral> {
  return unwrap<FinVisaoGeral>(`/visao-geral${qs(params)}`);
}

// ============================================================
// Clientes
// ============================================================

export function listClientes(params?: { empresaId?: string; busca?: string; page?: number; limit?: number }): Promise<FinCliente[]> {
  return unwrapList<FinCliente>(`/clientes${qs(params)}`);
}

export function createCliente(form: FinClienteForm): Promise<FinCliente> {
  return unwrap<FinCliente>('/clientes', jsonInit('POST', form));
}

export function getCliente(id: string): Promise<FinCliente> {
  return unwrap<FinCliente>(`/clientes/${id}`);
}

export function updateCliente(id: string, parcial: Partial<FinClienteForm>): Promise<{ ok: boolean }> {
  return unwrap<{ ok: boolean }>(`/clientes/${id}`, jsonInit('PUT', parcial));
}

export function deleteCliente(id: string): Promise<{ ok: boolean }> {
  return unwrap<{ ok: boolean }>(`/clientes/${id}`, { method: 'DELETE' });
}

// ============================================================
// Faturas
// ============================================================

export function listFaturas(params?: {
  empresaId?: string; clienteId?: string; status?: string; competencia?: string;
  page?: number; limit?: number;
}): Promise<FinFatura[]> {
  return unwrapList<FinFatura>(`/faturas${qs(params)}`);
}

export function createFatura(input: FinFaturaCreateInput): Promise<FinFatura> {
  return unwrap<FinFatura>('/faturas', jsonInit('POST', input));
}

export function getFatura(id: string): Promise<FinFatura> {
  return unwrap<FinFatura>(`/faturas/${id}`);
}

export function updateFatura(id: string, parcial: FinFaturaUpdateInput): Promise<FinFatura> {
  return unwrap<FinFatura>(`/faturas/${id}`, jsonInit('PUT', parcial));
}

/** DELETE lógico: status=cancelada (409 fora de rascunho/emitida). */
export function cancelarFatura(id: string): Promise<{ ok: boolean }> {
  return unwrap<{ ok: boolean }>(`/faturas/${id}`, { method: 'DELETE' });
}

export function gerarFaturaDaFolha(input: FinGerarDaFolhaInput): Promise<FinFatura> {
  return unwrap<FinFatura>('/faturas/gerar-da-folha', jsonInit('POST', input));
}

export function emitirFatura(id: string): Promise<FinFatura> {
  return unwrap<FinFatura>(`/faturas/${id}/emitir`, jsonInit('POST', {}));
}

/** URL do render HTML A4 (iframe do FaturaViewer). */
export function faturaRenderUrl(id: string, formato: 'html' = 'html'): string {
  return `${BASE}/faturas/${id}/render?formato=${formato}`;
}

/** URL do PDF (download/nova aba) — fetchWithToken acrescenta o token na hora. */
export function faturaPdfUrl(id: string): string {
  return `${BASE}/faturas/${id}/pdf`;
}

export function faturaXlsxUrl(id: string): string {
  return `${BASE}/faturas/${id}/xlsx`;
}

// ============================================================
// Templates de fatura (gate admin exceto leitura)
// ============================================================

export function listTemplates(params?: { tipo?: string; ativo?: boolean }): Promise<FinFaturaTemplate[]> {
  return unwrapList<FinFaturaTemplate>(`/templates${qs(params)}`);
}

export function createTemplate(formData: FormData): Promise<FinFaturaTemplate> {
  return unwrap<FinFaturaTemplate>('/templates', { method: 'POST', body: formData });
}

export function updateTemplate(
  id: string,
  parcial: Partial<Pick<FinFaturaTemplate, 'nome' | 'mapping' | 'is_default' | 'is_active'>>,
): Promise<{ ok: boolean }> {
  return unwrap<{ ok: boolean }>(`/templates/${id}`, jsonInit('PUT', parcial));
}

export function deleteTemplate(id: string): Promise<{ ok: boolean }> {
  return unwrap<{ ok: boolean }>(`/templates/${id}`, { method: 'DELETE' });
}

// ============================================================
// NFS-e — config por empresa+município
// ============================================================

export function listNfseConfig(params?: { empresaId?: string }): Promise<FinNfseConfig[]> {
  return unwrapList<FinNfseConfig>(`/nfse/config${qs(params)}`);
}

export function createNfseConfig(form: FinNfseConfigForm): Promise<FinNfseConfig> {
  return unwrap<FinNfseConfig>('/nfse/config', jsonInit('POST', form));
}

export function getNfseConfig(id: string): Promise<FinNfseConfig> {
  return unwrap<FinNfseConfig>(`/nfse/config/${id}`);
}

export function updateNfseConfig(id: string, parcial: Partial<FinNfseConfigForm>): Promise<FinNfseConfig> {
  return unwrap<FinNfseConfig>(`/nfse/config/${id}`, jsonInit('PUT', parcial));
}

export function deleteNfseConfig(id: string): Promise<{ ok: boolean }> {
  return unwrap<{ ok: boolean }>(`/nfse/config/${id}`, { method: 'DELETE' });
}

/** Credencial avulsa (usuario/token/webservice) → app_secrets. Segredo NUNCA retorna. */
export function salvarNfseCredencial(id: string, input: FinNfseCredencialInput): Promise<{ ok: boolean }> {
  return unwrap<{ ok: boolean }>(`/nfse/config/${id}/credenciais`, jsonInit('POST', input));
}

/** Upload do certificado A1 (.pfx multipart + senha) para NFS-e. */
export function uploadNfseCertificado(id: string, arquivo: File, senha: string): Promise<FinCertificadoUploadResultado> {
  const fd = new FormData();
  fd.append('arquivo', arquivo);
  fd.append('senha', senha);
  return unwrap<FinCertificadoUploadResultado>(`/nfse/config/${id}/credenciais`, { method: 'POST', body: fd });
}

// ============================================================
// NFS-e — registry de municípios
// ============================================================

export function listMunicipios(params?: { uf?: string; busca?: string; page?: number; limit?: number }): Promise<FinMunicipiosResponse> {
  return unwrap<FinMunicipiosResponse>(`/nfse/municipios${qs(params)}`);
}

/** Edição do registry (§7.2, gate admin). ATENÇÃO: §6 lista apenas o GET —
 * rota PUT esperada na onda de integração (comunicado ao dev-Back). */
export function updateMunicipio(
  codigoIbge: string,
  parcial: Partial<Pick<FinMunicipio, 'provider_sugerido' | 'wsdl_url' | 'ambiente_urls'>>,
): Promise<{ ok: boolean }> {
  return unwrap<{ ok: boolean }>(`/nfse/municipios/${codigoIbge}`, jsonInit('PUT', parcial));
}

// ============================================================
// NFS-e — emissões
// ============================================================

export function listNfseEmissoes(params?: {
  faturaId?: string; empresaId?: string; status?: string; ambiente?: string;
  page?: number; limit?: number;
}): Promise<FinNfseEmissao[]> {
  return unwrapList<FinNfseEmissao>(`/nfse/emissoes${qs(params)}`);
}

/** POST {faturaId} — gera RPS (contador transacional) e envia ao provider. */
export function criarNfseEmissao(faturaId: string): Promise<FinNfseEmissao> {
  return unwrap<FinNfseEmissao>('/nfse/emissoes', jsonInit('POST', { faturaId }));
}

/** Detalhe; XMLs só com ?xml=1 (e nível edit no servidor). */
export function getNfseEmissao(id: string, opts?: { xml?: boolean }): Promise<FinNfseEmissaoDetalhe> {
  return unwrap<FinNfseEmissaoDetalhe>(`/nfse/emissoes/${id}${qs({ xml: opts?.xml ? 1 : undefined })}`);
}

export function consultarNfseEmissao(id: string): Promise<FinNfseEmissao> {
  return unwrap<FinNfseEmissao>(`/nfse/emissoes/${id}/consultar`, jsonInit('POST', {}));
}

export function cancelarNfseEmissao(id: string, motivo: string, codigoCancelamento?: string): Promise<FinNfseEmissao> {
  return unwrap<FinNfseEmissao>(`/nfse/emissoes/${id}/cancelar`, jsonInit('POST', { motivo, codigoCancelamento }));
}

// ============================================================
// Bancos — catálogo e integrações
// ============================================================

export function getBancoCatalogo(): Promise<FinBancoCatalogoItem[]> {
  return unwrap<FinBancoCatalogoItem[]>('/bancos/catalogo');
}

export function listIntegracoes(params?: { adapterKey?: string; status?: string }): Promise<FinIntegracaoBanco[]> {
  return unwrapList<FinIntegracaoBanco>(`/bancos/integracoes${qs(params)}`);
}

export function createIntegracao(input: { adapterKey: string; apelido: string; ambiente: FinIntegracaoAmbiente }): Promise<FinIntegracaoBanco> {
  return unwrap<FinIntegracaoBanco>('/bancos/integracoes', jsonInit('POST', input));
}

export function getIntegracao(id: string): Promise<FinIntegracaoBancoComCredenciais> {
  return unwrap<FinIntegracaoBancoComCredenciais>(`/bancos/integracoes/${id}`);
}

export function updateIntegracao(
  id: string,
  parcial: Partial<{ apelido: string; ambiente: FinIntegracaoAmbiente; is_active: boolean; status: FinIntegracaoBanco['status'] }>,
): Promise<FinIntegracaoBanco> {
  return unwrap<FinIntegracaoBanco>(`/bancos/integracoes/${id}`, jsonInit('PUT', parcial));
}

export function deleteIntegracao(id: string): Promise<{ ok: boolean }> {
  return unwrap<{ ok: boolean }>(`/bancos/integracoes/${id}`, { method: 'DELETE' });
}

/** {campo, valor} → app_secrets (fin_banco_<id>_<campo>). */
export function salvarCredencialIntegracao(id: string, campo: string, valor: string): Promise<{ ok: boolean }> {
  return unwrap<{ ok: boolean }>(`/bancos/integracoes/${id}/credenciais`, jsonInit('POST', { campo, valor }));
}

/** multipart .pfx + senha → bucket + fingerprint/validade. */
export function uploadCertificadoIntegracao(id: string, arquivo: File, senha: string): Promise<FinCertificadoUploadResultado> {
  const fd = new FormData();
  fd.append('arquivo', arquivo);
  fd.append('senha', senha);
  return unwrap<FinCertificadoUploadResultado>(`/bancos/integracoes/${id}/certificados`, { method: 'POST', body: fd });
}

export function testarIntegracao(id: string): Promise<FinBancoTestarResultado> {
  return unwrap<FinBancoTestarResultado>(`/bancos/integracoes/${id}/testar`, jsonInit('POST', {}));
}

// ============================================================
// Bancos — contas bancárias
// ============================================================

export function listContasBancarias(params?: { empresaId?: string; integracaoId?: string }): Promise<FinContaBancaria[]> {
  return unwrapList<FinContaBancaria>(`/bancos/contas${qs(params)}`);
}

export function createContaBancaria(form: FinContaBancariaForm): Promise<FinContaBancaria> {
  return unwrap<FinContaBancaria>('/bancos/contas', jsonInit('POST', form));
}

export function getContaBancaria(id: string): Promise<FinContaBancaria> {
  return unwrap<FinContaBancaria>(`/bancos/contas/${id}`);
}

export function updateContaBancaria(id: string, parcial: Partial<FinContaBancariaForm>): Promise<FinContaBancaria> {
  return unwrap<FinContaBancaria>(`/bancos/contas/${id}`, jsonInit('PUT', parcial));
}

export function deleteContaBancaria(id: string): Promise<{ ok: boolean }> {
  return unwrap<{ ok: boolean }>(`/bancos/contas/${id}`, { method: 'DELETE' });
}

// ============================================================
// Cobranças
// ============================================================

export function listCobrancas(params?: {
  faturaId?: string; contaBancariaId?: string; status?: string; tipo?: string;
  page?: number; limit?: number;
}): Promise<FinCobranca[]> {
  return unwrapList<FinCobranca>(`/cobrancas${qs(params)}`);
}

/** Gera boleto/pix no adapter — devolve linha digitável/QR. */
export function createCobranca(input: FinCobrancaCreateInput): Promise<FinCobranca> {
  return unwrap<FinCobranca>('/cobrancas', jsonInit('POST', input));
}

/** Reconsulta o adapter → status atualizado (liquidação manual). */
export function atualizarCobranca(id: string): Promise<FinCobranca> {
  return unwrap<FinCobranca>(`/cobrancas/${id}/atualizar`, jsonInit('POST', {}));
}

// ============================================================
// Pagamentos (lote folha → colaboradores)
// ============================================================

export function criarLotePagamentos(input: {
  origemTipo: 'payroll_sheet' | 'manual';
  origemId: string;
  contaBancariaId: string;
  dataPrevista?: string;
}): Promise<FinPagamentoLoteResponse> {
  return unwrap<FinPagamentoLoteResponse>('/pagamentos/lote', jsonInit('POST', input));
}

export function listPagamentos(params?: {
  origemTipo?: string; origemId?: string; status?: string; contaBancariaId?: string;
  page?: number; limit?: number;
}): Promise<FinPagamento[]> {
  return unwrapList<FinPagamento>(`/pagamentos${qs(params)}`);
}

// ============================================================
// Conciliação
// ============================================================

/** Importa extrato via adapter (reconciliação automática por txid/nossoNúmero/valor+data). */
export function importarConciliacoes(input: { contaBancariaId: string; de: string; ate: string }): Promise<FinConciliacaoImportarResultado> {
  return unwrap<FinConciliacaoImportarResultado>('/conciliacoes/importar', jsonInit('POST', input));
}

/** Upload CSV (parser XP genérico) → mesma saída do importar. */
export function uploadConciliacoesCsv(contaBancariaId: string, arquivo: File): Promise<FinConciliacaoImportarResultado> {
  const fd = new FormData();
  fd.append('contaBancariaId', contaBancariaId);
  fd.append('arquivo', arquivo);
  return unwrap<FinConciliacaoImportarResultado>('/conciliacoes/upload-csv', { method: 'POST', body: fd });
}

export function listConciliacoes(params?: {
  contaBancariaId?: string; status?: string; de?: string; ate?: string;
  page?: number; limit?: number;
}): Promise<FinConciliacao[]> {
  return unwrapList<FinConciliacao>(`/conciliacoes${qs(params)}`);
}

export function vincularConciliacao(id: string, cobrancaId: string): Promise<{ ok: boolean }> {
  return unwrap<{ ok: boolean }>(`/conciliacoes/${id}/vincular`, jsonInit('POST', { cobrancaId }));
}

export function ignorarConciliacao(id: string): Promise<{ ok: boolean }> {
  return unwrap<{ ok: boolean }>(`/conciliacoes/${id}/ignorar`, jsonInit('POST', {}));
}

// ============================================================
// Eventos (trilha única)
// ============================================================

export function listEventos(params?: {
  entidade?: FinEventoEntidade; entidadeId?: string; page?: number; limit?: number;
}): Promise<FinEvento[]> {
  return unwrapList<FinEvento>(`/eventos${qs(params)}`);
}
