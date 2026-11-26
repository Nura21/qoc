import { beforeEach, describe, expect, it } from 'vitest';

import { backupService } from '../db/backup';
import { resetDbForTesting } from '../db/client';
import { renderInvoicePdf } from '../templates/invoicePdf';
import { renderQuotationPdf } from '../templates/quotationPdf';
import { todayLocalDate } from '../utils/formatters';

import { catalogService } from './catalog/catalogService';
import { clientService } from './clients/clientService';
import { documentService } from './documents/documentService';
import { paymentService } from './payments/paymentService';
import { profileService } from './profile/profileService';

describe('System Design Invariants (SQLite Offline-First)', () => {
  beforeEach(async () => {
    await resetDbForTesting();
  });

  it('enforces snapshot immutability, atomic numbering, catalog auto-save, and quotation revision/conversion', async () => {
    await profileService.getOrSave({
      name: 'Studio Kreatif Nusantara',
      phone_wa: '08123456789',
      bank_name: 'BCA',
      bank_account_no: '888111222',
      bank_account_name: 'Studio Kreatif',
      prefix_quotation: 'QUO',
      prefix_invoice: 'INV',
      prefix_bast: 'BAST',
    });

    const client = await clientService.upsert({
      name: 'Andi Saputra',
      company_name: 'PT Maju Jaya',
      phone_wa: '081999888777',
    });

    const draft = await documentService.saveDraft(
      {
        client_id: client.id,
        doc_type: 'QUOTATION',
        title: 'Pembuatan Website Korporat',
        issue_date: '2026-11-25',
        valid_until: '2026-12-10',
      },
      [
        {
          item_name: 'Desain UI/UX & Frontend',
          qty: 1,
          unit: 'paket',
          unit_price: 5000000,
          saveToCatalog: true,
          saveCatalogType: 'SERVICE',
        },
      ],
    );

    // Check Invariant #2: saved to catalog automatically
    const catalog = await catalogService.list();
    expect(catalog).toHaveLength(1);
    expect(catalog[0].name).toBe('Desain UI/UX & Frontend');
    expect(catalog[0].default_price).toBe(5000000);

    // Publish Quotation -> atomic numbering + snapshot lock
    const publishedQuo = await documentService.publish(draft.id);
    expect(publishedQuo.doc_number).toBe('QUO-202611-001');
    expect(publishedQuo.status).toBe('SENT');

    // Mutate master profile, client, and catalog price AFTER publish
    await profileService.getOrSave({
      name: 'Nama Usaha Baru Berubah',
      bank_name: 'Mandiri',
      bank_account_no: '999000111',
    });
    await clientService.upsert({
      id: client.id,
      name: 'Nama Klien Baru Berubah',
    });
    await catalogService.upsert({
      id: catalog[0].id,
      name: 'Desain UI/UX & Frontend',
      default_price: 9500000,
    });

    // Check Invariant #1: historical published document snapshot & price MUST NOT change
    const historicalQuo = await documentService.getDetail(publishedQuo.id);
    expect(historicalQuo?.parsed_sender?.name).toBe('Studio Kreatif Nusantara');
    expect(historicalQuo?.parsed_sender?.bank_name).toBe('BCA');
    expect(historicalQuo?.parsed_client?.name).toBe('Andi Saputra');
    expect(historicalQuo?.items[0].unit_price).toBe(5000000);
    expect(historicalQuo?.total_amount).toBe(5000000);

    // Revise Quotation -> revision_no + 1 with same doc_number
    const revQuo = await documentService.reviseQuotation(publishedQuo.id);
    expect(revQuo.doc_number).toBe('QUO-202611-001');
    expect(revQuo.revision_no).toBe(1);
    expect(revQuo.parent_document_id).toBe(publishedQuo.id);

    // 1-Click Convert to DP 50% Invoice
    const dpInvoice = await documentService.convert(publishedQuo.id, 'INVOICE', {
      mode: 'DP_PERCENT',
      dpPercent: 50,
      autoPublish: true,
    });
    expect(dpInvoice.doc_type).toBe('INVOICE');
    expect(dpInvoice.doc_number.startsWith('INV-')).toBe(true);
    expect(dpInvoice.total_amount).toBe(2500000);

    // Smoke test PDF generators
    expect(renderQuotationPdf(historicalQuo!).output('datauristring')).toContain('data:application/pdf');
    expect(renderInvoicePdf(dpInvoice).output('datauristring')).toContain('data:application/pdf');
  });

  it('computes overdue dynamically, syncs partial/giro/paid payments, and restores full JSON backup', async () => {
    const client = await clientService.upsert({ name: 'Budi Kontraktor' });
    const pastDue = todayLocalDate(-5);

    const draftInv = await documentService.saveDraft(
      {
        client_id: client.id,
        doc_type: 'INVOICE',
        title: 'Renovasi Atap',
        issue_date: todayLocalDate(-12),
        due_date: pastDue,
      },
      [{ item_name: 'Borongan Baja Ringan', qty: 10, unit: 'm2', unit_price: 200000 }],
    );

    const sentInv = await documentService.publish(draftInv.id);
    expect(sentInv.total_amount).toBe(2000000);
    expect(sentInv.is_overdue).toBe(true);

    // Record PENDING_GIRO -> paid_amount stays 0 until giro clears
    const afterGiro = await paymentService.record(sentInv.id, {
      amount: 800000,
      method: 'GIRO',
    });
    expect(afterGiro.paid_amount).toBe(0);
    expect(afterGiro.status).toBe('SENT');

    // Clear Giro -> status becomes PARTIAL, paid_amount = 800000
    const giroCleared = await paymentService.updateStatus(afterGiro.payments[0].id, 'CONFIRMED');
    expect(giroCleared.paid_amount).toBe(800000);
    expect(giroCleared.status).toBe('PARTIAL');
    expect(giroCleared.is_overdue).toBe(true);

    // Pay remaining 1,200,000 -> status becomes PAID, is_overdue becomes false
    const fullyPaid = await paymentService.record(sentInv.id, {
      amount: 1200000,
      method: 'TRANSFER',
    });
    expect(fullyPaid.paid_amount).toBe(2000000);
    expect(fullyPaid.status).toBe('PAID');
    expect(fullyPaid.is_overdue).toBe(false);

    // Backup & Restore check (Invariant #6)
    const payload = await backupService.buildPayload();
    const rawJson = JSON.stringify(payload);

    await resetDbForTesting();
    expect(await documentService.list()).toHaveLength(0);

    const restoreRes = await backupService.importJson(rawJson);
    expect(restoreRes.restoredCounts.documents).toBe(1);
    const restoredDoc = await documentService.getDetail(sentInv.id);
    expect(restoredDoc?.status).toBe('PAID');
    expect(restoredDoc?.paid_amount).toBe(2000000);
  });
});
