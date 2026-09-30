import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { podeMutarCadastroColaborador } from '@/lib/gestao-tripulantes/colaborador-cadastro-auth';
import { converterProspectoParaColaborador } from '@/lib/recrutamento/converter-prospecto';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const token = extractTokenFromHeader(request.headers.get('authorization') || undefined);
    const payload = token ? verifyToken(token) : null;
    if (!payload) return NextResponse.json({ error: 'Token inválido' }, { status: 401 });

    // Converter é passar o prospecto para o DP — mesmo gate do cadastro de colaborador.
    const pode = await podeMutarCadastroColaborador(payload.userId, payload.role);
    if (!pode) {
      return NextResponse.json({ error: 'Apenas o DP pode converter prospecto em colaborador' }, { status: 403 });
    }

    const { id } = await context.params;
    const resultado = await converterProspectoParaColaborador(id);
    if (!resultado.ok) {
      return NextResponse.json({ error: resultado.error }, { status: resultado.status });
    }

    return NextResponse.json({
      success: true,
      data: { colaborador_id: resultado.colaboradorId, criado: resultado.criado },
      message: resultado.criado ? 'Colaborador criado a partir do prospecto' : 'Prospecto já vinculado a este colaborador',
    });
  } catch (error) {
    console.error('Erro ao converter prospecto:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
