// Tipos para o sistema de relatórios PDF

export interface ConfiguracaoRelatorio {
  id: string;
  nome: string;
  descricao: string;
  tipo: 'avaliacao' | 'desempenho' | 'departamento' | 'funcionario' | 'personalizado';
  template: string;
  parametros: ParametroRelatorio[];
  graficos: ConfiguracaoGrafico[];
  tabelas: ConfiguracaoTabela[];
  cabecalho: ConfiguracaoCabecalho;
  rodape: ConfiguracaoRodape;
  estilo: EstiloRelatorio;
  ativo: boolean;
  criado_por: string;
  criado_em: string;
  atualizado_em: string;
}

export interface ParametroRelatorio {
  nome: string;
  tipo: 'texto' | 'numero' | 'data' | 'select' | 'multiselect' | 'boolean';
  obrigatorio: boolean;
  valor_padrao?: any;
  opcoes?: { label: string; value: any }[];
  validacao?: {
    min?: number;
    max?: number;
    regex?: string;
    mensagem?: string;
  };
}

export interface ConfiguracaoGrafico {
  id: string;
  nome: string;
  tipo: 'line' | 'bar' | 'pie' | 'doughnut' | 'radar' | 'scatter';
  posicao: { x: number; y: number; width: number; height: number };
  dados_fonte: string; // Query ou endpoint
  configuracao: {
    titulo?: string;
    cores?: string[];
    legenda?: boolean;
    eixos?: {
      x?: { titulo?: string; formato?: string };
      y?: { titulo?: string; formato?: string };
    };
    responsive?: boolean;
  };
}

export interface ConfiguracaoTabela {
  id: string;
  nome: string;
  posicao: { x: number; y: number; width: number; height: number };
  dados_fonte: string;
  colunas: ColunaTabela[];
  estilo: {
    cabecalho?: EstiloTexto;
    linhas?: EstiloTexto;
    bordas?: boolean;
    zebra?: boolean;
  };
  paginacao?: {
    linhas_por_pagina: number;
    mostrar_total: boolean;
  };
}

export interface ColunaTabela {
  campo: string;
  titulo: string;
  largura?: number;
  alinhamento?: 'left' | 'center' | 'right';
  formato?: 'texto' | 'numero' | 'moeda' | 'porcentagem' | 'data';
  visivel: boolean;
  ordenavel?: boolean;
}

export interface ConfiguracaoCabecalho {
  mostrar_logo: boolean;
  logo_url?: string;
  titulo: string;
  subtitulo?: string;
  informacoes_empresa: boolean;
  data_geracao: boolean;
  estilo: EstiloTexto;
}

export interface ConfiguracaoRodape {
  mostrar_numeracao: boolean;
  texto_personalizado?: string;
  informacoes_sistema: boolean;
  estilo: EstiloTexto;
}

export interface EstiloRelatorio {
  fonte_principal: string;
  tamanho_fonte: number;
  cores: {
    primaria: string;
    secundaria: string;
    texto: string;
    fundo: string;
  };
  margens: {
    superior: number;
    inferior: number;
    esquerda: number;
    direita: number;
  };
  espacamento: {
    entre_secoes: number;
    entre_paragrafos: number;
  };
}

export interface EstiloTexto {
  fonte?: string;
  tamanho?: number;
  cor?: string;
  negrito?: boolean;
  italico?: boolean;
  sublinhado?: boolean;
  alinhamento?: 'left' | 'center' | 'right' | 'justify';
}

export interface SolicitacaoRelatorio {
  id: string;
  configuracao_id: string;
  parametros: { [key: string]: any };
  solicitado_por: string;
  solicitado_em: string;
  status: 'pendente' | 'processando' | 'concluido' | 'erro';
  progresso?: number;
  arquivo_url?: string;
  erro_mensagem?: string;
  processado_em?: string;
  tamanho_arquivo?: number;
  paginas?: number;
}

export interface TemplateRelatorio {
  id: string;
  nome: string;
  categoria: string;
  descricao: string;
  preview_url?: string;
  configuracao: ConfiguracaoRelatorio;
  tags: string[];
  publico: boolean;
  downloads: number;
  avaliacao: number;
  criado_por: string;
  criado_em: string;
}

export interface DadosRelatorio {
  titulo: string;
  subtitulo?: string;
  periodo: {
    inicio: string;
    fim: string;
  };
  filtros_aplicados: { [key: string]: any };
  dados_principais: any[];
  metricas: {
    [key: string]: {
      valor: number;
      formato: string;
      comparacao?: {
        valor_anterior: number;
        variacao: number;
        periodo_anterior: string;
      };
    };
  };
  graficos: {
    [key: string]: {
      tipo: string;
      dados: any;
      configuracao: any;
    };
  };
  tabelas: {
    [key: string]: {
      colunas: string[];
      linhas: any[][];
      totais?: any[];
    };
  };
  observacoes?: string[];
  recomendacoes?: string[];
  anexos?: {
    nome: string;
    url: string;
    tipo: string;
  }[];
}

export interface FiltroRelatorio {
  periodo_inicio: string;
  periodo_fim: string;
  departamentos: string[];
  cargos: string[];
  funcionarios: string[];
  tipos_avaliacao: string[];
  status: string[];
  incluir_graficos: boolean;
  incluir_detalhes: boolean;
  formato_saida: 'pdf' | 'excel' | 'word';
  orientacao: 'portrait' | 'landscape';
  qualidade: 'baixa' | 'media' | 'alta';
}

export interface ResultadoGeracao {
  sucesso: boolean;
  arquivo_url?: string;
  nome_arquivo?: string;
  tamanho_arquivo?: number;
  paginas?: number;
  tempo_processamento?: number;
  erro?: string;
  detalhes?: {
    graficos_gerados: number;
    tabelas_geradas: number;
    registros_processados: number;
  };
}

export interface HistoricoRelatorio {
  id: string;
  configuracao_nome: string;
  parametros_resumo: string;
  arquivo_url: string;
  tamanho_arquivo: number;
  paginas: number;
  gerado_por: string;
  gerado_em: string;
  downloads: number;
  ultimo_download?: string;
  status: 'ativo' | 'arquivado' | 'expirado';
  expira_em?: string;
}

// Tipos para componentes específicos
export interface PropriedadesGeradorPDF {
  configuracao: ConfiguracaoRelatorio;
  dados: DadosRelatorio;
  filtros: FiltroRelatorio;
  onProgresso?: (progresso: number) => void;
  onConcluido?: (resultado: ResultadoGeracao) => void;
  onErro?: (erro: string) => void;
}

export interface PropriedadesEditorTemplate {
  template?: TemplateRelatorio;
  onSalvar: (template: TemplateRelatorio) => void;
  onCancelar: () => void;
  modo: 'criar' | 'editar' | 'visualizar';
}

export interface PropriedadesVisualizadorRelatorio {
  relatorio: SolicitacaoRelatorio;
  mostrar_controles: boolean;
  altura?: string;
  onDownload?: () => void;
  onCompartilhar?: () => void;
}

export interface ConfiguracaoExportacao {
  formato: 'pdf' | 'excel' | 'word' | 'powerpoint';
  qualidade: 'baixa' | 'media' | 'alta';
  incluir_graficos: boolean;
  incluir_dados_brutos: boolean;
  proteger_arquivo: boolean;
  senha?: string;
  marca_dagua?: {
    texto: string;
    opacidade: number;
    posicao: 'centro' | 'diagonal' | 'rodape';
  };
}
