import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    let token = extractTokenFromHeader(authHeader || undefined);
    if (!token) {
      const tokenCookie = request.cookies.get('abzToken') || request.cookies.get('token');
      if (tokenCookie) token = tokenCookie.value;
    }
    if (!token) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }
    const payload = verifyToken(token);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const codigo = searchParams.get('codigo');
    const modulo_origem = searchParams.get('modulo_origem');
    const cpfParam = searchParams.get('cpf') || searchParams.get('cpf_trabalhador') || searchParams.get('funcionario_id');
    const searchParam = searchParams.get('search') || searchParams.get('busca') || searchParams.get('q');
    const cnpj_empregador = searchParams.get('cnpj_empregador');
    const competencia = searchParams.get('competencia');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.max(1, parseInt(searchParams.get('limit') || '50'));
    const offsetParam = searchParams.get('offset');
    const offset = offsetParam !== null ? Math.max(0, parseInt(offsetParam)) : (page - 1) * limit;

    let query = supabaseAdmin
      .from('esocial_eventos')
      .select('*, esocial_eventos_catalogo!evento_codigo(nome)', { count: 'exact' });

    // Status filtering (support groups and single status)
    if (status) {
      if (status === 'enviados' || status === 'transmitidos') {
        query = query.or('status.in.(enviado,processado,sucesso,transmitido),numero_recibo.not.is.null,protocolo_envio.not.is.null');
      } else if (status === 'pendencias' || status === 'fila') {
        query = query.in('status', ['rascunho', 'pendente_revisao', 'revisao_aprovado', 'fila_envio']).is('numero_recibo', null);
      } else if (status === 'revisao') {
        query = query.eq('status', 'pendente_revisao').is('numero_recibo', null);
      } else if (status === 'erro') {
        query = query.in('status', ['erro', 'devolvido', 'revisao_rejeitado']).is('numero_recibo', null);
      } else {
        query = query.eq('status', status);
      }
    }

    // Code filtering (e.g., '2220' or 'S-2220')
    if (codigo) {
      const formattedCode = codigo.toUpperCase().startsWith('S-') ? codigo.toUpperCase() : `S-${codigo.toUpperCase()}`;
      query = query.or(`evento_codigo.eq.${formattedCode},evento_codigo.ilike.%${codigo}%`);
    }

    if (modulo_origem) query = query.eq('modulo_origem', modulo_origem);
    if (cnpj_empregador) query = query.eq('cnpj_empregador', cnpj_empregador.replace(/\D/g, ''));
    if (competencia) query = query.eq('dados_evento->>competencia', competencia);

    // Filter by specific CPF or general search term (worker name, CPF with/without mask)
    const effectiveSearch = (cpfParam || searchParam || '').trim();
    if (effectiveSearch) {
      const cleanSearchDigits = effectiveSearch.replace(/\D/g, '');
      const searchConditions: string[] = [];

      if (cleanSearchDigits.length >= 3) {
        searchConditions.push(`cpf_trabalhador.ilike.%${cleanSearchDigits}%`);
      }
      searchConditions.push(`matricula.ilike.%${effectiveSearch}%`);

      // If search has alphabetic characters, search worker names in gt_colaboradores first
      if (/[a-zA-Z]/.test(effectiveSearch)) {
        const { data: matchedColabs } = await supabaseAdmin
          .from('gt_colaboradores')
          .select('cpf')
          .ilike('nome_completo', `%${effectiveSearch}%`)
          .limit(50);

        if (matchedColabs && matchedColabs.length > 0) {
          const matchedCpfs = matchedColabs
            .map(c => String(c.cpf || '').replace(/\D/g, ''))
            .filter(Boolean);

          matchedCpfs.forEach(c => searchConditions.push(`cpf_trabalhador.eq.${c}`));
        }
      }

      if (searchConditions.length > 0) {
        query = query.or(searchConditions.join(','));
      }
    }

    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Erro ao listar eventos e-social:', error);
      return NextResponse.json({ error: 'Erro ao listar eventos' }, { status: 500 });
    }

    // 1. Collect CPFs and Colaborador IDs to resolve worker identity in batch
    const rawCpfs = (data || []).map((i: any) => i.cpf_trabalhador).filter(Boolean);
    const cleanCpfs = Array.from(new Set(rawCpfs.map((c: string) => String(c).replace(/\D/g, ''))));
    
    const colabMapByCpf = new Map<string, any>();
    if (cleanCpfs.length > 0) {
      const allCpfVariants = cleanCpfs.flatMap(c => [
        c,
        c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
      ]);
      const { data: colabs } = await supabaseAdmin
        .from('gt_colaboradores')
        .select('id, nome_completo, cpf, matricula, matricula_esocial, foto_url, mio_data, gt_cargos:cargo_id(nome)')
        .in('cpf', allCpfVariants);

      if (colabs) {
        for (const colab of colabs) {
          const normCpf = String(colab.cpf || '').replace(/\D/g, '');
          if (normCpf) colabMapByCpf.set(normCpf, colab);
        }
      }
    }

    const eventos = (data || []).map((item: any) => {
      const cleanCpf = item.cpf_trabalhador ? String(item.cpf_trabalhador).replace(/\D/g, '') : '';
      const colab = cleanCpf ? colabMapByCpf.get(cleanCpf) : null;
      
      const nomeEspecifico = item.dados_evento?.dadosEspecificos?.nome 
        || item.dados_evento?.trabalhador?.nome 
        || item.dados_evento?.nome
        || null;

      const cargoEspecifico = item.dados_evento?.dadosEspecificos?.cargo
        || item.dados_evento?.cargo
        || null;

      const resolvedStatus = item.numero_recibo 
        ? 'processado' 
        : (item.protocolo_envio && (item.status === 'erro' || item.status === 'rascunho') ? 'enviado' : item.status);

      return {
        ...item,
        status: resolvedStatus,
        evento_nome: item.esocial_eventos_catalogo?.nome || null,
        colaborador_nome: colab?.nome_completo || nomeEspecifico || null,
        colaborador_cargo: colab?.gt_cargos?.nome || colab?.mio_data?.cargo || colab?.mio_data?.cargo_funcao || cargoEspecifico || null,
        colaborador_matricula: colab?.matricula_esocial || colab?.matricula || item.matricula || null,
        colaborador_foto: colab?.foto_url || null,
      };
    });

    // Fetch dashboard summary using admin client
    const { data: dashboardData } = await supabaseAdmin
      .from('esocial_vw_dashboard')
      .select('*')
      .maybeSingle();

    const totalCount = count || 0;
    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      success: true,
      eventos,
      total: totalCount,
      page,
      limit,
      offset,
      totalPages,
      resumo: dashboardData || null,
    });
  } catch (error) {
    console.error('Erro em GET /api/e-social/eventos:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    let token = extractTokenFromHeader(authHeader || undefined);
    if (!token) {
      const tokenCookie = request.cookies.get('abzToken') || request.cookies.get('token');
      if (tokenCookie) token = tokenCookie.value;
    }
    if (!token) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }
    const payload = verifyToken(token);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const body = await request.json();

    if (!body.evento_codigo) {
      return NextResponse.json({ error: 'evento_codigo é obrigatório' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('esocial_eventos')
      .insert({
        evento_codigo: body.evento_codigo,
        cpf_trabalhador: body.cpf_trabalhador ? String(body.cpf_trabalhador).replace(/\D/g, '') : (body.cpf ? String(body.cpf).replace(/\D/g, '') : null),
        cnpj_empregador: body.cnpj_empregador ? String(body.cnpj_empregador).replace(/\D/g, '') : (body.cnpj ? String(body.cnpj).replace(/\D/g, '') : null),
        matricula: body.matricula || null,
        dados_evento: body.dados_evento || {},
        status: body.status || 'rascunho',
        modulo_origem: body.modulo_origem || 'manual',
        entidade_origem_id: body.entidade_origem_id || null,
        entidade_origem_tipo: body.entidade_origem_tipo || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar evento e-social:', error);
      return NextResponse.json({ error: 'Erro ao criar evento' }, { status: 500 });
    }

    return NextResponse.json({ success: true, evento: data }, { status: 201 });
  } catch (error) {
    console.error('Erro em POST /api/e-social/eventos:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
