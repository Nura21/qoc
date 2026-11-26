import React, { useState } from 'react';

import { formatRupiah, todayLocalDate } from '../../utils/formatters';
import { DsButton } from '../ui/DsButton';
import { DsInput } from '../ui/DsField';
import { DsFormModal } from '../ui/DsFormModal';

interface ConvertDpModalProps {
  isOpen: boolean;
  docNumber: string;
  quotationTotal: number;
  onClose: () => void;
  onConfirmFull: () => void;
  onConfirmDp: (dpPercent: number, dueDate: string) => void;
}

export const ConvertDpModal: React.FC<ConvertDpModalProps> = ({
  isOpen,
  docNumber,
  quotationTotal,
  onClose,
  onConfirmFull,
  onConfirmDp,
}) => {
  const [percent, setPercent] = useState('50');
  const [dueDate, setDueDate] = useState(todayLocalDate(7));

  const pctNum = Math.min(99, Math.max(1, Number(percent) || 50));
  const dpAmount = Math.round((quotationTotal * pctNum) / 100);

  return (
    <DsFormModal isOpen={isOpen} title="1-Klik Deal → Ubah ke Invoice" closeLabel="Batal" onClose={onClose}>
      <p className="text-xs leading-relaxed text-[var(--ds-text-secondary)]">
        Pilih skema penagihan dari <strong>{docNumber}</strong> ({formatRupiah(quotationTotal)}):
      </p>

      {/* Option 1: Full 100% */}
      <button
        type="button"
        onClick={onConfirmFull}
        className="w-full rounded-2xl border border-blue-200 bg-blue-50/70 p-4 text-left transition active:scale-[0.99] dark:border-blue-800 dark:bg-blue-950/40"
      >
        <div className="text-[13.5px] font-bold text-blue-700 dark:text-blue-300">
          Tagih Penuh 100% ({formatRupiah(quotationTotal)})
        </div>
        <div className="mt-1 text-[11.5px] text-[var(--ds-text-muted)]">
          1 Invoice untuk seluruh proyek (tetap bisa catat DP bertahap)
        </div>
      </button>

      {/* Option 2: Split DP % */}
      <div className="qoc-card space-y-3">
        <div>
          <div className="text-[13.5px] font-bold text-[var(--ds-text-primary)]">
            Terbitkan Invoice DP {pctNum}% ({formatRupiah(dpAmount)})
          </div>
          <div className="mt-0.5 text-[11.5px] text-[var(--ds-text-muted)]">
            Cocok untuk klien perusahaan yang butuh faktur DP terpisah
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <DsInput
            label="Persen DP (%)"
            type="number"
            inputMode="numeric"
            placeholder="50"
            value={percent}
            onValueChange={setPercent}
          />
          <DsInput label="Jatuh Tempo" type="date" value={dueDate} onValueChange={setDueDate} />
        </div>

        <DsButton size="lg" variant="primary" fullWidth onClick={() => onConfirmDp(pctNum, dueDate)}>
          Terbitkan Invoice DP {pctNum}%
        </DsButton>
      </div>
    </DsFormModal>
  );
};
