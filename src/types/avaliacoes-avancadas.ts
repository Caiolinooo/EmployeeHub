// Tipos para o Sistema de Avaliações Avançado

export interface AvaliacaoMetrica {
  id: string;
  nome: string;
  descricao: string;
  tipo: 'kpi' | 'tendencia' | 'comparacao' | 'distribuicao';
  formula: string;
  unidade: string;
  meta?: number;
  cor: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface KPIAvaliacao {
  id: string;
  nome: string;
  valor: number;
  meta: number;
  unidade: string;
  variacao: number; // percentual de variação
  tendencia: 'crescente' | 'decrescente' | 'estavel';
  periodo: string;
  cor: string;
  descricao: string;
}

export interface MetricaPerformance {
  funcionario_id: string;
  funcionario_nome: string;
  cargo: string;
  departamento: string;
  media_pontuacao: number;
  total_avaliacoes: number;
  avaliacoes_concluidas: number;
  avaliacoes_pendentes: number;
  tendencia_performance: 'melhorando' | 'piorando' | 'estavel';
  ultima_avaliacao: string;
  proxima_avaliacao: string;
}

export interface AnaliseComparativa {
  periodo: string;
  departamentos: {
    nome: string;
    media_pontuacao: number;
    total_funcionarios: number;
    avaliacoes_concluidas: number;
  }[];
  cargos: {
    nome: string;
    media_pontuacao: number;
    total_funcionarios: number;
    avaliacoes_concluidas: number;
  }[];
  criterios: {
    nome: string;
    media_pontuacao: number;
    peso: number;
  }[];
}

export interface TendenciaAvaliacao {
  periodo: string;
  data: string;
  media_pontuacao: number;
  total_avaliacoes: number;
  avaliacoes_concluidas: number;
  satisfacao_media: number;
}

export interface RelatorioAvancado {
  id: string;
  titulo: string;
  descricao: string;
  tipo: 'executivo' | 'departamental' | 'individual' | 'comparativo';
  parametros: {
    periodo_inicio: string;
    periodo_fim: string;
    departamentos?: string[];
    cargos?: string[];
    funcionarios?: string[];
    metricas?: string[];
  };
  dados: any;
  created_at: string;
  created_by: string;
}

export interface ConfiguracaoMetrica {
  id: string;
  nome: string;
  ativo: boolean;
  visivel_dashboard: boolean;
  ordem: number;
  configuracao: {
    cor: string;
    formato: string;
    decimais: number;
    prefixo?: string;
    sufixo?: string;
  };
}

export interface AlertaPerformance {
  id: string;
  tipo: 'meta_nao_atingida' | 'queda_performance' | 'avaliacao_pendente' | 'prazo_vencido';
  titulo: string;
  descricao: string;
  severidade: 'baixa' | 'media' | 'alta' | 'critica';
  funcionario_id?: string;
  departamento?: string;
  data_criacao: string;
  data_resolucao?: string;
  resolvido: boolean;
  acao_sugerida: string;
}

export interface DashboardConfig {
  id: string;
  usuario_id: string;
  layout: {
    kpis: string[];
    graficos: {
      id: string;
      tipo: 'linha' | 'barra' | 'pizza' | 'area' | 'radar';
      posicao: { x: number; y: number; w: number; h: number };
      configuracao: any;
    }[];
    filtros: {
      periodo: string;
      departamentos: string[];
      cargos: string[];
    };
  };
  created_at: string;
  updated_at: string;
}

export interface ExportacaoRelatorio {
  formato: 'pdf' | 'excel' | 'csv';
  incluir_graficos: boolean;
  incluir_dados_brutos: boolean;
  template?: string;
  configuracao: {
    orientacao?: 'portrait' | 'landscape';
    tamanho_papel?: 'A4' | 'A3' | 'Letter';
    incluir_cabecalho: boolean;
    incluir_rodape: boolean;
    marca_dagua?: string;
  };
}

// Tipos para gráficos Chart.js
export interface ChartConfig {
  type: 'line' | 'bar' | 'pie' | 'doughnut' | 'radar' | 'polarArea';
  data: {
    labels: string[];
    datasets: {
      label: string;
      data: number[];
      backgroundColor?: string | string[];
      borderColor?: string | string[];
      borderWidth?: number;
      fill?: boolean;
    }[];
  };
  options: {
    responsive: boolean;
    maintainAspectRatio: boolean;
    plugins?: {
      legend?: {
        display: boolean;
        position?: 'top' | 'bottom' | 'left' | 'right';
      };
      title?: {
        display: boolean;
        text: string;
      };
      tooltip?: {
        enabled: boolean;
        callbacks?: any;
      };
    };
    scales?: {
      x?: {
        display: boolean;
        title?: {
          display: boolean;
          text: string;
        };
      };
      y?: {
        display: boolean;
        beginAtZero: boolean;
        title?: {
          display: boolean;
          text: string;
        };
      };
    };
  };
}

// Filtros para análises
export interface FiltroAnalise {
  periodo_inicio: string;
  periodo_fim: string;
  departamentos: string[];
  cargos: string[];
  funcionarios: string[];
  status_avaliacoes: string[];
  criterios: string[];
}

// Resultado de análise
export interface ResultadoAnalise {
  resumo: {
    total_avaliacoes: number;
    media_geral: number;
    avaliacoes_concluidas: number;
    avaliacoes_pendentes: number;
    funcionarios_avaliados: number;
  };
  metricas: KPIAvaliacao[];
  tendencias: TendenciaAvaliacao[];
  comparacoes: AnaliseComparativa;
  alertas: AlertaPerformance[];
  recomendacoes: string[];
}

// Permissões específicas do módulo
export interface PermissoesAvaliacoesAvancadas {
  'avaliacoes.metricas.read': boolean;
  'avaliacoes.metricas.admin': boolean;
  'avaliacoes.relatorios.read': boolean;
  'avaliacoes.relatorios.export': boolean;
  'avaliacoes.dashboard.config': boolean;
  'avaliacoes.alertas.manage': boolean;
  'avaliacoes.analytics.advanced': boolean;
}
