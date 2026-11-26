import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

import type {
  BackupPayload,
  BusinessProfile,
  CatalogItem,
  Client,
  DocumentActivity,
  DocumentItem,
  DocumentPayment,
  DocumentRecord,
  DocumentSequence,
} from '../types/database';
import { nowIsoUtc, todayLocalDate } from '../utils/formatters';

import { getDb, notifyDbChanged } from './client';

export const backupService = {
  async buildPayload(): Promise<BackupPayload> {
    const db = await getDb();
    const [
      business_profile,
      clients,
      catalog_items,
      document_sequences,
      documents,
      document_items,
      document_payments,
      document_activities,
    ] = await Promise.all([
      db.query<BusinessProfile>('SELECT * FROM business_profile'),
      db.query<Client>('SELECT * FROM clients'),
      db.query<CatalogItem>('SELECT * FROM catalog_items'),
      db.query<DocumentSequence>('SELECT * FROM document_sequences'),
      db.query<DocumentRecord>('SELECT * FROM documents'),
      db.query<DocumentItem>('SELECT * FROM document_items'),
      db.query<DocumentPayment>('SELECT * FROM document_payments'),
      db.query<DocumentActivity>('SELECT * FROM document_activities'),
    ]);

    return {
      version: 1,
      exported_at: nowIsoUtc(),
      app: 'quotation-invoice-cepat',
      tables: {
        business_profile,
        clients,
        catalog_items,
        document_sequences,
        documents,
        document_items,
        document_payments,
        document_activities,
      },
    };
  },

  async exportJson(): Promise<{ filename: string; json: string }> {
    const payload = await this.buildPayload();
    const json = JSON.stringify(payload, null, 2);
    const filename = `qoc-backup-${todayLocalDate()}.json`;

    if (Capacitor.isNativePlatform()) {
      const saved = await Filesystem.writeFile({
        path: filename,
        data: json,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
      });
      await Share.share({
        title: 'Backup Data Quotation & Invoice',
        text: `Backup data aplikasi (${filename})`,
        url: saved.uri,
        dialogTitle: 'Simpan Backup ke Google Drive / WhatsApp',
      });
    } else if (typeof document !== 'undefined') {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    return { filename, json };
  },

  async importJson(rawJson: string): Promise<{ restoredCounts: Record<string, number> }> {
    let parsed: BackupPayload;
    try {
      parsed = JSON.parse(rawJson) as BackupPayload;
    } catch {
      throw new Error('File cadangan tidak valid atau formatnya tidak dikenali.');
    }

    if (!parsed || typeof parsed !== 'object' || !parsed.tables) {
      throw new Error('Struktur file backup tidak dikenali.');
    }

    const { tables } = parsed;
    const db = await getDb();

    await db.transaction(async () => {
      // Clear child tables first, then parent tables
      await db.run('DELETE FROM document_activities');
      await db.run('DELETE FROM document_payments');
      await db.run('DELETE FROM document_items');
      await db.run('DELETE FROM documents');
      await db.run('DELETE FROM document_sequences');
      await db.run('DELETE FROM catalog_items');
      await db.run('DELETE FROM clients');
      await db.run('DELETE FROM business_profile');

      for (const p of tables.business_profile ?? []) {
        await db.run(
          `INSERT INTO business_profile (
            id, name, phone_wa, address, logo_path, signature_path,
            bank_name, bank_account_no, bank_account_name, default_scope_terms,
            prefix_quotation, prefix_invoice, prefix_bast, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            p.id,
            p.name,
            p.phone_wa,
            p.address,
            p.logo_path,
            p.signature_path,
            p.bank_name,
            p.bank_account_no,
            p.bank_account_name,
            p.default_scope_terms,
            p.prefix_quotation || 'QUO',
            p.prefix_invoice || 'INV',
            p.prefix_bast || 'BAST',
            p.created_at,
            p.updated_at,
          ],
        );
      }

      for (const c of tables.clients ?? []) {
        await db.run(
          `INSERT INTO clients (
            id, name, company_name, phone_wa, email, address, deleted_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [c.id, c.name, c.company_name, c.phone_wa, c.email, c.address, c.deleted_at, c.created_at, c.updated_at],
        );
      }

      for (const item of tables.catalog_items ?? []) {
        await db.run(
          `INSERT INTO catalog_items (
            id, item_type, sku, name, category, description, unit,
            default_price, cost_price, track_stock, stock_qty, is_active,
            deleted_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            item.id,
            item.item_type,
            item.sku,
            item.name,
            item.category,
            item.description,
            item.unit,
            item.default_price,
            item.cost_price,
            item.track_stock,
            item.stock_qty,
            item.is_active,
            item.deleted_at,
            item.created_at,
            item.updated_at,
          ],
        );
      }

      for (const seq of tables.document_sequences ?? []) {
        await db.run(
          `INSERT INTO document_sequences (id, doc_type, period_ym, last_number)
           VALUES (?, ?, ?, ?)`,
          [seq.id, seq.doc_type, seq.period_ym, seq.last_number],
        );
      }

      // Insert root documents first (parent_document_id IS NULL), then child documents
      const allDocs = [...(tables.documents ?? [])];
      const rootDocs = allDocs.filter((d) => !d.parent_document_id);
      const childDocs = allDocs.filter((d) => Boolean(d.parent_document_id));
      const orderedDocs = [...rootDocs, ...childDocs];

      for (const d of orderedDocs) {
        await db.run(
          `INSERT INTO documents (
            id, client_id, parent_document_id, doc_type, doc_number, revision_no,
            title, status, issue_date, valid_until, due_date, handover_date,
            subtotal, discount_amount, tax_amount, total_amount, paid_amount,
            scope_and_terms, notes, sender_snapshot, client_snapshot,
            deleted_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            d.id,
            d.client_id,
            d.parent_document_id,
            d.doc_type,
            d.doc_number,
            d.revision_no ?? 0,
            d.title,
            d.status,
            d.issue_date,
            d.valid_until,
            d.due_date,
            d.handover_date,
            d.subtotal ?? 0,
            d.discount_amount ?? 0,
            d.tax_amount ?? 0,
            d.total_amount ?? 0,
            d.paid_amount ?? 0,
            d.scope_and_terms,
            d.notes,
            d.sender_snapshot,
            d.client_snapshot,
            d.deleted_at,
            d.created_at,
            d.updated_at,
          ],
        );
      }

      for (const di of tables.document_items ?? []) {
        await db.run(
          `INSERT INTO document_items (
            id, document_id, catalog_item_id, sort_order, item_name,
            description, qty, unit, unit_price, line_total
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            di.id,
            di.document_id,
            di.catalog_item_id,
            di.sort_order ?? 0,
            di.item_name,
            di.description,
            di.qty,
            di.unit,
            di.unit_price,
            di.line_total,
          ],
        );
      }

      for (const pay of tables.document_payments ?? []) {
        await db.run(
          `INSERT INTO document_payments (
            id, document_id, amount, payment_date, method, giro_due_date,
            status, proof_path, notes, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            pay.id,
            pay.document_id,
            pay.amount,
            pay.payment_date,
            pay.method,
            pay.giro_due_date,
            pay.status,
            pay.proof_path,
            pay.notes,
            pay.created_at,
          ],
        );
      }

      for (const act of tables.document_activities ?? []) {
        await db.run(
          `INSERT INTO document_activities (
            id, document_id, action_type, metadata, created_at
          ) VALUES (?, ?, ?, ?, ?)`,
          [act.id, act.document_id, act.action_type, act.metadata, act.created_at],
        );
      }
    });

    notifyDbChanged();

    return {
      restoredCounts: {
        clients: tables.clients?.length ?? 0,
        catalog_items: tables.catalog_items?.length ?? 0,
        documents: tables.documents?.length ?? 0,
        payments: tables.document_payments?.length ?? 0,
      },
    };
  },
};
