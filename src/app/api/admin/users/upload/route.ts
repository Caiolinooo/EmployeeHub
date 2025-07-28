import { NextRequest, NextResponse } from 'next/server';
import { processUserImportFile, ImportType } from '@/lib/importers/userImporter';

export async function POST(request: NextRequest) {
  try {
    // Verificar se é uma requisição multipart/form-data
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { error: 'Requisição deve ser multipart/form-data' },
        { status: 400 }
      );
    }

    // Processar o formulário
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const importTypeStr = formData.get('importType') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'Nenhum arquivo enviado' },
        { status: 400 }
      );
    }

    if (!importTypeStr) {
      return NextResponse.json(
        { error: 'Tipo de importação não especificado' },
        { status: 400 }
      );
    }

    // Converter string para enum
    let importType: ImportType;
    switch (importTypeStr.toLowerCase()) {
      case 'excel':
        importType = ImportType.EXCEL;
        break;
      case 'csv':
        importType = ImportType.CSV;
        break;
      case 'wk':
        importType = ImportType.WK;
        break;
      case 'dominio':
        importType = ImportType.DOMINIO;
        break;
      default:
        return NextResponse.json(
          { error: 'Tipo de importação inválido' },
          { status: 400 }
        );
    }

    // Processar o arquivo
    const result = await processUserImportFile(file, importType);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Erro ao processar upload de arquivo:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
