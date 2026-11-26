import React, { useState } from 'react';

import type { ItemType } from '../../types/database';
import { toIntRupiah } from '../../utils/formatters';
import { DsButton } from '../ui/DsButton';
import { DsCurrencyInput, DsInput, DsSelect } from '../ui/DsField';
import { DsFormModal } from '../ui/DsFormModal';

export interface ManualItemPayload {
  name: string;
  description: string;
  qty: number;
  unit: string;
  price: number;
  saveToCatalog: boolean;
  itemType: ItemType;
}

export interface EditableLineSeed {
  name: string;
  description?: string | null;
  qty: number;
  unit: string;
  price: number;
  isFromCatalog?: boolean;
}

interface ManualItemModalProps {
  isOpen: boolean;
  editingItem?: EditableLineSeed | null;
  onClose: () => void;
  onSave: (item: ManualItemPayload) => void;
}

const TYPE_OPTIONS = [
  { value: 'SERVICE', label: 'Jasa' },
  { value: 'GOODS', label: 'Barang' },
];

export const ManualItemModal: React.FC<ManualItemModalProps> = ({ isOpen, editingItem, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [qty, setQty] = useState('1');
  const [unit, setUnit] = useState('paket');
  const [price, setPrice] = useState('');
  const [saveToCatalog, setSaveToCatalog] = useState(true);
  const [itemType, setItemType] = useState<ItemType>('SERVICE');

  const initFields = () => {
    if (editingItem) {
      setName(editingItem.name ?? '');
      setDescription(editingItem.description ?? '');
      setQty(String(editingItem.qty ?? 1));
      setUnit(editingItem.unit ?? 'paket');
      setPrice(String(editingItem.price ?? 0));
      setSaveToCatalog(false);
      setItemType('SERVICE');
    } else {
      setName('');
      setDescription('');
      setQty('1');
      setUnit('paket');
      setPrice('');
      setSaveToCatalog(true);
      setItemType('SERVICE');
    }
  };

  const handleSubmit = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      description: description.trim(),
      qty: Math.max(0.01, Number(qty) || 1),
      unit: unit.trim() || 'paket',
      price: toIntRupiah(price),
      saveToCatalog: editingItem ? false : saveToCatalog,
      itemType,
    });
    onClose();
  };

  return (
    <DsFormModal
      isOpen={isOpen}
      title={editingItem ? 'Edit Item Transaksi' : 'Tambah Item Manual'}
      closeLabel="Batal"
      onWillPresent={initFields}
      onClose={onClose}
      footer={
        <DsButton size="lg" variant="primary" fullWidth disabled={!name.trim()} onClick={handleSubmit}>
          {editingItem ? 'Simpan Perubahan Item' : 'Tambahkan ke Dokumen'}
        </DsButton>
      }
    >
      <div className="qoc-card space-y-3">
        <DsInput
          label="Nama Item / Jasa *"
          placeholder="Misal: Revisi Tambahan / Lembur"
          enterKeyHint="next"
          value={name}
          onValueChange={setName}
        />
        <div className="grid grid-cols-2 gap-2.5">
          <DsInput
            label="Qty"
            type="number"
            inputMode="decimal"
            enterKeyHint="next"
            placeholder="1"
            value={qty}
            onValueChange={setQty}
          />
          <DsInput label="Satuan" enterKeyHint="next" placeholder="paket / pcs" value={unit} onValueChange={setUnit} />
        </div>
        <DsCurrencyInput
          label="Harga Satuan *"
          placeholder="350.000"
          enterKeyHint="next"
          hint={
            editingItem?.isFromCatalog
              ? 'Perubahan harga di sini hanya berlaku untuk dokumen ini (harga katalog tidak berubah).'
              : undefined
          }
          value={price}
          onValueChange={setPrice}
        />
        <DsInput
          label="Keterangan Singkat (Opsional)"
          placeholder="Detail ukuran atau spesifikasi"
          enterKeyHint="done"
          value={description}
          onValueChange={setDescription}
        />

        {!editingItem && (
          <>
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--app-border)] bg-[var(--ds-bg-muted)] p-3 text-xs text-[var(--ds-text-secondary)]">
              <input
                type="checkbox"
                checked={saveToCatalog}
                onChange={(e) => setSaveToCatalog(e.target.checked)}
                className="h-4 w-4 rounded accent-[var(--ds-brand-primary)]"
              />
              <span>
                Simpan juga ke <strong>List Barang &amp; Jasa</strong>
              </span>
            </label>
            {saveToCatalog && (
              <DsSelect
                label="Tipe di Katalog"
                value={itemType}
                options={TYPE_OPTIONS}
                onValueChange={(v) => setItemType(v as ItemType)}
              />
            )}
          </>
        )}
      </div>
    </DsFormModal>
  );
};
