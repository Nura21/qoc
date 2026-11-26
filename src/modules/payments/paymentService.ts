import { getDb, notifyDbChanged } from '../../db/client';
import type {
  DocumentDetail,
  DocumentPayment,
  DocumentRecord,
  DocumentStatus,
  PaymentMethod,
  PaymentStatus,
} from '../../types/database';
import { formatRupiah, generateId, nowIsoUtc, todayLocalDate, toIntRupiah } from '../../utils/formatters';
import { documentService, logDocumentActivity } from '../documents/documentService';

export interface RecordPaymentInput {
  amount: number;
  payment_date?: string;
  method?: PaymentMethod;
  giro_due_date?: string | null;
  status?: PaymentStatus;
  proof_path?: string | null;
  notes?: string | null;
}

async function syncDocumentPaidStatus(docId: string): Promise<void> {
  const db = await getDb();
  const docRows = await db.query<DocumentRecord>(
    'SELECT * FROM documents WHERE id = ? AND deleted_at IS NULL LIMIT 1',
    [docId],
  );
  const doc = docRows[0];
  if (!doc) return;

  const sumRows = await db.query<{ total_paid: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS total_paid
     FROM document_payments
     WHERE document_id = ? AND status = 'CONFIRMED'`,
    [docId],
  );
  const confirmedPaid = toIntRupiah(sumRows[0]?.total_paid ?? 0);

  let nextStatus: DocumentStatus = doc.status;
  if (doc.doc_type === 'INVOICE' && doc.status !== 'VOID') {
    if (confirmedPaid >= doc.total_amount && doc.total_amount > 0) {
      nextStatus = 'PAID';
    } else if (confirmedPaid > 0) {
      nextStatus = 'PARTIAL';
    } else if (doc.status === 'PAID' || doc.status === 'PARTIAL') {
      nextStatus = 'SENT';
    }
  }

  await db.run('UPDATE documents SET paid_amount = ?, status = ?, updated_at = ? WHERE id = ?', [
    confirmedPaid,
    nextStatus,
    nowIsoUtc(),
    docId,
  ]);
}

export const paymentService = {
  async record(docId: string, input: RecordPaymentInput): Promise<DocumentDetail> {
    const db = await getDb();
    const amount = toIntRupiah(input.amount);
    if (amount <= 0) {
      throw new Error('Nominal pembayaran harus lebih dari Rp0.');
    }

    const docRows = await db.query<DocumentRecord>(
      'SELECT * FROM documents WHERE id = ? AND deleted_at IS NULL LIMIT 1',
      [docId],
    );
    const doc = docRows[0];
    if (!doc) throw new Error('Invoice tidak ditemukan.');
    if (doc.doc_type !== 'INVOICE') {
      throw new Error('Pembayaran hanya dapat dicatat pada dokumen Invoice.');
    }
    if (doc.status === 'DRAFT' || doc.status === 'VOID') {
      throw new Error('Terbitkan Invoice terlebih dahulu sebelum mencatat pembayaran.');
    }

    const remaining = Math.max(0, doc.total_amount - doc.paid_amount);
    if (remaining <= 0) {
      throw new Error('Invoice ini sudah lunas dan tidak memiliki sisa tagihan.');
    }
    if (amount > remaining) {
      throw new Error(
        `Nominal ${formatRupiah(amount)} melebihi sisa tagihan (${formatRupiah(remaining)}). Periksa kembali jumlah angka nol.`,
      );
    }

    const method: PaymentMethod = input.method ?? 'TRANSFER';
    const status: PaymentStatus = input.status ?? (method === 'GIRO' ? 'PENDING_GIRO' : 'CONFIRMED');
    const paymentDate = input.payment_date || todayLocalDate();
    const paymentId = generateId();

    await db.transaction(async () => {
      await db.run(
        `INSERT INTO document_payments (
          id, document_id, amount, payment_date, method, giro_due_date,
          status, proof_path, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          paymentId,
          docId,
          amount,
          paymentDate,
          method,
          method === 'GIRO' ? input.giro_due_date || null : null,
          status,
          input.proof_path ?? null,
          input.notes?.trim() || null,
          nowIsoUtc(),
        ],
      );

      await syncDocumentPaidStatus(docId);

      await logDocumentActivity(docId, 'PAYMENT_RECORDED', {
        payment_id: paymentId,
        amount,
        method,
        status,
      });
    });

    notifyDbChanged();
    const updated = await documentService.getDetail(docId);
    if (!updated) throw new Error('Gagal memuat Invoice setelah pembayaran.');
    return updated;
  },

  async updateStatus(paymentId: string, nextStatus: PaymentStatus): Promise<DocumentDetail> {
    const db = await getDb();
    const rows = await db.query<DocumentPayment>('SELECT * FROM document_payments WHERE id = ? LIMIT 1', [paymentId]);
    const payment = rows[0];
    if (!payment) throw new Error('Data pembayaran tidak ditemukan.');

    await db.transaction(async () => {
      await db.run('UPDATE document_payments SET status = ? WHERE id = ?', [nextStatus, paymentId]);
      await syncDocumentPaidStatus(payment.document_id);
      await logDocumentActivity(payment.document_id, 'STATUS_CHANGED', {
        payment_id: paymentId,
        payment_status: nextStatus,
      });
    });

    notifyDbChanged();
    const updated = await documentService.getDetail(payment.document_id);
    if (!updated) throw new Error('Gagal memuat Invoice.');
    return updated;
  },

  async remove(paymentId: string): Promise<DocumentDetail> {
    const db = await getDb();
    const rows = await db.query<DocumentPayment>('SELECT * FROM document_payments WHERE id = ? LIMIT 1', [paymentId]);
    const payment = rows[0];
    if (!payment) throw new Error('Data pembayaran tidak ditemukan.');

    await db.transaction(async () => {
      await db.run('DELETE FROM document_payments WHERE id = ?', [paymentId]);
      await syncDocumentPaidStatus(payment.document_id);
      await logDocumentActivity(payment.document_id, 'STATUS_CHANGED', {
        removed_payment_id: paymentId,
        removed_amount: payment.amount,
      });
    });

    notifyDbChanged();
    const updated = await documentService.getDetail(payment.document_id);
    if (!updated) throw new Error('Gagal memuat Invoice.');
    return updated;
  },
};
