import type * as IonicReact from '@ionic/react';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ManualItemModal } from '../components/documents/ManualItemModal';
import { DsCurrencyInput } from '../components/ui/DsField';
import { DsFormModal } from '../components/ui/DsFormModal';
import { DsSearchBar } from '../components/ui/DsSearchBar';
import { backupService } from '../db/backup';
import { resetDbForTesting } from '../db/client';
import { renderBastPdf } from '../templates/bastPdf';
import { renderInvoicePdf } from '../templates/invoicePdf';
import { renderQuotationPdf } from '../templates/quotationPdf';
import { todayLocalDate } from '../utils/formatters';

import { catalogService } from './catalog/catalogService';
import { clientService } from './clients/clientService';
import { documentService } from './documents/documentService';
import { paymentService } from './payments/paymentService';
import { profileService } from './profile/profileService';

vi.mock('@ionic/react', async (importOriginal) => {
  const actual = await importOriginal<typeof IonicReact>();
  const MockIonModal: React.FC<{
    isOpen?: boolean;
    children?: React.ReactNode;
    onWillPresent?: () => void;
    initialBreakpoint?: number;
  }> = ({ isOpen, children, onWillPresent, initialBreakpoint }) => {
    const wasOpenRef = React.useRef(false);
    React.useEffect(() => {
      if (isOpen && !wasOpenRef.current && onWillPresent) {
        onWillPresent();
      }
      wasOpenRef.current = Boolean(isOpen);
    }, [isOpen, onWillPresent]);
    if (!isOpen) return null;
    return (
      <div data-testid="mock-ion-modal" data-has-sheet-breakpoint={initialBreakpoint !== undefined ? 'true' : 'false'}>
        {children}
      </div>
    );
  };
  return {
    ...actual,
    IonModal: MockIonModal,
  };
});

describe('QOC Automated Stress-Test Suite (Edge Cases, Scale, PDF & UI)', () => {
  beforeEach(async () => {
    await resetDbForTesting();
  });

  it('handles 140+ char extreme text across Quotation, Invoice, and BAST PDFs without crashing', async () => {
    const longBizName =
      'CV Karya Konstruksi Mandiri Nusantara Sejahtera Abadi Perkasa Divisi Pemasangan Interior & Renovasi Komersial Skala Nasional';
    const longClientName =
      'Bpk. Ir. H. Muhammad Sulaiman Prawirodiningrat Kusumawardhana S.T., M.T. (Direktur Pengadaan Proyek Infrastruktur)';
    const longTitle =
      'Pengadaan, Pemasangan, Kalibrasi, dan Pemeliharaan Tahap I-IV Sistem Tata Udara, Kelistrikan, serta Interior Kantor Pusat Gedung Utama';
    const longItemName =
      'Paket Pekerjaan Borongan Pemasangan Plafon Gypsum Jayaboard 9mm + Rangka Hollow Galvanis Anti Karat + Pengecatan Dulux Weathershield 3 Lapis';
    const longDesc =
      'Termasuk material bantu, perancah kerja (scaffolding), pembersihan puing harian, garansi kebocoran & keretakan selama 12 bulan kalender penuh.';

    await profileService.getOrSave({
      name: longBizName,
      phone_wa: '6281234567890',
      address: 'Jl. Jenderal Sudirman Kav. 52-53, SCBD Lot 18, Kebayoran Baru, Jakarta Selatan, DKI Jakarta 12190',
      bank_name: 'Bank Central Asia (BCA)',
      bank_account_no: '5410-8829-7712-001',
      bank_account_name: longBizName,
    });

    const client = await clientService.upsert({
      name: longClientName,
      company_name: 'PT Nusantara Properti & Pengembangan Kawasan Industri Terpadu Tbk.',
      phone_wa: '6281999888777',
      address: 'Kawasan Industri Jababeka Tahap III Blok K-12A, Cikarang Utara, Kabupaten Bekasi, Jawa Barat 17530',
    });

    const draft = await documentService.saveDraft(
      {
        client_id: client.id,
        doc_type: 'QUOTATION',
        title: longTitle,
        issue_date: '2026-11-26',
        valid_until: '2026-12-26',
        scope_and_terms: `${longDesc} ${longDesc}`,
        notes: longDesc,
      },
      [
        {
          item_name: longItemName,
          description: longDesc,
          qty: 125.5,
          unit: 'm2-terpasang',
          unit_price: 275000,
        },
      ],
    );

    const publishedQuo = await documentService.publish(draft.id);
    const inv = await documentService.convert(publishedQuo.id, 'INVOICE', { mode: 'FULL', autoPublish: true });
    const bast = await documentService.convert(inv.id, 'BAST', { mode: 'FULL', autoPublish: true });

    const quoPdf = renderQuotationPdf(publishedQuo).output('datauristring');
    const invPdf = renderInvoicePdf(inv).output('datauristring');
    const bastPdf = renderBastPdf(bast).output('datauristring');

    expect(quoPdf).toContain('data:application/pdf');
    expect(invPdf).toContain('data:application/pdf');
    expect(bastPdf).toContain('data:application/pdf');
  });

  it('handles 50 line items, huge Rupiah values, over-discount clamping, and 15 atomic document numbers', async () => {
    const client = await clientService.upsert({ name: 'PT Skala Besar' });

    const fiftyItems = Array.from({ length: 50 }, (_, idx) => ({
      item_name: `Item Material & Jasa Proyek Tahap #${idx + 1}`,
      description: `Spesifikasi teknis baris ke-${idx + 1}`,
      qty: idx + 1,
      unit: 'unit',
      unit_price: 1_000_000,
    }));

    const bigDraft = await documentService.saveDraft(
      {
        client_id: client.id,
        doc_type: 'INVOICE',
        title: 'Tagihan 50 Item Skala Besar',
        issue_date: '2026-11-26',
        due_date: '2026-12-10',
        tax_amount: 140_250_000,
      },
      fiftyItems,
    );
    const bigInv = await documentService.publish(bigDraft.id);
    // Sum of 1..50 = 1275 -> subtotal = 1,275,000,000
    expect(bigInv.subtotal).toBe(1_275_000_000);
    expect(bigInv.items).toHaveLength(50);
    // Multi-page PDF must succeed cleanly
    const multiPagePdf = renderInvoicePdf(bigInv);
    expect(multiPagePdf.getNumberOfPages()).toBeGreaterThan(1);

    // Discount larger than subtotal must clamp BOTH discount_amount (to subtotal) and total_amount (to 0)
    const zeroDraft = await documentService.saveDraft(
      {
        client_id: client.id,
        doc_type: 'QUOTATION',
        title: 'Penawaran Promo 100%',
        issue_date: '2026-11-26',
        discount_amount: 5_000_000,
      },
      [{ item_name: 'Sample Gratis', qty: 1, unit: 'pcs', unit_price: 100_000 }],
    );
    expect(zeroDraft.discount_amount).toBe(100_000);
    expect(zeroDraft.total_amount).toBe(0);

    // 15 sequential quotations -> unique atomic numbers 001..015
    const generatedNumbers = new Set<string>();
    for (let i = 0; i < 15; i += 1) {
      const q = await documentService.saveDraft(
        {
          client_id: client.id,
          doc_type: 'QUOTATION',
          title: `Quotation Batch #${i + 1}`,
          issue_date: '2026-11-26',
        },
        [{ item_name: 'Jasa Audit', qty: 1, unit: 'paket', unit_price: 250_000 }],
      );
      const pub = await documentService.publish(q.id);
      generatedNumbers.add(pub.doc_number);
    }
    expect(generatedNumbers.size).toBe(15);
    expect(generatedNumbers.has('QUO-202611-001')).toBe(true);
    expect(generatedNumbers.has('QUO-202611-015')).toBe(true);
  });

  it('enforces bounced giro, partial payment, VOID lock, and draft-only deletion guards', async () => {
    const client = await clientService.upsert({ name: 'Toko Sinar Abadi' });

    const draft = await documentService.saveDraft(
      {
        client_id: client.id,
        doc_type: 'INVOICE',
        title: 'Pengiriman Batch Oktober',
        issue_date: todayLocalDate(-10),
        due_date: todayLocalDate(-2),
      },
      [{ item_name: 'Unit Pompa Air', qty: 2, unit: 'unit', unit_price: 1_500_000 }],
    );

    // Draft deletion works
    const tempDraft = await documentService.saveDraft(
      { client_id: client.id, doc_type: 'QUOTATION', title: 'Draft Hapus' },
      [{ item_name: 'Item Temp', qty: 1, unit: 'pcs', unit_price: 50_000 }],
    );
    await documentService.remove(tempDraft.id);
    expect(await documentService.getDetail(tempDraft.id)).toBeNull();

    const inv = await documentService.publish(draft.id);

    // Published document CANNOT be deleted via remove
    await expect(documentService.remove(inv.id)).rejects.toThrow();

    // Pending giro -> bounced -> paid_amount remains 0
    const withGiro = await paymentService.record(inv.id, { amount: 1_000_000, method: 'GIRO' });
    expect(withGiro.paid_amount).toBe(0);
    const bounced = await paymentService.updateStatus(withGiro.payments[0].id, 'BOUNCED');
    expect(bounced.paid_amount).toBe(0);
    expect(bounced.status).toBe('SENT');

    // Partial confirmed payment -> status PARTIAL, and VOID must be blocked
    const partial = await paymentService.record(inv.id, { amount: 1_000_000, method: 'TRANSFER' });
    expect(partial.status).toBe('PARTIAL');
    expect(partial.paid_amount).toBe(1_000_000);
    await expect(documentService.updateStatus(inv.id, 'VOID')).rejects.toThrow();

    // Final settlement -> status PAID & is_overdue false
    const paid = await paymentService.record(inv.id, { amount: 2_000_000, method: 'CASH' });
    expect(paid.status).toBe('PAID');
    expect(paid.is_overdue).toBe(false);
  });

  it('rejects malformed backup JSON and cleanly restores full parent-child document chains', async () => {
    await expect(backupService.importJson('{ invalid json')).rejects.toThrow();
    await expect(backupService.importJson(JSON.stringify({ schemaVersion: 1 }))).rejects.toThrow();

    const client = await clientService.upsert({ name: 'Klien Backup Chain' });
    await catalogService.upsert({
      name: 'Jasa Instalasi',
      default_price: 750_000,
      unit: 'titik',
      item_type: 'SERVICE',
    });

    const qDraft = await documentService.saveDraft(
      { client_id: client.id, doc_type: 'QUOTATION', title: 'Proyek Chain', issue_date: '2026-11-26' },
      [{ item_name: 'Jasa Instalasi', qty: 4, unit: 'titik', unit_price: 750_000 }],
    );
    const qPub = await documentService.publish(qDraft.id);
    const qRev = await documentService.reviseQuotation(qPub.id);
    const invDp = await documentService.convert(qPub.id, 'INVOICE', {
      mode: 'DP_PERCENT',
      dpPercent: 40,
      autoPublish: true,
    });
    const bast = await documentService.convert(invDp.id, 'BAST', { mode: 'FULL', autoPublish: true });
    await paymentService.record(invDp.id, { amount: 1_200_000, method: 'TRANSFER' });

    const snapshotJson = JSON.stringify(await backupService.buildPayload());
    await resetDbForTesting();

    const res = await backupService.importJson(snapshotJson);
    expect(res.restoredCounts.documents).toBe(4);
    expect(res.restoredCounts.catalog_items).toBe(1);
    expect(res.restoredCounts.clients).toBe(1);
    expect(res.restoredCounts.payments).toBe(1);

    expect((await documentService.getDetail(qRev.id))?.parent_document_id).toBe(qPub.id);
    expect((await documentService.getDetail(invDp.id))?.status).toBe('PAID');
    expect((await documentService.getDetail(bast.id))?.doc_type).toBe('BAST');
  });

  it('renders keyboard-safe DsFormModal, DsSearchBar, and ManualItemModal cleanly in create & edit modes', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();

    render(
      <DsFormModal
        isOpen
        title="Uji Modal Keyboard-Safe"
        onClose={onClose}
        footer={<button type="button">Simpan Uji</button>}
      >
        <DsSearchBar value="logo" placeholder="Cari item..." onValueChange={() => undefined} />
      </DsFormModal>,
    );

    expect(screen.getByText('Uji Modal Keyboard-Safe')).toBeInTheDocument();
    expect(screen.getByText('Simpan Uji')).toBeInTheDocument();
    expect(screen.getByTestId('mock-ion-modal')).toHaveAttribute('data-has-sheet-breakpoint', 'false');

    const { rerender } = render(
      <ManualItemModal
        isOpen
        onClose={onClose}
        onSave={onSave}
        editingItem={{
          name: 'Desain Kemasan Custom',
          description: 'Ukuran A4 glossy',
          qty: 3,
          unit: 'paket',
          price: 450_000,
          isFromCatalog: true,
        }}
      />,
    );

    expect(screen.getByText('Edit Item Transaksi')).toBeInTheDocument();
    expect((screen.getByLabelText('Nama Item / Jasa *') as HTMLInputElement).value).toBe('Desain Kemasan Custom');

    rerender(<ManualItemModal isOpen={false} onClose={onClose} onSave={onSave} editingItem={null} />);
    rerender(<ManualItemModal isOpen onClose={onClose} onSave={onSave} editingItem={null} />);
    expect(screen.getByText('Tambah Item Manual')).toBeInTheDocument();
    const nameInput = screen.getByLabelText('Nama Item / Jasa *') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Biaya Survei Lokasi' } });
    expect(nameInput.value).toBe('Biaya Survei Lokasi');
  });

  it('enforces overpayment block, payment removal, VOID stock restore, revision superseding, snapshot search, and DsCurrencyInput', async () => {
    // 1. Overpayment guard + payment undo/removal
    const client = await clientService.upsert({ name: 'PT Awal Mula Sejahtera' });
    const trackedItem = await catalogService.upsert({
      name: 'Kabel Fiber 100m',
      item_type: 'GOODS',
      unit: 'roll',
      default_price: 500_000,
      track_stock: true,
      stock_qty: 5,
    });

    const invDraft = await documentService.saveDraft(
      { client_id: client.id, doc_type: 'INVOICE', title: 'Pengiriman Kabel', issue_date: '2026-11-26' },
      [
        {
          catalog_item_id: trackedItem.id,
          item_name: trackedItem.name,
          qty: 2,
          unit: 'roll',
          unit_price: 500_000,
        },
      ],
    );
    const inv = await documentService.publish(invDraft.id);
    expect((await catalogService.getById(trackedItem.id))?.stock_qty).toBe(3);

    // Overpayment (> Rp1.000.000) MUST be rejected
    await expect(paymentService.record(inv.id, { amount: 10_000_000, method: 'TRANSFER' })).rejects.toThrow();

    // Record valid partial payment, then remove it -> reverts to SENT with paid_amount = 0
    const partial = await paymentService.record(inv.id, { amount: 400_000, method: 'TRANSFER' });
    expect(partial.status).toBe('PARTIAL');
    const reverted = await paymentService.remove(partial.payments[0].id);
    expect(reverted.status).toBe('SENT');
    expect(reverted.paid_amount).toBe(0);

    // 2. VOID restores tracked catalog stock back to 5
    await documentService.updateStatus(inv.id, 'VOID');
    expect((await catalogService.getById(trackedItem.id))?.stock_qty).toBe(5);

    // 3. Snapshot client search still finds old document after master client rename
    await clientService.upsert({ id: client.id, name: 'PT Nama Baru Berubah' });
    const foundByOldName = await documentService.list({ query: 'Awal Mula' });
    expect(foundByOldName.some((d) => d.id === inv.id)).toBe(true);

    // 4. Publishing Quotation Rev.1 supersedes Rev.0 (SENT -> EXPIRED) so waitingQuotationCount stays 1
    const q0Draft = await documentService.saveDraft(
      { client_id: client.id, doc_type: 'QUOTATION', title: 'Penawaran Interior' },
      [{ item_name: 'Desain 3D', qty: 1, unit: 'paket', unit_price: 2_000_000 }],
    );
    const q0 = await documentService.publish(q0Draft.id);
    const q1Draft = await documentService.reviseQuotation(q0.id);
    const q1 = await documentService.publish(q1Draft.id);

    expect((await documentService.getDetail(q0.id))?.status).toBe('EXPIRED');
    expect(q1.status).toBe('SENT');
    const summary = await documentService.getDashboardSummary();
    expect(summary.waitingQuotationCount).toBe(1);

    // 5. DsCurrencyInput displays formatted thousands (250.000) while emitting raw numeric string
    const onRawChange = vi.fn();
    render(<DsCurrencyInput label="Nominal Uji" value="250000" onValueChange={onRawChange} />);
    const currInput = screen.getByLabelText('Nominal Uji') as HTMLInputElement;
    expect(currInput.value).toBe('250.000');
    fireEvent.change(currInput, { target: { value: '1.500.000' } });
    expect(onRawChange).toHaveBeenCalledWith('1500000');
  });
});
