import { getDb, notifyDbChanged } from '../../db/client';
import type { CatalogItem, ItemType } from '../../types/database';
import { generateId, nowIsoUtc, toIntRupiah } from '../../utils/formatters';

export interface ListCatalogFilter {
  query?: string;
  itemType?: ItemType | 'ALL';
  activeOnly?: boolean;
}

export interface UpsertCatalogInput {
  id?: string;
  item_type?: ItemType;
  sku?: string | null;
  name: string;
  category?: string | null;
  description?: string | null;
  unit?: string;
  default_price: number;
  cost_price?: number | null;
  track_stock?: boolean | 0 | 1;
  stock_qty?: number | null;
  is_active?: boolean | 0 | 1;
}

export const catalogService = {
  async list(filter?: ListCatalogFilter): Promise<CatalogItem[]> {
    const db = await getDb();
    const clauses: string[] = ['deleted_at IS NULL'];
    const params: (string | number)[] = [];

    if (filter?.activeOnly) {
      clauses.push('is_active = 1');
    }
    if (filter?.itemType && filter.itemType !== 'ALL') {
      clauses.push('item_type = ?');
      params.push(filter.itemType);
    }
    if (filter?.query?.trim()) {
      const like = `%${filter.query.trim()}%`;
      clauses.push('(name LIKE ? OR sku LIKE ? OR category LIKE ?)');
      params.push(like, like, like);
    }

    const sql = `SELECT * FROM catalog_items WHERE ${clauses.join(' AND ')} ORDER BY name COLLATE NOCASE ASC`;
    return db.query<CatalogItem>(sql, params);
  },

  async getById(id: string): Promise<CatalogItem | null> {
    const db = await getDb();
    const rows = await db.query<CatalogItem>('SELECT * FROM catalog_items WHERE id = ? LIMIT 1', [id]);
    return rows[0] ?? null;
  },

  async upsert(input: UpsertCatalogInput): Promise<CatalogItem> {
    const db = await getDb();
    const cleanName = input.name.trim();
    if (!cleanName) {
      throw new Error('Nama barang/jasa wajib diisi.');
    }

    const now = nowIsoUtc();
    const id = input.id || generateId();
    const existing = input.id ? await this.getById(input.id) : null;

    const itemType: ItemType = input.item_type ?? existing?.item_type ?? 'GOODS';
    const cleanSku = input.sku?.trim() ? input.sku.trim().toUpperCase() : null;
    const cleanUnit = input.unit?.trim() || 'pcs';
    const defaultPrice = toIntRupiah(input.default_price);
    const costPrice =
      input.cost_price === null || input.cost_price === undefined || input.cost_price === 0
        ? input.cost_price === 0
          ? 0
          : null
        : toIntRupiah(input.cost_price);
    const trackStock = input.track_stock ? 1 : 0;
    const stockQty = trackStock ? Number(input.stock_qty ?? 0) : null;
    const isActive = input.is_active === undefined ? 1 : input.is_active ? 1 : 0;

    if (existing) {
      await db.run(
        `UPDATE catalog_items SET
          item_type = ?,
          sku = ?,
          name = ?,
          category = ?,
          description = ?,
          unit = ?,
          default_price = ?,
          cost_price = ?,
          track_stock = ?,
          stock_qty = ?,
          is_active = ?,
          deleted_at = NULL,
          updated_at = ?
        WHERE id = ?`,
        [
          itemType,
          cleanSku,
          cleanName,
          input.category?.trim() || null,
          input.description?.trim() || null,
          cleanUnit,
          defaultPrice,
          costPrice,
          trackStock,
          stockQty,
          isActive,
          now,
          id,
        ],
      );
    } else {
      await db.run(
        `INSERT INTO catalog_items (
          id, item_type, sku, name, category, description, unit,
          default_price, cost_price, track_stock, stock_qty, is_active,
          deleted_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
        [
          id,
          itemType,
          cleanSku,
          cleanName,
          input.category?.trim() || null,
          input.description?.trim() || null,
          cleanUnit,
          defaultPrice,
          costPrice,
          trackStock,
          stockQty,
          isActive,
          now,
          now,
        ],
      );
    }

    notifyDbChanged();
    const saved = await this.getById(id);
    if (!saved) throw new Error('Gagal menyimpan item katalog.');
    return saved;
  },

  async remove(id: string): Promise<void> {
    const db = await getDb();
    const now = nowIsoUtc();
    await db.run('UPDATE catalog_items SET deleted_at = ?, updated_at = ? WHERE id = ?', [now, now, id]);
    notifyDbChanged();
  },
};
