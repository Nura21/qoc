import { IonContent, IonHeader, IonIcon, IonPage, IonToast, IonToolbar } from '@ionic/react';
import { documentTextOutline, logoWhatsapp, receiptOutline, sparklesOutline } from 'ionicons/icons';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { StatusBadge } from '../components/StatusBadge';
import { WaPreviewModal } from '../components/documents/WaPreviewModal';
import { DsButton } from '../components/ui/DsButton';
import { DsInput } from '../components/ui/DsField';
import { DsFormModal } from '../components/ui/DsFormModal';
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
      if (detail) setWaPreviewDoc(detail);
    } catch (err) {
      showError(err, 'Gagal memuat detail tagihan.');
    }
  };

  const handleConfirmRemindWa = async () => {
    if (!waPreviewDoc) return;
    try {
      await shareService.openReminderWA(waPreviewDoc.id);
      setWaPreviewDoc(null);
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
          <div className="qoc-hero-card">
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

          {/* Compact 3-Metric Pulse Strip (visible once there is activity) */}
          {(summary.overdueCount > 0 || summary.waitingQuotationCount > 0 || summary.paidThisMonthAmount > 0) && (
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => navigate('/documents?type=INVOICE')}
                className={`rounded-2xl border p-2.5 text-left transition active:scale-[0.98] ${
                  summary.overdueCount > 0
                    ? 'border-red-200 bg-red-50/80 dark:border-red-900/50 dark:bg-red-950/30'
                    : 'border-[var(--app-border)] bg-[var(--app-card)]'
                }`}
              >
                <div className="text-[10px] font-semibold text-[var(--ds-text-muted)]">Jatuh Tempo</div>
                <div
                  className={`mt-0.5 text-sm font-extrabold tabular-nums ${
                    summary.overdueCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-[var(--ds-text-primary)]'
                  }`}
                >
                  {summary.overdueCount} Inv
                </div>
              </button>

              <button
                type="button"
                onClick={() => navigate('/documents?type=QUOTATION')}
                className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] p-2.5 text-left transition active:scale-[0.98]"
              >
                <div className="text-[10px] font-semibold text-[var(--ds-text-muted)]">Menunggu Deal</div>
                <div className="mt-0.5 text-sm font-extrabold tabular-nums text-[var(--ds-brand-primary)]">
                  {summary.waitingQuotationCount} Quo
                </div>
              </button>

              <button
                type="button"
                onClick={() => navigate('/documents?type=INVOICE')}
                className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] p-2.5 text-left transition active:scale-[0.98]"
              >
                <div className="text-[10px] font-semibold text-[var(--ds-text-muted)]">Bulan Ini</div>
                <div className="mt-0.5 truncate text-xs font-extrabold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {formatRupiah(summary.paidThisMonthAmount)}
                </div>
              </button>
            </div>
          )}

          {/* Quick Action Buttons */}
          <div className="grid grid-cols-2 gap-[var(--ds-gap-grid)]">
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

          {/* Action Needed Section */}
          <div>
            <div className="mb-2.5 flex items-center justify-between px-0.5">
              <h2 className="ds-section-label">Perlu Ditindaklanjuti ({summary.urgentInvoices.length})</h2>
              <button
                type="button"
                onClick={() => navigate('/documents')}
                className="text-[12px] font-bold text-[var(--ds-brand-primary)]"
              >
                Semua
              </button>
            </div>

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
                        d.is_overdue ? 'border-l-[3.5px] border-l-red-500 dark:border-l-red-400' : ''
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
                          <div className="mt-0.5 truncate text-[11.5px] text-[var(--ds-text-muted)]">
                            {d.client_company || d.client_name} · Tempo {formatDateId(d.due_date)}
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

                      <div className="flex items-center gap-2 pt-0.5">
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
              <div className="qoc-card py-7 text-center">
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

          {/* Recent Documents Quick List */}
          {summary.recentDocuments.length > 0 && (
            <div>
              <div className="mb-2.5 flex items-center justify-between px-0.5">
                <h2 className="ds-section-label">Aktivitas Terbaru</h2>
                <button
                  type="button"
                  onClick={() => navigate('/documents')}
                  className="text-[12px] font-bold text-[var(--ds-brand-primary)]"
                >
                  Lihat Daftar
                </button>
              </div>
              <div className="space-y-2.5">
                {summary.recentDocuments.slice(0, 3).map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => openDocument(d.id)}
                    className="qoc-card flex w-full items-center justify-between gap-2.5 text-left transition active:scale-[0.99]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10.5px] font-semibold text-[var(--ds-brand-primary)]">
                          {formatDisplayDocNumber(d)}
                        </span>
                        <StatusBadge status={d.status} isOverdue={d.is_overdue} />
                      </div>
                      <p className="mt-1 truncate text-[13px] font-bold text-[var(--ds-text-primary)]">
                        {d.title || d.client_name}
                      </p>
                    </div>
                    <span className="shrink-0 text-[13px] font-extrabold tabular-nums text-[var(--ds-text-primary)]">
                      {formatRupiah(d.total_amount)}
                    </span>
                  </button>
                ))}
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
          isOpen={Boolean(waPreviewDoc)}
          mode="remind"
          message={waPreviewDoc ? shareService.buildReminderMessage(waPreviewDoc) : ''}
          phoneLabel={waPreviewDoc?.parsed_client?.phone_wa || waPreviewDoc?.client_phone_wa || ''}
          onClose={() => setWaPreviewDoc(null)}
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
