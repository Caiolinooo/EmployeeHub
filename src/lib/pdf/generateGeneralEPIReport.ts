import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { EPIWithUser, getCAValidityLevel, CA_VALIDITY_LABELS } from '@/types/epi';

interface GeneralReportOptions {
    startDate?: string;
    endDate?: string;
    includeExpired: boolean;
    unifyRequests: boolean;
    onlyRequests: boolean;
    title?: string;
}

export const generateGeneralEPIReport = (registrations: EPIWithUser[], options: GeneralReportOptions) => {
    const doc = new jsPDF();
    const title = options.title || 'Relatório Geral de EPIs';

    // Title & Header
    doc.setFontSize(18);
    doc.text(title, 14, 22);

    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, 30);

    const filtersText = [];
    if (options.startDate && options.endDate) filtersText.push(`Período: ${new Date(options.startDate).toLocaleDateString('pt-BR')} a ${new Date(options.endDate).toLocaleDateString('pt-BR')}`);
    if (options.onlyRequests) filtersText.push('Filtro: Apenas Solicitações');
    if (options.includeExpired) filtersText.push('Incluindo Vencidos');

    if (filtersText.length > 0) {
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text(filtersText.join(' | '), 14, 36);
        doc.setTextColor(0);
    }

    let bodyData: any[] = [];
    const head = [['Colaborador', 'Setor', 'Equipamento', 'Qtd', 'CA', 'Validade', 'Status']];

    if (options.unifyRequests) {
        // Group by User
        const grouped = registrations.reduce((acc, reg) => {
            const userId = reg.user_id;
            if (!acc[userId]) {
                acc[userId] = {
                    name: reg.user_name || 'N/A',
                    sector: reg.user_sector || 'N/A',
                    items: []
                };
            }
            acc[userId].items.push(reg);
            return acc;
        }, {} as Record<string, { name: string, sector: string, items: EPIWithUser[] }>);

        // Flatten for table but keep visual grouping
        Object.values(grouped).forEach(userGroup => {
            // User Header Row
            bodyData.push([{ content: `${userGroup.name} - ${userGroup.sector}`, colSpan: 7, styles: { fillColor: [240, 240, 240], fontStyle: 'bold' } }]);

            userGroup.items.forEach(reg => {
                const caLevel = getCAValidityLevel(reg.validity_date, (reg as any).ca_status);
                bodyData.push([
                    '', // Indent
                    '', // Indent
                    reg.equipment_type,
                    reg.quantity,
                    reg.equipment_ca || '-',
                    reg.validity_date ? new Date(reg.validity_date).toLocaleDateString('pt-BR') : '-',
                    translateStatus(reg.status)
                ]);
            });
        });

    } else {
        // Flat List
        bodyData = registrations.map(reg => {
            const caLevel = getCAValidityLevel(reg.validity_date, (reg as any).ca_status);
            return [
                reg.user_name || 'N/A',
                reg.user_sector || '-',
                reg.equipment_type,
                reg.quantity,
                reg.equipment_ca || '-',
                reg.validity_date ? new Date(reg.validity_date).toLocaleDateString('pt-BR') : '-',
                translateStatus(reg.status)
            ];
        });
    }

    autoTable(doc, {
        startY: 40,
        head: head,
        body: bodyData,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [41, 128, 185] },
        didParseCell: function (data: any) {
            // Highlight Status if needed
        }
    });

    // Save
    doc.save(`relatorio-epi-geral-${Date.now()}.pdf`);
};

function translateStatus(status: string) {
    const map: Record<string, string> = {
        'delivered': 'Entregue',
        'approved': 'Aprovado',
        'pending': 'Pendente',
        'rejected': 'Reprovado',
        'returned': 'Devolvido'
    };
    return map[status] || status;
}
