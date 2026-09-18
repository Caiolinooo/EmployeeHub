/**
 * Gate G2 — verifica a lib de importação dinâmica contra as planilhas reais
 * de R&S. Expectativas em LINHAS VISÍVEIS DO EXCEL (1-based, contando vazias),
 * remedidas independentemente em 18/09/2026 (1ª medição usava índice do array
 * compactado — semântica errada; re-mediada com blankrows:true e contagem de
 * células não-vazias por trim):
 *   - Indicador de eficácia 2026.xlsx  › 'Relatório de vagas'      → header 8,  217 linhas
 *   - Controle de vagas e indicadores  › 'Relatorio de candidatos' → header 14, 884 linhas
 *   - Indicador de eficácia 2026.xlsx  › 'Eficácia'                → header 5,    9 linhas
 *   - Indicador de eficácia 2026.xlsx  › 'KPI Eficácia'            → header 5,   21 linhas
 *   - Controle de vagas e indicadores  › 'Relatório de vagas'      → header 8,  747 linhas
 * Uso: npx tsx scripts/verify-rs-import-lib.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { analisarPlanilha, type ResultadoAnalise } from '../src/lib/indicadores/xlsx-import';

const PASTA = 'C:/Users/caio.correia/Downloads/Indicadores';

interface Expectativa {
  arquivo: string;
  aba: string;
  headerRow: number;
  linhas: number;
}

const ESPERADAS: Expectativa[] = [
  { arquivo: 'Indicador de eficácia 2026.xlsx', aba: 'Relatório de vagas', headerRow: 8, linhas: 217 },
  { arquivo: 'Controle de vagas e indicadores - 2026.xlsx', aba: 'Relatorio de candidatos', headerRow: 14, linhas: 884 },
  { arquivo: 'Indicador de eficácia 2026.xlsx', aba: 'Eficácia', headerRow: 5, linhas: 9 },
  { arquivo: 'Indicador de eficácia 2026.xlsx', aba: 'KPI Eficácia', headerRow: 5, linhas: 21 },
  { arquivo: 'Controle de vagas e indicadores - 2026.xlsx', aba: 'Relatório de vagas', headerRow: 8, linhas: 747 },
];

function falhar(msg: string): never {
  console.error('RS_IMPORT_LIB_FAIL:', msg);
  process.exit(1);
}

async function main() {
  // Cache de buffers por arquivo (analisar 1x, checar N abas).
  const resultados = new Map<string, ResultadoAnalise | Promise<ResultadoAnalise>>();

  const obter = (arquivo: string) => {
    if (!resultados.has(arquivo)) {
      const caminho = path.join(PASTA, arquivo);
      if (!fs.existsSync(caminho)) falhar(`planilha ausente: ${caminho}`);
      const buffer = fs.readFileSync(caminho);
      resultados.set(arquivo, analisarPlanilha(buffer, { arquivoNome: arquivo }));
    }
    return resultados.get(arquivo)!;
  };

  for (const esp of ESPERADAS) {
    const res = await obter(esp.arquivo);
    const aba = res.abas.find((a) => a.nome === esp.aba);
    if (!aba) falhar(`${esp.arquivo}: aba '${esp.aba}' não detectada (abas: ${res.abas.map((a) => a.nome).join(' | ')})`);
    if (aba.headerRow !== esp.headerRow) {
      falhar(`${esp.arquivo}/${esp.aba}: headerRow ${aba.headerRow} ≠ esperado ${esp.headerRow}`);
    }
    if (aba.totalLinhas !== esp.linhas) {
      falhar(`${esp.arquivo}/${esp.aba}: ${aba.totalLinhas} linhas ≠ esperado ${esp.linhas}`);
    }
    if (!Array.isArray(aba.colunas) || aba.colunas.length < 3) {
      falhar(`${esp.arquivo}/${esp.aba}: colunas insuficientes (${aba.colunas?.length})`);
    }
    for (const col of aba.colunas) {
      if (!['data', 'numero', 'percentual', 'texto'].includes(col.tipo)) {
        falhar(`${esp.arquivo}/${esp.aba}: tipo inválido '${col.tipo}' em ${col.key}`);
      }
      if (!col.key || !col.label) falhar(`${esp.arquivo}/${esp.aba}: coluna sem key/label`);
    }
    console.log(`OK ${esp.arquivo} › ${esp.aba}: header=${aba.headerRow} linhas=${aba.totalLinhas} colunas=${aba.colunas.length} (${aba.colunas.map((c) => c.tipo).join(',')})`);
  }

  // Tipagem: datas reais nas vagas; percentual na retenção; número no prazo.
  const vagas = await obter('Indicador de eficácia 2026.xlsx');
  const abaVagas = vagas.abas.find((a) => a.nome === 'Relatório de vagas')!;
  const tipos: Record<string, string> = {};
  for (const c of abaVagas.colunas) tipos[c.label.toUpperCase()] = c.tipo;
  if (tipos['VAGA ABERTA'] !== 'data') falhar(`'VAGA ABERTA' deveria ser data (veio ${tipos['VAGA ABERTA']})`);
  if (tipos['PRAZO FINAL DE ATENDIMENTO EM DIAS'] !== 'numero') falhar('PRAZO FINAL deveria ser numero');

  // Datas civis: primeira linha de candidatos (controle) tem ABERTURA DA VAGA 2025-01-14.
  const controle = await obter('Controle de vagas e indicadores - 2026.xlsx');
  const cand = controle.abas.find((a) => a.nome === 'Relatorio de candidatos')!;
  const chaveAbertura = cand.colunas.find((c) => c.label.toUpperCase().includes('ABERTURA DA VAGA'))?.key;
  if (!chaveAbertura) falhar('coluna ABERTURA DA VAGA não encontrada em candidatos');
  const primeira = cand.linhas[0]?.[chaveAbertura];
  if (primeira !== '2025-01-14') falhar(`primeira abertura de candidato '${primeira}' ≠ '2025-01-14' (dia civil local)`);

  // Percentual: KPI Eficácia tem RETENÇÃO EM %.
  const kpi = (await obter('Indicador de eficácia 2026.xlsx')).abas.find((a) => a.nome === 'KPI Eficácia')!;
  const temPercentual = kpi.colunas.some((c) => c.tipo === 'percentual');
  if (!temPercentual) falhar('KPI Eficácia deveria detectar ao menos uma coluna percentual');

  console.log('RS_IMPORT_LIB_OK');
}

main().catch((e) => {
  console.error('RS_IMPORT_LIB_FAIL:', e);
  process.exit(1);
});
