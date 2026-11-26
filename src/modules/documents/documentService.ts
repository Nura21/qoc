import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

import { getDb, notifyDbChanged } from '../../db/client';
import {
  adjustTrackedStock,
  DOCUMENT_OVERDUE_EXPR,
  type InsertDocumentItemParams,
  insertDocumentItems,
  insertDocumentRow,
} from '../../db/documentSqlHelpers';
import type {
  ActivityActionType,
  ClientSnapshot,
  DocumentActivity,
  DocumentDetail,
  DocumentItem,
  DocumentPayment,
  DocumentRecord,
  DocumentSequence,
  DocumentStatus,
  DocType,
  ItemType,
  SenderSnapshot,
} from '../../types/database';
import { generateId, nowIsoUtc, periodYmFromDate, todayLocalDate, toIntRupiah } from '../../utils/formatters';
import { clientService } from '../clients/clientService';
import { profileService } from '../profile/profileService';

export interface DraftItemInput {
  id?: string;
  catalog_item_id?: string | null;
  item_name: string;
  description?: string | null;
  qty: number;
  unit: string;
  unit_price: number;
  saveToCatalog?: boolean;
  saveCatalogType?: ItemType;
}

export interface SaveDraftInput {
  id?: string;
  client_id: string | null;
  doc_type: DocType;
  title?: string | null;
  issue_date?: string;
  valid_until?: string | null;
  due_date?: string | null;
  handover_date?: string | null;
  discount_amount?: number;
  tax_amount?: number;
  scope_and_terms?: string | null;
  notes?: string | null;
}

export interface ListDocumentsFilter {
  docType?: DocType | 'ALL';
  status?: DocumentStatus | 'OVERDUE' | 'ALL';
  query?: string;
}

export interface ConvertOptions {
  mode?: 'FULL' | 'DP_PERCENT';
  dpPercent?: number;
  dueDate?: string;
  handoverDate?: string;
  autoPublish?: boolean;
}

export interface DashboardSummary {
  unpaidInvoiceCount: number;
  unpaidTotalAmount: number;
  overdueCount: number;
  overdueTotalAmount: number;
  waitingQuotationCount: number;
  paidThisMonthAmount: number;
  totalPaidAmount: number;
  activeCatalogCount: number;
  urgentInvoices: DocumentRecord[];
  recentDocuments: DocumentRecord[];
}

function makeDraftCode(docId: string): string {
  return `DRAFT-${docId.slice(0, 8).toUpperCase()}`;
}

function parseJsonSafe<T>(json: string | null): T | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

export function formatDisplayDocNumber(doc: Pick<DocumentRecord, 'doc_number' | 'revision_no'>): string {
  return doc.revision_no > 0 ? `${doc.doc_number} (Rev.${doc.revision_no})` : doc.doc_number;
}

export async function logDocumentActivity(
  documentId: string,
  actionType: ActivityActionType,
  metadataObj?: Record<string, unknown>,
): Promise<void> {
  const db = await getDb();
  await db.run(
    'INSERT INTO document_activities (id, document_id, action_type, metadata, created_at) VALUES (?, ?, ?, ?, ?)',
    [generateId(), documentId, actionType, metadataObj ? JSON.stringify(metadataObj) : null, nowIsoUtc()],
  );
}

async function allocateAtomicDocNumber(docType: DocType, issueDate: string): Promise<string> {
  const db = await getDb();
  const profile = await profileService.get();
  const prefix =
    docType === 'QUOTATION'
      ? profile?.prefix_quotation || 'QUO'
      : docType === 'INVOICE'
        ? profile?.prefix_invoice || 'INV'
        : profile?.prefix_bast || 'BAST';

  const periodYm = periodYmFromDate(issueDate);
  const existingRows = await db.query<DocumentSequence>(
    'SELECT * FROM document_sequences WHERE doc_type = ? AND period_ym = ? LIMIT 1',
    [docType, periodYm],
  );

  let nextNumber = 1;
  if (existingRows.length > 0) {
    nextNumber = existingRows[0].last_number + 1;
    await db.run('UPDATE document_sequences SET last_number = ? WHERE id = ?', [nextNumber, existingRows[0].id]);
  } else {
    await db.run('INSERT INTO document_sequences (id, doc_type, period_ym, last_number) VALUES (?, ?, ?, ?)', [
      generateId(),
      docType,
      periodYm,
      1,
    ]);
  }

  return `${prefix}-${periodYm}-${String(nextNumber).padStart(3, '0')}`;
}

async function scheduleInvoiceReminderIfNative(doc: DocumentRecord): Promise<void> {
  if (!Capacitor.isNativePlatform() || doc.doc_type !== 'INVOICE' || !doc.due_date) return;
  try {
    const dueMs = new Date(`${doc.due_date}T09:00:00`).getTime();
    const remindMs = dueMs - 2 * 24 * 60 * 60 * 1000;
    if (remindMs <= Date.now()) return;

    const perm = await LocalNotifications.requestPermissions();
    if (perm.display !== 'granted') return;

    const numericId = Math.abs(doc.id.split('').reduce((acc, ch) => ((acc << 5) - acc + ch.charCodeAt(0)) | 0, 0));
    await LocalNotifications.schedule({
      notifications: [
        {
          id: numericId % 2147483000,
          title: `Pengingat Tagihan ${doc.doc_number}`,
          body: `Invoice jatuh tempo pada ${doc.due_date}. Ketuk aplikasi untuk kirim pengingat WA.`,
          schedule: { at: new Date(remindMs) },
        },
      ],
    });
  } catch {
    // Optional native notification; never block publish
  }
}

function hydrateDocumentRow(row: DocumentRecord & { is_overdue_flag?: number }): DocumentRecord {
  const snapClient = parseJsonSafe<ClientSnapshot>(row.client_snapshot);
  return {
    ...row,
    client_name: snapClient?.name ?? row.client_name ?? 'Tanpa Klien',
    client_company: snapClient?.company_name ?? row.client_company ?? null,
    client_phone_wa: snapClient?.phone_wa ?? row.client_phone_wa ?? null,
    is_overdue: Boolean(row.is_overdue_flag),
  };
}

export const documentService = {
  async list(filter?: ListDocumentsFilter): Promise<DocumentRecord[]> {
    const db = await getDb();
    const clauses: string[] = ['d.deleted_at IS NULL'];
    const params: (string | number)[] = [];

    if (filter?.docType && filter.docType !== 'ALL') {
      clauses.push('d.doc_type = ?');
      params.push(filter.docType);
    }

    if (filter?.status && filter.status !== 'ALL') {
      if (filter.status === 'OVERDUE') {
        clauses.push(
          "d.doc_type = 'INVOICE' AND d.status IN ('SENT', 'PARTIAL') AND d.due_date IS NOT NULL AND d.due_date < date('now', 'localtime')",
        );
      } else {
        clauses.push('d.status = ?');
        params.push(filter.status);
      }
    }

    if (filter?.query?.trim()) {
      const like = `%${filter.query.trim()}%`;
      clauses.push(
        '(d.doc_number LIKE ? OR d.title LIKE ? OR c.name LIKE ? OR c.company_name LIKE ? OR d.client_snapshot LIKE ?)',
      );
      params.push(like, like, like, like, like);
    }

    const sql = `
      SELECT
        d.*,
        c.name AS client_name,
        c.company_name AS client_company,
        c.phone_wa AS client_phone_wa,
        ${DOCUMENT_OVERDUE_EXPR} AS is_overdue_flag
      FROM documents d
      LEFT JOIN clients c ON c.id = d.client_id
      WHERE ${clauses.join(' AND ')}
      ORDER BY d.created_at DESC
    `;

    const rows = await db.query<DocumentRecord & { is_overdue_flag?: number }>(sql, params);
    return rows.map(hydrateDocumentRow);
  },

  async getDetail(docId: string): Promise<DocumentDetail | null> {
    const db = await getDb();
    const docs = await db.query<DocumentRecord & { is_overdue_flag?: number }>(
      `SELECT
        d.*,
        c.name AS client_name,
        c.company_name AS client_company,
        c.phone_wa AS client_phone_wa,
        ${DOCUMENT_OVERDUE_EXPR} AS is_overdue_flag
       FROM documents d
       LEFT JOIN clients c ON c.id = d.client_id
       WHERE d.id = ? AND d.deleted_at IS NULL
       LIMIT 1`,
      [docId],
    );

    if (docs.length === 0) return null;
    const doc = docs[0];

    const [items, payments, activities] = await Promise.all([
      db.query<DocumentItem>('SELECT * FROM document_items WHERE document_id = ? ORDER BY sort_order ASC', [docId]),
      db.query<DocumentPayment>(
        'SELECT * FROM document_payments WHERE document_id = ? ORDER BY payment_date DESC, created_at DESC',
        [docId],
      ),
      db.query<DocumentActivity>('SELECT * FROM document_activities WHERE document_id = ? ORDER BY created_at DESC', [
        docId,
      ]),
    ]);

    let parsedSender = parseJsonSafe<SenderSnapshot>(doc.sender_snapshot);
    let parsedClient = parseJsonSafe<ClientSnapshot>(doc.client_snapshot);

    if (!parsedSender) {
      parsedSender = profileService.toSnapshot(await profileService.get());
    }
    if (!parsedClient && doc.client_id) {
      parsedClient = clientService.toSnapshot(await clientService.getById(doc.client_id));
    }

    return {
      ...doc,
      client_name: parsedClient?.name ?? doc.client_name ?? 'Tanpa Klien',
      client_company: parsedClient?.company_name ?? doc.client_company ?? null,
      client_phone_wa: parsedClient?.phone_wa ?? doc.client_phone_wa ?? null,
      is_overdue: Boolean(doc.is_overdue_flag),
      items,
      payments,
      activities,
      parsed_sender: parsedSender,
      parsed_client: parsedClient,
    };
  },

  async saveDraft(input: SaveDraftInput, items: DraftItemInput[]): Promise<DocumentDetail> {
    if (items.length === 0) throw new Error('Minimal harus ada 1 rincian barang/jasa.');
    const validItems = items.filter((it) => it.item_name.trim().length > 0);
    if (validItems.length === 0) throw new Error('Nama barang/jasa tidak boleh kosong.');

    const db = await getDb();
    const now = nowIsoUtc();
    const docId = input.id || generateId();

    await db.transaction(async () => {
      let existing: DocumentRecord | null = null;
      if (input.id) {
        const rows = await db.query<DocumentRecord>(
          'SELECT * FROM documents WHERE id = ? AND deleted_at IS NULL LIMIT 1',
          [input.id],
        );
        existing = rows[0] ?? null;
        if (existing && existing.status !== 'DRAFT') {
          throw new Error('Dokumen yang sudah diterbitkan bersifat terkunci. Silakan buat Revisi atau Duplikat.');
        }
      }

      let subtotal = 0;
      const preparedItems: InsertDocumentItemParams[] = [];

      for (let idx = 0; idx < validItems.length; idx++) {
        const it = validItems[idx];
        const qty = Math.max(0.01, Number(it.qty) || 1);
        const unitPrice = toIntRupiah(it.unit_price);
        const lineTotal = toIntRupiah(qty * unitPrice);
        subtotal += lineTotal;

        let catalogId = it.catalog_item_id ?? null;
        if (!catalogId && it.saveToCatalog) {
          catalogId = generateId();
          await db.run(
            `INSERT INTO catalog_items (
              id, item_type, sku, name, category, description, unit,
              default_price, cost_price, track_stock, stock_qty, is_active,
              deleted_at, created_at, updated_at
            ) VALUES (?, ?, NULL, ?, NULL, ?, ?, ?, NULL, 0, NULL, 1, NULL, ?, ?)`,
            [
              catalogId,
              it.saveCatalogType ?? 'GOODS',
              it.item_name.trim(),
              it.description?.trim() || null,
              it.unit.trim() || 'pcs',
              unitPrice,
              now,
              now,
            ],
          );
        }

        preparedItems.push({
          catalog_item_id: catalogId,
          sort_order: idx,
          item_name: it.item_name.trim(),
          description: it.description?.trim() || null,
          qty,
          unit: it.unit.trim() || 'pcs',
          unit_price: unitPrice,
          line_total: lineTotal,
        });
      }

      const discountAmount = Math.min(subtotal, toIntRupiah(input.discount_amount ?? 0));
      const taxAmount = toIntRupiah(input.tax_amount ?? 0);
      const totalAmount = Math.max(0, subtotal - discountAmount + taxAmount);
      const issueDate = input.issue_date || todayLocalDate();

      if (existing) {
        await db.run(
          `UPDATE documents SET
            client_id = ?, title = ?, issue_date = ?, valid_until = ?, due_date = ?, handover_date = ?,
            subtotal = ?, discount_amount = ?, tax_amount = ?, total_amount = ?,
            scope_and_terms = ?, notes = ?, updated_at = ?
          WHERE id = ?`,
          [
            input.client_id,
            input.title?.trim() || null,
            issueDate,
            input.valid_until || null,
            input.due_date || null,
            input.handover_date || null,
            subtotal,
            discountAmount,
            taxAmount,
            totalAmount,
            input.scope_and_terms?.trim() || null,
            input.notes?.trim() || null,
            now,
            docId,
          ],
        );
        await db.run('DELETE FROM document_items WHERE document_id = ?', [docId]);
      } else {
        await insertDocumentRow(db, {
          id: docId,
          client_id: input.client_id,
          parent_document_id: null,
          doc_type: input.doc_type,
          doc_number: makeDraftCode(docId),
          revision_no: 0,
          title: input.title?.trim() || null,
          status: 'DRAFT',
          issue_date: issueDate,
          valid_until: input.valid_until || null,
          due_date: input.due_date || null,
          handover_date: input.handover_date || null,
          subtotal,
          discount_amount: discountAmount,
          tax_amount: taxAmount,
          total_amount: totalAmount,
          scope_and_terms: input.scope_and_terms?.trim() || null,
          notes: input.notes?.trim() || null,
          now,
        });
        await logDocumentActivity(docId, 'CREATED', { doc_type: input.doc_type });
      }

      await insertDocumentItems(db, docId, preparedItems);
    });

    notifyDbChanged();
    const detail = await this.getDetail(docId);
    if (!detail) throw new Error('Gagal memuat dokumen yang baru disimpan.');
    return detail;
  },

  async publish(docId: string): Promise<DocumentDetail> {
    const db = await getDb();
    let publishedDoc: DocumentRecord | null = null;

    await db.transaction(async () => {
      const rows = await db.query<DocumentRecord>(
        'SELECT * FROM documents WHERE id = ? AND deleted_at IS NULL LIMIT 1',
        [docId],
      );
      const doc = rows[0];
      if (!doc) throw new Error('Dokumen tidak ditemukan.');
      if (doc.status !== 'DRAFT') {
        publishedDoc = doc;
        return;
      }

      const [profile, client] = await Promise.all([
        profileService.get(),
        doc.client_id ? clientService.getById(doc.client_id) : Promise.resolve(null),
      ]);
      const senderSnap = JSON.stringify(profileService.toSnapshot(profile));
      const clientSnap = JSON.stringify(clientService.toSnapshot(client));

      const finalDocNumber = doc.doc_number.startsWith('DRAFT-')
        ? await allocateAtomicDocNumber(doc.doc_type, doc.issue_date)
        : doc.doc_number;

      const now = nowIsoUtc();
      await db.run(
        `UPDATE documents
         SET doc_number = ?, status = 'SENT', sender_snapshot = ?, client_snapshot = ?, updated_at = ?
         WHERE id = ?`,
        [finalDocNumber, senderSnap, clientSnap, now, docId],
      );

      if (doc.doc_type === 'INVOICE') {
        const docItems = await db.query<DocumentItem>('SELECT * FROM document_items WHERE document_id = ?', [docId]);
        await adjustTrackedStock(db, docItems, 'deduct', now);
      }

      // Supersede previous Quotation revision so only the latest revision remains active
      if (doc.doc_type === 'QUOTATION' && doc.revision_no > 0 && doc.parent_document_id) {
        await db.run(
          `UPDATE documents
           SET status = 'EXPIRED', updated_at = ?
           WHERE id = ? AND doc_type = 'QUOTATION' AND status = 'SENT'`,
          [now, doc.parent_document_id],
        );
        await logDocumentActivity(doc.parent_document_id, 'STATUS_CHANGED', {
          from: 'SENT',
          to: 'EXPIRED',
          superseded_by: docId,
          revision_no: doc.revision_no,
        });
      }

      await logDocumentActivity(docId, 'STATUS_CHANGED', { from: 'DRAFT', to: 'SENT', doc_number: finalDocNumber });

      const updated = await db.query<DocumentRecord>('SELECT * FROM documents WHERE id = ? LIMIT 1', [docId]);
      publishedDoc = updated[0] ?? null;
    });

    if (publishedDoc) {
      await scheduleInvoiceReminderIfNative(publishedDoc);
    }

    notifyDbChanged();
    const detail = await this.getDetail(docId);
    if (!detail) throw new Error('Gagal memuat dokumen setelah diterbitkan.');
    return detail;
  },

  async reviseQuotation(docId: string): Promise<DocumentDetail> {
    const db = await getDb();
    const source = await this.getDetail(docId);
    if (!source) throw new Error('Quotation asal tidak ditemukan.');
    if (source.doc_type !== 'QUOTATION') {
      throw new Error('Hanya dokumen Quotation yang dapat direvisi bertingkat.');
    }

    const newId = generateId();
    const now = nowIsoUtc();

    await db.transaction(async () => {
      let nextRev = source.revision_no + 1;
      let nextDocNumber = source.doc_number;

      if (source.doc_number.startsWith('DRAFT-')) {
        nextDocNumber = makeDraftCode(newId);
      } else {
        const maxRows = await db.query<{ max_rev: number }>(
          'SELECT COALESCE(MAX(revision_no), 0) AS max_rev FROM documents WHERE doc_number = ?',
          [source.doc_number],
        );
        nextRev = (maxRows[0]?.max_rev ?? source.revision_no) + 1;
      }

      await insertDocumentRow(db, {
        id: newId,
        client_id: source.client_id,
        parent_document_id: source.id,
        doc_type: 'QUOTATION',
        doc_number: nextDocNumber,
        revision_no: nextRev,
        title: source.title,
        status: 'DRAFT',
        issue_date: todayLocalDate(),
        valid_until: source.valid_until,
        due_date: null,
        handover_date: null,
        subtotal: source.subtotal,
        discount_amount: source.discount_amount,
        tax_amount: source.tax_amount,
        total_amount: source.total_amount,
        scope_and_terms: source.scope_and_terms,
        notes: source.notes,
        now,
      });
      await insertDocumentItems(db, newId, source.items);
      await logDocumentActivity(newId, 'CREATED', { revised_from: source.id, revision_no: nextRev });
    });

    notifyDbChanged();
    const detail = await this.getDetail(newId);
    if (!detail) throw new Error('Gagal membuat revisi Quotation.');
    return detail;
  },

  async duplicateDocument(docId: string): Promise<DocumentDetail> {
    const db = await getDb();
    const source = await this.getDetail(docId);
    if (!source) throw new Error('Dokumen asal tidak ditemukan.');

    const newId = generateId();
    const now = nowIsoUtc();

    await db.transaction(async () => {
      await insertDocumentRow(db, {
        id: newId,
        client_id: source.client_id,
        parent_document_id: null,
        doc_type: source.doc_type,
        doc_number: makeDraftCode(newId),
        revision_no: 0,
        title: source.title,
        status: 'DRAFT',
        issue_date: todayLocalDate(),
        valid_until: source.doc_type === 'QUOTATION' ? todayLocalDate(14) : null,
        due_date: source.doc_type === 'INVOICE' ? todayLocalDate(7) : null,
        handover_date: source.doc_type === 'BAST' ? todayLocalDate() : null,
        subtotal: source.subtotal,
        discount_amount: source.discount_amount,
        tax_amount: source.tax_amount,
        total_amount: source.total_amount,
        scope_and_terms: source.scope_and_terms,
        notes: source.notes,
        now,
      });
      await insertDocumentItems(db, newId, source.items);
      await logDocumentActivity(newId, 'CREATED', { duplicated_from: source.id });
    });

    notifyDbChanged();
    const detail = await this.getDetail(newId);
    if (!detail) throw new Error('Gagal menduplikasi dokumen.');
    return detail;
  },

  async convert(docId: string, target: 'INVOICE' | 'BAST', opts?: ConvertOptions): Promise<DocumentDetail> {
    const db = await getDb();
    const source = await this.getDetail(docId);
    if (!source) throw new Error('Dokumen sumber tidak ditemukan.');

    const newId = generateId();
    const now = nowIsoUtc();
    const issueDate = todayLocalDate();
    const draftCode = makeDraftCode(newId);

    await db.transaction(async () => {
      if (source.doc_type === 'QUOTATION' && (source.status === 'SENT' || source.status === 'DRAFT')) {
        await db.run('UPDATE documents SET status = ?, updated_at = ? WHERE id = ?', ['ACCEPTED', now, source.id]);
        await logDocumentActivity(source.id, 'STATUS_CHANGED', { from: source.status, to: 'ACCEPTED' });
      }

      if (target === 'INVOICE') {
        const mode = opts?.mode ?? 'FULL';
        const dpPercent = Math.min(100, Math.max(1, Math.round(opts?.dpPercent ?? 50)));
        const dueDate = opts?.dueDate || todayLocalDate(7);
        const isDp = mode === 'DP_PERCENT' && dpPercent < 100;
        const dpAmount = isDp ? toIntRupiah((source.total_amount * dpPercent) / 100) : source.total_amount;

        await insertDocumentRow(db, {
          id: newId,
          client_id: source.client_id,
          parent_document_id: source.id,
          doc_type: 'INVOICE',
          doc_number: draftCode,
          revision_no: 0,
          title: isDp ? `Termin / DP ${dpPercent}% — ${source.title || source.doc_number}` : source.title,
          status: 'DRAFT',
          issue_date: issueDate,
          valid_until: null,
          due_date: dueDate,
          handover_date: null,
          subtotal: isDp ? dpAmount : source.subtotal,
          discount_amount: isDp ? 0 : source.discount_amount,
          tax_amount: isDp ? 0 : source.tax_amount,
          total_amount: dpAmount,
          scope_and_terms: source.scope_and_terms,
          notes: isDp
            ? `Tagihan DP ${dpPercent}% atas penawaran ${formatDisplayDocNumber(source)}.`
            : `Berdasarkan Quotation ${formatDisplayDocNumber(source)}. ${source.notes ?? ''}`.trim(),
          now,
        });

        await insertDocumentItems(
          db,
          newId,
          isDp
            ? [
                {
                  catalog_item_id: null,
                  sort_order: 0,
                  item_name: `Pembayaran Termin / DP ${dpPercent}%`,
                  description: `Berdasarkan Quotation ${formatDisplayDocNumber(source)}`,
                  qty: 1,
                  unit: 'termin',
                  unit_price: dpAmount,
                  line_total: dpAmount,
                },
              ]
            : source.items,
        );
      } else {
        await insertDocumentRow(db, {
          id: newId,
          client_id: source.client_id,
          parent_document_id: source.id,
          doc_type: 'BAST',
          doc_number: draftCode,
          revision_no: 0,
          title: source.title || `Serah Terima Pekerjaan — ${source.doc_number}`,
          status: 'DRAFT',
          issue_date: issueDate,
          valid_until: null,
          due_date: null,
          handover_date: opts?.handoverDate || todayLocalDate(),
          subtotal: source.subtotal,
          discount_amount: source.discount_amount,
          tax_amount: source.tax_amount,
          total_amount: source.total_amount,
          scope_and_terms: source.scope_and_terms,
          notes: `Berita Acara Serah Terima mengacu pada dokumen ${formatDisplayDocNumber(source)}.`,
          now,
        });
        await insertDocumentItems(db, newId, source.items);
      }

      await logDocumentActivity(source.id, 'CONVERTED', { target_doc_id: newId, target_type: target });
      await logDocumentActivity(newId, 'CREATED', { converted_from: source.id, target_type: target });
    });

    if (opts?.autoPublish !== false) {
      return this.publish(newId);
    }

    notifyDbChanged();
    const detail = await this.getDetail(newId);
    if (!detail) throw new Error('Gagal mengonversi dokumen.');
    return detail;
  },

  async updateStatus(docId: string, nextStatus: DocumentStatus): Promise<DocumentDetail> {
    const db = await getDb();
    const doc = await this.getDetail(docId);
    if (!doc) throw new Error('Dokumen tidak ditemukan.');

    if (nextStatus === 'VOID' && doc.paid_amount > 0) {
      throw new Error('Invoice yang sudah memiliki pembayaran terkonfirmasi tidak dapat dibatalkan.');
    }

    const now = nowIsoUtc();
    await db.transaction(async () => {
      await db.run('UPDATE documents SET status = ?, updated_at = ? WHERE id = ?', [nextStatus, now, docId]);

      if (nextStatus === 'VOID' && doc.doc_type === 'INVOICE' && doc.status !== 'DRAFT' && doc.status !== 'VOID') {
        await adjustTrackedStock(db, doc.items, 'restore', now);
      }

      await logDocumentActivity(docId, 'STATUS_CHANGED', { from: doc.status, to: nextStatus });
    });

    notifyDbChanged();
    const updated = await this.getDetail(docId);
    if (!updated) throw new Error('Gagal memperbarui status dokumen.');
    return updated;
  },

  async remove(docId: string): Promise<void> {
    const db = await getDb();
    const doc = await this.getDetail(docId);
    if (!doc) return;
    if (doc.status !== 'DRAFT') {
      throw new Error(
        'Hanya dokumen Draft yang dapat dihapus. Gunakan tombol Batalkan untuk dokumen yang sudah terbit.',
      );
    }
    const now = nowIsoUtc();
    await db.run('UPDATE documents SET deleted_at = ?, updated_at = ? WHERE id = ?', [now, now, docId]);
    notifyDbChanged();
  },

  async getDashboardSummary(): Promise<DashboardSummary> {
    const db = await getDb();
    const currentMonthPrefix = todayLocalDate().slice(0, 7);

    // Performance: merge 4 separate documents-table scans into 1 single conditional-aggregate query
    const [docAggRows, paidMonthStats, catalogCountStats, allDocs] = await Promise.all([
      db.query<{
        unpaid_cnt: number;
        unpaid_total: number;
        overdue_cnt: number;
        overdue_total: number;
        waiting_quo_cnt: number;
        total_paid: number;
      }>(
        `SELECT
           COALESCE(SUM(CASE WHEN doc_type = 'INVOICE' AND status IN ('SENT', 'PARTIAL') THEN 1 ELSE 0 END), 0) AS unpaid_cnt,
           COALESCE(SUM(CASE WHEN doc_type = 'INVOICE' AND status IN ('SENT', 'PARTIAL') THEN (total_amount - paid_amount) ELSE 0 END), 0) AS unpaid_total,
           COALESCE(SUM(CASE WHEN doc_type = 'INVOICE' AND status IN ('SENT', 'PARTIAL') AND due_date IS NOT NULL AND due_date < date('now', 'localtime') THEN 1 ELSE 0 END), 0) AS overdue_cnt,
           COALESCE(SUM(CASE WHEN doc_type = 'INVOICE' AND status IN ('SENT', 'PARTIAL') AND due_date IS NOT NULL AND due_date < date('now', 'localtime') THEN (total_amount - paid_amount) ELSE 0 END), 0) AS overdue_total,
           COALESCE(SUM(CASE WHEN doc_type = 'QUOTATION' AND status = 'SENT' THEN 1 ELSE 0 END), 0) AS waiting_quo_cnt,
           COALESCE(SUM(CASE WHEN doc_type = 'INVOICE' AND status != 'VOID' THEN paid_amount ELSE 0 END), 0) AS total_paid
         FROM documents
         WHERE deleted_at IS NULL`,
      ),
      db.query<{ total: number }>(
        `SELECT COALESCE(SUM(p.amount), 0) AS total
         FROM document_payments p
         JOIN documents d ON d.id = p.document_id
         WHERE d.deleted_at IS NULL
           AND p.status = 'CONFIRMED'
           AND substr(p.payment_date, 1, 7) = ?`,
        [currentMonthPrefix],
      ),
      db.query<{ cnt: number }>('SELECT COUNT(*) AS cnt FROM catalog_items WHERE deleted_at IS NULL AND is_active = 1'),
      this.list(),
    ]);

    const agg = docAggRows[0];
    const urgentInvoices = allDocs
      .filter((d) => d.doc_type === 'INVOICE' && (d.status === 'SENT' || d.status === 'PARTIAL'))
      .sort((a, b) => {
        if (a.is_overdue && !b.is_overdue) return -1;
        if (!a.is_overdue && b.is_overdue) return 1;
        return (a.due_date || '9999-99-99').localeCompare(b.due_date || '9999-99-99');
      })
      .slice(0, 6);

    return {
      unpaidInvoiceCount: Number(agg?.unpaid_cnt ?? 0),
      unpaidTotalAmount: Number(agg?.unpaid_total ?? 0),
      overdueCount: Number(agg?.overdue_cnt ?? 0),
      overdueTotalAmount: Number(agg?.overdue_total ?? 0),
      waitingQuotationCount: Number(agg?.waiting_quo_cnt ?? 0),
      paidThisMonthAmount: Number(paidMonthStats[0]?.total ?? 0),
      totalPaidAmount: Number(agg?.total_paid ?? 0),
      activeCatalogCount: Number(catalogCountStats[0]?.cnt ?? 0),
      urgentInvoices,
      recentDocuments: allDocs.slice(0, 6),
    };
  },
};
