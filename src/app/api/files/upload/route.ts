import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { isAdminFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Função para processar o upload de arquivos
export async function POST(request: NextRequest) {
  try {
    // Verificar se o usuário é administrador
    const adminCheck = await isAdminFromRequest(request);
    if (!adminCheck.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Acesso não autorizado' },
        { status: 403 }
      );
    }

    // Processar o formulário
    const formData = await request.formData();
    const uploadPath = formData.get('path') as string;
    const files = formData.getAll('files');

    if (!uploadPath) {
      return NextResponse.json(
        { success: false, error: 'Caminho de upload não especificado' },
        { status: 400 }
      );
    }

    if (!files || files.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Nenhum arquivo enviado' },
        { status: 400 }
      );
    }

    console.log('Fazendo upload de arquivos:', { uploadPath, fileCount: files.length });

    // Normalizar o caminho para evitar ataques de path traversal
    const normalizedPath = path.normalize(uploadPath).replace(/^(\.\.(\/|\\|$))+/, '');

    // Verificar se o caminho é relativo à pasta public
    let requestedPath = normalizedPath;
    if (!normalizedPath.startsWith('public/') && !normalizedPath.startsWith('public\\')) {
      // Se não começar com public/, assumir que é relativo à pasta public
      requestedPath = path.join('public', normalizedPath);
    }

    console.log('Caminho normalizado:', requestedPath);

    // Verificar se o diretório existe
    if (!fs.existsSync(requestedPath)) {
      return NextResponse.json(
        { success: false, error: 'Diretório não encontrado' },
        { status: 404 }
      );
    }

    // Verificar se é um diretório
    const stats = fs.statSync(requestedPath);
    if (!stats.isDirectory()) {
      return NextResponse.json(
        { success: false, error: 'O caminho não é um diretório' },
        { status: 400 }
      );
    }

    // Processar cada arquivo
    const uploadedFiles = [];

    for (const file of files) {
      if (!(file instanceof File)) {
        continue;
      }

      // Normalizar o nome do arquivo
      const fileName = file.name.replace(/[<>:"/\\|?*]/g, '_');
      const filePath = path.join(requestedPath, fileName);

      // Ler o arquivo como um array de bytes
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Salvar o arquivo
      fs.writeFileSync(filePath, buffer);

      // Calcular o caminho relativo à pasta public
      let relativePath = filePath;
      if (filePath.startsWith('public/') || filePath.startsWith('public\\')) {
        relativePath = filePath.substring(7); // Remover 'public/'
      }

      // Substituir barras invertidas por barras normais para URLs
      relativePath = relativePath.replace(/\\/g, '/');

      uploadedFiles.push({
        name: fileName,
        path: relativePath,
        size: buffer.length,
        type: file.type
      });
    }

    return NextResponse.json({
      success: true,
      message: `${uploadedFiles.length} arquivo(s) enviado(s) com sucesso`,
      files: uploadedFiles
    });
  } catch (error) {
    console.error('Erro ao fazer upload de arquivos:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
