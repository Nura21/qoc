import { jsPDF } from 'jspdf';

import type { DocumentDetail } from '../types/database';
import { formatDateId } from '../utils/formatters';

import { drawDocumentHeader, drawItemsTable, drawSignatureBlock } from './pdfHelpers';

export function renderBastPdf(detail: DocumentDetail): jsPDF {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let y = drawDocumentHeader(pdf, detail, 'BERITA ACARA (BAST)', [79, 70, 229]);

  const sender = detail.parsed_sender;
  const client = detail.parsed_client;
  const handoverDate = formatDateId(detail.handover_date || detail.issue_date);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5);
  pdf.setTextColor(30, 41, 59);

  const intro = `Pada tanggal ${handoverDate}, yang bertanda tangan di bawah ini menyatakan bahwa Pihak Pertama (${sender?.name || 'Pelaksana'}) telah menyerahkan hasil pekerjaan/barang kepada Pihak Kedua (${client?.name || detail.client_name || 'Penerima'}${client?.company_name ? ` - ${client.company_name}` : ''}) dalam kondisi baik dan sesuai kesepakatan untuk pekerjaan:`;
  const introLines = pdf.splitTextToSize(intro, 180);
  pdf.text(introLines, 15, y);
  y += introLines.length * 4.8 + 3;

  if (detail.title) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(15, 23, 42);
    const titleLines = pdf.splitTextToSize(`Nama Pekerjaan: ${detail.title}`, 180);
    pdf.text(titleLines, 15, y);
    y += titleLines.length * 4.8 + 2.5;
  }

  y = drawItemsTable(pdf, detail, y, false);

  if (detail.notes || detail.scope_and_terms) {
    const combined = [detail.scope_and_terms, detail.notes].filter(Boolean).join('\n');
    const lines = pdf.splitTextToSize(`Keterangan Serah Terima:\n${combined}`, 180);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(71, 85, 105);
    pdf.text(lines, 15, y + 4);
    y += lines.length * 4.2 + 8;
  }

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(30, 41, 59);
  const closing =
    'Demikian Berita Acara Serah Terima (BAST) ini dibuat dengan sebenarnya untuk dapat dipergunakan sebagaimana mestinya.';
  const closingLines = pdf.splitTextToSize(closing, 180);
  pdf.text(closingLines, 15, y + 2);
  y += closingLines.length * 4.5 + 8;

  drawSignatureBlock(pdf, detail, y, true);
  return pdf;
}
