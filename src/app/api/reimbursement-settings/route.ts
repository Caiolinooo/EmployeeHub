import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET - Obter configurações de email de reembolso
export async function GET(request: NextRequest) {
  try {
    console.log('GET /api/reimbursement-settings - Iniciando busca de configurações');

    // Valores padrão para retornar em caso de erro
    const defaultSettings = {
      enableDomainRule: true,
      recipients: ['andresa.oliveira@groupabz.com', 'fiscal@groupabz.com']
    };

    try {
      // Verificar se a tabela settings existe
      const { data: tableCheck, error: tableError } = await supabaseAdmin
        .from('settings')
        .select('count(*)', { count: 'exact', head: true });

      // Se houver erro de tabela não existente
      if (tableError && tableError.code === '42P01') {
        console.error('Tabela settings não existe:', tableError);
        console.log('Tentando criar tabela settings usando API alternativa...');

        try {
          // Chamar a API que cria a tabela settings sem usar execute_sql
          const setupResponse = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL || ''}/api/setup-settings-table`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            }
          });

          const setupResult = await setupResponse.json();
          console.log('Resultado da tentativa de criar tabela:', setupResult);

          // Verificar se a tabela foi criada com sucesso
          if (setupResult.success) {
            console.log('Tabela settings criada com sucesso via API alternativa');

            // Tentar buscar as configurações novamente
            try {
              const { data: newData, error: newError } = await supabaseAdmin
                .from('settings')
                .select('*')
                .eq('key', 'reimbursement_email_settings')
                .single();

              if (!newError && newData) {
                console.log('Configurações encontradas após criar tabela:', newData.value);
                return NextResponse.json(newData.value);
              }
            } catch (retryError) {
              console.error('Erro ao buscar configurações após criar tabela:', retryError);
            }
          } else if (setupResult.localFile) {
            console.log('Configurações salvas em arquivo local:', setupResult.localFile);

            // Tentar ler o arquivo local
            try {
              const fs = await import('fs');
              const path = await import('path');

              const configFile = path.join(process.cwd(), 'src', 'config', 'reimbursementSettings.json');

              if (fs.existsSync(configFile)) {
                const localSettings = JSON.parse(fs.readFileSync(configFile, 'utf8'));
                console.log('Configurações lidas do arquivo local:', localSettings);
                return NextResponse.json(localSettings);
              }
            } catch (fsError) {
              console.error('Erro ao ler arquivo local:', fsError);
            }
          } else if (setupResult.manualInstructions) {
            console.log('Instruções para criação manual da tabela:', setupResult.manualInstructions);

            // Salvar as instruções em um arquivo para referência futura
            try {
              const fs = await import('fs');
              const path = await import('path');

              const instructionsDir = path.join(process.cwd(), 'logs');
              if (!fs.existsSync(instructionsDir)) {
                fs.mkdirSync(instructionsDir, { recursive: true });
              }

              const instructionsFile = path.join(instructionsDir, 'create_settings_table_instructions.sql');
              fs.writeFileSync(instructionsFile, setupResult.manualInstructions);

              console.log('Instruções salvas em:', instructionsFile);
            } catch (fsError) {
              console.error('Erro ao salvar instruções:', fsError);
            }
          }
        } catch (setupError) {
          console.error('Erro ao chamar API para criar tabela settings:', setupError);
        }

        // Criar arquivo de configuração local como fallback
        try {
          const fs = await import('fs');
          const path = await import('path');

          const configDir = path.join(process.cwd(), 'src', 'config');
          if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
          }

          const configFile = path.join(configDir, 'reimbursementSettings.json');

          // Verificar se o arquivo já existe
          if (!fs.existsSync(configFile)) {
            fs.writeFileSync(configFile, JSON.stringify(defaultSettings, null, 2));
            console.log('Arquivo de configuração local criado:', configFile);
          } else {
            console.log('Arquivo de configuração local já existe:', configFile);
          }
        } catch (fsError) {
          console.error('Erro ao criar arquivo de configuração local:', fsError);
        }

        // Retornar configurações padrão de qualquer forma
        return NextResponse.json(defaultSettings);
      }

      // Buscar configurações de email de reembolso
      const { data, error } = await supabaseAdmin
        .from('settings')
        .select('*')
        .eq('key', 'reimbursement_email_settings')
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Registro não encontrado, retornar valores padrão
          console.log('Configuração não encontrada, retornando valores padrão');

          // Tentar criar a configuração padrão em segundo plano
          try {
            const { data: insertData, error: insertError } = await supabaseAdmin
              .from('settings')
              .insert({
                key: 'reimbursement_email_settings',
                value: defaultSettings,
                description: 'Configurações de email para solicitações de reembolso'
              });

            if (insertError) {
              console.error('Erro ao criar configuração padrão:', insertError);
            } else {
              console.log('Configuração padrão criada com sucesso');
            }
          } catch (insertError) {
            console.error('Erro ao criar configuração padrão:', insertError);
          }

          return NextResponse.json(defaultSettings);
        }

        console.error('Erro ao buscar configurações de email de reembolso:', error);
        return NextResponse.json(defaultSettings);
      }

      // Retornar as configurações
      console.log('Configurações encontradas:', data.value);
      return NextResponse.json(data.value);
    } catch (dbError) {
      console.error('Erro ao acessar o banco de dados:', dbError);
      return NextResponse.json(defaultSettings);
    }
  } catch (error) {
    console.error('Erro ao processar requisição:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor';

    // Retornar valores padrão mesmo em caso de erro
    return NextResponse.json({
      enableDomainRule: true,
      recipients: ['andresa.oliveira@groupabz.com', 'fiscal@groupabz.com']
    });
  }
}

// POST - Criar ou atualizar configurações de email de reembolso
export async function POST(request: NextRequest) {
  try {
    console.log('POST /api/reimbursement-settings - Iniciando processamento');

    // Obter dados do corpo da requisição
    const body = await request.json();
    const { enableDomainRule, recipients } = body;

    console.log('Dados recebidos:', { enableDomainRule, recipients });

    // Validar os dados de entrada
    if (typeof enableDomainRule !== 'boolean' || !Array.isArray(recipients)) {
      console.error('Dados inválidos:', { enableDomainRule, recipients });
      return NextResponse.json(
        { error: 'Dados inválidos' },
        { status: 400 }
      );
    }

    try {
      // Verificar se a tabela settings existe
      const { data: tableCheck, error: tableError } = await supabaseAdmin
        .from('settings')
        .select('count(*)', { count: 'exact', head: true });

      // Se houver erro de tabela não existente
      if (tableError && tableError.code === '42P01') {
        console.error('Tabela settings não existe:', tableError);
        console.log('Tentando criar tabela settings usando API alternativa...');

        try {
          // Chamar a API que cria a tabela settings sem usar execute_sql
          const setupResponse = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL || ''}/api/setup-settings-table`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            }
          });

          const setupResult = await setupResponse.json();
          console.log('Resultado da tentativa de criar tabela:', setupResult);

          // Verificar se a tabela foi criada com sucesso
          if (setupResult.success) {
            console.log('Tabela settings criada com sucesso via API alternativa');

            // Tentar inserir as configurações novamente
            try {
              const { data: insertData, error: insertError } = await supabaseAdmin
                .from('settings')
                .insert({
                  key: 'reimbursement_email_settings',
                  value: { enableDomainRule, recipients },
                  description: 'Configurações de email para solicitações de reembolso'
                })
                .select()
                .single();

              if (!insertError) {
                console.log('Configurações inseridas com sucesso após criar tabela:', insertData);
                return NextResponse.json({
                  success: true,
                  data: insertData
                });
              } else {
                console.error('Erro ao inserir configurações após criar tabela:', insertError);
              }
            } catch (insertError) {
              console.error('Erro ao inserir configurações após criar tabela:', insertError);
            }
          } else if (setupResult.localFile) {
            console.log('Configurações salvas em arquivo local:', setupResult.localFile);

            // Salvar as configurações em um arquivo local
            try {
              const fs = await import('fs');
              const path = await import('path');

              const configDir = path.join(process.cwd(), 'src', 'config');
              if (!fs.existsSync(configDir)) {
                fs.mkdirSync(configDir, { recursive: true });
              }

              const configFile = path.join(configDir, 'reimbursementSettings.json');
              fs.writeFileSync(configFile, JSON.stringify({
                enableDomainRule,
                recipients
              }, null, 2));

              console.log('Configurações salvas em arquivo local:', configFile);

              return NextResponse.json({
                success: true,
                message: 'Configurações salvas em arquivo local',
                localFile: configFile
              });
            } catch (fsError) {
              console.error('Erro ao salvar configurações em arquivo local:', fsError);
            }
          }
        } catch (setupError) {
          console.error('Erro ao chamar API para criar tabela settings:', setupError);
        }

        // Criar arquivo de configuração local como fallback
        try {
          const fs = await import('fs');
          const path = await import('path');

          const configDir = path.join(process.cwd(), 'src', 'config');
          if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
          }

          const configFile = path.join(configDir, 'reimbursementSettings.json');
          fs.writeFileSync(configFile, JSON.stringify({
            enableDomainRule,
            recipients
          }, null, 2));

          console.log('Configurações salvas em arquivo local como fallback:', configFile);

          return NextResponse.json({
            success: true,
            message: 'Configurações salvas em arquivo local',
            localFile: configFile
          });
        } catch (fsError) {
          console.error('Erro ao salvar configurações em arquivo local:', fsError);
          return NextResponse.json(
            { error: `Erro ao salvar configurações: ${fsError instanceof Error ? fsError.message : String(fsError)}` },
            { status: 500 }
          );
        }
      }

      // Verificar se já existe um registro
      const { data: existingData, error: checkError } = await supabaseAdmin
        .from('settings')
        .select('id')
        .eq('key', 'reimbursement_email_settings')
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Erro ao verificar configurações existentes:', checkError);
        return NextResponse.json(
          { error: `Erro ao verificar configurações: ${checkError.message}` },
          { status: 500 }
        );
      }

      let result;

      if (existingData) {
        console.log('Atualizando configuração existente');
        // Atualizar registro existente
        const { data, error: updateError } = await supabaseAdmin
          .from('settings')
          .update({
            value: { enableDomainRule, recipients },
            updated_at: new Date().toISOString()
          })
          .eq('key', 'reimbursement_email_settings')
          .select()
          .single();

        if (updateError) {
          console.error('Erro ao atualizar configurações:', updateError);
          return NextResponse.json(
            { error: `Erro ao atualizar configurações: ${updateError.message}` },
            { status: 500 }
          );
        }

        result = data;
      } else {
        console.log('Criando nova configuração');
        // Criar novo registro
        const { data, error: insertError } = await supabaseAdmin
          .from('settings')
          .insert({
            key: 'reimbursement_email_settings',
            value: { enableDomainRule, recipients },
            description: 'Configurações de email para solicitações de reembolso'
          })
          .select()
          .single();

        if (insertError) {
          console.error('Erro ao criar configurações:', insertError);
          return NextResponse.json(
            { error: `Erro ao criar configurações: ${insertError.message}` },
            { status: 500 }
          );
        }

        result = data;
      }

      console.log('Configuração salva com sucesso:', result);

      // Retornar resultado
      return NextResponse.json({
        success: true,
        data: result
      });
    } catch (dbError) {
      console.error('Erro ao acessar o banco de dados:', dbError);
      return NextResponse.json(
        { error: `Erro ao acessar o banco de dados: ${dbError instanceof Error ? dbError.message : String(dbError)}` },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Erro ao processar requisição:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
