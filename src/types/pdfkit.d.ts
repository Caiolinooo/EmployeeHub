/**
 * Declaração mínima do pdfkit para src/lib/financeiro/invoice/render-pdf.ts
 * (o pacote não vem com typings e @types/pdfkit não está no projeto).
 * Superfície: apenas os membros usados pelo renderizador A4 da fatura.
 */
declare module 'pdfkit' {
  interface PDFKitPage {
    width: number;
    height: number;
  }

  interface PDFFontOptions {
    bold?: boolean;
    italic?: boolean;
  }

  interface PDFTextOptions {
    width?: number;
    align?: 'left' | 'center' | 'right';
    ellipsis?: boolean;
    lineBreak?: boolean;
  }

  interface PDFDocumentInfo {
    Title?: string;
    Author?: string;
  }

  class PDFKitDocument {
    constructor(options?: {
      size?: 'A4' | 'A5' | 'LETTER' | [number, number];
      layout?: 'portrait' | 'landscape';
      margin?: number;
      info?: PDFDocumentInfo;
      bufferPages?: boolean;
    });
    readonly page: PDFKitPage;
    widthOfString(text: string, options?: PDFTextOptions): number;
    heightOfString(text: string, options?: PDFTextOptions): number;
    font(font: string, size?: number, options?: PDFFontOptions): this;
    fontSize(size: number): this;
    fillColor(color: string): this;
    fill(color?: string): this;
    strokeColor(color: string): this;
    text(text: string, x?: number, y?: number, options?: PDFTextOptions): this;
    rect(x: number, y: number, width: number, height: number): this;
    moveTo(x: number, y: number): this;
    lineTo(x: number, y: number): this;
    lineWidth(width: number): this;
    stroke(color?: string): this;
    addPage(): this;
    on(event: 'data', listener: (chunk: Buffer) => void): this;
    on(event: 'end' | 'error', listener: (payload?: unknown) => void): this;
    end(): void;
  }

  export = PDFKitDocument;
}
