import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { authenticateUser } from '@/lib/api-auth';
import { denyUnlessCan, loadContractAccess } from '@/lib/contracts/view-access';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const { user, error: authError } = await authenticateUser(request);
        if (authError) return authError;
        if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
        const denied = denyUnlessCan(await loadContractAccess(user), 'templates.use');
        if (denied) return denied;

        const body = await request.json();
        const { template_id, titulo, descricao, roles_mapping } = body;

        if (!template_id || !titulo) {
            return NextResponse.json({ error: 'ID do template e título do envelope são obrigatórios' }, { status: 400 });
        }

        // 1. Fetch template
        const { data: template, error: tempError } = await supabaseAdmin
            .from('contrato_templates')
            .select('*')
            .eq('id', template_id)
            .single();

        if (tempError || !template) {
            return NextResponse.json({ error: 'Template não encontrado' }, { status: 404 });
        }

        // 2. Fetch template documents and fields
        const { data: tempDocs, error: docsError } = await supabaseAdmin
            .from('contrato_template_documentos')
            .select('*')
            .eq('template_id', template_id)
            .order('ordem', { ascending: true });

        const { data: tempFields, error: fieldsError } = await supabaseAdmin
            .from('contrato_template_campos')
            .select('*')
            .eq('template_id', template_id);

        if (docsError || !tempDocs) {
            return NextResponse.json({ error: 'Erro ao carregar documentos do template' }, { status: 500 });
        }

        // 3. Create new Envelope
        const { data: envelope, error: envError } = await supabaseAdmin
            .from('envelopes')
            .insert({
                titulo,
                descricao: descricao || null,
                remetente_id: user.id,
                status: 'DRAFT'
            })
            .select('*')
            .single();

        if (envError || !envelope) {
            console.error('Erro ao instanciar envelope:', envError);
            return NextResponse.json({ error: 'Erro ao criar envelope' }, { status: 500 });
        }

        // Map template document ID -> new envelope document ID
        const docIdMap = new Map<string, string>();

        // 4. Duplicate documents in Storage and insert DB records
        for (const doc of tempDocs) {
            let originalStoragePath = doc.arquivo_url;
            if (originalStoragePath.includes('/storage/v1/object/')) {
                const parts = originalStoragePath.split('/documentos-trabalhistas/');
                originalStoragePath = parts.length > 1 ? decodeURIComponent(parts[1]) : originalStoragePath;
            }

            // Download original file
            const { data: fileData, error: downloadError } = await supabaseAdmin
                .storage
                .from('documentos-trabalhistas')
                .download(originalStoragePath);

            if (downloadError || !fileData) {
                console.error(`Erro ao baixar arquivo original do template ${doc.arquivo_nome}:`, downloadError);
                return NextResponse.json({ error: `Erro ao copiar arquivo do template: ${doc.arquivo_nome}` }, { status: 500 });
            }

            // Prepare new destination file path
            const ts = Date.now();
            const safeName = doc.arquivo_nome.replace(/[^a-zA-Z0-9._-]/g, '_');
            const newFileName = `${ts}_${uuidv4().substring(0, 4)}_${safeName}`;
            const newStoragePath = `documentos/${user.id}/${newFileName}`;

            // Upload to storage
            const buffer = Buffer.from(await fileData.arrayBuffer());
            const { error: uploadError } = await supabaseAdmin
                .storage
                .from('documentos-trabalhistas')
                .upload(newStoragePath, buffer, {
                    contentType: 'application/pdf',
                    upsert: false
                });

            if (uploadError) {
                console.error(`Erro ao fazer upload da cópia do documento ${doc.arquivo_nome}:`, uploadError);
                return NextResponse.json({ error: `Erro no processamento da cópia do arquivo: ${doc.arquivo_nome}` }, { status: 500 });
            }

            // Save document record linked to the new envelope
            const { data: newDoc, error: insertDocErr } = await supabaseAdmin
                .from('documentos_trabalhistas')
                .insert({
                    envelope_id: envelope.id,
                    titulo: doc.titulo,
                    arquivo_url: newStoragePath,
                    arquivo_nome: doc.arquivo_nome,
                    arquivo_tamanho: doc.arquivo_tamanho,
                    hash_original: doc.hash_original,
                    enviado_por: user.id,
                    status: 'DRAFT'
                })
                .select('*')
                .single();

            if (insertDocErr || !newDoc) {
                console.error(`Erro ao inserir documento no banco:`, insertDocErr);
                return NextResponse.json({ error: 'Erro ao registrar cópia de documento' }, { status: 500 });
            }

            docIdMap.set(doc.id, newDoc.id);
        }

        // 5. Instantiate and map fields (solicitacoes_assinatura)
        if (tempFields && tempFields.length > 0) {
            const fieldsInsert = [];

            for (const field of tempFields) {
                const targetDocId = docIdMap.get(field.documento_id);
                if (!targetDocId) continue; // Skip if document is missing

                let assignedColaboradorId = field.colaborador_id || null;
                let assignedName = field.external_signer_name || null;
                let assignedEmail = field.external_signer_email || null;

                // Map roles
                if (field.papel_nome && roles_mapping && roles_mapping[field.papel_nome]) {
                    const mapping = roles_mapping[field.papel_nome];
                    assignedColaboradorId = mapping.colaborador_id || null;
                    assignedName = mapping.external_signer_name || null;
                    assignedEmail = mapping.external_signer_email || null;
                }
                // Mesmo formato do assign: dispatcher e sign-access agrupam por e-mail exato
                assignedEmail = assignedEmail ? String(assignedEmail).toLowerCase().trim() : null;

                // If not mapped and is a template-specific field without user, skip or set placeholder
                if (!assignedColaboradorId && !assignedEmail) {
                    // Skip if no signer mapped to prevent database key conflicts or invalid signatures
                    continue;
                }

                fieldsInsert.push({
                    documento_id: targetDocId,
                    envelope_id: envelope.id,
                    colaborador_id: assignedColaboradorId,
                    external_signer_name: assignedName,
                    external_signer_email: assignedEmail,
                    pagina_assinatura: field.pagina_assinatura,
                    posicao_x: field.posicao_x,
                    posicao_y: field.posicao_y,
                    largura_assinatura: field.largura_assinatura,
                    altura_assinatura: field.altura_assinatura,
                    tipo: field.tipo,
                    ordem: field.ordem,
                    status: 'PENDING',
                    token_acesso: uuidv4()
                });
            }

            if (fieldsInsert.length > 0) {
                const { error: insertFieldsErr } = await supabaseAdmin
                    .from('solicitacoes_assinatura')
                    .insert(fieldsInsert);

                if (insertFieldsErr) {
                    console.error('Erro ao copiar e mapear campos do template:', insertFieldsErr);
                    return NextResponse.json({ error: 'Erro ao configurar os assinantes nas posições mapeadas' }, { status: 500 });
                }
            }
        }

        return NextResponse.json({
            success: true,
            envelope_id: envelope.id,
            message: 'Envelope instanciado a partir do template com sucesso!'
        });

    } catch (error) {
        console.error('Erro em POST /api/contracts/templates/use:', error);
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
    }
}
