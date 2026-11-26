import { jsPDF } from 'jspdf';

import type { DocumentDetail } from '../types/database';
import { formatDateId, formatRupiah } from '../utils/formatters';

import { drawDocumentHeader, drawItemsTable, drawSignatureBlock, drawTotalsBlock } from './pdfHelpers';

export function renderInvoicePdf(detail: DocumentDetail): jsPDF {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let y = drawDocumentHeader(pdf, detail, 'INVOICE', [37, 99, 235]);

  const client = detail.parsed_client;
  const sender = detail.parsed_sender;

  const statusText =
    detail.status === 'PAID'
      ? 'LUNAS (PAID)'
      : detail.is_overdue
        ? 'JATUH TEMPO (OVERDUE)'
        : detail.status === 'PARTIAL'
          ? 'BAYAR SEBAGIAN (DP/CICILAN)'
          : 'BELUM LUNAS';

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.5);
  pdf.setTextColor(100, 116, 139);
  pdf.text('DITAGIHKAN KEPADA:', 15, y);
  pdf.text('INFORMASI TAGIHAN:', 125, y);
  y += 5;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(15, 23, 42);
  const clientNameLines = pdf.splitTextToSize(client?.name || detail.client_name || 'Klien', 100);
  pdf.text(clientNameLines, 15, y);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(71, 85, 105);
  pdf.text(`Tgl Invoice    : ${formatDateId(detail.issue_date)}`, 125, y);
  pdf.text(`Jatuh Tempo : ${formatDateId(detail.due_date)}`, 125, y + 4.5);

  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(
    detail.status === 'PAID' ? 21 : detail.is_overdue ? 220 : 15,
    detail.status === 'PAID' ? 128 : detail.is_overdue ? 38 : 118,
    detail.status === 'PAID' ? 61 : detail.is_overdue ? 38 : 110,
  );
  pdf.text(`Status           : ${statusText}`, 125, y + 9);

  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(71, 85, 105);
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

  y = Math.max(leftY + 2, y + 14);

  if (detail.title) {
    y += 2;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(15, 23, 42);
    const titleLines = pdf.splitTextToSize(`Proyek / Pekerjaan: ${detail.title}`, 180);
    pdf.text(titleLines, 15, y);
    y += titleLines.length * 4.8 + 2;
  } else {
    y += 4;
  }

  y = drawItemsTable(pdf, detail, y, true);
  y = drawTotalsBlock(pdf, detail, y);

  // Paid & Remaining Summary
  const remaining = Math.max(0, detail.total_amount - detail.paid_amount);
  if (detail.paid_amount > 0 || detail.status === 'PAID') {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(21, 128, 61);
    pdf.text('Sudah Dibayar', 128, y);
    pdf.text(formatRupiah(detail.paid_amount), 192, y, { align: 'right' });
    y += 5.5;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(remaining === 0 ? 21 : 185, remaining === 0 ? 128 : 28, remaining === 0 ? 61 : 28);
    pdf.text('SISA TAGIHAN', 128, y);
    pdf.text(formatRupiah(remaining), 192, y, { align: 'right' });
    y += 8;
  }

  // Bank Account Box
  if (sender?.bank_name || sender?.bank_account_no) {
    if (y > 235) {
      pdf.addPage();
      y = 20;
    }
    pdf.setFillColor(240, 253, 250);
    pdf.roundedRect(15, y, 105, 22, 2, 2, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.5);
    pdf.setTextColor(15, 118, 110);
    pdf.text('PEMBAYARAN TRANSFER KE REKENING:', 19, y + 5.5);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9.5);
    pdf.setTextColor(15, 23, 42);
    pdf.text(`${sender.bank_name || ''} — ${sender.bank_account_no || ''}`, 19, y + 11.5);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(71, 85, 105);
    pdf.text(`a.n. ${sender.bank_account_name || sender.name}`, 19, y + 17);
    y += 26;
  }

  if (detail.notes) {
    const noteLines = pdf.splitTextToSize(`Catatan: ${detail.notes}`, 180);
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(8.5);
    pdf.setTextColor(100, 116, 139);
    pdf.text(noteLines, 15, y + 2);
    y += noteLines.length * 4 + 4;
  }

  drawSignatureBlock(pdf, detail, y + 3, false);
  return pdf;
}
