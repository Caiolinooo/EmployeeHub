import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  console.log('=== API TEST ROUTE DEBUG ===');
  console.log('Recebida requisição de teste');
  console.log('Método:', request.method);
  console.log('URL:', request.url);
  console.log('Headers:', JSON.stringify(Object.fromEntries(request.headers.entries())));
  
  return NextResponse.json({
    status: 'ok',
    message: 'API está funcionando',
    timestamp: new Date().toISOString()
  });
}
