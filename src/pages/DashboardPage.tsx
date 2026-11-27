import { IonContent, IonHeader, IonIcon, IonPage, IonToast, IonToolbar } from '@ionic/react';
import {
  alertCircleOutline,
  calendarOutline,
  checkmarkCircleOutline,
  chevronForwardOutline,
  documentTextOutline,
  logoWhatsapp,
  receiptOutline,
  shieldCheckmarkOutline,
  sparklesOutline,
  timeOutline,
  trendingUpOutline,
} from 'ionicons/icons';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { StatusBadge } from '../components/StatusBadge';
import { WaPreviewModal } from '../components/documents/WaPreviewModal';
import { DsButton } from '../components/ui/DsButton';
import { DsInput } from '../components/ui/DsField';
import { DsFormModal } from '../components/ui/DsFormModal';
import { DsSectionHeader } from '../components/ui/DsSectionHeader';
import { useAsyncQuery } from '../hooks/useAsyncQuery';
import { useToastMessage } from '../hooks/useToastMessage';
import { type DashboardSummary, documentService, formatDisplayDocNumber } from '../modules/documents/documentService';
import { profileService } from '../modules/profile/profileService';
import { shareService } from '../modules/share/shareService';
import { appSession } from '../store/appSession';
import type { DocumentDetail } from '../types/database';
import { formatDateId, formatRupiah } from '../utils/formatters';
import { getInitials } from '../utils/textHelpers';

const INITIAL_SUMMARY: DashboardSummary = {
  unpaidInvoiceCount: 0,
  unpaidTotalAmount: 0,
  overdueCount: 0,
  overdueTotalAmount: 0,
  waitingQuotationCount: 0,
  paidThisMonthAmount: 0,
  totalPaidAmount: 0,
  activeCatalogCount: 0,
  urgentInvoices: [],
  recentDocuments: [],
};

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { toastMessage, showToast, showError, clearToast } = useToastMessage();

  const { data: dashboardData, loading } = useAsyncQuery(
    async () => {
      const [profile, summary] = await Promise.all([profileService.get(), documentService.getDashboardSummary()]);
      return { profile, summary };
    },
    { profile: null, summary: INITIAL_SUMMARY },
  );

  const { profile, summary } = dashboardData;
  const businessName = profile?.name || 'QOC Bisnis';
  const initials = getInitials(businessName, 'QO');

  const [setupOpen, setSetupOpen] = useState(false);
  const [setupName, setSetupName] = useState('');
  const [setupPhone, setSetupPhone] = useState('');
  const [setupBankName, setSetupBankName] = useState('');
  const [setupBankNo, setSetupBankNo] = useState('');
  const [setupBankOwner, setSetupBankOwner] = useState('');

  const [waPreviewDoc, setWaPreviewDoc] = useState<DocumentDetail | null>(null);
  const [waPreviewOpen, setWaPreviewOpen] = useState(false);

  const handleQuickProfileSave = async () => {
    try {
      await profileService.getOrSave({
        name: setupName,
        phone_wa: setupPhone,
        bank_name: setupBankName,
        bank_account_no: setupBankNo,
        bank_account_name: setupBankOwner,
      });
      setSetupOpen(false);
      showToast('Profil usaha siap digunakan!');
    } catch (err) {
      showError(err, 'Gagal menyimpan profil.');
    }
  };

  const openDocument = (docId: string) => {
    appSession.setLastViewedDocId(docId);
    navigate(`/documents/${docId}`);
  };

  const handleOpenRemindPreview = async (docId: string) => {
    try {
      const detail = await documentService.getDetail(docId);
      if (detail) {
        setWaPreviewDoc(detail);
        setWaPreviewOpen(true);
      }
    } catch (err) {
      showError(err, 'Gagal memuat detail tagihan.');
    }
  };

  const handleConfirmRemindWa = async () => {
    if (!waPreviewDoc) return;
    try {
      await shareService.openReminderWA(waPreviewDoc.id);
      setWaPreviewOpen(false);
      showToast('Log WA tercatat & WhatsApp dibuka!');
    } catch (err) {
      showError(err, 'Gagal membuka WhatsApp.');
    }
  };

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <div className="flex items-center justify-between gap-3 px-[var(--ds-page-px)] py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-medium text-[var(--ds-text-muted)]">
                Halo, {profile?.bank_account_name || 'Pengguna QOC'}
              </p>
              <h1 className="ds-page-title mt-0.5 truncate text-[var(--ds-text-primary)]">{businessName}</h1>
            </div>
            <button
              type="button"
              aria-label="Profil Bisnis"
              onClick={() => navigate('/profile')}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--ds-brand-soft-border)] bg-[var(--ds-brand-soft)] text-xs font-extrabold text-[var(--ds-brand-primary)] transition active:scale-95"
            >
              {initials}
            </button>
          </div>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <div className="ds-container ds-stack">
          {/* Hero KPI Card */}
          <div data-tour-id="tour-hero" className="qoc-hero-card">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-medium text-blue-100">Tagihan Belum Dibayar</span>
              <span className="shrink-0 rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-semibold text-white">
                Mode Offline
              </span>
            </div>
            <div className="ds-hero-num mt-1.5 truncate text-white">{formatRupiah(summary.unpaidTotalAmount)}</div>
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/15 pt-3 text-[11.5px]">
              <div className="min-w-0">
                <span className="block text-[11px] text-blue-200">Sudah Masuk</span>
                <span className="mt-0.5 block truncate font-bold tabular-nums text-emerald-300">
                  {formatRupiah(summary.totalPaidAmount)}
                </span>
              </div>
              <div className="min-w-0">
                <span className="block text-[11px] text-blue-200">List Barang &amp; Jasa</span>
                <span className="mt-0.5 block truncate font-bold text-white">
                  {summary.activeCatalogCount} Item Aktif
                </span>
              </div>
            </div>
          </div>

          {/* 1x Quick Onboarding Banner */}
          {!loading && !profile && (
            <div className="qoc-card flex items-center justify-between gap-3 border-[var(--ds-brand-soft-border)] bg-[var(--ds-brand-soft)]/70">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[12.5px] font-bold text-[var(--ds-brand-soft-text)]">
                  <IonIcon icon={sparklesOutline} className="shrink-0 text-sm" />
                  <span className="truncate">Setup Profil Bisnis (1x)</span>
                </div>
                <p className="mt-0.5 text-[11.5px] leading-snug text-[var(--ds-text-muted)]">
                  Isi nama usaha &amp; rekening agar otomatis tampil di PDF.
                </p>
              </div>
              <DsButton size="sm" variant="primary" onClick={() => setSetupOpen(true)}>
                Atur
              </DsButton>
            </div>
          )}

          {/* Compact 3-Metric Pulse Strip with Semantic Color & Symbols */}
          {(summary.overdueCount > 0 || summary.waitingQuotationCount > 0 || summary.paidThisMonthAmount > 0) && (
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => navigate('/documents?type=INVOICE')}
                className={`rounded-2xl border p-2.5 text-left transition active:scale-[0.98] ${
                  summary.overdueCount > 0
                    ? 'border-red-200/90 bg-red-50/75 dark:border-red-900/50 dark:bg-red-950/30'
                    : 'border-[var(--app-border)] bg-[var(--app-card)]'
                }`}
              >
                <div className="flex items-center gap-1 text-[10px] font-semibold text-[var(--ds-text-muted)]">
                  <IonIcon
                    icon={alertCircleOutline}
                    className={`shrink-0 text-[12px] ${
                      summary.overdueCount > 0 ? 'text-red-500 dark:text-red-400' : 'text-[var(--ds-text-muted)]'
                    }`}
                  />
                  <span className="truncate">Jatuh Tempo</span>
                </div>
                <div
                  className={`mt-1 text-sm font-extrabold tabular-nums ${
                    summary.overdueCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-[var(--ds-text-primary)]'
                  }`}
                >
                  {summary.overdueCount} Inv
                </div>
              </button>

              <button
                type="button"
                onClick={() => navigate('/documents?type=QUOTATION')}
                className="rounded-2xl border border-blue-100 bg-blue-50/55 p-2.5 text-left transition active:scale-[0.98] dark:border-blue-900/40 dark:bg-blue-950/25"
              >
                <div className="flex items-center gap-1 text-[10px] font-semibold text-[var(--ds-text-muted)]">
                  <IonIcon icon={timeOutline} className="shrink-0 text-[12px] text-[var(--ds-brand-primary)]" />
                  <span className="truncate">Menunggu Deal</span>
                </div>
                <div className="mt-1 text-sm font-extrabold tabular-nums text-[var(--ds-brand-primary)]">
                  {summary.waitingQuotationCount} Quo
                </div>
              </button>

              <button
                type="button"
                onClick={() => navigate('/documents?type=INVOICE')}
                className="rounded-2xl border border-emerald-100 bg-emerald-50/55 p-2.5 text-left transition active:scale-[0.98] dark:border-emerald-900/40 dark:bg-emerald-950/25"
              >
                <div className="flex items-center gap-1 text-[10px] font-semibold text-[var(--ds-text-muted)]">
                  <IonIcon
                    icon={trendingUpOutline}
                    className="shrink-0 text-[12px] text-emerald-600 dark:text-emerald-400"
                  />
                  <span className="truncate">Bulan Ini</span>
                </div>
                <div className="mt-1 truncate text-xs font-extrabold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {formatRupiah(summary.paidThisMonthAmount)}
                </div>
              </button>
            </div>
          )}

          {/* Quick Action Buttons */}
          <div data-tour-id="tour-quick-actions" className="grid grid-cols-2 gap-[var(--ds-gap-grid)]">
            <DsButton
              size="lg"
              variant="outline"
              icon={documentTextOutline}
              fullWidth
              className="!border-[var(--ds-brand-soft-border)] !text-[var(--ds-brand-primary)]"
              onClick={() => navigate('/documents/new?type=QUOTATION')}
            >
              + Quotation
            </DsButton>

            <DsButton
              size="lg"
              variant="primary"
              icon={receiptOutline}
              fullWidth
              onClick={() => navigate('/documents/new?type=INVOICE')}
            >
              + Invoice Cepat
            </DsButton>
          </div>

          {/* Action Needed Section (Separated cleanly from Action Zone) */}
          <div>
            <DsSectionHeader
              divider
              icon={alertCircleOutline}
              tone={summary.overdueCount > 0 ? 'danger' : 'warn'}
              title={`Perlu Ditindaklanjuti (${summary.urgentInvoices.length})`}
              actionLabel="Semua"
              onAction={() => navigate('/documents')}
            />

            {summary.urgentInvoices.length > 0 ? (
              <div className="space-y-3">
                {summary.urgentInvoices.map((d) => {
                  const sisa = Math.max(0, d.total_amount - d.paid_amount);
                  const pct =
                    d.total_amount > 0 ? Math.min(100, Math.round((d.paid_amount / d.total_amount) * 100)) : 0;
                  return (
                    <div
                      key={d.id}
                      className={`qoc-card space-y-3 ${
                        d.is_overdue
                          ? 'border-l-[3.5px] border-l-red-500 dark:border-l-red-400'
                          : 'border-l-[3.5px] border-l-amber-400 dark:border-l-amber-500'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-[11px] font-semibold text-[var(--ds-text-muted)]">
                              {formatDisplayDocNumber(d)}
                            </span>
                            <StatusBadge status={d.status} isOverdue={d.is_overdue} />
                          </div>
                          <div className="ds-card-title mt-1 truncate text-[var(--ds-text-primary)]">
                            {d.title || d.client_name}
                          </div>
                          <div className="mt-0.5 flex items-center gap-1 truncate text-[11.5px] text-[var(--ds-text-muted)]">
                            <IonIcon icon={calendarOutline} className="shrink-0 text-[12px]" />
                            <span className="truncate">
                              {d.client_company || d.client_name} · Tempo {formatDateId(d.due_date)}
                            </span>
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <div className="text-[13.5px] font-extrabold tabular-nums text-[var(--ds-text-primary)]">
                            {formatRupiah(sisa)}
                          </div>
                          <div className="text-[10.5px] text-[var(--ds-text-muted)]">Sisa tagihan</div>
                        </div>
                      </div>

                      {pct > 0 && (
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[11px] text-[var(--ds-text-muted)]">
                            <span>Terbayar {pct}%</span>
                            <span className="tabular-nums">
                              {formatRupiah(d.paid_amount)} / {formatRupiah(d.total_amount)}
                            </span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                            <div
                              className="h-full rounded-full bg-amber-500 transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )}

                      <div className="ds-divider-dashed flex items-center gap-2 pt-3">
                        <DsButton
                          size="md"
                          variant="whatsapp"
                          icon={logoWhatsapp}
                          className="flex-1"
                          onClick={() => void handleOpenRemindPreview(d.id)}
                        >
                          Ingatkan WA
                        </DsButton>
                        <DsButton size="md" variant="secondary" onClick={() => openDocument(d.id)}>
                          Detail
                        </DsButton>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="qoc-card py-6 text-center">
                <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                  <IonIcon icon={checkmarkCircleOutline} className="text-xl" />
                </div>
                <p className="text-[13.5px] font-bold text-[var(--ds-text-primary)]">
                  {summary.recentDocuments.length === 0
                    ? 'Belum ada tagihan atau penawaran'
                    : 'Semua invoice sudah lunas!'}
                </p>
                <p className="mx-auto mt-1 max-w-[260px] text-[12px] leading-relaxed text-[var(--ds-text-muted)]">
                  Gunakan tombol + Quotation atau + Invoice Cepat di atas untuk mulai.
                </p>
              </div>
            )}
          </div>

          {/* Recent Documents Quick List (Grouped Hairline List — Airy & Zero Card Clutter) */}
          {summary.recentDocuments.length > 0 && (
            <div>
              <DsSectionHeader
                divider
                icon={timeOutline}
                tone="brand"
                title="Aktivitas Terbaru"
                actionLabel="Lihat Daftar"
                onAction={() => navigate('/documents')}
              />
              <div className="qoc-list-group divide-y divide-[var(--app-border)]">
                {summary.recentDocuments.slice(0, 3).map((d) => {
                  const icon =
                    d.doc_type === 'QUOTATION'
                      ? documentTextOutline
                      : d.doc_type === 'BAST'
                        ? shieldCheckmarkOutline
                        : receiptOutline;
                  const iconTile =
                    d.doc_type === 'QUOTATION'
                      ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300'
                      : d.doc_type === 'BAST'
                        ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300'
                        : d.status === 'PAID'
                          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300';
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => openDocument(d.id)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-[var(--ds-bg-muted)]"
                    >
                      <span
                        aria-hidden="true"
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconTile}`}
                      >
                        <IonIcon icon={icon} className="text-[17px]" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[10.5px] font-semibold text-[var(--ds-text-muted)]">
                            {formatDisplayDocNumber(d)}
                          </span>
                          <StatusBadge status={d.status} isOverdue={d.is_overdue} />
                        </div>
                        <p className="mt-0.5 truncate text-[13px] font-bold text-[var(--ds-text-primary)]">
                          {d.title || d.client_name}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <span className="text-[12.5px] font-extrabold tabular-nums text-[var(--ds-text-primary)]">
                          {formatRupiah(d.total_amount)}
                        </span>
                        <IonIcon icon={chevronForwardOutline} className="text-sm text-[var(--ds-text-muted)]" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Full-Screen Keyboard-Safe Onboarding Modal */}
        <DsFormModal
          isOpen={setupOpen}
          title="Setup Profil Bisnis"
          closeLabel="Nanti"
          onClose={() => setSetupOpen(false)}
          footer={
            <DsButton size="lg" variant="primary" fullWidth onClick={() => void handleQuickProfileSave()}>
              Simpan Profil
            </DsButton>
          }
        >
          <div className="qoc-card space-y-3">
            <DsInput
              label="Nama Usaha / Brand *"
              placeholder="Contoh: Studio Karya Mandiri"
              value={setupName}
              onValueChange={setSetupName}
            />
            <DsInput
              label="Nomor WhatsApp"
              type="tel"
              placeholder="62812xxxxxxxx"
              value={setupPhone}
              onValueChange={setSetupPhone}
            />
            <div className="grid grid-cols-2 gap-2.5">
              <DsInput
                label="Nama Bank"
                placeholder="Misal: BCA"
                value={setupBankName}
                onValueChange={setSetupBankName}
              />
              <DsInput
                label="No. Rekening"
                placeholder="5410-8829"
                value={setupBankNo}
                onValueChange={setSetupBankNo}
              />
            </div>
            <DsInput
              label="Atas Nama Rekening / Pemilik"
              placeholder="Nama Anda"
              value={setupBankOwner}
              onValueChange={setSetupBankOwner}
            />
          </div>
        </DsFormModal>

        <WaPreviewModal
          isOpen={waPreviewOpen}
          mode="remind"
          message={waPreviewDoc ? shareService.buildReminderMessage(waPreviewDoc) : ''}
          phoneLabel={waPreviewDoc?.parsed_client?.phone_wa || waPreviewDoc?.client_phone_wa || ''}
          onClose={() => setWaPreviewOpen(false)}
          onConfirm={() => void handleConfirmRemindWa()}
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

export default DashboardPage;
