import type { DocumentStatus, DocType } from '../types/database';
import { generateId } from '../utils/formatters';

import type { DbDriver } from './client';

/** Reusable SQL CASE expression computing dynamic overdue flag from local SQLite date. */
export const DOCUMENT_OVERDUE_EXPR = `
  CASE
    WHEN d.doc_type = 'INVOICE'
     AND d.status IN ('SENT', 'PARTIAL')
     AND d.due_date IS NOT NULL
     AND d.due_date < date('now', 'localtime')
    THEN 1 ELSE 0
  END
`;

export interface InsertDocumentParams {
  id: string;
  client_id: string | null;
  parent_document_id: string | null;
  doc_type: DocType;
  doc_number: string;
  revision_no: number;
  title: string | null;
  status: DocumentStatus;
  issue_date: string;
  valid_until: string | null;
  due_date: string | null;
  handover_date: string | null;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  scope_and_terms: string | null;
  notes: string | null;
  now: string;
}

export interface InsertDocumentItemParams {
  catalog_item_id: string | null;
  sort_order: number;
  item_name: string;
  description: string | null;
  qty: number;
  unit: string;
  unit_price: number;
  line_total: number;
}

/** Single KISS helper for inserting into `documents` (reused by saveDraft, revise, duplicate, convert). */
export async function insertDocumentRow(db: DbDriver, p: InsertDocumentParams): Promise<void> {
  await db.run(
    `INSERT INTO documents (
      id, client_id, parent_document_id, doc_type, doc_number, revision_no,
      title, status, issue_date, valid_until, due_date, handover_date,
      subtotal, discount_amount, tax_amount, total_amount, paid_amount,
      scope_and_terms, notes, sender_snapshot, client_snapshot,
      deleted_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, NULL, NULL, NULL, ?, ?)`,
    [
      p.id,
      p.client_id,
      p.parent_document_id,
      p.doc_type,
      p.doc_number,
      p.revision_no,
      p.title,
      p.status,
      p.issue_date,
      p.valid_until,
      p.due_date,
      p.handover_date,
      p.subtotal,
      p.discount_amount,
      p.tax_amount,
      p.total_amount,
      p.scope_and_terms,
      p.notes,
      p.now,
      p.now,
    ],
  );
}

/** Single KISS helper for inserting line items into `document_items`. */
export async function insertDocumentItems(
  db: DbDriver,
  documentId: string,
  items: InsertDocumentItemParams[],
): Promise<void> {
  for (const item of items) {
    await db.run(
      `INSERT INTO document_items (
        id, document_id, catalog_item_id, sort_order, item_name,
        description, qty, unit, unit_price, line_total
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        generateId(),
        documentId,
        item.catalog_item_id,
        item.sort_order,
        item.item_name,
        item.description,
        item.qty,
        item.unit,
        item.unit_price,
        item.line_total,
      ],
    );
  }
}

/**
 * Adjusts tracked catalog item stock atomically.
 * `direction = 'deduct'` clamps stock at 0; `direction = 'restore'` adds stock back on Invoice VOID.
 */
export async function adjustTrackedStock(
  db: DbDriver,
  items: { catalog_item_id: string | null; qty: number }[],
  direction: 'deduct' | 'restore',
  now: string,
): Promise<void> {
  const sql =
    direction === 'deduct'
      ? `UPDATE catalog_items
         SET stock_qty = MAX(0, COALESCE(stock_qty, 0) - ?), updated_at = ?
         WHERE id = ? AND track_stock = 1`
      : `UPDATE catalog_items
         SET stock_qty = COALESCE(stock_qty, 0) + ?, updated_at = ?
         WHERE id = ? AND track_stock = 1`;

  for (const it of items) {
    if (it.catalog_item_id) {
      await db.run(sql, [it.qty, now, it.catalog_item_id]);
    }
  }
}
