export interface ESocialEventoCatalogo {
    id: string;
    codigo_evento: string;
    nome: string;
    descricao?: string;
    grupo: 'cadastramento' | 'contratual' | 'tabela' | 'nao_periodico' | 'periodico';
    versao_leiaute: string;
    prazo_envio_dias?: number;
    ativo: boolean;
    created_at: string;
    updated_at: string;
}

export type ESocialEventoStatus = 'rascunho' | 'pendente_revisao' | 'revisao_aprovado' | 'revisao_rejeitado'
    | 'fila_envio' | 'enviando' | 'enviado' | 'processado' | 'erro' | 'devolvido';

export interface ESocialEvento {
    id: string;
    evento_codigo: string;
    cpf_trabalhador?: string;
    cnpj_empregador?: string;
    matricula?: string;
    dados_evento: any;
    xml_gerado?: string;
    modulo_origem: string;
    entidade_origem_id?: string;
    entidade_origem_tipo?: string;
    status: ESocialEventoStatus;
    revisado_por?: string;
    revisado_em?: string;
    comentario_revisao?: string;
    protocolo_envio?: string;
    numero_recibo?: string;
    data_envio?: string;
    data_processamento?: string;
    retorno_completo?: any;
    erros_processamento?: any;
    tentativas_envio: number;
    ultimo_erro?: string;
    created_at: string;
    updated_at: string;
    // Joined
    evento_nome?: string;
    evento_grupo?: string;
    colaborador_nome?: string;
    colaborador_cargo?: string;
    colaborador_matricula?: string;
    colaborador_foto?: string;
}

export interface ESocialCertificado {
    id: string;
    nome: string;
    arquivo_path: string;
    senha_criptografada?: string;
    emissor?: string;
    valido_ate?: string;
    status: 'valido' | 'expirado' | 'revogado';
    ativo: boolean;
    created_at: string;
    updated_at: string;
}

export interface ESocialConfigGeral {
    ambiente: 'homologacao' | 'producao';
    autonomia_envio: boolean;
    consultar_automatico: boolean;
}

export interface ESocialConfigWS {
    url_homologacao: string;
    url_producao: string;
    timeout_segundos: number;
    tentativas_maximas: number;
}

export interface ESocialEnvioLog {
    id: string;
    evento_id?: string;
    acao: string;
    request_body?: string;
    response_body?: string;
    status_code?: number;
    sucesso?: boolean;
    mensagem_erro?: string;
    created_at: string;
}

export interface ESocialDashboardResumo {
    total_eventos: number;
    pendentes_revisao: number;
    fila_envio: number;
    enviados: number;
    processados: number;
    com_erro: number;
}

export interface ESocialPrepararEventoInput {
    evento_codigo: string;
    dados_evento: any;
    modulo_origem?: string;
    entidade_origem_id?: string;
    entidade_origem_tipo?: string;
}

export interface ESocialRevisaoInput {
    aprovado: boolean;
    comentario?: string;
}

export interface ESocialEnvioResult {
    sucesso: boolean;
    protocolo?: string;
    recibo?: string;
    status?: string;
}
