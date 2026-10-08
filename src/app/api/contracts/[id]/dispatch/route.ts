import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { dispatchEnvelopeStage } from '@/lib/envelopeDispatcher';
import { authenticateUser } from '@/lib/api-auth';
import { canMutateEnvelope, denyUnlessCan, loadContractAccess } from '@/lib/contracts/view-access';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { user, error: authError } = await authenticateUser(request);
        if (authError) return authError;
        if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

        const access = await loadContractAccess(user);
        const anyDenied = denyUnlessCan(access, 'dispatch', 'resend');
        if (anyDenied) return anyDenied;

        const { id: envelopeId } = await params;

        if (!envelopeId) {
            return NextResponse.json({ error: 'Envelope ID não fornecido' }, { status: 400 });
        }

        // 1. Verify envelope existence and access
        const { data: envelope, error: findError } = await supabaseAdmin
            .from('envelopes')
            .select('id, titulo, status')
            .eq('id', envelopeId)
            .single();

        if (findError || !envelope) {
            return NextResponse.json({ error: 'Envelope não encontrado' }, { status: 404 });
        }

        // DRAFT = disparo inicial; SENT = reenvio das notificações da etapa atual
        if (envelope.status === 'COMPLETED') {
            return NextResponse.json({ error: 'Envelope já concluído' }, { status: 409 });
        }
        const denied = denyUnlessCan(access, envelope.status === 'SENT' ? 'resend' : 'dispatch');
        if (denied) return denied;

        if (!(await canMutateEnvelope(user, access, envelopeId))) {
            return NextResponse.json({ error: 'Envelope não encontrado' }, { status: 404 });
        }

        // 2. Trigger first dispatch stage logic
        const result = await dispatchEnvelopeStage(envelopeId);

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: 'Fluxo de assinaturas iniciado com sucesso!',
            details: result
        });

    } catch (error) {
        console.error('Erro em POST /api/contracts/[id]/dispatch:', error);
        return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }
}
