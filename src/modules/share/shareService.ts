import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import type { jsPDF } from 'jspdf';

import { notifyDbChanged } from '../../db/client';
import type { DocumentDetail } from '../../types/database';
import { formatDateId, formatRupiah, normalizeWaPhone } from '../../utils/formatters';
import { documentService, formatDisplayDocNumber, logDocumentActivity } from '../documents/documentService';

/**
 * Lazy-loads the jsPDF template on demand so the heavy PDF engine is excluded
 * from the initial cold-start JavaScript bundle.
 */
async function buildPdfForDocument(detail: DocumentDetail): Promise<jsPDF> {
  if (detail.doc_type === 'QUOTATION') {
    const { renderQuotationPdf } = await import('../../templates/quotationPdf');
    return renderQuotationPdf(detail);
  }
  if (detail.doc_type === 'BAST') {
    const { renderBastPdf } = await import('../../templates/bastPdf');
    return renderBastPdf(detail);
  }
  const { renderInvoicePdf } = await import('../../templates/invoicePdf');
  return renderInvoicePdf(detail);
}

function buildPdfFilename(detail: DocumentDetail): string {
  const safe = detail.doc_number.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${safe}${detail.revision_no > 0 ? `_Rev${detail.revision_no}` : ''}.pdf`;
}

export const shareService = {
  buildShareMessage(detail: DocumentDetail): string {
    const senderName = detail.parsed_sender?.name || 'Kami';
    const clientName = detail.parsed_client?.name || detail.client_name || 'Bapak/Ibu';
    const docNum = formatDisplayDocNumber(detail);

    if (detail.doc_type === 'QUOTATION') {
      return `Halo ${clientName},\n\nBerikut kami lampirkan dokumen Penawaran Harga *${docNum}*${detail.title ? ` untuk *${detail.title}*` : ''} senilai *${formatRupiah(detail.total_amount)}*.\n\nSilakan ditinjau, apabila ada pertanyaan atau penyesuaian ruang lingkup silakan kabari kami.\n\nTerima kasih,\n*${senderName}*`;
    }

    if (detail.doc_type === 'BAST') {
      return `Halo ${clientName},\n\nBerikut kami lampirkan Berita Acara Serah Terima (*${docNum}*)${detail.title ? ` untuk *${detail.title}*` : ''}.\n\nTerima kasih atas kerja samanya,\n*${senderName}*`;
    }

    const remaining = Math.max(0, detail.total_amount - detail.paid_amount);
    const bankInfo = detail.parsed_sender?.bank_account_no
      ? `\n\nPembayaran dapat ditransfer ke:\n${detail.parsed_sender.bank_name || 'Bank'} *${detail.parsed_sender.bank_account_no}* a.n. ${detail.parsed_sender.bank_account_name || senderName}`
      : '';

    return `Halo ${clientName},\n\nBerikut kami sampaikan Invoice *${docNum}*${detail.title ? ` (${detail.title})` : ''} dengan tagihan sebesar *${formatRupiah(remaining)}* (Jatuh tempo: ${formatDateId(detail.due_date)}).${bankInfo}\n\nTerima kasih,\n*${senderName}*`;
  },

  buildReminderMessage(detail: DocumentDetail): string {
    const sender = detail.parsed_sender;
    const senderName = sender?.name || 'Kami';
    const clientName = detail.parsed_client?.name || detail.client_name || 'Bapak/Ibu';
    const docNum = formatDisplayDocNumber(detail);
    const remaining = Math.max(0, detail.total_amount - detail.paid_amount);

    const bankLine = sender?.bank_account_no
      ? `\n\nRekening tujuan:\n*${sender.bank_name || 'Bank'} ${sender.bank_account_no}*\na.n. ${sender.bank_account_name || senderName}`
      : '';

    return `Halo ${clientName}, semoga sehat selalu.\n\nIzin mengingatkan secara sopan terkait Invoice *${docNum}*${detail.title ? ` (${detail.title})` : ''} dengan sisa tagihan sebesar *${formatRupiah(remaining)}* (Jatuh tempo: ${formatDateId(detail.due_date)}).${bankLine}\n\nApabila pembayaran sudah dilakukan, mohon abaikan pesan ini atau kirimkan bukti transfernya agar segera kami catat lunas.\n\nTerima kasih banyak,\n*${senderName}*`;
  },

  async sharePdfToWA(docId: string): Promise<{ filename: string; detail: DocumentDetail }> {
    let detail = await documentService.getDetail(docId);
    if (!detail) throw new Error('Dokumen tidak ditemukan.');

    if (detail.status === 'DRAFT') {
      detail = await documentService.publish(docId);
    }

    const pdf = await buildPdfForDocument(detail);
    const filename = buildPdfFilename(detail);
    const caption = this.buildShareMessage(detail);

    if (Capacitor.isNativePlatform()) {
      const dataUri = pdf.output('datauristring');
      const base64Data = dataUri.split(',')[1] ?? '';
      const written = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Cache,
      });

      await Share.share({
        title: filename,
        text: caption,
        url: written.uri,
        dialogTitle: 'Kirim PDF ke WhatsApp',
      });
    } else if (typeof window !== 'undefined') {
      const blob = pdf.output('blob');
      const file = new File([blob], filename, { type: 'application/pdf' });
      const nav = navigator as Navigator & {
        canShare?: (data?: ShareData) => boolean;
      };

      if (typeof nav.share === 'function' && nav.canShare?.({ files: [file] })) {
        await nav.share({
          title: filename,
          text: caption,
          files: [file],
        });
      } else {
        pdf.save(filename);
        const waPhone = normalizeWaPhone(detail.parsed_client?.phone_wa || detail.client_phone_wa);
        const waUrl = waPhone
          ? `https://wa.me/${waPhone}?text=${encodeURIComponent(caption)}`
          : `https://wa.me/?text=${encodeURIComponent(caption)}`;
        window.open(waUrl, '_blank', 'noopener,noreferrer');
      }
    }

    await logDocumentActivity(detail.id, 'SHARED_PDF_WA', { filename });
    notifyDbChanged();
    const refreshed = await documentService.getDetail(detail.id);
    return { filename, detail: refreshed ?? detail };
  },

  async downloadPdfOnly(docId: string): Promise<string> {
    const detail = await documentService.getDetail(docId);
    if (!detail) throw new Error('Dokumen tidak ditemukan.');
    const pdf = await buildPdfForDocument(detail);
    const filename = buildPdfFilename(detail);

    if (Capacitor.isNativePlatform()) {
      const dataUri = pdf.output('datauristring');
      const base64Data = dataUri.split(',')[1] ?? '';
      try {
        await Filesystem.writeFile({
          path: `QOC/${filename}`,
          data: base64Data,
          directory: Directory.Documents,
          recursive: true,
        });
        return `Documents/QOC/${filename}`;
      } catch {
        // Fallback for strict scoped storage: write to Cache and invoke native Share sheet to save/print
        const cached = await Filesystem.writeFile({
          path: filename,
          data: base64Data,
          directory: Directory.Cache,
        });
        await Share.share({
          title: filename,
          url: cached.uri,
          dialogTitle: 'Simpan atau Cetak PDF',
        });
        return filename;
      }
    }

    pdf.save(filename);
    return filename;
  },

  async openReminderWA(docId: string): Promise<string> {
    const detail = await documentService.getDetail(docId);
    if (!detail) throw new Error('Invoice tidak ditemukan.');

    const message = this.buildReminderMessage(detail);
    const waPhone = normalizeWaPhone(detail.parsed_client?.phone_wa || detail.client_phone_wa);
    const waUrl = waPhone
      ? `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    if (typeof window !== 'undefined') {
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    }

    await logDocumentActivity(docId, 'REMINDED_WA', { phone_wa: waPhone || null });
    notifyDbChanged();
    return waUrl;
  },
};
