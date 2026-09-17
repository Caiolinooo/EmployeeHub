import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';
import { renderToBuffer } from '@react-pdf/renderer';
import { PurchaseOrderPdf } from '@/components/PurchaseOrder/PurchaseOrderPdf';
import React from 'react';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const poId = params.id;
    if (!poId) return new NextResponse('Missing ID', { status: 400 });

    try {
        const { data: po, error } = await supabaseAdmin
            .from('purchase_orders')
            .select(`*, suppliers(*)`)
            .eq('id', poId)
            .single();

        if (error) {
            console.error('[PDF] Supabase error fetching PO:', JSON.stringify(error));
            return new NextResponse(`DB Error: ${error.message} (code: ${error.code})`, { status: 500 });
        }

        if (!po) {
            console.error('[PDF] PO not found for id:', poId);
            return new NextResponse('Order not found', { status: 404 });
        }

        // @ts-expect-error - renderToBuffer não tipa os props do componente PDF
        const pdfBuffer = await renderToBuffer(React.createElement(PurchaseOrderPdf, { data: po }));

        const headers = new Headers();
        headers.set('Content-Type', 'application/pdf');
        headers.set('Content-Disposition', `attachment; filename=RQF-${po.po_number || poId}.pdf`);

        return new NextResponse(pdfBuffer as unknown as BodyInit, { status: 200, headers });

    } catch (error: any) {
        console.error('Error generating PDF:', error);
        return new NextResponse(error.message, { status: 500 });
    }
}
