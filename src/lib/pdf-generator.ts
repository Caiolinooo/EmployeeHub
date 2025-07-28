/**
 * Utilitário para gerar PDFs a partir de dados de formulários
 */
import { jsPDF } from 'jspdf';
// Import jspdf-autotable explicitly with side effects
import 'jspdf-autotable';

// Add type definition for autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
    lastAutoTable: {
      finalY: number;
    };
  }
}

// Ensure autoTable is available globally
if (typeof window !== 'undefined') {
  // This ensures the plugin is loaded in the browser environment
  (window as any).jspdf = (window as any).jspdf || {};
}
import { FormValues } from './schema';
import { PDFDocument } from 'pdf-lib';
import { createClient } from '@supabase/supabase-js';

// Função para baixar arquivo do Supabase Storage
async function downloadFileFromSupabase(fileName: string): Promise<Buffer | null> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Configuração do Supabase não encontrada');
      return null;
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { data, error } = await supabase
      .storage
      .from('comprovantes')
      .download(fileName);

    if (error) {
      console.error('Erro ao baixar arquivo:', error);
      return null;
    }

    if (data) {
      const arrayBuffer = await data.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }

    return null;
  } catch (error) {
    console.error('Erro ao baixar arquivo do Supabase:', error);
    return null;
  }
}

// Função para verificar se é uma imagem
function isImageFile(tipo: string): boolean {
  return tipo.startsWith('image/') && (
    tipo.includes('jpeg') ||
    tipo.includes('jpg') ||
    tipo.includes('png')
  );
}

// Ensure autoTable is properly initialized
const ensureAutoTable = (doc: jsPDF): void => {
  try {
    // First, try to dynamically import the autoTable plugin if it's not already available
    if (typeof doc.autoTable !== 'function') {
      console.warn('autoTable not found on jsPDF instance, initializing fallback');

      // Try to apply the plugin directly
      try {
        // @ts-expect-error - Try to access the global autoTable function if available
        if (typeof window !== 'undefined' && window.jspdf && window.jspdf.autoTable) {
          // @ts-expect-error - Apply the plugin to the document
          window.jspdf.autoTable(doc);
          console.log('Applied autoTable plugin from global scope');
        }
      } catch (pluginError) {
        console.error('Error applying autoTable plugin:', pluginError);
      }

      // If still not available, define a basic fallback implementation
      if (typeof doc.autoTable !== 'function') {
        console.log('Creating fallback autoTable implementation');

        // Define a basic fallback implementation
        doc.autoTable = function(options: any) {
          console.log('Using fallback autoTable implementation');

          // Ensure options is an object to prevent "Cannot read properties of undefined" errors
          options = options || {};

          // Ensure all required properties exist with defaults
          const startY = options.startY || 40;
          const head = options.head || [];
          const body = options.body || [];
          const theme = options.theme || 'grid';
          const styles = options.styles || { fontSize: 10 };
          const columnStyles = options.columnStyles || {};
          const headStyles = options.headStyles || { fillColor: [0, 102, 204] };

          let currentY = startY;

          // Draw header if exists
          if (head && head.length > 0) {
            doc.setFillColor(
              headStyles.fillColor?.[0] || 0,
              headStyles.fillColor?.[1] || 102,
              headStyles.fillColor?.[2] || 204
            );
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(styles.fontSize || 10);

            head.forEach((row: any[]) => {
              if (!row || !Array.isArray(row)) return;

              let currentX = 20;
              row.forEach((cell, colIndex) => {
                const cellWidth = columnStyles[colIndex]?.cellWidth || 40;

                // Draw cell background
                doc.rect(currentX, currentY - 5, cellWidth, 8, 'F');

                // Draw cell text (safely convert to string)
                const cellText = cell !== undefined && cell !== null ? String(cell) : '';
                doc.text(cellText, currentX + 2, currentY);
                currentX += cellWidth;
              });
              currentY += 10;
            });

            doc.setTextColor(0, 0, 0);
          }

          // Draw body
          if (body && body.length > 0) {
            doc.setFontSize(styles.fontSize || 10);

            body.forEach((row: any[]) => {
              if (!row || !Array.isArray(row)) return;

              let currentX = 20;
              row.forEach((cell, colIndex) => {
                const cellWidth = columnStyles[colIndex]?.cellWidth || 40;

                // Apply bold style for first column if specified
                if (colIndex === 0 && columnStyles[0]?.fontStyle === 'bold') {
                  doc.setFont('helvetica', 'bold');
                } else {
                  doc.setFont('helvetica', 'normal');
                }

                // Draw cell text (safely convert to string)
                const cellText = cell !== undefined && cell !== null ? String(cell) : '';
                doc.text(cellText, currentX + 2, currentY);
                currentX += cellWidth;
              });

              // Draw separator line
              doc.setDrawColor(220, 220, 220);
              doc.line(20, currentY + 2, 190, currentY + 2);

              currentY += 8;
            });
          }

          // Set finalY for compatibility
          doc.lastAutoTable = { finalY: currentY };

          return doc;
        };
      }
    }

    // Verify that autoTable is now a function
    if (typeof doc.autoTable === 'function') {
      console.log('autoTable is available and ready to use');
    } else {
      console.error('Failed to initialize autoTable');
    }

    // Ensure lastAutoTable exists to prevent "Cannot read properties of undefined" errors
    if (!doc.lastAutoTable) {
      doc.lastAutoTable = { finalY: 40 };
    }
  } catch (error) {
    console.error('Error in ensureAutoTable:', error);

    // Emergency fallback if everything else fails
    if (typeof doc.autoTable !== 'function') {
      doc.autoTable = function(options: any) {
        console.log('Using emergency fallback autoTable');
        const startY = options?.startY || 40;
        doc.lastAutoTable = { finalY: startY + 20 };
        return doc;
      };
    }
  }
};

/**
 * Gera um PDF do formulário de reembolso preenchido
 * @param data Dados do formulário
 * @param protocolo Número do protocolo
 * @returns Buffer do PDF gerado
 */
export async function generateReimbursementPDF(data: FormValues, protocolo: string): Promise<Buffer> {
  try {
    console.log('Iniciando geração de PDF do formulário de reembolso...');

    // Criar um novo documento PDF
    const doc = new jsPDF();

    // Garantir que autoTable esteja disponível
    ensureAutoTable(doc);

    console.log('Verificação de autoTable concluída, prosseguindo com a geração do PDF');

    // Adicionar título
    doc.setFontSize(18);
    doc.setTextColor(0, 102, 204); // Azul
    doc.text('Solicitação de Reembolso', 105, 15, { align: 'center' });

    // Adicionar protocolo
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(`Protocolo: ${protocolo}`, 105, 25, { align: 'center' });
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 105, 30, { align: 'center' });

    // Linha separadora
    doc.setDrawColor(0, 102, 204);
    doc.line(20, 35, 190, 35);

    // Dados do solicitante
    doc.setFontSize(14);
    doc.setTextColor(0, 102, 204);
    doc.text('Dados do Solicitante', 20, 45);

    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);

    // Tabela de dados do solicitante
    const solicitanteData = [
      ['Nome', data.nome],
      ['Email', data.email],
      ['Telefone', data.telefone],
      ['CPF', data.cpf],
      ['Cargo', data.cargo],
      ['Centro de Custo', data.centroCusto || 'Não informado']
    ];

    try {
      console.log('Adicionando tabela de dados do solicitante');

      // Verificar se autoTable está disponível
      if (typeof doc.autoTable === 'function') {
        // Usar try/catch para cada operação de autoTable para evitar falhas
        try {
          doc.autoTable({
            startY: 50,
            head: [],
            body: solicitanteData,
            theme: 'grid',
            styles: { fontSize: 10 },
            columnStyles: {
              0: { fontStyle: 'bold', cellWidth: 40 },
              1: { cellWidth: 130 }
            },
            headStyles: { fillColor: [0, 102, 204] }
          });
          console.log('Tabela de dados do solicitante adicionada ao PDF');
        } catch (innerError) {
          console.error('Erro interno ao criar tabela de dados do solicitante:', innerError);
          throw innerError; // Propagar erro para o fallback
        }
      } else {
        console.error('doc.autoTable não é uma função, usando fallback');
        throw new Error('autoTable não disponível');
      }
    } catch (tableError) {
      console.error('Erro ao criar tabela de dados do solicitante:', tableError);
      // Fallback: adicionar texto simples em vez da tabela
      let yPos = 50;
      solicitanteData.forEach(row => {
        try {
          doc.text(`${row[0]}: ${row[1]}`, 20, yPos);
          yPos += 5;
        } catch (textError) {
          console.error('Erro ao adicionar texto:', textError);
        }
      });
      // Definir manualmente lastAutoTable.finalY para compatibilidade
      doc.lastAutoTable = { finalY: yPos };
      console.log('Fallback: dados do solicitante adicionados como texto simples após erro');
    }

    // Dados do reembolso
    // Safely calculate finalY with fallback to prevent "Cannot read properties of undefined" errors
    let finalY = 80; // Default fallback value
    try {
      if (doc.lastAutoTable && typeof doc.lastAutoTable.finalY === 'number') {
        finalY = doc.lastAutoTable.finalY + 10;
        console.log('Calculated finalY from lastAutoTable:', finalY);
      } else {
        console.warn('doc.lastAutoTable.finalY not available, using default value');
      }
    } catch (finalYError) {
      console.error('Error calculating finalY:', finalYError);
    }

    doc.setFontSize(14);
    doc.setTextColor(0, 102, 204);
    doc.text('Dados do Reembolso', 20, finalY);

    // Tabela de dados do reembolso
    const reembolsoData = [
      ['Tipo', data.tipoReembolso],
      ['Data', new Date(data.data).toLocaleDateString('pt-BR')],
      ['Descrição', data.descricao],
      ['Valor Total', `${data.valorTotal} ${data.moeda}`],
      ['Método de Pagamento', data.metodoPagamento]
    ];

    // Adicionar dados específicos do método de pagamento
    if (data.metodoPagamento === 'deposito') {
      reembolsoData.push(['Banco', data.banco || '']);
      reembolsoData.push(['Agência', data.agencia || '']);
      reembolsoData.push(['Conta', data.conta || '']);
    } else if (data.metodoPagamento === 'pix') {
      reembolsoData.push(['Tipo de Chave PIX', data.pixTipo || '']);
      reembolsoData.push(['Chave PIX', data.pixChave || '']);
    }

    // Adicionar observações se existirem
    if (data.observacoes) {
      reembolsoData.push(['Observações', data.observacoes]);
    }

    try {
      console.log('Adicionando tabela de dados do reembolso');

      // Verificar se autoTable está disponível
      if (typeof doc.autoTable === 'function') {
        // Usar try/catch para cada operação de autoTable para evitar falhas
        try {
          doc.autoTable({
            startY: finalY + 5,
            head: [],
            body: reembolsoData,
            theme: 'grid',
            styles: { fontSize: 10 },
            columnStyles: {
              0: { fontStyle: 'bold', cellWidth: 40 },
              1: { cellWidth: 130 }
            },
            headStyles: { fillColor: [0, 102, 204] }
          });
          console.log('Tabela de dados do reembolso adicionada ao PDF');
        } catch (innerError) {
          console.error('Erro interno ao criar tabela de dados do reembolso:', innerError);
          throw innerError; // Propagar erro para o fallback
        }
      } else {
        console.error('doc.autoTable não é uma função, usando fallback');
        throw new Error('autoTable não disponível');
      }
    } catch (tableError) {
      console.error('Erro ao criar tabela de dados do reembolso:', tableError);
      // Fallback: adicionar texto simples em vez da tabela
      let yPos = finalY + 5;
      reembolsoData.forEach(row => {
        try {
          doc.text(`${row[0]}: ${row[1]}`, 20, yPos);
          yPos += 5;
        } catch (textError) {
          console.error('Erro ao adicionar texto:', textError);
        }
      });
      // Definir manualmente lastAutoTable.finalY para compatibilidade
      doc.lastAutoTable = { finalY: yPos };
      console.log('Fallback: dados do reembolso adicionados como texto simples após erro');
    }

    // Dados dos comprovantes
    // Safely calculate finalY2 with fallback to prevent "Cannot read properties of undefined" errors
    let finalY2 = 150; // Default fallback value
    try {
      if (doc.lastAutoTable && typeof doc.lastAutoTable.finalY === 'number') {
        finalY2 = doc.lastAutoTable.finalY + 10;
        console.log('Calculated finalY2 from lastAutoTable:', finalY2);
      } else {
        console.warn('doc.lastAutoTable.finalY not available for finalY2, using default value');
      }
    } catch (finalY2Error) {
      console.error('Error calculating finalY2:', finalY2Error);
    }

    // Processar múltiplas despesas e seus comprovantes
    if ((data as any).expenses && Array.isArray((data as any).expenses) && (data as any).expenses.length > 0) {
      console.log('Processando múltiplas despesas...');

      // Adicionar seção de despesas
      doc.setFontSize(14);
      doc.setTextColor(0, 102, 204);
      doc.text('Detalhamento das Despesas', 20, finalY2);

      let currentY = finalY2 + 10;

      // Processar cada despesa
      for (let expenseIndex = 0; expenseIndex < (data as any).expenses.length; expenseIndex++) {
        const expense = (data as any).expenses[expenseIndex];

        // Verificar se precisamos de nova página
        if (currentY > 250) {
          doc.addPage();
          currentY = 20;
        }

        // Título da despesa
        doc.setFontSize(12);
        doc.setTextColor(0, 102, 204);
        doc.text(`Despesa ${expenseIndex + 1}`, 20, currentY);
        currentY += 8;

        // Dados da despesa
        const expenseData = [
          ['Tipo:', expense.tipoReembolso || 'Não informado'],
          ['Descrição:', expense.descricao || 'Não informada'],
          ['Valor:', `${expense.valor || '0,00'} ${(data as any).moeda || 'BRL'}`]
        ];

        try {
          if (typeof doc.autoTable === 'function') {
            doc.autoTable({
              startY: currentY,
              head: [],
              body: expenseData,
              theme: 'grid',
              styles: { fontSize: 10 },
              columnStyles: {
                0: { fontStyle: 'bold', cellWidth: 30 },
                1: { cellWidth: 140 }
              },
              headStyles: { fillColor: [0, 102, 204] }
            });
            currentY = doc.lastAutoTable.finalY + 10;
          } else {
            // Fallback sem autoTable
            expenseData.forEach(([label, value]) => {
              doc.setFontSize(10);
              doc.setTextColor(0, 0, 0);
              doc.text(`${label} ${value}`, 25, currentY);
              currentY += 6;
            });
            currentY += 5;
          }
        } catch (error) {
          console.error('Erro ao criar tabela da despesa:', error);
          currentY += 20;
        }

        // Comprovantes desta despesa
        if (expense.comprovantes && Array.isArray(expense.comprovantes) && expense.comprovantes.length > 0) {
          doc.setFontSize(11);
          doc.setTextColor(0, 102, 204);
          doc.text(`Comprovantes da Despesa ${expenseIndex + 1}:`, 20, currentY);
          currentY += 8;

          // Tabela de comprovantes desta despesa
          const comprovantesData = expense.comprovantes.map((file: any, index: number) => {
            // Determinar o tamanho do arquivo
            let fileSize = 'Desconhecido';
            if (file.tamanho) {
              fileSize = `${(file.tamanho / 1024).toFixed(1)} KB`;
            } else if (file.size) {
              fileSize = `${(file.size / 1024).toFixed(1)} KB`;
            }

            // Determinar o nome do arquivo
            const fileName = file.nome || file.name || file.filename || `Comprovante ${index + 1}`;

            // Determinar o tipo do arquivo
            let fileType = 'Desconhecido';
            if (file.tipo) {
              fileType = file.tipo;
            } else if (file.type) {
              fileType = file.type;
            }

            return [
              index + 1,
              fileName,
              fileType,
              fileSize
            ];
          });

          try {
            if (typeof doc.autoTable === 'function') {
              doc.autoTable({
                startY: currentY,
                head: [['#', 'Nome do Arquivo', 'Tipo', 'Tamanho']],
                body: comprovantesData,
                theme: 'grid',
                styles: { fontSize: 9 },
                headStyles: { fillColor: [0, 102, 204] }
              });
              currentY = doc.lastAutoTable.finalY + 15;
            } else {
              // Fallback sem autoTable
              comprovantesData.forEach((row: any) => {
                doc.setFontSize(9);
                doc.setTextColor(0, 0, 0);
                doc.text(`${row[0]}. ${row[1]} (${row[2]}) - ${row[3]}`, 25, currentY);
                currentY += 5;
              });
              currentY += 10;
            }
          } catch (error) {
            console.error('Erro ao criar tabela de comprovantes:', error);
            currentY += 15;
          }

          // Adicionar visualização das imagens desta despesa
          for (let i = 0; i < expense.comprovantes.length; i++) {
            const comprovante = expense.comprovantes[i];
            const fileName = comprovante.nome || comprovante.name || `Comprovante ${i + 1}`;
            const fileType = comprovante.tipo || comprovante.type || '';

            // Verificar se é uma imagem
            if (isImageFile(fileType)) {
              try {
                console.log(`Processando imagem da despesa ${expenseIndex + 1}: ${fileName}`);

                // Extrair nome do arquivo da URL pública
                let fileNameToDownload = comprovante.publicUrl?.split('/').pop() || comprovante.url?.split('/').pop();
                if (!fileNameToDownload && comprovante.nome) {
                  fileNameToDownload = comprovante.nome;
                }

                if (fileNameToDownload) {
                  // Baixar a imagem do Supabase
                  const imageBuffer = await downloadFileFromSupabase(fileNameToDownload);

                  if (imageBuffer) {
                    // Verificar se precisamos de uma nova página
                    if (currentY > 180) {
                      doc.addPage();
                      currentY = 20;
                    }

                    // Adicionar título da imagem
                    doc.setFontSize(10);
                    doc.setTextColor(0, 102, 204);
                    doc.text(`Despesa ${expenseIndex + 1} - ${fileName}`, 20, currentY);
                    currentY += 8;

                    try {
                      // Converter buffer para base64
                      const base64Image = imageBuffer.toString('base64');
                      const imageFormat = fileType.includes('png') ? 'PNG' : 'JPEG';

                      // Adicionar a imagem ao PDF
                      const maxWidth = 170;
                      const maxHeight = 100;

                      doc.addImage(
                        `data:${fileType};base64,${base64Image}`,
                        imageFormat,
                        20,
                        currentY,
                        maxWidth,
                        maxHeight
                      );

                      currentY += maxHeight + 10;
                      console.log(`Imagem ${fileName} da despesa ${expenseIndex + 1} adicionada ao PDF`);
                    } catch (imageError) {
                      console.error(`Erro ao adicionar imagem ${fileName}:`, imageError);
                      doc.setFontSize(9);
                      doc.setTextColor(255, 0, 0);
                      doc.text(`Erro ao carregar imagem: ${fileName}`, 20, currentY);
                      currentY += 8;
                    }
                  }
                }
              } catch (error) {
                console.error(`Erro ao processar imagem ${fileName}:`, error);
              }
            }
          }
        } else {
          doc.setFontSize(10);
          doc.setTextColor(128, 128, 128);
          doc.text('Nenhum comprovante anexado para esta despesa', 25, currentY);
          currentY += 10;
        }

        currentY += 5; // Espaço entre despesas
      }
    } else {
      // Fallback para formato antigo (compatibilidade)
      console.log('Usando formato antigo de comprovantes...');

      doc.setFontSize(14);
      doc.setTextColor(0, 102, 204);
      doc.text('Comprovantes Anexados', 20, finalY2);

      if ((data as any).comprovantes && Array.isArray((data as any).comprovantes) && (data as any).comprovantes.length > 0) {
        // Código antigo para comprovantes únicos (compatibilidade)
        const comprovantesData = (data as any).comprovantes.map((file: any, index: number) => {
          let fileSize = 'Desconhecido';
          if (file.tamanho) {
            fileSize = `${(file.tamanho / 1024).toFixed(1)} KB`;
          } else if (file.size) {
            fileSize = `${(file.size / 1024).toFixed(1)} KB`;
          }

          const fileName = file.nome || file.name || file.filename || `Comprovante ${index + 1}`;
          let fileType = 'Desconhecido';
          if (file.tipo) {
            fileType = file.tipo;
          } else if (file.type) {
            fileType = file.type;
          }

          return [
            index + 1,
            fileName,
            fileType,
            fileSize
          ];
        });

        try {
          if (typeof doc.autoTable === 'function') {
            doc.autoTable({
              startY: finalY2 + 5,
              head: [['#', 'Nome do Arquivo', 'Tipo', 'Tamanho']],
              body: comprovantesData,
              theme: 'grid',
              styles: { fontSize: 10 },
              headStyles: { fillColor: [0, 102, 204] }
            });
          }
        } catch (error) {
          console.error('Erro ao criar tabela de comprovantes:', error);
        }

        // Adicionar visualização das imagens (formato antigo)
        let currentY = doc.lastAutoTable?.finalY || finalY2 + 30;

        for (let i = 0; i < (data as any).comprovantes.length; i++) {
          const comprovante = (data as any).comprovantes[i];
          const fileName = comprovante.nome || comprovante.name || `Comprovante ${i + 1}`;
          const fileType = comprovante.tipo || comprovante.type || '';

          if (isImageFile(fileType)) {
            try {
              let fileNameToDownload = comprovante.publicUrl?.split('/').pop() || comprovante.url?.split('/').pop();
              if (!fileNameToDownload && comprovante.nome) {
                fileNameToDownload = comprovante.nome;
              }

              if (fileNameToDownload) {
                const imageBuffer = await downloadFileFromSupabase(fileNameToDownload);

                if (imageBuffer) {
                  if (currentY > 180) {
                    doc.addPage();
                    currentY = 20;
                  }

                  doc.setFontSize(10);
                  doc.setTextColor(0, 102, 204);
                  doc.text(fileName, 20, currentY);
                  currentY += 8;

                  try {
                    const base64Image = imageBuffer.toString('base64');
                    const imageFormat = fileType.includes('png') ? 'PNG' : 'JPEG';

                    doc.addImage(
                      `data:${fileType};base64,${base64Image}`,
                      imageFormat,
                      20,
                      currentY,
                      170,
                      100
                    );

                    currentY += 110;
                  } catch (imageError) {
                    console.error(`Erro ao adicionar imagem ${fileName}:`, imageError);
                  }
                }
              }
            } catch (error) {
              console.error(`Erro ao processar imagem ${fileName}:`, error);
            }
          }
        }
      } else {
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.text('Nenhum comprovante anexado', 20, finalY2 + 10);
      }
    }

    // Rodapé
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text(
        `Solicitação de Reembolso - Protocolo: ${protocolo} - Página ${i} de ${pageCount}`,
        105,
        doc.internal.pageSize.height - 10,
        { align: 'center' }
      );
    }

    // Converter para buffer
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    console.log('PDF do formulário gerado com sucesso');

    return pdfBuffer;
  } catch (error) {
    console.error('Erro ao gerar PDF do formulário:', error);
    // Criar um PDF de erro como fallback
    try {
      const errorDoc = new jsPDF();
      errorDoc.setFontSize(16);
      errorDoc.setTextColor(255, 0, 0);
      errorDoc.text('ERRO AO GERAR PDF', 105, 20, { align: 'center' });

      errorDoc.setFontSize(12);
      errorDoc.setTextColor(0, 0, 0);
      errorDoc.text(`Protocolo: ${protocolo}`, 105, 30, { align: 'center' });
      errorDoc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 105, 40, { align: 'center' });

      errorDoc.setFontSize(10);
      errorDoc.text('Ocorreu um erro ao gerar o PDF do formulário de reembolso.', 14, 60);
      errorDoc.text('Por favor, entre em contato com o suporte técnico.', 14, 70);
      errorDoc.text(`Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`, 14, 80);

      const errorBuffer = Buffer.from(errorDoc.output('arraybuffer'));
      console.log('PDF de erro gerado como fallback');
      return errorBuffer;
    } catch (fallbackError) {
      console.error('Erro ao gerar PDF de erro:', fallbackError);
      // Se até o PDF de erro falhar, retornar um buffer vazio
      return Buffer.from('Erro ao gerar PDF');
    }
  }
}

/**
 * Combina múltiplos PDFs em um único documento
 * @param pdfBuffers Array de buffers de PDFs para combinar
 * @param filename Nome do arquivo combinado
 * @returns Buffer do PDF combinado
 */
export async function combinePDFs(pdfBuffers: Buffer[], filename: string): Promise<Buffer> {
  try {
    console.log(`Iniciando combinação de ${pdfBuffers.length} PDFs em um único documento: ${filename}`);

    // Verificar se temos buffers válidos
    if (!pdfBuffers || pdfBuffers.length === 0) {
      console.error('Nenhum buffer de PDF fornecido para combinação');
      throw new Error('Nenhum buffer de PDF fornecido para combinação');
    }

    // Filtrar buffers vazios ou inválidos
    const validBuffers = pdfBuffers.filter(buffer => buffer && buffer.length > 0);

    if (validBuffers.length === 0) {
      console.error('Nenhum buffer de PDF válido fornecido para combinação');
      throw new Error('Nenhum buffer de PDF válido fornecido para combinação');
    }

    console.log(`${validBuffers.length} buffers válidos para combinação`);

    // Se tivermos apenas um buffer válido, retorná-lo diretamente
    if (validBuffers.length === 1) {
      console.log('Apenas um buffer válido, retornando-o diretamente sem combinação');
      return validBuffers[0];
    }

    // Criar um novo documento PDF
    const mergedPdf = await PDFDocument.create();
    let totalPages = 0;

    // Processar cada buffer de PDF
    for (let i = 0; i < validBuffers.length; i++) {
      const pdfBuffer = validBuffers[i];

      try {
        console.log(`Processando PDF ${i + 1}/${validBuffers.length} (${pdfBuffer.length} bytes)`);

        // Carregar o PDF a partir do buffer
        const pdf = await PDFDocument.load(pdfBuffer);
        const pageCount = pdf.getPageCount();
        console.log(`PDF ${i + 1} tem ${pageCount} páginas`);

        // Copiar todas as páginas para o documento combinado
        const pageIndices = pdf.getPageIndices();
        const copiedPages = await mergedPdf.copyPages(pdf, pageIndices);

        copiedPages.forEach(page => {
          mergedPdf.addPage(page);
          totalPages++;
        });

        console.log(`${copiedPages.length} páginas copiadas do PDF ${i + 1}`);
      } catch (err) {
        console.error(`Erro ao processar o PDF ${i + 1}:`, err);
        // Continuar com os próximos PDFs
      }
    }

    console.log(`Documento combinado criado com ${totalPages} páginas no total`);

    // Verificar se o documento combinado tem páginas
    if (totalPages === 0) {
      console.error('Nenhuma página foi adicionada ao documento combinado');
      throw new Error('Nenhuma página foi adicionada ao documento combinado');
    }

    // Salvar o documento combinado
    console.log('Salvando documento combinado...');
    const mergedPdfBytes = await mergedPdf.save();
    console.log(`Documento combinado salvo com sucesso (${mergedPdfBytes.length} bytes)`);

    return Buffer.from(mergedPdfBytes);
  } catch (error) {
    console.error('Erro ao combinar PDFs:', error);

    // Se tivermos pelo menos um buffer válido, retorná-lo como fallback
    if (pdfBuffers && pdfBuffers.length > 0) {
      for (const buffer of pdfBuffers) {
        if (buffer && buffer.length > 0) {
          console.log('Retornando o primeiro buffer válido como fallback');
          return buffer;
        }
      }
    }

    throw new Error(`Erro ao combinar PDFs: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }
}

/**
 * Gera um PDF combinado com o formulário de reembolso e os comprovantes
 * @param data Dados do formulário
 * @param protocolo Número do protocolo
 * @param attachments Anexos (comprovantes)
 * @returns Buffer do PDF combinado
 */
export async function generateCombinedReimbursementPDF(
  data: FormValues,
  protocolo: string,
  attachments: Array<{
    filename: string;
    content?: Buffer;
    contentType?: string;
  }>
): Promise<Buffer> {
  try {
    console.log('Iniciando geração de PDF combinado...');
    console.log(`Número de anexos recebidos: ${attachments?.length || 0}`);

    // Gerar o PDF do formulário
    const formPdfBuffer = await generateReimbursementPDF(data, protocolo);
    console.log('PDF do formulário gerado com sucesso para combinação');

    // Preparar array de buffers para combinar
    const pdfBuffers: Buffer[] = [formPdfBuffer];
    let attachmentCount = 0;

    // Adicionar comprovantes que são PDFs
    if (attachments && attachments.length > 0) {
      for (const attachment of attachments) {
        try {
          if (attachment.content && attachment.content.length > 0) {
            // Verificar se é um PDF
            const isPdf = attachment.contentType === 'application/pdf' ||
                          attachment.filename.toLowerCase().endsWith('.pdf');

            if (isPdf) {
              console.log(`Adicionando anexo PDF: ${attachment.filename}`);
              pdfBuffers.push(attachment.content);
              attachmentCount++;
            } else {
              console.log(`Pulando anexo não-PDF: ${attachment.filename} (${attachment.contentType})`);
            }
          } else {
            console.log(`Anexo sem conteúdo: ${attachment.filename}`);
          }
        } catch (attachError) {
          console.error(`Erro ao processar anexo ${attachment.filename}:`, attachError);
          // Continuar com os próximos anexos
        }
      }
    }

    console.log(`Total de ${attachmentCount} anexos PDF adicionados ao documento combinado`);

    // Nome do arquivo combinado
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const filename = `Reembolso_${protocolo}_${data.nome.replace(/\s+/g, '_')}_${date}.pdf`;

    // Verificar se temos mais de um PDF para combinar
    if (pdfBuffers.length > 1) {
      console.log(`Combinando ${pdfBuffers.length} PDFs em um único documento`);
      // Combinar os PDFs
      const combinedBuffer = await combinePDFs(pdfBuffers, filename);
      console.log('PDF combinado gerado com sucesso');
      return combinedBuffer;
    } else {
      console.log('Apenas o PDF do formulário está disponível, não é necessário combinar');
      return formPdfBuffer;
    }
  } catch (error) {
    console.error('Erro ao gerar PDF combinado:', error);
    try {
      // Se falhar, retornar apenas o PDF do formulário
      console.log('Tentando retornar apenas o PDF do formulário como fallback');
      return await generateReimbursementPDF(data, protocolo);
    } catch (fallbackError) {
      console.error('Erro ao gerar PDF do formulário como fallback:', fallbackError);

      // Criar um PDF de erro simples como último recurso
      try {
        console.log('Criando PDF de erro como último recurso');
        const errorDoc = new jsPDF();
        errorDoc.setFontSize(16);
        errorDoc.setTextColor(255, 0, 0);
        errorDoc.text('ERRO AO GERAR PDF COMBINADO', 105, 20, { align: 'center' });

        errorDoc.setFontSize(12);
        errorDoc.setTextColor(0, 0, 0);
        errorDoc.text(`Protocolo: ${protocolo}`, 105, 30, { align: 'center' });
        errorDoc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 105, 40, { align: 'center' });

        errorDoc.setFontSize(10);
        errorDoc.text('Ocorreu um erro ao gerar o PDF combinado.', 14, 60);
        errorDoc.text('Por favor, entre em contato com o suporte técnico.', 14, 70);

        const errorBuffer = Buffer.from(errorDoc.output('arraybuffer'));
        console.log('PDF de erro gerado como último recurso');
        return errorBuffer;
      } catch (lastResortError) {
        console.error('Erro ao gerar PDF de erro como último recurso:', lastResortError);
        // Se tudo falhar, retornar um buffer com mensagem de erro
        return Buffer.from('Erro ao gerar PDF combinado');
      }
    }
  }
}
