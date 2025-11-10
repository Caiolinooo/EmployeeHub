import { NextRequest, NextResponse } from 'next/server';
import { ensureAdminUser } from '@/lib/admin-utils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const result = await ensureAdminUser();
    
    if (result) {
      return NextResponse.json({
        success: true,
        message: 'Usuário administrador verificado/criado com sucesso'
      });
    } else {
      return NextResponse.json({
        success: false,
        message: 'Erro ao verificar/criar usuário administrador'
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Erro ao processar solicitação:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Erro interno do servidor'
    }, { status: 500 });
  }
}
