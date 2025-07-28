/**
 * Sistema de armazenamento temporário para anexos
 * Este módulo fornece funções para armazenar temporariamente os anexos de reembolso
 */

import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js';

// Tipos
interface FileData {
  nome: string;
  tipo: string;
  tamanho: number;
  buffer?: string; // Base64
  dados?: string; // Base64 ou outro formato
  url?: string;
  isLocalFile?: boolean;
  file?: any;
}

interface StoredFile {
  id: string;
  filename: string;
  path: string;
  contentType: string;
  size: number;
  createdAt: Date;
  metadata?: Record<string, any>;
}

/**
 * Armazena um arquivo temporariamente no sistema de arquivos
 * @param fileData Dados do arquivo
 * @param metadata Metadados adicionais
 * @returns Informações do arquivo armazenado ou null se não for possível armazenar
 */
export async function storeTemporaryFile(
  fileData: FileData,
  metadata: Record<string, any> = {}
): Promise<StoredFile | null> {
  console.log(`Armazenando arquivo temporário: ${fileData.nome}`);
  
  try {
    // Criar diretório temporário se não existir
    const tempDir = path.join(process.cwd(), 'temp-files');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Gerar ID único para o arquivo
    const fileId = uuidv4();
    
    // Sanitizar nome do arquivo
    const sanitizedFilename = fileData.nome.replace(/[^a-zA-Z0-9.-]/g, '_');
    
    // Criar nome de arquivo único
    const filename = `${fileId}_${sanitizedFilename}`;
    const filePath = path.join(tempDir, filename);
    
    // Extrair conteúdo do arquivo
    let fileBuffer: Buffer | null = null;
    
    // Tentar extrair do buffer base64
    if (fileData.buffer) {
      try {
        if (typeof fileData.buffer === 'string') {
          if (fileData.buffer.startsWith('data:')) {
            // Extrair dados da URL data:
            const matches = fileData.buffer.match(/^data:([^;]+);base64,(.+)$/);
            if (matches && matches.length === 3) {
              fileBuffer = Buffer.from(matches[2], 'base64');
            } else {
              console.error(`Formato inválido de data URL para ${fileData.nome}`);
            }
          } else {
            // Tentar como base64 direto
            fileBuffer = Buffer.from(fileData.buffer, 'base64');
          }
        } else if ((fileData as any).buffer instanceof ArrayBuffer) {
          fileBuffer = Buffer.from(fileData.buffer);
        }
      } catch (bufferError) {
        console.error(`Erro ao processar buffer para ${fileData.nome}:`, bufferError);
      }
    }
    
    // Se não conseguiu extrair do buffer, tentar dos dados
    if (!fileBuffer && fileData.dados) {
      try {
        if (typeof fileData.dados === 'string') {
          fileBuffer = Buffer.from(fileData.dados, 'base64');
        }
      } catch (dadosError) {
        console.error(`Erro ao processar dados para ${fileData.nome}:`, dadosError);
      }
    }
    
    // Se não conseguiu extrair do buffer nem dos dados, tentar baixar da URL
    if (!fileBuffer && fileData.url && !fileData.url.startsWith('blob:')) {
      try {
        if (fileData.url.startsWith('data:')) {
          // Extrair dados da URL data:
          const matches = fileData.url.match(/^data:([^;]+);base64,(.+)$/);
          if (matches && matches.length === 3) {
            fileBuffer = Buffer.from(matches[2], 'base64');
          } else {
            console.error(`Formato inválido de data URL para ${fileData.nome}`);
          }
        } else if (!fileData.isLocalFile) {
          // Tentar baixar do Supabase
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
          const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
          
          if (supabaseUrl && supabaseServiceKey) {
            const supabase = createClient(supabaseUrl, supabaseServiceKey, {
              auth: {
                autoRefreshToken: false,
                persistSession: false
              }
            });
            
            // Extrair o caminho do arquivo
            let filePath = fileData.url;
            if (filePath.includes('/')) {
              filePath = filePath.split('/').pop() || filePath;
            }
            
            // Tentar baixar o arquivo
            const { data, error } = await supabase
              .storage
              .from('comprovantes')
              .download(filePath);
            
            if (error) {
              console.error(`Erro ao baixar arquivo do Supabase: ${error.message}`);
              
              // Tentar obter URL público
              const { data: publicUrlData } = supabase
                .storage
                .from('comprovantes')
                .getPublicUrl(filePath);
              
              if (publicUrlData && publicUrlData.publicUrl) {
                const response = await fetch(publicUrlData.publicUrl);
                if (response.ok) {
                  const blob = await response.blob();
                  fileBuffer = Buffer.from(await blob.arrayBuffer());
                }
              }
            } else if (data) {
              fileBuffer = Buffer.from(await data.arrayBuffer());
            }
          }
        }
      } catch (urlError) {
        console.error(`Erro ao baixar arquivo da URL para ${fileData.nome}:`, urlError);
      }
    }
    
    // Se não conseguiu obter o conteúdo do arquivo, criar um arquivo de texto com informações
    if (!fileBuffer) {
      console.warn(`Não foi possível obter conteúdo para ${fileData.nome}, criando arquivo de texto com informações`);
      
      const infoContent = `
Informações do arquivo que não pôde ser processado:
Nome: ${fileData.nome}
Tipo: ${fileData.tipo}
Tamanho: ${fileData.tamanho ? `${(fileData.tamanho / 1024).toFixed(2)} KB` : 'Desconhecido'}
URL: ${fileData.url || 'Não disponível'}
É arquivo local: ${fileData.isLocalFile ? 'Sim' : 'Não'}
Tem buffer: ${fileData.buffer ? 'Sim' : 'Não'}
Tem dados: ${fileData.dados ? 'Sim' : 'Não'}
Data e hora: ${new Date().toLocaleString('pt-BR')}
Metadados: ${JSON.stringify(metadata, null, 2)}
      `;
      
      fileBuffer = Buffer.from(infoContent);
    }
    
    // Salvar o arquivo
    fs.writeFileSync(filePath, fileBuffer);
    
    // Retornar informações do arquivo armazenado
    const storedFile: StoredFile = {
      id: fileId,
      filename: sanitizedFilename,
      path: filePath,
      contentType: fileData.tipo || 'application/octet-stream',
      size: fileBuffer.length,
      createdAt: new Date(),
      metadata
    };
    
    console.log(`Arquivo temporário armazenado com sucesso: ${filePath} (${fileBuffer.length} bytes)`);
    return storedFile;
    
  } catch (error) {
    console.error(`Erro ao armazenar arquivo temporário: ${fileData.nome}`, error);
    return null;
  }
}

/**
 * Limpa arquivos temporários antigos
 * @param maxAgeHours Idade máxima dos arquivos em horas (padrão: 24)
 * @returns Número de arquivos removidos
 */
export function cleanupTemporaryFiles(maxAgeHours: number = 24): number {
  try {
    const tempDir = path.join(process.cwd(), 'temp-files');
    if (!fs.existsSync(tempDir)) {
      return 0;
    }
    
    const now = new Date();
    const files = fs.readdirSync(tempDir);
    let removedCount = 0;
    
    for (const file of files) {
      const filePath = path.join(tempDir, file);
      const stats = fs.statSync(filePath);
      
      // Verificar se o arquivo é mais antigo que maxAgeHours
      const fileAge = (now.getTime() - stats.mtime.getTime()) / (1000 * 60 * 60);
      if (fileAge > maxAgeHours) {
        fs.unlinkSync(filePath);
        removedCount++;
      }
    }
    
    console.log(`Limpeza de arquivos temporários: ${removedCount} arquivos removidos`);
    return removedCount;
  } catch (error) {
    console.error('Erro ao limpar arquivos temporários:', error);
    return 0;
  }
}
