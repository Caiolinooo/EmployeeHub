import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { findColaboradorByCpf } from '@/lib/gestao-tripulantes/cpf-lookup';
import { generateEventXML, validateEventXML, logEnvio } from '@/services/eSocialService';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // 1. Authentication Check
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

    // 2. Parse request body
    const body = await request.json();
    const { eventId, matriculaCorreta } = body;

    if (!eventId || !matriculaCorreta || typeof matriculaCorreta !== 'string') {
      return NextResponse.json({ error: 'Parâmetros inválidos. Informe eventId e matriculaCorreta.' }, { status: 400 });
    }

    const cleanMatricula = matriculaCorreta.trim();
    if (!cleanMatricula) {
      return NextResponse.json({ error: 'A matrícula não pode ser vazia.' }, { status: 400 });
    }

    // 3. Fetch Event
    const { data: evento, error: fetchError } = await supabaseAdmin
      .from('esocial_eventos')
      .select('*')
      .eq('id', eventId)
      .maybeSingle();

    if (fetchError || !evento) {
      return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 });
    }

    if (evento.status === 'processado' && evento.numero_recibo) {
      return NextResponse.json(
        { error: 'Evento já processado com recibo. Não altere a matrícula neste registro.' },
        { status: 409 },
      );
    }

    // 4. Atualiza gt_colaboradores para o próximo envio (S-2220) usar a mesma matrícula
    if (evento.cpf_trabalhador) {
      const colab = await findColaboradorByCpf(evento.cpf_trabalhador);
      if (colab) {
        const { error: colabErr } = await supabaseAdmin
          .from('gt_colaboradores')
          .update({
            matricula: cleanMatricula,
            matricula_esocial: cleanMatricula,
            updated_at: new Date().toISOString(),
          })
          .eq('id', colab.id);
        if (colabErr) {
          console.warn('[CorrigirMatricula] falha ao gravar cadastro GT:', colabErr.message);
        }
      }
    }

    // 5. Build updated payload for event
    const novosDados = {
      ...(evento.dados_evento || {}),
      matricula: cleanMatricula,
      matricula_esocial: cleanMatricula,
      dadosEspecificos: {
        ...(evento.dados_evento?.dadosEspecificos || {}),
        matricula: cleanMatricula,
        matricula_esocial: cleanMatricula
      }
    };

    // 6. Determine Environment for XML regeneration
    const { data: configGeral } = await supabaseAdmin
      .from('esocial_configuracoes')
      .select('valor')
      .eq('chave', 'geral')
      .maybeSingle();
    const isProducao = configGeral?.valor?.ambiente === 'producao';
    const tpAmbValue = isProducao ? 1 : 2;

    // 7. Regenerate XML
    // Spread the original dadosEspecificos then forcibly override matricula fields
    // so the corrected value is never lost to stale data from the spread.
    const raw = novosDados.dadosEspecificos || novosDados;
    const dadosEspecificosCorrigidos = {
      ...raw,
      matricula: cleanMatricula,
      matricula_esocial: cleanMatricula,
    };
    const eventData = {
      cpf: evento.cpf_trabalhador || '',
      cnpj: evento.cnpj_empregador || '',
      tpAmb: tpAmbValue,
      indRetif: novosDados.indRetif || 1,
      matricula: cleanMatricula,
      matricula_esocial: cleanMatricula,
      dadosEspecificos: dadosEspecificosCorrigidos,
    };

    let xmlGerado = '';
    try {
      xmlGerado = generateEventXML(evento.evento_codigo, eventData);
      const xmlValidation = validateEventXML(xmlGerado);
      if (!xmlValidation.valido) {
        console.warn('[CorrigirMatricula] XML gerado inválido:', xmlValidation.erros);
      }
    } catch (xmlErr) {
      console.error('[CorrigirMatricula] Falha ao regenerar XML:', xmlErr);
    }

    // 8. Update event in database
    const { data: updatedEvento, error: updateError } = await supabaseAdmin
      .from('esocial_eventos')
      .update({
        matricula: cleanMatricula,
        dados_evento: novosDados,
        xml_gerado: xmlGerado || null,
        status: 'pendente_revisao',
        erros_processamento: null,
        ultimo_erro: null,
        protocolo_envio: null,
        numero_recibo: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', eventId)
      .select()
      .single();

    if (updateError) {
      console.error('[CorrigirMatricula] Erro ao atualizar evento:', updateError);
      return NextResponse.json({ error: 'Erro ao atualizar evento corrigido no banco' }, { status: 500 });
    }

    // 9. Log the correction action
    await logEnvio({
      evento_id: eventId,
      acao: 'geracao_xml',
      request_body: JSON.stringify(eventData),
      response_body: xmlGerado || undefined,
      sucesso: !!xmlGerado,
      mensagem_erro: xmlGerado ? undefined : 'Falha na regeneração do XML durante a correção de matrícula',
    });

    return NextResponse.json({
      success: true,
      message: 'Matrícula corrigida com sucesso e XML regenerado',
      evento: updatedEvento
    });

  } catch (error) {
    console.error('Erro em POST /api/e-social/corrigir-matricula:', error);
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}
