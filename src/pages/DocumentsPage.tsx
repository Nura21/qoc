import { IonActionSheet, IonContent, IonHeader, IonIcon, IonPage, IonToast, IonToolbar } from '@ionic/react';
import {
  addOutline,
  arrowForwardOutline,
  calendarOutline,
  copyOutline,
  documentTextOutline,
  folderOpenOutline,
  receiptOutline,
  shieldCheckmarkOutline,
} from 'ionicons/icons';
import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { DocTypeBadge, StatusBadge } from '../components/StatusBadge';
import { EmptyState } from '../components/common/EmptyState';
import { DsButton } from '../components/ui/DsButton';
import { DsSearchBar } from '../components/ui/DsSearchBar';
import { useAsyncQuery } from '../hooks/useAsyncQuery';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useToastMessage } from '../hooks/useToastMessage';
import { documentService, formatDisplayDocNumber } from '../modules/documents/documentService';
import { appSession } from '../store/appSession';
import type { DocumentRecord, DocType } from '../types/database';
import { formatDateId, formatRupiah } from '../utils/formatters';

const TYPE_TABS: { value: DocType | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Semua' },
  { value: 'QUOTATION', label: 'Quotation' },
  { value: 'INVOICE', label: 'Invoice' },
  { value: 'BAST', label: 'BAST' },
];

const DOC_VISUALS: Record<DocType, { icon: string; tile: string; accent: string }> = {
  QUOTATION: {
    icon: documentTextOutline,
    tile: 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300',
    accent: 'border-l-[3.5px] border-l-blue-500/80 dark:border-l-blue-400/80',
  },
  INVOICE: {
    icon: receiptOutline,
    tile: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
    accent: 'border-l-[3.5px] border-l-amber-500/80 dark:border-l-amber-400/80',
  },
  BAST: {
    icon: shieldCheckmarkOutline,
    tile: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300',
    accent: 'border-l-[3.5px] border-l-indigo-500/80 dark:border-l-indigo-400/80',
  },
};

const DocumentsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const docType: DocType | 'ALL' = (searchParams.get('type') as DocType | null) || 'ALL';
  const { toastMessage, showToast, showError, clearToast } = useToastMessage();

  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 100);
  const [sheetOpen, setSheetOpen] = useState(false);

  const handleSelectType = (next: DocType | 'ALL') => {
    setSearchParams(next === 'ALL' ? {} : { type: next }, { replace: true });
  };

  const { data: docs } = useAsyncQuery<DocumentRecord[]>(
    () => documentService.list({ docType, query: debouncedQuery }),
    [],
    `${docType}|${debouncedQuery}`,
  );

  const handleOpenDoc = (id: string) => {
    appSession.setLastViewedDocId(id);
    navigate(`/documents/${id}`);
  };

  const handleDuplicate = async (id: string) => {
    try {
      const dup = await documentService.duplicateDocument(id);
      showToast('Dokumen diduplikat ke form baru.');
      navigate(`/documents/${dup.id}/edit`);
    } catch (err) {
      showError(err, 'Gagal menduplikasi dokumen.');
    }
  };

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <div className="flex items-center justify-between gap-3 px-[var(--ds-page-px)] py-2">
            <h1 className="ds-page-title truncate text-[var(--ds-text-primary)]">Daftar Dokumen ({docs.length})</h1>
            <DsButton size="sm" variant="primary" icon={addOutline} onClick={() => setSheetOpen(true)}>
              Baru
            </DsButton>
          </div>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <div className="ds-container ds-stack">
          {/* 4-Segment Filter */}
          <div className="ds-segmented grid-cols-4">
            {TYPE_TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                data-active={String(docType === t.value)}
                onClick={() => handleSelectType(t.value)}
                className="ds-segment-btn"
              >
                {t.label}
              </button>
            ))}
          </div>

          <DsSearchBar value={query} placeholder="Cari nomor, klien, proyek..." onValueChange={setQuery} />

          {/* Clean Hairline Separator between Filter Controls & Document Feed */}
          <div className="ds-divider" aria-hidden="true" />

          {docs.length === 0 ? (
            <EmptyState
              icon={folderOpenOutline}
              title="Belum ada dokumen"
              description="Buat Quotation, Invoice, atau BAST baru untuk mulai menagih klien via WA."
              actionLabel="+ Buat Dokumen"
              onAction={() => setSheetOpen(true)}
            />
          ) : (
            <div className="space-y-3">
              {docs.map((d) => {
                const remaining = Math.max(0, d.total_amount - d.paid_amount);
                const visual = DOC_VISUALS[d.doc_type];
                const isSettled = d.status === 'PAID' || d.status === 'SIGNED';
                const accentClass = d.is_overdue
                  ? 'border-l-[3.5px] border-l-red-500 dark:border-l-red-400'
                  : isSettled
                    ? 'border-l-[3.5px] border-l-emerald-500 dark:border-l-emerald-400'
                    : visual.accent;
                const tileClass = d.is_overdue
                  ? 'bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400'
                  : isSettled
                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
                    : visual.tile;

                return (
                  <div key={d.id} className={`qoc-card ${accentClass}`}>
                    <div className="flex items-start gap-3">
                      <div
                        aria-hidden="true"
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tileClass}`}
                      >
                        <IonIcon icon={visual.icon} className="text-[19px]" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <DocTypeBadge docType={d.doc_type} />
                          <span className="font-mono text-[10.5px] text-[var(--ds-text-muted)]">
                            {formatDisplayDocNumber(d)}
                          </span>
                          <StatusBadge status={d.status} isOverdue={d.is_overdue} />
                        </div>

                        <div className="ds-card-title mt-1 truncate text-[var(--ds-text-primary)]">
                          {d.title || `${d.doc_type} — ${d.client_name}`}
                        </div>
                        <div className="mt-0.5 truncate text-[11.5px] text-[var(--ds-text-muted)]">
                          {d.client_name}
                          {d.client_company ? ` · ${d.client_company}` : ''}
                        </div>
                      </div>
                    </div>

                    {/* Dashed Receipt-Style Divider separating Info from Value & Actions */}
                    <div className="ds-divider-dashed mt-3 flex items-center justify-between gap-2 pt-3">
                      <div className="min-w-0">
                        <div className="text-[14px] font-extrabold tabular-nums text-[var(--ds-text-primary)]">
                          {formatRupiah(d.total_amount)}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1 truncate text-[10.5px] text-[var(--ds-text-muted)]">
                          <IonIcon icon={calendarOutline} className="shrink-0 text-[11px]" />
                          <span className="truncate">
                            {d.status === 'PARTIAL'
                              ? `DP ${formatRupiah(d.paid_amount)} · Sisa ${formatRupiah(remaining)}`
                              : d.paid_amount > 0
                                ? `Masuk ${formatRupiah(d.paid_amount)}`
                                : `Terbit ${formatDateId(d.issue_date)}`}
                          </span>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          title="Duplikat"
                          aria-label="Duplikat dokumen"
                          onClick={() => void handleDuplicate(d.id)}
                          className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] border border-[var(--app-border)] bg-[var(--ds-bg-muted)] text-[var(--ds-text-secondary)] transition active:scale-95"
                        >
                          <IonIcon icon={copyOutline} className="text-[15px]" />
                        </button>
                        <DsButton size="sm" variant="primary" onClick={() => handleOpenDoc(d.id)}>
                          <span>Buka PDF</span>
                          <IonIcon icon={arrowForwardOutline} className="text-[13px]" />
                        </DsButton>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <IonActionSheet
          isOpen={sheetOpen}
          onDidDismiss={() => setSheetOpen(false)}
          header="Buat Dokumen Baru"
          buttons={[
            {
              text: 'Quotation (Penawaran Harga)',
              icon: documentTextOutline,
              handler: () => navigate('/documents/new?type=QUOTATION'),
            },
            {
              text: 'Invoice Cepat (Tagihan)',
              icon: receiptOutline,
              handler: () => navigate('/documents/new?type=INVOICE'),
            },
            {
              text: 'BAST (Serah Terima)',
              handler: () => navigate('/documents/new?type=BAST'),
            },
            {
              text: 'Batal',
              role: 'cancel',
            },
          ]}
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

export default DocumentsPage;
