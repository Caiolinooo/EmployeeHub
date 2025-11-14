import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { sendReimbursementApprovalEmail, sendReimbursementRejectionEmail } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

// Função auxiliar para verificar se a tabela de reembolsos existe
async function checkReimbursementTableExists() {
  try {
    console.log('Verificando se a tabela de reembolsos existe...');

    // Verificar se a tabela Reimbursement existe usando metadados do Supabase
    const { data: tableExists, error } = await supabaseAdmin
      .from('Reimbursement')
      .select('id')
      .limit(1);

    if (error) {
      console.error('Tabela Reimbursement não encontrada:', error);

      // Tentar com o nome alternativo
      const { data: altTableExists, error: altError } = await supabaseAdmin
        .from('reimbursements')
        .select('id')
        .limit(1);

      if (altError) {
        console.error('Tabela reimbursements também não encontrada:', altError);
        return { exists: false, tableName: null };
      }

      console.log('Tabela reimbursements encontrada');
      return { exists: true, tableName: 'reimbursements' };
    }

    console.log('Tabela Reimbursement encontrada');
    return { exists: true, tableName: 'Reimbursement' };
  } catch (error) {
    console.error('Exceção ao verificar tabela de reembolsos:', error);
    return { exists: false, tableName: null };
  }
}

// Instruções para criar a tabela manualmente
function getCreateTableInstructions() {
  return `
Para criar a tabela Reimbursement, acesse o SQL Editor no Supabase e execute o seguinte SQL:

CREATE TABLE IF NOT EXISTS "Reimbursement" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "nome" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "telefone" TEXT NOT NULL,
  "cpf" TEXT NOT NULL,
  "cargo" TEXT NOT NULL,
  "centro_custo" TEXT NOT NULL,
  "data" TIMESTAMP NOT NULL,
  "tipo_reembolso" TEXT NOT NULL,
  "icone_reembolso" TEXT,
  "descricao" TEXT NOT NULL,
  "valor_total" NUMERIC NOT NULL,
  "moeda" TEXT NOT NULL DEFAULT 'BRL',
  "metodo_pagamento" TEXT NOT NULL,
  "banco" TEXT,
  "agencia" TEXT,
  "conta" TEXT,
  "pix_tipo" TEXT,
  "pix_chave" TEXT,
  "comprovantes" JSONB NOT NULL,
  "observacoes" TEXT,
  "protocolo" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pendente',
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "historico" JSONB NOT NULL,

  CONSTRAINT "Reimbursement_protocolo_key" UNIQUE ("protocolo")
);

-- Adicionar políticas de segurança para a tabela
ALTER TABLE "Reimbursement" ENABLE ROW LEVEL SECURITY;

-- Política para permitir acesso a todos os usuários autenticados
CREATE POLICY "Reimbursement Access Policy"
ON "Reimbursement"
FOR ALL
TO authenticated
USING (true);
  `;
}

// GET - Obter uma solicitação de reembolso pelo protocolo
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ protocolo: string }> }
) {
  try {
    // Usar await para acessar params.protocolo conforme recomendado pelo Next.js
    const { protocolo } = await params;

    // Verificar se a tabela de reembolsos existe
    console.log('Verificando existência da tabela de reembolsos...');

    const { exists, tableName } = await checkReimbursementTableExists();

    if (!exists || !tableName) {
      console.error('Tabela de reembolsos não encontrada');
      return NextResponse.json(
        {
          error: 'A tabela de reembolsos não existe no banco de dados. Por favor, crie a tabela manualmente usando o SQL Editor do Supabase.',
          instructions: getCreateTableInstructions()
        },
        { status: 500 }
      );
    }

    console.log(`Tabela de reembolsos encontrada: ${tableName}`);
    console.log(`Buscando reembolso com protocolo ${protocolo} na tabela ${tableName}`);

    // Buscar o reembolso na tabela encontrada
    const { data: reembolso, error } = await supabaseAdmin
      .from(tableName)
      .select('*')
      .eq('protocolo', protocolo)
      .single();

    if (error || !reembolso) {
      console.error('Erro ao buscar reembolso:', error);
      return NextResponse.json(
        { error: 'Solicitação de reembolso não encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json(reembolso);
  } catch (error) {
    console.error('Erro ao obter solicitação de reembolso:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// PUT - Atualizar o status de uma solicitação de reembolso
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ protocolo: string }> }
) {
  try {
    // Verificar autenticação e permissões
    const authHeader = request.headers.get('authorization') || '';
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      console.error('Token de autenticação não fornecido');
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    if (!payload) {
      console.error('Token inválido ou expirado');
      return NextResponse.json(
        { error: 'Token inválido ou expirado' },
        { status: 401 }
      );
    }

    // Verificar permissões do usuário
    const isAdmin = payload.role === 'ADMIN';
    const isManager = payload.role === 'MANAGER';

    // Buscar permissões específicas do usuário
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('access_permissions')
      .eq('id', payload.userId)
      .single();

    if (userError) {
      console.error('Erro ao buscar permissões do usuário:', userError);
    }

    // Verificar se o usuário tem permissão específica de aprovação de reembolso
    const hasApprovalPermission = !!(
      userData?.access_permissions?.features?.reimbursement_approval
    );

    console.log('Verificando permissões de aprovação:', {
      userId: payload.userId,
      isAdmin,
      isManager,
      hasApprovalPermission,
      accessPermissions: userData?.access_permissions
    });

    // Apenas administradores, gerentes ou usuários com permissão específica podem aprovar/rejeitar reembolsos
    if (!isAdmin && !isManager && !hasApprovalPermission) {
      console.error('Usuário sem permissão para aprovar/rejeitar reembolsos:', payload.userId);
      return NextResponse.json(
        { error: 'Você não tem permissão para aprovar ou rejeitar solicitações de reembolso' },
        { status: 403 }
      );
    }

    // Usar await para acessar params.protocolo conforme recomendado pelo Next.js
    const { protocolo } = await params;
    const body = await request.json();
    const { status, observacao } = body;
    const usuarioId = payload.userId; // Usar o ID do usuário autenticado

    // Validar os dados
    if (!status || !['pendente', 'aprovado', 'rejeitado'].includes(status)) {
      return NextResponse.json(
        { error: 'Status inválido' },
        { status: 400 }
      );
    }

    // Verificar se a tabela de reembolsos existe
    console.log('Verificando existência da tabela de reembolsos...');

    const { exists, tableName } = await checkReimbursementTableExists();

    if (!exists || !tableName) {
      console.error('Tabela de reembolsos não encontrada');
      return NextResponse.json(
        {
          error: 'A tabela de reembolsos não existe no banco de dados. Por favor, crie a tabela manualmente usando o SQL Editor do Supabase.',
          instructions: getCreateTableInstructions()
        },
        { status: 500 }
      );
    }

    console.log(`Tabela de reembolsos encontrada: ${tableName}`);
    console.log(`Buscando reembolso com protocolo ${protocolo} na tabela ${tableName}`);

    // Buscar o reembolso na tabela encontrada
    const { data: reembolso, error: fetchError } = await supabaseAdmin
      .from(tableName)
      .select('*')
      .eq('protocolo', protocolo)
      .single();

    if (fetchError || !reembolso) {
      console.error('Erro ao buscar reembolso:', fetchError);
      return NextResponse.json(
        { error: 'Solicitação de reembolso não encontrada' },
        { status: 404 }
      );
    }

    // Criar novo item de histórico
    const novoHistorico = {
      data: new Date(),
      status,
      observacao,
      usuarioId,
      userRole: payload.role
    };

    console.log('Novo item de histórico:', novoHistorico);

    // Garantir que o histórico seja um array
    const historico = Array.isArray(reembolso.historico) ? reembolso.historico : [];

    console.log('Histórico atual:', historico);

    // Atualizar o reembolso com Supabase usando o nome da tabela determinado anteriormente
    console.log(`Atualizando reembolso na tabela ${tableName}`);

    console.log('Dados a serem atualizados:', {
      status,
      historico: [...historico, novoHistorico],
      updated_at: new Date().toISOString()
    });

    const { data: reembolsoAtualizado, error: updateError } = await supabaseAdmin
      .from(tableName)
      .update({
        status,
        historico: [...historico, novoHistorico],
        updated_at: new Date().toISOString()
      })
      .eq('protocolo', protocolo)
      .select()
      .single();

    console.log('Resultado da atualização:', { reembolsoAtualizado, updateError });

    if (updateError) {
      console.error('Erro ao atualizar reembolso:', updateError);
      return NextResponse.json(
        { error: 'Erro ao atualizar solicitação de reembolso' },
        { status: 500 }
      );
    }

    // Send email notification based on status
    try {
      console.log('Enviando notificação por email...');

      // Format currency value
      const valorFormatado = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: reembolso.moeda || 'BRL'
      }).format(reembolso.valor_total || 0);

      if (status === 'aprovado') {
        // Send approval email
        console.log('Enviando email de aprovação...');
        await sendReimbursementApprovalEmail(
          reembolso.email,
          reembolso.nome,
          reembolso.protocolo,
          valorFormatado,
          reembolso.metodo_pagamento || 'Não especificado',
          observacao
        );
        console.log('Email de aprovação enviado com sucesso');
      } else if (status === 'rejeitado') {
        // Send rejection email
        console.log('Enviando email de rejeição...');
        await sendReimbursementRejectionEmail(
          reembolso.email,
          reembolso.nome,
          reembolso.protocolo,
          observacao || 'Não especificado'
        );
        console.log('Email de rejeição enviado com sucesso');
      }
    } catch (emailError) {
      console.error('Erro ao enviar notificação por email:', emailError);
      // Continue even if email sending fails
    }

    return NextResponse.json({
      success: true,
      message: `Status atualizado para ${status}`,
      data: reembolsoAtualizado
    });
  } catch (error) {
    console.error('Erro ao atualizar solicitação de reembolso:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
