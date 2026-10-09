import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { authenticateUser } from '@/lib/api-auth';
import { canContractAction } from '@/lib/contracts/action-gate';
import { generateSHA256, generateFinalHash } from '@/lib/services/CryptographyService';
import { embedSignatureOnPdf, addAuditPage, embedFieldsAndSignaturesOnPdf, PdfFieldItem } from '@/lib/services/PdfEditorService';
import { dispatchEnvelopeStage } from '@/lib/envelopeDispatcher';
import { normalizeCpf, birthDatesMatch } from '@/lib/utils/identity';
import { latestAuditForDocument, storagePathFromUrl } from '@/lib/contracts/signed-file';
import { missingRequiredFieldValue } from '@/lib/contracts/signature-queue';


export const dynamic = 'force-dynamic';

// POST — Sign a document (authenticated or public)
export async function POST(request: NextRequest) {
    try {
        // Try authenticated first, but allow public access
        const { user, error: authError } = await authenticateUser(request);
        const isPublicAccess = !user || authError;

        const body = await request.json();
        const { solicitacao_id, signature_base64, signer_data, sign_method, field_values } = body;

        if (!solicitacao_id || !signature_base64) {
            return NextResponse.json({
                error: 'Campos obrigatórios: solicitacao_id, signature_base64'
            }, { status: 400 });
        }

        // 1. Fetch the request (Unconditional search, enforce security check next)
        const { data: solicitacao, error: solError } = await supabaseAdmin
            .from('solicitacoes_assinatura')
            .select(`
                *,
                documento:documentos_trabalhistas!documento_id (
                    id, titulo, arquivo_url, hash_original, enviado_por
                ),
                envelope:envelopes!envelope_id (
                    id, remetente_id
                )
            `)
            .eq('id', solicitacao_id)
            .eq('status', 'PENDING')
            .single();

        if (solError || !solicitacao) {
            return NextResponse.json({
                error: 'Solicitação não encontrada ou já assinada'
            }, { status: 404 });
        }

        // SECURITY ENFORCEMENT:
        // If this signature is tied to a internal collaborator, verify that ANY authenticated session matches this ID.
        // If solicitacao.colaborador_id is null, it allows "external" (token-possession) access.
        if (solicitacao.colaborador_id) {
            if (isPublicAccess || !user || user.id !== solicitacao.colaborador_id) {
                return NextResponse.json({
                    error: 'Esta assinatura está vinculada a um usuário específico e não pode ser realizada anonimamente ou por outra conta.'
                }, { status: 403 });
            }
        }

        if (user && !isPublicAccess && !canContractAction({ role: user.role, features: user.access_permissions?.features }, 'sign')) {
            return NextResponse.json({ error: 'Permissão insuficiente para assinar contratos' }, { status: 403 });
        }

        const documento = solicitacao.documento as any;

        // IDENTITY VALIDATION for public/external access
        // This is the server-side guard — even if the frontend is bypassed,
        // the signature will be rejected if identity data doesn't match.
        if (isPublicAccess && !signer_data) {
            return NextResponse.json({ error: 'Dados de identificação do signatário são obrigatórios.' }, { status: 400 });
        }
        if (isPublicAccess && signer_data) {
            const expectedEmail = solicitacao.external_signer_email?.toLowerCase()?.trim();
            const providedEmail = signer_data.email?.toLowerCase()?.trim();

            // 1. Validate email
            if (expectedEmail && providedEmail !== expectedEmail) {
                return NextResponse.json({
                    error: 'E-mail não autorizado para este documento.',
                    code: 'EMAIL_MISMATCH'
                }, { status: 403 });
            }

            // 2. Validate CPF (if registered for this signer)
            const expectedTaxId = (solicitacao as any).external_signer_tax_id;
            if (expectedTaxId) {
                const normalizedProvided = normalizeCpf(signer_data.cpf || '');
                const normalizedExpected = normalizeCpf(expectedTaxId);
                if (normalizedProvided !== normalizedExpected) {
                    return NextResponse.json({
                        error: 'CPF não confere com o registro do signatário.',
                        code: 'CPF_MISMATCH'
                    }, { status: 403 });
                }
            }

            // 3. Validate birth date (if registered for this signer)
            const expectedBirthDate = (solicitacao as any).external_signer_birth_date;
            if (expectedBirthDate && signer_data.data_nascimento) {
                if (!birthDatesMatch(signer_data.data_nascimento, expectedBirthDate)) {
                    return NextResponse.json({
                        error: 'Data de nascimento não confere com o registro do signatário.',
                        code: 'BIRTH_DATE_MISMATCH'
                    }, { status: 403 });
                }
            }
        }

        // 1b. Verify sequential order (Enforce globally across the entire Envelope)
        const currentOrdem = solicitacao.ordem || 1;
        const envelopeId = solicitacao.envelope_id;

        const { data: previousPending } = await supabaseAdmin
            .from('solicitacoes_assinatura')
            .select('id')
            .eq('envelope_id', envelopeId)
            .eq('status', 'PENDING')
            .neq('tipo', 'copia')
            .lt('ordem', currentOrdem)
            .limit(1);

        if (previousPending && previousPending.length > 0) {
            return NextResponse.json({
                error: 'Você não pode assinar agora. Existem assinaturas pendentes em etapas anteriores.',
                code: 'OUT_OF_ORDER'
            }, { status: 403 });
        }

        // 2. Capture session metadata
        const ip = request.headers.get('x-forwarded-for')
            || request.headers.get('x-real-ip')
            || request.headers.get('cf-connecting-ip')
            || '0.0.0.0';
        const userAgent = request.headers.get('user-agent') || 'Unknown';
        const timestamp = new Date().toISOString();

        // 3. Download the correct PDF (Latest from audit, or original)
        let pdfBytes: Uint8Array;
        let expectedHash = documento.hash_original;
        
        // Find if there is a previous signature for this document
        const lastAudit = await latestAuditForDocument(supabaseAdmin, documento.id);

        try {
            let urlToDownload = documento.arquivo_url;
            if (lastAudit && lastAudit.arquivo_assinado_url) {
                urlToDownload = lastAudit.arquivo_assinado_url;
                const lastMeta = lastAudit.metadados as any;
                expectedHash = lastMeta?.hash_arquivo_final || lastAudit.hash_final;
            }

            const bucketName = 'documentos-trabalhistas';
            const storagePath = storagePathFromUrl(urlToDownload, bucketName);

            const { data: fileData, error: dlError } = await supabaseAdmin
                .storage
                .from(bucketName)
                .download(storagePath);

            if (dlError || !fileData) {
                console.error('Erro ao baixar PDF:', dlError);
                return NextResponse.json({ error: 'Erro ao baixar o documento para assinatura' }, { status: 500 });
            }

            pdfBytes = new Uint8Array(await fileData.arrayBuffer());
        } catch (dlErr) {
            console.error('Erro ao baixar PDF:', dlErr);
            return NextResponse.json({ error: 'Erro ao acessar o documento' }, { status: 500 });
        }

        // 4. Verify hash integrity of the chain
        const currentHash = generateSHA256(pdfBytes);
        if (currentHash !== expectedHash) {
            // Se a assinatura anterior não possui 'hash_arquivo_final' gravado, trata-se de um legado criado antes do fix.
            // Para não quebrar documentos antigos, emitimos um aviso e deixamos prosseguir.
            const lastMeta = lastAudit?.metadados as any;
            const isLegacy = lastAudit && !lastMeta?.hash_arquivo_final;

            if (isLegacy) {
                console.warn(`[Integridade] Assinatura anterior legado detectada (sem hash_arquivo_final). Ignorando verificação estrita de cadeia.`);
            } else {
                console.error(`Hash mismatch! Esperado: ${expectedHash}, Obtido: ${currentHash}`);
                return NextResponse.json({
                    error: 'ALERTA: A integridade do documento foi comprometida. A cadeia de hashes não confere.'
                }, { status: 422 });
            }
        }

        // 5. Determine signer identity
        const signerId = user?.id || 'publico';
        const signerName = isPublicAccess && signer_data 
            ? signer_data.nome 
            : `${user?.first_name || ''} ${user?.last_name || ''}`;
        const signerEmail = isPublicAccess && signer_data 
            ? signer_data.email 
            : user?.email || '';
        
        // 5b. Fetch all other pending fields for the same signer in this document to sign/fill them in a single batch
        let fieldsQuery = supabaseAdmin
            .from('solicitacoes_assinatura')
            .select('*')
            .eq('documento_id', solicitacao.documento_id)
            .eq('status', 'PENDING');

        if (solicitacao.colaborador_id) {
            fieldsQuery = fieldsQuery.eq('colaborador_id', solicitacao.colaborador_id);
        } else {
            fieldsQuery = fieldsQuery.eq('external_signer_email', solicitacao.external_signer_email);
        }

        const { data: siblingFields } = await fieldsQuery;
        const siblingList = siblingFields || [];

        const filled = (field_values && typeof field_values === 'object') ? field_values as Record<string, string> : {};
        const missing = siblingList.find((sib) => missingRequiredFieldValue(sib, filled));
        if (missing) {
            return NextResponse.json({
                error: missing.tipo === 'checkbox'
                    ? 'Marque os campos obrigatórios antes de assinar.'
                    : 'Preencha os campos obrigatórios antes de assinar.',
                field_id: missing.id,
            }, { status: 400 });
        }

        // Update sibling fields in the database as completed
        for (const sib of siblingList) {
            if (sib.id === solicitacao.id) continue;

            const updates: any = {
                status: 'SIGNED',
                updated_at: timestamp,
            };

            if (sib.tipo === 'texto' || sib.tipo === 'checkbox') {
                const val = field_values && field_values[sib.id] !== undefined
                    ? String(field_values[sib.id])
                    : (sib.tipo === 'checkbox' ? 'false' : '');
                updates.valor_preenchido = val;
                sib.valor_preenchido = val; // Store locally for drawing
            }

            await supabaseAdmin
                .from('solicitacoes_assinatura')
                .update(updates)
                .eq('id', sib.id);
        }

        // Gather all fields to draw
        const fieldsToDraw: PdfFieldItem[] = [];

        // Add primary signature field
        const isRubrica = solicitacao.tipo === 'rubrica';
        fieldsToDraw.push({
            tipo: solicitacao.tipo as any,
            x: solicitacao.posicao_x,
            y: solicitacao.posicao_y,
            width: solicitacao.largura_assinatura || (isRubrica ? 100 : 150),
            height: solicitacao.altura_assinatura || (isRubrica ? 30 : 50),
            page: solicitacao.pagina_assinatura,
            signatureBase64: signature_base64
        });

        // Add other sibling fields
        for (const sib of siblingList) {
            if (sib.id === solicitacao.id) continue;

            if (sib.tipo === 'assinatura' || sib.tipo === 'rubrica') {
                fieldsToDraw.push({
                    tipo: sib.tipo as any,
                    x: sib.posicao_x,
                    y: sib.posicao_y,
                    width: sib.largura_assinatura || (sib.tipo === 'rubrica' ? 100 : 150),
                    height: sib.altura_assinatura || (sib.tipo === 'rubrica' ? 30 : 50),
                    page: sib.pagina_assinatura,
                    signatureBase64: signature_base64
                });
            } else {
                fieldsToDraw.push({
                    tipo: sib.tipo as any,
                    x: sib.posicao_x,
                    y: sib.posicao_y,
                    width: sib.largura_assinatura || (sib.tipo === 'checkbox' ? 12 : 150),
                    height: sib.altura_assinatura || (sib.tipo === 'checkbox' ? 12 : 20),
                    page: sib.pagina_assinatura,
                    value: sib.valor_preenchido || ''
                });
            }
        }

        // Draw all onto PDF in one single pass
        let signedPdf = await embedFieldsAndSignaturesOnPdf({
            pdfBytes,
            fields: fieldsToDraw
        });

        // 6. Generate final hash
        const hashFinal = generateFinalHash(signedPdf, ip, timestamp, signerId);

        // 7. Add audit page with all signer details
        signedPdf = await addAuditPage(signedPdf, {
            documentoTitulo: documento.titulo,
            colaboradorNome: signerName,
            colaboradorEmail: signerEmail,
            dataHora: timestamp,
            ip,
            navegador: userAgent,
            hashOriginal: documento.hash_original,
            hashFinal,
            assinaturaTipo: isRubrica ? 'Rubrica' : 'Assinatura',
            metodoAssinatura: sign_method || (isPublicAccess ? 'dados_pessoais' : 'conta_portal'),
            colaboradorCpf: signer_data?.cpf || null,
            telefone: signer_data?.telefone || null,
        });

        // 7b. Compute physical SHA256 of this exact PDF including the appended audit page,
        // so the next signer can mathematically prove they downloaded this identical file.
        const finalPdfFileHash = generateSHA256(signedPdf);

        // 8. Upload signed PDF to storage
        const signedFileName = `assinados/${solicitacao_id}_${Date.now()}.pdf`;
        const { error: uploadError } = await supabaseAdmin
            .storage
            .from('documentos-trabalhistas')
            .upload(signedFileName, Buffer.from(signedPdf), {
                contentType: 'application/pdf',
                upsert: false,
            });

        if (uploadError) {
            console.error('Erro ao fazer upload do PDF assinado:', uploadError);
            return NextResponse.json({ error: 'Erro ao salvar documento assinado' }, { status: 500 });
        }

        const { data: signedUrlData } = await supabaseAdmin
            .storage
            .from('documentos-trabalhistas')
            .createSignedUrl(signedFileName, 3600);

        // Banco guarda o path. A resposta devolve URL fresca para o viewer.
        const arquivoAssinadoUrl = signedFileName;
        const arquivoAssinadoPublico = signedUrlData?.signedUrl || signedFileName;

        // 9. Insert audit record
        const { error: auditError } = await supabaseAdmin
            .from('auditoria_assinaturas')
            .insert({
                solicitacao_id,
                colaborador_id: user?.id || null,
                ip_origem: ip,
                user_agent: userAgent,
                data_assinatura: timestamp,
                hash_final: hashFinal,
                arquivo_assinado_url: arquivoAssinadoUrl,
                metadados: {
                    hash_original: documento.hash_original,
                    hash_anterior: expectedHash,
                    hash_arquivo_final: finalPdfFileHash,
                    pagina: solicitacao.pagina_assinatura,
                    posicao: { x: solicitacao.posicao_x, y: solicitacao.posicao_y },
                    assinante_nome: signerName,
                    assinante_email: signerEmail,
                    assinante_cpf: signer_data?.cpf || null,
                    assinante_data_nascimento: signer_data?.data_nascimento || null
                },
            });

        if (auditError) {
            console.error('Erro ao registrar auditoria:', auditError);
            // Non-critical — signature was already applied
        }

        // 10. Update request status to SIGNED
        const { error: updateError } = await supabaseAdmin
            .from('solicitacoes_assinatura')
            .update({
                status: 'SIGNED',
                updated_at: timestamp,
            })
            .eq('id', solicitacao_id);

        if (updateError) {
            console.error('Erro ao atualizar status:', updateError);
        }

        // 11. Advance Envelope Flow and Send Intermediate Notifications
        try {
            const { sendGlobalNotification } = await import('@/lib/global-notifications');
            const assinanteFinal = signer_data?.nome || `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || 'Um colaborador';

            // Notify Creator of the Envelope about intermediate progress
            const creatorId = solicitacao.envelope?.remetente_id || documento.enviado_por;
            if (creatorId) {
                await sendGlobalNotification({
                    userId: creatorId,
                    submodule: 'contratos',
                    type: 'signature_progress',
                    title: 'Assinatura coletada',
                    message: `${assinanteFinal} assinou o documento "${documento.titulo}".`,
                    actionUrl: `/contratos/${envelopeId}`,
                    channels: ['in-app', 'email'],
                    priority: 'low'
                });
            }

            // Run central dispatcher engine to determine next signers (if any) across the whole envelope
            if (envelopeId) {
                await dispatchEnvelopeStage(envelopeId);
            }

        } catch (notifErr) {
            console.warn('Falha ao processar avanço do envelope:', notifErr);
        }

        return NextResponse.json({
            success: true,
            message: 'Documento assinado com sucesso',
            hash_final: hashFinal,
            arquivo_assinado_url: arquivoAssinadoPublico,
        });
    } catch (error) {
        console.error('Erro em POST /api/contracts/sign:', error);
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
    }
}

// PUT — Track document visualization & Notify Creator
export async function PUT(request: NextRequest) {
    try {
        const { token } = await request.json();
        if (!token) {
            return NextResponse.json({ error: 'Token ausente' }, { status: 400 });
        }

        // 1. Get the solicitation
        const { data: solicitacao, error: fetchError } = await supabaseAdmin
            .from('solicitacoes_assinatura')
            .select(`
                id, 
                visualizado_em, 
                status, 
                envelope_id,
                external_signer_name,
                external_signer_email,
                colaborador_id,
                envelope:envelopes(titulo, remetente_id),
                colaborador:users_unified(first_name, last_name)
            `)
            .eq('token_acesso', token)
            .single();

        if (fetchError || !solicitacao) {
            return NextResponse.json({ error: 'Convite inválido' }, { status: 404 });
        }

        // Only track if not already viewed and is still pending
        if (!solicitacao.visualizado_em && solicitacao.status === 'PENDING') {
            const now = new Date().toISOString();
            
            // 2. Update in Database
            await supabaseAdmin
                .from('solicitacoes_assinatura')
                .update({ visualizado_em: now })
                .eq('id', solicitacao.id);

            // 3. Send notification to the creator
            try {
                const { sendGlobalNotification } = await import('@/lib/global-notifications');
                const creatorId = (solicitacao.envelope as any)?.remetente_id;
                
                if (creatorId) {
                    const visualizador = solicitacao.colaborador 
                        ? `${(solicitacao.colaborador as any).first_name} ${(solicitacao.colaborador as any).last_name || ''}`.trim()
                        : (solicitacao.external_signer_name || solicitacao.external_signer_email || 'Signatário Externo');

                    const envelopeTitulo = (solicitacao.envelope as any)?.titulo || 'um documento';

                    await sendGlobalNotification({
                        userId: creatorId,
                        submodule: 'contratos',
                        type: 'document_viewed',
                        title: 'Documento Visualizado!',
                        message: `O signatário "${visualizador}" abriu e visualizou o envelope "${envelopeTitulo}".`,
                        actionUrl: `/contratos/${solicitacao.envelope_id}`,
                        channels: ['in-app', 'email'],
                        priority: 'low'
                    }).catch(err => console.warn('Erro ao enviar notificação de visualização:', err));
                }
            } catch (notifErr) {
                console.warn('Erro ao disparar notificação de visualização:', notifErr);
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Erro em PUT /api/contracts/sign:', error);
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
    }
}
