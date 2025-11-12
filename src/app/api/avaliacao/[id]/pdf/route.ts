import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { EvaluationSettingsService } from '@/lib/services/evaluation-settings';
import { PDFDocument, StandardFonts } from 'pdf-lib';

// GET /api/avaliacao/:id/pdf -> retorna PDF (base64) simplificado
export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    const { data: avaliacao, error } = await supabase
      .from('vw_avaliacoes_desempenho')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error || !avaliacao) {
      return NextResponse.json({ success: false, error: 'Avaliação não encontrada', timestamp: new Date().toISOString() }, { status: 404 });
    }

    // Respostas
    const { data: respostas } = await supabase
      .from('avaliacao_respostas')
      .select('*')
      .eq('avaliacao_id', id);

    // Settings para método
    const settings = await EvaluationSettingsService.getEffectiveSettings(avaliacao.ciclo_id || null);
    const metodo = settings?.calculo?.method || 'simple_average';

    // Calcular média local caso não exista
    let media = 0;
    if (respostas && respostas.length) {
      if (metodo === 'weighted' && settings?.calculo?.weights) {
        let somaPeso = 0; let soma = 0;
        for (const r of respostas) {
          const peso = settings.calculo.weights[String(r.pergunta_id)] || 1;
          soma += r.nota * peso; somaPeso += peso;
        }
        media = somaPeso ? soma / somaPeso : 0;
      } else {
        media = respostas.reduce((acc, r) => acc + r.nota, 0) / respostas.length;
      }
      media = Math.round(media * 10) / 10;
    }

    // Criar PDF real
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const { width } = page.getSize();
    let y = page.getHeight() - 50;
    const lineHeight = 16;
    const drawLine = (text: string, size = 12, bold = false) => {
      page.drawText(text, { x: 50, y, size, font, color: undefined, fontWeight: bold ? 'bold' : undefined });
      y -= lineHeight;
    };
    drawLine(`Relatório de Avaliação`, 20, true);
    drawLine(`ID: ${avaliacao.id}`);
    drawLine(`Colaborador: ${avaliacao.funcionario_nome}`);
    drawLine(`Avaliador: ${avaliacao.avaliador_nome}`);
    drawLine(`Método de Cálculo: ${metodo}`);
    drawLine(`Pontuação Média: ${media}`);
    drawLine(`Total de Respostas: ${respostas?.length || 0}`);
    y -= 10;
    drawLine('Respostas:', 14, true);
    (respostas || []).forEach(r => {
      const linha = `Pergunta ${r.pergunta_id}: Nota ${r.nota}${r.comentario ? ' - ' + r.comentario.substring(0,60) : ''}`;
      drawLine(linha);
      if (y < 60) { // nova página se espaço insuficiente
        const newPage = pdfDoc.addPage();
        y = newPage.getHeight() - 50;
      }
    });

    const pdfBytes = await pdfDoc.save();
    const base64 = Buffer.from(pdfBytes).toString('base64');
    return NextResponse.json({ success: true, data: { pdf_base64: base64, filename: `avaliacao_${avaliacao.id}.pdf` }, timestamp: new Date().toISOString() });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message, timestamp: new Date().toISOString() }, { status: 500 });
  }
}
