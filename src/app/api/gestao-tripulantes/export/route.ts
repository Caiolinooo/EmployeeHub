import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import {
  DEFAULT_EXPORT_TEMPLATE,
  EXPORT_TEMPLATE_PRESETS,
  MAX_FUNCIONARIOS_HARD,
  MAX_FUNCIONARIOS_PADRAO,
  TEMPLATE_PLACEHOLDERS,
  buildExportZip,
  getExportTemplate,
  previewExportTree,
  saveExportTemplate,
  sanitizarNome,
} from '@/lib/gestao-tripulantes/export-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * GET /api/gestao-tripulantes/export
 *
 * Exporta documentos + dados do módulo Gestão de Tripulantes como .zip.
 *
 * Query params (combináveis):
 *   funcionarios=uuid1,nome parcial2   → ids ou nomes de funcionários
 *   empresa=<id|nome>                 → filtra por empresa (id ou nome)
 *   centro_custo=<id|nome>            → filtra por centro de custo (id ou nome)
 *   template=a/b/c                    → template de pastas com placeholders
 *                                        {empresa} {centro_custo} {funcionario}
 *                                        {cpf} {cargo} {tipo_documento} {ano}
 *   limite=N                          → máx. funcionários por export (default 50, máx 200)
 *   preview=1                         → não gera o zip; retorna JSON com a árvore
 *
 * Sem preview: responde application/zip (Content-Disposition anexo).
 */

function parseFilters(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const funcionariosParam = (sp.get('funcionarios') || '').trim();
  return {
    funcionarios: funcionariosParam ? funcionariosParam.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
    empresa: (sp.get('empresa') || '').trim() || undefined,
    centroCusto: (sp.get('centro_custo') || sp.get('centroCusto') || '').trim() || undefined,
  };
}

export async function GET(req: NextRequest) {
  const token = extractTokenFromHeader(req.headers.get('authorization') || undefined);
  if (!token || !verifyToken(token)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const filters = parseFilters(req);
    const sp = req.nextUrl.searchParams;
    const isPreview = ['1', 'true'].includes((sp.get('preview') || '').toLowerCase());
    const limiteParam = parseInt(sp.get('limite') || '', 10);
    const maxFuncionarios = Number.isFinite(limiteParam) && limiteParam > 0
      ? Math.min(limiteParam, MAX_FUNCIONARIOS_HARD)
      : MAX_FUNCIONARIOS_PADRAO;

    // Template: query param > persistido > default
    let template = (sp.get('template') || '').trim();
    if (!template) {
      try {
        template = await getExportTemplate();
      } catch {
        template = DEFAULT_EXPORT_TEMPLATE;
      }
    }

    if (isPreview) {
      const prev = await previewExportTree(filters, template);
      if (!prev.success) {
        return NextResponse.json({ error: prev.error }, { status: prev.status || 500 });
      }
      return NextResponse.json({
        ...prev,
        success: true,
        presets: EXPORT_TEMPLATE_PRESETS,
        placeholders: TEMPLATE_PLACEHOLDERS,
        limites: { padrao: MAX_FUNCIONARIOS_PADRAO, maximo: MAX_FUNCIONARIOS_HARD },
      });
    }

    const result = await buildExportZip(filters, { template, maxFuncionarios });
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status || 500 }
      );
    }

    const ts = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const filename = `gestao-tripulantes_${sanitizarNome(filters.empresa || 'export', 'export').replace(/\s/g, '_')}_${ts}.zip`;

    return new NextResponse(new Uint8Array(result.result.buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(result.result.buffer.length),
        'X-Export-Funcionarios': String(result.result.totalFuncionarios),
        'X-Export-Documentos': String(result.result.totalDocumentos),
        ...(result.result.avisos.length
          ? { 'X-Export-Avisos': encodeURIComponent(result.result.avisos.join(' | ').slice(0, 500)) }
          : {}),
      },
    });
  } catch (e) {
    console.error('Erro em /api/gestao-tripulantes/export:', e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Erro inesperado na exportação' },
      { status: 500 }
    );
  }
}

/** POST — salva o template de pastas em gt_configuracoes ('gt_export_template'). */
export async function POST(req: NextRequest) {
  const token = extractTokenFromHeader(req.headers.get('authorization') || undefined);
  if (!token || !verifyToken(token)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const template = typeof body?.template === 'string' ? body.template : '';
    if (!template) {
      return NextResponse.json({ error: "Campo 'template' é obrigatório" }, { status: 400 });
    }
    const res = await saveExportTemplate(template);
    if (!res.success) {
      return NextResponse.json({ success: false, error: res.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, template: res.template });
  } catch (e) {
    console.error('Erro ao salvar template de exportação:', e);
    return NextResponse.json({ success: false, error: 'Erro ao salvar template' }, { status: 500 });
  }
}
