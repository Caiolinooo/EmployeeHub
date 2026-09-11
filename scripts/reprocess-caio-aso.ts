import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { processarDocumentoOCR } from '../src/lib/ocr';
import {
  extrairDadosASODoTexto,
  aplicarGateIdentidadeDocumento,
} from '../src/lib/gestao-tripulantes/ocr-processor';
import { supabaseAdmin } from '../src/lib/supabase';

async function main() {
  console.log('=== INICIANDO REPROCESSAMENTO DO ASO DO CAIO ===');
  const docId = '7b122ce3-bfe1-4a44-826e-1d9c38134bc4';
  
  const { data: doc, error: errDoc } = await supabaseAdmin
    .from('gt_documentos')
    .select('*')
    .eq('id', docId)
    .single();

  if (errDoc || !doc) {
    console.error('Documento não encontrado:', errDoc);
    return;
  }

  const { data: colab, error: errColab } = await supabaseAdmin
    .from('gt_colaboradores')
    .select('*')
    .eq('id', doc.colaborador_id)
    .single();

  if (errColab || !colab) {
    console.error('Colaborador não encontrado:', errColab);
    return;
  }

  console.log(`Documento ID: ${doc.id}`);
  console.log(`Colaborador: ${colab.nome_completo} (CPF: ${colab.cpf})`);
  console.log(`Arquivo URL: ${doc.arquivo_url}`);

  const ocrRes = await processarDocumentoOCR(doc.arquivo_url, 'aso', colab.cpf);
  console.log(`OCR Sucesso: ${ocrRes.success}`);
  console.log('Dados Extraídos:', JSON.stringify(ocrRes.data?.dadosExtraidos, null, 2));

  if (!ocrRes.success || !ocrRes.data) {
    console.error('Erro no OCR:', ocrRes.error);
    return;
  }

  // 1. Extrair e gravar dados do ASO com o novo motor
  await extrairDadosASODoTexto(
    docId,
    ocrRes.data.texto,
    ocrRes.data.dadosExtraidos,
    colab.id,
    doc.data_emissao
  );

  // 2. Aplicar gate de identidade com validação matemática Módulo 11
  const gateRes = await aplicarGateIdentidadeDocumento(
    docId,
    ocrRes.data.texto,
    ocrRes.data.dadosExtraidos,
    colab.id
  );
  console.log('Gate de Identidade:', gateRes);

  // 3. Atualizar gt_documentos com status concluido e dados higienizados
  await supabaseAdmin
    .from('gt_documentos')
    .update({
      ocr_status: 'concluido',
      ocr_dados_extraidos: ocrRes.data.dadosExtraidos,
      ocr_erro: null,
      identity_match: gateRes.identityMatch,
      updated_at: new Date().toISOString(),
    })
    .eq('id', docId);

  // 4. Limpar duplicatas de teste do Caio com ocr_status em erro ou pendente
  const { data: outrosDocs } = await supabaseAdmin
    .from('gt_documentos')
    .select('id, titulo, ocr_status, ocr_dados_extraidos')
    .eq('colaborador_id', colab.id)
    .eq('tipo_documento', 'aso')
    .neq('id', docId);

  if (outrosDocs && outrosDocs.length > 0) {
    console.log(`Encontradas ${outrosDocs.length} linhas redundantes de ASO para o Caio. Higienizando...`);
    for (const d of outrosDocs) {
      // Se não tiver ASO formal na tabela gt_documentos_aso, removemos para evitar poluição visual
      const { data: temAso } = await supabaseAdmin
        .from('gt_documentos_aso')
        .select('id')
        .eq('documento_id', d.id)
        .maybeSingle();

      if (!temAso) {
        console.log(`Removendo documento de teste órfão: ${d.id} (${d.titulo})`);
        await supabaseAdmin.from('gt_documentos').delete().eq('id', d.id);
      }
    }
  }

  // 5. Verificar estado final
  const { data: finalDoc } = await supabaseAdmin
    .from('gt_documentos')
    .select('id, titulo, ocr_status, identity_match, ocr_dados_extraidos')
    .eq('id', docId)
    .single();

  const { data: finalAso } = await supabaseAdmin
    .from('gt_documentos_aso')
    .select('*')
    .eq('documento_id', docId)
    .single();

  console.log('\n=== RESULTADO FINAL NO BANCO DE DADOS ===');
  console.log('GT_DOCUMENTOS:', JSON.stringify(finalDoc, null, 2));
  console.log('GT_DOCUMENTOS_ASO:', JSON.stringify(finalAso, null, 2));
}

main().catch(console.error);
