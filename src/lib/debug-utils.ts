/**
 * Utilitários para debug do sistema de reembolso
 */

import fs from 'fs';
import path from 'path';
import { resolveInside } from '@/lib/path-safe';

/**
 * Salva um buffer em um arquivo para debug
 * @param buffer Buffer a ser salvo
 * @param filename Nome do arquivo
 * @param prefix Prefixo para o nome do arquivo
 * @returns Caminho do arquivo salvo
 */
export function saveBufferToFile(buffer: Buffer, filename: string, prefix: string = 'debug'): string {
  try {
    // Criar diretório de debug se não existir
    const debugDir = path.join(process.cwd(), 'debug');
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }

    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const sanitizedPrefix = prefix.replace(/[^a-zA-Z0-9.-]/g, '_');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const debugFilename = `${sanitizedPrefix}_${timestamp}_${sanitizedFilename}`;
    const inside = resolveInside(debugDir, debugFilename, { asName: true });
    if (!inside.ok) {
      console.error('Caminho de debug rejeitado:', inside.error);
      return '';
    }

    fs.writeFileSync(inside.resolved, buffer);
    
    console.log('Arquivo de debug salvo em: %s', inside.resolved);
    return inside.resolved;
  } catch (error) {
    console.error('Erro ao salvar arquivo de debug:', error);
    return '';
  }
}

/**
 * Salva um anexo de email em um arquivo para debug
 * @param attachment Anexo de email
 * @param prefix Prefixo para o nome do arquivo
 * @returns Caminho do arquivo salvo
 */
export function saveAttachmentToFile(
  attachment: { filename: string; content?: Buffer | string; path?: string; contentType?: string },
  prefix: string = 'attachment'
): string {
  try {
    if (attachment.content) {
      // Se o conteúdo for um Buffer, salvar diretamente
      if (Buffer.isBuffer(attachment.content)) {
        return saveBufferToFile(attachment.content, attachment.filename, prefix);
      }
      
      // Se o conteúdo for uma string, converter para Buffer
      if (typeof attachment.content === 'string') {
        return saveBufferToFile(Buffer.from(attachment.content), attachment.filename, prefix);
      }
    }
    
    // Se tiver um caminho, copiar o arquivo
    if (attachment.path && fs.existsSync(attachment.path)) {
      const content = fs.readFileSync(attachment.path);
      return saveBufferToFile(content, attachment.filename, prefix);
    }
    
    console.error('Anexo não tem conteúdo ou caminho válido:', attachment.filename);
    return '';
  } catch (error) {
    console.error('Erro ao salvar anexo para debug:', error);
    return '';
  }
}

/**
 * Salva todos os anexos de email em arquivos para debug
 * @param attachments Lista de anexos
 * @param prefix Prefixo para os nomes dos arquivos
 * @returns Lista de caminhos dos arquivos salvos
 */
export function saveAttachmentsToFiles(
  attachments: Array<{ filename: string; content?: Buffer | string; path?: string; contentType?: string }>,
  prefix: string = 'attachments'
): string[] {
  const savedPaths: string[] = [];
  
  if (!attachments || attachments.length === 0) {
    console.log('Nenhum anexo para salvar');
    return savedPaths;
  }
  
  console.log(`Salvando ${attachments.length} anexos para debug...`);
  
  attachments.forEach((attachment, index) => {
    const indexedPrefix = `${prefix}_${index + 1}`;
    const savedPath = saveAttachmentToFile(attachment, indexedPrefix);
    if (savedPath) {
      savedPaths.push(savedPath);
    }
  });
  
  console.log(`${savedPaths.length} anexos salvos para debug`);
  return savedPaths;
}
