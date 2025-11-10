import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

/**
 * API route para gerenciar configurações de reembolso usando arquivo local
 * Esta é uma alternativa para quando o banco de dados Supabase não está disponível
 */

// GET - Obter configurações de email de reembolso do arquivo local
export async function GET(request: NextRequest) {
  try {
    console.log('GET /api/reimbursement-settings-fallback - Iniciando busca de configurações');
    
    // Valores padrão para retornar em caso de erro
    const defaultSettings = {
      enableDomainRule: true,
      recipients: ['andresa.oliveira@groupabz.com', 'fiscal@groupabz.com']
    };
    
    // Caminho para o arquivo de configuração
    const configFile = path.join(process.cwd(), 'src', 'config', 'reimbursementSettings.json');
    
    // Verificar se o arquivo existe
    if (!fs.existsSync(configFile)) {
      console.log('Arquivo de configuração não encontrado, criando com valores padrão');
      
      // Criar diretório se não existir
      const configDir = path.join(process.cwd(), 'src', 'config');
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      
      // Criar arquivo com valores padrão
      fs.writeFileSync(configFile, JSON.stringify(defaultSettings, null, 2));
      
      return NextResponse.json(defaultSettings);
    }
    
    // Ler arquivo de configuração
    try {
      const fileContent = fs.readFileSync(configFile, 'utf8');
      const settings = JSON.parse(fileContent);
      
      console.log('Configurações lidas do arquivo local:', settings);
      return NextResponse.json(settings);
    } catch (parseError) {
      console.error('Erro ao ler arquivo de configuração:', parseError);
      
      // Em caso de erro, retornar valores padrão
      return NextResponse.json(defaultSettings);
    }
  } catch (error) {
    console.error('Erro ao processar requisição:', error);
    
    // Em caso de erro, retornar valores padrão
    return NextResponse.json({
      enableDomainRule: true,
      recipients: ['andresa.oliveira@groupabz.com', 'fiscal@groupabz.com']
    });
  }
}

// POST - Criar ou atualizar configurações de email de reembolso no arquivo local
export async function POST(request: NextRequest) {
  try {
    console.log('POST /api/reimbursement-settings-fallback - Iniciando processamento');
    
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
    
    // Caminho para o arquivo de configuração
    const configDir = path.join(process.cwd(), 'src', 'config');
    const configFile = path.join(configDir, 'reimbursementSettings.json');
    
    // Criar diretório se não existir
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    // Salvar configurações no arquivo
    fs.writeFileSync(configFile, JSON.stringify({
      enableDomainRule,
      recipients
    }, null, 2));
    
    console.log('Configurações salvas em arquivo local:', configFile);
    
    // Retornar resultado
    return NextResponse.json({
      success: true,
      message: 'Configurações salvas com sucesso',
      data: {
        key: 'reimbursement_email_settings',
        value: { enableDomainRule, recipients },
        description: 'Configurações de email para solicitações de reembolso'
      }
    });
  } catch (error) {
    console.error('Erro ao processar requisição:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
