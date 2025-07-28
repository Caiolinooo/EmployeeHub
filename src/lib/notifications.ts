import { sendEmail } from './email';
import { supabase } from './supabase';
import {
  accessApprovalTemplate,
  accessRejectionTemplate,
  inviteCodeTemplate,
  passwordExpiryTemplate,
  customTemplate,
  reimbursementConfirmationTemplate,
  reimbursementApprovalTemplate,
  reimbursementRejectionTemplate,
  newUserWelcomeTemplate,
  inviteTemplate
} from './emailTemplates';

// Tipo para dados do usuário
interface UserData {
  name: string;
  email: string;
  phoneNumber: string;
  position: string;
  department: string;
  protocol: string;
}

/**
 * Envia uma notificação por email sobre a aprovação de acesso
 * @param userId ID do usuário que teve o acesso aprovado
 * @param approvedById ID do administrador que aprovou o acesso
 * @returns Resultado do envio
 */
export async function sendAccessApprovalNotification(
  authorizedUserId: string,
  approvedById: string
): Promise<{ success: boolean; message: string; previewUrl?: string }> {
  try {
    console.log(`Iniciando envio de notificação de aprovação para ID: ${authorizedUserId}`);

    // Buscar informações do usuário autorizado
    const { data: authorizedUser, error: userError } = await supabase
      .from('authorized_users')
      .select('*')
      .eq('id', authorizedUserId)
      .single();

    if (userError || !authorizedUser) {
      console.error(`Usuário autorizado não encontrado: ${authorizedUserId}`, userError);
      return {
        success: false,
        message: 'Usuário autorizado não encontrado'
      };
    }

    console.log(`Usuário autorizado encontrado: ${authorizedUser.email || 'Sem email'}`);

    // Buscar informações do administrador
    const { data: admin, error: adminError } = await supabase
      .from('users_unified')
      .select('*')
      .eq('id', approvedById)
      .single();

    if (!admin) {
      console.error(`Administrador não encontrado: ${approvedById}`);
      return {
        success: false,
        message: 'Administrador não encontrado'
      };
    }

    console.log(`Administrador encontrado: ${admin.firstName} ${admin.lastName}`);

    // Se não tiver email, não pode enviar notificação
    if (!authorizedUser.email) {
      console.error('Usuário não possui email para notificação');
      return {
        success: false,
        message: 'Usuário não possui email para notificação'
      };
    }

    // Preparar conteúdo do email
    const adminName = `${admin.firstName} ${admin.lastName}`;
    const emailSubject = 'Acesso Aprovado - ABZ Group';
    const emailContent = accessApprovalTemplate(adminName);

    console.log(`Enviando email para: ${authorizedUser.email}`);

    // Enviar email
    const emailResult = await sendCustomEmail(
      authorizedUser.email,
      emailSubject,
      emailContent
    );

    console.log(`Resultado do envio: ${emailResult.success ? 'Sucesso' : 'Falha'}`);
    if (emailResult.previewUrl) {
      console.log(`URL de preview: ${emailResult.previewUrl}`);
    }

    return emailResult;
  } catch (error) {
    console.error('Erro ao enviar notificação de aprovação:', error);
    if (error instanceof Error) {
      console.error('Detalhes do erro:', error.message);
      console.error('Stack trace:', error.stack);
    }
    return {
      success: false,
      message: `Erro ao enviar notificação de aprovação: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    };
  }
}

/**
 * Envia um email personalizado
 * @param email Email do destinatário ou array de emails
 * @param subject Assunto do email
 * @param htmlContent Conteúdo HTML do email
 * @returns Resultado do envio
 */
export async function sendCustomEmail(
  email: string | string[],
  subject: string,
  htmlContent: string
): Promise<{ success: boolean; message: string; previewUrl?: string }> {
  try {
    console.log(`Iniciando envio de email personalizado para: ${email}`);
    console.log(`Assunto: ${subject}`);

    // Preparar o conteúdo do email
    const text = htmlContent.replace(/<[^>]*>/g, ''); // Versão texto simples removendo tags HTML

    console.log('Opções de email configuradas, chamando função de envio...');

    // Chamar a função de envio de email consolidada do arquivo email.ts
    const result = await sendEmail(
      email,
      subject,
      text,
      htmlContent,
      {
        from: process.env.EMAIL_FROM || '"ABZ Group" <apiabz@groupabz.com>'
      }
    );

    console.log(`Resultado do envio: ${result.success ? 'Sucesso' : 'Falha'}`);
    if (result.previewUrl) {
      console.log(`URL de preview: ${result.previewUrl}`);
    }

    return {
      success: result.success,
      message: result.message,
      previewUrl: typeof result.previewUrl === 'string' ? result.previewUrl : undefined
    };
  } catch (error) {
    console.error('Erro ao enviar email personalizado:', error);
    if (error instanceof Error) {
      console.error('Detalhes do erro:', error.message);
      console.error('Stack trace:', error.stack);
    }
    return {
      success: false,
      message: `Erro ao enviar email personalizado: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    };
  }
}

/**
 * Envia um email com código de convite
 * @param email Email do destinatário
 * @param inviteCode Código de convite
 * @param expiresAt Data de expiração do código
 * @param maxUses Número máximo de usos do código
 * @returns Resultado do envio
 */
export async function sendInviteCodeEmail(
  email: string,
  inviteCode: string,
  expiresAt: Date,
  maxUses: number
): Promise<{ success: boolean; message: string; previewUrl?: string }> {
  try {
    // Gerar conteúdo do email usando o template
    const emailContent = inviteCodeTemplate(inviteCode, expiresAt, maxUses);

    // Enviar email
    const result = await sendCustomEmail(
      email,
      `Convite para ${process.env.EMAIL_COMPANY_NAME || 'ABZ Group'}`,
      emailContent
    );

    return result;
  } catch (error) {
    console.error('Erro ao enviar email com código de convite:', error);
    return {
      success: false,
      message: 'Erro ao enviar email com código de convite'
    };
  }
}

/**
 * Envia um email de notificação de expiração de senha
 * @param email Email do destinatário
 * @param daysRemaining Dias restantes até a expiração da senha
 * @returns Resultado do envio
 */
export async function sendPasswordExpiryEmail(
  email: string,
  daysRemaining: number
): Promise<{ success: boolean; message: string; previewUrl?: string }> {
  try {
    // Gerar conteúdo do email usando o template
    const emailContent = passwordExpiryTemplate(daysRemaining);

    // Enviar email
    const result = await sendCustomEmail(
      email,
      'Sua Senha Irá Expirar em Breve',
      emailContent
    );

    return result;
  } catch (error) {
    console.error('Erro ao enviar email de expiração de senha:', error);
    return {
      success: false,
      message: 'Erro ao enviar email de expiração de senha'
    };
  }
}

/**
 * Envia uma notificação por email sobre a rejeição de acesso
 * @param authorizedUserId ID do usuário que teve o acesso rejeitado
 * @param rejectedById ID do administrador que rejeitou o acesso
 * @param reason Motivo da rejeição (opcional)
 * @returns Resultado do envio
 */
export async function sendAccessRejectionNotification(
  authorizedUserId: string,
  rejectedById: string,
  reason?: string
): Promise<{ success: boolean; message: string; previewUrl?: string }> {
  try {
    console.log(`Iniciando envio de notificação de rejeição para ID: ${authorizedUserId}`);

    // Buscar informações do usuário autorizado
    const { data: authorizedUser, error: userError } = await supabase
      .from('authorized_users')
      .select('*')
      .eq('id', authorizedUserId)
      .single();

    if (userError || !authorizedUser) {
      console.error(`Usuário autorizado não encontrado: ${authorizedUserId}`, userError);
      return {
        success: false,
        message: 'Usuário autorizado não encontrado'
      };
    }

    console.log(`Usuário autorizado encontrado: ${authorizedUser.email || 'Sem email'}`);

    // Buscar informações do administrador
    const { data: admin, error: adminError } = await supabase
      .from('users_unified')
      .select('*')
      .eq('id', rejectedById)
      .single();

    if (!admin) {
      console.error(`Administrador não encontrado: ${rejectedById}`);
      return {
        success: false,
        message: 'Administrador não encontrado'
      };
    }

    console.log(`Administrador encontrado: ${admin.firstName} ${admin.lastName}`);

    // Se não tiver email, não pode enviar notificação
    if (!authorizedUser.email) {
      console.error('Usuário não possui email para notificação');
      return {
        success: false,
        message: 'Usuário não possui email para notificação'
      };
    }

    // Preparar conteúdo do email
    const adminName = `${admin.firstName} ${admin.lastName}`;
    const emailSubject = 'Solicitação de Acesso Negada - ABZ Group';
    const emailContent = accessRejectionTemplate(adminName, reason);

    console.log(`Enviando email para: ${authorizedUser.email}`);
    console.log(`Motivo da rejeição: ${reason || 'Não especificado'}`);

    // Enviar email
    const emailResult = await sendCustomEmail(
      authorizedUser.email,
      emailSubject,
      emailContent
    );

    console.log(`Resultado do envio: ${emailResult.success ? 'Sucesso' : 'Falha'}`);
    if (emailResult.previewUrl) {
      console.log(`URL de preview: ${emailResult.previewUrl}`);
    }

    return emailResult;
  } catch (error) {
    console.error('Erro ao enviar notificação de rejeição:', error);
    if (error instanceof Error) {
      console.error('Detalhes do erro:', error.message);
      console.error('Stack trace:', error.stack);
    }
    return {
      success: false,
      message: `Erro ao enviar notificação de rejeição: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    };
  }
}

/**
 * Envia um email de confirmação de solicitação de reembolso
 * @param email Email do destinatário
 * @param nome Nome do solicitante
 * @param protocolo Número do protocolo
 * @param valor Valor do reembolso
 * @param formData Dados completos do formulário (opcional)
 * @param attachments Arquivos anexados (opcional)
 * @param additionalRecipients Destinatários adicionais (opcional)
 * @returns Resultado do envio
 */
export async function sendReimbursementConfirmationEmail(
  email: string,
  nome: string,
  protocolo: string,
  valor: string,
  formData?: any,
  attachments?: Array<{
    filename: string;
    content?: any;
    path?: string;
    contentType?: string;
  }>,
  additionalRecipients?: string[]
): Promise<{ success: boolean; message: string; previewUrl?: string }> {
  try {
    console.log(`Iniciando envio de email de confirmação de reembolso para ${email}`);

    // Gerar conteúdo do email usando o template
    const emailContent = reimbursementConfirmationTemplate(nome, protocolo, valor);

    // Se temos dados do formulário, gerar PDF
    const emailAttachments = [];
    console.log(`Verificando anexos iniciais: ${attachments ? attachments.length : 0}`);

    // Garantir que os anexos originais sejam incluídos
    if (attachments && attachments.length > 0) {
      // Copiar os anexos originais para a lista de anexos do email
      // Verificar cada anexo para garantir que tenha conteúdo válido
      for (const attachment of attachments) {
        if (attachment.content) {
          emailAttachments.push(attachment);
          console.log(`Anexo válido adicionado: ${attachment.filename} (${attachment.contentType || 'tipo desconhecido'})`);
        } else if (attachment.path) {
          emailAttachments.push(attachment);
          console.log(`Anexo com caminho adicionado: ${attachment.filename} (${attachment.contentType || 'tipo desconhecido'})`);
        } else {
          console.warn(`Anexo ignorado por não ter conteúdo ou caminho: ${attachment.filename}`);
        }
      }

      console.log(`${emailAttachments.length} anexos originais válidos adicionados ao email`);

      // Listar os anexos para debug
      emailAttachments.forEach((attachment, index) => {
        console.log(`Anexo ${index + 1}: ${attachment.filename} (${attachment.contentType || 'tipo desconhecido'}) - ${attachment.content ? 'Com conteúdo' : attachment.path ? 'Com caminho' : 'Sem conteúdo/caminho'}`);
      });
    } else {
      console.log('Nenhum anexo original encontrado');
    }

    if (formData) {
      try {
        console.log('Gerando PDF do formulário de reembolso...');
        // Importar dinamicamente para evitar problemas no lado do cliente
        const { generateReimbursementPDF } = await import('./pdf-generator');

        // Formatar data para o nome do arquivo
        const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const employeeName = formData.nome.replace(/\s+/g, '_');

        // Gerar PDF do formulário
        const formPdfBuffer = await generateReimbursementPDF(formData, protocolo);
        console.log('PDF do formulário gerado com sucesso');

        // Adicionar PDF do formulário aos anexos (como primeiro item)
        emailAttachments.unshift({
          filename: `Formulario_Reembolso_${protocolo}_${employeeName}_${date}.pdf`,
          content: formPdfBuffer,
          contentType: 'application/pdf'
        });

        console.log('PDF do formulário adicionado aos anexos');

        // Não vamos mais usar o PDF combinado, pois queremos manter os anexos originais separados
        // para garantir que todos os tipos de arquivo sejam incluídos corretamente

        // Garantir que os comprovantes originais também sejam anexados
        if (attachments && attachments.length > 0) {
          console.log(`Verificando ${attachments.length} comprovantes originais`);

          // Verificar se os anexos já têm content
          const validAttachments = attachments.filter(att => att.content);

          if (validAttachments.length > 0) {
            console.log(`${validAttachments.length} comprovantes têm conteúdo válido`);
          } else {
            console.log('Nenhum comprovante tem conteúdo válido, tentando buscar do Supabase');

            // Tentar buscar os comprovantes do Supabase se necessário
            try {
              // Implementar lógica para buscar comprovantes do Supabase se necessário
              console.log('Busca de comprovantes do Supabase não implementada');
            } catch (fetchError) {
              console.error('Erro ao buscar comprovantes do Supabase:', fetchError);
            }
          }
        }
      } catch (pdfError) {
        console.error('Erro ao gerar PDF do formulário:', pdfError);

        // Continuar com os anexos originais
        console.log('Continuando apenas com os anexos originais');
      }
    }

    console.log(`Total de anexos para o email: ${emailAttachments.length}`);
    emailAttachments.forEach((attachment, index) => {
      console.log(`Anexo ${index + 1}: ${attachment.filename} (${attachment.contentType || 'tipo desconhecido'}) - ${
        attachment.content
          ? `Conteúdo presente (${Buffer.isBuffer(attachment.content) ? attachment.content.length + ' bytes' : 'não é buffer'})`
          : attachment.path
            ? `Caminho: ${attachment.path}`
            : 'Sem conteúdo nem caminho'
      }`);
    });

    // Verificação final para garantir que temos pelo menos um anexo
    if (emailAttachments.length === 0) {
      console.warn('AVISO: Nenhum anexo foi adicionado ao email. Isso pode indicar um problema com os comprovantes.');
    } else if (emailAttachments.length === 1) {
      console.warn('AVISO: Apenas um anexo foi adicionado ao email. Verifique se o formulário PDF e os comprovantes estão sendo incluídos corretamente.');
    }

    // Preparar lista de destinatários
    const recipients = [email, 'logistica@groupabz.com'];

    // Adicionar destinatários adicionais se existirem
    if (additionalRecipients && additionalRecipients.length > 0) {
      console.log(`Adicionando destinatários adicionais: ${additionalRecipients.join(', ')}`);
      additionalRecipients.forEach(recipient => {
        if (recipient && !recipients.includes(recipient)) {
          recipients.push(recipient);
        }
      });
    }

    console.log(`Lista final de destinatários: ${recipients.join(', ')}`);

    // Importar utilitários de debug
    const { saveAttachmentsToFiles } = await import('./debug-utils');

    // Salvar anexos para debug antes de enviar
    console.log('Salvando anexos para debug antes de enviar o email...');
    saveAttachmentsToFiles(emailAttachments, 'pre_envio_email');

    // Verificar se temos anexos válidos
    const validAttachments = emailAttachments.filter(att =>
      (att.content && (Buffer.isBuffer(att.content) || typeof att.content === 'string')) ||
      (att.path && typeof att.path === 'string')
    );

    console.log(`Filtrando anexos: ${emailAttachments.length} total, ${validAttachments.length} válidos`);

    // Remover código de teste - não adicionar anexos de teste em produção

    // Log detalhado dos anexos válidos
    console.log(`Enviando email com ${validAttachments.length} anexos válidos:`);
    validAttachments.forEach((att, idx) => {
      console.log(`Anexo ${idx + 1}: ${att.filename} (${att.contentType || 'tipo desconhecido'}) - ${
        att.content
          ? `Conteúdo: ${Buffer.isBuffer(att.content) ? att.content.length + ' bytes' : 'não é buffer'}`
          : att.path
            ? `Caminho: ${att.path}`
            : 'Sem conteúdo/caminho'
      }`);
    });

    // Enviar email para todos os destinatários
    const result = await sendEmail(
      recipients,
      `Solicitação de Reembolso - Protocolo: ${protocolo}`,
      // Versão texto simples
      `Solicitação de Reembolso - Protocolo: ${protocolo}\n\nOlá ${nome},\n\nSua solicitação de reembolso foi recebida com sucesso e está sendo processada.\n\nProtocolo: ${protocolo}\nValor: ${valor}\nData da Solicitação: ${new Date().toLocaleDateString('pt-BR')}\nStatus: Pendente\n\nVocê receberá atualizações sobre o status da sua solicitação por email. Em caso de dúvidas, entre em contato com o departamento financeiro.\n\nAtenção: Este email deve conter ${validAttachments.length} anexos: o formulário de reembolso e os comprovantes anexados.`,
      // Versão HTML
      emailContent + `<p style="color: #666; font-size: 12px;">Este email deve conter ${validAttachments.length} anexos: o formulário de reembolso e os comprovantes anexados.</p>`,
      {
        attachments: validAttachments
      }
    );

    console.log(`Email de reembolso enviado para ${recipients.join(', ')}`);
    if (emailAttachments.length > 0) {
      console.log(`Enviado com ${emailAttachments.length} anexos:`);
      emailAttachments.forEach((attachment, index) => {
        console.log(`  ${index + 1}. ${attachment.filename} (${attachment.contentType}) - ${attachment.content ? `${Math.round(attachment.content.length / 1024)} KB` : 'Sem conteúdo'}`);
      });
    } else {
      console.warn('Aviso: Email enviado sem anexos!');
    }

    return {
      success: result.success,
      message: result.message,
      previewUrl: typeof result.previewUrl === 'string' ? result.previewUrl : undefined
    };
  } catch (error) {
    console.error('Erro ao enviar email de confirmação de reembolso:', error);
    if (error instanceof Error) {
      console.error('Detalhes do erro:', error.message);
      console.error('Stack trace:', error.stack);
    }
    return {
      success: false,
      message: `Erro ao enviar email de confirmação de reembolso: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    };
  }
}

/**
 * Envia um email de aprovação de reembolso
 * @param email Email do destinatário
 * @param nome Nome do solicitante
 * @param protocolo Número do protocolo
 * @param valor Valor do reembolso
 * @param metodoPagamento Método de pagamento
 * @param observacao Observação opcional
 * @returns Resultado do envio
 */
export async function sendReimbursementApprovalEmail(
  email: string,
  nome: string,
  protocolo: string,
  valor: string,
  metodoPagamento: string,
  observacao?: string
): Promise<{ success: boolean; message: string; previewUrl?: string }> {
  try {
    // Gerar conteúdo do email usando o template
    const emailContent = reimbursementApprovalTemplate(nome, protocolo, valor, metodoPagamento, observacao);

    // Enviar email
    const result = await sendCustomEmail(
      email,
      `Reembolso Aprovado - Protocolo: ${protocolo}`,
      emailContent
    );

    return result;
  } catch (error) {
    console.error('Erro ao enviar email de aprovação de reembolso:', error);
    return {
      success: false,
      message: 'Erro ao enviar email de aprovação de reembolso'
    };
  }
}

/**
 * Envia um email de rejeição de reembolso
 * @param email Email do destinatário
 * @param nome Nome do solicitante
 * @param protocolo Número do protocolo
 * @param motivo Motivo da rejeição
 * @returns Resultado do envio
 */
export async function sendReimbursementRejectionEmail(
  email: string,
  nome: string,
  protocolo: string,
  motivo: string
): Promise<{ success: boolean; message: string; previewUrl?: string }> {
  try {
    // Gerar conteúdo do email usando o template
    const emailContent = reimbursementRejectionTemplate(nome, protocolo, motivo);

    // Enviar email
    const result = await sendCustomEmail(
      email,
      `Reembolso Não Aprovado - Protocolo: ${protocolo}`,
      emailContent
    );

    return result;
  } catch (error) {
    console.error('Erro ao enviar email de rejeição de reembolso:', error);
    return {
      success: false,
      message: 'Erro ao enviar email de rejeição de reembolso'
    };
  }
}

/**
 * Envia um email de boas-vindas para novos usuários
 * @param email Email do destinatário
 * @param nome Nome do usuário
 * @param password Senha temporária (opcional, apenas se gerada automaticamente)
 * @returns Resultado do envio
 */
export async function sendNewUserWelcomeEmail(
  email: string,
  nome: string,
  password?: string
): Promise<{ success: boolean; message: string; previewUrl?: string }> {
  try {
    console.log(`Enviando email de boas-vindas para: ${email}`);

    // Obter a URL de login do sistema
    const loginUrl = process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/login` : 'http://localhost:3000/login';

    // Gerar conteúdo do email usando o template
    const emailContent = newUserWelcomeTemplate(nome, loginUrl, password);

    // Enviar email
    const result = await sendCustomEmail(
      email,
      `Bem-vindo ao ${process.env.EMAIL_COMPANY_NAME || 'ABZ Group'}`,
      emailContent
    );

    console.log(`Resultado do envio de email de boas-vindas: ${result.success ? 'Sucesso' : 'Falha'}`);
    if (result.previewUrl) {
      console.log(`URL de preview: ${result.previewUrl}`);
    }

    return result;
  } catch (error) {
    console.error('Erro ao enviar email de boas-vindas:', error);
    if (error instanceof Error) {
      console.error('Detalhes do erro:', error.message);
      console.error('Stack trace:', error.stack);
    }
    return {
      success: false,
      message: `Erro ao enviar email de boas-vindas: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    };
  }
}

/**
 * Envia um email com código de convite para novos usuários com URL de registro
 * @param email Email do destinatário
 * @param inviteCode Código de convite
 * @param expiresAt Data de expiração do convite
 * @param maxUses Número máximo de usos do convite
 * @returns Resultado do envio
 */
export async function sendInviteWithRegisterLinkEmail(
  email: string,
  inviteCode: string,
  expiresAt?: Date,
  maxUses?: number
): Promise<{ success: boolean; message: string; previewUrl?: string }> {
  try {
    console.log(`Enviando email de convite para: ${email}`);

    // Obter a URL de registro do sistema
    const registerUrl = process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/register?code=${inviteCode}` : `http://localhost:3000/register?code=${inviteCode}`;

    // Formatar data de expiração
    let expiryText = '';
    if (expiresAt) {
      const formattedDate = expiresAt.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      expiryText = `Este convite expira em ${formattedDate}`;
    }

    // Gerar conteúdo do email usando o template
    const emailContent = inviteTemplate(inviteCode, registerUrl, expiryText, maxUses);

    // Enviar email
    const result = await sendCustomEmail(
      email,
      `Convite para ${process.env.EMAIL_COMPANY_NAME || 'ABZ Group'}`,
      emailContent
    );

    console.log(`Resultado do envio de email de convite: ${result.success ? 'Sucesso' : 'Falha'}`);
    if (result.previewUrl) {
      console.log(`URL de preview: ${result.previewUrl}`);
    }

    return result;
  } catch (error) {
    console.error('Erro ao enviar email de convite:', error);
    if (error instanceof Error) {
      console.error('Detalhes do erro:', error.message);
      console.error('Stack trace:', error.stack);
    }
    return {
      success: false,
      message: `Erro ao enviar email de convite: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    };
  }
}

/**
 * Envia uma notificação para o administrador sobre um novo usuário
 * @param adminEmail Email do administrador
 * @param userData Dados do usuário
 * @returns Resultado do envio do email
 */
export async function sendAdminNotificationEmail(
  adminEmail: string,
  userData: UserData
): Promise<{ success: boolean; message: string; previewUrl?: string }> {
  try {
    console.log(`Enviando email de notificação para o administrador: ${adminEmail}`);

    // Importar o template de notificação para o administrador
    const { adminNotificationTemplate } = await import('./emailTemplates');

    // Gerar conteúdo do email usando o template
    const emailContent = adminNotificationTemplate(userData);

    // Enviar email
    const result = await sendCustomEmail(
      adminEmail,
      `Novo cadastro no Portal ABZ - ${userData.protocol}`,
      emailContent
    );

    console.log(`Resultado do envio de email para o administrador: ${result.success ? 'Sucesso' : 'Falha'}`);
    if (result.previewUrl) {
      console.log(`URL de preview: ${result.previewUrl}`);
    }

    return result;
  } catch (error) {
    console.error('Erro ao enviar email para o administrador:', error);
    if (error instanceof Error) {
      console.error('Detalhes do erro:', error.message);
      console.error('Stack trace:', error.stack);
    }
    return {
      success: false,
      message: `Erro ao enviar email para o administrador: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    };
  }
}
