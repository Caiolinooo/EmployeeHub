import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { authenticateUser } from '@/lib/api-auth';
import { podeIncluirOuEditarDocumentoGt } from '@/lib/gestao-tripulantes/documento-permissions';
import { usuarioPodeVerColaborador } from '@/lib/gestao-tripulantes/empresa-acesso';
import { EXT_PARA_MIME } from '@/lib/gestao-tripulantes/documento-integrity';
import { GT_DOC_BUCKET, GT_DOC_MAX_BYTES, formatarMb } from '@/lib/gestao-tripulantes/documento-limits';
import { montarPathArquivo } from '@/lib/gestao-tripulantes/documento-upload-core';

export const dynamic = 'force-dynamic';

/**
 * POST /api/gestao-tripulantes/documentos/upload-url
 * Emite signed upload URL do bucket GT para o browser subir o arquivo
 * DIRETO ao Supabase Storage (contorna o limite de payload da Function).
 * O registro em gt_documentos acontece depois, via POST /documentos.
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
    const nome_arquivo = String(body?.nome_arquivo || '').trim();
    const tamanho_bytes = Number(body?.tamanho_bytes) || 0;

    if (!colaborador_id || !nome_arquivo) {
      return NextResponse.json({ error: 'colaborador_id e nome_arquivo são obrigatórios' }, { status: 400 });
    }

    if (tamanho_bytes <= 0) {
      return NextResponse.json({ error: 'Arquivo vazio ou tamanho inválido' }, { status: 400 });
    }
    if (tamanho_bytes > GT_DOC_MAX_BYTES) {
      return NextResponse.json({
        error: `Arquivo muito grande (${formatarMb(tamanho_bytes)}). Tamanho máximo: 50MB`,
      }, { status: 400 });
    }

    const ext = nome_arquivo.split('.').pop()?.toLowerCase() || '';
    if (!EXT_PARA_MIME[ext]) {
      return NextResponse.json({
        error: 'Formato de arquivo não permitido. Use PDF, JPEG, PNG, WebP, HEIC, DOC ou DOCX',
        arquivo: nome_arquivo,
      }, { status: 400 });
    }

    const { data: colaborador } = await supabaseAdmin
      .from('gt_colaboradores')
      .select('id')
      .eq('id', colaborador_id)
      .is('deleted_at', null)
      .maybeSingle();

    if (!colaborador) {
      return NextResponse.json({ error: 'Colaborador não encontrado' }, { status: 404 });
    }

    // ACL por empresa
    if (!(await usuarioPodeVerColaborador(user, colaborador_id))) {
      return NextResponse.json({ error: 'Sem acesso a este colaborador (escopo ou empresa restrita)' }, { status: 403 });
    }

    const path = montarPathArquivo(colaborador_id, nome_arquivo);
    const { data, error } = await supabaseAdmin.storage
      .from(GT_DOC_BUCKET)
      .createSignedUploadUrl(path);

    if (error || !data) {
      console.error('Erro ao criar signed upload URL:', error);
      return NextResponse.json({ error: 'Erro ao preparar upload' }, { status: 500 });
    }

    return NextResponse.json({ path: data.path, token: data.token, signedUrl: data.signedUrl });
  } catch (error) {
    console.error('Erro em upload-url:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
