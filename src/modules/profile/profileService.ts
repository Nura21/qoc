import { getDb, notifyDbChanged } from '../../db/client';
import type { BusinessProfile, SenderSnapshot } from '../../types/database';
import { nowIsoUtc } from '../../utils/formatters';

const SINGLETON_ID = 'default';

export interface SaveProfileInput {
  name: string;
  phone_wa?: string | null;
  address?: string | null;
  logo_path?: string | null;
  signature_path?: string | null;
  bank_name?: string | null;
  bank_account_no?: string | null;
  bank_account_name?: string | null;
  default_scope_terms?: string | null;
  prefix_quotation?: string;
  prefix_invoice?: string;
  prefix_bast?: string;
}

export const profileService = {
  async get(): Promise<BusinessProfile | null> {
    const db = await getDb();
    const rows = await db.query<BusinessProfile>('SELECT * FROM business_profile WHERE id = ? LIMIT 1', [SINGLETON_ID]);
    if (rows.length > 0) return rows[0];
    const anyRows = await db.query<BusinessProfile>('SELECT * FROM business_profile LIMIT 1');
    return anyRows[0] ?? null;
  },

  async getOrSave(payload?: SaveProfileInput): Promise<BusinessProfile | null> {
    if (!payload) {
      return this.get();
    }
    const db = await getDb();
    const existing = await this.get();
    const now = nowIsoUtc();
    const id = existing?.id ?? SINGLETON_ID;
    const cleanName = payload.name.trim();
    if (!cleanName) {
      throw new Error('Nama usaha / pengirim wajib diisi.');
    }

    const prefixQuo = (payload.prefix_quotation ?? existing?.prefix_quotation ?? 'QUO').trim().toUpperCase();
    const prefixInv = (payload.prefix_invoice ?? existing?.prefix_invoice ?? 'INV').trim().toUpperCase();
    const prefixBast = (payload.prefix_bast ?? existing?.prefix_bast ?? 'BAST').trim().toUpperCase();

    if (existing) {
      await db.run(
        `UPDATE business_profile SET
          name = ?,
          phone_wa = ?,
          address = ?,
          logo_path = ?,
          signature_path = ?,
          bank_name = ?,
          bank_account_no = ?,
          bank_account_name = ?,
          default_scope_terms = ?,
          prefix_quotation = ?,
          prefix_invoice = ?,
          prefix_bast = ?,
          updated_at = ?
        WHERE id = ?`,
        [
          cleanName,
          payload.phone_wa?.trim() || null,
          payload.address?.trim() || null,
          payload.logo_path ?? existing.logo_path ?? null,
          payload.signature_path ?? existing.signature_path ?? null,
          payload.bank_name?.trim() || null,
          payload.bank_account_no?.trim() || null,
          payload.bank_account_name?.trim() || null,
          payload.default_scope_terms?.trim() || null,
          prefixQuo || 'QUO',
          prefixInv || 'INV',
          prefixBast || 'BAST',
          now,
          id,
        ],
      );
    } else {
      await db.run(
        `INSERT INTO business_profile (
          id, name, phone_wa, address, logo_path, signature_path,
          bank_name, bank_account_no, bank_account_name, default_scope_terms,
          prefix_quotation, prefix_invoice, prefix_bast, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          cleanName,
          payload.phone_wa?.trim() || null,
          payload.address?.trim() || null,
          payload.logo_path ?? null,
          payload.signature_path ?? null,
          payload.bank_name?.trim() || null,
          payload.bank_account_no?.trim() || null,
          payload.bank_account_name?.trim() || null,
          payload.default_scope_terms?.trim() || null,
          prefixQuo || 'QUO',
          prefixInv || 'INV',
          prefixBast || 'BAST',
          now,
          now,
        ],
      );
    }

    notifyDbChanged();
    return this.get();
  },

  toSnapshot(profile: BusinessProfile | null): SenderSnapshot {
    if (!profile) {
      return {
        name: 'Usaha Saya',
        phone_wa: null,
        address: null,
        logo_path: null,
        signature_path: null,
        bank_name: null,
        bank_account_no: null,
        bank_account_name: null,
      };
    }
    return {
      name: profile.name,
      phone_wa: profile.phone_wa,
      address: profile.address,
      logo_path: profile.logo_path,
      signature_path: profile.signature_path,
      bank_name: profile.bank_name,
      bank_account_no: profile.bank_account_no,
      bank_account_name: profile.bank_account_name,
    };
  },
};
