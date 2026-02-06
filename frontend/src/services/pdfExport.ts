/**
 * TrustonicReporting - PDF Export Service
 */
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { DashboardKPIs, Device } from './api';

export interface ExportOptions {
    title: string;
    subtitle?: string;
    filters?: Record<string, string>;
    kpis?: DashboardKPIs;
    devices?: Device[];
    chartsElement?: HTMLElement;
}

/**
 * Exporta el dashboard a PDF
 */
export async function exportToPDF(options: ExportOptions): Promise<void> {
    const { title, subtitle, filters, kpis, devices, chartsElement } = options;

    const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    let yPos = margin;

    // Header
    pdf.setFillColor(0, 102, 230); // Primary color
    pdf.rect(0, 0, pageWidth, 25, 'F');

    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.text(title, margin, 16);

    if (subtitle) {
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.text(subtitle, pageWidth - margin, 16, { align: 'right' });
    }

    yPos = 35;
    pdf.setTextColor(0, 0, 0);

    // Filters applied
    if (filters && Object.values(filters).some(v => v)) {
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Filtros aplicados:', margin, yPos);
        yPos += 5;

        pdf.setFont('helvetica', 'normal');
        const activeFilters = Object.entries(filters)
            .filter(([_, v]) => v)
            .map(([k, v]) => `${k}: ${v}`)
            .join(' | ');
        pdf.text(activeFilters, margin, yPos);
        yPos += 10;
    }

    // KPIs
    if (kpis) {
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Resumen de KPIs', margin, yPos);
        yPos += 8;

        const kpiData = [
            ['Total Dispositivos', String(kpis.total_devices)],
            ['Completados', String(kpis.completed)],
            ['En Pruebas', String(kpis.testing)],
            ['Con Problemas', String(kpis.with_issues)],
            ['Sin Iniciar', String(kpis.not_started)],
            ['Cancelados', String(kpis.cancelled)],
        ];

        pdf.setFontSize(10);
        const kpiWidth = (pageWidth - 2 * margin) / kpiData.length;

        kpiData.forEach((kpi, index) => {
            const x = margin + index * kpiWidth;

            // KPI box
            pdf.setFillColor(248, 250, 252);
            pdf.roundedRect(x, yPos, kpiWidth - 5, 20, 2, 2, 'F');

            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(107, 114, 128);
            pdf.text(kpi[0], x + 5, yPos + 7);

            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(17, 24, 39);
            pdf.setFontSize(14);
            pdf.text(kpi[1], x + 5, yPos + 16);
            pdf.setFontSize(10);
        });

        yPos += 30;
    }

    // Charts (if element provided)
    if (chartsElement) {
        try {
            // Identificar los grupos de gráficos dentro del contenedor
            const chartGroups = Array.from(chartsElement.children) as HTMLElement[];

            for (const group of chartGroups) {
                const canvas = await html2canvas(group, {
                    scale: 3,
                    backgroundColor: '#ffffff',
                    logging: false,
                    useCORS: true,
                    allowTaint: true
                });

                const imgData = canvas.toDataURL('image/png', 1.0);
                const imgWidth = pageWidth - 2 * margin;
                const originalRatio = canvas.height / canvas.width;
                let imgHeight = imgWidth * originalRatio;

                const maxPageHeight = pageHeight - 2 * margin;
                let remainingSpace = pageHeight - yPos - margin;

                // Si el gráfico no cabe en lo que queda de página, saltar
                if (imgHeight > remainingSpace) {
                    // Solo saltamos si el gráfico cabe en una página nueva o si ya hay contenido
                    if (yPos > margin + 10) {
                        pdf.addPage();
                        yPos = margin;
                        remainingSpace = pageHeight - 2 * margin;
                    }
                }

                // Si sigue siendo más alto que una página completa, escalar
                if (imgHeight > maxPageHeight) {
                    const scale = maxPageHeight / imgHeight;
                    imgHeight = maxPageHeight;
                    const scaledWidth = imgWidth * scale;
                    const xOffset = margin + (imgWidth - scaledWidth) / 2;
                    pdf.addImage(imgData, 'PNG', xOffset, yPos, scaledWidth, imgHeight);
                } else {
                    pdf.addImage(imgData, 'PNG', margin, yPos, imgWidth, imgHeight);
                }

                yPos += imgHeight + 10;
            }
        } catch (error) {
            console.error('Error capturing charts:', error);
        }
    }

    // Devices table
    if (devices && devices.length > 0) {
        // New page for table
        pdf.addPage();
        yPos = margin;

        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(0, 0, 0);
        pdf.text(`Dispositivos (${devices.length})`, margin, yPos);
        yPos += 8;

        // Table headers
        const headers = ['Marca', 'Dispositivo', 'Modelo', 'Región', 'Cliente', 'Estado'];
        const colWidths = [30, 45, 40, 35, 50, 30];

        pdf.setFillColor(243, 244, 246);
        pdf.rect(margin, yPos, pageWidth - 2 * margin, 8, 'F');

        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(75, 85, 99);

        let xPos = margin + 2;
        headers.forEach((header, i) => {
            pdf.text(header.toUpperCase(), xPos, yPos + 5);
            xPos += colWidths[i];
        });

        yPos += 10;

        // Table rows
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(55, 65, 81);

        const maxRows = 200; // Aumentamos para que quiten más dispositivos (ej. los 168 actuales)
        const displayDevices = devices.slice(0, maxRows);

        displayDevices.forEach((device, rowIndex) => {
            if (yPos > pageHeight - 20) {
                pdf.addPage();
                yPos = margin;
            }

            // Alternate row colors
            if (rowIndex % 2 === 0) {
                pdf.setFillColor(249, 250, 251);
                pdf.rect(margin, yPos - 4, pageWidth - 2 * margin, 7, 'F');
            }

            xPos = margin + 2;

            const rowData = [
                device.brand || '-',
                device.device || '-',
                device.model || '-',
                device.target_region || '-',
                device.target_customer || '-',
                device.status || '-',
            ];

            rowData.forEach((cell, i) => {
                const text = cell.length > 15 ? cell.substring(0, 12) + '...' : cell;
                pdf.text(text, xPos, yPos);
                xPos += colWidths[i];
            });

            yPos += 7;
        });

        if (devices.length > maxRows) {
            yPos += 5;
            pdf.setFontSize(9);
            pdf.setTextColor(107, 114, 128);
            pdf.text(`... y ${devices.length - maxRows} dispositivos más`, margin, yPos);
        }
    }

    // Footer
    const totalPages = pdf.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(156, 163, 175);
        pdf.text(
            `Generado el ${new Date().toLocaleDateString('es-MX')} - Página ${i} de ${totalPages}`,
            pageWidth / 2,
            pageHeight - 8,
            { align: 'center' }
        );
    }

    // Download
    const filename = `TrustonicReport_${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(filename);
}
