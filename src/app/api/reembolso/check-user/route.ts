import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';

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

// Verificar se a coluna user_id existe na tabela
async function checkUserIdColumnExists(tableName: string) {
  try {
    const { data: columns, error: columnsError } = await supabaseAdmin
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_schema', 'public')
      .eq('table_name', tableName)
      .eq('column_name', 'user_id');

    if (columnsError) {
      console.error('Erro ao verificar coluna user_id:', columnsError);
      return false;
    }

    return columns && columns.length > 0;
  } catch (error) {
    console.error('Erro ao verificar coluna user_id:', error);
    return false;
  }
}

// GET - Verificar se um usuário tem reembolsos
export async function GET(request: NextRequest) {
  try {
    // Obter parâmetros de consulta
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const userId = searchParams.get('userId');

    if (!email && !userId) {
      return NextResponse.json(
        { error: 'Email ou userId é obrigatório' },
        { status: 400 }
      );
    }

    // Verificar se a tabela de reembolsos existe
    const { exists, tableName } = await checkReimbursementTableExists();

    if (!exists || !tableName) {
      console.error('Tabela de reembolsos não encontrada');
      return NextResponse.json(
        { error: 'A tabela de reembolsos não existe no banco de dados.' },
        { status: 500 }
      );
    }

    console.log(`Tabela de reembolsos encontrada: ${tableName}`);

    // Verificar se a coluna user_id existe
    const hasUserIdColumn = await checkUserIdColumnExists(tableName);
    console.log(`Coluna user_id ${hasUserIdColumn ? 'existe' : 'não existe'} na tabela ${tableName}`);

    let reimbursements = [];

    // Se temos userId e a coluna user_id existe, buscar por user_id
    if (userId && hasUserIdColumn) {
      console.log(`Buscando reembolsos para o userId: ${userId}`);

      const { data, error } = await supabaseAdmin
        .from(tableName)
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar reembolsos por user_id:', error);
      } else {
        console.log(`Encontrados ${data?.length || 0} reembolsos com user_id ${userId}`);
        reimbursements = data || [];
      }
    }

    // Se não encontramos reembolsos por user_id ou a coluna não existe, buscar por email
    if ((!reimbursements || reimbursements.length === 0) && email) {
      console.log(`Buscando reembolsos para o email: ${email}`);

      // Normalizar o email para busca case-insensitive
      const normalizedEmail = email.toLowerCase().trim();
      console.log(`Email normalizado: ${normalizedEmail}`);

      // Buscar reembolsos com email exato
      const { data: exactMatch, error: exactError } = await supabaseAdmin
        .from(tableName)
        .select('*')
        .eq('email', email)
        .order('created_at', { ascending: false });

      if (exactError) {
        console.error('Erro ao buscar reembolsos com email exato:', exactError);
      } else {
        console.log(`Encontrados ${exactMatch?.length || 0} reembolsos com email exato`);
        if (exactMatch && exactMatch.length > 0) {
          reimbursements = exactMatch;
        }
      }

      // Se não encontramos com email exato, tentar com case insensitive
      if (reimbursements.length === 0) {
        const { data: caseInsensitiveMatch, error: caseError } = await supabaseAdmin
          .from(tableName)
          .select('*')
          .ilike('email', normalizedEmail)
          .order('created_at', { ascending: false });

        if (caseError) {
          console.error('Erro ao buscar reembolsos com email case insensitive:', caseError);
        } else {
          console.log(`Encontrados ${caseInsensitiveMatch?.length || 0} reembolsos com email case insensitive`);
          if (caseInsensitiveMatch && caseInsensitiveMatch.length > 0) {
            reimbursements = caseInsensitiveMatch;
          }
        }
      }

      // Se ainda não encontramos, tentar com email parcial
      if (reimbursements.length === 0) {
        const { data: partialMatch, error: partialError } = await supabaseAdmin
          .from(tableName)
          .select('*')
          .ilike('email', `%${normalizedEmail}%`)
          .order('created_at', { ascending: false });

        if (partialError) {
          console.error('Erro ao buscar reembolsos com email parcial:', partialError);
        } else {
          console.log(`Encontrados ${partialMatch?.length || 0} reembolsos com email parcial`);
          if (partialMatch && partialMatch.length > 0) {
            reimbursements = partialMatch;
          }
        }
      }
    }

    // Buscar alguns emails da tabela para comparação
    const { data: sampleEmails, error: sampleError } = await supabaseAdmin
      .from(tableName)
      .select('email')
      .limit(20);

    if (sampleError) {
      console.error('Erro ao buscar amostra de emails:', sampleError);
    } else {
      console.log('Amostra de emails na tabela:', sampleEmails?.map(item => item.email));
    }

    // Processar os resultados para normalizar os dados
    const processResults = (results: any[]) => {
      return (results || []).map(item => ({
        id: item.id,
        protocolo: item.protocolo,
        nome: item.nome,
        email: item.email,
        user_id: item.user_id || null,
        data: item.data,
        valorTotal: parseFloat(item.valor_total || item.valorTotal || 0),
        tipoReembolso: item.tipo_reembolso || item.tipoReembolso || 'Não especificado',
        status: item.status || 'pendente',
        created_at: item.created_at
      }));
    };

    // Processar todos os reembolsos encontrados
    const processedReimbursements = processResults(reimbursements);

    return NextResponse.json({
      email,
      userId,
      hasReimbursements: reimbursements.length > 0,
      count: {
        total: reimbursements.length,
        byUserId: userId && hasUserIdColumn ? reimbursements.length : 0,
        byEmail: (!userId || !hasUserIdColumn) && email ? reimbursements.length : 0
      },
      reimbursements: processedReimbursements,
      // Manter compatibilidade com o formato anterior
      exactMatch: email ? processResults(reimbursements || []) : [],
      caseInsensitiveMatch: email ? processResults([]) : [],
      partialMatch: email ? processResults([]) : [],
      usernameMatch: email ? processResults([]) : [],
      hasExactMatch: email ? (reimbursements && reimbursements.length > 0) || false : false,
      hasCaseInsensitiveMatch: false,
      hasPartialMatch: false,
      hasUsernameMatch: false
    });
  } catch (error) {
    console.error('Erro ao verificar reembolsos do usuário:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
