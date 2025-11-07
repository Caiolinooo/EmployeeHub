import { NextResponse } from 'next/server';
import { testEmailConnection } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const result = await testEmailConnection();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Erro ao testar conexão com servidor de email:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: `Erro ao testar conexão: ${error instanceof Error ? error.message : 'Erro desconhecido'}` 
      },
      { status: 500 }
    );
  }
}
