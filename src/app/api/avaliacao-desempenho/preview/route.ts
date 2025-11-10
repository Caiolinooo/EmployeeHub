import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Rota para processar preview de importação
 */
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader || undefined);

    if (!token) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: 'Token inválido ou expirado' },
        { status: 401 }
      );
    }

    // Processar o arquivo
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const type = formData.get('type') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'Nenhum arquivo enviado' },
        { status: 400 }
      );
    }

    // Verificar tipo de arquivo
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls') && !file.name.endsWith('.csv')) {
      return NextResponse.json(
        { error: 'Tipo de arquivo inválido. Apenas arquivos .xlsx, .xls e .csv são suportados.' },
        { status: 400 }
      );
    }

    // Processar o arquivo
    let previewData = [];

    try {
      // Ler o conteúdo do arquivo
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Processar com base no tipo de arquivo
      if (file.name.endsWith('.csv')) {
        // Processar CSV
        const text = buffer.toString('utf-8');
        const rows = text.split('\n');

        // Obter cabeçalhos
        const headers = rows[0].split(',').map(header => header.trim());

        // Processar linhas
        for (let i = 1; i < rows.length; i++) {
          if (!rows[i].trim()) continue; // Pular linhas vazias

          const values = rows[i].split(',').map(value => value.trim());
          const data: any = {};
          const errors = [];

          // Mapear valores para campos
          for (let j = 0; j < headers.length; j++) {
            const header = headers[j].toLowerCase();
            const value = values[j] || '';

            // Mapear cabeçalhos para campos esperados
            if (header.includes('nome') || header.includes('name')) {
              data.nome = value;
            } else if (header.includes('email')) {
              data.email = value;
            } else if (header.includes('cargo') || header.includes('position')) {
              data.cargo = value;
            } else if (header.includes('departamento') || header.includes('department')) {
              data.departamento = value;
            } else if (header.includes('admissao') || header.includes('hire')) {
              data.dataAdmissao = value;
            } else if (header.includes('telefone') || header.includes('phone')) {
              data.telefone = value;
            } else {
              // Outros campos
              data[header] = value;
            }
          }

          // Validar campos obrigatórios
          if (!data.nome) {
            errors.push('O campo nome é obrigatório');
          }

          previewData.push({
            id: i,
            status: errors.length === 0 ? 'valid' : 'error',
            data,
            errors: errors.length > 0 ? errors : undefined
          });
        }
      } else {
        // Para arquivos Excel, usamos dados simulados por enquanto
        // Em uma implementação real, você usaria uma biblioteca como xlsx para processar
        previewData = [
          {
            id: 1,
            status: 'valid',
            data: {
              nome: 'João Silva',
              email: 'joao.silva@example.com',
              cargo: 'Desenvolvedor',
              departamento: 'TI',
              dataAdmissao: '2023-01-01'
            }
          },
          {
            id: 2,
            status: 'valid',
            data: {
              nome: 'Maria Souza',
              email: 'maria.souza@example.com',
              cargo: 'Analista',
              departamento: 'RH',
              dataAdmissao: '2023-02-01'
            }
          },
          {
            id: 3,
            status: 'error',
            data: {
              nome: 'Pedro Santos',
              email: 'pedro.santos@example.com',
              cargo: '',
              departamento: 'Financeiro',
              dataAdmissao: '2023-03-01'
            },
            errors: ['O campo cargo é obrigatório']
          },
        ];
      }
    } catch (error) {
      console.error('Erro ao processar arquivo:', error);
      return NextResponse.json({
        success: false,
        error: 'Erro ao processar o arquivo. Verifique o formato e tente novamente.',
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: previewData,
      message: 'Arquivo processado com sucesso',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Erro ao processar preview:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
