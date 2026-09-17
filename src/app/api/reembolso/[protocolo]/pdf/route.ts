
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateReimbursementPDF } from '@/lib/pdf-generator';

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

export async function GET(request: NextRequest, props: { params: Promise<{ protocolo: string }> }) {
    const params = await props.params;
    try {
        // Usar params.protocolo conforme a estrutura de diretórios
        const id = params.protocolo;

        if (!id) {
            return NextResponse.json({ error: 'ID/Protocol is required' }, { status: 400 });
        }

        console.log(`[PDF] Iniciando download do relatório para reembolso: ${id}`);

        // 1. Tentar buscar o PDF no Storage primeiro (caminho: relatorios/ID.pdf)
        const fileName = `relatorios/${id}.pdf`;
        const bucketName = 'comprovantes';

        const { data: fileData, error: fileError } = await supabaseAdmin
            .storage
            .from(bucketName)
            .download(fileName);

        if (!fileError && fileData) {
            console.log(`[PDF] Arquivo encontrado no Storage: ${fileName}`);
            // Converter Blob para ArrayBuffer para Buffer
            const arrayBuffer = await fileData.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            return new NextResponse(buffer, {
                headers: {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': `attachment; filename="Relatorio_Despesas_${id.slice(0, 8)}.pdf"`,
                },
            });
        }

        console.log(`[PDF] Arquivo não encontrado no Storage via download (${fileError?.message}). Gerando novo...`);

        // 2. Se não existir, buscar dados do reembolso no banco
        // O id recebido pode ser um UUID ou um protocolo customizado
        const reimbursementData: any = null;

        // Tentar buscar por ID primeiro (assumindo que o "protocolo" na URL pode ser o ID interno)
        const { data: reimbursementById, error: dbError } = await supabaseAdmin
            .from('Reimbursement')
            .select('*') // Removed invalid join
            .eq('id', id)
            .single();
        let reimbursement = reimbursementById;

        if (dbError || !reimbursement) {
            // Tentar buscar pela coluna protocolo se ID falhar
            const { data: byProtocol, error: protocolError } = await supabaseAdmin
                .from('Reimbursement')
                .select('*') // Removed invalid join
                .eq('protocolo', id)
                .single();

            if (protocolError || !byProtocol) {
                console.error('[PDF] Reembolso não encontrado no banco:', dbError || protocolError);
                return NextResponse.json({ error: 'Reembolso não encontrado' }, { status: 404 });
            }
            reimbursement = byProtocol;
        }

        // 3. Gerar o PDF
        // Usar dados diretos da tabela ou fallbacks
        const userName = reimbursement.nome || reimbursement.user_name || reimbursement.email;
        const department = reimbursement.centro_custo || reimbursement.department || 'N/A';

        const pdfBuffer = await generateReimbursementPDF({
            id: reimbursement.id,
            created_at: reimbursement.created_at,
            valor: reimbursement.valor_total || reimbursement.valorTotal || 0,
            descricao: reimbursement.descricao,
            status: reimbursement.status,
            user_email: reimbursement.email,
            user_name: userName,
            cpf: reimbursement.cpf,
            department: department,
            category: reimbursement.tipo_reembolso || reimbursement.tipoReembolso || reimbursement.categoria,
            items: reimbursement.items, // Se houver items detalhados
            // Payment Info
            banco: reimbursement.banco,
            agencia: reimbursement.agencia,
            conta: reimbursement.conta,
            pix_chave: reimbursement.pix_chave,
            pix_tipo: reimbursement.pix_tipo
        });

        // 4. Salvar no Storage para cache futuro (fire and forget ou await)
        // Sempre salvar com o ID interno para consistência: relatorios/{uuid}.pdf
        // Se a busca foi feita por protocolo externo, precisamos garantir que o nome do arquivo no storage use o ID interno se possível
        // Mas a lógica de check-first busca por `id` (que é o parametro da URL).
        // Se a URL for /api/reembolso/REQ-123/pdf, ele busca relatorios/REQ-123.pdf.
        // Vamos manter a consistência: o nome do arquivo segue o parametro da URL para facilitar o cache hit.

        const { error: uploadError } = await supabaseAdmin
            .storage
            .from(bucketName)
            .upload(fileName, pdfBuffer, {
                contentType: 'application/pdf',
                upsert: true
            });

        if (uploadError) {
            console.error('[PDF] Erro ao salvar PDF gerado no Storage:', uploadError);
        } else {
            console.log(`[PDF] PDF gerado e salvo no Storage com sucesso: ${fileName}`);
        }

        // 5. Retornar o arquivo gerado
        return new NextResponse(pdfBuffer, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="Relatorio_Despesas_${reimbursement.id.slice(0, 8)}.pdf"`,
            },
        });

    } catch (error: any) {
        console.error('[PDF] Erro fatal ao processar download:', error);
        return NextResponse.json({ error: 'Erro interno ao gerar PDF' }, { status: 500 });
    }
}
