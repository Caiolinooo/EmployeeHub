import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    console.log('Admin execute SQL request received'); // Log de início da requisição

    // Verificar autenticação e se é administrador
    const authHeader = request.headers.get('authorization');
    console.log('Authorization header:', authHeader); // Log do cabeçalho de autorização
    const token = extractTokenFromHeader(authHeader || '');
    console.log('Extracted token:', token ? token.substring(0, 10) + '...' : 'No token'); // Log do token extraído

    if (!token) {
      console.error('Não autorizado: Token não fornecido'); // Log de token não fornecido
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    console.log('Token payload received:', payload); // Log do payload
    
    if (!payload) {
       console.error('Token inválido ou expirado'); // Log de token inválido
       return NextResponse.json(
         { error: 'Token inválido ou expirado' },
         { status: 401 }
       );
    }

    console.log('User role from token payload:', payload.role); // Log da role do payload

    if (payload.role !== 'ADMIN') {
      console.error('Acesso negado: Usuário não é administrador. Role:', payload.role); // Log de acesso negado
      return NextResponse.json(
        { error: 'Acesso negado: Requer privilégios de administrador' },
        { status: 403 }
      );
    }

    // Temporariamente ler o conteúdo do arquivo SQL
    const fs = await import('fs').then(m => m.promises);
    const path = await import('path').then(m => m.default);

    const sqlFilePath = path.join(process.cwd(), 'scripts', 'add-preferences-column.sql');
    let sqlScript = '';
    try {
      sqlScript = await fs.readFile(sqlFilePath, 'utf-8');
      console.log('SQL script read from file:', sqlScript);
    } catch (readError) {
      console.error('Error reading SQL file:', readError);
      return NextResponse.json(
        { error: 'Error reading SQL file', details: readError instanceof Error ? readError.message : String(readError) },
        { status: 500 }
      );
    }

    console.log('Executing SQL script from file...');

    const { data, error } = await supabaseAdmin.rpc('execute_sql', { sql: sqlScript });

    if (error) {
      console.error('Error executing SQL script:', error);
      return NextResponse.json(
        { error: 'Error executing SQL script', details: error.message },
        { status: 500 }
      );
    }

    console.log('SQL script executed successfully:', data);

    return NextResponse.json({
      success: true,
      message: 'SQL script executed successfully',
      data
    });

  } catch (error) {
    console.error('Error processing SQL execution request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
