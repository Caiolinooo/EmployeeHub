import { normalizeCpf } from '@/lib/gestao-tripulantes/cpf';
import { htmlToPlainText, stripHtmlComments } from '@/lib/html-text';
import type { PoliWebASO } from './poliweb-scraper-types';

export function formatDateForDb(dateStr: string): string | null {
  if (!dateStr) return null;
  const cleanStr = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) return cleanStr;
  const parts = cleanStr.split('/');
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];
    return `${year}-${month}-${day}`;
  }
  return null;
}

export function parseASOsFromHTML(html: string): PoliWebASO[] {
  const asos: PoliWebASO[] = [];
  const cleanHtml = stripHtmlComments(html).trim();
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;

  let trMatch;
  while ((trMatch = trRegex.exec(cleanHtml)) !== null) {
    const trContent = trMatch[1];
    const tds: string[] = [];
    let tdMatch;

    tdRegex.lastIndex = 0;
    while ((tdMatch = tdRegex.exec(trContent)) !== null) {
      tds.push(htmlToPlainText(tdMatch[1]));
    }

    if (tds.length >= 5) {
      const cpf = normalizeCpf(tds[0]);
      if (cpf.length === 11) {
        asos.push({
          colaboradorCpf: tds[0],
          colaboradorNome: tds[1],
          tipoExame: tds[2],
          dataRealizacao: tds[3],
          dataValidade: tds[4],
          resultado: tds[5] || 'Apto',
          medicoNome: tds[6] || undefined,
          medicoCRM: tds[7] || undefined,
        });
      }
    }
  }

  return asos;
}
