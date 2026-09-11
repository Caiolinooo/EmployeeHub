import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { validarEPrepararEnvio } from '@/lib/e-social/preEnvioGateway';
import { updateEvento, logEnvio } from '@/services/eSocialService';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    const { data: evento, error: fetchError } = await supabaseAdmin
      .from('esocial_eventos')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchError || !evento) {
      return NextResponse.json({ error: 'Evento não encontrado ou erro ao buscar' }, { status: 404 });
    }

    const { data: configGeral } = await supabaseAdmin
      .from('esocial_configuracoes')
      .select('valor')
      .eq('chave', 'geral')
      .maybeSingle();
      
    const isProducao = configGeral?.valor?.ambiente === 'producao';
    const tpAmbValue = isProducao ? 1 : 2;

    const result = await validarEPrepararEnvio(evento, tpAmbValue);

    if (result.pronto && (result.correcoesAplicadas.length > 0 || result.xml)) {
      const updateData: any = {};
      if (result.dadosCorrigidos) updateData.dados_evento = result.dadosCorrigidos;
      if (result.xml) updateData.xml_gerado = result.xml;
      
      // Auto-aprovação configurável solicitada pelo usuário
      if (evento.status === 'erro' || evento.status === 'pendente_revisao') {
        updateData.status = 'revisao_aprovado';
        updateData.ultimo_erro = null;
        updateData.erros_processamento = null;
      }

      const rejeicaoSchema = !evento.numero_recibo && /schema|xsd|pattern constraint|ts_nome|nmMed/i.test(
        `${evento.ultimo_erro || ''} ${JSON.stringify(evento.erros_processamento || '')}`,
      );
      if (rejeicaoSchema) {
        updateData.protocolo_envio = null;
      }

      await updateEvento(id, updateData);

      await logEnvio({
        evento_id: id,
        acao: 'validacao_api',
        request_body: JSON.stringify({ correcoes: result.correcoesAplicadas }),
        response_body: result.xml,
        sucesso: true
      });

      // Atualiza o objeto para retorno
      Object.assign(evento, updateData);
    } else if (result.dadosCorrigidos) {
      await updateEvento(id, { dados_evento: result.dadosCorrigidos });
      Object.assign(evento, { dados_evento: result.dadosCorrigidos });
    }

    return NextResponse.json({ ...result, evento });
  } catch (error: any) {
    console.error('Erro na rota de validação:', error);
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
  }
}
