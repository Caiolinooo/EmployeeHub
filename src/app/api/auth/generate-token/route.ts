import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Obter dados do corpo da requisição
    const { userId, email, phoneNumber, role, firstName, lastName } = await request.json();
    
    if (!userId) {
      return NextResponse.json({ error: 'ID do usuário é obrigatório' }, { status: 400 });
    }
    
    // Obter chave secreta do JWT
    const jwtSecret = process.env.JWT_SECRET || process.env.NEXT_PUBLIC_JWT_SECRET || 'abz-secret-key';
    
    // Criar payload do token
    const payload = {
      userId,
      email: email || '',
      phoneNumber: phoneNumber || '',
      role: role || 'USER',
      firstName: firstName || '',
      lastName: lastName || '',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24) // 24 horas
    };
    
    // Gerar token
    const token = jwt.sign(payload, jwtSecret);
    
    return NextResponse.json({
      success: true,
      token,
      expiresIn: 86400 // 24 horas em segundos
    });
  } catch (error) {
    console.error('Erro ao gerar token:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}
