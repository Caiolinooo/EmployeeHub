import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export const dynamic = 'force-dynamic';

// Função para processar o upload de arquivos
async function processUpload(req: NextRequest): Promise<{ fields: any; files: any }> {
  try {
    const formData = await req.formData();
    const fields: Record<string, string> = {};
    const files: Record<string, any> = {};

    // Processar cada campo do formData
    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        // É um arquivo
        const buffer = Buffer.from(await value.arrayBuffer());
        const filename = value.name;
        const mimetype = value.type;

        files[key] = {
          originalFilename: filename,
          filepath: '', // Será definido depois
          mimetype,
          size: buffer.length,
          buffer
        };
      } else {
        // É um campo normal
        fields[key] = value.toString();
      }
    }

    return { fields, files };
  } catch (error) {
    console.error('Erro ao processar upload:', error);
    throw error;
  }
}

// POST - Upload de arquivo
export async function POST(request: NextRequest) {
  try {
    // Verificar se o diretório de uploads existe
    const uploadDir = join(process.cwd(), 'public/uploads');
    try {
      await fs.access(uploadDir);
    } catch (error) {
      await mkdir(uploadDir, { recursive: true });
    }

    // Processar o upload
    const { fields, files } = await processUpload(request);

    // Verificar se há arquivos
    if (!files || Object.keys(files).length === 0) {
      return NextResponse.json(
        { error: 'Nenhum arquivo enviado' },
        { status: 400 }
      );
    }

    // Obter o tipo de arquivo
    const fileType = fields.type || 'document';

    // Criar um diretório específico para o tipo de arquivo
    const typeDir = join(uploadDir, fileType);
    try {
      await fs.access(typeDir);
    } catch (error) {
      await mkdir(typeDir, { recursive: true });
    }

    // Processar cada arquivo
    const uploadedFiles = [];
    for (const key in files) {
      const file = files[key];

      // Gerar um nome único para o arquivo
      const fileName = `${uuidv4()}-${file.originalFilename}`;

      // Salvar o arquivo no diretório específico
      const filePath = join(typeDir, fileName);
      await writeFile(filePath, file.buffer);

      // Atualizar o caminho do arquivo
      file.filepath = filePath;

      // Adicionar o arquivo à lista de arquivos enviados
      uploadedFiles.push({
        originalName: file.originalFilename,
        fileName,
        size: file.size,
        type: file.mimetype,
        url: `/uploads/${fileType}/${fileName}`,
      });
    }

    return NextResponse.json({
      message: 'Arquivo(s) enviado(s) com sucesso',
      files: uploadedFiles,
    });
  } catch (error) {
    console.error('Erro ao fazer upload de arquivo:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
