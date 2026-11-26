import { beforeEach, describe, expect, it, vi } from 'vitest';

import { catalogService } from '../modules/catalog/catalogService';
import { clientService } from '../modules/clients/clientService';
import { documentService } from '../modules/documents/documentService';
import { profileService } from '../modules/profile/profileService';

import { backupService } from './backup';
import { getDb, notifyDbChanged, resetDbForTesting, subscribeDbChanges } from './client';
import { clearAllData, seedDemoData } from './seedDemoData';

describe('SQLite Storage Layer & Persistence Tests', () => {
  beforeEach(async () => {
    await resetDbForTesting();
  });

  it('initializes all 8 core SQLite tables cleanly via v1 migration', async () => {
    const db = await getDb();
    const tables = await db.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
    );
    const names = tables.map((t) => t.name);

    expect(names).toEqual(
      expect.arrayContaining([
        'business_profile',
        'clients',
        'catalog_items',
        'document_sequences',
        'documents',
        'document_items',
        'document_payments',
        'document_activities',
      ]),
    );
  });

  it('rolls back entire transaction atomically when an error occurs mid-transaction', async () => {
    const db = await getDb();
    await expect(
      db.transaction(async () => {
        await db.run(
          `INSERT INTO clients (id, name, created_at, updated_at) VALUES ('tx-rollback-1', 'Harus Gagal', '2026-11-26', '2026-11-26')`,
        );
        throw new Error('Simulated crash mid-transaction');
      }),
    ).rejects.toThrow('Simulated crash mid-transaction');

    const rows = await db.query<{ id: string }>("SELECT id FROM clients WHERE id = 'tx-rollback-1'");
    expect(rows).toHaveLength(0);
  });

  it('emits reactive pub-sub DB change notifications and respects unsubscribe', async () => {
    const listener = vi.fn();
    const unsub = subscribeDbChanges(listener);

    notifyDbChanged();
    await clientService.upsert({ name: 'Klien PubSub' });
    expect(listener).toHaveBeenCalledTimes(2);

    unsub();
    notifyDbChanged();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('persists, updates, and preserves media fields in business_profile', async () => {
    expect(await profileService.get()).toBeNull();
    expect(profileService.toSnapshot(null).name).toBe('Usaha Saya');

    await expect(profileService.getOrSave({ name: '   ' })).rejects.toThrow();

    const saved = await profileService.getOrSave({
      name: 'Studio Desain Prima',
      phone_wa: '081234567890',
      address: 'Bandung, Jawa Barat',
      logo_path: 'data:image/png;base64,LOGO123',
      signature_path: 'data:image/png;base64,SIG123',
      bank_name: 'BCA',
      bank_account_no: '1234567890',
      bank_account_name: 'Prima',
      prefix_quotation: 'qtn',
      prefix_invoice: 'inv',
      prefix_bast: 'bst',
    });

    expect(saved?.name).toBe('Studio Desain Prima');
    expect(saved?.prefix_quotation).toBe('QTN');
    expect(saved?.prefix_bast).toBe('BST');

    // Updating text fields without passing logo/signature preserves existing images
    const updated = await profileService.getOrSave({
      name: 'Studio Desain Prima v2',
      bank_name: 'Mandiri',
    });
    expect(updated?.name).toBe('Studio Desain Prima v2');
    expect(updated?.logo_path).toBe('data:image/png;base64,LOGO123');
    expect(updated?.signature_path).toBe('data:image/png;base64,SIG123');
  });

  it('performs Client CRUD, search by name/company/WA, and soft-delete without breaking FK rows', async () => {
    await expect(clientService.upsert({ name: '' })).rejects.toThrow();

    const c1 = await clientService.upsert({
      name: 'Budi Santoso',
      company_name: 'CV Karya Mandiri',
      phone_wa: '081211112222',
    });
    const c2 = await clientService.upsert({
      name: 'Siti Rahma',
      company_name: 'Toko Sinar',
      phone_wa: '085677778888',
    });

    expect(await clientService.list()).toHaveLength(2);
    expect(await clientService.list('Karya')).toHaveLength(1);
    expect(await clientService.list('085677')).toHaveLength(1);

    // Update existing client
    const c1Updated = await clientService.upsert({ id: c1.id, name: 'Budi Santoso SE', company_name: 'PT Karya' });
    expect(c1Updated.name).toBe('Budi Santoso SE');

    // Soft delete hides from list() while keeping row in SQLite for historical references
    await clientService.remove(c2.id);
    expect(await clientService.list()).toHaveLength(1);
    const rawRow = await clientService.getById(c2.id);
    expect(rawRow?.deleted_at).not.toBeNull();
  });

  it('performs Catalog CRUD, SKU uppercasing, stock tracking, filters, and soft-delete', async () => {
    await expect(catalogService.upsert({ name: ' ', default_price: 1000 })).rejects.toThrow();

    const goods = await catalogService.upsert({
      item_type: 'GOODS',
      sku: 'brg-01',
      name: 'Semen Tiga Roda',
      category: 'Material',
      unit: 'sak',
      default_price: 68_000,
      track_stock: true,
      stock_qty: 40,
    });
    const service = await catalogService.upsert({
      item_type: 'SERVICE',
      name: 'Jasa Tukang Harian',
      category: 'Tenaga',
      unit: 'hari',
      default_price: 200_000,
    });
    await catalogService.upsert({
      item_type: 'GOODS',
      name: 'Item Arsip',
      default_price: 10_000,
      is_active: false,
    });

    expect(goods.sku).toBe('BRG-01');
    expect(goods.track_stock).toBe(1);
    expect(goods.stock_qty).toBe(40);
    expect(service.track_stock).toBe(0);
    expect(service.stock_qty).toBeNull();

    expect(await catalogService.list()).toHaveLength(3);
    expect(await catalogService.list({ activeOnly: true })).toHaveLength(2);
    expect(await catalogService.list({ itemType: 'SERVICE' })).toHaveLength(1);
    expect(await catalogService.list({ query: 'BRG-01' })).toHaveLength(1);
    expect(await catalogService.list({ query: 'Tenaga' })).toHaveLength(1);

    await catalogService.remove(goods.id);
    expect(await catalogService.list()).toHaveLength(2);
  });

  it('builds and restores full JSON backups while rejecting corrupt payloads', async () => {
    await profileService.getOrSave({ name: 'Toko Backup Jaya' });
    const c = await clientService.upsert({ name: 'Pelanggan Backup' });
    await catalogService.upsert({ name: 'Produk Backup', default_price: 150_000 });
    const d = await documentService.saveDraft({ client_id: c.id, doc_type: 'QUOTATION', title: 'Doc Backup' }, [
      { item_name: 'Produk Backup', qty: 2, unit: 'pcs', unit_price: 150_000 },
    ]);
    await documentService.publish(d.id);

    const payload = await backupService.buildPayload();
    expect(payload.version).toBe(1);
    expect(payload.tables.business_profile).toHaveLength(1);
    expect(payload.tables.clients).toHaveLength(1);
    expect(payload.tables.catalog_items).toHaveLength(1);
    expect(payload.tables.documents).toHaveLength(1);

    await resetDbForTesting();
    expect(await documentService.list()).toHaveLength(0);

    await expect(backupService.importJson('NOT_JSON')).rejects.toThrow();
    await expect(backupService.importJson('{}')).rejects.toThrow();

    const restored = await backupService.importJson(JSON.stringify(payload));
    expect(restored.restoredCounts).toEqual({
      clients: 1,
      catalog_items: 1,
      documents: 1,
      payments: 0,
    });
    expect((await profileService.get())?.name).toBe('Toko Backup Jaya');
    expect(await documentService.list()).toHaveLength(1);
  });

  it('seeds complete realistic demo dataset and wipes cleanly via clearAllData', async () => {
    const seeded = await seedDemoData();
    expect(seeded).toEqual({ clients: 4, catalog: 6, documents: 6 });

    expect((await profileService.get())?.name).toBe('Studio Karya Nusantara');
    expect(await clientService.list()).toHaveLength(4);
    expect(await catalogService.list()).toHaveLength(6);

    const summary = await documentService.getDashboardSummary();
    expect(summary.overdueCount).toBe(1);
    expect(summary.waitingQuotationCount).toBe(1);
    expect(summary.unpaidInvoiceCount).toBe(2);
    expect(summary.totalPaidAmount).toBeGreaterThan(0);

    await clearAllData();
    expect(await profileService.get()).toBeNull();
    expect(await clientService.list()).toHaveLength(0);
    expect(await catalogService.list()).toHaveLength(0);
    expect(await documentService.list()).toHaveLength(0);
  });
});
