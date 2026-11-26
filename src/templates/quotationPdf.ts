import { jsPDF } from 'jspdf';

import type { DocumentDetail } from '../types/database';
import { formatDateId } from '../utils/formatters';

import { drawDocumentHeader, drawItemsTable, drawSignatureBlock, drawTotalsBlock } from './pdfHelpers';

export function renderQuotationPdf(detail: DocumentDetail): jsPDF {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let y = drawDocumentHeader(pdf, detail, 'QUOTATION', [37, 99, 235]);

  const client = detail.parsed_client;

  // Client & Meta Box
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.5);
  pdf.setTextColor(100, 116, 139);
  pdf.text('KEPADA YTH:', 15, y);
  pdf.text('DETAIL PENAWARAN:', 125, y);
  y += 5;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(15, 23, 42);
  const clientNameLines = pdf.splitTextToSize(client?.name || detail.client_name || 'Klien', 100);
  pdf.text(clientNameLines, 15, y);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(71, 85, 105);
  pdf.text(`Tanggal Terbit : ${formatDateId(detail.issue_date)}`, 125, y);
  pdf.text(`Berlaku s/d     : ${formatDateId(detail.valid_until)}`, 125, y + 4.5);

  let leftY = y + clientNameLines.length * 4.5;
  if (client?.company_name) {
    const compLines = pdf.splitTextToSize(client.company_name, 100);
    pdf.text(compLines, 15, leftY);
    leftY += compLines.length * 4.2;
  }

  if (client?.address) {
    const addr = pdf.splitTextToSize(client.address, 100);
    pdf.text(addr, 15, leftY);
    leftY += addr.length * 4;
  }

  y = Math.max(leftY + 2, y + 11);

  if (detail.title) {
    y += 2;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(15, 23, 42);
    const titleLines = pdf.splitTextToSize(`Perihal: ${detail.title}`, 180);
    pdf.text(titleLines, 15, y);
    y += titleLines.length * 4.8 + 2;
  } else {
    y += 4;
  }

  y = drawItemsTable(pdf, detail, y, true);
  y = drawTotalsBlock(pdf, detail, y);

  if (detail.scope_and_terms) {
    if (y > 235) {
      pdf.addPage();
      y = 20;
    }
    pdf.setFillColor(248, 250, 252);
    const scopeLines = pdf.splitTextToSize(detail.scope_and_terms, 172);
    const boxH = scopeLines.length * 4.2 + 10;
    pdf.roundedRect(15, y, 180, boxH, 2, 2, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.5);
    pdf.setTextColor(30, 41, 59);
    pdf.text('RUANG LINGKUP & SYARAT PENAWARAN:', 19, y + 5.5);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(71, 85, 105);
    pdf.text(scopeLines, 19, y + 10.5);
    y += boxH + 5;
  }

  if (detail.notes) {
    const noteLines = pdf.splitTextToSize(`Catatan: ${detail.notes}`, 180);
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(8.5);
    pdf.setTextColor(100, 116, 139);
    pdf.text(noteLines, 15, y + 3);
    y += noteLines.length * 4 + 5;
  }

  drawSignatureBlock(pdf, detail, y + 4, false);
  return pdf;
}
