import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { generateTreinamentoPDF } from '@/lib/gestao-tripulantes/treinamento-pdf-generator';

export const dynamic = 'force-dynamic';

function sanitizarNomeArquivo(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 80);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization') || undefined;
    const token = extractTokenFromHeader(authHeader);
    if (!token || !verifyToken(token)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id } = await context.params;
    const sp = request.nextUrl.searchParams;
    const forceGenerate = sp.get('generate_sheet') === 'true' || sp.get('ficha') === 'true';
    const forceDownload = sp.get('download') === 'true';

    // 1. Fetch document and collaborator info
    const { data: doc, error: docError } = await supabaseAdmin
      .from('gt_documentos')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (docError || !doc) {
      return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 });
    }

    const { data: colabData } = await supabaseAdmin
      .from('gt_vw_colaboradores_completo')
      .select('id, nome_completo, cpf, matricula, cargo_nome, empresa_nome, embarcacao_nome')
      .eq('id', doc.colaborador_id)
      .maybeSingle();

    const colab = colabData || {
      nome_completo: 'Colaborador',
      cpf: '',
      matricula: '',
      cargo_nome: '',
      empresa_nome: '',
      embarcacao_nome: '',
    };

    // 2. If it has an uploaded file and user didn't request dynamic sheet generation
    if (doc.arquivo_path && !forceGenerate) {
      const { data: fileData, error: storageErr } = await supabaseAdmin.storage
        .from('gestao-tripulantes-documentos')
        .download(doc.arquivo_path);

      if (!storageErr && fileData) {
        const arrayBuffer = await fileData.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const ext = doc.arquivo_path.split('.').pop() || 'pdf';
        const contentType = ext === 'pdf' ? 'application/pdf' : (doc.arquivo_tipo || 'application/octet-stream');
        const filename = `${sanitizarNomeArquivo(doc.titulo)}_${sanitizarNomeArquivo(colab.nome_completo)}.${ext}`;
        const disposition = forceDownload ? 'attachment' : 'inline';

        return new NextResponse(buffer, {
          headers: {
            'Content-Type': contentType,
            'Content-Disposition': `${disposition}; filename="${filename}"`,
          },
        });
      }
    }

    // 3. If it's a training document (or any doc without an uploaded file), generate the Official Certificate Sheet
    const { data: treData } = await supabaseAdmin
      .from('gt_documentos_treinamento')
      .select('*')
      .eq('documento_id', id)
      .maybeSingle();

    const pdfBuffer = await generateTreinamentoPDF({
      colaborador: colab,
      documento: {
        ...doc,
        treinamento_data: treData || null,
      },
    });

    const safeTitle = sanitizarNomeArquivo(doc.titulo || 'Treinamento');
    const safeName = sanitizarNomeArquivo(colab.nome_completo || 'Colaborador');
    const filename = `Treinamento_${safeTitle}_${safeName}.pdf`;
    const disposition = forceDownload ? 'attachment' : 'inline';

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${disposition}; filename="${filename}"`,
        'Content-Length': String(pdfBuffer.length),
      },
    });
  } catch (error) {
    console.error('Erro ao gerar/baixar PDF do documento:', error);
    return NextResponse.json({ error: 'Erro ao gerar PDF do documento' }, { status: 500 });
  }
}
