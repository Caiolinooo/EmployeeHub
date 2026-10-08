import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { authenticateUser } from '@/lib/api-auth';
import { normalizeCpf } from '@/lib/utils/identity';
import { canMutateEnvelope, denyUnlessCan, isOwnSolicitacao, loadContractAccess } from '@/lib/contracts/view-access';


export const dynamic = 'force-dynamic';

// POST — Assign signature request to a collaborator (HR only)
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { user, error: authError } = await authenticateUser(request);
        if (authError) return authError;
        if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

        const access = await loadContractAccess(user);
        const denied = denyUnlessCan(access, 'signers.manage');
        if (denied) return denied;

        const { id: envelopeId } = await params;
        if (!(await canMutateEnvelope(user, access, envelopeId))) {
            return NextResponse.json({ error: 'Envelope não encontrado' }, { status: 404 });
        }
        const body = await request.json();
        const { 
            documento_id, 
            colaborador_id, 
            external_signer_name,
            external_signer_email,
            external_signer_tax_id,
            external_signer_birth_date,
            pagina_assinatura, 
            posicao_x, 
            posicao_y, 
            largura_assinatura, 
            altura_assinatura, 
            tipo 
        } = body;


        const isCC = tipo === 'copia';

        if (!documento_id) {
            return NextResponse.json({ error: 'Campos obrigatórios: documento_id' }, { status: 400 });
        }

        if (!isCC && (posicao_x === undefined || posicao_y === undefined)) {
            return NextResponse.json({
                error: 'Campos obrigatórios para assinatura: posicao_x, posicao_y'
            }, { status: 400 });
        }

        // Must provide either internal collaborator OR external email
        if (!colaborador_id && !external_signer_email) {
            return NextResponse.json({
                error: 'É necessário informar um colaborador ou um e-mail de signatário externo'
            }, { status: 400 });
        }

        // Verify document exists and belongs to this envelope
        const { data: doc } = await supabaseAdmin
            .from('documentos_trabalhistas')
            .select('id, titulo, envelope_id')
            .eq('id', documento_id)
            .eq('envelope_id', envelopeId)
            .single();

        if (!doc) {
            return NextResponse.json({ error: 'Documento não pertence a este envelope ou não existe' }, { status: 404 });
        }

        // Verify collaborator exists if provided
        if (colaborador_id) {
            const { data: collaborator } = await supabaseAdmin
                .from('users_unified')
                .select('id, first_name, last_name, email, tax_id, birth_date')
                .eq('id', colaborador_id)
                .single();

            if (!collaborator) {
                return NextResponse.json({ error: 'Colaborador não encontrado' }, { status: 404 });
            }
        }

        // Normalize CPF if provided for external signer
        const normalizedTaxId = external_signer_tax_id ? normalizeCpf(external_signer_tax_id) : null;


        // Insert assignment with envelope link
        const { data: solicitacao, error: insertError } = await supabaseAdmin
            .from('solicitacoes_assinatura')
            .insert({
                documento_id,
                envelope_id: envelopeId,
                colaborador_id: colaborador_id || null,
                external_signer_name: external_signer_name || null,
                external_signer_email: external_signer_email ? external_signer_email.toLowerCase().trim() : null,
                external_signer_tax_id: normalizedTaxId || null,
                external_signer_birth_date: external_signer_birth_date || null,
                pagina_assinatura: isCC ? null : (pagina_assinatura || 1),
                posicao_x: isCC ? null : posicao_x,
                posicao_y: isCC ? null : posicao_y,
                largura_assinatura: isCC ? null : (largura_assinatura || 150),
                altura_assinatura: isCC ? null : (altura_assinatura || 50),
                tipo: tipo || 'assinatura',
                ordem: body.ordem || 1,
                status: 'PENDING',
            })
            .select('*')
            .single();

        if (insertError) {
            if (insertError.code === '23505') {
                return NextResponse.json({
                    error: 'Este colaborador já possui uma atribuição para este documento'
                }, { status: 409 });
            }
            console.error('Erro ao criar solicitação:', insertError);
            return NextResponse.json({ error: 'Erro ao criar solicitação' }, { status: 500 });
        }

        // Send notification (push + in-app + email)
        // ONLY if ordem === 1 AND tipo !== 'copia'
        return NextResponse.json({ success: true, solicitacao });
    } catch (error) {
        console.error('Erro em POST /api/contracts/[id]/assign:', error);
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
    }
}

// GET — List assignments for a document
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { user, error: authError } = await authenticateUser(request);
        if (authError) return authError;
        if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

        const { id: documentoId } = await params;

        const access = await loadContractAccess(user);
        if (access.scope === 'none') {
            return NextResponse.json({ error: 'Permissão insuficiente' }, { status: 403 });
        }

        const { data, error } = await supabaseAdmin
            .from('solicitacoes_assinatura')
            .select(`
                id,
                colaborador_id,
                external_signer_name,
                external_signer_email,
                pagina_assinatura,
                posicao_x,
                posicao_y,
                largura_assinatura,
                altura_assinatura,
                status,
                ordem,
                tipo,
                token_acesso,
                created_at,
                updated_at,
                colaborador:users_unified!colaborador_id (
                    id, first_name, last_name, email, avatar
                )
            `)
            .eq('documento_id', documentoId)
            .order('ordem', { ascending: true })
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Erro ao buscar solicitações:', error);
            return NextResponse.json({ error: 'Erro ao buscar solicitações' }, { status: 500 });
        }

        // Sem view_all: só as próprias; token_acesso (assina como externo) só para gestores
        const rows = (data || [])
            .filter((s) => access.scope === 'all' || isOwnSolicitacao(user, s))
            .map((s) => (access.can['signers.manage'] ? s : { ...s, token_acesso: null }));

        return NextResponse.json({ success: true, solicitacoes: rows });
    } catch (error) {
        console.error('Erro em GET /api/contracts/[id]/assign:', error);
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
    }
}

// DELETE — Remove an assignment (HR only)
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { user, error: authError } = await authenticateUser(request);
        if (authError) return authError;
        if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

        const access = await loadContractAccess(user);
        const denied = denyUnlessCan(access, 'cancel', 'signers.manage');
        if (denied) return denied;

        const { id: envelopeId } = await params;
        if (!(await canMutateEnvelope(user, access, envelopeId))) {
            return NextResponse.json({ error: 'Envelope não encontrado' }, { status: 404 });
        }

        const { searchParams } = new URL(request.url);
        const solicitacaoId = searchParams.get('solicitacao_id');
        if (!solicitacaoId) {
            return NextResponse.json({ error: 'solicitacao_id é obrigatório' }, { status: 400 });
        }

        // Only delete PENDING assignments of this envelope
        const { error } = await supabaseAdmin
            .from('solicitacoes_assinatura')
            .delete()
            .eq('id', solicitacaoId)
            .eq('envelope_id', envelopeId)
            .eq('status', 'PENDING');

        if (error) {
            console.error('Erro ao remover solicitação:', error);
            return NextResponse.json({ error: 'Erro ao remover' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Erro em DELETE /api/contracts/[id]/assign:', error);
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
    }
}
