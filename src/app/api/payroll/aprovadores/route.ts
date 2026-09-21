import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { garantirNivelPayroll, carregarAprovadoresConfig } from '@/lib/payroll/payroll-auth';

export const dynamic = 'force-dynamic';

/** Colunas do lookup users_unified no GET (boundary Supabase). */
interface UsuarioLookupRow {
  id: string;
  email?: string | null;
  active?: boolean | null;
}

/**
 * GET /api/payroll/aprovadores
 * Lista a config `payroll_aprovadores_config` (settings) com email resolvido.
 */
export async function GET(request: NextRequest) {
  try {
    const gate = await garantirNivelPayroll(request, 'view');
    if (!gate.ok) return gate.error;

    const aprovadores = await carregarAprovadoresConfig();
    const ids = aprovadores.map((a) => a.user_id);

    const emailById = new Map<string, { email: string; ativo: boolean }>();
    if (ids.length > 0) {
      const { data: users } = await supabaseAdmin
        .from('users_unified')
        .select('id, email, active')
        .in('id', ids);
      const linhas = (users || []) as UsuarioLookupRow[]; // colunas exatas do select acima
      for (const u of linhas) {
        emailById.set(u.id, { email: String(u.email || ''), ativo: u.active !== false });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        aprovadores: aprovadores.map((a) => ({
          ...a,
          email: emailById.get(a.user_id)?.email || null,
          ativo: emailById.get(a.user_id)?.ativo ?? false,
        })),
      },
    });
  } catch (error) {
    console.error('[API payroll/aprovadores GET Error]', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao carregar aprovadores' },
      { status: 500 },
    );
  }
}

interface AprovadorEntrada {
  user_id: string;
  nome: string;
  papel?: string | null;
  ordem?: number | null;
}

/** Valida e normaliza o corpo do PUT: array de { user_id, nome, papel?, ordem? }. */
function normalizarEntrada(raw: unknown): { itens: AprovadorEntrada[] } | { erro: string } {
  if (!Array.isArray(raw)) {
    return { erro: 'Corpo deve ser um array de aprovadores' };
  }
  const itens: AprovadorEntrada[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return { erro: 'Cada aprovador deve ser um objeto' };
    }
    const rec = item as Record<string, unknown>;
    const userId = typeof rec.user_id === 'string' ? rec.user_id.trim() : '';
    if (!userId) return { erro: 'Cada aprovador precisa de user_id' };
    itens.push({
      user_id: userId,
      nome: typeof rec.nome === 'string' && rec.nome.trim() ? rec.nome.trim() : 'Aprovador',
      papel: typeof rec.papel === 'string' && rec.papel.trim() ? rec.papel.trim() : null,
      ordem: typeof rec.ordem === 'number' && Number.isFinite(rec.ordem) ? rec.ordem : null,
    });
  }
  return { itens };
}

/**
 * PUT /api/payroll/aprovadores
 * Grava a config em settings (key 'payroll_aprovadores_config').
 * Gate 'edit' + ADMIN (checagem de role sobre gate.user).
 */
export async function PUT(request: NextRequest) {
  try {
    const gate = await garantirNivelPayroll(request, 'edit');
    if (!gate.ok) return gate.error;
    if ((gate.user.role || '').toUpperCase() !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Apenas administradores podem alterar a lista de aprovadores' },
        { status: 403 },
      );
    }

    const body = (await request.json().catch(() => null)) as { aprovadores?: unknown } | unknown[] | null;
    let bruto: unknown = null;
    if (Array.isArray(body)) {
      bruto = body;
    } else if (body) {
      bruto = body.aprovadores;
    }
    const normalizado = normalizarEntrada(bruto);
    if ('erro' in normalizado) {
      return NextResponse.json({ success: false, error: normalizado.erro }, { status: 400 });
    }

    // Todos os user_id precisam existir no portal — nunca aprovar fantasma.
    const ids = normalizado.itens.map((a) => a.user_id);
    const { data: users } = await supabaseAdmin
      .from('users_unified')
      .select('id')
      .in('id', ids);
    const existentes = new Set(
      ((users || []) as Array<Pick<UsuarioLookupRow, 'id'>>).map((u) => u.id),
    );
    const ausentes = ids.filter((id) => !existentes.has(id));
    if (ausentes.length > 0) {
      return NextResponse.json(
        { success: false, error: `Usuários não encontrados: ${ausentes.join(', ')}` },
        { status: 400 },
      );
    }

    const { error } = await supabaseAdmin
      .from('settings')
      .upsert(
        {
          key: 'payroll_aprovadores_config',
          value: normalizado.itens,
          description: 'Config de aprovadores da folha de pagamento',
        },
        { onConflict: 'key' },
      );
    if (error) {
      console.error('[API payroll/aprovadores PUT Error]', error);
      return NextResponse.json(
        { success: false, error: 'Erro ao gravar config de aprovadores' },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, data: { aprovadores: normalizado.itens } });
  } catch (error) {
    console.error('[API payroll/aprovadores PUT Error]', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 },
    );
  }
}
