import type { CatalogItem, DocType } from '../types/database';

/**
 * Lightweight in-memory navigation handoff state between tabs
 * (e.g. "+ Pakai" from Catalog -> DocumentForm, and active document for "Preview" tab).
 */
interface PendingFormSeed {
  docType?: DocType;
  catalogItem?: CatalogItem;
}

let lastViewedDocId: string | null = null;
let pendingSeed: PendingFormSeed | null = null;

export const appSession = {
  setLastViewedDocId(id: string | null): void {
    lastViewedDocId = id;
  },

  getLastViewedDocId(): string | null {
    return lastViewedDocId;
  },

  setPendingFormSeed(seed: PendingFormSeed): void {
    pendingSeed = seed;
  },

  consumePendingFormSeed(): PendingFormSeed | null {
    const current = pendingSeed;
    pendingSeed = null;
    return current;
  },
};
