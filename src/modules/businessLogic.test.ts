import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetDbForTesting } from '../db/client';
import {
  formatDateId,
  formatRupiah,
  generateId,
  normalizeWaPhone,
  periodYmFromDate,
  todayLocalDate,
  toIntRupiah,
} from '../utils/formatters';
import { getInitials } from '../utils/textHelpers';
import { getThemeMode, setThemeMode } from '../utils/themePreference';

import { catalogService } from './catalog/catalogService';
import { clientService } from './clients/clientService';
import { documentService, formatDisplayDocNumber } from './documents/documentService';
import { paymentService } from './payments/paymentService';
import { profileService } from './profile/profileService';
import { shareService } from './share/shareService';

describe('Formatters & Helper Logic', () => {
  it('sanitizes and formats Rupiah values safely across dirty inputs', () => {
    expect(toIntRupiah(150000)).toBe(150000);
    expect(toIntRupiah(150000.6)).toBe(150001);
    expect(toIntRupiah('Rp 1.250.000')).toBe(1250000);
    expect(toIntRupiah(-5000)).toBe(0);
    expect(toIntRupiah('')).toBe(0);
    expect(toIntRupiah(null)).toBe(0);
    expect(toIntRupiah(undefined)).toBe(0);
    expect(toIntRupiah(Number.NaN)).toBe(0);

    expect(formatRupiah(0)).toBe('Rp0');
    expect(formatRupiah(2500000)).toBe('Rp2.500.000');
    expect(formatRupiah(-999)).toBe('Rp0');
  });

  it('formats Indonesian dates, periodYm, WA phone numbers, and unique IDs cleanly', () => {
    expect(formatDateId('2026-11-26')).toBe('26 Nov 2026');
    expect(formatDateId('2026-01-05')).toBe('5 Jan 2026');
    expect(formatDateId(null)).toBe('-');
    expect(formatDateId('')).toBe('-');

    expect(periodYmFromDate('2026-11-26')).toBe('202611');
    expect(todayLocalDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    expect(normalizeWaPhone('0812-3456-7890')).toBe('6281234567890');
    expect(normalizeWaPhone('812 3456 7890')).toBe('6281234567890');
    expect(normalizeWaPhone('+62 812-3456-7890')).toBe('6281234567890');
    expect(normalizeWaPhone('')).toBe('');
    expect(normalizeWaPhone(null)).toBe('');

    const idA = generateId();
    const idB = generateId();
    expect(idA).not.toBe(idB);
  });

  it('formats display document numbers with revision suffix, extracts initials, and switches theme mode', () => {
    expect(formatDisplayDocNumber({ doc_number: 'QUO-202611-001', revision_no: 0 })).toBe('QUO-202611-001');
    expect(formatDisplayDocNumber({ doc_number: 'QUO-202611-001', revision_no: 2 })).toBe('QUO-202611-001 (Rev.2)');
    expect(getInitials('Studio Karya Mandiri')).toBe('SK');
    expect(getInitials('QOC')).toBe('Q');
    expect(getInitials('', 'QO')).toBe('QO');

    setThemeMode('dark');
    expect(getThemeMode()).toBe('dark');
    expect(document.documentElement.classList.contains('ion-palette-dark')).toBe(true);

    setThemeMode('light');
    expect(getThemeMode()).toBe('light');
    expect(document.documentElement.classList.contains('ion-palette-dark')).toBe(false);

    setThemeMode('system');
    expect(getThemeMode()).toBe('system');
  });
});

describe('Document, Payment, Dashboard Summary & Share Business Logic', () => {
  beforeEach(async () => {
    await resetDbForTesting();
  });

  it('rejects invalid draft items and enforces immutability on published documents', async () => {
    await expect(documentService.saveDraft({ client_id: null, doc_type: 'QUOTATION' }, [])).rejects.toThrow();

    await expect(
      documentService.saveDraft({ client_id: null, doc_type: 'QUOTATION' }, [
        { item_name: '   ', qty: 1, unit: 'pcs', unit_price: 50000 },
      ]),
    ).rejects.toThrow();

    const draft = await documentService.saveDraft({ client_id: null, doc_type: 'INVOICE', title: 'Tagihan Awal' }, [
      { item_name: 'Jasa Audit', qty: 1, unit: 'paket', unit_price: 1_000_000 },
    ]);
    const sent = await documentService.publish(draft.id);

    await expect(
      documentService.saveDraft({ id: sent.id, client_id: null, doc_type: 'INVOICE', title: 'Coba Ubah' }, [
        { item_name: 'Jasa Audit', qty: 1, unit: 'paket', unit_price: 9_000_000 },
      ]),
    ).rejects.toThrow(/immutable|terkunci/i);
  });

  it('duplicates documents as clean fresh DRAFTs and converts Quotation -> Invoice -> BAST accurately', async () => {
    const client = await clientService.upsert({ name: 'Rina Interior', company_name: 'Studio Rina' });
    const draft = await documentService.saveDraft(
      {
        client_id: client.id,
        doc_type: 'QUOTATION',
        title: 'Renovasi Pantry',
        discount_amount: 100_000,
        tax_amount: 55_000,
      },
      [{ item_name: 'Kitchen Set HPL', qty: 2, unit: 'm', unit_price: 1_500_000 }],
    );
    const quo = await documentService.publish(draft.id);

    // Duplicate creates brand-new DRAFT with revision_no = 0 & no parent link
    const dup = await documentService.duplicateDocument(quo.id);
    expect(dup.id).not.toBe(quo.id);
    expect(dup.status).toBe('DRAFT');
    expect(dup.revision_no).toBe(0);
    expect(dup.parent_document_id).toBeNull();
    expect(dup.total_amount).toBe(quo.total_amount);

    // Convert Quotation -> Full Invoice marks source Quotation as ACCEPTED
    const inv = await documentService.convert(quo.id, 'INVOICE', { mode: 'FULL', autoPublish: true });
    expect((await documentService.getDetail(quo.id))?.status).toBe('ACCEPTED');
    expect(inv.parent_document_id).toBe(quo.id);
    expect(inv.total_amount).toBe(2_955_000);
    expect(inv.items).toHaveLength(1);

    // Convert Invoice -> BAST copies items & marks parent link
    const bast = await documentService.convert(inv.id, 'BAST', { autoPublish: true });
    expect(bast.doc_type).toBe('BAST');
    expect(bast.parent_document_id).toBe(inv.id);
    expect(bast.items).toHaveLength(1);
  });

  it('computes Dashboard Summary KPIs and prioritizes overdue invoices in urgent list', async () => {
    const client = await clientService.upsert({ name: 'CV Maju Makmur' });
    await catalogService.upsert({ name: 'Cat Tembok', default_price: 120_000, is_active: true });
    await catalogService.upsert({ name: 'Barang Nonaktif', default_price: 50_000, is_active: false });

    // Waiting Quotation (1)
    const q = await documentService.saveDraft({ client_id: client.id, doc_type: 'QUOTATION', title: 'Quo A' }, [
      { item_name: 'Item Q', qty: 1, unit: 'pcs', unit_price: 500_000 },
    ]);
    await documentService.publish(q.id);

    // Future-due Invoice (SENT, Rp1.000.000)
    const invFutureDraft = await documentService.saveDraft(
      {
        client_id: client.id,
        doc_type: 'INVOICE',
        title: 'Invoice Belum Tempo',
        issue_date: todayLocalDate(),
        due_date: todayLocalDate(10),
      },
      [{ item_name: 'Item Future', qty: 1, unit: 'pcs', unit_price: 1_000_000 }],
    );
    const invFuture = await documentService.publish(invFutureDraft.id);

    // Overdue Invoice (PARTIAL, total Rp2.000.000, paid Rp500.000 -> remaining Rp1.500.000)
    const invOverdueDraft = await documentService.saveDraft(
      {
        client_id: client.id,
        doc_type: 'INVOICE',
        title: 'Invoice Telat',
        issue_date: todayLocalDate(-15),
        due_date: todayLocalDate(-3),
      },
      [{ item_name: 'Item Telat', qty: 2, unit: 'pcs', unit_price: 1_000_000 }],
    );
    const invOverdue = await documentService.publish(invOverdueDraft.id);
    await paymentService.record(invOverdue.id, { amount: 500_000, method: 'TRANSFER' });

    const summary = await documentService.getDashboardSummary();
    expect(summary.waitingQuotationCount).toBe(1);
    expect(summary.activeCatalogCount).toBe(1);
    expect(summary.unpaidInvoiceCount).toBe(2);
    expect(summary.unpaidTotalAmount).toBe(2_500_000);
    expect(summary.overdueCount).toBe(1);
    expect(summary.overdueTotalAmount).toBe(1_500_000);
    expect(summary.totalPaidAmount).toBe(500_000);
    expect(summary.paidThisMonthAmount).toBe(500_000);
    // Overdue invoice MUST sort ahead of future invoice
    expect(summary.urgentInvoices[0].id).toBe(invOverdue.id);
    expect(summary.urgentInvoices[1].id).toBe(invFuture.id);
  });

  it('rejects invalid payment targets and amounts', async () => {
    const qDraft = await documentService.saveDraft({ client_id: null, doc_type: 'QUOTATION' }, [
      { item_name: 'Quo Item', qty: 1, unit: 'pcs', unit_price: 200_000 },
    ]);
    const qPub = await documentService.publish(qDraft.id);
    await expect(paymentService.record(qPub.id, { amount: 100_000 })).rejects.toThrow(/Invoice/i);

    const invDraft = await documentService.saveDraft({ client_id: null, doc_type: 'INVOICE' }, [
      { item_name: 'Inv Item', qty: 1, unit: 'pcs', unit_price: 200_000 },
    ]);
    await expect(paymentService.record(invDraft.id, { amount: 100_000 })).rejects.toThrow(/Terbitkan/i);

    const invPub = await documentService.publish(invDraft.id);
    await expect(paymentService.record(invPub.id, { amount: 0 })).rejects.toThrow();
    await expect(paymentService.record(invPub.id, { amount: -10_000 })).rejects.toThrow();
  });

  it('builds accurate WhatsApp share & reminder messages and logs WA reminder activity', async () => {
    await profileService.getOrSave({
      name: 'Bengkel Las Jaya',
      bank_name: 'Mandiri',
      bank_account_no: '1300-0011-2233',
      bank_account_name: 'Hendra Wijaya',
    });
    const client = await clientService.upsert({
      name: 'Ibu Sari',
      phone_wa: '081299998888',
    });

    const invDraft = await documentService.saveDraft(
      {
        client_id: client.id,
        doc_type: 'INVOICE',
        title: 'Kanopi Alderon',
        issue_date: '2026-11-26',
        due_date: '2026-12-03',
      },
      [{ item_name: 'Pasang Kanopi', qty: 1, unit: 'paket', unit_price: 4_000_000 }],
    );
    const inv = await documentService.publish(invDraft.id);

    const shareMsg = shareService.buildShareMessage(inv);
    expect(shareMsg).toContain('Ibu Sari');
    expect(shareMsg).toContain('Rp4.000.000');
    expect(shareMsg).toContain('Mandiri');
    expect(shareMsg).toContain('1300-0011-2233');
    expect(shareMsg).toContain('Bengkel Las Jaya');

    const remindMsg = shareService.buildReminderMessage(inv);
    expect(remindMsg).toContain('mengingatkan');
    expect(remindMsg).toContain('Rp4.000.000');

    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const waUrl = await shareService.openReminderWA(inv.id);
    expect(waUrl.startsWith('https://wa.me/6281299998888?text=')).toBe(true);
    expect(openSpy).toHaveBeenCalledTimes(1);
    openSpy.mockRestore();

    const refreshed = await documentService.getDetail(inv.id);
    expect(refreshed?.activities.some((a) => a.action_type === 'REMINDED_WA')).toBe(true);
  });
});
