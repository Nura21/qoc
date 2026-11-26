import { IonContent, IonHeader, IonPage, IonToast, IonToolbar } from '@ionic/react';
import { addOutline, cubeOutline } from 'ionicons/icons';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { DsConfirmAlert } from '../components/common/DsConfirmAlert';
import { EmptyState } from '../components/common/EmptyState';
import { DsButton } from '../components/ui/DsButton';
import { DsCurrencyInput, DsInput, DsSelect, DsTextarea } from '../components/ui/DsField';
import { DsFormModal } from '../components/ui/DsFormModal';
import { DsSearchBar } from '../components/ui/DsSearchBar';
import { useAsyncQuery } from '../hooks/useAsyncQuery';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useToastMessage } from '../hooks/useToastMessage';
import { catalogService } from '../modules/catalog/catalogService';
import { appSession } from '../store/appSession';
import type { CatalogItem, ItemType } from '../types/database';
import { formatRupiah, toIntRupiah } from '../utils/formatters';

const TYPE_FILTERS: { value: ItemType | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Semua' },
  { value: 'GOODS', label: 'Barang' },
  { value: 'SERVICE', label: 'Jasa' },
];

const ITEM_TYPE_OPTIONS = [
  { value: 'GOODS', label: 'Barang' },
  { value: 'SERVICE', label: 'Jasa' },
];

const CatalogPage: React.FC = () => {
  const navigate = useNavigate();
  const { toastMessage, showToast, showError, clearToast } = useToastMessage();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 100);
  const [typeFilter, setTypeFilter] = useState<ItemType | 'ALL'>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<CatalogItem | null>(null);

  const { data: items } = useAsyncQuery<CatalogItem[]>(
    () => catalogService.list({ query: debouncedQuery, itemType: typeFilter }),
    [],
    `${typeFilter}|${debouncedQuery}`,
  );

  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  const [itemType, setItemType] = useState<ItemType>('GOODS');
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [defaultPrice, setDefaultPrice] = useState('');
  const [stockQty, setStockQty] = useState('');

  const openCreateModal = () => {
    setEditingItem(null);
    setItemType('GOODS');
    setSku('');
    setName('');
    setCategory('');
    setDescription('');
    setUnit('pcs');
    setDefaultPrice('');
    setStockQty('');
    setIsModalOpen(true);
  };

  const openEditModal = (it: CatalogItem) => {
    setEditingItem(it);
    setItemType(it.item_type);
    setSku(it.sku ?? '');
    setName(it.name);
    setCategory(it.category ?? '');
    setDescription(it.description ?? '');
    setUnit(it.unit);
    setDefaultPrice(String(it.default_price));
    setStockQty(it.track_stock && it.stock_qty !== null ? String(it.stock_qty) : '');
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const hasStock = stockQty.trim() !== '';
      await catalogService.upsert({
        id: editingItem?.id,
        item_type: itemType,
        sku,
        name,
        category: category || 'Umum',
        description,
        unit,
        default_price: toIntRupiah(defaultPrice),
        track_stock: hasStock,
        stock_qty: hasStock ? Number(stockQty) || 0 : null,
      });
      setIsModalOpen(false);
      showToast('Item tersimpan di List Barang & Jasa.');
    } catch (err) {
      showError(err, 'Gagal menyimpan item.');
    }
  };

  const handleUseInForm = (it: CatalogItem, e: React.MouseEvent) => {
    e.stopPropagation();
    appSession.setPendingFormSeed({ catalogItem: it, docType: 'QUOTATION' });
    navigate('/documents/new?type=QUOTATION');
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    await catalogService.remove(pendingDelete.id);
    showToast(`"${pendingDelete.name}" dihapus dari katalog.`);
    setPendingDelete(null);
  };

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <div className="flex items-center justify-between gap-3 px-[var(--ds-page-px)] py-2">
            <h1 className="ds-page-title truncate text-[var(--ds-text-primary)]">
              List Barang &amp; Jasa ({items.length})
            </h1>
            <DsButton size="sm" variant="primary" icon={addOutline} onClick={openCreateModal}>
              Tambah
            </DsButton>
          </div>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <div className="ds-container ds-stack">
          <DsSearchBar value={query} placeholder="Cari barang, jasa, atau SKU..." onValueChange={setQuery} />

          <div className="flex items-center gap-2">
            {TYPE_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                data-active={String(typeFilter === f.value)}
                onClick={() => setTypeFilter(f.value)}
                className="ds-chip"
              >
                {f.label}
              </button>
            ))}
          </div>

          {items.length === 0 ? (
            <EmptyState
              icon={cubeOutline}
              title="List Barang & Jasa kosong"
              description="Simpan daftar barang (dengan SKU & stok opsional) atau jasa agar mudah dipilih saat buat dokumen."
              actionLabel="+ Tambah Item"
              onAction={openCreateModal}
            />
          ) : (
            <div className="space-y-3">
              {items.map((it) => (
                <div
                  key={it.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openEditModal(it)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') openEditModal(it);
                  }}
                  className="qoc-card flex cursor-pointer items-center justify-between gap-3 transition active:scale-[0.99]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold ${
                          it.item_type === 'GOODS'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                        }`}
                      >
                        {it.item_type === 'GOODS' ? 'BARANG' : 'JASA'}
                      </span>
                      {it.sku && <span className="font-mono text-[10.5px] text-[var(--ds-text-muted)]">{it.sku}</span>}
                      {it.category && (
                        <span className="truncate text-[10.5px] text-[var(--ds-text-muted)]">· {it.category}</span>
                      )}
                    </div>

                    <div className="ds-card-title mt-1 break-words text-[var(--ds-text-primary)]">{it.name}</div>

                    <div className="mt-0.5 text-[12px] text-[var(--ds-text-muted)]">
                      <span className="font-bold tabular-nums text-[var(--ds-brand-primary)]">
                        {formatRupiah(it.default_price)}
                      </span>{' '}
                      / {it.unit}
                      {Boolean(it.track_stock) && (
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          {' '}
                          · Stok: {it.stock_qty ?? 0}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col gap-1.5">
                    <DsButton size="sm" variant="primary" onClick={(e) => handleUseInForm(it, e)}>
                      + Pakai
                    </DsButton>
                    <DsButton
                      size="sm"
                      variant="ghost"
                      className="!h-7 !text-[11px] !text-[var(--ds-text-muted)]"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPendingDelete(it);
                      }}
                    >
                      Hapus
                    </DsButton>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Full-Screen Keyboard-Safe Modal */}
        <DsFormModal
          isOpen={isModalOpen}
          title={editingItem ? 'Edit Barang / Jasa' : 'Tambah Barang / Jasa'}
          onClose={() => setIsModalOpen(false)}
          footer={
            <DsButton size="lg" variant="primary" fullWidth onClick={() => void handleSave()}>
              Simpan ke List Barang
            </DsButton>
          }
        >
          <div className="qoc-card space-y-3">
            <DsInput
              label="Nama Barang / Jasa *"
              placeholder="Misal: Jasa Pembuatan Logo"
              value={name}
              onValueChange={setName}
            />

            <div className="grid grid-cols-2 gap-2.5">
              <DsSelect
                label="Tipe"
                value={itemType}
                options={ITEM_TYPE_OPTIONS}
                onValueChange={(v) => setItemType(v as ItemType)}
              />
              <DsInput label="Satuan *" placeholder="pcs / paket" value={unit} onValueChange={setUnit} />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <DsCurrencyInput
                label="Harga *"
                placeholder="250.000"
                enterKeyHint="next"
                value={defaultPrice}
                onValueChange={setDefaultPrice}
              />
              <DsInput
                label="Stok (Opsional)"
                type="number"
                inputMode="decimal"
                enterKeyHint="next"
                placeholder="Opsional"
                value={stockQty}
                onValueChange={setStockQty}
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <DsInput label="SKU / Kode" placeholder="BRG-001" value={sku} onValueChange={setSku} />
              <DsInput label="Kategori" placeholder="Jasa / Umum" value={category} onValueChange={setCategory} />
            </div>

            <DsTextarea
              label="Keterangan (Opsional)"
              rows={2}
              placeholder="Detail spesifikasi barang atau jasa"
              value={description}
              onValueChange={setDescription}
            />
          </div>
        </DsFormModal>

        <DsConfirmAlert
          isOpen={Boolean(pendingDelete)}
          header="Hapus Item Katalog?"
          message={`"${pendingDelete?.name ?? ''}" akan dihapus dari daftar. Dokumen lama yang memakai item ini tetap aman.`}
          confirmLabel="Hapus"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void confirmDelete()}
        />

        <IonToast
          isOpen={Boolean(toastMessage)}
          message={toastMessage ?? ''}
          duration={2500}
          onDidDismiss={clearToast}
        />
      </IonContent>
    </IonPage>
  );
};

export default CatalogPage;
