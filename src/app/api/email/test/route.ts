import { NextResponse } from 'next/server';
import { testEmailConnection } from '@/lib/email';

export const dynamic = 'force-dynamic';

/**
 * API para testar a conexão com o servidor SMTP
 * @route GET /api/email/test
 */
export async function GET() {
  try {
    console.log('Testando conexão com o servidor SMTP...');
    
    // Testar a conexão com o servidor SMTP
    const result = await testEmailConnection();
    
    // Retornar o resultado
    return NextResponse.json(result);
  } catch (error) {
    console.error('Erro ao testar conexão com o servidor SMTP:', error);
    
    // Retornar erro
    return NextResponse.json(
      {
        success: false,
        message: `Erro ao testar conexão: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      },
      { status: 500 }
    );
  }
}
