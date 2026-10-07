/**
 * Núcleo compartilhado de registro de documentos GT (server-only).
 *
 * Reúne a lógica que antes vivia apenas na rota multipart legada
 * (/documentos/upload) para ser reusada também pelo fluxo novo de
 * signed URL (/documentos/upload-url + POST /documentos):
 * validação básica → anexação a doc existente (documento_id) →
 * anti-duplicação (merge) → insert com rollback de storage.
 *
 * O ARQUIVO já deve estar no Storage quando estas funções rodam —
 * quem chama faz o upload (multipart: server sobe o buffer; signed URL:
 * o browser subiu direto). Se o objeto enviado não for usado no estado
 * final (merge com mesmo hash, erro de insert), ele é removido aqui.
 */

import { supabaseAdmin } from '@/lib/supabase';
import {
  garantirNumeroRastreioUnico,
  buscarDuplicado,
  validarDatasObrigatorias,
  calcularStatusValidacaoPorValidade,
  normalizarTipoDocumento,
  sniffMimeFromBytes,
  EXT_PARA_MIME,
  MIME_DOCUMENTO_PERMITIDOS,
  TIPOS_DOCUMENTO_VALIDOS,
} from '@/lib/gestao-tripulantes/documento-integrity';
import { GT_DOC_BUCKET } from '@/lib/gestao-tripulantes/documento-limits';

export interface ArquivoNoStorage {
  arquivo_path: string;
  arquivo_url: string;
  arquivo_hash: string;
  arquivo_tamanho_bytes: number;
  arquivo_tipo: string; // MIME resolvido
}

export interface RegistrarDocumentoInput {
  colaborador_id: string;
  tipoRaw?: string | null;
  subtipo?: string | null;
  titulo: string;
  descricao?: string | null;
  numero_documento?: string | null;
  orgao_emissor?: string | null;
  data_emissao?: string | null;
  data_validade?: string | null;
  quarentena?: boolean;
  documento_id?: string | null;
  origem?: string;
  arquivo: ArquivoNoStorage;
}

export type RegistrarDocumentoResult =
  | { ok: true; status: number; body: { success: true; data: any; merged?: boolean; message: string } }
  | { ok: false; status: number; body: Record<string, any> };

async function removerObjeto(path: string | null | undefined) {
  if (!path) return;
  try {
    await supabaseAdmin.storage.from(GT_DOC_BUCKET).remove([path]);
  } catch (e) {
    console.warn('[documento-upload-core] falha ao remover objeto órfão:', path, e);
  }
}

export function montarPathArquivo(colaboradorId: string, nomeArquivo: string): string {
  const ext = nomeArquivo.split('.').pop()?.toLowerCase() || 'pdf';
  return `gestao-tripulantes/${colaboradorId}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
}

export function getPublicUrlGt(path: string): string {
  const { data } = supabaseAdmin.storage.from(GT_DOC_BUCKET).getPublicUrl(path);
  return data?.publicUrl || '';
}

/**
 * Sniff de MIME de um objeto já no Storage sem baixá-lo inteiro:
 * signed URL de leitura (60s) + Range de 16 bytes → magic bytes.
 */
export async function sniffMimeObjetoStorage(path: string): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin.storage
      .from(GT_DOC_BUCKET)
      .createSignedUrl(path, 60);
    if (error || !data?.signedUrl) return null;
    const res = await fetch(data.signedUrl, { headers: { Range: 'bytes=0-15' } });
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    return sniffMimeFromBytes(buf);
  } catch (e) {
    console.warn('[documento-upload-core] sniff falhou:', path, e);
    return null;
  }
}

/**
 * Resolve o MIME final de um objeto enviado via signed URL:
 * magic bytes (quando detectável) → extensão. Retorna null se não permitido.
 */
export function resolverMimeObjetoRemoto(nomeArquivo: string, sniffed: string | null): string | null {
  if (sniffed && (MIME_DOCUMENTO_PERMITIDOS as readonly string[]).includes(sniffed)) return sniffed;
  const ext = (nomeArquivo || '').split('.').pop()?.toLowerCase() || '';
  if (EXT_PARA_MIME[ext]) return EXT_PARA_MIME[ext];
  return sniffed; // sniffed não-listado (ex.: octet-stream) → rejeita
}

export async function registrarDocumentoGt(
  input: RegistrarDocumentoInput
): Promise<RegistrarDocumentoResult> {
  const {
    colaborador_id,
    titulo,
    descricao = null,
    numero_documento = null,
    orgao_emissor = null,
    data_emissao = null,
    data_validade = null,
    quarentena = false,
    documento_id = null,
    origem = 'upload',
    arquivo,
  } = input;

  const tipoNorm = normalizarTipoDocumento(input.tipoRaw);
  const tipo_documento = tipoNorm.tipo;
  const subtipo = (input.subtipo || '').trim() || tipoNorm.subtipo || null;

  // ---- Colaborador ---------------------------------------------------------
  const { data: colaborador, error: colError } = await supabaseAdmin
    .from('gt_colaboradores')
    .select('id, cpf')
    .eq('id', colaborador_id)
    .is('deleted_at', null)
    .maybeSingle();

  if (colError || !colaborador) {
    await removerObjeto(arquivo.arquivo_path);
    return { ok: false, status: 404, body: { error: 'Colaborador não encontrado' } };
  }

  // ---- Tipo ----------------------------------------------------------------
  if (!tipo_documento && !documento_id) {
    await removerObjeto(arquivo.arquivo_path);
    return {
      ok: false,
      status: 400,
      body: { error: 'tipo_documento é obrigatório', tipo_documento: input.tipoRaw },
    };
  }
  if (tipoNorm.invalido) {
    await removerObjeto(arquivo.arquivo_path);
    return {
      ok: false,
      status: 400,
      body: {
        error: `Tipo de documento inválido: ${input.tipoRaw}`,
        tipos_aceitos: [...TIPOS_DOCUMENTO_VALIDOS],
      },
    };
  }

  // ---- Datas ----------------------------------------------------------------
  const validacao = validarDatasObrigatorias(
    { data_emissao, data_validade, tipo_documento },
    { permitirQuarentena: quarentena, permitirSemValidade: true, tipoDocumento: tipo_documento }
  );
  if (!validacao.ok) {
    await removerObjeto(arquivo.arquivo_path);
    return {
      ok: false,
      status: 422,
      body: { error: 'Documento incompleto: ' + validacao.errors.join(', '), detalhes: validacao.errors },
    };
  }

  // ---- Anexação direta a documento existente --------------------------------
  if (documento_id) {
    const { data: existingDoc } = await supabaseAdmin
      .from('gt_documentos')
      .select('*')
      .eq('id', documento_id)
      .eq('colaborador_id', colaborador_id)
      .is('deleted_at', null)
      .maybeSingle();

    if (existingDoc) {
      const updatePayload: Record<string, any> = {
        arquivo_path: arquivo.arquivo_path,
        arquivo_url: arquivo.arquivo_url,
        arquivo_tamanho_bytes: arquivo.arquivo_tamanho_bytes,
        arquivo_tipo: arquivo.arquivo_tipo,
        arquivo_hash: arquivo.arquivo_hash,
        updated_at: new Date().toISOString(),
      };

      if (numero_documento) updatePayload.numero_documento = numero_documento;
      if (orgao_emissor) updatePayload.orgao_emissor = orgao_emissor;
      if (data_emissao) updatePayload.data_emissao = data_emissao;
      if (data_validade) {
        updatePayload.data_validade = data_validade;
        updatePayload.status_validacao = calcularStatusValidacaoPorValidade(data_validade, {
          tipoDocumento: existingDoc.tipo_documento,
        });
      }

      const { data: updated, error: updErr } = await supabaseAdmin
        .from('gt_documentos')
        .update(updatePayload)
        .eq('id', documento_id)
        .select('*')
        .single();

      if (updErr) {
        console.error('Erro ao anexar arquivo:', updErr);
        await removerObjeto(arquivo.arquivo_path);
        return { ok: false, status: 500, body: { error: 'Erro ao atualizar documento com arquivo' } };
      }

      return {
        ok: true,
        status: 200,
        body: { success: true, data: updated, message: 'Arquivo anexado ao documento com sucesso!' },
      };
    }
  }

  // ---- Anti-duplicação: atualiza o existente em vez de criar novo -----------
  const duplicado = await buscarDuplicado({
    colaborador_id,
    tipo_documento: tipo_documento || '',
    titulo,
    numero_documento,
    data_emissao,
    data_validade,
    arquivo_hash: arquivo.arquivo_hash,
  });

  if (duplicado) {
    const updateData: Record<string, any> = {
      titulo,
      descricao: descricao ?? duplicado.descricao ?? null,
      numero_documento: numero_documento ?? duplicado.numero_documento ?? null,
      orgao_emissor: orgao_emissor ?? duplicado.orgao_emissor ?? null,
      data_emissao: data_emissao ?? duplicado.data_emissao ?? null,
      data_validade: data_validade ?? duplicado.data_validade ?? null,
      arquivo_tamanho_bytes: arquivo.arquivo_tamanho_bytes,
      arquivo_tipo: arquivo.arquivo_tipo,
      arquivo_hash: arquivo.arquivo_hash,
      updated_at: new Date().toISOString(),
    };

    // Só substitui o arquivo se o conteúdo realmente mudou; se for o mesmo
    // conteúdo, o objeto recém-enviado é órfão e é removido.
    if (duplicado.arquivo_hash !== arquivo.arquivo_hash) {
      updateData.arquivo_path = arquivo.arquivo_path;
      updateData.arquivo_url = arquivo.arquivo_url || duplicado.arquivo_url || null;
    } else {
      await removerObjeto(arquivo.arquivo_path);
    }

    updateData.status_validacao = calcularStatusValidacaoPorValidade(updateData.data_validade, {
      tipoDocumento: tipo_documento || duplicado.tipo_documento,
    });

    if (!duplicado.numero_rastreio) {
      updateData.numero_rastreio = await garantirNumeroRastreioUnico(
        tipo_documento || '',
        colaborador.cpf
      );
    }

    const { data: updated, error: updError } = await supabaseAdmin
      .from('gt_documentos')
      .update(updateData)
      .eq('id', duplicado.id)
      .select('*')
      .single();

    if (updError) {
      console.error('Erro ao atualizar documento duplicado:', updError);
      return { ok: false, status: 500, body: { error: 'Erro ao atualizar documento existente' } };
    }

    return {
      ok: true,
      status: 200,
      body: {
        success: true,
        data: updated,
        merged: true,
        message: 'Documento idêntico já existia — registro existente foi atualizado (sem duplicação)',
      },
    };
  }

  // ---- Insert novo ------------------------------------------------------------
  const numero_rastreio = await garantirNumeroRastreioUnico(tipo_documento || '', colaborador.cpf);

  const { data: documento, error: insertError } = await supabaseAdmin
    .from('gt_documentos')
    .insert({
      colaborador_id,
      tipo_documento,
      subtipo,
      titulo,
      descricao: descricao || null,
      numero_documento: numero_documento || null,
      orgao_emissor: orgao_emissor || null,
      data_emissao: data_emissao || null,
      data_validade: data_validade || null,
      arquivo_url: arquivo.arquivo_url,
      arquivo_path: arquivo.arquivo_path,
      arquivo_tamanho_bytes: arquivo.arquivo_tamanho_bytes,
      arquivo_tipo: arquivo.arquivo_tipo,
      arquivo_hash: arquivo.arquivo_hash,
      numero_rastreio,
      origem,
      ocr_status: 'pendente',
      status_validacao: calcularStatusValidacaoPorValidade(data_validade, { tipoDocumento: tipo_documento }),
      notificado_vencimento: false,
      status_revisao: 'nao_necessita',
      // Identidade NÃO verificada no upload — só o gate de OCR (CPF extraído
      // batendo com o perfil) pode marcar 'match'.
      identity_match: 'unknown',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (insertError) {
    console.error('Erro ao salvar registro do documento:', insertError);
    await removerObjeto(arquivo.arquivo_path);
    return { ok: false, status: 500, body: { error: 'Erro ao salvar registro do documento' } };
  }

  return {
    ok: true,
    status: 201,
    body: { success: true, data: documento, message: 'Documento enviado com sucesso' },
  };
}
