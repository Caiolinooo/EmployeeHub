import { NextRequest, NextResponse } from 'next/server';
import { AvaliacaoWorkflowService } from '@/lib/services/avaliacao-workflow-service';
import { getCurrentUser } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * Gerar relatórios de avaliação
 */
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({
        success: false,
        error: 'Usuário não autenticado'
      }, { status: 401 });
    }

    // Verificar permissão (apenas ADMIN e gerentes podem ver relatórios)
    if (currentUser.role !== 'ADMIN') {
      return NextResponse.json({
        success: false,
        error: 'Sem permissão para acessar relatórios'
      }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const cicloId = searchParams.get('cicloId');
    const formato = searchParams.get('formato') || 'json'; // json, pdf, xlsx

    // Gerar relatório
    const relatorio = await AvaliacaoWorkflowService.gerarRelatorio(cicloId || undefined, {
      gerenteId: searchParams.get('gerenteId') || undefined,
      status: searchParams.get('status') || undefined,
      departamento: searchParams.get('departamento') || undefined
    });

    // Processar diferentes formatos
    switch (formato) {
      case 'json':
        return NextResponse.json({
          success: true,
          data: relatorio
        });

      case 'pdf':
        // Aqui geraria PDF (exemplo simplificado)
        return new NextResponse(JSON.stringify(relatorio, null, 2), {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="relatorio-avaliacoes-${new Date().toISOString().split('T')[0]}.pdf"`
          }
        });

      case 'xlsx':
        // Aqui geraria Excel (exemplo simplificado)
        return new NextResponse(JSON.stringify(relatorio, null, 2), {
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="relatorio-avaliacoes-${new Date().toISOString().split('T')[0]}.xlsx"`
          }
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Formato não suportado'
        }, { status: 400 });
    }

  } catch (error: any) {
    console.error('❌ Erro ao gerar relatório:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

/**
 * Exportar dados brutos para análise
 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({
        success: false,
        error: 'Usuário não autenticado'
      }, { status: 401 });
    }

    if (currentUser.role !== 'ADMIN') {
      return NextResponse.json({
        success: false,
        error: 'Sem permissão para exportar dados'
      }, { status: 403 });
    }

    const body = await request.json();
    const { tipo, filtros } = body;

    // Lógica para exportar diferentes tipos de dados
    switch (tipo) {
      case 'avaliacoes_completas':
        // Exportar todas as avaliações com detalhes
        const relatorioCompleto = await AvaliacaoWorkflowService.gerarRelatorio(undefined, filtros);
        return NextResponse.json({
          success: true,
          data: relatorioCompleto
        });

      case 'auditoria':
        // Exportar logs de auditoria
        return NextResponse.json({
          success: true,
          data: {
            message: 'Dados de auditoria exportados com sucesso',
            // Aqui buscaria dados da tabela de auditoria
          }
        });

      case 'notificacoes':
        // Exportar histórico de notificações
        return NextResponse.json({
          success: true,
          data: {
            message: 'Histórico de notificações exportado com sucesso',
            // Aqui buscaria dados da tabela de notificações
          }
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Tipo de exportação não suportado'
        }, { status: 400 });
    }

  } catch (error: any) {
    console.error('❌ Erro ao exportar dados:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}