import { NextRequest, NextResponse } from 'next/server';
import { initAvaliacaoModule } from '@/lib/avaliacao-module';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * Rota para importar funcionários para o módulo de avaliação de desempenho
 */
export async function POST(request: NextRequest) {
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

    // Inicializar o módulo
    const avaliacaoModule = await initAvaliacaoModule();

    // Obter dados do corpo da requisição
    const data = await request.json();

    console.log('Dados recebidos para importação:', JSON.stringify(data));

    if (!data || !Array.isArray(data.funcionarios) || data.funcionarios.length === 0) {
      return NextResponse.json(
        { error: 'Dados inválidos. É necessário fornecer um array de funcionários.' },
        { status: 400 }
      );
    }

    // Verificar o tipo de importação
    const importType = data.type || 'funcionarios';

    // Se for importação de avaliações, verificar se os campos necessários estão presentes
    if (importType === 'avaliacoes') {
      // Para avaliações, não precisamos do campo 'nome', mas sim dos IDs de funcionário e avaliador
      // Verificar se pelo menos um funcionário tem os campos necessários
      const hasRequiredFields = data.funcionarios.some(
        (f: any) => f.funcionarioId || f.avaliadorId || f.periodo || f.dataAvaliacao
      );

      if (!hasRequiredFields) {
        return NextResponse.json(
          {
            error: 'Dados de avaliação inválidos. Verifique se os campos obrigatórios (funcionarioId, avaliadorId, periodo, dataAvaliacao) estão presentes.',
            details: 'Verifique o mapeamento de campos na tela de importação.'
          },
          { status: 400 }
        );
      }
    }

    // Processar funcionários e registrá-los no sistema
    const funcionarios = data.funcionarios;
    const resultados = {
      total: funcionarios.length,
      imported: 0,
      errors: 0,
      skipped: 0,
      details: [] as any[]
    };

    // Importar para o módulo de avaliação com base no tipo
    let resultadoModulo;
    if (importType === 'avaliacoes') {
      // Para avaliações, apenas importar para o módulo sem registrar usuários
      resultadoModulo = await avaliacaoModule.importAvaliacoes(funcionarios);

      // Retornar resultado sem tentar registrar usuários
      return NextResponse.json({
        success: true,
        message: 'Importação de avaliações concluída com sucesso',
        resultado: resultados,
        resultadoModulo,
        timestamp: new Date().toISOString()
      });
    } else {
      // Para funcionários, importar para o módulo e depois registrar no sistema
      resultadoModulo = await avaliacaoModule.importFuncionarios(funcionarios);
    }

    // Depois, registrar os funcionários no sistema principal (users_unified)
    for (const funcionario of funcionarios) {
      try {
        // Verificar se já existe um usuário com o mesmo email
        let existingUser = null;

        if (funcionario.email) {
          const { data: userByEmail } = await supabaseAdmin
            .from('users_unified')
            .select('*')
            .eq('email', funcionario.email)
            .single();

          if (userByEmail) {
            existingUser = userByEmail;
            resultados.skipped++;
            resultados.details.push({
              user: funcionario,
              action: 'skipped',
              reason: 'duplicate_email'
            });
            continue;
          }
        }

        // Verificar se já existe um usuário com o mesmo telefone
        if (funcionario.telefone) {
          const { data: userByPhone } = await supabaseAdmin
            .from('users_unified')
            .select('*')
            .eq('phone_number', funcionario.telefone)
            .single();

          if (userByPhone) {
            existingUser = userByPhone;
            resultados.skipped++;
            resultados.details.push({
              user: funcionario,
              action: 'skipped',
              reason: 'duplicate_phone'
            });
            continue;
          }
        }

        // Se não existir, criar um novo usuário
        if (!existingUser) {
          // Verificar se o nome existe antes de tentar dividi-lo
          if (!funcionario.nome) {
            throw new Error(`Campo obrigatório 'nome' não encontrado para o funcionário. Verifique o mapeamento de campos.`);
          }

          // Dividir o nome em primeiro nome e sobrenome
          const nameParts = funcionario.nome.split(' ');
          const firstName = nameParts[0] || '';
          const lastName = nameParts.slice(1).join(' ') || '';

          // Verificar outros campos obrigatórios
          if (!funcionario.email && !funcionario.telefone) {
            throw new Error(`Pelo menos um dos campos 'email' ou 'telefone' é obrigatório para o funcionário ${funcionario.nome}.`);
          }

          const { data: newUser, error: insertError } = await supabaseAdmin
            .from('users_unified')
            .insert({
              first_name: firstName,
              last_name: lastName,
              email: funcionario.email || null,
              phone_number: funcionario.telefone || null,
              department: funcionario.departamento || null,
              position: funcionario.cargo || null,
              role: 'USER',
              active: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .select()
            .single();

          if (insertError) {
            throw new Error(`Erro ao criar usuário: ${insertError.message}`);
          }

          resultados.imported++;
          resultados.details.push({
            user: funcionario,
            action: 'created',
            userId: newUser.id
          });
        }
      } catch (error) {
        console.error('Erro ao processar funcionário:', error);
        resultados.errors++;
        resultados.details.push({
          user: funcionario,
          action: 'error',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Importação concluída com sucesso',
      resultado: resultados,
      resultadoModulo,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Erro ao importar funcionários:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
