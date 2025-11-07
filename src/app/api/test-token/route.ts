import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Obter dados do corpo da requisição
    const { userId, email, role } = await request.json();
    
    if (!userId) {
      return NextResponse.json({ error: 'ID do usuário é obrigatório' }, { status: 400 });
    }
    
    // Obter chave secreta do JWT
    const jwtSecret = process.env.JWT_SECRET;
    
    if (!jwtSecret) {
      return NextResponse.json({ error: 'JWT_SECRET não está configurado' }, { status: 500 });
    }
    
    // Criar payload do token
    const payload = {
      userId,
      email: email || '',
      role: role || 'USER',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24) // 24 horas
    };
    
    // Gerar token
    const token = jwt.sign(payload, jwtSecret);
    
    return NextResponse.json({ token });
  } catch (error) {
    console.error('Erro ao gerar token:', error);
    return NextResponse.json(
      { error: 'Erro ao gerar token', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
