import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { isAdminFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// POST - Criar uma nova pasta
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

    // Obter os dados da requisição
    const body = await request.json();
    const { path: folderPath, folderName } = body;

    if (!folderPath || !folderName) {
      return NextResponse.json(
        { success: false, error: 'Caminho da pasta e nome da pasta são obrigatórios' },
        { status: 400 }
      );
    }

    console.log('Criando pasta:', { folderPath, folderName });

    // Normalizar o caminho para evitar ataques de path traversal
    const normalizedPath = path.normalize(folderPath).replace(/^(\.\.(\/|\\|$))+/, '');

    // Verificar se o caminho é relativo à pasta public
    let requestedPath = normalizedPath;
    if (!normalizedPath.startsWith('public/') && !normalizedPath.startsWith('public\\')) {
      // Se não começar com public/, assumir que é relativo à pasta public
      requestedPath = path.join('public', normalizedPath);
    }

    // Normalizar o nome da pasta
    const normalizedFolderName = folderName.replace(/[<>:"/\\|?*]/g, '_');

    // Caminho completo da nova pasta
    const newFolderPath = path.join(requestedPath, normalizedFolderName);

    console.log('Caminho da nova pasta:', newFolderPath);

    // Verificar se a pasta já existe
    if (fs.existsSync(newFolderPath)) {
      return NextResponse.json(
        { success: false, error: 'A pasta já existe' },
        { status: 400 }
      );
    }

    // Verificar se o diretório pai existe
    if (!fs.existsSync(requestedPath)) {
      return NextResponse.json(
        { success: false, error: 'Diretório pai não encontrado' },
        { status: 404 }
      );
    }

    // Criar a pasta
    fs.mkdirSync(newFolderPath, { recursive: true });

    return NextResponse.json({
      success: true,
      message: 'Pasta criada com sucesso',
      path: newFolderPath
    });
  } catch (error) {
    console.error('Erro ao criar pasta:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
