import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { isAdminFromRequest } from '@/lib/auth';
import { resolveInside } from '@/lib/path-safe';

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

    if (typeof folderPath !== 'string' || typeof folderName !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Caminho da pasta e nome da pasta são obrigatórios' },
        { status: 400 }
      );
    }

    const publicBase = path.resolve(process.cwd(), 'public');
    const relativeInput = folderPath.replace(/\\/g, '/').replace(/^(\.\/)+/, '').replace(/^public\//, '');
    const parent = resolveInside(publicBase, relativeInput);
    if (!parent.ok) {
      return NextResponse.json(
        { success: false, error: parent.error },
        { status: 400 }
      );
    }

    const child = resolveInside(parent.resolved, folderName, { asName: true });
    if (!child.ok) {
      return NextResponse.json(
        { success: false, error: child.error },
        { status: 400 }
      );
    }

    const requestedPath = parent.resolved;
    const newFolderPath = child.resolved;
    const responsePath = path.relative(process.cwd(), newFolderPath);

    console.log('Caminho da nova pasta:', responsePath);

    if (fs.existsSync(newFolderPath)) {
      return NextResponse.json(
        { success: false, error: 'A pasta já existe' },
        { status: 400 }
      );
    }

    if (!fs.existsSync(requestedPath)) {
      return NextResponse.json(
        { success: false, error: 'Diretório pai não encontrado' },
        { status: 404 }
      );
    }

    fs.mkdirSync(newFolderPath, { recursive: true });

    return NextResponse.json({
      success: true,
      message: 'Pasta criada com sucesso',
      path: responsePath
    });
  } catch (error) {
    console.error('Erro ao criar pasta:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
