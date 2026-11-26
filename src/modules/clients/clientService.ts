import { getDb, notifyDbChanged } from '../../db/client';
import type { Client, ClientSnapshot } from '../../types/database';
import { generateId, nowIsoUtc } from '../../utils/formatters';

export interface UpsertClientInput {
  id?: string;
  name: string;
  company_name?: string | null;
  phone_wa?: string | null;
  email?: string | null;
  address?: string | null;
}

export const clientService = {
  async list(query?: string): Promise<Client[]> {
    const db = await getDb();
    const q = query?.trim();
    if (!q) {
      return db.query<Client>('SELECT * FROM clients WHERE deleted_at IS NULL ORDER BY name COLLATE NOCASE ASC');
    }
    const like = `%${q}%`;
    return db.query<Client>(
      `SELECT * FROM clients
       WHERE deleted_at IS NULL
         AND (name LIKE ? OR company_name LIKE ? OR phone_wa LIKE ?)
       ORDER BY name COLLATE NOCASE ASC`,
      [like, like, like],
    );
  },

  async getById(id: string): Promise<Client | null> {
    const db = await getDb();
    const rows = await db.query<Client>('SELECT * FROM clients WHERE id = ? LIMIT 1', [id]);
    return rows[0] ?? null;
  },

  async upsert(input: UpsertClientInput): Promise<Client> {
    const db = await getDb();
    const cleanName = input.name.trim();
    if (!cleanName) {
      throw new Error('Nama klien wajib diisi.');
    }
    const now = nowIsoUtc();
    const id = input.id || generateId();
    const existing = input.id ? await this.getById(input.id) : null;

    if (existing) {
      await db.run(
        `UPDATE clients SET
          name = ?,
          company_name = ?,
          phone_wa = ?,
          email = ?,
          address = ?,
          deleted_at = NULL,
          updated_at = ?
        WHERE id = ?`,
        [
          cleanName,
          input.company_name?.trim() || null,
          input.phone_wa?.trim() || null,
          input.email?.trim() || null,
          input.address?.trim() || null,
          now,
          id,
        ],
      );
    } else {
      await db.run(
        `INSERT INTO clients (
          id, name, company_name, phone_wa, email, address, deleted_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
        [
          id,
          cleanName,
          input.company_name?.trim() || null,
          input.phone_wa?.trim() || null,
          input.email?.trim() || null,
          input.address?.trim() || null,
          now,
          now,
        ],
      );
    }

    notifyDbChanged();
    const saved = await this.getById(id);
    if (!saved) throw new Error('Gagal menyimpan data klien.');
    return saved;
  },

  async remove(id: string): Promise<void> {
    const db = await getDb();
    const now = nowIsoUtc();
    await db.run('UPDATE clients SET deleted_at = ?, updated_at = ? WHERE id = ?', [now, now, id]);
    notifyDbChanged();
  },

  toSnapshot(client: Client | null): ClientSnapshot {
    if (!client) {
      return {
        id: null,
        name: 'Klien Umum',
        company_name: null,
        phone_wa: null,
        email: null,
        address: null,
      };
    }
    return {
      id: client.id,
      name: client.name,
      company_name: client.company_name,
      phone_wa: client.phone_wa,
      email: client.email,
      address: client.address,
    };
  },
};
