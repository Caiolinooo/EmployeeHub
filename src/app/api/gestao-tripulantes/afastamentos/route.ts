import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createEvento, validateEventData, generateEventXML, validateEventXML, logEnvio, STATUS_EVENTO } from '@/services/eSocialService';
import { syncEsocialStatusFromEvento } from '@/lib/gestao-tripulantes/esocial-sync';
import { exigirCadastroDp, exigirTokenGt } from '@/lib/gestao-tripulantes/gt-route-auth';

// GET: list afastamentos for a collaborator
export async function GET(request: NextRequest) {
  try {
    const denied = exigirTokenGt(request);
    if (denied) return denied;

    const { searchParams } = new URL(request.url);
    const colaboradorId = searchParams.get('colaborador_id');

    if (!colaboradorId) {
      return NextResponse.json({ error: 'colaborador_id obrigatório' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('gt_afastamentos')
      .select('*, gt_colaboradores:colaborador_id (nome_completo, cpf, matricula)')
      .eq('colaborador_id', colaboradorId)
      .is('deleted_at', null)
      .order('data_inicio', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ afastamentos: data || [] });
  } catch (err: any) {
    console.error('[afastamentos] GET error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// POST: create afastamento + auto-generate S-2230
export async function POST(request: NextRequest) {
  try {
    const denied = await exigirCadastroDp(request);
    if (denied) return denied;

    const body = await request.json();
    const {
      colaborador_id,
      tipo_afastamento,
      cod_mot_afast,
      motivo,
      cid,
      data_inicio,
      data_fim,
      data_prevista_retorno,
      observacoes,
      auto_esocial = true,
    } = body;

    if (!colaborador_id || !data_inicio || !tipo_afastamento) {
      return NextResponse.json(
        { error: 'colaborador_id, tipo_afastamento e data_inicio são obrigatórios' },
        { status: 400 }
      );
    }

    // Insert afastamento
    const { data: afastamento, error: insertErr } = await supabaseAdmin
      .from('gt_afastamentos')
      .insert({
        colaborador_id,
        tipo_afastamento,
        cod_mot_afast: cod_mot_afast || mapTipoToCodMot(tipo_afastamento),
        motivo,
        cid,
        data_inicio,
        data_fim,
        data_prevista_retorno,
        observacoes,
        esocial_status: 'nao_enviado',
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    // Auto-generate S-2230 event
    if (auto_esocial && afastamento) {
      await autoGenerateS2230(afastamento);
    }

    return NextResponse.json({ afastamento }, { status: 201 });
  } catch (err: any) {
    console.error('[afastamentos] POST error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

function mapTipoToCodMot(tipo: string): string {
  const map: Record<string, string> = {
    doenca: '01',
    acidente_trabalho: '06',
    licenca_maternidade: '03',
    licenca_paternidade: '19',
    ferias: '15',
    licenca_medica: '01',
    servico_militar: '16',
    mandato_sindical: '24',
    outro: '99',
  };
  return map[tipo] || '01';
}

async function autoGenerateS2230(afastamento: any) {
  try {
    const { data: colab } = await supabaseAdmin
      .from('gt_colaboradores')
      .select('cpf, matricula, nome_completo, gt_empresas:empresa_id (cnpj)')
      .eq('id', afastamento.colaborador_id)
      .maybeSingle();

    if (!colab?.cpf) return;

    const cleanCpf = colab.cpf.replace(/\D/g, '');
    const cnpj = ((colab as any).gt_empresas?.cnpj || '').replace(/\D/g, '');

    const payload = {
      cnpj,
      cpf: cleanCpf,
      matricula: colab.matricula || '',
      dadosEspecificos: {
        dtIniAfast: afastamento.data_inicio,
        codMotAfast: afastamento.cod_mot_afast || '01',
        observacao: afastamento.observacoes || afastamento.motivo || '',
      },
    };

    const dataValidation = validateEventData('S-2230', payload);
    let xml = '';
    let xmlValidation = { valido: false, erros: [] as string[] };

    if (dataValidation.valido) {
      try {
        xml = generateEventXML('S-2230', payload);
        xmlValidation = validateEventXML(xml);
      } catch (e: any) {
        xmlValidation.erros.push(e.message);
      }
    }

    const isValid = dataValidation.valido && xmlValidation.valido;
    const finalStatus = isValid ? STATUS_EVENTO.PENDENTE_REVISAO : STATUS_EVENTO.RASCUNHO;

    const event = await createEvento({
      evento_codigo: 'S-2230',
      cpf_trabalhador: cleanCpf,
      cnpj_empregador: cnpj || undefined,
      matricula: colab.matricula || undefined,
      dados_evento: payload,
      status: finalStatus,
      modulo_origem: 'gestao-tripulantes',
      entidade_origem_id: afastamento.id,
      entidade_origem_tipo: 'gt_afastamentos',
    });

    // Link back
    await supabaseAdmin
      .from('gt_afastamentos')
      .update({
        esocial_status: 'pendente',
        esocial_evento_id: event.id,
      })
      .eq('id', afastamento.id);

    await logEnvio({
      evento_id: event.id,
      acao: 'geracao_xml',
      request_body: JSON.stringify(payload),
      response_body: xml || undefined,
      sucesso: isValid,
      mensagem_erro: isValid ? undefined : [...dataValidation.erros, ...xmlValidation.erros].join('; '),
    });

    console.log(`[afastamentos] S-2230 auto-generated for afastamento ${afastamento.id}`);
  } catch (err) {
    console.error('[afastamentos] Error auto-generating S-2230:', err);
  }
}
