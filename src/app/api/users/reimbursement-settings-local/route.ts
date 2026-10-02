import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { resolveInside } from '@/lib/path-safe';

export const dynamic = 'force-dynamic';

type UserConfigPathResult =
  | { ok: true; path: string }
  | { ok: false; error: string };

function getUserConfigPath(userId: string): UserConfigPathResult {
  const configDir = path.resolve(process.cwd(), 'src', 'config', 'users');
  const inside = resolveInside(configDir, `${userId}.json`, { asName: true });
  if (!inside.ok) {
    return inside;
  }

  // Criar diretório se não existir
  if (!fs.existsSync(configDir)) {
    try {
      fs.mkdirSync(configDir, { recursive: true });
      console.log(`Diretório criado: ${configDir}`);
    } catch (mkdirError) {
      console.error(`Erro ao criar diretório ${configDir}:`, mkdirError);
      // Tentar criar diretórios pai um por um
      const parts = configDir.split(path.sep);
      let currentPath = '';

      for (const part of parts) {
        if (!part) continue; // Ignorar partes vazias

        currentPath = currentPath ? path.join(currentPath, part) : part;

        if (!fs.existsSync(currentPath)) {
          try {
            fs.mkdirSync(currentPath);
            console.log(`Diretório criado: ${currentPath}`);
          } catch (error) {
            console.error(`Erro ao criar diretório ${currentPath}:`, error);
          }
        }
      }
    }
  }

  return { ok: true, path: inside.resolved };
}

// Função para obter o caminho do arquivo de mapeamento de email para ID
function getEmailMappingPath() {
  const configDir = path.join(process.cwd(), 'src', 'config');

  // Criar diretório se não existir
  if (!fs.existsSync(configDir)) {
    try {
      fs.mkdirSync(configDir, { recursive: true });
      console.log(`Diretório criado: ${configDir}`);
    } catch (mkdirError) {
      console.error(`Erro ao criar diretório ${configDir}:`, mkdirError);
      // Tentar criar diretórios pai um por um
      const parts = configDir.split(path.sep);
      let currentPath = '';

      for (const part of parts) {
        if (!part) continue; // Ignorar partes vazias

        currentPath = currentPath ? path.join(currentPath, part) : part;

        if (!fs.existsSync(currentPath)) {
          try {
            fs.mkdirSync(currentPath);
            console.log(`Diretório criado: ${currentPath}`);
          } catch (error) {
            console.error(`Erro ao criar diretório ${currentPath}:`, error);
          }
        }
      }
    }
  }

  const mappingPath = path.join(configDir, 'emailToUserId.json');

  // Criar arquivo de mapeamento se não existir
  if (!fs.existsSync(mappingPath)) {
    try {
      fs.writeFileSync(mappingPath, '{}');
      console.log(`Arquivo de mapeamento criado: ${mappingPath}`);
    } catch (writeError) {
      console.error(`Erro ao criar arquivo de mapeamento ${mappingPath}:`, writeError);
    }
  }

  return mappingPath;
}

// Função para obter ID do usuário a partir do email
function getUserIdByEmail(email: string) {
  const mappingPath = getEmailMappingPath();

  if (!fs.existsSync(mappingPath)) {
    return null;
  }

  try {
    const mappingData = fs.readFileSync(mappingPath, 'utf8');
    const mapping = JSON.parse(mappingData);
    return mapping[email] || null;
  } catch (error) {
    console.error('Erro ao ler mapeamento de email para ID:', error);
    return null;
  }
}

// Função para salvar mapeamento de email para ID
function saveEmailMapping(email: string, userId: string) {
  const mappingPath = getEmailMappingPath();

  let mapping = {};

  if (fs.existsSync(mappingPath)) {
    try {
      const mappingData = fs.readFileSync(mappingPath, 'utf8');
      mapping = JSON.parse(mappingData);
    } catch (error) {
      console.error('Erro ao ler mapeamento existente:', error);
    }
  }

  (mapping as any)[email] = userId;

  fs.writeFileSync(mappingPath, JSON.stringify(mapping, null, 2));
}

// POST - Atualizar configurações de email de reembolso de um usuário
export async function POST(request: NextRequest) {
  try {
    console.log('POST /api/users/reimbursement-settings-local - Iniciando processamento');

    // Obter dados do corpo da requisição
    const body = await request.json();
    console.log('Dados recebidos:', body);

    const { userId, email, enabled, recipients } = body;

    // Validar os dados de entrada
    if ((!userId && !email) || typeof enabled !== 'boolean' || !Array.isArray(recipients)) {
      console.error('Dados inválidos:', { userId, email, enabled, recipients });
      return NextResponse.json(
        { error: 'Dados inválidos' },
        { status: 400 }
      );
    }

    // Determinar ID do usuário
    let userIdToUse = userId;

    if (!userIdToUse && email) {
      userIdToUse = getUserIdByEmail(email);

      if (!userIdToUse) {
        // Gerar ID seguro para o usuário
        const { randomUUID } = await import('crypto');
        userIdToUse = randomUUID();

        // Salvar mapeamento de email para ID
        saveEmailMapping(email, userIdToUse);
      }
    }

    const configPathResult = getUserConfigPath(userIdToUse);
    if (!configPathResult.ok) {
      return NextResponse.json(
        { error: configPathResult.error },
        { status: 400 }
      );
    }
    const configPath = configPathResult.path;

    // Salvar configurações
    const settings = { enabled, recipients };

    try {
      fs.writeFileSync(configPath, JSON.stringify(settings, null, 2));
      console.log('Configurações salvas com sucesso em %s', configPath);
    } catch (writeError) {
      console.error('Erro ao escrever arquivo %s:', configPath, writeError);
      throw new Error(`Erro ao salvar configurações: ${writeError instanceof Error ? writeError.message : 'Erro desconhecido'}`);
    }

    // Retornar resultado
    return NextResponse.json({
      success: true,
      data: {
        id: userIdToUse,
        email: email || 'unknown',
        reimbursement_email_settings: settings
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

// GET - Obter configurações de email de reembolso de um usuário
export async function GET(request: NextRequest) {
  try {
    console.log('GET /api/users/reimbursement-settings-local - Iniciando processamento');

    // Obter ID do usuário da URL
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const email = searchParams.get('email');

    console.log('Parâmetros recebidos:', { userId, email });

    if (!userId && !email) {
      console.error('Nenhum parâmetro fornecido');
      return NextResponse.json(
        { error: 'É necessário fornecer userId ou email' },
        { status: 400 }
      );
    }

    // Determinar ID do usuário
    let userIdToUse = userId;

    if (!userIdToUse && email) {
      userIdToUse = getUserIdByEmail(email);

      if (!userIdToUse) {
        // Retornar configurações padrão se o usuário não for encontrado
        return NextResponse.json({
          id: null,
          email: email,
          reimbursement_email_settings: {
            enabled: false,
            recipients: []
          }
        });
      }
    }

    const configPathResult = getUserConfigPath(userIdToUse || '');
    if (!configPathResult.ok) {
      return NextResponse.json(
        { error: configPathResult.error },
        { status: 400 }
      );
    }
    const configPath = configPathResult.path;
    console.log('Verificando arquivo de configuração em %s', configPath);

    // Verificar se o arquivo existe
    if (!fs.existsSync(configPath)) {
      console.log(`Arquivo não encontrado, retornando configurações padrão`);
      // Retornar configurações padrão se o arquivo não existir
      return NextResponse.json({
        id: userIdToUse,
        email: email || 'unknown',
        reimbursement_email_settings: {
          enabled: false,
          recipients: []
        }
      });
    }

    try {
      // Ler arquivo de configuração
      const configData = fs.readFileSync(configPath, 'utf8');
      const settings = JSON.parse(configData);
      console.log(`Configurações carregadas com sucesso:`, settings);

      // Retornar configurações
      return NextResponse.json({
        id: userIdToUse,
        email: email || 'unknown',
        reimbursement_email_settings: settings
      });
    } catch (readError) {
      console.error('Erro ao ler arquivo %s:', configPath, readError);
      // Retornar configurações padrão em caso de erro
      return NextResponse.json({
        id: userIdToUse,
        email: email || 'unknown',
        reimbursement_email_settings: {
          enabled: false,
          recipients: []
        },
        error: `Erro ao ler configurações: ${readError instanceof Error ? readError.message : 'Erro desconhecido'}`
      });
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
