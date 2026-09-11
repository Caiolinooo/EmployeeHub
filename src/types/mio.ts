export interface MIOConfig {
    baseUrl: string;
    auth: {
        username?: string;
        email?: string;
        password?: string;
        token?: string;
    };
}

// Resposta padrão da API
export interface MIOResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

// --------------------------------------------------------
// Módulo Integrantes (INT)
// --------------------------------------------------------

export interface MIOIntegrante {
    id: string | number;
    cpf: string;
    nome: string;
    email?: string;
    telefone?: string;
    celular?: string;
    data_nascimento?: string;
    sexo?: string;
    estado_civil?: string;
    nome_pai?: string;
    nome_mae?: string;

    // Dados Profissionais
    matricula?: string;
    cargo?: string;
    funcao?: string;
    setor?: string;
    departamento?: string;
    data_admissao?: string;
    data_demissao?: string;
    situacao?: string; // Ativo, Afastado, etc.
    regime_trabalho?: string; // Offshore, Onshore
    base?: string;

    // Endereço
    endereco?: {
        logradouro?: string;
        numero?: string;
        complemento?: string;
        bairro?: string;
        cidade?: string;
        uf?: string;
        cep?: string;
    };

    // Dados Bancários
    dados_bancarios?: {
        banco?: string;
        agencia?: string;
        conta?: string;
        tipo_conta?: string;
    };

    // Metadados
    created_at?: string;
    updated_at?: string;
}

// --------------------------------------------------------
// Módulo SMS (Saúde, Meio Ambiente e Segurança)
// --------------------------------------------------------

export interface MIOTreinamento {
    id: string | number;
    cpf: string;
    nome: string;
    matricula?: string;
    centro_custo?: string;
    uo_plataforma?: string;
    funcao?: string;
    id_treinamento?: string;
    codigo_treinamento?: string;
    codigo_treinamento_externo?: string;
    nome_curso: string;
    descricao?: string;
    area?: string;
    local?: string;
    instituicao?: string;
    data_realizacao: string;
    data_validade?: string;
    status: 'valido' | 'vencido' | 'a_vencer' | 'n_a' | string;
    carga_horaria?: number;
    validade_dias?: number;
    bloqueio_embarque?: string;
    treinamento_ativo?: string;
    cadastrado_em?: string;
    cadastrado_por?: string;
    agendamento_inicio?: string;
    agendamento_fim?: string;
    concluido_em?: string;
    vencimento_em?: string;
    local_realizacao?: string;
    numero_documento?: string;
    tipo_documento?: string;
    observacoes?: string;
    contem_anexo?: string;
    anexo_url?: string;
    hiperlink_externo?: string;
}

export interface MIOASO {
    id: string | number;
    cpf: string;
    tipo_exame: 'admissional' | 'periodico' | 'demissional' | 'retorno_trabalho' | 'mudanca_funcao';
    data_realizacao: string;
    data_validade: string;
    resultado: 'apto' | 'inapto';
    medico?: string;
    crm?: string;
    observacoes?: string;
    status: 'valido' | 'vencido' | 'a_vencer' | 'n_a' | string;
    hiperlink_externo?: unknown;
}

export interface MIOEmbarque {
    id: string | number;
    cpf: string;
    nome?: string;
    funcao_cargo?: string;
    regime?: string;
    data_embarque: string;
    data_desembarque_prevista?: string;
    data_desembarque_real?: string;
    local_embarque?: string;
    plataforma_unidade?: string;
    destino?: string;
    origem?: string;
    status: 'programado' | 'embarcado' | 'desembarcado' | 'cancelado';
    voo_ida?: string;
    voo_volta?: string;
    rtpe_status?: string;
    rtpd_status?: string;
    qtd_dias?: number;
    folga_inicio?: string;
    folga_fim?: string;
    centro_custo_integrante?: string;
    centro_custo_rtpe?: string;
    nr_rtpe?: string;
    nr_rtpd?: string;
    nr_projeto?: string;
}

// --------------------------------------------------------
// Calendário Unificado MIO
// --------------------------------------------------------

export interface MIOCalendarEvent {
    id: string; // ID único gerado (ex: `mio_emb_${id}`)
    mio_id: string | number;
    type: 'embarque' | 'curso' | 'aso' | 'ferias' | 'folga';
    title: string;
    start: string; // ISO Date
    end?: string;
    allDay?: boolean;
    status?: string;
    description?: string;
    color?: string; // Para UI
    cpf: string;
}
