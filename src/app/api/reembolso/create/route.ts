import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';
import { sendReimbursementConfirmationEmail } from '@/lib/notifications';

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação
    const authHeader = request.headers.get('authorization') || '';
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      console.error('Não autorizado: Token não fornecido');
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    if (!payload) {
      console.error('Não autorizado: Token inválido ou expirado');
      return NextResponse.json(
        { error: 'Token inválido ou expirado' },
        { status: 401 }
      );
    }

    const userId = payload.userId;
    const userEmail = payload.email;

    console.log(`Usuário autenticado: ${userId}, Email: ${userEmail}`);

    // Obter dados do formulário
    const formData = await request.json();
    console.log('Dados recebidos para criação de reembolso:', formData);

    // Remover verificação problemática de tabela
    console.log('Prosseguindo com criação do reembolso...');



    // Verificação de colunas removida para evitar erro de variável não definida
    console.log('Prosseguindo com criação do reembolso sem verificação de colunas...');

    // Gerar protocolo único com timestamp e ID seguro
    const { randomBytes } = await import('crypto');
    const randomPart = randomBytes(2).toString('hex').toUpperCase();
    const protocolo = `REEMB-${Date.now()}-${randomPart}`;

    // Validar centro de custo
    if (!formData.centroCusto || formData.centroCusto.trim() === '') {
      console.error('Centro de custo não informado:', formData.centroCusto);
      return NextResponse.json(
        { error: 'Centro de custo é obrigatório' },
        { status: 400 }
      );
    }

    // Preparar dados para inserção
    const reimbursementData = {
      id: uuidv4(),
      nome: formData.nome,
      email: formData.email.toLowerCase().trim(),
      telefone: formData.telefone,
      cpf: formData.cpf,
      cargo: formData.cargo,
      centroCusto: formData.centroCusto.trim(), // Corrigido para camelCase
      centro_custo: formData.centroCusto.trim(), // Adicionar versão snake_case
      data: new Date(formData.data).toISOString(),
      tipoReembolso: formData.tipoReembolso, // Corrigido para camelCase
      tipo_reembolso: formData.tipoReembolso, // Adicionar versão snake_case
      iconeReembolso: getIconForReimbursementType(formData.tipoReembolso), // Corrigido para camelCase
      icone_reembolso: getIconForReimbursementType(formData.tipoReembolso), // Adicionar versão snake_case
      descricao: formData.descricao,
      valorTotal: parseFloat(formData.valorTotal.replace(/\./g, '').replace(',', '.')) / 100, // Corrigido para camelCase e dividido por 100 para obter valor correto
      valor_total: parseFloat(formData.valorTotal.replace(/\./g, '').replace(',', '.')) / 100, // Adicionar versão snake_case
      moeda: formData.moeda,
      metodoPagamento: formData.metodoPagamento, // Corrigido para camelCase
      metodo_pagamento: formData.metodoPagamento, // Adicionar versão snake_case
      banco: formData.banco || null,
      agencia: formData.agencia || null,
      conta: formData.conta || null,
      pixTipo: formData.pixTipo || null, // Corrigido para camelCase
      pix_tipo: formData.pixTipo || null, // Adicionar versão snake_case
      pixChave: formData.pixChave || null, // Corrigido para camelCase
      pix_chave: formData.pixChave || null, // Adicionar versão snake_case
      comprovantes: formData.comprovantes || [],
      observacoes: formData.observacoes || null,
      protocolo,
      status: 'pendente',
      dataCriacao: new Date().toISOString(), // Adicionar dataCriacao
      dataAtualizacao: new Date().toISOString(), // Adicionar dataAtualizacao
      historico: [{
        data: new Date(),
        status: 'pendente',
        observacao: 'Solicitação criada',
        usuarioId: userId
      }],
      user_id: userId // Adicionar o ID do usuário
    };

    // Inserir no banco de dados
    const { data: insertedData, error: insertError } = await supabaseAdmin
      .from('Reimbursement')
      .insert(reimbursementData)
      .select()
      .single();

    if (insertError) {
      console.error('Erro ao inserir reembolso:', insertError);
      return NextResponse.json(
        { error: `Erro ao criar reembolso: ${insertError.message}` },
        { status: 500 }
      );
    }

    console.log('Reembolso criado com sucesso:', insertedData);

    // Enviar email de confirmação
    try {
      console.log('Enviando email de confirmação de reembolso...');
      // Corrigir formatação do valor - não dividir por 100 pois já vem no formato correto
      const valorNumerico = parseFloat(formData.valorTotal.replace(/\./g, '').replace(',', '.'));
      const valorFormatado = `R$ ${valorNumerico.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

      // Baixar anexos do Supabase Storage para enviar no email
      const emailAttachments = [];

      // Processar múltiplas despesas e seus comprovantes
      if (formData.expenses && Array.isArray(formData.expenses)) {
        console.log(`Processando ${formData.expenses.length} despesas com comprovantes para email`);

        for (let expenseIndex = 0; expenseIndex < formData.expenses.length; expenseIndex++) {
          const expense = formData.expenses[expenseIndex];

          if (expense.comprovantes && expense.comprovantes.length > 0) {
            console.log(`Processando ${expense.comprovantes.length} comprovantes da despesa ${expenseIndex + 1}`);

            for (const comp of expense.comprovantes) {
              try {
                // Extrair o nome do arquivo da URL pública
                const fileName = comp.publicUrl?.split('/').pop() || comp.url?.split('/').pop() || comp.nome;
                console.log(`Baixando anexo da despesa ${expenseIndex + 1} para email: ${fileName}`);

                const { data, error } = await supabaseAdmin
                  .storage
                  .from('comprovantes')
                  .download(fileName);

                if (error) {
                  console.error(`Erro ao baixar anexo ${fileName}:`, error);
                  continue;
                }

                if (data) {
                  console.log(`Anexo baixado com sucesso para email: ${fileName}`);
                  const arrayBuffer = await data.arrayBuffer();

                  // Adicionar prefixo indicando a qual despesa pertence
                  const expenseType = expense.tipoReembolso || 'despesa';
                  const prefixedFilename = `Despesa_${expenseIndex + 1}_${expenseType}_${comp.nome}`;

                  emailAttachments.push({
                    filename: prefixedFilename,
                    content: Buffer.from(arrayBuffer),
                    contentType: comp.tipo || 'application/octet-stream'
                  });
                }
              } catch (attachError) {
                console.error(`Erro ao processar anexo da despesa ${expenseIndex + 1}:`, attachError);
              }
            }
          }
        }
      } else if (formData.comprovantes && formData.comprovantes.length > 0) {
        // Fallback para formato antigo (compatibilidade)
        console.log(`Processando ${formData.comprovantes.length} comprovantes (formato antigo) para email`);

        for (const comp of formData.comprovantes) {
          try {
            const fileName = comp.publicUrl?.split('/').pop() || comp.url?.split('/').pop() || comp.nome;
            console.log(`Baixando anexo para email: ${fileName}`);

            const { data, error } = await supabaseAdmin
              .storage
              .from('comprovantes')
              .download(fileName);

            if (error) {
              console.error(`Erro ao baixar anexo ${fileName}:`, error);
              continue;
            }

            if (data) {
              console.log(`Anexo baixado com sucesso para email: ${fileName}`);
              const arrayBuffer = await data.arrayBuffer();

              emailAttachments.push({
                filename: comp.nome,
                content: Buffer.from(arrayBuffer),
                contentType: comp.tipo || 'application/octet-stream'
              });
            }
          } catch (attachError) {
            console.error('Erro ao processar anexo para email:', attachError);
          }
        }
      }

      console.log(`Enviando email com ${emailAttachments.length} anexos`);

      // Obter o email do usuário logado a partir do token
      const userEmail = payload.email;
      console.log(`Email do usuário logado: ${userEmail}`);
      console.log(`Email do formulário: ${formData.email}`);

      // Usar o email do usuário logado se disponível, caso contrário usar o email do formulário
      const emailToSend = userEmail || formData.email;
      console.log(`Email que será usado para envio: ${emailToSend}`);

      // Buscar configurações de email de reembolso para destinatários adicionais
      let additionalRecipients: string[] = [];
      try {
        console.log('Buscando configurações de email de reembolso...');

        // Primeiro, verificar se o usuário tem configurações específicas
        const userSettingsResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/users/reimbursement-settings-server?email=${encodeURIComponent(emailToSend)}`);

        if (userSettingsResponse.ok) {
          const userSettings = await userSettingsResponse.json();
          console.log('Configurações do usuário:', userSettings);

          if (userSettings.reimbursement_email_settings?.enabled && userSettings.reimbursement_email_settings?.recipients?.length > 0) {
            additionalRecipients = userSettings.reimbursement_email_settings.recipients;
            console.log(`Usando configurações específicas do usuário: ${additionalRecipients.join(', ')}`);
          } else {
            // Se o usuário não tem configurações específicas, verificar regras globais
            const globalSettingsResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/reimbursement-settings`);

            if (globalSettingsResponse.ok) {
              const globalSettings = await globalSettingsResponse.json();
              console.log('Configurações globais:', globalSettings);

              // Verificar se a regra de domínio está ativada e se o email tem o domínio @groupabz.com
              if (globalSettings.enableDomainRule && emailToSend.endsWith('@groupabz.com')) {
                additionalRecipients = globalSettings.recipients || [];
                console.log(`Usando regra de domínio para @groupabz.com: ${additionalRecipients.join(', ')}`);
              }
            }
          }
        }
      } catch (settingsError) {
        console.error('Erro ao buscar configurações de email:', settingsError);
        // Continuar sem destinatários adicionais
      }

      await sendReimbursementConfirmationEmail(
        emailToSend,
        formData.nome,
        protocolo,
        valorFormatado,
        formData, // dados completos do formulário
        emailAttachments,
        additionalRecipients
      );

      console.log('Email de confirmação enviado com sucesso');
    } catch (emailError) {
      console.error('Erro ao enviar email de confirmação:', emailError);
      // Continuar mesmo se o email falhar
    }

    return NextResponse.json({
      success: true,
      message: 'Reembolso criado com sucesso',
      protocolo,
      data: insertedData
    });

  } catch (error) {
    console.error('Erro ao processar criação de reembolso:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor ao criar reembolso' },
      { status: 500 }
    );
  }
}

/**
 * Retorna o ícone correspondente ao tipo de reembolso
 */
function getIconForReimbursementType(type: string): string {
  const icons: Record<string, string> = {
    alimentacao: 'restaurant',
    transporte: 'directions_car',
    hospedagem: 'hotel',
    material: 'shopping_bag',
    servico: 'build',
    outro: 'more_horiz'
  };

  return icons[type] || 'receipt';
}
