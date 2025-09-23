import { NextRequest, NextResponse } from 'next/server';
import { initiatePhoneLogin, verifyPhoneLogin, loginWithPassword } from '@/lib/auth';
// import { Pool } from 'pg'; // Removido - não utilizado
import { getLatestCode } from '@/lib/code-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phoneNumber, verificationCode, password, email, inviteCode, rememberMe } = body;

    console.log('Recebida solicitação de login:', { phoneNumber, email, hasPassword: !!password, hasVerificationCode: !!verificationCode, hasInviteCode: !!inviteCode });
    console.log('Senha (primeiros caracteres):', password ? password.substring(0, 3) + '...' : 'Não fornecida');
    console.log('Código de verificação:', verificationCode || 'Não fornecido');

    // Validar os dados de entrada
    if (!phoneNumber && !email) {
      return NextResponse.json(
        { error: 'Número de telefone ou email é obrigatório' },
        { status: 400 }
      );
    }

    // Verificar se é o administrador
    const adminEmail = process.env.ADMIN_EMAIL || 'caio.correia@groupabz.com';
    const adminPhone = process.env.ADMIN_PHONE_NUMBER || '+5522997847289';

    const isAdminEmail = email === adminEmail;
    const isAdminPhone = phoneNumber === adminPhone;
    const isAdmin = isAdminEmail || isAdminPhone;

    console.log('Verificando se é login de administrador:', { isAdminEmail, isAdminPhone, isAdmin });

    // Se for o administrador e tiver senha, tentar login direto
    if (isAdmin && password) {
      console.log('Tentando login de administrador com senha');

      try {
        const identifier = isAdminEmail ? adminEmail : adminPhone;
        const result = await loginWithPassword(identifier, password, rememberMe || false);
        console.log('Resultado do login de administrador:', result);

        if (!result.success) {
          return NextResponse.json(
            { error: result.message },
            { status: 401 }
          );
        }

        return NextResponse.json({
          token: result.token,
          refreshToken: result.refreshToken,
          user: result.user,
          message: result.message
        });
      } catch (error) {
        console.error('Erro ao fazer login de administrador:', error);
        return NextResponse.json(
          { error: 'Erro interno ao processar login de administrador' },
          { status: 500 }
        );
      }
    }

    // Se tiver senha, tentar login com senha
    if (password) {
      // Verificar se o usuário existe antes de tentar fazer login com senha
      // Usar o email se fornecido, caso contrário usar o número de telefone
      const identifier = email || phoneNumber;
      console.log('Tentando login com senha para:', identifier);
      console.log('Senha fornecida (primeiros caracteres):', password.substring(0, 3) + '...');

      try {
        const result = await loginWithPassword(identifier, password, rememberMe || false);
        console.log('Resultado do login:', result);

        if (!result.success) {
          return NextResponse.json(
            { error: result.message },
            { status: 401 }
          );
        }

        return NextResponse.json({
          token: result.token,
          refreshToken: result.refreshToken,
          user: result.user,
          message: result.message
        });
      } catch (error) {
        console.error('Erro ao fazer login com senha:', error);
        return NextResponse.json(
          { error: 'Erro interno ao processar login com senha' },
          { status: 500 }
        );
      }
    }

    // Se não tiver código de verificação, iniciar o processo de login
    if (!verificationCode) {
      console.log('Iniciando processo de login para:', email || phoneNumber);

      const result = await initiatePhoneLogin(phoneNumber, email, inviteCode);
      console.log('Resultado do início do login:', result);

      // Em ambiente de desenvolvimento, incluir o código para facilitar testes
      if (process.env.NODE_ENV !== 'production' && result.success) {
        // Obter o código mais recente para o identificador
        const identifier = email || phoneNumber;
        const code = getLatestCode(identifier);

        if (code) {
          console.log(`Código gerado para ${identifier}: ${code}`);
          (result as any).code = code;
          (result as any).debugUrl = 'http://localhost:3000/debug/codes';
        } else {
          console.warn(`Nenhum código encontrado para ${identifier} no serviço em memória`);

          // Verificar códigos ativos
          const { getActiveCodes } = await import('@/lib/code-service');
          const activeCodes = getActiveCodes();
          console.log('Códigos ativos em memória:', JSON.stringify(activeCodes, null, 2));
        }
      }

      return NextResponse.json(result);
    }

    // Se tiver código de verificação, verificar e completar o login
    console.log(`Verificando código de verificação: ${verificationCode} para ${email || phoneNumber}`);

    // Verificar se o código está no serviço em memória
    const { getActiveCodes } = await import('@/lib/code-service');
    const activeCodes = getActiveCodes();
    console.log('Códigos ativos em memória antes da verificação:', JSON.stringify(activeCodes, null, 2));

    const result = await verifyPhoneLogin(phoneNumber, verificationCode, email, inviteCode);
    console.log('Resultado da verificação do código:', result);

    if (!result.success) {
      console.error('Falha na verificação do código:', result.message);
      return NextResponse.json(
        {
          error: result.message,
          authStatus: result.authStatus,
          details: 'Falha na verificação do código. Verifique se o código está correto e tente novamente.'
        },
        { status: 401 }
      );
    }

    console.log('Verificação de código bem-sucedida, retornando token e dados do usuário');

    // Retornar o token e os dados do usuário
    return NextResponse.json({
      success: true,
      token: result.token,
      user: result.user,
      message: result.message,
      requiresPassword: result.requiresPassword,
      isNewUser: result.isNewUser,
      authStatus: result.authStatus
    });
  } catch (error) {
    console.error('Erro ao processar login:', error);

    // Exibir detalhes do erro para depuração
    if (error instanceof Error) {
      console.error('Mensagem de erro:', error.message);
      console.error('Stack trace:', error.stack);
    }

    return NextResponse.json(
      { error: 'Erro interno do servidor. Por favor, tente novamente.' },
      { status: 500 }
    );
  }
}
