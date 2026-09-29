import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const UFS = new Set([
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]);

interface Municipio { nome: string; uf: string }

const cacheUf = new Map<string, Municipio[]>();

async function municipiosDaUf(uf: string): Promise<Municipio[]> {
  const hit = cacheUf.get(uf);
  if (hit) return hit;
  const res = await fetch(
    `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`,
    { cache: 'no-store' },
  );
  if (!res.ok) throw new Error(`IBGE ${uf} ${res.status}`);
  const rows = (await res.json()) as Array<{ nome?: string }>;
  const lista = rows
    .map((r) => ({ nome: String(r.nome || '').trim(), uf }))
    .filter((r) => r.nome);
  cacheUf.set(uf, lista);
  return lista;
}

/** Municípios brasileiros (IBGE). Informe uf para a lista do estado. */
export async function GET(request: NextRequest) {
  try {
    const token = extractTokenFromHeader(request.headers.get('authorization') || undefined);
    if (!token || !verifyToken(token)) {
      return NextResponse.json({ error: 'Token de autorização necessário' }, { status: 401 });
    }

    const uf = (request.nextUrl.searchParams.get('uf') || '').trim().toUpperCase();
    if (!uf) return NextResponse.json({ success: true, data: [] });
    if (!UFS.has(uf)) {
      return NextResponse.json({ error: 'UF inválida' }, { status: 400 });
    }

    const data = await municipiosDaUf(uf);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Erro ao listar municípios:', error);
    return NextResponse.json({ error: 'Falha ao consultar municípios do IBGE' }, { status: 502 });
  }
}
