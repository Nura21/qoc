import { catalogService } from '../modules/catalog/catalogService';
import { clientService } from '../modules/clients/clientService';
import { documentService } from '../modules/documents/documentService';
import { paymentService } from '../modules/payments/paymentService';
import { profileService } from '../modules/profile/profileService';
import { appSession } from '../store/appSession';
import { todayLocalDate } from '../utils/formatters';

import { getDb, notifyDbChanged } from './client';

const DEMO_SEED_FLAG = 'qoc_demo_seeded_v1';

function isAutomatedTestEnv(): boolean {
  return (
    typeof process !== 'undefined' &&
    typeof process.env === 'object' &&
    (Boolean(process.env.VITEST) || process.env.NODE_ENV === 'test')
  );
}

function markDemoFlag(): void {
  try {
    window.localStorage.setItem(DEMO_SEED_FLAG, 'done');
  } catch {
    // Ignore storage errors
  }
}

function hasDemoFlag(): boolean {
  try {
    return window.localStorage.getItem(DEMO_SEED_FLAG) === 'done';
  } catch {
    return false;
  }
}

/**
 * Seeds a realistic Indonesian UMKM showcase dataset covering every QOC flow:
 * Profile, 4 Clients, 6 Catalog Items (Goods + Services), Overdue Partial Invoice,
 * Sent Invoice with Pending Giro, Paid Invoice + Signed BAST, Active Quotation, and Draft Quotation.
 */
export async function seedDemoData(): Promise<{
  clients: number;
  catalog: number;
  documents: number;
}> {
  await profileService.getOrSave({
    name: 'Studio Karya Nusantara',
    phone_wa: '6281298765432',
    address: 'Jl. Kemang Raya No. 48, Jakarta Selatan',
    bank_name: 'BCA',
    bank_account_no: '5410-8829-10',
    bank_account_name: 'Irfan Pratama',
    default_scope_terms:
      'Maksimal 2× revisi minor. Pekerjaan tambahan di luar rincian dikenakan biaya sesuai kesepakatan.',
    prefix_quotation: 'QUO',
    prefix_invoice: 'INV',
    prefix_bast: 'BAST',
  });

  const [cAndi, cRina, cHendra, cMelati] = await Promise.all([
    clientService.upsert({
      name: 'Bpk. Andi Wijaya',
      company_name: 'PT Sinar Jaya Mandiri',
      phone_wa: '081234567890',
      email: 'andi@sinarjaya.co.id',
      address: 'Jl. Sudirman Kav. 21, Jakarta Pusat',
    }),
    clientService.upsert({
      name: 'Ibu Rina Kusuma',
      company_name: 'Kafe Kopi Senja',
      phone_wa: '081388887777',
      address: 'Jl. Braga No. 12, Bandung',
    }),
    clientService.upsert({
      name: 'Bpk. Hendra Gunawan',
      company_name: 'CV Bangun Karya',
      phone_wa: '085611112222',
      address: 'BSD City Sektor VII, Tangerang Selatan',
    }),
    clientService.upsert({
      name: 'Ibu Melati Putri',
      company_name: 'Butik Melati',
      phone_wa: '081944445555',
      address: 'Summarecon Bekasi Blok C-5',
    }),
  ]);

  const [catLogo, catWeb, catInstall, catNeon, catBanner, catCard] = await Promise.all([
    catalogService.upsert({
      item_type: 'SERVICE',
      name: 'Jasa Desain Brand & Logo',
      category: 'Desain',
      description: '3 opsi konsep logo, panduan warna, dan file master siap cetak',
      unit: 'paket',
      default_price: 3_500_000,
    }),
    catalogService.upsert({
      item_type: 'SERVICE',
      name: 'Pembuatan Website Company Profile',
      category: 'Digital',
      description: 'Desain responsif mobile, domain 1 tahun, & optimasi WhatsApp',
      unit: 'paket',
      default_price: 6_500_000,
    }),
    catalogService.upsert({
      item_type: 'SERVICE',
      name: 'Jasa Pemasangan Signage LED',
      category: 'Instalasi',
      description: 'Pemasangan di lokasi lengkap dengan kabel & trafo',
      unit: 'titik',
      default_price: 1_250_000,
    }),
    catalogService.upsert({
      item_type: 'GOODS',
      sku: 'NBX-120',
      name: 'Neon Box Akrilik 120×60cm',
      category: 'Signage',
      description: 'Akrilik susu 3mm + lampu LED Samsung anti air',
      unit: 'unit',
      default_price: 2_400_000,
      track_stock: true,
      stock_qty: 8,
    }),
    catalogService.upsert({
      item_type: 'GOODS',
      sku: 'BNR-01',
      name: 'Standing Banner Roll-Up Aluminium',
      category: 'Display',
      description: 'Ukuran 85×200cm + cetak albatros laminasi doff',
      unit: 'pcs',
      default_price: 350_000,
      track_stock: true,
      stock_qty: 24,
    }),
    catalogService.upsert({
      item_type: 'GOODS',
      sku: 'KTN-DOFF',
      name: 'Kartu Nama Premium Laminasi Doff',
      category: 'Cetak',
      description: 'Art carton 310gsm cetak bolak-balik (isi 100 lbr)',
      unit: 'box',
      default_price: 120_000,
      track_stock: true,
      stock_qty: 35,
    }),
  ]);

  // 1. Overdue Partial Invoice (highlights red urgent card + DP progress bar on Dashboard)
  const inv1Draft = await documentService.saveDraft(
    {
      client_id: cRina.id,
      doc_type: 'INVOICE',
      title: 'Paket Branding & Neon Box Outlet Braga',
      issue_date: todayLocalDate(-14),
      due_date: todayLocalDate(-3),
      scope_and_terms: 'Garansi lampu LED 6 bulan sejak pemasangan selesai.',
    },
    [
      {
        catalog_item_id: catLogo.id,
        item_name: catLogo.name,
        description: catLogo.description,
        qty: 1,
        unit: catLogo.unit,
        unit_price: catLogo.default_price,
      },
      {
        catalog_item_id: catNeon.id,
        item_name: catNeon.name,
        description: catNeon.description,
        qty: 1,
        unit: catNeon.unit,
        unit_price: catNeon.default_price,
      },
    ],
  );
  const inv1 = await documentService.publish(inv1Draft.id);
  await paymentService.record(inv1.id, {
    amount: 2_500_000,
    payment_date: todayLocalDate(-12),
    method: 'TRANSFER',
    notes: 'DP tahap 1 via BCA',
  });

  // 2. Sent Invoice due in 5 days with Pending Giro (showcases Giro clear/bounce buttons)
  const inv2Draft = await documentService.saveDraft(
    {
      client_id: cAndi.id,
      doc_type: 'INVOICE',
      title: 'Website Korporat & Banner Pameran',
      issue_date: todayLocalDate(-2),
      due_date: todayLocalDate(5),
      discount_amount: 350_000,
      scope_and_terms: 'Termasuk pelatihan admin 1× sesi online & garansi teknis 3 bulan.',
    },
    [
      {
        catalog_item_id: catWeb.id,
        item_name: catWeb.name,
        description: catWeb.description,
        qty: 1,
        unit: catWeb.unit,
        unit_price: catWeb.default_price,
      },
      {
        catalog_item_id: catBanner.id,
        item_name: catBanner.name,
        description: catBanner.description,
        qty: 3,
        unit: catBanner.unit,
        unit_price: catBanner.default_price,
      },
    ],
  );
  const inv2 = await documentService.publish(inv2Draft.id);
  await paymentService.record(inv2.id, {
    amount: 3_000_000,
    payment_date: todayLocalDate(-1),
    method: 'GIRO',
    giro_due_date: todayLocalDate(4),
    notes: 'Giro BCA #882190',
  });

  // 3. Paid Invoice + Converted Signed BAST (showcases Lunas & Serah Terima PDF)
  const inv3Draft = await documentService.saveDraft(
    {
      client_id: cMelati.id,
      doc_type: 'INVOICE',
      title: 'Rebranding & Cetak Kartu Nama Butik',
      issue_date: todayLocalDate(-7),
      due_date: todayLocalDate(-1),
    },
    [
      {
        catalog_item_id: catLogo.id,
        item_name: catLogo.name,
        description: catLogo.description,
        qty: 1,
        unit: catLogo.unit,
        unit_price: catLogo.default_price,
      },
      {
        catalog_item_id: catCard.id,
        item_name: catCard.name,
        description: catCard.description,
        qty: 3,
        unit: catCard.unit,
        unit_price: catCard.default_price,
      },
    ],
  );
  const inv3 = await documentService.publish(inv3Draft.id);
  await paymentService.record(inv3.id, {
    amount: inv3.total_amount,
    payment_date: todayLocalDate(-4),
    method: 'QRIS',
    notes: 'Pelunasan penuh via QRIS',
  });
  const bast1 = await documentService.convert(inv3.id, 'BAST', {
    handoverDate: todayLocalDate(-3),
    autoPublish: true,
  });
  await documentService.updateStatus(bast1.id, 'SIGNED');

  // 4. Sent Quotation (ready for 1-Click Deal -> Invoice or Revise)
  const quo1Draft = await documentService.saveDraft(
    {
      client_id: cHendra.id,
      doc_type: 'QUOTATION',
      title: 'Penawaran Signage & Website Kantor Baru',
      issue_date: todayLocalDate(),
      valid_until: todayLocalDate(14),
      scope_and_terms: 'Estimasi pengerjaan 14 hari kerja setelah DP 50% diterima.',
    },
    [
      {
        catalog_item_id: catWeb.id,
        item_name: catWeb.name,
        description: catWeb.description,
        qty: 1,
        unit: catWeb.unit,
        unit_price: catWeb.default_price,
      },
      {
        catalog_item_id: catNeon.id,
        item_name: catNeon.name,
        description: catNeon.description,
        qty: 1,
        unit: catNeon.unit,
        unit_price: catNeon.default_price,
      },
      {
        catalog_item_id: catInstall.id,
        item_name: catInstall.name,
        description: catInstall.description,
        qty: 1,
        unit: catInstall.unit,
        unit_price: catInstall.default_price,
      },
    ],
  );
  await documentService.publish(quo1Draft.id);

  // 5. Draft Quotation (ready to test Edit Draft & Delete Draft)
  await documentService.saveDraft(
    {
      client_id: cMelati.id,
      doc_type: 'QUOTATION',
      title: 'Paket Banner Promo Akhir Tahun',
      issue_date: todayLocalDate(),
      valid_until: todayLocalDate(10),
    },
    [
      {
        catalog_item_id: catBanner.id,
        item_name: catBanner.name,
        description: catBanner.description,
        qty: 3,
        unit: catBanner.unit,
        unit_price: catBanner.default_price,
      },
    ],
  );

  // Set default preview tab to the overdue partial invoice so Preview tab looks rich immediately
  appSession.setLastViewedDocId(inv1.id);
  markDemoFlag();
  notifyDbChanged();

  return { clients: 4, catalog: 6, documents: 6 };
}

/**
 * Auto-seeds realistic sample data ONCE on first real app launch when database is empty.
 * Skipped in automated unit tests so test suites always start with a clean empty database.
 */
export async function seedDemoDataIfEmpty(): Promise<boolean> {
  if (isAutomatedTestEnv() || hasDemoFlag()) return false;

  const db = await getDb();
  const [docCnt, clientCnt, catCnt] = await Promise.all([
    db.query<{ cnt: number }>('SELECT COUNT(*) AS cnt FROM documents'),
    db.query<{ cnt: number }>('SELECT COUNT(*) AS cnt FROM clients'),
    db.query<{ cnt: number }>('SELECT COUNT(*) AS cnt FROM catalog_items'),
  ]);

  const isEmpty =
    Number(docCnt[0]?.cnt ?? 0) === 0 && Number(clientCnt[0]?.cnt ?? 0) === 0 && Number(catCnt[0]?.cnt ?? 0) === 0;

  if (!isEmpty) {
    markDemoFlag();
    return false;
  }

  await seedDemoData();
  return true;
}

/**
 * Atomically clears all local tables (used when switching from Demo Data to real business records).
 */
export async function clearAllData(): Promise<void> {
  const db = await getDb();
  await db.transaction(async () => {
    await db.run('DELETE FROM document_activities');
    await db.run('DELETE FROM document_payments');
    await db.run('DELETE FROM document_items');
    await db.run('DELETE FROM documents');
    await db.run('DELETE FROM document_sequences');
    await db.run('DELETE FROM catalog_items');
    await db.run('DELETE FROM clients');
    await db.run('DELETE FROM business_profile');
  });
  appSession.setLastViewedDocId(null);
  markDemoFlag();
  notifyDbChanged();
}
