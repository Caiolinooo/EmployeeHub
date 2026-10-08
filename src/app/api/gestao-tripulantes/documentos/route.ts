import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/api-auth';
import { podeIncluirOuEditarDocumentoGt } from '@/lib/gestao-tripulantes/documento-permissions';
import { usuarioPodeVerColaborador } from '@/lib/gestao-tripulantes/empresa-acesso';
import {
  registrarDocumentoGt,
  resolverMimeObjetoRemoto,
  sniffMimeObjetoStorage,
  getPublicUrlGt,
} from '@/lib/gestao-tripulantes/documento-upload-core';
import { supabaseAdmin } from '@/lib/supabase';
import { GT_DOC_BUCKET } from '@/lib/gestao-tripulantes/documento-limits';

export const dynamic = 'force-dynamic';

const HASH_RE = /^[a-f0-9]{64}$/i;

/**
 * POST /api/gestao-tripulantes/documentos
 * Registra em gt_documentos um arquivo que o browser já subiu direto ao
 * Storage via signed URL (fluxo de 50MB). Contrato de resposta idêntico
 * ao da rota multipart legada (/documentos/upload) — os callers e o
 * disparo de OCR dependem de data.arquivo_url e do flag merged.
 */
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await authenticateUser(request);
    if (authError) return authError;
    if (!user || !(await podeIncluirOuEditarDocumentoGt(user))) {
      return NextResponse.json({ error: 'Sem permissão para incluir documentos do cadastro' }, { status: 403 });
    }

    const body = await request.json();
    const colaborador_id = String(body?.colaborador_id || '').trim();
    const arquivo_path = String(body?.arquivo_path || '').trim();
    const arquivo_hash = String(body?.arquivo_hash || '').trim().toLowerCase();
    const arquivo_tamanho_bytes = Number(body?.arquivo_tamanho_bytes) || 0;
    const nome_arquivo = String(body?.nome_arquivo || '').trim();
    const titulo = String(body?.titulo || '').trim() || 'Documento';

    if (!colaborador_id || !arquivo_path) {
      return NextResponse.json({ error: 'colaborador_id e arquivo_path são obrigatórios' }, { status: 400 });
    }

    // Path precisa pertencer ao colaborador e ao prefixo do módulo —
    // impede registrar objeto de outro colaborador ou fora do bucket layout.
    const prefixo = `gestao-tripulantes/${colaborador_id}/`;
    if (!arquivo_path.startsWith(prefixo) || arquivo_path.includes('..')) {
      return NextResponse.json({ error: 'arquivo_path inválido para este colaborador' }, { status: 400 });
    }

    if (!HASH_RE.test(arquivo_hash)) {
      return NextResponse.json({ error: 'arquivo_hash (SHA-256 hex) ausente ou inválido' }, { status: 400 });
    }

    // ACL por empresa
    if (!(await usuarioPodeVerColaborador(user, colaborador_id))) {
      return NextResponse.json({ error: 'Sem acesso a este colaborador (escopo ou empresa restrita)' }, { status: 403 });
    }

    // MIME real do objeto (magic bytes via Range) → fallback por extensão.
    // Se não for permitido, remove o objeto recém-enviado (compensação).
    const sniffed = await sniffMimeObjetoStorage(arquivo_path);
    const mime = resolverMimeObjetoRemoto(nome_arquivo || arquivo_path, sniffed);
    if (!mime) {
      await supabaseAdmin.storage.from(GT_DOC_BUCKET).remove([arquivo_path]);
      return NextResponse.json({
        error: 'Formato de arquivo não permitido. Use PDF, JPEG, PNG, WebP, HEIC, DOC ou DOCX',
        arquivo: nome_arquivo,
      }, { status: 400 });
    }

    const result = await registrarDocumentoGt({
      colaborador_id,
      tipoRaw: body?.tipo_documento ?? null,
      subtipo: body?.subtipo ?? null,
      titulo,
      descricao: body?.descricao ?? null,
      numero_documento: body?.numero_documento ?? null,
      orgao_emissor: body?.orgao_emissor ?? null,
      data_emissao: String(body?.data_emissao || '').trim() || null,
      data_validade: String(body?.data_validade || '').trim() || null,
      quarentena: body?.quarentena === true || body?.quarentena === 'true',
      documento_id: String(body?.documento_id || '').trim() || null,
      origem: 'upload',
      arquivo: {
        arquivo_path,
        arquivo_url: getPublicUrlGt(arquivo_path),
        arquivo_hash,
        arquivo_tamanho_bytes,
        arquivo_tipo: mime,
      },
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error('Erro no registro de documento (signed URL):', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
