import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { supabase, supabaseAdmin } from '@/lib/supabase';

/**
 * Função auxiliar para criar funcionários a partir dos usuários existentes
 */
async function criarFuncionariosAPartirDeUsuarios() {
  try {
    console.log('Iniciando criação de funcionários a partir de usuários...');

    // Buscar todos os usuários ativos
    console.log('Buscando todos os usuários ativos para criar funcionários...');
    const { data: users, error: usersError } = await supabase
      .from('users_unified')
      .select('id, first_name, last_name, email, phone_number, role, position, department, active')
      .eq('active', true)
      .order('first_name', { ascending: true });

    console.log(`Consulta de usuários retornou ${users?.length || 0} usuários`);

    // Verificar se há usuários com papel MANAGER
    if (users && users.length > 0) {
      const gerentes = users.filter(u => u.role === 'MANAGER');
      console.log(`Encontrados ${gerentes.length} usuários com papel MANAGER`);

      if (gerentes.length === 0) {
        console.log('ATENÇÃO: Nenhum usuário com papel MANAGER encontrado!');
      } else {
        console.log('Gerentes encontrados:');
        gerentes.forEach(g => console.log(`- ${g.first_name} ${g.last_name} (${g.email})`));
      }
    }

    if (usersError) {
      console.error('Erro ao buscar usuários:', usersError);
      return;
    }

    if (!users || users.length === 0) {
      console.log('Nenhum usuário encontrado para criar funcionários.');
      return;
    }

    console.log(`Encontrados ${users.length} usuários para criar funcionários.`);

    // Criar funcionários para cada usuário
    console.log(`Processando ${users.length} usuários para criar funcionários`);

    for (const user of users) {
      const nome = `${user.first_name} ${user.last_name}`.trim();
      const cargo = user.position || 'Não especificado';
      const departamento = user.department || 'Não especificado';
      const email = user.email;
      const matricula = email ? email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '') : `user-${user.id.substring(0, 8)}`;
      const status = 'ativo';
      const userId = user.id;

      console.log(`Processando usuário: ${nome} (${email}) - Role: ${user.role}`);

      // Verificar se já existe um funcionário para este usuário
      const { data: existingFuncionario, error: checkError } = await supabase
        .from('funcionarios')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (checkError) {
        console.error(`Erro ao verificar funcionário existente para ${nome}:`, checkError);
        continue;
      }

      if (existingFuncionario) {
        console.log(`Funcionário já existe para ${nome}, pulando...`);
        continue;
      }

      // Verificar se o usuário existe na tabela users
      const { data: userExists, error: userCheckError } = await supabase
        .from('users')
        .select('id')
        .eq('id', userId)
        .single();

      if (userCheckError) {
        console.error(`Erro ao verificar se o usuário existe na tabela users para ${nome}:`, userCheckError);

        // Verificar se o usuário existe na tabela users_unified
        const { data: userUnifiedExists, error: userUnifiedCheckError } = await supabase
          .from('users_unified')
          .select('id')
          .eq('id', userId)
          .single();

        if (userUnifiedCheckError) {
          console.error(`Erro ao verificar se o usuário existe na tabela users_unified para ${nome}:`, userUnifiedCheckError);
          console.error(`Pulando criação de funcionário para ${nome} porque o usuário não existe em nenhuma tabela.`);
          continue;
        }

        // Se o usuário existe em users_unified mas não em users, precisamos criá-lo em users
        console.log(`Usuário ${nome} existe em users_unified mas não em users. Criando em users...`);

        const { data: newUser, error: createUserError } = await supabaseAdmin
          .from('users')
          .insert({
            id: userId,
            email: user.email || '',
            first_name: user.first_name || '',
            last_name: user.last_name || '',
            phone_number: user.phone_number || null,
            role: user.role || 'USER',
            position: user.position || null,
            department: user.department || null,
            active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (createUserError) {
          console.error(`Erro ao criar usuário em users para ${nome}:`, createUserError);
          continue;
        }

        console.log(`Usuário criado com sucesso em users para ${nome}`);
      }

      console.log(`Criando novo funcionário para ${nome} (${user.role})`);

      // Inserir novo funcionário
      const { data: newFuncionario, error: insertError } = await supabaseAdmin
        .from('funcionarios')
        .insert({
          nome,
          cargo,
          departamento,
          email,
          matricula,
          status,
          user_id: userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) {
        console.error(`Erro ao criar funcionário para ${nome}:`, insertError);
      } else {
        console.log(`Funcionário criado com sucesso para ${nome} com ID ${newFuncionario.id}`);
      }
    }

    console.log('Processo de criação de funcionários concluído.');
  } catch (error) {
    console.error('Erro ao criar funcionários a partir de usuários:', error);
  }
}

/**
 * Rota para listar usuários para o módulo de avaliação
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader || undefined);

    if (!token) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: 'Token inválido ou expirado' },
        { status: 401 }
      );
    }

    // Obter parâmetros da URL
    const url = new URL(request.url);
    const role = url.searchParams.get('role');
    const searchTerm = url.searchParams.get('search');

    // Sempre verificar se há novos usuários para criar funcionários
    console.log('Verificando se há novos usuários para criar funcionários...');
    await criarFuncionariosAPartirDeUsuarios();

    // Verificar a estrutura da tabela funcionarios
    console.log('Verificando a estrutura da tabela funcionarios...');

    // Verificar se a tabela users existe e contar registros
    const { data: usersCheck, error: usersCheckError } = await supabase
      .from('users')
      .select('id, role')
      .limit(5);

    if (usersCheckError) {
      console.error('Erro ao verificar tabela users:', usersCheckError);
    } else {
      console.log('Tabela users verificada com sucesso');
      console.log(`Amostra de usuários na tabela users: ${usersCheck.length} registros`);
      if (usersCheck.length > 0) {
        console.log('Primeiros usuários na tabela users:');
        usersCheck.forEach(u => console.log(`- ID: ${u.id}, Role: ${u.role}`));
      }

      // Contar total de usuários
      const { count: usersCount, error: usersCountError } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });

      if (usersCountError) {
        console.error('Erro ao contar usuários na tabela users:', usersCountError);
      } else {
        console.log(`Total de usuários na tabela users: ${usersCount}`);
      }
    }

    // Verificar se a tabela users_unified existe e contar registros
    const { data: usersUnifiedCheck, error: usersUnifiedCheckError } = await supabase
      .from('users_unified')
      .select('id, role, first_name, last_name')
      .limit(5);

    if (usersUnifiedCheckError) {
      console.error('Erro ao verificar tabela users_unified:', usersUnifiedCheckError);
    } else {
      console.log('Tabela users_unified verificada com sucesso');
      console.log(`Amostra de usuários na tabela users_unified: ${usersUnifiedCheck.length} registros`);
      if (usersUnifiedCheck.length > 0) {
        console.log('Primeiros usuários na tabela users_unified:');
        usersUnifiedCheck.forEach(u => console.log(`- ID: ${u.id}, Nome: ${u.first_name} ${u.last_name}, Role: ${u.role}`));
      }

      // Contar total de usuários
      const { count: usersUnifiedCount, error: usersUnifiedCountError } = await supabase
        .from('users_unified')
        .select('*', { count: 'exact', head: true });

      if (usersUnifiedCountError) {
        console.error('Erro ao contar usuários na tabela users_unified:', usersUnifiedCountError);
      } else {
        console.log(`Total de usuários na tabela users_unified: ${usersUnifiedCount}`);
      }

      // Verificar usuários com papel MANAGER
      const { data: managers, error: managersError } = await supabase
        .from('users_unified')
        .select('id, first_name, last_name, role')
        .eq('role', 'MANAGER');

      if (managersError) {
        console.error('Erro ao buscar gerentes na tabela users_unified:', managersError);
      } else {
        console.log(`Total de gerentes na tabela users_unified: ${managers.length}`);
        if (managers.length > 0) {
          console.log('Gerentes encontrados na tabela users_unified:');
          managers.forEach(m => console.log(`- ID: ${m.id}, Nome: ${m.first_name} ${m.last_name}`));
        }
      }
    }

    // Construir a consulta base para buscar funcionários
    console.log('Construindo consulta para buscar funcionários...');
    let query = supabase
      .from('funcionarios')
      .select(`
        id,
        nome,
        cargo,
        departamento,
        email,
        status,
        user_id,
        users!user_id (role)
      `)
      .is('deleted_at', null);

    // Verificar o propósito da consulta
    const purpose = url.searchParams.get('purpose') || '';

    console.log('Parâmetros da consulta:', { role, purpose, searchTerm });

    // Se o propósito for "avaliadores", mostrar apenas gerentes
    if (purpose === 'avaliadores') {
      console.log('Filtrando apenas gerentes para avaliadores');
      // Para avaliadores, mostrar apenas gerentes
      query = query.eq('users.role', 'MANAGER');
    }
    // Se o parâmetro role for especificado, filtrar por esse papel
    else if (role) {
      console.log(`Filtrando funcionários pelo papel: ${role.toUpperCase()}`);
      // Filtrar funcionários pelo papel do usuário associado
      query = query.eq('users.role', role.toUpperCase());
    }
    // Caso contrário, mostrar todos os funcionários (para serem avaliados)
    else {
      console.log('Mostrando todos os funcionários para avaliação');
      // Não aplicar filtro de papel para mostrar todos os funcionários
    }

    // Filtrar por termo de pesquisa se especificado
    if (searchTerm) {
      query = query.or(`nome.ilike.%${searchTerm}%,cargo.ilike.%${searchTerm}%,departamento.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
    }

    // Ordenar por nome
    query = query.order('nome', { ascending: true });

    // Log da consulta que será executada
    console.log('Executando consulta para buscar funcionários...');

    // Executar a consulta
    const { data, error } = await query;

    console.log(`Consulta retornou ${data?.length || 0} funcionários`);

    // Se não retornou dados, verificar se há funcionários na tabela
    if (!data || data.length === 0) {
      console.log('Nenhum funcionário encontrado. Verificando se a tabela funcionarios tem registros...');
      const { count, error: countError } = await supabase
        .from('funcionarios')
        .select('*', { count: 'exact', head: true });

      if (countError) {
        console.error('Erro ao contar funcionários:', countError);
      } else {
        console.log(`Total de funcionários na tabela: ${count}`);
      }
    }

    if (error) {
      console.error('Erro ao buscar usuários:', error);
      return NextResponse.json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }

    // Transformar os dados para o formato esperado pelo frontend
    const usuarios = data.map(funcionario => ({
      id: funcionario.user_id || funcionario.id, // Usar user_id como ID principal
      funcionario_id: funcionario.id, // Manter o ID do funcionário como referência
      nome: funcionario.nome,
      email: funcionario.email,
      cargo: funcionario.cargo || 'Não especificado',
      departamento: funcionario.departamento || 'Não especificado',
      role: (funcionario.users as any)?.role || 'USER',
      ativo: funcionario.status === 'ativo'
    }));

    console.log(`Retornando ${usuarios.length} funcionários`);

    // Mostrar detalhes dos funcionários retornados
    if (usuarios.length > 0) {
      console.log('Amostra dos funcionários retornados:');
      usuarios.slice(0, Math.min(5, usuarios.length)).forEach(u => {
        console.log(`- ${u.nome} (${u.role}): ${u.cargo} / ${u.departamento}`);
      });

      if (usuarios.length > 5) {
        console.log(`... e mais ${usuarios.length - 5} funcionários`);
      }
    }

    // Se for para avaliadores, verificar se há gerentes
    if (purpose === 'avaliadores') {
      console.log('Funcionários retornados para avaliadores:',
        usuarios.map(u => ({ id: u.id, nome: u.nome, role: u.role }))
      );
    }

    return NextResponse.json({
      success: true,
      data: usuarios,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Erro ao listar usuários:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
