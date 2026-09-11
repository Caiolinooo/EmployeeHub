import { supabaseAdmin } from '@/lib/supabase';
import {
  STATUS_EVENTO,
  validateEventData,
  generateEventXML,
  validateEventXML,
  createEvento,
  updateEvento,
  logEnvio,
} from './eSocialService';

export async function autoGenerateESocialEvents(colaboradorId: string): Promise<void> {
  console.log(`[eSocialAuto] Starting auto-generation for collaborator ${colaboradorId}...`);
  try {
    // 1. Retrieve full collaborator details with cargo and company details
    const { data: colab, error: colabError } = await supabaseAdmin
      .from('gt_colaboradores')
      .select(`
        *,
        gt_cargos:cargo_id (nome),
        gt_empresas:empresa_id (cnpj)
      `)
      .eq('id', colaboradorId)
      .maybeSingle();

    if (colabError) {
      console.error(`[eSocialAuto] Error fetching collaborator ${colaboradorId}:`, colabError);
      return;
    }
    if (!colab) {
      console.warn(`[eSocialAuto] Collaborator ${colaboradorId} not found`);
      return;
    }

    const rawCpf = colab.cpf || '';
    const cleanCpf = rawCpf.replace(/\D/g, '');
    if (!cleanCpf) {
      console.warn(`[eSocialAuto] Collaborator ${colaboradorId} does not have a CPF`);
      return;
    }

    // 2. Try to enrich with MIO data (non-blocking)
    try {
      let mioData: any = null;

      const { data: cacheRow } = await supabaseAdmin
        .from('mio_cache')
        .select('dados, atualizado_em')
        .eq('tipo', 'integrantes')
        .maybeSingle();
      
      const cacheData = cacheRow?.dados;
      if (Array.isArray(cacheData)) {
        mioData = cacheData.find((i: any) => {
          const c = (i.cpf || i.cpf_numero || '').replace(/\D/g, '');
          return c === cleanCpf;
        });
      }

      if (!mioData) {
        console.log(`[eSocialAuto] CPF ${cleanCpf} not in mio_cache. Proceeding with local gt_colaboradores only.`);
      }

      if (mioData) {
        const updateFields: Record<string, any> = {
          origem: 'mio',
          mio_id: mioData.id ? String(mioData.id) : undefined,
          mio_data: mioData,
          matricula: mioData.matricula || colab.matricula,
          updated_at: new Date().toISOString()
        };
        Object.keys(updateFields).forEach(k => {
          if (updateFields[k] === undefined) delete updateFields[k];
        });
        await supabaseAdmin.from('gt_colaboradores').update(updateFields).eq('id', colaboradorId);
        console.log(`[eSocialAuto] Collaborator enriched with MIO data (ID: ${mioData.id})`);
      } else {
        console.log(`[eSocialAuto] CPF not found in MIO. Proceeding with local data only.`);
      }
    } catch (mioErr) {
      console.error('[eSocialAuto] Failed to query MIO, proceeding with local data:', mioErr);
    }

    // 3. Verify if S-2200 and S-2240 already exist for the CPF in `esocial_eventos`
    const { data: existingEvents, error: eventsError } = await supabaseAdmin
      .from('esocial_eventos')
      .select('evento_codigo')
      .eq('cpf_trabalhador', cleanCpf)
      .in('evento_codigo', ['S-2200', 'S-2240']);

    if (eventsError) {
      console.error('[eSocialAuto] Error checking existing events:', eventsError);
      return;
    }

    const hasS2200 = existingEvents?.some(e => e.evento_codigo === 'S-2200');
    const hasS2240 = existingEvents?.some(e => e.evento_codigo === 'S-2240');

    const cnpjEmpregador = (colab.gt_empresas?.cnpj || '').replace(/\D/g, '');

    // 4. Generate S-2200 if not exists
    if (!hasS2200) {
      await generateS2200(colab, cnpjEmpregador, cleanCpf);
    } else {
      console.log(`[eSocialAuto] S-2200 already exists for CPF ${cleanCpf}. Skipping S-2200 auto-generation.`);
    }

    // 5. Generate S-2240 if not exists
    if (!hasS2240) {
      await generateS2240(colab, cnpjEmpregador, cleanCpf);
    } else {
      console.log(`[eSocialAuto] S-2240 already exists for CPF ${cleanCpf}. Skipping S-2240 auto-generation.`);
    }

    // 6. Generate S-2299 if collaborator has demission date
    if (colab.data_demissao) {
      const hasS2299 = existingEvents?.some(e => e.evento_codigo === 'S-2299');
      if (!hasS2299) {
        await generateS2299(colab, cnpjEmpregador, cleanCpf);
      }
    }

  } catch (err) {
    console.error('[eSocialAuto] Unexpected error in auto-generation hook:', err);
  }
}

export async function generateS2200(colab: any, cnpjEmpregador: string, cleanCpf: string) {
  console.log(`[eSocialAuto] Generating S-2200 for ${colab.nome_completo}...`);
  
  // Mapping options to codes
  // Admissão -> 1, Transferência -> 2, Readaptação -> 3
  const tipoAdmissaoMap: Record<string, number> = {
    'admissão': 1,
    'transferência': 2,
    'readaptação': 3
  };
  const tipoAdmissaoNum = tipoAdmissaoMap[String(colab.tipo_admissao || 'Admissão').toLowerCase()] || 1;

  // Urbana -> 1, Rural -> 2
  const natAtividadeMap: Record<string, number> = {
    'urbana': 1,
    'rural': 2
  };
  const natAtividadeNum = natAtividadeMap[String(colab.natureza_atividade || 'Urbana').toLowerCase()] || 1;

  // Jornada Fixa -> 1, Jornada Variável -> 2
  const tipoJornadaMap: Record<string, number> = {
    'jornada fixa': 1,
    'jornada variável': 2
  };
  const tpRegJornNum = tipoJornadaMap[String(colab.tipo_jornada || 'Jornada Fixa').toLowerCase()] || 1;

  // Salário
  const tipoSalarioMap: Record<string, number> = {
    'mensal': 7,
    'por hora': 1,
    'por dia': 2,
    'comissionado': 6
  };
  const undSalFixoNum = tipoSalarioMap[String(colab.tipo_salario || 'Mensal').toLowerCase()] || 7;

  // Contrato
  const tipoContratoMap: Record<string, number> = {
    'clt': 1,
    'pj': 2,
    'temporário': 2,
    'estágio': 2,
    'autônomo': 2
  };
  const tpContrNum = tipoContratoMap[String(colab.tipo_contrato || 'CLT').toLowerCase()] || 1;

  // Lotação
  let tpLotacaoNum = 1;
  if (colab.tipo_lotacao) {
    const parsed = parseInt(colab.tipo_lotacao.substring(0, 2), 10);
    if (!isNaN(parsed)) tpLotacaoNum = parsed;
  }

  const cargoNome = colab.gt_cargos?.nome || '';

  const payload = {
    cnpj: cnpjEmpregador,
    cpf: cleanCpf,
    dadosEspecificos: {
      nome: colab.nome_completo,
      nis: colab.pis_pasep || '',
      matricula_esocial: colab.matricula_esocial || '',
      matricula: colab.matricula || '',
      dataAdmissao: colab.data_admissao || '',
      tipoAdmissao: tipoAdmissaoNum,
      tpRegJorn: tpRegJornNum,
      natAtividade: natAtividadeNum,
      dtBase: 1,
      cnpjSind: cnpjEmpregador || '',
      codCargo: colab.cargo_id ? colab.cargo_id.substring(0, 8) : '001',
      cargo: cargoNome,
      codCBO: colab.cbo || '',
      salario: colab.salario || 0,
      undSalFixo: undSalFixoNum,
      tpContr: tpContrNum,
      tpLotacao: tpLotacaoNum,
      codLotacao: '001',
    }
  };

  // Validate payload data
  const dataValidation = validateEventData('S-2200', payload);

  let xml = '';
  let xmlValidation = { valido: false, erros: [] as string[] };
  
  if (dataValidation.valido) {
    try {
      xml = generateEventXML('S-2200', payload);
      xmlValidation = validateEventXML(xml);
    } catch (xmlErr: any) {
      xmlValidation.erros.push(xmlErr.message || 'Erro durante geração XML');
    }
  }

  const isValid = dataValidation.valido && xmlValidation.valido;
  const finalStatus = isValid ? STATUS_EVENTO.PENDENTE_REVISAO : STATUS_EVENTO.RASCUNHO;

  try {
    const { data: existingS2200 } = await supabaseAdmin
      .from('esocial_eventos')
      .select('id, status')
      .eq('cpf_trabalhador', cleanCpf)
      .eq('evento_codigo', 'S-2200')
      .maybeSingle();

    if (existingS2200) {
      if (existingS2200.status === STATUS_EVENTO.RASCUNHO || existingS2200.status === STATUS_EVENTO.PENDENTE_REVISAO || existingS2200.status === 'pendente') {
        await updateEvento(existingS2200.id, {
          matricula: colab.matricula_esocial || colab.matricula || undefined,
          dados_evento: payload,
          xml_gerado: xml || undefined,
          status: finalStatus,
          updated_at: new Date().toISOString(),
        });
        console.log(`[eSocialAuto] S-2200 event updated for CPF ${cleanCpf}. Status: ${finalStatus}`);
        return;
      }
    }

    const createdEvent = await createEvento({
      evento_codigo: 'S-2200',
      cpf_trabalhador: cleanCpf,
      cnpj_empregador: cnpjEmpregador || undefined,
      matricula: colab.matricula_esocial || colab.matricula || undefined,
      dados_evento: payload,
      status: finalStatus,
      modulo_origem: 'auto',
      entidade_origem_id: colab.id,
      entidade_origem_tipo: 'gt_colaboradores'
    });

    if (xml && xmlValidation.valido) {
      await updateEvento(createdEvent.id, { xml_gerado: xml });
    }

    // Log the XML generation status
    await logEnvio({
      evento_id: createdEvent.id,
      acao: 'geracao_xml',
      request_body: JSON.stringify(payload),
      response_body: xml || undefined,
      sucesso: isValid,
      mensagem_erro: isValid ? undefined : [...dataValidation.erros, ...xmlValidation.erros].join('; '),
    });

    console.log(`[eSocialAuto] S-2200 event created successfully for CPF ${cleanCpf}. Status: ${finalStatus}`);
  } catch (insertErr) {
    console.error(`[eSocialAuto] Error inserting S-2200 event for CPF ${cleanCpf}:`, insertErr);
  }
}

export async function generateS2240(colab: any, cnpjEmpregador: string, cleanCpf: string) {
  console.log(`[eSocialAuto] Generating S-2240 for ${colab.nome_completo}...`);

  const cargoNome = colab.gt_cargos?.nome || 'Colaborador';
  
  const payload = {
    cnpj: cnpjEmpregador,
    cpf: cleanCpf,
    matricula_esocial: colab.matricula_esocial || undefined,
    matricula: colab.matricula || undefined,
    dadosEspecificos: {
      nome: colab.nome_completo,
      matricula_esocial: colab.matricula_esocial || '',
      matricula: colab.matricula || '',
      nis: colab.pis_pasep || '',
      fatorRisco: '09.01.001',
      condicoesAmbiente: `Atividades operacionais/administrativas no exercício da função de ${cargoNome}. Ambiente controlado sem exposição a fatores de risco nocivos acima dos limites de tolerância.`,
      epiEficaz: 'NA',
    }
  };

  const dataValidation = validateEventData('S-2240', payload);

  let xml = '';
  let xmlValidation = { valido: false, erros: [] as string[] };

  if (dataValidation.valido) {
    try {
      xml = generateEventXML('S-2240', payload);
      xmlValidation = validateEventXML(xml);
    } catch (xmlErr: any) {
      xmlValidation.erros.push(xmlErr.message || 'Erro durante geração XML');
    }
  }

  const isValid = dataValidation.valido && xmlValidation.valido;
  const finalStatus = isValid ? STATUS_EVENTO.PENDENTE_REVISAO : STATUS_EVENTO.RASCUNHO;

  try {
    const { data: existingS2240 } = await supabaseAdmin
      .from('esocial_eventos')
      .select('id, status')
      .eq('cpf_trabalhador', cleanCpf)
      .eq('evento_codigo', 'S-2240')
      .maybeSingle();

    if (existingS2240) {
      if (existingS2240.status === STATUS_EVENTO.RASCUNHO || existingS2240.status === STATUS_EVENTO.PENDENTE_REVISAO || existingS2240.status === 'pendente') {
        await updateEvento(existingS2240.id, {
          matricula: colab.matricula_esocial || colab.matricula || undefined,
          dados_evento: payload,
          xml_gerado: xml || undefined,
          status: finalStatus,
          updated_at: new Date().toISOString(),
        });
        console.log(`[eSocialAuto] S-2240 event updated for CPF ${cleanCpf}. Status: ${finalStatus}`);
        return;
      }
    }

    const createdEvent = await createEvento({
      evento_codigo: 'S-2240',
      cpf_trabalhador: cleanCpf,
      cnpj_empregador: cnpjEmpregador || undefined,
      matricula: colab.matricula_esocial || colab.matricula || undefined,
      dados_evento: payload,
      status: finalStatus,
      modulo_origem: 'auto',
      entidade_origem_id: colab.id,
      entidade_origem_tipo: 'gt_colaboradores'
    });

    if (xml && xmlValidation.valido) {
      await updateEvento(createdEvent.id, { xml_gerado: xml });
    }

    // Log the XML generation status
    await logEnvio({
      evento_id: createdEvent.id,
      acao: 'geracao_xml',
      request_body: JSON.stringify(payload),
      response_body: xml || undefined,
      sucesso: isValid,
      mensagem_erro: isValid ? undefined : [...dataValidation.erros, ...xmlValidation.erros].join('; '),
    });

    console.log(`[eSocialAuto] S-2240 event created successfully for CPF ${cleanCpf}. Status: ${finalStatus}`);
  } catch (insertErr) {
    console.error(`[eSocialAuto] Error inserting S-2240 event for CPF ${cleanCpf}:`, insertErr);
  }
}

export async function generateS2299(colab: any, cnpjEmpregador: string, cleanCpf: string) {
  console.log(`[eSocialAuto] Generating S-2299 for ${colab.nome_completo}...`);

  const payload = {
    cnpj: cnpjEmpregador,
    cpf: cleanCpf,
    matricula_esocial: colab.matricula_esocial || undefined,
    matricula: colab.matricula || undefined,
    dadosEspecificos: {
      mtvDeslig: colab.motivo_demissao || '10',
      dtDeslig: colab.data_demissao,
      observacoes: `Desligamento registrado em ${colab.data_demissao}`,
    }
  };

  const dataValidation = validateEventData('S-2299', payload);
  let xml = '';
  let xmlValidation = { valido: false, erros: [] as string[] };

  if (dataValidation.valido) {
    try {
      xml = generateEventXML('S-2299', payload);
      xmlValidation = validateEventXML(xml);
    } catch (xmlErr: any) {
      xmlValidation.erros.push(xmlErr.message || 'Erro durante geração XML');
    }
  }

  const isValid = dataValidation.valido && xmlValidation.valido;
  const finalStatus = isValid ? STATUS_EVENTO.PENDENTE_REVISAO : STATUS_EVENTO.RASCUNHO;

  try {
    const { data: existingS2299 } = await supabaseAdmin
      .from('esocial_eventos')
      .select('id, status')
      .eq('cpf_trabalhador', cleanCpf)
      .eq('evento_codigo', 'S-2299')
      .maybeSingle();

    if (existingS2299) {
      if (existingS2299.status === STATUS_EVENTO.RASCUNHO || existingS2299.status === STATUS_EVENTO.PENDENTE_REVISAO || existingS2299.status === 'pendente') {
        await updateEvento(existingS2299.id, {
          matricula: colab.matricula_esocial || colab.matricula || undefined,
          dados_evento: payload,
          xml_gerado: xml || undefined,
          status: finalStatus,
          updated_at: new Date().toISOString(),
        });
        console.log(`[eSocialAuto] S-2299 event updated for CPF ${cleanCpf}. Status: ${finalStatus}`);
        return;
      }
    }

    const createdEvent = await createEvento({
      evento_codigo: 'S-2299',
      cpf_trabalhador: cleanCpf,
      cnpj_empregador: cnpjEmpregador || undefined,
      matricula: colab.matricula_esocial || colab.matricula || undefined,
      dados_evento: payload,
      status: finalStatus,
      modulo_origem: 'auto',
      entidade_origem_id: colab.id,
      entidade_origem_tipo: 'gt_colaboradores'
    });

    if (xml && xmlValidation.valido) {
      await updateEvento(createdEvent.id, { xml_gerado: xml });
    }

    await logEnvio({
      evento_id: createdEvent.id,
      acao: 'geracao_xml',
      request_body: JSON.stringify(payload),
      response_body: xml || undefined,
      sucesso: isValid,
      mensagem_erro: isValid ? undefined : [...dataValidation.erros, ...xmlValidation.erros].join('; '),
    });

    console.log(`[eSocialAuto] S-2299 event created successfully for CPF ${cleanCpf}. Status: ${finalStatus}`);
  } catch (insertErr) {
    console.error(`[eSocialAuto] Error inserting S-2299 event for CPF ${cleanCpf}:`, insertErr);
  }
}
