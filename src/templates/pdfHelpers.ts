import type { jsPDF } from 'jspdf';

import { formatDisplayDocNumber } from '../modules/documents/documentService';
import type { DocumentDetail } from '../types/database';
import { formatRupiah } from '../utils/formatters';

export function tryAddDataUrlImage(
  pdf: jsPDF,
  dataUrl: string | null | undefined,
  x: number,
  y: number,
  w: number,
  h: number,
): boolean {
  if (!dataUrl || !dataUrl.startsWith('data:image/')) return false;
  try {
    const format = dataUrl.includes('image/jpeg') || dataUrl.includes('image/jpg') ? 'JPEG' : 'PNG';
    pdf.addImage(dataUrl, format, x, y, w, h);
    return true;
  } catch {
    return false;
  }
}

export function drawDocumentHeader(
  pdf: jsPDF,
  detail: DocumentDetail,
  badgeLabel: string,
  accentRgb: [number, number, number],
): number {
  const sender = detail.parsed_sender;
  let y = 16;

  // Top accent bar
  pdf.setFillColor(accentRgb[0], accentRgb[1], accentRgb[2]);
  pdf.rect(0, 0, 210, 4, 'F');

  let textStartX = 15;
  if (tryAddDataUrlImage(pdf, sender?.logo_path, 15, y - 2, 20, 20)) {
    textStartX = 39;
  }

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.setTextColor(15, 23, 42);
  const senderNameWidth = textStartX > 15 ? 86 : 108;
  const senderNameLines = pdf.splitTextToSize(sender?.name || 'Profil Usaha', senderNameWidth);
  pdf.text(senderNameLines, textStartX, y + 4);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(71, 85, 105);
  let senderSubY = y + 4 + senderNameLines.length * 5.2;
  if (sender?.phone_wa) {
    pdf.text(`WA/Telp: ${sender.phone_wa}`, textStartX, senderSubY);
    senderSubY += 4.5;
  }
  if (sender?.address) {
    const addrLines = pdf.splitTextToSize(sender.address, 85);
    pdf.text(addrLines, textStartX, senderSubY);
    senderSubY += addrLines.length * 4;
  }

  // Right side document badge & number
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.setTextColor(accentRgb[0], accentRgb[1], accentRgb[2]);
  pdf.text(badgeLabel, 195, y + 4, { align: 'right' });

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(30, 41, 59);
  pdf.text(formatDisplayDocNumber(detail), 195, y + 10, { align: 'right' });

  y = Math.max(senderSubY + 4, 38);
  pdf.setDrawColor(226, 232, 240);
  pdf.line(15, y, 195, y);

  return y + 6;
}

export function drawItemsTable(pdf: jsPDF, detail: DocumentDetail, startY: number, showPrices = true): number {
  let y = startY;

  pdf.setFillColor(241, 245, 249);
  pdf.rect(15, y, 180, 8, 'F');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.5);
  pdf.setTextColor(51, 65, 85);
  pdf.text('No', 18, y + 5.3);
  pdf.text('Deskripsi Barang / Jasa', 28, y + 5.3);

  if (showPrices) {
    pdf.text('Qty', 120, y + 5.3, { align: 'right' });
    pdf.text('Harga Satuan', 155, y + 5.3, { align: 'right' });
    pdf.text('Jumlah', 192, y + 5.3, { align: 'right' });
  } else {
    pdf.text('Kuantitas', 165, y + 5.3, { align: 'right' });
    pdf.text('Satuan', 190, y + 5.3, { align: 'right' });
  }

  y += 10;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);

  detail.items.forEach((item, idx) => {
    if (y > 255) {
      pdf.addPage();
      y = 20;
    }

    const nameWidth = showPrices ? 76 : 115;
    const nameLines = pdf.splitTextToSize(item.item_name, nameWidth);
    const descLines = item.description ? pdf.splitTextToSize(item.description, nameWidth) : [];
    const rowHeight = Math.max(7, nameLines.length * 4.5 + descLines.length * 4 + 2);

    pdf.setTextColor(15, 23, 42);
    pdf.text(String(idx + 1), 18, y + 3.5);
    pdf.setFont('helvetica', 'bold');
    pdf.text(nameLines, 28, y + 3.5);

    if (descLines.length > 0) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(100, 116, 139);
      pdf.text(descLines, 28, y + 3.5 + nameLines.length * 4.5);
      pdf.setFontSize(9);
    }

    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(30, 41, 59);
    if (showPrices) {
      pdf.text(`${item.qty} ${item.unit}`, 120, y + 3.5, { align: 'right' });
      pdf.text(formatRupiah(item.unit_price), 155, y + 3.5, { align: 'right' });
      pdf.setFont('helvetica', 'bold');
      pdf.text(formatRupiah(item.line_total), 192, y + 3.5, { align: 'right' });
    } else {
      pdf.text(String(item.qty), 165, y + 3.5, { align: 'right' });
      pdf.text(item.unit, 190, y + 3.5, { align: 'right' });
    }

    y += rowHeight;
    pdf.setDrawColor(241, 245, 249);
    pdf.line(15, y, 195, y);
    y += 2;
  });

  return y + 2;
}

export function drawTotalsBlock(pdf: jsPDF, detail: DocumentDetail, startY: number): number {
  let y = startY;
  if (y > 245) {
    pdf.addPage();
    y = 20;
  }

  const labelX = 128;
  const valX = 192;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(71, 85, 105);
  pdf.text('Subtotal', labelX, y);
  pdf.setTextColor(15, 23, 42);
  pdf.text(formatRupiah(detail.subtotal), valX, y, { align: 'right' });
  y += 5.5;

  if (detail.discount_amount > 0) {
    pdf.setTextColor(71, 85, 105);
    pdf.text('Diskon', labelX, y);
    pdf.setTextColor(220, 38, 38);
    pdf.text(`-${formatRupiah(detail.discount_amount)}`, valX, y, { align: 'right' });
    y += 5.5;
  }

  if (detail.tax_amount > 0) {
    pdf.setTextColor(71, 85, 105);
    pdf.text('Pajak (PPN)', labelX, y);
    pdf.setTextColor(15, 23, 42);
    pdf.text(formatRupiah(detail.tax_amount), valX, y, { align: 'right' });
    y += 5.5;
  }

  pdf.setDrawColor(203, 213, 225);
  pdf.line(labelX, y - 2, 195, y - 2);
  y += 3;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(15, 23, 42);
  pdf.text('TOTAL', labelX, y);
  pdf.text(formatRupiah(detail.total_amount), valX, y, { align: 'right' });

  return y + 8;
}

export function drawSignatureBlock(
  pdf: jsPDF,
  detail: DocumentDetail,
  startY: number,
  includeClientSignature = false,
): void {
  let y = startY;
  if (y > 240) {
    pdf.addPage();
    y = 25;
  }

  const sender = detail.parsed_sender;
  const client = detail.parsed_client;

  if (includeClientSignature) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(71, 85, 105);
    pdf.text('Pihak Kedua (Penerima),', 25, y);
    pdf.setDrawColor(148, 163, 184);
    pdf.line(25, y + 26, 80, y + 26);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(15, 23, 42);
    pdf.text(client?.name || 'Klien', 25, y + 31);
  }

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(71, 85, 105);
  pdf.text(includeClientSignature ? 'Pihak Pertama (Pelaksana),' : 'Hormat kami,', 140, y);

  tryAddDataUrlImage(pdf, sender?.signature_path, 142, y + 3, 35, 20);

  pdf.setDrawColor(148, 163, 184);
  pdf.line(140, y + 26, 192, y + 26);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(15, 23, 42);
  pdf.text(sender?.name || 'Pengirim', 140, y + 31);
}
