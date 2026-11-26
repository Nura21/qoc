import React from 'react';

import type { DocumentStatus, DocType } from '../types/database';

interface StatusBadgeProps {
  status: DocumentStatus;
  isOverdue?: boolean;
}

const PILL_BASE = 'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold whitespace-nowrap';

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, isOverdue }) => {
  if (isOverdue && (status === 'SENT' || status === 'PARTIAL')) {
    return (
      <span className={`${PILL_BASE} bg-red-100 text-red-700 dark:bg-red-950/70 dark:text-red-300`}>Jatuh Tempo</span>
    );
  }

  switch (status) {
    case 'DRAFT':
      return (
        <span className={`${PILL_BASE} bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300`}>Draft</span>
      );
    case 'SENT':
      return (
        <span className={`${PILL_BASE} bg-blue-100 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300`}>
          Terkirim
        </span>
      );
    case 'ACCEPTED':
      return (
        <span className={`${PILL_BASE} bg-indigo-100 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300`}>
          Deal
        </span>
      );
    case 'PARTIAL':
      return (
        <span className={`${PILL_BASE} bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300`}>
          DP Masuk
        </span>
      );
    case 'PAID':
      return (
        <span className={`${PILL_BASE} bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300`}>
          Lunas
        </span>
      );
    case 'SIGNED':
      return (
        <span className={`${PILL_BASE} bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300`}>
          Diterima
        </span>
      );
    case 'REJECTED':
      return (
        <span className={`${PILL_BASE} bg-red-100 text-red-700 dark:bg-red-950/70 dark:text-red-300`}>Ditolak</span>
      );
    case 'EXPIRED':
      return (
        <span className={`${PILL_BASE} bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400`}>
          Expired
        </span>
      );
    case 'VOID':
      return (
        <span className={`${PILL_BASE} bg-slate-200 text-slate-600 line-through dark:bg-slate-800 dark:text-slate-400`}>
          Batal
        </span>
      );
    default:
      return <span className={PILL_BASE}>{status}</span>;
  }
};

export const DocTypeBadge: React.FC<{ docType: DocType }> = ({ docType }) => (
  <span className="inline-flex items-center rounded bg-blue-600/10 px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
    {docType}
  </span>
);
