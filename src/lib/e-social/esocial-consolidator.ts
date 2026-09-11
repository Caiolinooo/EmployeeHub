/**
 * Consolidator Central do e-Social — Integra e sincroniza eventos trabalhistas
 * de todos os módulos do sistema (Gestão de Tripulantes, MIO, Documentos/ASO, Afastamentos, Acidentes).
 */

import { supabaseAdmin } from '@/lib/supabase';
import { generateS2200, generateS2240, generateS2299 } from '@/services/eSocialAutoService';
import { createEvento, validateEventData, generateEventXML, validateEventXML, logEnvio, STATUS_EVENTO } from '@/services/eSocialService';

export interface ConsolidacaoResult {
  sucesso: boolean;
  totalEventosAntes: number;
  totalEventosDepois: number;
  novosCriados: number;
  admissoesS2200: number;
  asosS2220: number;
  afastamentosS2230: number;
  acidentesS2210: number;
  riscosS2240: number;
  desligamentosS2299: number;
  erros: string[];
}

export async function consolidarEventosDaEmpresa(): Promise<ConsolidacaoResult> {
  const result: ConsolidacaoResult = {
    sucesso: true,
    totalEventosAntes: 0,
    totalEventosDepois: 0,
    novosCriados: 0,
    admissoesS2200: 0,
    asosS2220: 0,
    afastamentosS2230: 0,
    acidentesS2210: 0,
    riscosS2240: 0,
    desligamentosS2299: 0,
    erros: [],
  };

  try {
    // 1. Contagem inicial de eventos
    const { count: countAntes } = await supabaseAdmin
      .from('esocial_eventos')
      .select('*', { count: 'exact', head: true });
    result.totalEventosAntes = countAntes || 0;

    // 2. Buscar eventos existentes em cache para evitar duplicidades
    const { data: existingEventsRaw } = await supabaseAdmin
      .from('esocial_eventos')
      .select('id, evento_codigo, cpf_trabalhador, entidade_origem_id, status');

    const existingByCpfAndCode = new Set<string>();
    const existingByOrigemId = new Set<string>();

    (existingEventsRaw || []).forEach(ev => {
      const cleanCpf = ev.cpf_trabalhador ? String(ev.cpf_trabalhador).replace(/\D/g, '') : '';
      if (cleanCpf && ev.evento_codigo) {
        existingByCpfAndCode.add(`${cleanCpf}:${ev.evento_codigo}`);
      }
      if (ev.entidade_origem_id) {
        existingByOrigemId.add(ev.entidade_origem_id);
      }
    });

    // 3. Buscar todos os colaboradores ativos com cargos e empresas
    const { data: colabs, error: colabErr } = await supabaseAdmin
      .from('gt_colaboradores')
      .select(`
        *,
        gt_cargos:cargo_id (nome),
        gt_empresas:empresa_id (cnpj)
      `)
      .is('deleted_at', null);

    if (colabErr) {
      result.erros.push(`Erro ao buscar colaboradores: ${colabErr.message}`);
    }

    const colaboradores = colabs || [];
    const defaultCnpj = '17784306000189';

    // 4. Consolidar S-2200 (Admissões) e S-2240 (Riscos) e S-2299 (Desligamentos)
    for (const colab of colaboradores) {
      const cleanCpf = colab.cpf ? String(colab.cpf).replace(/\D/g, '') : '';
      if (!cleanCpf || cleanCpf.length !== 11) continue;

      const cnpj = (colab.gt_empresas?.cnpj || defaultCnpj).replace(/\D/g, '');
      const hasAdmissaoData = !!(colab.data_admissao || colab.mio_data?.admitido_em);
      const hasDesligamentoData = !!(colab.data_demissao || colab.mio_data?.demitido_em || colab.mio_data?.situacao === 'Desligado');

      // S-2200 Admissão
      if (hasAdmissaoData && !existingByCpfAndCode.has(`${cleanCpf}:S-2200`)) {
        try {
          const colabWithData = {
            ...colab,
            data_admissao: colab.data_admissao || colab.mio_data?.admitido_em || '2026-02-01',
            salario: colab.salario || (colab.mio_data?.salario ? parseFloat(colab.mio_data.salario) : 3500),
            matricula: colab.matricula || colab.mio_data?.matricula || '101',
          };
          await generateS2200(colabWithData, cnpj, cleanCpf);
          existingByCpfAndCode.add(`${cleanCpf}:S-2200`);
          result.admissoesS2200++;
          result.novosCriados++;
        } catch (err: any) {
          result.erros.push(`S-2200 (${colab.nome_completo}): ${err.message}`);
        }
      }

      // S-2240 Riscos
      if (!existingByCpfAndCode.has(`${cleanCpf}:S-2240`)) {
        try {
          await generateS2240(colab, cnpj, cleanCpf);
          existingByCpfAndCode.add(`${cleanCpf}:S-2240`);
          result.riscosS2240++;
          result.novosCriados++;
        } catch (err: any) {
          result.erros.push(`S-2240 (${colab.nome_completo}): ${err.message}`);
        }
      }

      // S-2299 Desligamento
      if (hasDesligamentoData && !existingByCpfAndCode.has(`${cleanCpf}:S-2299`)) {
        try {
          const colabDemissao = {
            ...colab,
            data_demissao: colab.data_demissao || colab.mio_data?.demitido_em || new Date().toISOString().split('T')[0],
            motivo_demissao: colab.motivo_demissao || colab.mio_data?.motivo_demissao || '10',
          };
          await generateS2299(colabDemissao, cnpj, cleanCpf);
          existingByCpfAndCode.add(`${cleanCpf}:S-2299`);
          result.desligamentosS2299++;
          result.novosCriados++;
        } catch (err: any) {
          result.erros.push(`S-2299 (${colab.nome_completo}): ${err.message}`);
        }
      }
    }

    // 5. Consolidar S-2220 (ASOs)
    const { data: asoRows } = await supabaseAdmin
      .from('gt_documentos_aso')
      .select(`
        *,
        gt_documentos:documento_id (
          id, titulo, data_emissao, data_validade, colaborador_id, deleted_at,
          gt_colaboradores:colaborador_id (nome_completo, cpf, matricula, matricula_esocial)
        )
      `);

    for (const aso of (asoRows || [])) {
      if (!aso.documento_id || aso.gt_documentos?.deleted_at) continue;

      const colab = aso.gt_documentos?.gt_colaboradores;
      const rawCpf = aso.cpf_documento || colab?.cpf || '';
      const cleanCpf = rawCpf.replace(/\D/g, '');
      if (!cleanCpf || cleanCpf.length !== 11) continue;

      // Se já existe evento vinculado ao documento
      if (existingByOrigemId.has(aso.documento_id)) continue;
      if (aso.esocial_evento_id && existingEventsRaw?.some(e => e.id === aso.esocial_evento_id)) continue;

      try {
        const payload = {
          cpf: cleanCpf,
          cnpj: (aso.cnpj_clinica || defaultCnpj).replace(/\D/g, ''),
          matricula: colab?.matricula_esocial || colab?.matricula || undefined,
          dadosEspecificos: {
            nome: colab?.nome_completo || 'Colaborador',
            tipoExame: aso.tipo_exame || 'periodico',
            dataRealizacao: aso.data_realizacao || aso.gt_documentos?.data_emissao || new Date().toISOString().split('T')[0],
            resultado: aso.resultado || 'apto',
            medico: aso.medico_nome || 'Médico Examinador',
            crm: aso.medico_crm || '00000',
            uf: aso.medico_uf || 'RJ',
            exames_realizados: aso.exames_realizados || [],
          }
        };

        const finalStatus = (aso.esocial_status === 'processado' || aso.esocial_status === 'enviado' || aso.esocial_status === 'erro')
          ? aso.esocial_status
          : 'rascunho';

        const created = await createEvento({
          evento_codigo: 'S-2220',
          cpf_trabalhador: cleanCpf,
          cnpj_empregador: (aso.cnpj_clinica || defaultCnpj).replace(/\D/g, ''),
          matricula: colab?.matricula_esocial || colab?.matricula || undefined,
          dados_evento: payload,
          status: finalStatus as any,
          modulo_origem: 'ocr',
          entidade_origem_id: aso.documento_id,
          entidade_origem_tipo: 'aso',
          protocolo_envio: aso.esocial_protocolo || null,
          numero_recibo: aso.esocial_numero_recibo || null,
        });

        await supabaseAdmin
          .from('gt_documentos_aso')
          .update({ esocial_evento_id: created.id })
          .eq('id', aso.id);

        existingByOrigemId.add(aso.documento_id);
        result.asosS2220++;
        result.novosCriados++;
      } catch (asoErr: any) {
        result.erros.push(`S-2220 (doc ${aso.documento_id}): ${asoErr.message}`);
      }
    }

    // 6. Consolidar S-2230 (Afastamentos)
    const { data: afastamentos } = await supabaseAdmin
      .from('gt_afastamentos')
      .select('*, gt_colaboradores:colaborador_id (nome_completo, cpf, matricula, matricula_esocial)')
      .is('deleted_at', null);

    for (const afast of (afastamentos || [])) {
      if (afast.esocial_evento_id && existingEventsRaw?.some(e => e.id === afast.esocial_evento_id)) continue;
      if (existingByOrigemId.has(afast.id)) continue;

      const colab = afast.gt_colaboradores;
      const cleanCpf = colab?.cpf ? String(colab.cpf).replace(/\D/g, '') : '';
      if (!cleanCpf) continue;

      try {
        const payload = {
          cpf: cleanCpf,
          cnpj: defaultCnpj,
          matricula: colab?.matricula_esocial || colab?.matricula || undefined,
          dadosEspecificos: {
            nome: colab?.nome_completo || 'Colaborador',
            dtIniAfast: afast.data_inicio,
            codMotAfast: afast.cod_mot_afast || '01',
            infoAtestado: afast.cid ? { codCID: afast.cid } : undefined,
            observacao: afast.motivo || afast.observacoes || undefined,
          }
        };

        const created = await createEvento({
          evento_codigo: 'S-2230',
          cpf_trabalhador: cleanCpf,
          cnpj_empregador: defaultCnpj,
          matricula: colab?.matricula_esocial || colab?.matricula || undefined,
          dados_evento: payload,
          status: (afast.esocial_status || 'rascunho') as any,
          modulo_origem: 'gt_afastamentos',
          entidade_origem_id: afast.id,
          entidade_origem_tipo: 'afastamento',
          protocolo_envio: afast.esocial_protocolo || null,
          numero_recibo: afast.esocial_numero_recibo || null,
        });

        await supabaseAdmin
          .from('gt_afastamentos')
          .update({ esocial_evento_id: created.id })
          .eq('id', afast.id);

        existingByOrigemId.add(afast.id);
        result.afastamentosS2230++;
        result.novosCriados++;
      } catch (afastErr: any) {
        result.erros.push(`S-2230 (${afast.id}): ${afastErr.message}`);
      }
    }

    // 7. Consolidar S-2210 (Acidentes de Trabalho / CAT)
    const { data: acidentes } = await supabaseAdmin
      .from('gt_acidentes')
      .select('*, gt_colaboradores:colaborador_id (nome_completo, cpf, matricula, matricula_esocial)')
      .is('deleted_at', null);

    for (const acid of (acidentes || [])) {
      if (acid.esocial_evento_id && existingEventsRaw?.some(e => e.id === acid.esocial_evento_id)) continue;
      if (existingByOrigemId.has(acid.id)) continue;

      const colab = acid.gt_colaboradores;
      const cleanCpf = colab?.cpf ? String(colab.cpf).replace(/\D/g, '') : '';
      if (!cleanCpf) continue;

      try {
        const payload = {
          cpf: cleanCpf,
          cnpj: defaultCnpj,
          matricula: colab?.matricula_esocial || colab?.matricula || undefined,
          dadosEspecificos: {
            nome: colab?.nome_completo || 'Colaborador',
            dtAcidente: acid.data_acidente,
            tpCat: acid.tipo_cat || '1',
            obs: acid.descricao || undefined,
          }
        };

        const created = await createEvento({
          evento_codigo: 'S-2210',
          cpf_trabalhador: cleanCpf,
          cnpj_empregador: defaultCnpj,
          matricula: colab?.matricula_esocial || colab?.matricula || undefined,
          dados_evento: payload,
          status: (acid.esocial_status || 'rascunho') as any,
          modulo_origem: 'gt_acidentes',
          entidade_origem_id: acid.id,
          entidade_origem_tipo: 'acidente',
          protocolo_envio: acid.esocial_protocolo || null,
          numero_recibo: acid.esocial_numero_recibo || null,
        });

        await supabaseAdmin
          .from('gt_acidentes')
          .update({ esocial_evento_id: created.id })
          .eq('id', acid.id);

        existingByOrigemId.add(acid.id);
        result.acidentesS2210++;
        result.novosCriados++;
      } catch (acidErr: any) {
        result.erros.push(`S-2210 (${acid.id}): ${acidErr.message}`);
      }
    }

    // 8. Contagem final
    const { count: countDepois } = await supabaseAdmin
      .from('esocial_eventos')
      .select('*', { count: 'exact', head: true });
    result.totalEventosDepois = countDepois || 0;

  } catch (globalErr: any) {
    result.sucesso = false;
    result.erros.push(`Erro crítico na consolidação: ${globalErr.message}`);
  }

  return result;
}
