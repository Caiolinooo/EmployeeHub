import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

// GET - Obter configurações de email de reembolso do arquivo local
export async function GET(request: NextRequest) {
  try {
    // Caminho para o arquivo de configuração
    const configFile = path.join(process.cwd(), 'src', 'config', 'reimbursementSettings.json');

    // Verificar se o arquivo existe
    if (!fs.existsSync(configFile)) {
      // Retornar valores padrão se o arquivo não existir
      return NextResponse.json({
        enableDomainRule: true,
        recipients: ['andresa.oliveira@groupabz.com', 'fiscal@groupabz.com']
      });
    }

    // Ler arquivo de configuração
    const configData = fs.readFileSync(configFile, 'utf8');
    const config = JSON.parse(configData);

    // Retornar configurações
    return NextResponse.json(config);
  } catch (error) {
    console.error('Erro ao processar requisição:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// POST - Criar ou atualizar configurações de email de reembolso no arquivo local
export async function POST(request: NextRequest) {
  try {
    // Obter dados do corpo da requisição
    const body = await request.json();
    const { enableDomainRule, recipients } = body;

    // Validar os dados de entrada
    if (typeof enableDomainRule !== 'boolean' || !Array.isArray(recipients)) {
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

    // Salvar configuração em arquivo
    fs.writeFileSync(configFile, JSON.stringify({ enableDomainRule, recipients }, null, 2));

    // Retornar resultado
    return NextResponse.json({
      success: true,
      data: { enableDomainRule, recipients }
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