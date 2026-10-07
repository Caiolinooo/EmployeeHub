import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { authenticateUser } from '@/lib/api-auth';
import { podeIncluirOuEditarDocumentoGt } from '@/lib/gestao-tripulantes/documento-permissions';
import { usuarioPodeVerColaborador } from '@/lib/gestao-tripulantes/empresa-acesso';
import {
  calcularArquivoHash,
  resolverMimeArquivo,
} from '@/lib/gestao-tripulantes/documento-integrity';
import {
  registrarDocumentoGt,
  montarPathArquivo,
  getPublicUrlGt,
} from '@/lib/gestao-tripulantes/documento-upload-core';
import { GT_DOC_BUCKET } from '@/lib/gestao-tripulantes/documento-limits';

export const dynamic = 'force-dynamic';

/**
 * Rota multipart LEGADA (fallback para arquivos pequenos).
 * O fluxo principal é signed URL: /documentos/upload-url + POST /documentos.
 * Limite aqui segue 20MB (payload da Function); arquivos maiores usam o fluxo novo.
 */
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await authenticateUser(request);
    if (authError) return authError;
    if (!user || !(await podeIncluirOuEditarDocumentoGt(user))) {
      return NextResponse.json({ error: 'Sem permissão para incluir documentos do cadastro' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const colaborador_id = (formData.get('colaborador_id') as string | null)?.trim() || '';

    if (!file || !colaborador_id) {
      return NextResponse.json({
        error: 'file e colaborador_id são obrigatórios',
        detalhes: { hasFile: Boolean(file), hasColaborador: Boolean(colaborador_id) },
      }, { status: 400 });
    }

    // ACL por empresa
    if (!(await usuarioPodeVerColaborador(user, colaborador_id))) {
      return NextResponse.json({ error: 'Sem acesso a este colaborador (empresa restrita)' }, { status: 403 });
    }

    const maxSize = 20 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'Arquivo muito grande. Tamanho máximo: 20MB' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);
    const mime = resolverMimeArquivo(file.name, file.type, buffer);
    if (!mime) {
      return NextResponse.json({
        error: 'Formato de arquivo não permitido. Use PDF, JPEG, PNG ou WebP',
        mime_recebido: file.type || '(vazio)',
        arquivo: file.name,
      }, { status: 400 });
    }
    const arquivo_hash = calcularArquivoHash(buffer);

    const filePath = montarPathArquivo(colaborador_id, file.name);
    const { error: uploadError } = await supabaseAdmin.storage
      .from(GT_DOC_BUCKET)
      .upload(filePath, buffer, { contentType: mime, upsert: false });

    if (uploadError) {
      console.error('Erro ao fazer upload do arquivo:', uploadError);
      return NextResponse.json({ error: 'Erro ao fazer upload do arquivo' }, { status: 500 });
    }

    const result = await registrarDocumentoGt({
      colaborador_id,
      tipoRaw: formData.get('tipo_documento') as string | null,
      subtipo: (formData.get('subtipo') as string | null)?.trim() || null,
      titulo: (formData.get('titulo') as string | null)?.trim() || 'Documento',
      descricao: formData.get('descricao') as string | null,
      numero_documento: formData.get('numero_documento') as string | null,
      orgao_emissor: formData.get('orgao_emissor') as string | null,
      data_emissao: ((formData.get('data_emissao') as string | null) || '').trim() || null,
      data_validade: ((formData.get('data_validade') as string | null) || '').trim() || null,
      quarentena: String(formData.get('quarentena') || '') === 'true',
      documento_id: (formData.get('documento_id') as string | null)?.trim() || null,
      origem: 'upload',
      arquivo: {
        arquivo_path: filePath,
        arquivo_url: getPublicUrlGt(filePath),
        arquivo_hash,
        arquivo_tamanho_bytes: file.size,
        arquivo_tipo: mime,
      },
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error('Erro no upload de documento:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
