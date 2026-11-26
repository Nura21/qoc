import { IonBackButton, IonButtons, IonContent, IonHeader, IonIcon, IonPage, IonToast, IonToolbar } from '@ionic/react';
import { createOutline, logoWhatsapp, printOutline, sendOutline, trashOutline } from 'ionicons/icons';
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { StatusBadge } from '../components/StatusBadge';
import { DsConfirmAlert } from '../components/common/DsConfirmAlert';
import { ConvertDpModal } from '../components/documents/ConvertDpModal';
import { DocumentPaperPreview } from '../components/documents/DocumentPaperPreview';
import { PaymentRecordModal } from '../components/documents/PaymentRecordModal';
import { WaPreviewModal } from '../components/documents/WaPreviewModal';
import { DsButton } from '../components/ui/DsButton';
import { useAsyncQuery } from '../hooks/useAsyncQuery';
import { useToastMessage } from '../hooks/useToastMessage';
import { documentService, formatDisplayDocNumber } from '../modules/documents/documentService';
import { paymentService } from '../modules/payments/paymentService';
import { shareService } from '../modules/share/shareService';
import { appSession } from '../store/appSession';
import type { DocumentPayment } from '../types/database';
import { formatDateId, formatRupiah } from '../utils/formatters';
import { hapticError, hapticSuccess } from '../utils/haptics';

interface DocumentDetailPageProps {
  docIdOverride?: string;
}

const ACTIVITY_LABELS: Record<string, string> = {
  CREATED: 'Dokumen dibuat',
  SHARED_PDF_WA: 'File PDF dibagikan ke WhatsApp',
  REMINDED_WA: 'Pengingat jatuh tempo dikirim via WA',
  CONVERTED: 'Dikonversi 1-klik ke dokumen lanjutan',
  PAYMENT_RECORDED: 'Pembayaran dicatat',
  STATUS_CHANGED: 'Status dokumen diperbarui',
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  CONFIRMED: 'Terkonfirmasi',
  PENDING_GIRO: 'Giro Menunggu',
  BOUNCED: 'Giro Ditolak',
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  TRANSFER: 'Transfer',
  CASH: 'Tunai',
  QRIS: 'QRIS',
  GIRO: 'Giro',
};

const DocumentDetailPage: React.FC<DocumentDetailPageProps> = ({ docIdOverride }) => {
  const navigate = useNavigate();
  const params = useParams<{ id?: string }>();
  const resolvedId = docIdOverride || params.id || '';
  const { toastMessage, showToast, showError, clearToast } = useToastMessage();

  const { data: detail } = useAsyncQuery(
    () => (resolvedId ? documentService.getDetail(resolvedId) : Promise.resolve(null)),
    null,
    resolvedId,
  );

  useEffect(() => {
    if (detail?.id) {
      appSession.setLastViewedDocId(detail.id);
    }
  }, [detail?.id]);

  const [payModalOpen, setPayModalOpen] = useState(false);
  const [dealModalOpen, setDealModalOpen] = useState(false);
  const [waModalMode, setWaModalMode] = useState<'share' | 'remind' | null>(null);
  const [confirmDeleteDraft, setConfirmDeleteDraft] = useState(false);
  const [confirmVoidInvoice, setConfirmVoidInvoice] = useState(false);
  const [pendingRemovePayment, setPendingRemovePayment] = useState<DocumentPayment | null>(null);

  if (!detail) {
    return (
      <IonPage>
        <IonHeader className="ion-no-border">
          <IonToolbar>
            {!docIdOverride && (
              <IonButtons slot="start">
                <IonBackButton defaultHref="/documents" text="" />
              </IonButtons>
            )}
            <div className="px-3 text-sm font-bold">Preview PDF</div>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <p className="py-12 text-center text-xs text-[var(--ds-text-muted)]">Memuat dokumen...</p>
        </IonContent>
      </IonPage>
    );
  }

  const remaining = Math.max(0, detail.total_amount - detail.paid_amount);
  const client = detail.parsed_client;
  const pdfFilename = `${detail.doc_number}${detail.revision_no > 0 ? `-R${detail.revision_no}` : ''}.pdf`;

  const handleConfirmWaAction = async () => {
    const mode = waModalMode;
    setWaModalMode(null);
    try {
      if (mode === 'remind') {
        await shareService.openReminderWA(detail.id);
        showToast('Log WA tercatat & WhatsApp dibuka!');
      } else {
        const res = await shareService.sharePdfToWA(detail.id);
        showToast(`PDF ${res.filename} siap dikirim ke WA!`);
      }
    } catch (err) {
      showError(err, 'Gagal membuka WhatsApp.');
    }
  };

  const handleDownloadPdf = async () => {
    try {
      const savedPath = await shareService.downloadPdfOnly(detail.id);
      void hapticSuccess();
      showToast(`PDF tersimpan: ${savedPath}`);
    } catch (err) {
      void hapticError();
      showError(err, 'Gagal mencetak PDF.');
    }
  };

  const handleReviseQuotation = async () => {
    try {
      const rev = await documentService.reviseQuotation(detail.id);
      appSession.setLastViewedDocId(rev.id);
      showToast(`Dibuat Revisi Rev.${rev.revision_no}`);
      navigate(`/documents/${rev.id}/edit`);
    } catch (err) {
      showError(err, 'Gagal membuat revisi.');
    }
  };

  const handleConvertFull = async () => {
    try {
      const inv = await documentService.convert(detail.id, 'INVOICE', {
        mode: 'FULL',
        autoPublish: true,
      });
      setDealModalOpen(false);
      appSession.setLastViewedDocId(inv.id);
      showToast(`Terbit ${inv.doc_number}!`);
      navigate(`/documents/${inv.id}`);
    } catch (err) {
      showError(err, 'Gagal konversi ke Invoice.');
    }
  };

  const handleConvertDp = async (dpPercent: number, dueDate: string) => {
    try {
      const inv = await documentService.convert(detail.id, 'INVOICE', {
        mode: 'DP_PERCENT',
        dpPercent,
        dueDate,
        autoPublish: true,
      });
      setDealModalOpen(false);
      appSession.setLastViewedDocId(inv.id);
      showToast(`Terbit Invoice DP ${dpPercent}% (${inv.doc_number})!`);
      navigate(`/documents/${inv.id}`);
    } catch (err) {
      showError(err, 'Gagal menerbitkan Invoice DP.');
    }
  };

  const handleCreateBast = async () => {
    try {
      const bast = await documentService.convert(detail.id, 'BAST', { autoPublish: true });
      appSession.setLastViewedDocId(bast.id);
      showToast(`BAST ${bast.doc_number} siap cetak & kirim WA!`);
      navigate(`/documents/${bast.id}`);
    } catch (err) {
      showError(err, 'Gagal membuat BAST.');
    }
  };

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <div className="flex items-center justify-between gap-2 px-3 py-1.5">
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              {!docIdOverride && (
                <IonButtons>
                  <IonBackButton defaultHref="/documents" text="" />
                </IonButtons>
              )}
              <div className="min-w-0">
                <h2 className="truncate text-sm font-bold leading-tight text-[var(--ds-text-primary)]">
                  {formatDisplayDocNumber(detail)}
                </h2>
                <p className="truncate text-[10px] text-[var(--ds-text-muted)]">
                  Preview PDF · {detail.status === 'DRAFT' ? 'Draft' : 'Dokumen Resmi'}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <StatusBadge status={detail.status} isOverdue={detail.is_overdue} />
              {detail.status === 'DRAFT' && (
                <button
                  type="button"
                  aria-label="Edit Draft"
                  onClick={() => navigate(`/documents/${detail.id}/edit`)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600/10 text-blue-600"
                >
                  <IonIcon icon={createOutline} className="text-sm" />
                </button>
              )}
              <button
                type="button"
                aria-label="Cetak / Unduh PDF"
                onClick={() => void handleDownloadPdf()}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700 active:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
              >
                <IonIcon icon={printOutline} className="text-sm" />
              </button>
            </div>
          </div>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <div className="ds-container ds-stack">
          <DocumentPaperPreview detail={detail} remaining={remaining} />

          {/* Primary Green CTA: Share PDF to WhatsApp */}
          <DsButton size="lg" variant="whatsapp" icon={sendOutline} fullWidth onClick={() => setWaModalMode('share')}>
            Kirim PDF ke WhatsApp (1-Klik)
          </DsButton>

          {/* Contextual Secondary 1-Click Actions */}
          {detail.doc_type === 'QUOTATION' && (
            <div className="grid grid-cols-2 gap-2">
              <DsButton size="md" variant="primary" fullWidth onClick={() => setDealModalOpen(true)}>
                1-Klik Deal → Invoice
              </DsButton>
              <DsButton size="md" variant="outline" fullWidth onClick={() => void handleReviseQuotation()}>
                Buat Revisi (Rev.{detail.revision_no + 1})
              </DsButton>
            </div>
          )}

          {detail.doc_type === 'INVOICE' && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <DsButton
                  size="md"
                  variant="primary"
                  fullWidth
                  disabled={remaining === 0}
                  onClick={() => setPayModalOpen(true)}
                >
                  {remaining === 0 ? 'Sudah Lunas' : 'Catat DP / Lunas'}
                </DsButton>
                <DsButton size="md" variant="outline" fullWidth onClick={() => void handleCreateBast()}>
                  Cetak BAST
                </DsButton>
              </div>

              {remaining > 0 && detail.status !== 'DRAFT' && (
                <DsButton
                  size="md"
                  variant="secondary"
                  icon={logoWhatsapp}
                  fullWidth
                  onClick={() => setWaModalMode('remind')}
                >
                  Kirim Pengingat Jatuh Tempo via WA
                </DsButton>
              )}
            </div>
          )}

          {detail.doc_type === 'BAST' && (
            <div className="grid grid-cols-2 gap-2">
              <DsButton size="md" variant="primary" fullWidth onClick={() => void handleDownloadPdf()}>
                Simpan PDF BAST
              </DsButton>
              {detail.status !== 'SIGNED' ? (
                <DsButton
                  size="md"
                  variant="outline"
                  fullWidth
                  onClick={() => void documentService.updateStatus(detail.id, 'SIGNED')}
                >
                  Tandai Diterima
                </DsButton>
              ) : (
                <DsButton size="md" variant="secondary" fullWidth disabled>
                  Sudah Diterima
                </DsButton>
              )}
            </div>
          )}

          {/* Payment History (if Invoice has payments) */}
          {detail.payments.length > 0 && (
            <section className="qoc-card space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--ds-text-muted)]">
                Riwayat Pembayaran ({detail.payments.length})
              </div>
              {detail.payments.map((p) => (
                <div key={p.id} className="rounded-xl border border-[var(--app-border)] p-2.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-extrabold tabular-nums text-[var(--ds-text-primary)]">
                      {formatRupiah(p.amount)}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {PAYMENT_STATUS_LABELS[p.status] || p.status}
                      </span>
                      <button
                        type="button"
                        aria-label="Hapus catatan pembayaran"
                        onClick={() => setPendingRemovePayment(p)}
                        className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 active:bg-red-50 active:text-red-600"
                      >
                        <IonIcon icon={trashOutline} className="text-xs" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-0.5 text-[10px] text-[var(--ds-text-muted)]">
                    {PAYMENT_METHOD_LABELS[p.method] || p.method} · {formatDateId(p.payment_date)}
                    {p.notes ? ` · ${p.notes}` : ''}
                  </div>
                  {p.status === 'PENDING_GIRO' && (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <DsButton
                        size="sm"
                        variant="primary"
                        fullWidth
                        onClick={() => void paymentService.updateStatus(p.id, 'CONFIRMED')}
                      >
                        Cairkan Giro
                      </DsButton>
                      <DsButton
                        size="sm"
                        variant="danger"
                        fullWidth
                        onClick={() => void paymentService.updateStatus(p.id, 'BOUNCED')}
                      >
                        Giro Tolak
                      </DsButton>
                    </div>
                  )}
                </div>
              ))}
            </section>
          )}

          {/* Activity Timeline */}
          <section className="qoc-card space-y-2">
            <div className="ds-section-label">Riwayat Aktivitas &amp; WA</div>
            <div className="space-y-2">
              {detail.activities.map((a) => (
                <div key={a.id} className="flex items-start gap-2 text-[11px]">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                  <div className="min-w-0">
                    <div className="font-medium leading-snug text-[var(--ds-text-primary)]">
                      {ACTIVITY_LABELS[a.action_type] || a.action_type}
                    </div>
                    <div className="text-[10px] text-[var(--ds-text-muted)]">
                      {new Date(a.created_at).toLocaleString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {detail.status === 'DRAFT' && (
            <DsButton
              size="md"
              variant="danger"
              icon={trashOutline}
              fullWidth
              onClick={() => setConfirmDeleteDraft(true)}
            >
              Hapus Draft Ini
            </DsButton>
          )}

          {detail.doc_type === 'INVOICE' && detail.status === 'SENT' && detail.paid_amount === 0 && (
            <DsButton size="md" variant="danger" fullWidth onClick={() => setConfirmVoidInvoice(true)}>
              Batalkan Invoice
            </DsButton>
          )}
        </div>

        <DsConfirmAlert
          isOpen={confirmDeleteDraft}
          header="Hapus Draft Dokumen?"
          message={`Draft ${formatDisplayDocNumber(detail)} akan dihapus secara permanen dari daftar aktif.`}
          confirmLabel="Hapus Draft"
          onCancel={() => setConfirmDeleteDraft(false)}
          onConfirm={() => {
            void documentService
              .remove(detail.id)
              .then(() => {
                void hapticSuccess();
                appSession.setLastViewedDocId(null);
                navigate('/documents', { replace: true });
              })
              .catch((err) => {
                void hapticError();
                showError(err, 'Gagal menghapus draft.');
              });
          }}
        />

        <DsConfirmAlert
          isOpen={confirmVoidInvoice}
          header="Batalkan Invoice?"
          message={`Invoice ${formatDisplayDocNumber(detail)} akan dibatalkan dan stok barang yang terpotong akan dikembalikan otomatis.`}
          cancelLabel="Kembali"
          confirmLabel="Ya, Batalkan"
          onCancel={() => setConfirmVoidInvoice(false)}
          onConfirm={() => {
            void documentService
              .updateStatus(detail.id, 'VOID')
              .then(() => {
                void hapticSuccess();
                showToast('Invoice dibatalkan & stok barang dikembalikan.');
              })
              .catch((err) => {
                void hapticError();
                showError(err, 'Gagal membatalkan Invoice.');
              });
          }}
        />

        <DsConfirmAlert
          isOpen={Boolean(pendingRemovePayment)}
          header="Hapus Catatan Pembayaran?"
          message={`Pembayaran sebesar ${formatRupiah(pendingRemovePayment?.amount ?? 0)} akan dihapus dan sisa tagihan Invoice dihitung ulang otomatis.`}
          confirmLabel="Hapus"
          onCancel={() => setPendingRemovePayment(null)}
          onConfirm={() => {
            if (!pendingRemovePayment) return;
            void paymentService
              .remove(pendingRemovePayment.id)
              .then(() => {
                void hapticSuccess();
                showToast('Catatan pembayaran dihapus & status tagihan diperbarui.');
              })
              .catch((err) => {
                void hapticError();
                showError(err, 'Gagal menghapus pembayaran.');
              });
          }}
        />

        <PaymentRecordModal
          isOpen={payModalOpen}
          docId={detail.id}
          remainingAmount={remaining}
          onClose={() => setPayModalOpen(false)}
          onSuccess={() => {
            setPayModalOpen(false);
            showToast('Pembayaran berhasil dicatat!');
          }}
          onError={(err) => showError(err, 'Gagal mencatat pembayaran.')}
        />

        <ConvertDpModal
          isOpen={dealModalOpen}
          docNumber={formatDisplayDocNumber(detail)}
          quotationTotal={detail.total_amount}
          onClose={() => setDealModalOpen(false)}
          onConfirmFull={() => void handleConvertFull()}
          onConfirmDp={(pct, dt) => void handleConvertDp(pct, dt)}
        />

        <WaPreviewModal
          isOpen={waModalMode !== null}
          mode={waModalMode ?? 'share'}
          message={
            waModalMode === 'remind'
              ? shareService.buildReminderMessage(detail)
              : shareService.buildShareMessage(detail)
          }
          pdfFilename={pdfFilename}
          phoneLabel={client?.phone_wa || detail.client_phone_wa || ''}
          onClose={() => setWaModalMode(null)}
          onConfirm={() => void handleConfirmWaAction()}
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

export default DocumentDetailPage;
