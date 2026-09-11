import { createClient } from '@supabase/supabase-js';
import { generateEventXML, validateEventXML } from '../src/services/eSocialService';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const eventId = '75c7ee81-210a-417d-ad3c-12e1b126b660';
  
  // 1. Fetch event
  const { data: event, error: eventError } = await supabase
    .from('esocial_eventos')
    .select('*')
    .eq('id', eventId)
    .single();

  if (eventError || !event) {
    console.error("Error fetching event:", eventError);
    return;
  }

  // 2. Prepare event data
  const raw = event.dados_evento?.dadosEspecificos || event.dados_evento || {};
  const esp = { ...raw };

  const eventData = {
    cpf: event.cpf_trabalhador || '',
    cnpj: event.cnpj_empregador || '',
    tpAmb: 2,
    indRetif: 1,
    dadosEspecificos: {
      tipoExame: esp.tipoExame || esp.tipo_exame || 'periodico',
      dataRealizacao: esp.dataRealizacao || esp.data_realizacao || '',
      resultado: esp.resultado || 'apto',
      medico_nome: esp.medico || esp.medico_nome || esp.nmMed || '',
      medico_crm: esp.crm || esp.medico_crm || esp.nrCRM || '',
      medico_uf: esp.uf || esp.medico_uf || esp.ufCRM || 'RJ',
      medico_pcmso_nome: esp.medico_pcmso_nome || esp.medicoPcmsoNome || esp.medico_pcmso || '',
      medico_pcmso_crm: esp.medico_pcmso_crm || esp.medicoPcmsoCrm || esp.crm_pcmso || '',
      medico_pcmso_uf: esp.medico_pcmso_uf || esp.medicoPcmsoUf || esp.uf_pcmso || 'RJ',
      exames_realizados: esp.exames_realizados || esp.exames || [],
      nome_clinica: esp.nome_clinica || esp.nomeClinica || '',
    },
  };

  console.log("Input data for generation:");
  console.log(JSON.stringify(eventData, null, 2));

  // 3. Generate XML
  const xml = generateEventXML(event.evento_codigo, eventData);
  console.log("\nGenerated XML:");
  console.log(xml);

  // 4. Validate XML
  const validation = validateEventXML(xml);
  console.log("\nValidation result:", validation);

  if (validation.valido) {
    // 5. Update DB
    const { error: updateError } = await supabase
      .from('esocial_eventos')
      .update({ xml_gerado: xml, status: 'revisao_aprovado' })
      .eq('id', eventId);

    if (updateError) {
      console.error("Error updating event XML:", updateError);
    } else {
      console.log("Successfully regenerated and updated XML in database!");
    }
  } else {
    console.log("XML is invalid, not updating database.");
  }
}

run();
