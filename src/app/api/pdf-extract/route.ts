import { NextRequest, NextResponse } from 'next/server';
import { join } from 'path';
import { writeFile, mkdir } from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

// Force this route to be dynamic
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Função para extrair texto de um PDF
// Esta é uma implementação simulada, pois a extração real de PDF requer bibliotecas adicionais
// como pdf.js, pdf-parse ou pdfjs-dist que precisariam ser instaladas
export async function GET(request: NextRequest) {
  try {
    // Runtime check to ensure this only runs during actual HTTP requests
    if (typeof window !== 'undefined') {
      return NextResponse.json(
        { error: 'Esta rota só pode ser executada no servidor' },
        { status: 500 }
      );
    }

    // Check if we're in a static generation context
    if (!request || !request.url) {
      return NextResponse.json(
        { error: 'Rota não disponível durante geração estática' },
        { status: 503 }
      );
    }

    let pdfUrl = null;
    try {
      const { searchParams } = new URL(request.url);
      pdfUrl = searchParams.get('url');
    } catch (error) {
      console.error('Erro ao processar URL:', error);
      return NextResponse.json(
        { error: 'URL inválida' },
        { status: 400 }
      );
    }

    if (!pdfUrl) {
      return NextResponse.json(
        { error: 'URL do PDF não fornecida' },
        { status: 400 }
      );
    }

    // Normalizar o caminho do PDF
    // Se o caminho não começar com http ou https, considerar como caminho relativo
    if (!pdfUrl.startsWith('http://') && !pdfUrl.startsWith('https://')) {
      // Garantir que o caminho comece com /
      if (!pdfUrl.startsWith('/')) {
        pdfUrl = `/${pdfUrl}`;
      }

      // Construir URL completa com verificação de runtime
      let host = 'localhost:3000';
      let protocol = 'http';
      
      try {
        if (request.headers) {
          host = request.headers.get('host') || 'localhost:3000';
          protocol = host.includes('localhost') ? 'http' : 'https';
        }
      } catch (error) {
        console.error('Erro ao obter host:', error);
        // Use valores padrão se houver erro
      }
      
      pdfUrl = `${protocol}://${host}${pdfUrl}`;
    }

    console.log(`Extraindo conteúdo do PDF: ${pdfUrl}`);

    // Verificar se o arquivo existe
    try {
      const response = await fetch(pdfUrl, {
        method: 'HEAD',
        cache: 'no-cache'
      });

      if (!response.ok) {
        return NextResponse.json(
          { error: `Arquivo não encontrado: ${response.status} ${response.statusText}` },
          { status: 404 }
        );
      }
    } catch (error) {
      console.error('Erro ao verificar arquivo:', error);
      return NextResponse.json(
        { error: 'Erro ao acessar o arquivo PDF' },
        { status: 500 }
      );
    }

    // Em uma implementação real, aqui usaríamos uma biblioteca para extrair o texto do PDF
    // Como é uma simulação, vamos retornar um texto de exemplo baseado no nome do arquivo

    // Extrair o nome do arquivo da URL
    const fileName = pdfUrl.split('/').pop() || 'documento.pdf';

    // Gerar conteúdo simulado baseado no nome do arquivo
    let simulatedContent = '';

    if (fileName.toLowerCase().includes('manual')) {
      simulatedContent = `# Manual do Usuário\n\nEste é um exemplo de conteúdo extraído de um manual.\n\n## Introdução\n\nBem-vindo ao manual do usuário. Este documento fornece instruções detalhadas sobre como utilizar o sistema.\n\n## Funcionalidades Principais\n\n1. Gerenciamento de usuários\n2. Configuração de permissões\n3. Geração de relatórios\n\n## Suporte\n\nEm caso de dúvidas, entre em contato com o suporte técnico.`;
    } else if (fileName.toLowerCase().includes('politica')) {
      simulatedContent = `# Política de Uso\n\nEste documento estabelece as diretrizes e procedimentos para o uso adequado dos recursos da empresa.\n\n## Responsabilidades\n\nTodos os funcionários devem seguir estas políticas e reportar qualquer violação ao departamento de compliance.\n\n## Penalidades\n\nO não cumprimento destas políticas pode resultar em ações disciplinares.`;
    } else if (fileName.toLowerCase().includes('procedimento')) {
      simulatedContent = `# Procedimento Operacional\n\nEste documento descreve os procedimentos operacionais padrão para as atividades da empresa.\n\n## Etapas do Processo\n\n1. Planejamento\n2. Execução\n3. Verificação\n4. Ação corretiva\n\n## Registros\n\nTodos os procedimentos devem ser documentados e arquivados conforme as normas da empresa.`;
    } else if (fileName.toLowerCase().includes('noticia')) {
      simulatedContent = `# Comunicado Importante\n\nA ABZ Group tem o prazer de anunciar novidades importantes para todos os colaboradores.\n\n## Destaques\n\n- Novo projeto iniciado\n- Expansão das operações\n- Reconhecimento internacional\n\n## Próximos Passos\n\nMais informações serão compartilhadas nas próximas semanas. Fique atento aos comunicados oficiais.`;
    } else {
      simulatedContent = `# Documento: ${fileName}\n\nEste é um exemplo de conteúdo extraído de um documento PDF.\n\nO conteúdo real seria extraído utilizando uma biblioteca de processamento de PDF.\n\nEm uma implementação completa, todo o texto do documento seria extraído e formatado adequadamente para exibição.`;
    }

    // Retornar o conteúdo simulado
    return NextResponse.json({
      success: true,
      content: simulatedContent,
      fileName,
      message: 'Conteúdo extraído com sucesso (simulação)'
    });
  } catch (error) {
    console.error('Erro ao extrair conteúdo do PDF:', error);
    return NextResponse.json(
      { error: 'Erro interno ao processar o PDF' },
      { status: 500 }
    );
  }
}
