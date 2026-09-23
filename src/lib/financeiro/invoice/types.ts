/**
 * CONTRATO FECHADO — §3.3 do design financeiro (local://financeiro-design.md).
 * Fonte de verdade: financeiro-design.md v1.0. Mudança só por revisão do design.
 *
 * As três assinaturas de função do contrato são IMPLEMENTAÇÕES nos arquivos
 * irmãos (mesma assinatura, contrato intacto):
 *   - renderFaturaHtml → ./render-html.ts (função PURA, padrão contracheque.ts)
 *   - renderFaturaXlsx → ./render-xlsx.ts (exceljs, lê template do bucket)
 *   - renderFaturaPdf  → ./render-pdf.ts  (pdfkit, mesmo layout do HTML)
 */

export interface FaturaItemRender {
  descricao: string; referencia?: string; quantidade: number;
  valorUnitario: number; valorTotal: number;
}
export interface FaturaRenderInput {
  fatura: {
    numero: number; ano: number; dataEmissao?: string; dataVencimento?: string;
    moeda: string; valorTotal: number; callOff?: string; observacoes?: string;
    competencia?: string; status: string;
    vesselName?: string; poNumber?: string;                  // offshore (migration 20260923_000001)
  };
  emissor: { razaoSocial: string; cnpj: string; endereco?: string;
             email?: string; telefone?: string };
  cliente: { nome: string; documento?: string; endereco?: string };
  itens: FaturaItemRender[];
  contaBancaria?: { bancoNome: string; agencia: string; conta: string;   // Corporate Account Details
                    titularNome: string; pixChave?: string;
                    swiftBic?: string; iban?: string; routingNumber?: string;
                    sortCode?: string; moeda?: string; bancoCorrespondente?: string };
}
export interface FaturaTemplateDef {
  tipo: 'html' | 'xlsx';
  mapping?: {                                          // só para xlsx
    celulas?: Record<string, string>;                  // campo → célula
    servicos?: { linhaInicial: number; linhaFinal: number;
                 colunas: { descricao: string; referencia: string; valor: string } };
    totais?: { celula: string };
  };
}
