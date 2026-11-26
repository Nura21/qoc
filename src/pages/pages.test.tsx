import type * as IonicReact from '@ionic/react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetDbForTesting } from '../db/client';
import { catalogService } from '../modules/catalog/catalogService';
import { clientService } from '../modules/clients/clientService';
import { documentService } from '../modules/documents/documentService';
import { paymentService } from '../modules/payments/paymentService';
import { profileService } from '../modules/profile/profileService';
import { appSession } from '../store/appSession';
import { todayLocalDate } from '../utils/formatters';

import CatalogPage from './CatalogPage';
import ClientsPage from './ClientsPage';
import DashboardPage from './DashboardPage';
import DocumentDetailPage from './DocumentDetailPage';
import DocumentForm from './DocumentForm';
import DocumentsPage from './DocumentsPage';
import PreviewTabPage from './PreviewTabPage';
import ProfilePage from './ProfilePage';

vi.mock('@ionic/react', async (importOriginal) => {
  const actual = await importOriginal<typeof IonicReact>();

  const MockIonModal: React.FC<{
    isOpen?: boolean;
    children?: React.ReactNode;
    onWillPresent?: () => void;
  }> = ({ isOpen, children, onWillPresent }) => {
    const wasOpen = React.useRef(false);
    React.useEffect(() => {
      if (isOpen && !wasOpen.current && onWillPresent) onWillPresent();
      wasOpen.current = Boolean(isOpen);
    }, [isOpen, onWillPresent]);
    if (!isOpen) return null;
    return <div data-testid="mock-modal">{children}</div>;
  };

  const MockIonAlert: React.FC<{
    isOpen?: boolean;
    header?: string;
    message?: string;
  }> = ({ isOpen, header, message }) =>
    isOpen ? (
      <div role="alertdialog" aria-label={header}>
        <div>{header}</div>
        <div>{message}</div>
      </div>
    ) : null;

  const MockIonActionSheet: React.FC<{ isOpen?: boolean; header?: string }> = ({ isOpen, header }) =>
    isOpen ? <div data-testid="mock-sheet">{header}</div> : null;

  const MockIonToast: React.FC<{ isOpen?: boolean; message?: string }> = ({ isOpen, message }) =>
    isOpen ? <div role="status">{message}</div> : null;

  return {
    ...actual,
    IonModal: MockIonModal,
    IonAlert: MockIonAlert,
    IonActionSheet: MockIonActionSheet,
    IonToast: MockIonToast,
  };
});

describe('Per-Page Integration Tests (All 8 Screens + Real SQLite)', () => {
  beforeEach(async () => {
    await resetDbForTesting();
    appSession.setLastViewedDocId(null);
    appSession.consumePendingFormSeed();
  });

  it('1. DashboardPage renders empty onboarding state and updates KPIs when data exists', async () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Setup Profil Bisnis (1x)', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByText('Belum ada tagihan atau penawaran')).toBeInTheDocument();
    unmount();

    // Seed profile, catalog, and overdue invoice
    await profileService.getOrSave({ name: 'Studio Kreatif QOC', bank_name: 'BCA', bank_account_no: '111222' });
    await catalogService.upsert({ name: 'Desain Banner', default_price: 250_000 });
    const client = await clientService.upsert({ name: 'PT Langganan Utama' });
    const draft = await documentService.saveDraft(
      {
        client_id: client.id,
        doc_type: 'INVOICE',
        title: 'Tagihan Proyek A',
        issue_date: todayLocalDate(-10),
        due_date: todayLocalDate(-2),
      },
      [{ item_name: 'Desain Banner', qty: 4, unit: 'paket', unit_price: 250_000 }],
    );
    await documentService.publish(draft.id);

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Studio Kreatif QOC')).toBeInTheDocument();
    expect(screen.getByText('1 Item Aktif')).toBeInTheDocument();
    expect(screen.getAllByText('Tagihan Proyek A').length).toBeGreaterThan(0);
    expect(screen.queryByText('Setup Profil Bisnis (1x)')).not.toBeInTheDocument();
  });

  it('2. DocumentsPage lists seeded documents, filters by segment tab, and searches live', async () => {
    const client = await clientService.upsert({ name: 'Bpk. Darmawan' });
    const qDraft = await documentService.saveDraft(
      { client_id: client.id, doc_type: 'QUOTATION', title: 'Penawaran Website' },
      [{ item_name: 'Landing Page', qty: 1, unit: 'paket', unit_price: 3_000_000 }],
    );
    const qPub = await documentService.publish(qDraft.id);
    const inv = await documentService.convert(qPub.id, 'INVOICE', { mode: 'FULL', autoPublish: true });
    await documentService.convert(inv.id, 'BAST', { autoPublish: true });

    render(
      <MemoryRouter initialEntries={['/documents']}>
        <DocumentsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Daftar Dokumen (3)')).toBeInTheDocument();

    // Filter to Invoice only
    fireEvent.click(screen.getByRole('button', { name: 'Invoice' }));
    expect(await screen.findByText('Daftar Dokumen (1)')).toBeInTheDocument();

    // Filter to BAST only
    fireEvent.click(screen.getByRole('button', { name: 'BAST' }));
    expect(await screen.findByText('Daftar Dokumen (1)')).toBeInTheDocument();

    // Back to Semua & search by keyword
    fireEvent.click(screen.getByRole('button', { name: 'Semua' }));
    expect(await screen.findByText('Daftar Dokumen (3)')).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText('Cari nomor, klien, proyek...');
    fireEvent.change(searchInput, { target: { value: 'TIDAK-ADA-XYZ' } });
    expect(await screen.findByText('Belum ada dokumen')).toBeInTheDocument();
  });

  it('3. CatalogPage filters Barang/Jasa and persists new items via form modal', async () => {
    await catalogService.upsert({ name: 'Pipa PVC 3 inch', item_type: 'GOODS', default_price: 45_000, unit: 'btg' });
    await catalogService.upsert({
      name: 'Jasa Pasang Pipa',
      item_type: 'SERVICE',
      default_price: 150_000,
      unit: 'titik',
    });

    render(
      <MemoryRouter initialEntries={['/catalog']}>
        <CatalogPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Pipa PVC 3 inch')).toBeInTheDocument();
    expect(screen.getByText('Jasa Pasang Pipa')).toBeInTheDocument();

    // Filter by Jasa chip
    fireEvent.click(screen.getByRole('button', { name: 'Jasa' }));
    await waitFor(() => {
      expect(screen.queryByText('Pipa PVC 3 inch')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Jasa Pasang Pipa')).toBeInTheDocument();

    // Open Add Modal and save new item
    fireEvent.click(screen.getByRole('button', { name: 'Semua' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tambah' }));

    fireEvent.change(screen.getByLabelText('Nama Barang / Jasa *'), { target: { value: 'Kran Air Stainless' } });
    fireEvent.change(screen.getByLabelText('Harga *'), { target: { value: '85000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Simpan ke List Barang' }));

    expect(await screen.findByText('Kran Air Stainless')).toBeInTheDocument();
    expect(await catalogService.list()).toHaveLength(3);
  });

  it('4. ClientsPage shows empty state and persists new client via modal', async () => {
    render(
      <MemoryRouter initialEntries={['/clients']}>
        <ClientsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Belum ada klien tersimpan')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '+ Tambah Klien' }));
    fireEvent.change(screen.getByLabelText('Nama Klien / PIC *'), { target: { value: 'Ibu Melati' } });
    fireEvent.change(screen.getByLabelText('Perusahaan / Instansi'), { target: { value: 'Kafe Melati' } });
    fireEvent.change(screen.getByLabelText('Nomor WhatsApp'), { target: { value: '08123456789' } });
    fireEvent.click(screen.getByRole('button', { name: 'Simpan Klien' }));

    expect(await screen.findByText('Ibu Melati')).toBeInTheDocument();
    expect(await clientService.list()).toHaveLength(1);
  });

  it('5. DocumentForm adds manual item, updates Sticky Total Bar, preserves tax in edit mode, and saves to SQLite', async () => {
    const client = await clientService.upsert({ name: 'PT Form Uji' });

    const { unmount } = render(
      <MemoryRouter initialEntries={['/documents/new?type=QUOTATION']}>
        <Routes>
          <Route path="/documents/new" element={<DocumentForm />} />
          <Route path="/documents/:id" element={<div>Redirected Detail</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Buat Quotation')).toBeInTheDocument();

    // Open Manual Item Modal and add an item
    fireEvent.click(screen.getByRole('button', { name: '+ Manual' }));
    fireEvent.change(screen.getByLabelText('Nama Item / Jasa *'), { target: { value: 'Desain Logo Brand' } });
    fireEvent.change(screen.getByLabelText('Harga Satuan *'), { target: { value: '500000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tambahkan ke Dokumen' }));

    expect(await screen.findByText('Desain Logo Brand')).toBeInTheDocument();
    expect(screen.getByText('Total (1 item)')).toBeInTheDocument();

    // Tap '+' stepper -> qty 2 -> total becomes Rp1.000.000
    fireEvent.click(screen.getByRole('button', { name: '+' }));
    await waitFor(() => {
      expect(screen.getAllByText('Rp1.000.000').length).toBeGreaterThan(0);
    });

    // Save as Draft
    fireEvent.click(screen.getByRole('button', { name: 'Draft' }));
    expect(await screen.findByText('Redirected Detail')).toBeInTheDocument();

    const savedDocs = await documentService.list();
    expect(savedDocs).toHaveLength(1);
    expect(savedDocs[0].total_amount).toBe(1_000_000);
    unmount();

    // Edit Mode must preserve existing tax_amount
    const taxDraft = await documentService.saveDraft(
      {
        client_id: client.id,
        doc_type: 'INVOICE',
        title: 'Draft Dengan Pajak',
        tax_amount: 110_000,
      },
      [{ item_name: 'Jasa Konsultasi', qty: 1, unit: 'paket', unit_price: 1_000_000 }],
    );

    render(
      <MemoryRouter initialEntries={[`/documents/${taxDraft.id}/edit`]}>
        <Routes>
          <Route path="/documents/:id/edit" element={<DocumentForm />} />
          <Route path="/documents/:id" element={<div>Saved Edit Detail</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByDisplayValue('Draft Dengan Pajak')).toBeInTheDocument();
    expect(screen.getAllByText('Rp1.110.000').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Draft' }));
    expect(await screen.findByText('Saved Edit Detail')).toBeInTheDocument();

    const reloaded = await documentService.getDetail(taxDraft.id);
    expect(reloaded?.tax_amount).toBe(110_000);
    expect(reloaded?.total_amount).toBe(1_110_000);
  });

  it('6. DocumentDetailPage renders contextual actions for Quotation, Invoice (with payments & VOID), and BAST', async () => {
    const client = await clientService.upsert({ name: 'PT Detail Tes' });

    // A. Draft Quotation -> shows Hapus Draft Ini
    const qDraft = await documentService.saveDraft(
      { client_id: client.id, doc_type: 'QUOTATION', title: 'Quo Detail' },
      [{ item_name: 'Item Quo', qty: 1, unit: 'paket', unit_price: 750_000 }],
    );

    const { unmount: unmountQ } = render(
      <MemoryRouter initialEntries={[`/documents/${qDraft.id}`]}>
        <Routes>
          <Route path="/documents/:id" element={<DocumentDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('1-Klik Deal → Invoice')).toBeInTheDocument();
    expect(screen.getByText('Hapus Draft Ini')).toBeInTheDocument();
    unmountQ();

    // B. Published Unpaid Invoice -> shows Catat DP / Lunas & Batalkan Invoice (VOID)
    const invDraft = await documentService.saveDraft(
      { client_id: client.id, doc_type: 'INVOICE', title: 'Inv Detail' },
      [{ item_name: 'Item Inv', qty: 1, unit: 'paket', unit_price: 1_200_000 }],
    );
    const invPub = await documentService.publish(invDraft.id);

    const { unmount: unmountInv } = render(
      <MemoryRouter initialEntries={[`/documents/${invPub.id}`]}>
        <Routes>
          <Route path="/documents/:id" element={<DocumentDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Catat DP / Lunas')).toBeInTheDocument();
    expect(screen.getByText('Batalkan Invoice')).toBeInTheDocument();
    expect(screen.queryByText('Hapus Draft Ini')).not.toBeInTheDocument();
    unmountInv();

    // C. Invoice after partial payment -> hides Batalkan Invoice and shows payment history
    await paymentService.record(invPub.id, { amount: 500_000, method: 'TRANSFER', notes: 'DP Tahap 1' });
    render(
      <MemoryRouter initialEntries={[`/documents/${invPub.id}`]}>
        <Routes>
          <Route path="/documents/:id" element={<DocumentDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Riwayat Pembayaran (1)')).toBeInTheDocument();
    expect(screen.queryByText('Batalkan Invoice')).not.toBeInTheDocument();
  });

  it('7. PreviewTabPage renders empty state first and auto-loads latest document when available', async () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={['/preview']}>
        <PreviewTabPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Belum ada dokumen untuk dipratinjau')).toBeInTheDocument();
    unmount();

    const draft = await documentService.saveDraft({ client_id: null, doc_type: 'QUOTATION', title: 'Preview Auto' }, [
      { item_name: 'Paket Preview', qty: 1, unit: 'paket', unit_price: 900_000 },
    ]);
    await documentService.publish(draft.id);

    render(
      <MemoryRouter initialEntries={['/preview']}>
        <PreviewTabPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Paket Preview')).toBeInTheDocument();
  });

  it('8. ProfilePage renders profile, edits business data into SQLite, and displays clients & backup controls', async () => {
    await clientService.upsert({ name: 'Klien Profil' });

    render(
      <MemoryRouter initialEntries={['/profile']}>
        <ProfilePage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Daftar Klien (1)')).toBeInTheDocument();
    expect(screen.getByText('Klien Profil')).toBeInTheDocument();

    // Open Edit Profil modal and update business name
    fireEvent.click(screen.getByRole('button', { name: 'Edit Profil' }));
    fireEvent.change(screen.getByLabelText('Nama Usaha / Brand *'), { target: { value: 'CV Berkah Abadi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Simpan Profil' }));

    expect(await screen.findByText('CV Berkah Abadi')).toBeInTheDocument();
    expect((await profileService.get())?.name).toBe('CV Berkah Abadi');

    // Open Panduan Singkat QOC modal from Pengaturan & Bantuan
    fireEvent.click(screen.getByRole('button', { name: /Panduan Singkat QOC/i }));
    expect(await screen.findByText('Isi Profil & Klien')).toBeInTheDocument();
    expect(screen.getByText('1-Klik Deal, Bayar & BAST')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Siap Dipakai' }));

    // Toggle Theme mode inside Pengaturan & Bantuan
    fireEvent.click(screen.getByRole('button', { name: 'Gelap' }));
    expect(document.documentElement.classList.contains('ion-palette-dark')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Terang' }));
    expect(document.documentElement.classList.contains('ion-palette-dark')).toBe(false);

    // Developer credit link points to LinkedIn profile
    const devLink = screen.getByRole('link', { name: 'Nura' });
    expect(devLink).toHaveAttribute('href', 'https://www.linkedin.com/in/muhammad-irfansyahfalah/');
  });
});
