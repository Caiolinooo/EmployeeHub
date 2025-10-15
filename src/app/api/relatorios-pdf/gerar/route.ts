import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyTokenFromRequest } from '@/lib/auth';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Chart } from 'chart.js';
import { 
  ConfiguracaoRelatorio, 
  DadosRelatorio, 
  FiltroRelatorio,
  ResultadoGeracao 
} from '@/types/relatorios-pdf';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação
    const authResult = await verifyTokenFromRequest(request);
    if (!authResult.valid || !authResult.payload) {
      return NextResponse.json(
        { success: false, error: 'Token inválido' },
        { status: 401 }
      );
    }

    // Verificar permissões
    const { data: user } = await supabase
      .from('users_unified')
      .select('access_permissions')
      .eq('id', authResult.payload.userId)
      .single();

    const permissions = user?.access_permissions || {};
    if (!permissions['avaliacoes.relatorios.export']) {
      return NextResponse.json(
        { success: false, error: 'Sem permissão para exportar relatórios' },
        { status: 403 }
      );
    }

    // Obter dados da solicitação
    const { configuracao_id, parametros, filtros } = await request.json();

    // Buscar configuração do relatório
    const { data: configuracao } = await supabase
      .from('configuracoes_relatorio')
      .select('*')
      .eq('id', configuracao_id)
      .single();

    if (!configuracao) {
      return NextResponse.json(
        { success: false, error: 'Configuração de relatório não encontrada' },
        { status: 404 }
      );
    }

    // Criar solicitação no banco
    const { data: solicitacao } = await supabase
      .from('solicitacoes_relatorio')
      .insert({
        configuracao_id,
        parametros,
        solicitado_por: authResult.payload.userId,
        status: 'processando',
        progresso: 0
      })
      .select()
      .single();

    // Processar relatório em background
    processarRelatorio(solicitacao.id, configuracao, parametros, filtros);

    return NextResponse.json({
      success: true,
      solicitacao_id: solicitacao.id,
      message: 'Relatório sendo processado'
    });

  } catch (error) {
    console.error('Erro ao gerar relatório:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

async function processarRelatorio(
  solicitacaoId: string,
  configuracao: ConfiguracaoRelatorio,
  parametros: any,
  filtros: FiltroRelatorio
) {
  try {
    // Atualizar progresso
    await atualizarProgresso(solicitacaoId, 10);

    // 1. Coletar dados
    const dados = await coletarDados(configuracao, parametros, filtros);
    await atualizarProgresso(solicitacaoId, 30);

    // 2. Gerar gráficos
    const graficos = await gerarGraficos(configuracao.graficos, dados);
    await atualizarProgresso(solicitacaoId, 50);

    // 3. Criar PDF
    const pdfBuffer = await criarPDF(configuracao, dados, graficos, filtros);
    await atualizarProgresso(solicitacaoId, 80);

    // 4. Salvar arquivo
    const arquivoUrl = await salvarArquivo(pdfBuffer, `relatorio_${solicitacaoId}.pdf`);
    await atualizarProgresso(solicitacaoId, 100);

    // 5. Finalizar solicitação
    await supabase
      .from('solicitacoes_relatorio')
      .update({
        status: 'concluido',
        arquivo_url: arquivoUrl,
        processado_em: new Date().toISOString(),
        tamanho_arquivo: pdfBuffer.length,
        progresso: 100
      })
      .eq('id', solicitacaoId);

  } catch (error: any) {
    console.error('Erro ao processar relatório:', error);

    await supabase
      .from('solicitacoes_relatorio')
      .update({
        status: 'erro',
        erro_mensagem: error?.message || 'Erro desconhecido',
        processado_em: new Date().toISOString()
      })
      .eq('id', solicitacaoId);
  }
}

async function atualizarProgresso(solicitacaoId: string, progresso: number) {
  await supabase
    .from('solicitacoes_relatorio')
    .update({ progresso })
    .eq('id', solicitacaoId);
}

async function coletarDados(
  configuracao: ConfiguracaoRelatorio,
  parametros: any,
  filtros: FiltroRelatorio
): Promise<DadosRelatorio> {
  // Coletar dados baseado no tipo de relatório
  let dadosPrincipais: any[] = [];
  let metricas: any = {};

  switch (configuracao.tipo) {
    case 'avaliacao':
      dadosPrincipais = await coletarDadosAvaliacoes(filtros);
      metricas = await calcularMetricasAvaliacoes(filtros);
      break;
    
    case 'desempenho':
      dadosPrincipais = await coletarDadosDesempenho(filtros);
      metricas = await calcularMetricasDesempenho(filtros);
      break;
    
    case 'departamento':
      dadosPrincipais = await coletarDadosDepartamento(filtros, parametros.departamento);
      metricas = await calcularMetricasDepartamento(filtros, parametros.departamento);
      break;
    
    default:
      dadosPrincipais = [];
      metricas = {};
  }

  return {
    titulo: configuracao.nome,
    subtitulo: `Período: ${filtros.periodo_inicio} a ${filtros.periodo_fim}`,
    periodo: {
      inicio: filtros.periodo_inicio,
      fim: filtros.periodo_fim
    },
    filtros_aplicados: filtros,
    dados_principais: dadosPrincipais,
    metricas,
    graficos: {},
    tabelas: {},
    observacoes: [],
    recomendacoes: []
  };
}

async function coletarDadosAvaliacoes(filtros: FiltroRelatorio) {
  const { data } = await supabase
    .from('vw_avaliacoes_desempenho')
    .select('*')
    .gte('data_inicio', filtros.periodo_inicio)
    .lte('data_fim', filtros.periodo_fim)
    .in('status', filtros.status);

  return data || [];
}

async function calcularMetricasAvaliacoes(filtros: FiltroRelatorio) {
  const { data } = await supabase
    .from('vw_avaliacoes_desempenho')
    .select('pontuacao_total, status')
    .gte('data_inicio', filtros.periodo_inicio)
    .lte('data_fim', filtros.periodo_fim);

  const avaliacoes = data || [];
  const concluidas = avaliacoes.filter(a => a.status === 'concluida');
  const pontuacoes = concluidas.map(a => a.pontuacao_total).filter(p => p > 0);
  
  const mediaGeral = pontuacoes.length > 0 ? 
    pontuacoes.reduce((sum, p) => sum + p, 0) / pontuacoes.length : 0;

  return {
    total_avaliacoes: {
      valor: avaliacoes.length,
      formato: 'numero'
    },
    media_geral: {
      valor: mediaGeral,
      formato: 'decimal'
    },
    avaliacoes_concluidas: {
      valor: concluidas.length,
      formato: 'numero'
    },
    taxa_conclusao: {
      valor: avaliacoes.length > 0 ? (concluidas.length / avaliacoes.length) * 100 : 0,
      formato: 'porcentagem'
    }
  };
}

async function coletarDadosDesempenho(filtros: FiltroRelatorio) {
  // Implementar coleta de dados de desempenho
  return [];
}

async function calcularMetricasDesempenho(filtros: FiltroRelatorio) {
  // Implementar cálculo de métricas de desempenho
  return {};
}

async function coletarDadosDepartamento(filtros: FiltroRelatorio, departamento: string) {
  // Implementar coleta de dados por departamento
  return [];
}

async function calcularMetricasDepartamento(filtros: FiltroRelatorio, departamento: string) {
  // Implementar cálculo de métricas por departamento
  return {};
}

async function gerarGraficos(configuracoes: any[], dados: DadosRelatorio) {
  const graficos: { [key: string]: string } = {};

  for (const config of configuracoes) {
    try {
      // Gerar gráfico baseado na configuração
      const graficoBase64 = await criarGrafico(config, dados);
      graficos[config.id] = graficoBase64;
    } catch (error) {
      console.error(`Erro ao gerar gráfico ${config.id}:`, error);
    }
  }

  return graficos;
}

async function criarGrafico(config: any, dados: DadosRelatorio): Promise<string> {
  // Implementar criação de gráfico usando Chart.js
  // Retornar base64 da imagem do gráfico
  return '';
}

async function criarPDF(
  configuracao: ConfiguracaoRelatorio,
  dados: DadosRelatorio,
  graficos: { [key: string]: string },
  filtros: FiltroRelatorio
): Promise<Buffer> {
  const pdf = new jsPDF({
    orientation: filtros.orientacao === 'landscape' ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Configurar fonte
  pdf.setFont('helvetica');

  // Adicionar cabeçalho
  if (configuracao.cabecalho.mostrar_logo) {
    // Adicionar logo se disponível
  }

  pdf.setFontSize(20);
  pdf.text(dados.titulo, 20, 30);

  if (dados.subtitulo) {
    pdf.setFontSize(12);
    pdf.text(dados.subtitulo, 20, 40);
  }

  // Adicionar métricas
  let yPosition = 60;
  pdf.setFontSize(16);
  pdf.text('Métricas Principais', 20, yPosition);
  yPosition += 10;

  pdf.setFontSize(12);
  Object.entries(dados.metricas).forEach(([key, metrica]) => {
    const texto = `${key}: ${formatarValor(metrica.valor, metrica.formato)}`;
    pdf.text(texto, 20, yPosition);
    yPosition += 8;
  });

  // Adicionar gráficos
  if (filtros.incluir_graficos && Object.keys(graficos).length > 0) {
    yPosition += 10;
    pdf.setFontSize(16);
    pdf.text('Gráficos', 20, yPosition);
    yPosition += 10;

    Object.entries(graficos).forEach(([id, graficoBase64]) => {
      if (graficoBase64) {
        try {
          pdf.addImage(graficoBase64, 'PNG', 20, yPosition, 160, 80);
          yPosition += 90;
        } catch (error) {
          console.error(`Erro ao adicionar gráfico ${id}:`, error);
        }
      }
    });
  }

  // Adicionar tabela de dados se solicitado
  if (filtros.incluir_detalhes && dados.dados_principais.length > 0) {
    // Implementar tabela de dados
  }

  // Adicionar rodapé
  if (configuracao.rodape.mostrar_numeracao) {
    const pageCount = (pdf.internal as any).getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      pdf.setFontSize(10);
      pdf.text(`Página ${i} de ${pageCount}`, 20, 280);
    }
  }

  return Buffer.from(pdf.output('arraybuffer'));
}

function formatarValor(valor: number, formato: string): string {
  switch (formato) {
    case 'numero':
      return valor.toString();
    case 'decimal':
      return valor.toFixed(2);
    case 'porcentagem':
      return `${valor.toFixed(1)}%`;
    case 'moeda':
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(valor);
    default:
      return valor.toString();
  }
}

async function salvarArquivo(buffer: Buffer, nomeArquivo: string): Promise<string> {
  // Implementar salvamento no Supabase Storage
  const { data, error } = await supabase.storage
    .from('relatorios')
    .upload(nomeArquivo, buffer, {
      contentType: 'application/pdf',
      upsert: true
    });

  if (error) {
    throw new Error(`Erro ao salvar arquivo: ${error.message}`);
  }

  // Retornar URL pública
  const { data: publicUrl } = supabase.storage
    .from('relatorios')
    .getPublicUrl(nomeArquivo);

  return publicUrl.publicUrl;
}
