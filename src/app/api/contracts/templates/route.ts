import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { authenticateUser } from '@/lib/api-auth';
import { denyUnlessCan, loadContractAccess } from '@/lib/contracts/view-access';
import { generateSHA256 } from '@/lib/services/CryptographyService';

export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

// GET — List templates or get template details
export async function GET(request: NextRequest) {
    try {
        const { user, error: authError } = await authenticateUser(request);
        if (authError) return authError;
        if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
        const denied = denyUnlessCan(await loadContractAccess(user), 'templates.view', 'templates.manage', 'templates.use');
        if (denied) return denied;

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (id) {
            // Fetch single template
            const { data: template, error: tempError } = await supabaseAdmin
                .from('contrato_templates')
                .select('*')
                .eq('id', id)
                .single();

            if (tempError || !template) {
                return NextResponse.json({ error: 'Template não encontrado' }, { status: 404 });
            }

            // Fetch documents
            const { data: documentos, error: docError } = await supabaseAdmin
                .from('contrato_template_documentos')
                .select('*')
                .eq('template_id', id)
                .order('ordem', { ascending: true });

            if (docError) {
                return NextResponse.json({ error: 'Erro ao carregar documentos do template' }, { status: 500 });
            }

            // Fetch pre-positioned fields
            const { data: campos, error: camposError } = await supabaseAdmin
                .from('contrato_template_campos')
                .select('*')
                .eq('template_id', id)
                .order('ordem', { ascending: true });

            // Generate signed URLs for documents
            const processedDocuments = await Promise.all((documentos || []).map(async (doc) => {
                let storagePath = doc.arquivo_url;
                if (storagePath.includes('/storage/v1/object/')) {
                    const bucketMarker = '/documentos-trabalhistas/';
                    if (storagePath.includes(bucketMarker)) {
                        storagePath = decodeURIComponent(storagePath.split(bucketMarker)[1]);
                        if (storagePath.includes('?')) {
                            storagePath = storagePath.split('?')[0];
                        }
                    }
                }
                try {
                    const { data: signedData } = await supabaseAdmin
                        .storage
                        .from('documentos-trabalhistas')
                        .createSignedUrl(storagePath, 3600);

                    return {
                        ...doc,
                        arquivo_url: signedData?.signedUrl || doc.arquivo_url
                    };
                } catch (e) {
                    return doc;
                }
            }));

            return NextResponse.json({
                success: true,
                template,
                documentos: processedDocuments,
                campos: campos || []
            });
        }

        // List all templates
        const { data: templates, error: listError } = await supabaseAdmin
            .from('contrato_templates')
            .select('*')
            .order('created_at', { ascending: false });

        if (listError) {
            return NextResponse.json({ error: 'Erro ao carregar templates' }, { status: 500 });
        }

        return NextResponse.json({ success: true, templates: templates || [] });

    } catch (error) {
        console.error('Erro em GET /api/contracts/templates:', error);
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
    }
}

// POST — Create or edit template / save template fields
export async function POST(request: NextRequest) {
    try {
        const { user, error: authError } = await authenticateUser(request);
        if (authError) return authError;
        if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

        const denied = denyUnlessCan(await loadContractAccess(user), 'templates.manage');
        if (denied) return denied;

        const contentType = request.headers.get('content-type') || '';

        // Case 1: JSON body (saving fields or metadata updates)
        if (contentType.includes('application/json')) {
            const body = await request.json();
            const { id, titulo, descricao, papeis, campos } = body;

            if (!id) {
                return NextResponse.json({ error: 'ID do template é obrigatório para atualização via JSON' }, { status: 400 });
            }

            // Update metadata if provided
            if (titulo !== undefined) {
                const { error: updateError } = await supabaseAdmin
                    .from('contrato_templates')
                    .update({
                        titulo,
                        descricao: descricao || null,
                        papeis: papeis || []
                    })
                    .eq('id', id);

                if (updateError) {
                    return NextResponse.json({ error: 'Erro ao atualizar dados do template' }, { status: 500 });
                }
            }

            // Save fields if provided
            if (campos !== undefined) {
                // Delete existing fields first
                const { error: deleteError } = await supabaseAdmin
                    .from('contrato_template_campos')
                    .delete()
                    .eq('template_id', id);

                if (deleteError) {
                    return NextResponse.json({ error: 'Erro ao limpar campos anteriores' }, { status: 500 });
                }

                if (campos.length > 0) {
                    const camposInsert = campos.map((c: any) => ({
                        template_id: id,
                        documento_id: c.documento_id,
                        papel_nome: c.papel_nome || null,
                        colaborador_id: c.colaborador_id || null,
                        external_signer_name: c.external_signer_name || null,
                        external_signer_email: c.external_signer_email || null,
                        pagina_assinatura: c.pagina_assinatura,
                        posicao_x: c.posicao_x,
                        posicao_y: c.posicao_y,
                        largura_assinatura: c.largura_assinatura || 150,
                        altura_assinatura: c.altura_assinatura || 50,
                        tipo: c.tipo,
                        ordem: c.ordem || 1
                    }));

                    const { error: insertError } = await supabaseAdmin
                        .from('contrato_template_campos')
                        .insert(camposInsert);

                    if (insertError) {
                        console.error('Erro ao salvar novos campos:', insertError);
                        return NextResponse.json({ error: 'Erro ao salvar novos campos' }, { status: 500 });
                    }
                }
            }

            return NextResponse.json({ success: true, message: 'Template atualizado com sucesso!' });
        }

        // Case 2: Multipart Form Data (create new template with uploaded files)
        const formData = await request.formData();
        const titulo = formData.get('titulo') as string | null;
        const descricao = formData.get('descricao') as string | null;
        const papeisStr = formData.get('papeis') as string | null;
        const files = formData.getAll('files') as File[];

        if (!titulo || files.length === 0) {
            return NextResponse.json({ error: 'Título e pelo menos um arquivo PDF são obrigatórios' }, { status: 400 });
        }

        let parsedPapeis = [];
        try {
            parsedPapeis = papeisStr ? JSON.parse(papeisStr) : [];
        } catch (e) {
            return NextResponse.json({ error: 'Papéis inválidos' }, { status: 400 });
        }

        // Validate files
        for (const file of files) {
            if (!file.type.includes('pdf')) {
                return NextResponse.json({ error: `Arquivo "${file.name}" não é um PDF válido` }, { status: 400 });
            }
            if (file.size > MAX_FILE_SIZE) {
                return NextResponse.json({ error: `Arquivo "${file.name}" excede o limite de 25MB` }, { status: 400 });
            }
        }

        // Create template
        const { data: template, error: tempError } = await supabaseAdmin
            .from('contrato_templates')
            .insert({
                titulo,
                descricao: descricao || null,
                papeis: parsedPapeis,
                remetente_id: user.id
            })
            .select('*')
            .single();

        if (tempError || !template) {
            return NextResponse.json({ error: 'Erro ao criar registro do template' }, { status: 500 });
        }

        const documentosCriados = [];

        // Upload files and create documents
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const arrayBuffer = await file.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const hashOriginal = generateSHA256(buffer);

            const ts = Date.now();
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
            const fileName = `${ts}_${i}_${safeName}`;
            const storagePath = `templates/${template.id}/${fileName}`;

            const { error: uploadError } = await supabaseAdmin
                .storage
                .from('documentos-trabalhistas')
                .upload(storagePath, buffer, {
                    contentType: 'application/pdf',
                    upsert: false,
                });

            if (uploadError) {
                console.error(`Erro ao fazer upload do arquivo de template ${file.name}:`, uploadError);
                return NextResponse.json({ error: `Erro no upload do arquivo de template: ${file.name}` }, { status: 500 });
            }

            const { data: doc, error: docError } = await supabaseAdmin
                .from('contrato_template_documentos')
                .insert({
                    template_id: template.id,
                    titulo: file.name.replace('.pdf', ''),
                    arquivo_url: storagePath,
                    arquivo_nome: file.name,
                    arquivo_tamanho: file.size,
                    hash_original: hashOriginal,
                    ordem: i
                })
                .select('*')
                .single();

            if (docError || !doc) {
                return NextResponse.json({ error: `Erro ao salvar documento de template no banco: ${file.name}` }, { status: 500 });
            }

            documentosCriados.push(doc);
        }

        return NextResponse.json({
            success: true,
            template,
            documentos: documentosCriados
        });

    } catch (error) {
        console.error('Erro em POST /api/contracts/templates:', error);
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
    }
}

// DELETE — Delete a template
export async function DELETE(request: NextRequest) {
    try {
        const { user, error: authError } = await authenticateUser(request);
        if (authError) return authError;
        if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

        const denied = denyUnlessCan(await loadContractAccess(user), 'templates.manage');
        if (denied) return denied;

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });
        }

        // Fetch template documents to delete files in storage
        const { data: docs, error: fetchDocsErr } = await supabaseAdmin
            .from('contrato_template_documentos')
            .select('arquivo_url')
            .eq('template_id', id);

        if (fetchDocsErr) {
            return NextResponse.json({ error: 'Erro ao carregar documentos para exclusão' }, { status: 500 });
        }

        const filesToDelete = (docs || []).map(d => {
            let path = d.arquivo_url;
            if (path.includes('/storage/v1/object/')) {
                const parts = path.split('/documentos-trabalhistas/');
                path = parts.length > 1 ? decodeURIComponent(parts[1]) : path;
            }
            return path;
        });

        if (filesToDelete.length > 0) {
            const { error: storageErr } = await supabaseAdmin
                .storage
                .from('documentos-trabalhistas')
                .remove(filesToDelete);

            if (storageErr) {
                console.error('Aviso ao excluir arquivos de template do storage:', storageErr);
            }
        }

        const { error: deleteErr } = await supabaseAdmin
            .from('contrato_templates')
            .delete()
            .eq('id', id);

        if (deleteErr) {
            return NextResponse.json({ error: 'Erro ao excluir template do banco' }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: 'Template excluído com sucesso!' });

    } catch (error) {
        console.error('Erro em DELETE /api/contracts/templates:', error);
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
    }
}
