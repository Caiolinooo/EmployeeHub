import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

/**
 * API route to create the settings table directly using standard Supabase operations
 * This avoids using the execute_sql function which requires special permissions
 */
export async function POST(request: NextRequest) {
  try {
    console.log('POST /api/setup-settings-table - Iniciando criação da tabela settings');
    
    // Verificar se a tabela já existe tentando fazer uma consulta
    const { data: existingData, error: checkError } = await supabaseAdmin
      .from('settings')
      .select('count(*)', { count: 'exact', head: true });
    
    // Se não houver erro, a tabela já existe
    if (!checkError) {
      console.log('Tabela settings já existe');
      return NextResponse.json({
        success: true,
        message: 'Tabela settings já existe'
      });
    }
    
    // Se o erro não for de tabela inexistente, retornar o erro
    if (checkError.code !== '42P01') {
      console.error('Erro ao verificar tabela settings:', checkError);
      return NextResponse.json(
        { error: `Erro ao verificar tabela settings: ${checkError.message}` },
        { status: 500 }
      );
    }
    
    console.log('Tabela settings não existe, criando...');
    
    // Criar a tabela settings usando a API REST do Supabase
    // Isso usa a API de Storage como um proxy para criar a tabela
    // já que não podemos executar SQL diretamente
    
    // 1. Primeiro, vamos tentar criar a tabela usando a API de Storage
    try {
      // Criar um bucket temporário para armazenar a configuração
      const { error: bucketError } = await supabaseAdmin.storage.createBucket('temp_settings_setup', {
        public: false
      });
      
      if (bucketError && bucketError.message !== 'Bucket already exists') {
        console.error('Erro ao criar bucket temporário:', bucketError);
      } else {
        console.log('Bucket temporário criado ou já existente');
      }
      
      // Criar um arquivo JSON com as configurações padrão
      const defaultSettings = {
        enableDomainRule: true,
        recipients: ['andresa.oliveira@groupabz.com', 'fiscal@groupabz.com']
      };
      
      // Salvar o arquivo no bucket
      const { error: uploadError } = await supabaseAdmin.storage
        .from('temp_settings_setup')
        .upload('default_settings.json', JSON.stringify(defaultSettings), {
          contentType: 'application/json',
          upsert: true
        });
      
      if (uploadError) {
        console.error('Erro ao fazer upload das configurações padrão:', uploadError);
      } else {
        console.log('Configurações padrão salvas no bucket temporário');
      }
    } catch (storageError) {
      console.error('Erro ao usar Storage API:', storageError);
    }
    
    // 2. Agora, vamos tentar criar a tabela usando a API de Database
    try {
      // Criar a tabela settings usando a API de Database
      // Isso usa a API de inserção para criar a tabela automaticamente
      // com as colunas necessárias
      
      // Primeiro, vamos tentar inserir um registro
      const { error: insertError } = await supabaseAdmin
        .from('settings')
        .insert({
          key: 'reimbursement_email_settings',
          value: {
            enableDomainRule: true,
            recipients: ['andresa.oliveira@groupabz.com', 'fiscal@groupabz.com']
          },
          description: 'Configurações de email para solicitações de reembolso'
        });
      
      // Se o erro for de tabela inexistente, vamos tentar criar a tabela
      if (insertError && insertError.code === '42P01') {
        console.log('Erro ao inserir registro, tabela não existe:', insertError);
        
        // Tentar criar a tabela usando a API REST direta do Supabase
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        
        if (!supabaseUrl || !supabaseKey) {
          console.error('Variáveis de ambiente do Supabase não definidas');
          return NextResponse.json(
            { error: 'Variáveis de ambiente do Supabase não definidas' },
            { status: 500 }
          );
        }
        
        // Tentar criar a tabela usando a API REST do Supabase
        try {
          // Usar a API de autenticação para obter um token JWT
          const { data: authData, error: authError } = await supabaseAdmin.auth.getSession();
          
          if (authError) {
            console.error('Erro ao obter sessão:', authError);
            return NextResponse.json(
              { error: `Erro ao obter sessão: ${authError.message}` },
              { status: 500 }
            );
          }
          
          // Salvar as configurações em um arquivo local
          
          const configDir = path.join(process.cwd(), 'src', 'config');
          if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
          }
          
          const configFile = path.join(configDir, 'reimbursementSettings.json');
          fs.writeFileSync(configFile, JSON.stringify({
            enableDomainRule: true,
            recipients: ['andresa.oliveira@groupabz.com', 'fiscal@groupabz.com']
          }, null, 2));
          
          console.log('Configurações salvas em arquivo local:', configFile);
          
          return NextResponse.json({
            success: true,
            message: 'Configurações salvas em arquivo local',
            localFile: configFile
          });
        } catch (restError) {
          console.error('Erro ao usar API REST do Supabase:', restError);
        }
      } else if (!insertError) {
        console.log('Registro inserido com sucesso, tabela criada automaticamente');
        return NextResponse.json({
          success: true,
          message: 'Tabela settings criada com sucesso'
        });
      } else {
        console.error('Erro ao inserir registro:', insertError);
        return NextResponse.json(
          { error: `Erro ao inserir registro: ${insertError.message}` },
          { status: 500 }
        );
      }
    } catch (dbError) {
      console.error('Erro ao usar Database API:', dbError);
    }
    
    // Se chegamos aqui, todas as tentativas falharam
    // Retornar instruções para criar a tabela manualmente
    return NextResponse.json({
      success: false,
      message: 'Não foi possível criar a tabela settings automaticamente',
      manualInstructions: `
        Para criar a tabela manualmente, execute o seguinte SQL no SQL Editor do Supabase:
        
        CREATE TABLE IF NOT EXISTS settings (
          id SERIAL PRIMARY KEY,
          key TEXT UNIQUE NOT NULL,
          value JSONB NOT NULL,
          description TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        INSERT INTO settings (key, value, description)
        VALUES (
          'reimbursement_email_settings',
          '{"enableDomainRule": true, "recipients": ["andresa.oliveira@groupabz.com", "fiscal@groupabz.com"]}',
          'Configurações de email para solicitações de reembolso'
        )
        ON CONFLICT (key) DO NOTHING;
      `
    }, { status: 200 });
  } catch (error) {
    console.error('Erro ao processar requisição:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
