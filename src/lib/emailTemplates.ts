/**
 * Templates de email personalizáveis
 * Estes templates usam as configurações do arquivo .env para personalização
 */

// Obter configurações de personalização do .env
const getEmailConfig = () => {
  // Usar a URL completa do aplicativo para o logo
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  // Garantir que a URL do logo seja absoluta
  let logoUrl = process.env.EMAIL_LOGO_URL || `${appUrl}/images/LC1_Azul.png`;
  if (!logoUrl.startsWith('http')) {
    logoUrl = `${appUrl}${logoUrl.startsWith('/') ? '' : '/'}${logoUrl}`;
  }

  console.log('Logo URL para emails:', logoUrl);

  return {
    companyName: process.env.EMAIL_COMPANY_NAME || 'ABZ Group',
    logoUrl: logoUrl,
    primaryColor: process.env.EMAIL_PRIMARY_COLOR || '#0066cc',
    secondaryColor: process.env.EMAIL_SECONDARY_COLOR || '#f5f5f5',
    footerText: process.env.EMAIL_FOOTER_TEXT || 'ABZ Group. Todos os direitos reservados.',
    appUrl: appUrl
  };
};

// Template base para todos os emails
const baseTemplate = (content: string) => {
  const config = getEmailConfig();

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${config.companyName}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          margin: 0;
          padding: 0;
          background-color: #f9f9f9;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #ffffff;
          border-radius: 8px;
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
        }
        .header {
          text-align: center;
          margin-bottom: 20px;
        }
        .logo {
          max-width: 200px;
          height: auto;
        }
        .content {
          padding: 20px 0;
        }
        .footer {
          text-align: center;
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #eee;
          font-size: 12px;
          color: #999;
        }
        .button {
          display: inline-block;
          background-color: ${config.primaryColor};
          color: white;
          text-decoration: none;
          padding: 10px 20px;
          border-radius: 4px;
          font-weight: bold;
          margin: 20px 0;
        }
        .highlight {
          background-color: ${config.secondaryColor};
          padding: 15px;
          border-radius: 5px;
          text-align: center;
          margin: 20px 0;
          font-size: 24px;
          letter-spacing: 5px;
          font-weight: bold;
        }
        h1, h2, h3 {
          color: ${config.primaryColor};
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="${config.logoUrl}" alt="${config.companyName}" class="logo" style="max-width: 200px; height: auto; display: block; margin: 0 auto;">
        </div>
        <div class="content">
          ${content}
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} ${config.footerText}
        </div>
      </div>
    </body>
    </html>
  `;
};

// Template para código de verificação
export const verificationCodeTemplate = (code: string) => {
  const config = getEmailConfig();

  const content = `
    <h2 style="text-align: center;">Seu Código de Verificação</h2>
    <div class="highlight">
      ${code}
    </div>
    <p style="text-align: center;">
      Este código expira em <strong>15 minutos</strong>.
    </p>
    <p style="color: #666; font-size: 12px; text-align: center; margin-top: 30px;">
      Se você não solicitou este código, por favor ignore este email.
    </p>
  `;

  return baseTemplate(content);
};

// Template para aprovação de acesso
export const accessApprovalTemplate = (adminName: string) => {
  const config = getEmailConfig();

  const content = `
    <h2 style="text-align: center;">Acesso Aprovado</h2>
    <p>
      Olá,
    </p>
    <p>
      Sua solicitação de acesso ao sistema ${config.companyName} foi <strong>aprovada</strong> por ${adminName}.
    </p>
    <p>
      Você já pode acessar o sistema utilizando seu email ou número de telefone.
    </p>
    <div style="text-align: center;">
      <a href="${config.appUrl}/login" class="button">
        Acessar o Sistema
      </a>
    </div>
    <p style="color: #666; font-size: 12px; text-align: center; margin-top: 30px;">
      Se você não solicitou acesso ao sistema, por favor ignore este email.
    </p>
  `;

  return baseTemplate(content);
};

// Template para rejeição de acesso
export const accessRejectionTemplate = (adminName: string, reason?: string) => {
  const config = getEmailConfig();

  const reasonText = reason
    ? `<p><strong>Motivo:</strong> ${reason}</p>`
    : '';

  const content = `
    <h2 style="text-align: center; color: #cc0000;">Solicitação de Acesso Negada</h2>
    <p>
      Olá,
    </p>
    <p>
      Sua solicitação de acesso ao sistema ${config.companyName} foi <strong>negada</strong> por ${adminName}.
    </p>
    ${reasonText}
    <p>
      Se você acredita que isso foi um erro, entre em contato com o administrador do sistema.
    </p>
    <p style="color: #666; font-size: 12px; text-align: center; margin-top: 30px;">
      Se você não solicitou acesso ao sistema, por favor ignore este email.
    </p>
  `;

  return baseTemplate(content);
};

// Template para código de convite
export const inviteCodeTemplate = (inviteCode: string, expiresAt: Date, maxUses: number) => {
  const config = getEmailConfig();

  const expiryDate = expiresAt.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  const content = `
    <h2 style="text-align: center;">Convite para ${config.companyName}</h2>
    <p>
      Olá,
    </p>
    <p>
      Você foi convidado para acessar o sistema ${config.companyName}.
    </p>
    <p>
      Use o código abaixo para se registrar:
    </p>
    <div class="highlight">
      ${inviteCode}
    </div>
    <p>
      <strong>Informações importantes:</strong>
    </p>
    <ul>
      <li>Este código expira em: <strong>${expiryDate}</strong></li>
      <li>Número máximo de usos: <strong>${maxUses}</strong></li>
    </ul>
    <div style="text-align: center;">
      <a href="${config.appUrl}/login" class="button">
        Acessar o Sistema
      </a>
    </div>
    <p style="color: #666; font-size: 12px; text-align: center; margin-top: 30px;">
      Se você não esperava este convite, por favor ignore este email.
    </p>
  `;

  return baseTemplate(content);
};

// Template para notificação de expiração de senha
export const passwordExpiryTemplate = (daysRemaining: number) => {
  const config = getEmailConfig();

  const content = `
    <h2 style="text-align: center;">Sua Senha Irá Expirar em Breve</h2>
    <p>
      Olá,
    </p>
    <p>
      Sua senha para o sistema ${config.companyName} irá expirar em <strong>${daysRemaining} dias</strong>.
    </p>
    <p>
      Por favor, acesse o sistema e altere sua senha para evitar problemas de acesso.
    </p>
    <div style="text-align: center;">
      <a href="${config.appUrl}/set-password" class="button">
        Alterar Senha
      </a>
    </div>
    <p style="color: #666; font-size: 12px; text-align: center; margin-top: 30px;">
      Este é um email automático. Por favor, não responda.
    </p>
  `;

  return baseTemplate(content);
};

// ==============================
// Templates para Avaliações
// ==============================

export const evaluationCreatedTemplate = (
  colaboradorNome: string,
  periodoNome: string,
  dataLimiteAutoavaliacao?: string,
  linkAvaliacao?: string
) => {
  const config = getEmailConfig();

  const prazoTexto = dataLimiteAutoavaliacao
    ? `<p><strong>Prazo para autoavaliação:</strong> ${dataLimiteAutoavaliacao}</p>`
    : '';

  const botaoLink = linkAvaliacao
    ? `<div style="text-align: center; margin-top: 20px;"><a href="${config.appUrl}${linkAvaliacao}" class="button">Iniciar minha avaliação</a></div>`
    : '';

  const content = `
    <h2 style="text-align: center;">Nova Avaliação de Desempenho</h2>
    <p>Olá ${colaboradorNome},</p>
    <p>
      Uma nova avaliação de desempenho foi criada para você
      referente ao período <strong>${periodoNome}</strong>.
    </p>
    ${prazoTexto}
    <p>
      Acesse o painel para responder às perguntas de autoavaliação
      e acompanhar o andamento do processo.
    </p>
    ${botaoLink}
    <p style="color: #666; font-size: 12px; margin-top: 30px;">
      Este é um email automático. Por favor, não responda.
    </p>
  `;

  return baseTemplate(content);
};

export const evaluationCreatedManagerTemplate = (
  gerenteNome: string,
  colaboradorNome: string,
  periodoNome: string,
  linkAvaliacao?: string
) => {
  const config = getEmailConfig();

  const botaoLink = linkAvaliacao
    ? `<div style="text-align: center; margin-top: 20px;"><a href="${config.appUrl}${linkAvaliacao}" class="button">Abrir avaliação do colaborador</a></div>`
    : '';

  const content = `
    <h2 style="text-align: center;">Nova Avaliação para seu liderado</h2>
    <p>Olá ${gerenteNome},</p>
    <p>
      Uma nova avaliação de desempenho para o colaborador
      <strong>${colaboradorNome}</strong> foi criada para o período
      <strong>${periodoNome}</strong>.
    </p>
    <p>
      Quando a autoavaliação for concluída, você poderá registrar sua
      avaliação como gestor através do painel.
    </p>
    ${botaoLink}
    <p style="color: #666; font-size: 12px; margin-top: 30px;">
      Este é um email automático. Por favor, não responda.
    </p>
  `;

  return baseTemplate(content);
};

export const selfEvaluationCompletedTemplate = (
  gerenteNome: string,
  colaboradorNome: string,
  periodoNome: string,
  linkAvaliacao?: string
) => {
  const config = getEmailConfig();

  const botaoLink = linkAvaliacao
    ? `<div style="text-align: center; margin-top: 20px;"><a href="${config.appUrl}${linkAvaliacao}" class="button">Realizar avaliação como gestor</a></div>`
    : '';

  const content = `
    <h2 style="text-align: center;">Autoavaliação concluída</h2>
    <p>Olá ${gerenteNome},</p>
    <p>
      O colaborador <strong>${colaboradorNome}</strong> concluiu a
      autoavaliação referente ao período <strong>${periodoNome}</strong>.
    </p>
    <p>
      Agora você já pode acessar o sistema para registrar sua
      avaliação como gestor.
    </p>
    ${botaoLink}
    <p style="color: #666; font-size: 12px; margin-top: 30px;">
      Este é um email automático. Por favor, não responda.
    </p>
  `;

  return baseTemplate(content);
};

export const evaluationApprovedTemplate = (
  colaboradorNome: string,
  periodoNome: string,
  linkAvaliacao?: string
) => {
  const config = getEmailConfig();

  const botaoLink = linkAvaliacao
    ? `<div style="text-align: center; margin-top: 20px;"><a href="${config.appUrl}${linkAvaliacao}" class="button">Ver detalhes da avaliação</a></div>`
    : '';

  const content = `
    <h2 style="text-align: center;">Sua avaliação foi concluída</h2>
    <p>Olá ${colaboradorNome},</p>
    <p>
      A avaliação de desempenho referente ao período
      <strong>${periodoNome}</strong> foi concluída e aprovada.
    </p>
    <p>
      Você pode acessar o sistema para visualizar o resultado,
      comentários e pontos de desenvolvimento.
    </p>
    ${botaoLink}
    <p style="color: #666; font-size: 12px; margin-top: 30px;">
      Este é um email automático. Por favor, não responda.
    </p>
  `;

  return baseTemplate(content);
};

// Template personalizado
export const newsPostTemplate = (author: string, postTitle: string, excerpt: string, postUrl: string) => {
  const config = getEmailConfig();
  const content = `
    <h2 style="text-align:center;color:${config.primaryColor}">Nova publicação no ${config.companyName}</h2>
    <p>\n      <strong>${author || 'Alguém'}</strong> publicou: <strong>${postTitle}</strong>\n    </p>
    ${excerpt ? `<p style="color:#444">${excerpt}</p>` : ''}
    <div style="text-align:center;margin:24px 0;">
      <a href="${postUrl}" class="button" style="background:${config.primaryColor};color:#fff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:bold">Ver publicação</a>
    </div>
    <p style="font-size:12px;color:#777;text-align:center">Você está recebendo este email porque optou por notificações de novas publicações.</p>
  `;
  return baseTemplate(content);
};

export const customTemplate = (title: string, message: string, buttonText?: string, buttonUrl?: string) => {
  const config = getEmailConfig();

  const buttonHtml = buttonText && buttonUrl
    ? `
      <div style="text-align: center;">
        <a href="${buttonUrl}" class="button">
          ${buttonText}
        </a>
      </div>
    `
    : '';

  const content = `
    <h2 style="text-align: center;">${title}</h2>
    <div>
      ${message}
    </div>
    ${buttonHtml}
  `;

  return baseTemplate(content);
};

// Template para confirmação de solicitação de reembolso
export const reimbursementConfirmationTemplate = (nome: string, protocolo: string, valor: string) => {
  const config = getEmailConfig();

  const content = `
    <h2 style="text-align: center;">Solicitação de Reembolso Recebida</h2>
    <p>
      Olá, <strong>${nome}</strong>!
    </p>
    <p>
      Sua solicitação de reembolso foi recebida com sucesso e está sendo processada.
    </p>
    <div style="background-color: ${config.secondaryColor}; padding: 15px; border-radius: 5px; margin: 20px 0;">
      <p style="margin: 5px 0;"><strong>Protocolo:</strong> ${protocolo}</p>
      <p style="margin: 5px 0;"><strong>Valor:</strong> ${valor}</p>
      <p style="margin: 5px 0;"><strong>Data da Solicitação:</strong> ${new Date().toLocaleDateString('pt-BR')}</p>
      <p style="margin: 5px 0;"><strong>Status:</strong> Pendente</p>
    </div>
    <p>
      Você receberá atualizações sobre o status da sua solicitação por email. Em caso de dúvidas, entre em contato com o departamento financeiro.
    </p>
    <p style="color: #666; font-size: 12px; text-align: center; margin-top: 30px;">
      Este é um email automático. Por favor, não responda.
    </p>
  `;

  return baseTemplate(content);
};

// Template para aprovação de reembolso
export const reimbursementApprovalTemplate = (nome: string, protocolo: string, valor: string, metodoPagamento: string, observacao?: string) => {
  const config = getEmailConfig();

  const observacaoText = observacao
    ? `<p style="margin: 5px 0;"><strong>Observação:</strong> ${observacao}</p>`
    : '';

  const content = `
    <h2 style="text-align: center; color: #28a745;">Reembolso Aprovado</h2>
    <p>
      Olá, <strong>${nome}</strong>!
    </p>
    <p>
      Sua solicitação de reembolso foi <strong>aprovada</strong> e o pagamento será processado em breve.
    </p>
    <div style="background-color: ${config.secondaryColor}; padding: 15px; border-radius: 5px; margin: 20px 0;">
      <p style="margin: 5px 0;"><strong>Protocolo:</strong> ${protocolo}</p>
      <p style="margin: 5px 0;"><strong>Valor:</strong> ${valor}</p>
      <p style="margin: 5px 0;"><strong>Método de Pagamento:</strong> ${metodoPagamento}</p>
      <p style="margin: 5px 0;"><strong>Data de Aprovação:</strong> ${new Date().toLocaleDateString('pt-BR')}</p>
      ${observacaoText}
    </div>
    <p>
      O valor será creditado conforme o método de pagamento selecionado. Em caso de dúvidas, entre em contato com o departamento financeiro.
    </p>
    <p style="color: #666; font-size: 12px; text-align: center; margin-top: 30px;">
      Este é um email automático. Por favor, não responda.
    </p>
  `;

  return baseTemplate(content);
};

// Template para rejeição de reembolso
export const reimbursementRejectionTemplate = (nome: string, protocolo: string, motivo: string) => {
  const config = getEmailConfig();

  const content = `
    <h2 style="text-align: center; color: #dc3545;">Reembolso Não Aprovado</h2>
    <p>
      Olá, <strong>${nome}</strong>!
    </p>
    <p>
      Infelizmente, sua solicitação de reembolso não foi aprovada.
    </p>
    <div style="background-color: ${config.secondaryColor}; padding: 15px; border-radius: 5px; margin: 20px 0;">
      <p style="margin: 5px 0;"><strong>Protocolo:</strong> ${protocolo}</p>
      <p style="margin: 5px 0;"><strong>Data da Decisão:</strong> ${new Date().toLocaleDateString('pt-BR')}</p>
      <p style="margin: 5px 0;"><strong>Motivo:</strong> ${motivo}</p>
    </div>
    <p>
      Se você tiver dúvidas sobre esta decisão ou precisar de mais informações, entre em contato com o departamento financeiro.
    </p>
    <p style="color: #666; font-size: 12px; text-align: center; margin-top: 30px;">
      Este é um email automático. Por favor, não responda.
    </p>
  `;

  return baseTemplate(content);
};

// Template para boas-vindas a novos usuários
export const newUserWelcomeTemplate = (nome: string, loginUrl: string, password?: string) => {
  const config = getEmailConfig();

  // Adicionar informações de senha se fornecida
  const passwordInfo = password
    ? `
    <div style="background-color: #fff8e1; border-left: 4px solid #ffc107; padding: 12px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0; font-weight: bold; color: #ff6d00;">⚠️ Informações de Acesso</p>
      <p style="margin: 8px 0 0 0;">
        Uma senha temporária foi gerada para você: <strong>${password}</strong>
      </p>
      <p style="margin: 8px 0 0 0;">
        Por favor, altere esta senha no seu primeiro acesso ao sistema.
      </p>
    </div>
    `
    : '';

  const content = `
    <h2 style="text-align: center; color: ${config.primaryColor};">Bem-vindo ao ${config.companyName}!</h2>
    <p>
      Olá, <strong>${nome}</strong>!
    </p>
    <p>
      Sua conta foi criada com sucesso no sistema ${config.companyName}.
    </p>
    ${passwordInfo}
    <p>
      <strong>Importante:</strong> Sua conta está aguardando aprovação do administrador. Você receberá um email quando sua conta for aprovada.
    </p>
    <p>
      Após a aprovação, você poderá acessar o sistema utilizando seu email e senha cadastrados.
    </p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${loginUrl}" class="button" style="background-color: ${config.primaryColor}; color: white; text-decoration: none; padding: 12px 24px; border-radius: 4px; font-weight: bold;">
        Verificar Status da Conta
      </a>
    </div>
    <p>
      No portal você terá acesso a diversos recursos e informações importantes da empresa.
    </p>
    <p>
      Se você tiver qualquer dúvida ou precisar de ajuda, entre em contato com o suporte.
    </p>
    <p style="color: #666; font-size: 12px; text-align: center; margin-top: 30px;">
      Este é um email automático. Por favor, não responda.
    </p>
  `;

  return baseTemplate(content);
};

// Template para convite de novos usuários
export const inviteTemplate = (inviteCode: string, registerUrl: string, expiryText: string, maxUses?: number) => {
  const config = getEmailConfig();

  // Modificar a URL para apontar para a página de login
  const loginUrl = `${config.appUrl}/login`;

  const content = `
    <h2 style="text-align: center; color: ${config.primaryColor};">Convite para o ${config.companyName}</h2>
    <p>
      Olá!
    </p>
    <p>
      Você foi convidado para se juntar ao sistema ${config.companyName}.
    </p>
    <div style="background-color: ${config.secondaryColor}; padding: 15px; border-radius: 5px; margin: 20px 0; text-align: center;">
      <p style="margin: 5px 0; font-size: 18px;"><strong>Seu código de verificação:</strong></p>
      <p style="margin: 10px 0; font-size: 24px; font-weight: bold; letter-spacing: 2px; font-family: monospace;">${inviteCode}</p>
      ${maxUses ? `<p style="margin: 5px 0; font-size: 14px;">Este código pode ser usado ${maxUses} ${maxUses === 1 ? 'vez' : 'vezes'}</p>` : ''}
      ${expiryText ? `<p style="margin: 5px 0; font-size: 14px; color: #d32f2f;">${expiryText}</p>` : ''}
    </div>

    <h3 style="color: ${config.primaryColor}; margin-top: 30px;">Como acessar o sistema:</h3>

    <ol style="margin-bottom: 20px; padding-left: 20px;">
      <li style="margin-bottom: 10px;">
        <strong>Acesse a página de login</strong> clicando no botão abaixo
      </li>
      <li style="margin-bottom: 10px;">
        <strong>Insira seu email</strong> (o mesmo que recebeu este convite)
      </li>
      <li style="margin-bottom: 10px;">
        <strong>Quando solicitado, insira o código de verificação</strong> mostrado acima
      </li>
      <li style="margin-bottom: 10px;">
        <strong>Defina uma senha</strong> para seu acesso futuro
      </li>
    </ol>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${loginUrl}" class="button" style="background-color: ${config.primaryColor}; color: white; text-decoration: none; padding: 12px 24px; border-radius: 4px; font-weight: bold;">
        Acessar o Sistema
      </a>
    </div>

    <p>
      Se o botão não funcionar, você pode acessar o seguinte link:
      <a href="${loginUrl}">${loginUrl}</a>
    </p>

    <p style="margin-top: 20px; font-weight: bold; color: ${config.primaryColor};">
      Importante: Guarde este código com segurança. Você precisará dele para seu primeiro acesso.
    </p>

    <p>
      Se você não solicitou este convite, por favor ignore este email.
    </p>

    <div style="background-color: #fff8e1; border-left: 4px solid #ffc107; padding: 12px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0; font-weight: bold; color: #ff6d00;">⚠️ Importante: Verifique sua pasta de spam</p>
      <p style="margin: 8px 0 0 0; font-size: 14px;">
        Nossos emails podem ocasionalmente ser filtrados como spam. Se você não encontrar futuros emails do sistema,
        verifique sua pasta de spam e marque nosso endereço como "não é spam" ou adicione
        <strong>${process.env.EMAIL_USER || 'apiabzgroup@gmail.com'}</strong> à sua lista de contatos.
      </p>
    </div>

    <p style="color: #666; font-size: 12px; text-align: center; margin-top: 30px;">
      Este é um email automático. Por favor, não responda.
    </p>
  `;

  return baseTemplate(content);
};

// Template para notificação de administrador sobre novo usuário
export const adminNotificationTemplate = (userData: {
  name: string;
  email: string;
  phoneNumber: string;
  position: string;
  department: string;
  protocol: string;
}) => {
  const config = getEmailConfig();
  const adminUrl = `${config.appUrl}/admin/users`;

  const content = `
    <h2 style="text-align: center; color: ${config.primaryColor};">Novo Cadastro no Portal</h2>
    <p>
      Olá Administrador,
    </p>
    <p>
      Um novo usuário se cadastrou no Portal ${config.companyName} e está aguardando aprovação.
    </p>
    <div style="background-color: ${config.secondaryColor}; padding: 15px; border-radius: 5px; margin: 20px 0;">
      <h3 style="margin-top: 0; color: ${config.primaryColor};">Detalhes do Usuário:</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; font-weight: bold;">Nome:</td>
          <td style="padding: 8px 0;">${userData.name}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: bold;">Email:</td>
          <td style="padding: 8px 0;">${userData.email || 'Não informado'}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: bold;">Telefone:</td>
          <td style="padding: 8px 0;">${userData.phoneNumber || 'Não informado'}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: bold;">Cargo:</td>
          <td style="padding: 8px 0;">${userData.position || 'Não informado'}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: bold;">Departamento:</td>
          <td style="padding: 8px 0;">${userData.department || 'Não informado'}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: bold;">Protocolo:</td>
          <td style="padding: 8px 0;">${userData.protocol}</td>
        </tr>
      </table>
    </div>
    <p>
      Por favor, acesse o painel administrativo para revisar e aprovar este cadastro.
    </p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${adminUrl}" class="button" style="background-color: ${config.primaryColor}; color: white; text-decoration: none; padding: 12px 24px; border-radius: 4px; font-weight: bold;">
        Acessar Painel Admin
      </a>
    </div>
    <p>
      Atenciosamente,<br>Sistema Portal ${config.companyName}
    </p>
  `;

  return baseTemplate(content);
};
