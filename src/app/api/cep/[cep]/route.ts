import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import {
  enderecoDeBrasilApi,
  enderecoDeViaCep,
  normalizarCep,
} from '@/lib/gestao-tripulantes/cep-correios';

export const dynamic = 'force-dynamic';

async function lerJson(url: string): Promise<unknown | null> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return null;
  return res.json();
}

/** CEP → endereço da base dos Correios (ViaCEP), com fallback BrasilAPI. */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ cep: string }> },
) {
  try {
    const token = extractTokenFromHeader(request.headers.get('authorization') || undefined);
    if (!token || !verifyToken(token)) {
      return NextResponse.json({ error: 'Token de autorização necessário' }, { status: 401 });
    }

    const { cep: bruto } = await context.params;
    const cep = normalizarCep(bruto);
    if (cep.length !== 8) {
      return NextResponse.json({ error: 'CEP deve ter 8 dígitos' }, { status: 400 });
    }

    const via = enderecoDeViaCep(await lerJson(`https://viacep.com.br/ws/${cep}/json/`));
    if (via) return NextResponse.json({ success: true, data: via, fonte: 'viacep' });

    const br = enderecoDeBrasilApi(await lerJson(`https://brasilapi.com.br/api/cep/v2/${cep}`));
    if (br) return NextResponse.json({ success: true, data: br, fonte: 'brasilapi' });

    return NextResponse.json({ error: 'CEP não encontrado na base dos Correios' }, { status: 404 });
  } catch (error) {
    console.error('Erro ao consultar CEP:', error);
    return NextResponse.json({ error: 'Falha ao consultar o CEP' }, { status: 502 });
  }
}
