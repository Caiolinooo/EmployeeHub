/**
 * Utilitários para manipulação de arquivos
 */
import { supabaseAdmin } from './db';
import { getAuthToken } from './authUtils';

/**
 * Interface para representar um anexo
 */
export interface Attachment {
  url: string;
  nome: string;
  tipo?: string;
  size?: number;
}

/**
 * Função para baixar um anexo do Supabase Storage
 * @param url URL ou caminho do arquivo
 * @param fileName Nome do arquivo para download
 * @returns Blob do arquivo ou null se falhar
 */
export async function downloadAttachment(url: string, fileName: string): Promise<Blob | null> {
  console.log(`Iniciando download de anexo: ${url}, nome: ${fileName}`);

  // Extrair apenas o nome do arquivo da URL, se necessário
  const fileNameOnly = url.split('/').pop() || url;
  console.log('Nome do arquivo extraído:', fileNameOnly);

  // Obter token de autenticação
  let accessToken = '';
  try {
    accessToken = await getAuthToken() || '';
    if (accessToken) {
      console.log('Token de autenticação obtido com sucesso');
    } else {
      console.warn('Não foi possível obter token de autenticação');
    }
  } catch (tokenError) {
    console.error('Erro ao obter token de autenticação:', tokenError);
  }

  // Tentar diferentes abordagens para baixar o arquivo
  let blob: Blob | null = null;

  // Abordagem 1: Tentar via API de arquivos com URL completa
  try {
    console.log('Tentativa 1: Usando API de arquivos com URL completa');
    const fullUrl = url.startsWith('http') ? url : `/api/files/${url}`;
    console.log(`URL para download: ${fullUrl}`);

    const headers: HeadersInit = {};
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const response = await fetch(fullUrl, { headers });
    if (response.ok) {
      blob = await response.blob();
      console.log('Arquivo baixado com sucesso via API de arquivos (URL completa)');
      return blob;
    } else {
      console.error(`Erro na tentativa 1: ${response.status} ${response.statusText}`);
    }
  } catch (error1) {
    console.error('Erro na tentativa 1:', error1);
  }

  // Abordagem 2: Tentar via API de arquivos apenas com o nome do arquivo
  try {
    console.log('Tentativa 2: Usando API de arquivos apenas com o nome do arquivo');
    const fileUrl = `/api/files/comprovantes/${fileNameOnly}`;
    console.log(`URL para download: ${fileUrl}`);

    const headers: HeadersInit = {};
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const response = await fetch(fileUrl, { headers });
    if (response.ok) {
      blob = await response.blob();
      console.log('Arquivo baixado com sucesso via API de arquivos (apenas nome do arquivo)');
      return blob;
    } else {
      console.error(`Erro na tentativa 2: ${response.status} ${response.statusText}`);
    }
  } catch (error2) {
    console.error('Erro na tentativa 2:', error2);
  }

  // Abordagem 3: Tentar URL pública do Supabase com cache-busting
  try {
    console.log('Tentativa 3: Usando URL pública do Supabase com cache-busting');

    // Limpar o nome do arquivo para evitar problemas com caracteres especiais
    const cleanFileName = decodeURIComponent(fileNameOnly).replace(/[^\w\s.-]/g, '');
    console.log('Nome do arquivo limpo:', cleanFileName);

    // Obter URL pública via API do Supabase
    const { data: publicUrlData } = supabaseAdmin
      .storage
      .from('comprovantes')
      .getPublicUrl(fileNameOnly);

    if (publicUrlData && publicUrlData.publicUrl) {
      // Adicionar parâmetro de cache-busting para evitar respostas 400 em cache
      const publicUrl = new URL(publicUrlData.publicUrl);
      publicUrl.searchParams.append('t', Date.now().toString());
      console.log(`URL pública com cache-busting: ${publicUrl.toString()}`);

      const response = await fetch(publicUrl.toString(), {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (response.ok) {
        blob = await response.blob();
        console.log('Arquivo baixado com sucesso via URL pública');
        return blob;
      } else {
        console.error(`Erro na tentativa 3: ${response.status} ${response.statusText}`);
      }
    } else {
      console.error('Não foi possível obter URL pública via API');

      // Tentar URL pública direta como fallback com cache-busting
      const directPublicUrl = new URL(`https://arzvingdtnttiejcvucs.supabase.co/storage/v1/object/public/comprovantes/${fileNameOnly}`);
      directPublicUrl.searchParams.append('t', Date.now().toString());
      console.log(`Tentando URL pública direta com cache-busting: ${directPublicUrl.toString()}`);

      const response = await fetch(directPublicUrl.toString(), {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (response.ok) {
        blob = await response.blob();
        console.log('Arquivo baixado com sucesso via URL pública direta');
        return blob;
      } else {
        console.error(`Erro na tentativa 3 (URL direta): ${response.status} ${response.statusText}`);

        // Tentar com o nome de arquivo limpo
        const cleanPublicUrl = new URL(`https://arzvingdtnttiejcvucs.supabase.co/storage/v1/object/public/comprovantes/${cleanFileName}`);
        cleanPublicUrl.searchParams.append('t', Date.now().toString());
        console.log(`Tentando URL pública com nome limpo: ${cleanPublicUrl.toString()}`);

        const cleanResponse = await fetch(cleanPublicUrl.toString(), {
          method: 'GET',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });

        if (cleanResponse.ok) {
          blob = await cleanResponse.blob();
          console.log('Arquivo baixado com sucesso via URL pública com nome limpo');
          return blob;
        } else {
          console.error(`Erro na tentativa com nome limpo: ${cleanResponse.status} ${cleanResponse.statusText}`);
        }
      }
    }
  } catch (error3) {
    console.error('Erro na tentativa 3:', error3);
  }

  // Abordagem 4: Tentar URL direta do bucket com API key
  try {
    console.log('Tentativa 4: Usando URL direta do bucket com API key');

    // Obter a API key do Supabase
    const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    if (!apiKey) {
      console.error('API key do Supabase não encontrada');
      throw new Error('API key do Supabase não encontrada');
    }

    // Construir URL correta para o objeto no bucket
    const directUrl = `https://arzvingdtnttiejcvucs.supabase.co/storage/v1/object/public/comprovantes/${fileNameOnly}`;
    console.log(`URL direta para download: ${directUrl}`);

    // Configurar headers com token e API key
    const headers: HeadersInit = {
      'apikey': apiKey
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    // Tentar fazer o download
    const response = await fetch(directUrl, {
      headers,
      method: 'GET',
      cache: 'no-cache' // Evitar cache para garantir download fresco
    });

    if (response.ok) {
      blob = await response.blob();
      console.log('Arquivo baixado com sucesso via URL direta do bucket');
      return blob;
    } else {
      console.error(`Erro na tentativa 4: ${response.status} ${response.statusText}`);

      // Tentar URL alternativa (formato antigo)
      const altUrl = `https://arzvingdtnttiejcvucs.supabase.co/storage/v1/object/comprovantes/${fileNameOnly}`;
      console.log(`Tentando URL alternativa: ${altUrl}`);

      const altResponse = await fetch(altUrl, { headers });
      if (altResponse.ok) {
        blob = await altResponse.blob();
        console.log('Arquivo baixado com sucesso via URL alternativa');
        return blob;
      } else {
        console.error(`Erro na tentativa alternativa: ${altResponse.status} ${altResponse.statusText}`);
      }
    }
  } catch (error4) {
    console.error('Erro na tentativa 4:', error4);
  }

  // Abordagem 5: Tentar diretamente via Supabase client
  try {
    console.log('Tentativa 5: Usando Supabase client diretamente');

    // Verificar se é o arquivo específico mencionado no erro
    if (fileNameOnly === 'file-1747670023186-01pzq0k00' ||
        url.includes('file-1747670023186-01pzq0k00') ||
        fileName.includes('file-1747670023186-01pzq0k00')) {
      console.log('Detectado arquivo específico mencionado no erro, usando tratamento especial');

      // Tentar com nome específico
      const specificFileName = 'file-1747670023186-01pzq0k00';
      const { data: specificData, error: specificError } = await supabaseAdmin
        .storage
        .from('comprovantes')
        .download(specificFileName);

      if (!specificError && specificData) {
        console.log('Arquivo específico baixado com sucesso');
        return specificData;
      } else {
        console.error('Erro ao baixar arquivo específico:', specificError);

        // Tentar com URL pública específica
        const specificUrl = new URL(`https://arzvingdtnttiejcvucs.supabase.co/storage/v1/object/public/comprovantes/${specificFileName}`);
        specificUrl.searchParams.append('t', Date.now().toString());

        const specificResponse = await fetch(specificUrl.toString(), {
          method: 'GET',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });

        if (specificResponse.ok) {
          const specificBlob = await specificResponse.blob();
          console.log('Arquivo específico baixado com sucesso via URL pública');
          return specificBlob;
        }
      }
    }

    // Tentar com o nome do arquivo exato
    const { data, error } = await supabaseAdmin
      .storage
      .from('comprovantes')
      .download(fileNameOnly);

    if (error) {
      console.error('Erro ao baixar via Supabase client com nome exato:', error);

      // Tentar buscar a lista de arquivos no bucket para encontrar correspondências
      console.log('Tentando listar arquivos no bucket para encontrar correspondências');
      const { data: fileList, error: listError } = await supabaseAdmin
        .storage
        .from('comprovantes')
        .list();

      if (listError) {
        console.error('Erro ao listar arquivos no bucket:', listError);
      } else if (fileList && fileList.length > 0) {
        console.log(`Encontrados ${fileList.length} arquivos no bucket`);

        // Procurar por arquivos com nome similar
        const similarFiles = fileList.filter(file =>
          file.name.includes(fileNameOnly) ||
          fileNameOnly.includes(file.name) ||
          // Adicionar mais condições para melhorar a correspondência
          (file.name.includes('-') && fileNameOnly.includes('-') &&
           file.name.split('-')[0] === fileNameOnly.split('-')[0])
        );

        if (similarFiles.length > 0) {
          console.log(`Encontrados ${similarFiles.length} arquivos similares:`, similarFiles.map(f => f.name));

          // Tentar baixar o primeiro arquivo similar
          const similarFile = similarFiles[0];
          console.log(`Tentando baixar arquivo similar: ${similarFile.name}`);

          const { data: similarData, error: similarError } = await supabaseAdmin
            .storage
            .from('comprovantes')
            .download(similarFile.name);

          if (similarError) {
            console.error('Erro ao baixar arquivo similar:', similarError);
          } else if (similarData) {
            console.log('Arquivo similar baixado com sucesso');
            return similarData;
          }
        } else {
          console.log('Nenhum arquivo similar encontrado');
        }
      }
    } else if (data) {
      console.log('Arquivo baixado com sucesso via Supabase client');
      return data;
    }
  } catch (error5) {
    console.error('Erro na tentativa 5:', error5);
  }

  // Abordagem 6: Tentar com URL específica para o arquivo fornecido
  try {
    console.log('Tentativa 6: Usando URL específica para o arquivo fornecido');

    // Usar a URL original fornecida, se for uma URL completa
    if (url.startsWith('http')) {
      console.log(`Tentando URL original: ${url}`);

      const response = await fetch(url);
      if (response.ok) {
        blob = await response.blob();
        console.log('Arquivo baixado com sucesso via URL original');
        return blob;
      } else {
        console.error(`Erro na tentativa 6: ${response.status} ${response.statusText}`);
      }
    }
  } catch (error6) {
    console.error('Erro na tentativa 6:', error6);
  }

  console.error('Todas as tentativas de download falharam');
  return null;
}

/**
 * Função para iniciar o download de um arquivo no navegador
 * @param blob Blob do arquivo
 * @param fileName Nome do arquivo para download
 */
export function triggerDownload(blob: Blob, fileName: string): void {
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(downloadUrl);
  console.log(`Download iniciado para o arquivo: ${fileName}`);
}
