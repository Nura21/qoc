import { IonIcon } from '@ionic/react';
import { createOutline, trashOutline } from 'ionicons/icons';
import React from 'react';

import { formatRupiah, toIntRupiah } from '../../utils/formatters';

export interface LineCardItem {
  key: string;
  item_name: string;
  description?: string | null;
  qty: number;
  unit: string;
  unit_price: number;
}

interface DocumentLineCardProps {
  item: LineCardItem;
  onEdit: (key: string) => void;
  onRemove: (key: string) => void;
  onAdjustQty: (key: string, delta: number) => void;
}

/**
 * Memoized transaction line-item card with inline edit, delete, and qty stepper.
 * Keeps DocumentForm KISS and prevents sibling items from re-rendering unnecessarily.
 */
export const DocumentLineCard: React.FC<DocumentLineCardProps> = React.memo(
  ({ item, onEdit, onRemove, onAdjustQty }) => (
    <div className="space-y-2 rounded-xl border border-[var(--app-border)] bg-[var(--ds-bg-muted)] p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="break-words text-xs font-bold leading-snug text-[var(--ds-text-primary)]">
            {item.item_name}
          </div>
          {item.description && (
            <div className="mt-0.5 break-words text-[11px] text-[var(--ds-text-muted)]">{item.description}</div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label="Edit harga atau nama item"
            onClick={() => onEdit(item.key)}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--app-card)] text-[var(--ds-brand-primary)] active:scale-95"
          >
            <IonIcon icon={createOutline} className="text-sm" />
          </button>
          <button
            type="button"
            aria-label="Hapus item"
            onClick={() => onRemove(item.key)}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--app-card)] text-slate-400 active:text-red-600"
          >
            <IonIcon icon={trashOutline} className="text-sm" />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1 rounded-lg border border-[var(--app-border)] bg-[var(--app-card)] px-1.5 py-1">
          <button
            type="button"
            onClick={() => onAdjustQty(item.key, -1)}
            className="flex h-6 w-6 items-center justify-center rounded text-xs font-bold text-slate-600 active:bg-slate-100 dark:text-slate-300"
          >
            −
          </button>
          <span className="min-w-[24px] text-center text-xs font-bold tabular-nums text-[var(--ds-text-primary)]">
            {item.qty}
          </span>
          <button
            type="button"
            onClick={() => onAdjustQty(item.key, 1)}
            className="flex h-6 w-6 items-center justify-center rounded text-xs font-bold text-[var(--ds-brand-primary)] active:bg-blue-50"
          >
            +
          </button>
          <span className="pr-1 text-[10px] text-[var(--ds-text-muted)]">{item.unit}</span>
        </div>

        <div className="min-w-0 text-right">
          <div className="truncate text-xs font-extrabold tabular-nums text-[var(--ds-brand-primary)]">
            {formatRupiah(toIntRupiah(item.qty * item.unit_price))}
          </div>
          <div className="truncate text-[10px] tabular-nums text-[var(--ds-text-muted)]">
            @ {formatRupiah(item.unit_price)}
          </div>
        </div>
      </div>
    </div>
  ),
);

DocumentLineCard.displayName = 'DocumentLineCard';
