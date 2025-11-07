import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Obter token do corpo da requisição
    const { token } = await request.json();
    
    if (!token) {
      return NextResponse.json({ 
        valid: false, 
        error: 'Token não fornecido' 
      }, { status: 400 });
    }
    
    // Obter chave secreta do JWT
    const jwtSecret = process.env.JWT_SECRET;
    
    if (!jwtSecret) {
      return NextResponse.json({ 
        valid: false, 
        error: 'JWT_SECRET não está configurado no servidor' 
      }, { status: 500 });
    }
    
    // Verificar token
    try {
      const decoded = jwt.verify(token, jwtSecret);
      
      return NextResponse.json({
        valid: true,
        decoded
      });
    } catch (error) {
      return NextResponse.json({ 
        valid: false, 
        error: 'Token inválido ou expirado',
        details: error instanceof Error ? error.message : String(error)
      }, { status: 401 });
    }
  } catch (error) {
    return NextResponse.json({ 
      valid: false, 
      error: 'Erro ao processar requisição',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
