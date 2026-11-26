import React, { useState } from 'react';

import type { CatalogItem } from '../../types/database';
import { formatRupiah } from '../../utils/formatters';
import { DsFormModal } from '../ui/DsFormModal';
import { DsSearchBar } from '../ui/DsSearchBar';

interface CatalogPickerModalProps {
  isOpen: boolean;
  items: CatalogItem[];
  onClose: () => void;
  onSelect: (item: CatalogItem) => void;
}

export const CatalogPickerModal: React.FC<CatalogPickerModalProps> = ({ isOpen, items, onClose, onSelect }) => {
  const [search, setSearch] = useState('');

  const filtered = items.filter((it) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      it.name.toLowerCase().includes(q) ||
      (it.sku ?? '').toLowerCase().includes(q) ||
      (it.category ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <DsFormModal
      isOpen={isOpen}
      title="Pilih dari List Barang & Jasa"
      onWillPresent={() => setSearch('')}
      onClose={onClose}
    >
      <DsSearchBar value={search} placeholder="Cari barang, jasa, atau SKU..." onValueChange={setSearch} />

      {filtered.length === 0 ? (
        <div className="qoc-card py-10 text-center text-xs text-[var(--ds-text-muted)]">
          Item tidak ditemukan di katalog. Tutup modal ini lalu tekan <strong>+ Manual</strong> untuk mengetik item
          baru.
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelect(cat)}
              className="qoc-card flex w-full items-center justify-between gap-2.5 text-left transition active:scale-[0.99]"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[9.5px] font-extrabold uppercase ${
                      cat.item_type === 'GOODS'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                    }`}
                  >
                    {cat.item_type === 'GOODS' ? 'BARANG' : 'JASA'}
                  </span>
                  {cat.sku && (
                    <span className="truncate font-mono text-[10.5px] text-[var(--ds-text-muted)]">{cat.sku}</span>
                  )}
                </div>
                <p className="ds-card-title mt-1 truncate text-[var(--ds-text-primary)]">{cat.name}</p>
                <p className="text-[11.5px] text-[var(--ds-text-muted)]">
                  <span className="font-bold text-[var(--ds-brand-primary)]">{formatRupiah(cat.default_price)}</span> /{' '}
                  {cat.unit}
                </p>
              </div>
              <span className="shrink-0 rounded-lg bg-[var(--ds-brand-soft)] px-2.5 py-1 text-xs font-bold text-[var(--ds-brand-primary)]">
                + Pilih
              </span>
            </button>
          ))}
        </div>
      )}
    </DsFormModal>
  );
};
