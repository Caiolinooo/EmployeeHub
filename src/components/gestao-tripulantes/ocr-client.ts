'use client';

import { fetchWithToken } from '@/lib/tokenStorage';

/**
 * Client-side OCR trigger used after document upload.
 * Extracts text in the browser (PDF.js / Tesseract) then POSTs to the OCR API.
 * Falls back to server-side processing if client extraction fails.
 */
export async function enviarOcrDocumento(
  docId: string,
  arquivoUrl?: string | null,
  onProgress?: (msg: string) => void
): Promise<Response> {
  if (arquivoUrl) {
    try {
      const { extractTextFromPdfOrImageClient } = await import('@/lib/ocr/pdf-to-images-client');
      const text = await extractTextFromPdfOrImageClient(arquivoUrl, onProgress);
      if (text && text.trim().length >= 30) {
        return await fetchWithToken(`/api/gestao-tripulantes/documentos/${docId}/ocr`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });
      }
    } catch (err) {
      console.warn('[OCR client] extração local falhou, usando servidor:', err);
    }
  }

  onProgress?.('Processando no servidor...');
  return await fetchWithToken(`/api/gestao-tripulantes/documentos/${docId}/ocr`, {
    method: 'POST',
  });
}
