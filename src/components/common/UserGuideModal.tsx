import { IonIcon } from '@ionic/react';
import {
  arrowForwardOutline,
  checkmarkCircleOutline,
  cubeOutline,
  documentTextOutline,
  personOutline,
  shieldCheckmarkOutline,
} from 'ionicons/icons';
import React from 'react';

import { DsButton } from '../ui/DsButton';
import { DsFormModal } from '../ui/DsFormModal';

interface UserGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const MAIN_FLOWS = [
  {
    step: 1,
    icon: personOutline,
    title: 'Isi Profil & Klien',
    desc: 'Atur nama usaha & rekening (1×), lalu tambah klien di Daftar Klien atau langsung + Klien Baru di form.',
  },
  {
    step: 2,
    icon: cubeOutline,
    title: 'Buat & Kirim ke WA',
    desc: 'Ketuk + Quotation / + Invoice, pilih dari Barang atau + Manual, lalu kirim PDF langsung ke WhatsApp.',
  },
  {
    step: 3,
    icon: documentTextOutline,
    title: '1-Klik Deal, Bayar & BAST',
    desc: 'Ubah Quotation jadi Invoice (Penuh/DP) 1 klik, catat DP/lunas, lalu cetak BAST saat serah terima.',
  },
  {
    step: 4,
    icon: shieldCheckmarkOutline,
    title: 'Cadangkan Data',
    desc: 'Ketuk Simpan Cadangan di Profil sebelum ganti HP agar seluruh dokumen & klien bisa dipulihkan.',
  },
];

const QUICK_TIPS = [
  'Harga berubah? Pakai Buat Revisi di Quotation agar dokumen lama tetap aman.',
  'Salah catat / batal? Hapus baris pembayaran atau tekan Batalkan Invoice (stok otomatis kembali).',
];

/**
 * Ultra-simple, 5-second scannable guide focusing only on QOC's core workflow.
 */
export const UserGuideModal: React.FC<UserGuideModalProps> = ({ isOpen, onClose }) => (
  <DsFormModal
    isOpen={isOpen}
    title="Panduan Singkat QOC"
    closeLabel="Tutup"
    onClose={onClose}
    footer={
      <DsButton size="lg" variant="primary" fullWidth onClick={onClose}>
        Siap Dipakai
      </DsButton>
    }
  >
    {/* 1-Line Visual Flow Pill */}
    <div className="qoc-card bg-[var(--ds-brand-soft)] !py-3">
      <div className="flex flex-wrap items-center justify-center gap-1.5 text-[11px] font-bold text-[var(--ds-brand-soft-text)]">
        <span>Profil</span>
        <IonIcon icon={arrowForwardOutline} className="text-[11px]" />
        <span>Quotation</span>
        <IonIcon icon={arrowForwardOutline} className="text-[11px]" />
        <span>Invoice</span>
        <IonIcon icon={arrowForwardOutline} className="text-[11px]" />
        <span>Lunas &amp; BAST</span>
      </div>
    </div>

    {/* 4 Short Core Steps */}
    <section className="qoc-card space-y-3">
      {MAIN_FLOWS.map((item) => (
        <div key={item.step} className="flex items-start gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--ds-brand-soft)] text-xs font-extrabold text-[var(--ds-brand-primary)]">
            {item.step}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[12.5px] font-bold text-[var(--ds-text-primary)]">
              <IonIcon icon={item.icon} className="shrink-0 text-sm text-[var(--ds-brand-primary)]" />
              <span>{item.title}</span>
            </div>
            <p className="mt-0.5 text-[11.5px] leading-snug text-[var(--ds-text-muted)]">{item.desc}</p>
          </div>
        </div>
      ))}
    </section>

    {/* 2 One-Line Tips */}
    <section className="qoc-card space-y-2">
      <div className="ds-section-label">Tips Cepat</div>
      {QUICK_TIPS.map((tip) => (
        <div key={tip} className="flex items-start gap-2 text-[11.5px] leading-snug text-[var(--ds-text-secondary)]">
          <IonIcon icon={checkmarkCircleOutline} className="mt-0.5 shrink-0 text-sm text-emerald-600" />
          <span>{tip}</span>
        </div>
      ))}
    </section>
  </DsFormModal>
);
