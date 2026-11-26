import React, { useRef, useState } from 'react';

import { paymentService } from '../../modules/payments/paymentService';
import type { PaymentMethod } from '../../types/database';
import { formatRupiah, todayLocalDate, toIntRupiah } from '../../utils/formatters';
import { hapticError, hapticLight, hapticSuccess } from '../../utils/haptics';
import { fileToResizedDataUrl } from '../../utils/imageHelper';
import { DsButton } from '../ui/DsButton';
import { DsCurrencyInput, DsInput, DsSelect, DsTextarea } from '../ui/DsField';
import { DsFormModal } from '../ui/DsFormModal';

interface PaymentRecordModalProps {
  isOpen: boolean;
  docId: string;
  remainingAmount: number;
  onClose: () => void;
  onSuccess: () => void;
  onError: (err: unknown) => void;
}

const METHOD_OPTIONS = [
  { value: 'TRANSFER', label: 'Transfer Bank' },
  { value: 'QRIS', label: 'QRIS' },
  { value: 'CASH', label: 'Tunai' },
  { value: 'GIRO', label: 'Giro Mundur' },
];

export const PaymentRecordModal: React.FC<PaymentRecordModalProps> = ({
  isOpen,
  docId,
  remainingAmount,
  onClose,
  onSuccess,
  onError,
}) => {
  const [amount, setAmount] = useState(String(remainingAmount));
  const [payDate, setPayDate] = useState(todayLocalDate());
  const [method, setMethod] = useState<PaymentMethod>('TRANSFER');
  const [giroDueDate, setGiroDueDate] = useState(todayLocalDate(14));
  const [notes, setNotes] = useState('');
  const [proofPath, setProofPath] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const resetForm = () => {
    setAmount(String(remainingAmount));
    setPayDate(todayLocalDate());
    setMethod('TRANSFER');
    setNotes('');
    setProofPath(null);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const resized = await fileToResizedDataUrl(file, 600);
      setProofPath(resized);
    } catch (err) {
      onError(err);
    } finally {
      e.target.value = '';
    }
  };

  const parsedAmount = toIntRupiah(amount);
  const amountError =
    parsedAmount > remainingAmount
      ? `Melebihi sisa tagihan (${formatRupiah(remainingAmount)}). Periksa jumlah angka nol.`
      : undefined;

  const handleSubmit = async () => {
    if (parsedAmount <= 0 || amountError) {
      void hapticError();
      onError(new Error(amountError || 'Nominal pembayaran harus lebih dari Rp0.'));
      return;
    }
    try {
      await paymentService.record(docId, {
        amount: parsedAmount,
        payment_date: payDate,
        method,
        giro_due_date: method === 'GIRO' ? giroDueDate : null,
        proof_path: proofPath,
        notes,
      });
      void hapticSuccess();
      onSuccess();
    } catch (err) {
      void hapticError();
      onError(err);
    }
  };

  return (
    <DsFormModal
      isOpen={isOpen}
      title="Catat Pembayaran"
      onWillPresent={resetForm}
      onClose={onClose}
      footer={
        <DsButton size="lg" variant="primary" fullWidth onClick={() => void handleSubmit()}>
          Simpan Pembayaran
        </DsButton>
      }
    >
      <div className="qoc-card bg-[var(--ds-bg-muted)]">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[var(--ds-text-muted)]">Sisa Tagihan</span>
          <span className="text-base font-extrabold tabular-nums text-[var(--ds-text-primary)]">
            {formatRupiah(remainingAmount)}
          </span>
        </div>
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <DsButton
            size="sm"
            variant="primary"
            fullWidth
            onClick={() => {
              void hapticLight();
              setAmount(String(remainingAmount));
            }}
          >
            Lunas 100%
          </DsButton>
          <DsButton
            size="sm"
            variant="outline"
            fullWidth
            onClick={() => {
              void hapticLight();
              setAmount(String(toIntRupiah(remainingAmount / 2)));
            }}
          >
            DP / Cicil 50%
          </DsButton>
        </div>
      </div>

      <div className="qoc-card space-y-3">
        <DsCurrencyInput
          label="Nominal Diterima *"
          placeholder="0"
          enterKeyHint="next"
          error={amountError}
          value={amount}
          onValueChange={setAmount}
        />

        <div className="grid grid-cols-2 gap-2.5">
          <DsSelect
            label="Metode"
            value={method}
            options={METHOD_OPTIONS}
            onValueChange={(v) => setMethod(v as PaymentMethod)}
          />
          <DsInput label="Tanggal" type="date" value={payDate} onValueChange={setPayDate} />
        </div>

        {method === 'GIRO' && (
          <DsInput label="Tanggal Cair Giro" type="date" value={giroDueDate} onValueChange={setGiroDueDate} />
        )}

        <DsTextarea
          label="Catatan (Opsional)"
          rows={2}
          placeholder="Contoh: DP awal via BCA"
          value={notes}
          onValueChange={setNotes}
        />

        <div className="rounded-xl border border-dashed border-[var(--ds-border-strong)] p-3 text-center">
          {proofPath && (
            <img src={proofPath} alt="Bukti bayar" className="mx-auto mb-2 max-h-24 rounded-lg object-contain" />
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void handleFileChange(e)}
          />
          <DsButton size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
            {proofPath ? 'Ganti Bukti Transfer' : 'Lampirkan Foto Bukti (Opsional)'}
          </DsButton>
        </div>
      </div>
    </DsFormModal>
  );
};
