import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação
    const authHeader = request.headers.get('authorization') || '';
    const token = extractTokenFromHeader(authHeader);

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

    // Executar o script de conversão
    console.log('Iniciando conversão de PDFs...');
    const scriptPath = path.join(process.cwd(), 'scripts', 'convert-pdfs.js');
    
    const { stdout, stderr } = await execAsync(`node ${scriptPath}`);
    
    if (stderr) {
      console.error('Erro ao executar script de conversão:', stderr);
      return NextResponse.json(
        { error: 'Erro ao converter PDFs', details: stderr },
        { status: 500 }
      );
    }
    
    console.log('Resultado da conversão:', stdout);
    
    return NextResponse.json({
      success: true,
      message: 'Conversão de PDFs concluída com sucesso',
      details: stdout
    });
  } catch (error) {
    console.error('Erro ao processar requisição:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
