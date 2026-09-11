import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { MIOIntegrante, MIOCalendarEvent, MIOTreinamento, MIOASO, MIOEmbarque } from '@/types/mio';
import { assertMioPullContext } from '@/lib/mio/pull-context';

// URL Base descoberta via análise do insomnia.json
const DEFAULT_API_URL = 'https://mio.app.br/api/v1';

const MIO_CONFIG = {
    baseURL: (process.env.MIO_API_URL || DEFAULT_API_URL).replace(/\/api$/, '/api/v1').replace(/\/$/, ''),
    username: (process.env.MIO_AUTH_USER || '').replace(/["']/g, '').trim(),
    password: (process.env.MIO_AUTH_PASSWORD || '').replace(/["']/g, '').trim(),
    timeout: 120000
};

/** Paths that may PULL from MIO (GET or POST-as-query). Everything else is a write. */
const MIO_PULL_PATH = [
    /^\/int-integrante-get\/?$/i,
    /^\/sms-treinamento-registro-get(\/|$)/i,
    /^\/sms-treinamento-turma-get(\/|$)/i,
    /^\/lgp-reports\/?$/i,
    /^\/sms-afastamento-get\/?$/i,
    /^\/int-integrantes-ferias-get\/?$/i,
    /^\/int-integrantes-beneficio-get\/?$/i,
    /^\/int-integrantes-dependente-get\/?$/i,
    /^\/lgp-sispat-get\/?$/i,
    /^\/lgp-rtpe-turma-get\/?$/i,
    /^\/sms-treinamento-registro-anexo/i,
    /^\/sms-treinamento-anexo/i,
    /^\/int-timesheet-get\/?$/i,
    /^\/int-report-days\/?$/i,
    /^\/sms-aso-get/i,
    /^\/sms-aso-registro-get/i,
    /^\/sms-aso-anexo/i,
    /^\/sms-exame/i,
    /^\/int-aso-get/i,
    /^\/sms-atestado-get/i,
    /^\/sms-saude-get/i,
    /^\/sms-aso\/?$/i, // GET probe only; POST is write-blocked below
    /^\/cgs-empresa-feriados-get\/?$/i,
];

const MIO_WRITE_PATH = [
    /-add$/i,
    /-upd$/i,
    /-update$/i,
    /-del$/i,
    /int-integrante-upd/i,
    /sms-treinamento-registro-add/i,
    /sms-afastamento$/i,
    /sms-aso$/i,
    /lgp-sispat-add/i,
    /lgp-viagem-avipam-webhook/i,
];

function normalizeMioPath(url?: string): string {
    if (!url) return '';
    try {
        if (url.startsWith('http')) {
            const u = new URL(url);
            return u.pathname.replace(/\/api\/v1/i, '') || '/';
        }
    } catch {
        /* keep raw */
    }
    return url.startsWith('/') ? url : `/${url}`;
}

export function isMioWritePath(method: string, url?: string): boolean {
    const m = method.toUpperCase();
    if (m === 'PUT' || m === 'PATCH' || m === 'DELETE') return true;
    if (m === 'GET') return false;
    const path = normalizeMioPath(url);
    if (m === 'POST' && /^\/sms-aso\/?$/i.test(path)) return true;
    return MIO_WRITE_PATH.some((re) => re.test(path));
}

export function isMioPullPath(method: string, url?: string): boolean {
    const m = method.toUpperCase();
    if (m === 'PUT' || m === 'PATCH' || m === 'DELETE') return false;
    const path = normalizeMioPath(url);
    return MIO_PULL_PATH.some((re) => re.test(path));
}

// Garantir que termina com /v1 se não tiver (caso user coloque url raiz)
if (!MIO_CONFIG.baseURL.includes('/v1')) {
    // Se terminar em /api, muda pra /api/v1. Se for só dominio, adiciona /api/v1
    if (MIO_CONFIG.baseURL.endsWith('/api')) {
        MIO_CONFIG.baseURL += '/v1';
    } else if (!MIO_CONFIG.baseURL.includes('/api')) {
        MIO_CONFIG.baseURL += '/api/v1';
    }
}
console.log('[MIO Config] Base URL:', MIO_CONFIG.baseURL);


class MioClient {
    private static instance: MioClient;
    private client: AxiosInstance;
    private token: string | null = null;
    public isConnected: boolean = false;
    public lastError: string | null = null;
    public lastLgpRange: { inicio: string; fim: string; chunks: number; apiLimit?: string } | null = null;
    public lastAsoProbe: { hits: unknown[]; misses: unknown[]; count: number } | null = null;

    private constructor() {
        this.client = axios.create({
            baseURL: MIO_CONFIG.baseURL,
            timeout: MIO_CONFIG.timeout,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        // Interceptor para adicionar token se existir
        this.client.interceptors.request.use(async (config) => {
            if (this.token) {
                config.headers.Authorization = `Bearer ${this.token}`;
            }
            return config;
        });
    }

    public static getInstance(): MioClient {
        if (!MioClient.instance) {
            MioClient.instance = new MioClient();
        }
        return MioClient.instance;
    }

    // Autenticação
    private async authenticate(): Promise<boolean> {
        if (!MIO_CONFIG.username || !MIO_CONFIG.password) {
            this.lastError = 'Credenciais MIO não configuradas (.env)';
            return false;
        }

        try {
            console.log(`[MIO Auth] Tentando autenticar em ${MIO_CONFIG.baseURL}/authenticate...`);

            // Encode credentials for Basic Auth manually to ensure correctness
            const credentials = Buffer.from(`${MIO_CONFIG.username}:${MIO_CONFIG.password}`).toString('base64');

            const response = await axios.post(`${MIO_CONFIG.baseURL}/authenticate`, {}, {
                headers: {
                    'Authorization': `Basic ${credentials}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000,
                validateStatus: null // Capture all status codes
            });

            if (response.status === 200 && response.data) {
                // Token acquisition
                this.token = response.data.token || response.data.access_token || response.data.key;

                if (this.token) {
                    console.log('[MIO Auth] Token obtido com sucesso.');
                    this.isConnected = true;
                    this.lastError = null;
                    return true;
                } else {
                    console.error('[MIO Auth] Token não encontrado na resposta:', response.data);
                    this.lastError = 'Token não encontrado na resposta da API.';
                    return false;
                }
            }

            // Handle expected errors
            console.warn(`[MIO Auth] Falha login: ${response.status}`, response.data);

            if (response.status === 401) {
                const msg = response.data?.message || 'Acesso Negado';
                this.lastError = `Erro 401: ${msg}`; // Will capture "Usuário não cadastrado"
            } else {
                this.lastError = `Falha na autenticação: HTTP ${response.status}`;
            }

            this.isConnected = false;
            return false;

        } catch (error: any) {
            console.error('[MIO Auth] Erro de conexão:', error.message);
            this.lastError = `Erro de conexão: ${error.message}`;
            this.isConnected = false;
            return false;
        }
    }

    // Wrapper seguro para requisições com retry de auth
    private async request<T>(config: AxiosRequestConfig, retry = true): Promise<T | null> {
        const method = (config.method || 'GET').toUpperCase();
        const url = String(config.url || '');
        assertMioPullContext(`${method} ${url}`);

        if (isMioWritePath(method, url)) {
            const msg = `[MIO] Forbidden write blocked: ${method} ${url} — MIO is read-only; copy INTO our storage only.`;
            console.error(msg);
            this.lastError = msg;
            throw new Error(msg);
        }
        if (!isMioPullPath(method, url)) {
            const msg = `[MIO] Non-allowlisted path blocked: ${method} ${url}`;
            console.error(msg);
            this.lastError = msg;
            throw new Error(msg);
        }
        console.log(`[MIO pull] ${method} ${url}`);

        // Se não tem token, tenta autenticar antes
        if (!this.token && retry) {
            await this.authenticate();
        }

        try {
            const response = await this.client.request<T>(config);
            this.isConnected = true;
            return response.data;
        } catch (error: any) {
            // Se der 401, tenta reautenticar uma vez
            if (error.response?.status === 401 && retry) {
                console.log('[MIO API] 401 Detectado. Renovando token...');
                this.token = null; // Limpa token inválido
                const authSuccess = await this.authenticate();
                if (authSuccess) {
                    return this.request<T>(config, false); // Tenta de novo sem loop
                }
            }

            const status = error.response ? error.response.status : 'Network Error';
            const msg = `[MIO API Error] ${config.method?.toUpperCase()} ${config.url}: ${status} - ${error.message}`;
            console.error(msg);
            this.lastError = msg;

            this.isConnected = false;
            return null;
        }
    }

    public async post<T>(url: string, data: any, config?: AxiosRequestConfig): Promise<T | null> {
        return this.request<T>({
            method: 'POST',
            url,
            data,
            ...config
        });
    }

    /** @deprecated MIO is read-only. Always throws. */
    public async put<T>(_url: string, _data?: any, _config?: AxiosRequestConfig): Promise<T | null> {
        const msg = `[MIO] Forbidden write blocked: PUT ${_url} — never overwrite MIO records or files.`;
        console.error(msg);
        throw new Error(msg);
    }

    // --- Endpoints de Integração ---

    // 1. Integrantes
    async getIntegrantes(): Promise<MIOIntegrante[]> {
        const result = await this.request<any>({
            method: 'POST',
            url: '/int-integrante-get',
            data: {}
        });
        let list = this.normalizeResponse<any>(result, 'integrante');

        // A API pode retornar em estrutura aninhada
        if (list.length === 0 && Array.isArray(result?.integrante)) {
            list = result.integrante;
        }

        return list.map(item => ({
            ...item,
            id: item.id ?? item.ID ?? item.integrante_id,
            cpf: item.cpf || item.cpf_numero || '',
            nome: item.nome || item.nome_completo || '',
            cargo: item.cargo || item.cargo_funcao || item.funcao || '',
            base: item.base || item.embarcacao || '',
            departamento: item.departamento || item.centro_custo || item.empresa || '',
            situacao: item.situacao || item.status || item.Status || item.situacao_integrante || '',
            data_admissao: item.data_admissao || item.admitido_em || item.admissao,
            data_demissao: item.data_demissao || item.demitido_em || item.desligado_em,
            matricula: item.matricula || item.Matrícula || item.matricula_numero,
        }));
    }

    // 2. Calendário Unificado
    // Atualizado para usar lógica mais robusta na obtenção
    async getCalendarEvents(userCpf?: string): Promise<MIOCalendarEvent[]> {
        const events: MIOCalendarEvent[] = [];

        // Embarques
        const embarques = await this.getEmbarques(userCpf);
        embarques.forEach(e => {
            // Mapear status para cores
            let color = '#4169E1'; // Programado (Azul)
            if (e.status === 'embarcado') color = '#0000CD'; // MediumBlue
            if (e.status === 'desembarcado') color = '#808080'; // Gray

            events.push({
                id: `mio_emb_${e.id}`,
                mio_id: e.id,
                cpf: e.cpf,
                type: 'embarque',
                title: `Embarque ${e.plataforma_unidade || ''}`,
                start: e.data_embarque,
                end: e.data_desembarque_prevista || e.data_desembarque_real,
                allDay: true,
                description: `${e.local_embarque || ''} -> ${e.plataforma_unidade || ''} (${e.status})`,
                color
            });
        });

        // Cursos e ASO (se tiver CPF, pq a API cobra CPF no endpoint GET /sms-...)
        // A doc diz: /sms-treinamento-registro-get/<cpf ou all>
        // Vou tentar passar 'all' se não tiver CPF
        const cpfParam = userCpf || 'all';

        // Treinamentos
        const treinamentos = await this.getTreinamentos(cpfParam);
        treinamentos.forEach(t => {
            if (!t.data_validade) return;

            // Verificar vencimento
            const validade = new Date(t.data_validade);
            const agora = new Date();
            const diasParaVencer = Math.ceil((validade.getTime() - agora.getTime()) / (1000 * 60 * 60 * 24));

            // Regra de negócio: Mostrar apenas se estiver vencido ou vencendo em 90 dias
            if (diasParaVencer > 90) return;

            let color = '#FFD700'; // Gold (A vencer)
            if (diasParaVencer <= 0) color = '#FF0000'; // Red (Vencido)
            else if (diasParaVencer <= 30) color = '#FF8C00'; // DarkOrange (Crítico)

            events.push({
                id: `mio_tr_${t.id}`,
                mio_id: t.id,
                cpf: t.cpf,
                type: 'curso',
                title: `Curso: ${t.nome_curso}`,
                start: t.data_validade, // Mostra na data de validade
                allDay: true,
                description: `Validade: ${t.data_validade} (Status: ${t.status})`,
                color
            });
        });

        return events;
    }

    // 3. Treinamentos (SMS)
    async getTreinamentos(cpfOrAll: string): Promise<MIOTreinamento[]> {
        const result = await this.request<any>({
            method: 'GET',
            url: `/sms-treinamento-registro-get/${cpfOrAll}`,
            timeout: cpfOrAll === 'all' ? 45000 : 25000,
        });
        const list = this.normalizeResponse<any>(result, 'fornecedor');
        return list.map(item => ({
            id: item.ID || item.id || '',
            cpf: item.CPF || item.cpf || '',
            nome: item.Nome || item.nome || '',
            matricula: item.Matrícula || item.matricula,
            centro_custo: item['Centro de Custo'] || item.centro_custo,
            uo_plataforma: item['UO/Plat.'] || item.uo_plataforma,
            funcao: item.Função || item.funcao,
            id_treinamento: item['ID Treinamento'] || item.id_treinamento,
            codigo_treinamento: item['Código Treinamento'] || item.codigo_treinamento,
            codigo_treinamento_externo: item['Código Treinamento Externo'] || item.codigo_treinamento_externo,
            nome_curso: item.Descrição || item.nome_curso || item.descricao || '',
            descricao: item.Descrição || item.descricao,
            area: item.Área || item.area,
            local: item.Local || item.local,
            instituicao: item['Local de Realização'] || item.instituicao,
            data_realizacao: item['Concluído Em'] || item.concluido_em || item.data_realizacao || '',
            data_validade: item['Vencimento Em'] || item.vencimento_em || item.data_validade,
            status: item.Status || item.status || 'n_a',
            carga_horaria: item['Carga Horária'] ? Math.round(Number(item['Carga Horária'])) : item.carga_horaria,
            validade_dias: item['Validade (Dias)'] ? Number(item['Validade (Dias)']) : item.validade_dias,
            bloqueio_embarque: item['Bloqueio Embarque'] || item.bloqueio_embarque,
            treinamento_ativo: item['Treinamento Ativo'] || item.treinamento_ativo,
            cadastrado_em: item['Cadastrado Em'] || item.cadastrado_em,
            cadastrado_por: item['Cadastrado Por'] || item.cadastrado_por,
            agendamento_inicio: item['Agendamento Início'] || item.agendamento_inicio,
            agendamento_fim: item['Agendamento Fim'] || item.agendamento_fim,
            concluido_em: item['Concluído Em'] || item.concluido_em,
            vencimento_em: item['Vencimento Em'] || item.vencimento_em,
            local_realizacao: item['Local de Realização'] || item.local_realizacao,
            numero_documento: item['Nº Documento'] || item.numero_documento,
            tipo_documento: item['Tipo de Documento'] || item.tipo_documento,
            observacoes: item.Observações || item.observacoes,
            contem_anexo: item['Contém Anexo?'] || item.contem_anexo,
            anexo_url: item['URL Anexo'] || item.anexo_url || item.url_anexo || item.arquivo_url || item.file_url,
        }));
    }

    /**
     * Exhaust every documented + guessed READ path for ASO.
     * Official insomnia: POST /sms-aso is INCLUSÃO (write) — never called.
     * GET/POST-with-filter candidates are probed; empty + status recorded as evidence.
     */
    async probeAsoReadPaths(cpf?: string): Promise<{
        hits: Array<{ path: string; method: string; status: number; count: number; sampleKeys: string[] }>;
        misses: Array<{ path: string; method: string; status: number | string; reason: string }>;
        records: Record<string, unknown>[];
    }> {
        const cpfPart = cpf ? cpf.replace(/\D/g, '') : 'all';
        const candidates: Array<{ method: 'GET' | 'POST'; url: string; data?: Record<string, unknown> }> = [
            { method: 'GET', url: '/sms-aso-get' },
            { method: 'GET', url: '/sms-aso-get/all' },
            { method: 'GET', url: `/sms-aso-get/${cpfPart}` },
            { method: 'GET', url: '/sms-aso-registro-get' },
            { method: 'GET', url: '/sms-aso-registro-get/all' },
            { method: 'GET', url: `/sms-aso-registro-get/${cpfPart}` },
            { method: 'GET', url: '/sms-aso' },
            { method: 'GET', url: '/sms-exames-get' },
            { method: 'GET', url: '/sms-exame-registro-get' },
            { method: 'GET', url: '/sms-exame-registro-get/all' },
            { method: 'GET', url: '/int-aso-get' },
            { method: 'GET', url: '/sms-atestado-get' },
            { method: 'GET', url: '/sms-saude-get' },
            { method: 'POST', url: '/sms-aso-get', data: cpf && cpfPart !== 'all' ? { cpf: cpfPart } : {} },
            { method: 'POST', url: '/sms-aso-registro-get', data: {} },
        ];

        const hits: Array<{ path: string; method: string; status: number; count: number; sampleKeys: string[] }> = [];
        const misses: Array<{ path: string; method: string; status: number | string; reason: string }> = [];
        const records: Record<string, unknown>[] = [];
        const seen = new Set<string>();

        for (const c of candidates) {
            try {
                if (!this.token) await this.authenticate();
                assertMioPullContext(`${c.method} ${c.url}`);
                if (isMioWritePath(c.method, c.url)) {
                    misses.push({ path: c.url, method: c.method, status: 'blocked', reason: 'write_path' });
                    continue;
                }
                console.log(`[MIO ASO probe] ${c.method} ${c.url}`);
                const response = await this.client.request({
                    method: c.method,
                    url: c.url,
                    data: c.data,
                    validateStatus: () => true,
                    timeout: 20000,
                });
                const status = response.status;
                if (status !== 200) {
                    misses.push({
                        path: c.url,
                        method: c.method,
                        status,
                        reason: typeof response.data === 'object'
                            ? JSON.stringify(response.data).slice(0, 180)
                            : String(response.data || '').slice(0, 180),
                    });
                    continue;
                }
                const list = this.normalizeResponse<Record<string, unknown>>(response.data, 'aso');
                const extra =
                    list.length > 0
                        ? list
                        : this.normalizeResponse<Record<string, unknown>>(response.data);
                hits.push({
                    path: c.url,
                    method: c.method,
                    status,
                    count: extra.length,
                    sampleKeys: extra[0] ? Object.keys(extra[0]).slice(0, 20) : [],
                });
                for (const row of extra) {
                    const key = JSON.stringify([row.id || row.ID, row.cpf || row.CPF, row.concluido_em || row['Concluído Em']]);
                    if (seen.has(key)) continue;
                    seen.add(key);
                    records.push(row);
                }
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                misses.push({ path: c.url, method: c.method, status: 'error', reason: msg.slice(0, 180) });
            }
        }

        this.lastAsoProbe = { hits, misses, count: records.length };
        return { hits, misses, records };
    }

    async getASOs(cpf?: string): Promise<MIOASO[]> {
        const probe = await this.probeAsoReadPaths(cpf);
        return probe.records.map((item) => {
            const tipoRaw = String(item.tipo_aso || item.tipo_exame || item.Tipo || '').toLowerCase();
            let tipo_exame: MIOASO['tipo_exame'] = 'periodico';
            if (tipoRaw.includes('admiss')) tipo_exame = 'admissional';
            else if (tipoRaw.includes('demiss')) tipo_exame = 'demissional';
            else if (tipoRaw.includes('retorno')) tipo_exame = 'retorno_trabalho';
            else if (tipoRaw.includes('mudanc') || tipoRaw.includes('funcao') || tipoRaw.includes('função')) {
                tipo_exame = 'mudanca_funcao';
            }
            const situacao = String(item.situacao || item.resultado || item.Resultado || '').toLowerCase();
            return {
                id: String(item.id ?? item.ID ?? ''),
                cpf: String(item.cpf || item.CPF || ''),
                tipo_exame,
                data_realizacao: String(item.concluido_em || item['Concluído Em'] || item.data_realizacao || ''),
                data_validade: String(item.vencimento_em || item['Vencimento Em'] || item.data_validade || ''),
                resultado: situacao.includes('inapt') ? 'inapto' : 'apto',
                medico: item.medico ? String(item.medico) : undefined,
                crm: item.crm ? String(item.crm) : undefined,
                observacoes: item.obs ? String(item.obs) : undefined,
                status: 'n_a',
                hiperlink_externo: item.hiperlink_externo || item.anexo_url || item.url,
            } as MIOASO;
        });
    }

    private mapLgpHistory(historyData: any[]): MIOEmbarque[] {
        return (historyData || []).map((raw: any, index: number) => {
            let status: 'programado' | 'embarcado' | 'desembarcado' | 'cancelado' = 'programado';
            if (raw['Desembarque Real']) status = 'desembarcado';
            else if (raw['Embarque Real']) status = 'embarcado';
            return {
                id: raw['Nº RTPE'] || raw['Matrícula'] || String(index),
                cpf: raw['CPF'] || '',
                nome: raw['Nome'] || '',
                funcao_cargo: raw['Função/Cargo'] || '',
                regime: raw['Regime'] || '',
                data_embarque: raw['Embarque Real'] || raw['Prev. de Emb.'] || '',
                data_desembarque_prevista: raw['Prev. Desemb.'] || raw['Prev. Desemb. RTPD'] || '',
                data_desembarque_real: raw['Desembarque Real'] || '',
                local_embarque: raw['Origem'] || '',
                plataforma_unidade: raw['Destino'] || '',
                destino: raw['Destino'] || '',
                origem: raw['Origem'] || '',
                status,
                rtpe_status: raw['RTPE Status'] || '',
                rtpd_status: raw['RTPD Status'] || '',
                qtd_dias: raw['Qtd. de Dias'] ? Number(raw['Qtd. de Dias']) : undefined,
                folga_inicio: raw['Folga Início'] || '',
                folga_fim: raw['Folga Fim'] || '',
                centro_custo_integrante: raw['Centro de Custo do Integrante'] || '',
                centro_custo_rtpe: raw['Centro de Custo da RTPE'] || '',
                nr_rtpe: raw['Nº RTPE'] || '',
                nr_rtpd: raw['Nº RTPD'] || '',
                nr_projeto: raw['Nº do Projeto'] || '',
            } as MIOEmbarque;
        });
    }

    async getEmbarques(cpf?: string): Promise<MIOEmbarque[]> {
        const raw = await this.getLGPReportsRaw(undefined, undefined, undefined, cpf);
        return this.mapLgpHistory(raw);
    }

    /**
     * LGP history with the widest period MIO accepts.
     * Tries 1990 → +5y first; on timeout/error, chunks 5-year windows and records the limit.
     */
    async getLGPReportsRaw(
        cnpj?: string,
        periodoInicio?: string,
        periodoFim?: string,
        cpf?: string
    ): Promise<any[]> {
        const agora = new Date();
        const maxInicio = periodoInicio || '1990-01-01';
        const maxFim = periodoFim || new Date(agora.getFullYear() + 5, 11, 31).toISOString().split('T')[0];
        const cnpjVal = cnpj || process.env.MIO_CNPJ;

        const fetchChunk = async (inicio: string, fim: string): Promise<any[] | null> => {
            const requestData: Record<string, unknown> = {
                tipo: 'embarques',
                periodo_inicio: inicio,
                periodo_fim: fim,
            };
            if (cnpjVal) requestData.cnpj = cnpjVal;
            if (cpf) requestData.cpf = cpf;
            const result = await this.request<any>({
                method: 'POST',
                url: '/lgp-reports',
                data: requestData,
                timeout: 90000,
            });
            if (!result) return null;
            return result.history || [];
        };

        if (!periodoInicio && !periodoFim) {
            const recentIni = `${agora.getFullYear() - 15}-01-01`;
            const recent = await fetchChunk(recentIni, maxFim);
            const merged: any[] = [];
            const seen = new Set<string>();
            const ingest = (part: any[] | null) => {
                if (!part) return;
                for (const row of part) {
                    const key = JSON.stringify([
                        row['CPF'],
                        row['Embarque Real'] || row['Prev. de Emb.'],
                        row['Nº RTPE'],
                        row['Destino'],
                    ]);
                    if (seen.has(key)) continue;
                    seen.add(key);
                    merged.push(row);
                }
            };
            ingest(recent);
            let chunks = 1;
            let apiLimit: string | undefined;
            if (!recent) {
                apiLimit = `15-year window ${recentIni}..${maxFim} returned null`;
            }

            for (let endYear = agora.getFullYear() - 16; endYear >= 1990; endYear -= 5) {
                const startYear = Math.max(endYear - 4, 1990);
                const ini = `${startYear}-01-01`;
                const fim = `${endYear}-12-31`;
                console.log(`[MIO pull] lgp-reports chunk ${ini}..${fim}`);
                const part = await fetchChunk(ini, fim);
                chunks++;
                if (!part) {
                    apiLimit = `chunk ${ini}..${fim} returned null (timeout or HTTP error) — older history may be capped`;
                    break;
                }
                ingest(part);
            }

            this.lastLgpRange = {
                inicio: '1990-01-01',
                fim: maxFim,
                chunks,
                apiLimit,
            };
            return merged;
        }

        const rows = (await fetchChunk(maxInicio, maxFim)) || [];
        this.lastLgpRange = { inicio: maxInicio, fim: maxFim, chunks: 1 };
        return rows;
    }

    async getAllTreinamentos(): Promise<MIOTreinamento[]> {
        const treinamentos = await this.getTreinamentos('all');
        if (treinamentos.length > 0) {
            console.log(`[MIO pull] treinamentos/all = ${treinamentos.length}`);
            return treinamentos;
        }
        console.warn('[MIO pull] GET /sms-treinamento-registro-get/all empty or timed out');
        return [];
    }

    async getTreinamentosForCpfs(cpfs: string[]): Promise<MIOTreinamento[]> {
        const merged: MIOTreinamento[] = [];
        const seen = new Set<string>();
        let i = 0;
        for (const raw of cpfs) {
            const cpf = raw.replace(/\D/g, '');
            if (cpf.length !== 11) continue;
            i++;
            if (i % 25 === 0) console.log(`[MIO pull] treinamentos per-CPF ${i}/${cpfs.length}`);
            const part = await this.getTreinamentos(cpf);
            for (const t of part) {
                const key = String(t.id || `${t.cpf}_${t.nome_curso}_${t.data_realizacao}`);
                if (seen.has(key)) continue;
                seen.add(key);
                merged.push(t);
            }
        }
        return merged;
    }

    async getAllEmbarques(periodoInicio?: string, periodoFim?: string): Promise<MIOEmbarque[]> {
        const raw = await this.getLGPReportsRaw(undefined, periodoInicio, periodoFim);
        return this.mapLgpHistory(raw);
    }

    async getFilteredList(
        method: 'GET' | 'POST',
        url: string,
        data: Record<string, unknown> = {},
        key?: string
    ): Promise<any[]> {
        const result = await this.request<any>({ method, url, data });
        return this.normalizeResponse<any>(result, key);
    }

    async getFerias(): Promise<any[]> {
        return this.getFilteredList('GET', '/int-integrantes-ferias-get', {}, 'ferias');
    }

    async getBeneficios(): Promise<any[]> {
        return this.getFilteredList('GET', '/int-integrantes-beneficio-get', {}, 'beneficio');
    }

    async getDependentes(): Promise<any[]> {
        return this.getFilteredList('GET', '/int-integrantes-dependente-get', {}, 'dependente');
    }

    async getSispat(): Promise<any[]> {
        return this.getFilteredList('GET', '/lgp-sispat-get', {}, 'sispat');
    }

    async getRtpeTurmas(): Promise<any[]> {
        return this.getFilteredList('POST', '/lgp-rtpe-turma-get', {}, 'data');
    }

    async getTimesheet(dtInicio: string, dtFim: string): Promise<any[]> {
        return this.getFilteredList('POST', '/int-timesheet-get', { dt_inicio: dtInicio, dt_fim: dtFim }, 'timesheet');
    }

    async getTreinamentoTurmas(): Promise<any[]> {
        return this.getFilteredList('GET', '/sms-treinamento-turma-get/all', {}, 'turma');
    }

    async getAfastamentos(): Promise<any[]> {
        const result = await this.request<any>({
            method: 'GET',
            url: '/sms-afastamento-get',
        });
        return this.normalizeResponse<any>(result, 'afastamento');
    }

    /**
     * Download attachment bytes from MIO (GET only). Never uploads back.
     * Tries known pull endpoints; returns null if MIO has no binary export.
     */
    async downloadTreinamentoAnexo(treinamentoId: string): Promise<{ buffer: Buffer; contentType: string } | null> {
        const id = encodeURIComponent(String(treinamentoId));
        const candidates = [
            `/sms-treinamento-registro-anexo/${id}`,
            `/sms-treinamento-anexo-get/${id}`,
            `/sms-treinamento-anexo/${id}`,
            `/sms-treinamento-registro-get/${id}/anexo`,
            `/sms-aso-anexo/${id}`,
            `/sms-aso-anexo-get/${id}`,
        ];
        for (const url of candidates) {
            const downloaded = await this.downloadBinary(url);
            if (downloaded && downloaded.buffer.length > 0) return downloaded;
        }
        return null;
    }

    async downloadBinary(url: string): Promise<{ buffer: Buffer; contentType: string } | null> {
        assertMioPullContext(`GET binary ${url}`);
        if (isMioWritePath('GET', url) || !isMioPullPath('GET', url)) {
            console.warn(`[MIO pull] binary skip non-allowlisted GET ${url}`);
            return null;
        }
        if (!this.token) {
            await this.authenticate();
        }
        console.log(`[MIO pull] GET binary ${url}`);
        try {
            const response = await this.client.request({
                method: 'GET',
                url,
                responseType: 'arraybuffer',
                validateStatus: () => true,
            });
            if (response.status !== 200 || !response.data) return null;
            const contentType = String(response.headers['content-type'] || 'application/octet-stream');
            if (contentType.includes('application/json')) return null;
            const buffer = Buffer.from(response.data);
            if (buffer.length < 32) return null;
            return { buffer, contentType };
        } catch (error: any) {
            console.warn(`[MIO pull] binary miss ${url}: ${error.message}`);
            return null;
        }
    }

    async downloadFromHttpUrl(fileUrl: string): Promise<{ buffer: Buffer; contentType: string } | null> {
        assertMioPullContext(`GET url ${fileUrl}`);
        if (!this.token) {
            await this.authenticate();
        }
        console.log(`[MIO pull] GET url ${fileUrl}`);
        try {
            const response = await axios.get(fileUrl, {
                responseType: 'arraybuffer',
                timeout: MIO_CONFIG.timeout,
                headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
                validateStatus: () => true,
            });
            if (response.status !== 200 || !response.data) return null;
            const contentType = String(response.headers['content-type'] || 'application/octet-stream');
            return { buffer: Buffer.from(response.data), contentType };
        } catch (error: any) {
            console.warn(`[MIO pull] url miss: ${error.message}`);
            return null;
        }
    }

    // Testar conexão (para o Admin Panel)
    async testConnection(): Promise<{ success: boolean; message: string }> {
        const auth = await this.authenticate();
        if (auth) {
            return { success: true, message: 'Autenticado com sucesso na API MIO v1.' };
        }
        return { success: false, message: this.lastError || 'Falha desconhecida.' };
    }

    private normalizeResponse<T>(data: any, key?: string): T[] {
        if (!data) return [];
        if (Array.isArray(data)) return data;
        if (key && Array.isArray(data[key])) return data[key];
        if (data.data && Array.isArray(data.data)) return data.data;
        if (data.results && Array.isArray(data.results)) return data.results;
        if (data.integrantes && Array.isArray(data.integrantes)) return data.integrantes;
        return [];
    }
}

export const mioClient = MioClient.getInstance();
