export interface GTCentroCusto {
    id: string;
    nome: string;
    codigo?: string;
    ativo: boolean;
    created_at: string;
    updated_at: string;
}

export interface GTEmpresa {
    id: string;
    nome: string;
    cnpj?: string;
    centro_custo_id?: string;
    ativo: boolean;
    created_at: string;
    updated_at: string;
}

export interface GTEmbarcacao {
    id: string;
    nome: string;
    imo?: string;
    empresa_id?: string;
    tipo?: string;
    capacidade?: number;
    ativo: boolean;
    created_at: string;
    updated_at: string;
}

export interface GTCargo {
    id: string;
    nome: string;
    descricao?: string;
    nivel: number;
    ordem_exibicao: number;
    ativo: boolean;
    created_at: string;
    updated_at: string;
}

export type StatusEmbarque = 'embarcado' | 'standby' | 'folga' | 'desembarcado' | 'afastado' | 'ferias' | 'treinamento';
export type OrigemColaborador = 'local' | 'mio' | 'importado' | 'manual';

export interface GTColaborador {
    id: string;
    user_id?: string;
    nome_completo: string;
    cpf?: string;
    rg?: string;
    data_nascimento?: string;
    email?: string;
    telefone?: string;
    nacionalidade: string;
    naturalidade?: string;
    nome_mae?: string;
    nome_pai?: string;
    estado_civil?: string;
    dados_bancarios?: any;
    centro_custo_id?: string;
    empresa_id?: string;
    embarcacao_atual_id?: string;
    cargo_id?: string;
    data_admissao?: string;
    data_demissao?: string;
    motivo_demissao?: string;
    matricula?: string;
    status_embarque: StatusEmbarque;
    standby: boolean;
    regime_trabalho?: string | null;
    escala_embarque?: number | string | null;
    escala_folga?: number | string | null;
    data_ultimo_embarque?: string;
    data_ultimo_desembarque?: string;
    data_proximo_embarque?: string;
    origem: OrigemColaborador;
    mio_id?: string;
    /** Marcado INATIVO pelo sync quando o integrante desaparece do MIO (nunca deletar). */
    ativo?: boolean;
    ultimo_sync_mio?: string;
    mio_data?: any;
    foto_url?: string;
    deleted_at?: string;
    created_at: string;
    updated_at: string;
    // Joined fields
    centro_custo_nome?: string;
    empresa_nome?: string;
    embarcacao_nome?: string;
    cargo_nome?: string;
    cargo_nivel?: number;
    avatar?: string;
    first_name?: string;
    last_name?: string;
    user_email?: string;
    qtd_docs_vencidos?: number;
    qtd_docs_vencendo?: number;
    qtd_docs_validos?: number;
    proximos_vencimentos?: any[];
    ultimo_embarque?: any;
}

export type TipoDocumento = 'aso' | 'treinamento' | 'passaporte' | 'cnh' | 'certidao_nascimento'
    | 'certidao_casamento' | 'reservista' | 'titulo_eleitor' | 'ctps'
    | 'documento_pessoal' | 'certificado' | 'contrato' | 'laudo' | 'outro';

export type StatusValidacao = 'valido' | 'vencendo' | 'vencido' | 'pendente' | 'reprovado' | 'cancelado';
export type OCRStatus = 'pendente' | 'processando' | 'concluido' | 'erro' | 'nao_aplicavel';
export type StatusRevisao = 'nao_necessita' | 'pendente_revisao' | 'aprovado' | 'rejeitado';

export interface GTDocumento {
    id: string;
    colaborador_id: string;
    user_id?: string;
    tipo_documento: TipoDocumento;
    subtipo?: string;
    titulo: string;
    descricao?: string;
    numero_documento?: string;
    orgao_emissor?: string;
    data_emissao?: string;
    data_validade?: string;
    arquivo_url?: string;
    arquivo_path?: string;
    arquivo_tamanho_bytes?: number;
    arquivo_tipo?: string;
    ocr_status: OCRStatus;
    ocr_texto?: string;
    ocr_dados_extraidos?: any;
    ocr_data?: string;
    ocr_erro?: string;
    status_validacao: StatusValidacao;
    notificado_vencimento: boolean;
    origem: string;
    status_revisao: StatusRevisao;
    revisado_por?: string;
    revisado_em?: string;
    comentario_revisao?: string;
    numero_rastreio?: string;
    arquivo_hash?: string;
    identity_match?: AsoIdentityMatch;
    deleted_at?: string;
    created_at: string;
    updated_at: string;
}

export type TipoExameASO = 'admissional' | 'periodico' | 'demissional' | 'retorno' | 'mudanca_funcao';
export type ResultadoASO = 'apto' | 'inapto' | 'apto_condicional';

export type AsoIdentityMatch = 'match' | 'reassigned' | 'quarantine' | 'unknown' | 'frozen';

export interface GTDocumentoASO {
    id: string;
    documento_id: string;
    colaborador_id?: string;
    tipo_exame: TipoExameASO;
    resultado?: ResultadoASO;
    data_realizacao?: string;
    medico_nome?: string;
    medico_crm?: string;
    cnpj_clinica?: string;
    nome_clinica?: string;
    exames_realizados?: any[];
    esocial_status: string;
    esocial_evento_id?: string;
    esocial_protocolo?: string;
    esocial_numero_recibo?: string;
    esocial_data_envio?: string;
    /** Digits-only CPF from OCR (identity gate source of truth before send) */
    cpf_documento?: string | null;
    identity_match?: AsoIdentityMatch | null;
    created_at: string;
    updated_at: string;
}

export interface GTTreinamento {
    id: string;
    documento_id: string;
    colaborador_id?: string;
    nome_curso: string;
    instituicao?: string;
    carga_horaria?: number;
    tipo_curso?: string;
    aproveitamento?: number;
    created_at: string;
}

/** Legacy embarque tipos + Man Schedule codes (fi/dba/stb/offc) + custom. */
export type TipoEmbarque =
  | 'normal'
  | 'dobra'
  | 'folga_indenizada'
  | 'standby'
  | 'substituicao'
  | 'treinamento'
  | 'fi'
  | 'dba'
  | 'stb'
  | 'offc'
  | (string & {});

export interface GTTipoEventoEscala {
  id: string;
  codigo: string;
  display_code: string;
  label: string;
  bg_color: string;
  text_color: string;
  ordem: number;
  ativo: boolean;
  is_system: boolean;
  maps_to_db_tipo?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface GTHistoricoEmbarque {
    id: string;
    colaborador_id: string;
    embarcacao_id?: string;
    tipo: TipoEmbarque;
    data_embarque: string;
    data_desembarque?: string;
    data_prevista_desembarque?: string;
    local_embarque?: string;
    local_desembarque?: string;
    voo_ida?: string;
    voo_volta?: string;
    observacoes?: string;
    substituindo_id?: string;
    origem: string;
    deleted_at?: string;
    created_at: string;
}

export interface GTSubstituicao {
    id: string;
    substituto_id: string;
    substituido_id: string;
    embarque_id?: string;
    periodo_inicio: string;
    periodo_fim?: string;
    cargo_id?: string;
    created_at: string;
}

export interface GTSugestaoBackResult {
    colaborador: {
        id: string;
        nome_completo: string;
        cpf?: string;
        cargo_nome?: string;
        empresa_nome?: string;
        embarcacao_nome?: string;
        status_embarque: string;
        standby: boolean;
        avatar?: string | null;
    };
    pontuacao: number;
    pontuacao_maxima: number;
    justificativas: string[];
}

export interface GTNotificacaoLog {
    id: string;
    documento_id?: string;
    colaborador_id?: string;
    tipo_notificacao: string;
    canal: 'inapp' | 'email' | 'push';
    titulo: string;
    mensagem?: string;
    destinatario_id?: string;
    data_envio: string;
    sucesso: boolean;
    erro?: string;
}

export interface GTDashboardResumo {
    total_colaboradores: number;
    total_embarcados: number;
    total_disponiveis: number;
    total_docs_vencidos: number;
    total_docs_vencendo: number;
    total_docs_vencidos_historico?: number;
    asos_pendentes_revisao: number;
}

export interface GTConfigGeral {
    modulo_ativo: boolean;
    nome_personalizado?: string | null;
}

export interface GTConfigMIO {
    habilitado: boolean;
    escrita_habilitada: boolean;
    auto_sync: boolean;
    intervalo_minutos: number;
}

export interface GTConfigPoliWeb {
    username: string;
    password: string;
    habilitado: boolean;
}

export interface GTConfigAlgoritmoBack {
    peso_mesmo_centro_custo: number;
    peso_mesma_empresa: number;
    peso_mesma_embarcacao: number;
    peso_mesmo_cargo: number;
    peso_standby: number;
    peso_substituiu_antes: number;
    peso_documentos_validos: number;
    peso_folga_compativel: number;
    peso_senioridade_similar: number;
    limite_resultados: number;
    sugestao_automatica: boolean;
}

export type GTTipoRescisao =
    | 'sem_justa_causa'
    | 'pedido_demissao'
    | 'justa_causa'
    | 'acordo_mutuo'
    | 'termino_contrato'
    | 'rescisao_indireta';

export type GTAvisoPrevioTipo = 'indenizado' | 'trabalhado' | 'dispensado' | 'nao_aplicavel';

export type GTStatusDesligamento = 'iniciado' | 'calculado' | 'aprovado' | 'pago' | 'cancelado';

export interface GTVerbaRescisaoPrevista {
    code: string;
    name: string;
    observation: string;
}

export interface GTDesligamento {
    id: string;
    colaborador_id: string;
    tipo_rescisao: GTTipoRescisao;
    data_desligamento: string;
    motivo: string | null;
    mtv_deslig: string;
    aviso_previo_tipo: GTAvisoPrevioTipo;
    aviso_previo_dias: number | null;
    data_ultimo_dia_trabalhado: string | null;
    prazo_pagamento: string | null;
    status: GTStatusDesligamento;
    payroll_sheet_id: string | null;
    verbas_previstas: GTVerbaRescisaoPrevista[];
    observacoes: string | null;
    criado_por: string | null;
    created_at: string;
    updated_at: string;
}

export interface GTDesligamentoEtapas {
    gt: { ok: boolean; warning?: string };
    payroll: { ok: boolean; skipped: boolean; sheet_id?: string; warning?: string };
    esocial: { ok: boolean; skipped?: boolean; evento_id?: string; warning?: string };
}

export interface GTDesligamentoPayload {
    tipo_rescisao: GTTipoRescisao;
    data_desligamento: string;
    motivo?: string;
    mtv_deslig?: string;
    aviso_previo_tipo?: GTAvisoPrevioTipo;
    aviso_previo_dias?: number;
    data_ultimo_dia_trabalhado?: string;
    observacoes?: string;
}
