import puppeteer from 'puppeteer';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';

// Extend Window interface for chartsReady
declare global {
  interface Window {
    chartsReady?: boolean;
  }
}

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export interface ReportData {
  title: string;
  subtitle?: string;
  period: {
    start: string;
    end: string;
  };
  user?: {
    name: string;
    department: string;
    position: string;
  };
  metrics: {
    [key: string]: number | string;
  };
  charts: ChartData[];
  tables: TableData[];
}

export interface ChartData {
  type: 'bar' | 'line' | 'pie' | 'doughnut';
  title: string;
  data: {
    labels: string[];
    datasets: {
      label: string;
      data: number[];
      backgroundColor?: string | string[];
      borderColor?: string | string[];
    }[];
  };
}

export interface TableData {
  title: string;
  headers: string[];
  rows: (string | number)[][];
}

export class AdvancedPDFGenerator {
  private static instance: AdvancedPDFGenerator;
  private reportsDir = path.join(process.cwd(), 'public', 'reports');

  static getInstance(): AdvancedPDFGenerator {
    if (!AdvancedPDFGenerator.instance) {
      AdvancedPDFGenerator.instance = new AdvancedPDFGenerator();
    }
    return AdvancedPDFGenerator.instance;
  }

  constructor() {
    this.ensureReportsDirectory();
  }

  private async ensureReportsDirectory(): Promise<void> {
    try {
      await fs.access(this.reportsDir);
    } catch {
      await fs.mkdir(this.reportsDir, { recursive: true });
    }
  }

  // Gerar HTML do relatório com Chart.js
  private generateReportHTML(data: ReportData): string {
    const chartConfigs = data.charts.map((chart, index) => ({
      id: `chart-${index}`,
      config: JSON.stringify({
        type: chart.type,
        data: chart.data,
        options: {
          responsive: true,
          plugins: {
            title: {
              display: true,
              text: chart.title,
              font: { size: 16 }
            },
            legend: {
              display: true,
              position: 'bottom'
            }
          },
          scales: chart.type !== 'pie' && chart.type !== 'doughnut' ? {
            y: {
              beginAtZero: true
            }
          } : undefined
        }
      })
    }));

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>${data.title}</title>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                margin: 0;
                padding: 20px;
                color: #333;
                line-height: 1.6;
            }
            .header {
                text-align: center;
                border-bottom: 3px solid #2563eb;
                padding-bottom: 20px;
                margin-bottom: 30px;
            }
            .header h1 {
                color: #2563eb;
                margin: 0;
                font-size: 28px;
            }
            .header h2 {
                color: #64748b;
                margin: 5px 0 0 0;
                font-weight: normal;
                font-size: 16px;
            }
            .period {
                background: #f8fafc;
                padding: 15px;
                border-radius: 8px;
                margin-bottom: 30px;
                text-align: center;
            }
            .user-info {
                background: #f1f5f9;
                padding: 20px;
                border-radius: 8px;
                margin-bottom: 30px;
            }
            .user-info h3 {
                margin-top: 0;
                color: #2563eb;
            }
            .metrics-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 20px;
                margin-bottom: 30px;
            }
            .metric-card {
                background: white;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                padding: 20px;
                text-align: center;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            .metric-value {
                font-size: 32px;
                font-weight: bold;
                color: #2563eb;
                margin-bottom: 5px;
            }
            .metric-label {
                color: #64748b;
                font-size: 14px;
            }
            .chart-container {
                margin-bottom: 40px;
                text-align: center;
                background: white;
                padding: 20px;
                border-radius: 8px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            .chart-canvas {
                max-width: 100%;
                height: 400px;
            }
            .table-container {
                margin-bottom: 30px;
            }
            .table-container h3 {
                color: #2563eb;
                margin-bottom: 15px;
            }
            table {
                width: 100%;
                border-collapse: collapse;
                background: white;
                border-radius: 8px;
                overflow: hidden;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            th {
                background: #2563eb;
                color: white;
                padding: 12px;
                text-align: left;
                font-weight: 600;
            }
            td {
                padding: 12px;
                border-bottom: 1px solid #e2e8f0;
            }
            tr:nth-child(even) {
                background: #f8fafc;
            }
            .footer {
                margin-top: 50px;
                padding-top: 20px;
                border-top: 1px solid #e2e8f0;
                text-align: center;
                color: #64748b;
                font-size: 12px;
            }
            @media print {
                body { margin: 0; }
                .chart-container { page-break-inside: avoid; }
                .table-container { page-break-inside: avoid; }
            }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>${data.title}</h1>
            ${data.subtitle ? `<h2>${data.subtitle}</h2>` : ''}
        </div>

        <div class="period">
            <strong>Período:</strong> ${new Date(data.period.start).toLocaleDateString('pt-BR')} - ${new Date(data.period.end).toLocaleDateString('pt-BR')}
        </div>

        ${data.user ? `
        <div class="user-info">
            <h3>Informações do Funcionário</h3>
            <p><strong>Nome:</strong> ${data.user.name}</p>
            <p><strong>Departamento:</strong> ${data.user.department}</p>
            <p><strong>Cargo:</strong> ${data.user.position}</p>
        </div>
        ` : ''}

        <div class="metrics-grid">
            ${Object.entries(data.metrics).map(([key, value]) => `
                <div class="metric-card">
                    <div class="metric-value">${value}</div>
                    <div class="metric-label">${key}</div>
                </div>
            `).join('')}
        </div>

        ${chartConfigs.map(chart => `
            <div class="chart-container">
                <canvas id="${chart.id}" class="chart-canvas"></canvas>
            </div>
        `).join('')}

        ${data.tables.map(table => `
            <div class="table-container">
                <h3>${table.title}</h3>
                <table>
                    <thead>
                        <tr>
                            ${table.headers.map(header => `<th>${header}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${table.rows.map(row => `
                            <tr>
                                ${row.map(cell => `<td>${cell}</td>`).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `).join('')}

        <div class="footer">
            <p>Relatório gerado em ${new Date().toLocaleString('pt-BR')} - ABZ Group Employee Hub</p>
        </div>

        <script>
            // Aguardar carregamento completo
            window.addEventListener('load', function() {
                ${chartConfigs.map(chart => `
                    const ctx${chart.id.replace('-', '')} = document.getElementById('${chart.id}').getContext('2d');
                    new Chart(ctx${chart.id.replace('-', '')}, ${chart.config});
                `).join('')}
                
                // Sinalizar que os gráficos foram renderizados
                setTimeout(() => {
                    window.chartsReady = true;
                }, 1000);
            });
        </script>
    </body>
    </html>
    `;
  }

  // Gerar PDF
  async generatePDF(reportData: ReportData, userId: string): Promise<string> {
    const reportId = crypto.randomUUID();
    const fileName = `report_${reportId}.pdf`;
    const filePath = path.join(this.reportsDir, fileName);

    const supabase = getSupabaseClient();

    try {
      // Salvar no banco de dados
      await supabase.from('pdf_reports').insert([{
        id: reportId,
        name: reportData.title,
        type: 'custom',
        template: reportData,
        status: 'generating',
        created_by: userId
      }]);

      // Gerar HTML
      const html = this.generateReportHTML(reportData);

      // Gerar PDF com Puppeteer
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
      });

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      // Aguardar os gráficos serem renderizados
      await page.waitForFunction(() => window.chartsReady, { timeout: 10000 });
      
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm'
        }
      });

      await browser.close();

      // Salvar arquivo
      await fs.writeFile(filePath, pdfBuffer);

      // Atualizar status no banco
      await supabase.from('pdf_reports').update({
        status: 'completed',
        file_path: `/reports/${fileName}`,
        file_size: pdfBuffer.length,
        completed_at: new Date().toISOString()
      }).eq('id', reportId);

      return `/reports/${fileName}`;
    } catch (error) {
      // Atualizar status de erro
      await supabase.from('pdf_reports').update({
        status: 'failed'
      }).eq('id', reportId);

      throw new Error(`Erro ao gerar PDF: ${(error as Error).message}`);
    }
  }
}

export default AdvancedPDFGenerator.getInstance();
