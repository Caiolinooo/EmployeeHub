import { supabaseAdmin } from '@/lib/supabase';
import { buscarASOsPendentes, PoliWebASO } from './poliweb-scraper';
import { gerarXMLEvento } from '@/lib/e-social/xml-generator';
import { validarXML } from '@/lib/e-social/validacao';
import { normalizeCpf } from '@/lib/gestao-tripulantes/cpf';
import { findColaboradorByCpf } from '@/lib/gestao-tripulantes/cpf-lookup';

export interface ImportResult {
  success: boolean;
  totalEncontrados: number;
  totalImportados: number;
  totalErros: number;
  importados: any[];
  erros: string[];
}

function parseTipoExame(tipo: string): { dbTipo: string; esocialTipoNum: number } {
  const t = tipo.toLowerCase().trim();
  if (t.includes('admiss') || t.includes('adminiss')) {
    return { dbTipo: 'admissional', esocialTipoNum: 1 };
  }
  if (t.includes('period') || t.includes('periód')) {
    return { dbTipo: 'periodico', esocialTipoNum: 2 };
  }
  if (t.includes('retorno')) {
    return { dbTipo: 'retorno', esocialTipoNum: 3 };
  }
  if (t.includes('mudan') || t.includes('fun')) {
    return { dbTipo: 'mudanca_funcao', esocialTipoNum: 4 };
  }
  if (t.includes('demiss')) {
    return { dbTipo: 'demissional', esocialTipoNum: 5 };
  }
  return { dbTipo: 'periodico', esocialTipoNum: 2 };
}

function parseResultado(res: string): { dbRes: string; esocialResNum: number } {
  const r = res.toLowerCase().trim();
  if (r.includes('inapto')) {
    return { dbRes: 'inapto', esocialResNum: 3 };
  }
  if (r.includes('restri') || r.includes('condic') || r.includes('apto com')) {
    return { dbRes: 'apto_condicional', esocialResNum: 2 };
  }
  return { dbRes: 'apto', esocialResNum: 1 };
}

function getOrderWeight(tipo: string): number {
  const t = tipo.toLowerCase().trim();
  if (t.includes('admiss') || t.includes('adminiss')) return 1;
  if (t.includes('period') || t.includes('periód')) return 2;
  if (t.includes('demiss')) return 3;
  return 4;
}

function formatDateForDb(dateStr: string): string | null {
  if (!dateStr) return null;
  const cleanStr = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) return cleanStr;
  const parts = cleanStr.split('/');
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];
    return `${year}-${month}-${day}`;
  }
  return null;
}

/**
 * Importa e processa uma lista de ASOs do PoliWeb, associando aos colaboradores,
 * criando registros nas tabelas gt_documentos e gt_documentos_aso, e gerando os
 * eventos de e-Social S-2220 pendentes de revisão.
 */
export async function importarEProcessarASOs(asos: PoliWebASO[]): Promise<ImportResult> {
  const importados: any[] = [];
  const erros: string[] = [];

  // Ordenar conforme o pedido: Admissional primeiro, Periódico depois, Demissional por fim
  const sortedAsos = [...asos].sort((a, b) => getOrderWeight(a.tipoExame) - getOrderWeight(b.tipoExame));

  for (const aso of sortedAsos) {
    try {
      const cpfLimpo = normalizeCpf(aso.colaboradorCpf);

      // 1. Buscar o colaborador (digits + masked CPF — backfill-safe)
      const colaboradorHit = await findColaboradorByCpf(cpfLimpo);
      if (!colaboradorHit) {
        erros.push(`Colaborador com CPF ${aso.colaboradorCpf} não encontrado no sistema ou inativo.`);
        continue;
      }
      const { data: colaborador, error: colError } = await supabaseAdmin
        .from('gt_colaboradores')
        .select('*')
        .eq('id', colaboradorHit.id)
        .is('deleted_at', null)
        .maybeSingle();

      if (colError || !colaborador) {
        erros.push(`Colaborador com CPF ${aso.colaboradorCpf} não encontrado no sistema ou inativo.`);
        continue;
      }

      const dataRealizacaoClean = formatDateForDb(aso.dataRealizacao);
      const dataValidadeClean = formatDateForDb(aso.dataValidade);

      if (!dataRealizacaoClean) {
        erros.push(`Data de realização inválida para o ASO de ${aso.colaboradorNome}: ${aso.dataRealizacao}`);
        continue;
      }

      // 2. Verificar duplicado
      const { data: existingDoc, error: checkError } = await supabaseAdmin
        .from('gt_documentos')
        .select('id')
        .eq('colaborador_id', colaborador.id)
        .eq('tipo_documento', 'aso')
        .eq('data_emissao', dataRealizacaoClean)
        .is('deleted_at', null)
        .maybeSingle();

      if (existingDoc) {
        // Já existe esse ASO importado
        continue;
      }

      const { dbTipo, esocialTipoNum } = parseTipoExame(aso.tipoExame);
      const { dbRes, esocialResNum } = parseResultado(aso.resultado);

      // 3. Criar registro em gt_documentos
      const { data: doc, error: docError } = await supabaseAdmin
        .from('gt_documentos')
        .insert({
          colaborador_id: colaborador.id,
          tipo_documento: 'aso',
          titulo: `ASO - ${aso.tipoExame} - ${aso.dataRealizacao}`,
          numero_documento: cpfLimpo,
          data_emissao: dataRealizacaoClean,
          data_validade: dataValidadeClean,
          descricao: `Resultado: ${aso.resultado}. Importado do PoliWeb.`,
          origem: 'poliweb',
          ocr_status: 'nao_aplicavel',
          status_validacao: dataValidadeClean
            ? (new Date(dataValidadeClean) < new Date() ? 'vencido' : 'valido')
            : 'pendente',
          notificado_vencimento: false,
          status_revisao: 'pendente_revisao',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('*')
        .single();

      if (docError || !doc) {
        erros.push(`Erro ao criar documento base para ${aso.colaboradorNome}: ${docError?.message}`);
        continue;
      }

      // 4. Buscar o CNPJ da empresa do colaborador
      let cnpjEmpregador = '';
      if (colaborador.empresa_id) {
        const { data: empresa } = await supabaseAdmin
          .from('gt_empresas')
          .select('cnpj')
          .eq('id', colaborador.empresa_id)
          .maybeSingle();
        if (empresa?.cnpj) {
          cnpjEmpregador = empresa.cnpj.replace(/\D/g, '');
        }
      }
      if (!cnpjEmpregador) {
        // Fallback para CNPJ genérico se não configurado
        cnpjEmpregador = '00000000000000';
      }

      // 5. Preparar e gerar o XML do e-Social S-2220
      const medicoCrmLimpo = (aso.medicoCRM || '00000').replace(/\D/g, '');
      const ufCrm = aso.medicoCRM?.match(/[a-zA-Z]{2}/)?.[0]?.toUpperCase() || 'RJ';

      const dadosEvento = {
        ideEvento: {
          indRetif: 1,
          tpAmb: 2, // Homologação/Restrito por padrão. O WebService gerencia isso
          procEmi: 1,
          verProc: '1.0.0'
        },
        ideEmpregador: {
          tpInsc: 1,
          nrInsc: cnpjEmpregador,
          cnpj: cnpjEmpregador
        },
        ideTrabalhador: {
          cpfTrab: cpfLimpo,
          cpf: cpfLimpo,
          nmTrab: colaborador.nome_completo
        },
        exameOcupacional: {
          dtExame: dataRealizacaoClean,
          tpExame: esocialTipoNum,
          aso: {
            dtAso: dataRealizacaoClean,
            resAso: esocialResNum,
            exames: [
              {
                dtExm: dataRealizacaoClean,
                procRealizado: '0281', // Código e-Social para exame clínico ocupacional padrão
                obsExm: 'Exame clinico ocupacional'
              }
            ]
          },
          medico: {
            nmMed: aso.medicoNome || 'Médico Ocupacional',
            nrCRM: medicoCrmLimpo,
            ufCRM: ufCrm
          }
        }
      };

      let xml = '';
      let errosValidacao: any[] = [];

      try {
        xml = gerarXMLEvento('S-2220', dadosEvento);
        const validacoes = validarXML(xml, 'S-2220');
        if (validacoes.length > 0) {
          errosValidacao = validacoes.map(e => ({ campo: e.campo, mensagem: e.mensagem }));
        }
      } catch (xmlErr: any) {
        errosValidacao.push({ campo: 'xml', mensagem: `Erro na geração de XML: ${xmlErr.message}` });
      }

      // 6. Criar o evento em esocial_eventos com status 'pendente_revisao' para aprovação manual
      const { data: esocialEvento, error: esocialError } = await supabaseAdmin
        .from('esocial_eventos')
        .insert({
          evento_codigo: 'S-2220',
          cpf_trabalhador: cpfLimpo,
          cnpj_empregador: cnpjEmpregador,
          matricula: colaborador.matricula || null,
          dados_evento: dadosEvento,
          xml_gerado: xml || null,
          modulo_origem: 'gestao-tripulantes',
          entidade_origem_id: doc.id,
          entidade_origem_tipo: 'aso',
          status: errosValidacao.length > 0 ? 'rascunho' : 'pendente_revisao',
          erros_processamento: errosValidacao.length > 0 ? errosValidacao : null
        })
        .select('*')
        .single();

      if (esocialError || !esocialEvento) {
        erros.push(`Erro ao criar evento e-Social para ${aso.colaboradorNome}: ${esocialError?.message}`);
        // Removemos o documento base para evitar inconsistência
        await supabaseAdmin.from('gt_documentos').delete().eq('id', doc.id);
        continue;
      }

      // 7. Criar registro em gt_documentos_aso com relacionamento ao evento e-Social
      const { error: asoError } = await supabaseAdmin
        .from('gt_documentos_aso')
        .insert({
          documento_id: doc.id,
          colaborador_id: colaborador.id,
          tipo_exame: dbTipo,
          resultado: dbRes,
          data_realizacao: dataRealizacaoClean,
          medico_nome: aso.medicoNome || 'Não informado',
          medico_crm: aso.medicoCRM || 'Não informado',
          nome_clinica: aso.clinicaNome || 'Policlínica PoliWeb',
          exames_realizados: JSON.stringify(dadosEvento.exameOcupacional.aso.exames),
          esocial_status: errosValidacao.length > 0 ? 'erro_validacao' : 'pendente',
          esocial_evento_id: esocialEvento.id
        });

      if (asoError) {
        erros.push(`Erro ao criar ASO específico para ${aso.colaboradorNome}: ${asoError.message}`);
        // Rollback do evento e documento
        await supabaseAdmin.from('esocial_eventos').delete().eq('id', esocialEvento.id);
        await supabaseAdmin.from('gt_documentos').delete().eq('id', doc.id);
        continue;
      }

      importados.push(doc);

    } catch (e: any) {
      console.error(`Erro fatal no ASO de ${aso.colaboradorNome}:`, e);
      erros.push(`Erro inesperado no ASO de ${aso.colaboradorNome}: ${e.message}`);
    }
  }

  return {
    success: true,
    totalEncontrados: asos.length,
    totalImportados: importados.length,
    totalErros: erros.length,
    importados,
    erros
  };
}

/**
 * Executa a rotina completa do PoliWeb:
 * 1. Inicializa o cron log
 * 2. Verifica se a integração está ativa nas configurações
 * 3. Executa scraping para buscar novos exames
 * 4. Processa e importa os ASOs
 * 5. Finaliza e salva o cron log
 */
export async function executarScrapingPoliWeb(): Promise<{ success: boolean; data?: ImportResult; error?: string }> {
  const logId = crypto.randomUUID();
  const startTime = new Date().toISOString();

  // 1. Criar o registro de log
  await supabaseAdmin
    .from('gt_cron_log')
    .insert({
      id: logId,
      tipo: 'poliweb_scraper',
      status: 'executando',
      iniciado_em: startTime,
      detalhes: { mensagem: 'Scraping iniciado via agendamento automático' }
    });

  try {
    // 2. Buscar configurações do PoliWeb
    const { data: configRows } = await supabaseAdmin
      .from('gt_configuracoes')
      .select('*')
      .in('chave', ['poliweb_habilitado', 'auto_poliweb_scrape']);

    const configs: Record<string, any> = {};
    configRows?.forEach(row => {
      configs[row.chave] = row.valor;
    });

    if (!configs.poliweb_habilitado) {
      const errorMsg = 'Integração PoliWeb desativada nas configurações administrativas.';
      await supabaseAdmin
        .from('gt_cron_log')
        .update({
          status: 'erro',
          mensagem_erro: errorMsg,
          finalizado_em: new Date().toISOString(),
          detalhes: { concluido: false, motivo: 'desativado' }
        })
        .eq('id', logId);

      return { success: false, error: errorMsg };
    }

    // 3. Buscar os ASOs pendentes no PoliWeb
    const searchResult = await buscarASOsPendentes();
    if (!searchResult.success || !searchResult.data) {
      const errorMsg = searchResult.error || 'Erro desconhecido ao obter ASOs do PoliWeb.';
      await supabaseAdmin
        .from('gt_cron_log')
        .update({
          status: 'erro',
          mensagem_erro: errorMsg,
          finalizado_em: new Date().toISOString()
        })
        .eq('id', logId);

      return { success: false, error: errorMsg };
    }

    if (searchResult.data.length === 0) {
      await supabaseAdmin
        .from('gt_cron_log')
        .update({
          status: 'sucesso',
          registros_processados: 0,
          finalizado_em: new Date().toISOString(),
          detalhes: { concluido: true, mensagem: 'Nenhum ASO pendente encontrado' }
        })
        .eq('id', logId);

      return {
        success: true,
        data: {
          success: true,
          totalEncontrados: 0,
          totalImportados: 0,
          totalErros: 0,
          importados: [],
          erros: []
        }
      };
    }

    // 4. Importar os ASOs encontrados
    const importResult = await importarEProcessarASOs(searchResult.data);

    // 5. Finalizar log com sucesso
    await supabaseAdmin
      .from('gt_cron_log')
      .update({
        status: importResult.totalErros > 0 ? 'erro' : 'sucesso',
        registros_processados: importResult.totalImportados,
        registros_erro: importResult.totalErros,
        mensagem_erro: importResult.totalErros > 0 ? `${importResult.totalErros} erros ocorridos durante a importação` : null,
        finalizado_em: new Date().toISOString(),
        detalhes: {
          concluido: true,
          importados_nomes: importResult.importados.map(d => d.titulo),
          erros_mensagens: importResult.erros
        }
      })
      .eq('id', logId);

    return { success: true, data: importResult };

  } catch (error: any) {
    console.error('Erro fatal na rotina automática do PoliWeb:', error);
    await supabaseAdmin
      .from('gt_cron_log')
      .update({
        status: 'erro',
        mensagem_erro: error.message || 'Erro interno fatal na execução do scraping',
        finalizado_em: new Date().toISOString()
      })
      .eq('id', logId);

    return { success: false, error: error.message };
  }
}

export interface AsoPendenteRevisao {
  id: string;
  colaborador_id: string | null;
  colaborador_nome: string | null;
  cpf: string;
  tipo_exame: string;
  resultado: string;
  data_realizacao: string;
  data_validade: string | null;
  medico_nome: string | null;
  medico_crm: string | null;
  nome_clinica: string | null;
  poliweb_id: string;
  status_revisao: string;
  arquivo_url: string | null;
}

/** Lista ASOs Poliweb já importados e ainda pendentes de revisão (sem chamar o site). */
export async function listarASOsPendentesRevisao(): Promise<AsoPendenteRevisao[]> {
  const query = (async () => {
    const { data: docs, error } = await supabaseAdmin
      .from('gt_documentos')
      .select('id, colaborador_id, data_emissao, data_validade, arquivo_url, status_revisao, numero_documento')
      .eq('tipo_documento', 'aso')
      .eq('origem', 'poliweb')
      .eq('status_revisao', 'pendente_revisao')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error || !docs?.length) return [];

    const ids = docs.map((d) => d.id);
    const colaboradorIds = [...new Set(docs.map((d) => d.colaborador_id).filter(Boolean))] as string[];

    const [{ data: asos }, { data: colaboradores }] = await Promise.all([
      supabaseAdmin
        .from('gt_documentos_aso')
        .select('documento_id, tipo_exame, resultado, data_realizacao, medico_nome, medico_crm, nome_clinica')
        .in('documento_id', ids),
      colaboradorIds.length
        ? supabaseAdmin.from('gt_colaboradores').select('id, nome_completo, cpf').in('id', colaboradorIds)
        : Promise.resolve({ data: [] as { id: string; nome_completo: string | null; cpf: string | null }[] }),
    ]);

    const asoByDoc = new Map((asos || []).map((a) => [a.documento_id, a]));
    const colById = new Map((colaboradores || []).map((c) => [c.id, c]));

    return docs.map((doc) => {
      const aso = asoByDoc.get(doc.id);
      const col = doc.colaborador_id ? colById.get(doc.colaborador_id) : undefined;
      return {
        id: doc.id,
        colaborador_id: doc.colaborador_id,
        colaborador_nome: col?.nome_completo || null,
        cpf: col?.cpf || doc.numero_documento || '',
        tipo_exame: aso?.tipo_exame || '',
        resultado: aso?.resultado || '',
        data_realizacao: aso?.data_realizacao || doc.data_emissao || '',
        data_validade: doc.data_validade || null,
        medico_nome: aso?.medico_nome || null,
        medico_crm: aso?.medico_crm || null,
        nome_clinica: aso?.nome_clinica || null,
        poliweb_id: doc.id,
        status_revisao: doc.status_revisao,
        arquivo_url: doc.arquivo_url || null,
      };
    });
  })();

  query.catch(() => undefined);

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      query,
      new Promise<AsoPendenteRevisao[]>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error('Timeout ao listar ASOs pendentes de revisão')),
          3000
        );
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}
