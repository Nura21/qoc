import { IonButtons, IonContent, IonHeader, IonIcon, IonModal, IonTitle, IonToolbar } from '@ionic/react';
import { documentTextOutline, logoWhatsapp } from 'ionicons/icons';
import React from 'react';

import { DsButton } from '../ui/DsButton';

interface WaPreviewModalProps {
  isOpen: boolean;
  mode: 'share' | 'remind';
  message: string;
  pdfFilename?: string;
  phoneLabel?: string;
  onClose: () => void;
  onConfirm: () => void;
}

export const WaPreviewModal: React.FC<WaPreviewModalProps> = ({
  isOpen,
  mode,
  message,
  pdfFilename,
  phoneLabel,
  onClose,
  onConfirm,
}) => (
  <IonModal
    isOpen={isOpen}
    className="qoc-sheet-modal"
    initialBreakpoint={0.65}
    breakpoints={[0, 0.65, 0.9]}
    handleBehavior="cycle"
    onDidDismiss={onClose}
  >
    <IonHeader className="ion-no-border">
      <IonToolbar>
        <IonTitle className="ds-page-title">
          {mode === 'remind' ? 'Preview Pengingat WA' : 'Kirim PDF ke WhatsApp'}
        </IonTitle>
        <IonButtons slot="end" className="pr-2">
          <DsButton size="sm" variant="ghost" onClick={onClose}>
            Tutup
          </DsButton>
        </IonButtons>
      </IonToolbar>
    </IonHeader>
    <IonContent>
      <div className="ds-container ds-stack">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs leading-relaxed whitespace-pre-line text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-100">
          {message}
        </div>

        {mode === 'share' && pdfFilename && (
          <div className="qoc-card flex items-center gap-2.5 !py-3">
            <IonIcon icon={documentTextOutline} className="shrink-0 text-lg text-red-500" />
            <span className="truncate font-mono text-xs font-semibold text-[var(--ds-text-primary)]">
              {pdfFilename}
            </span>
            <span className="ml-auto shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              Siap Lampir
            </span>
          </div>
        )}

        <DsButton size="lg" variant="whatsapp" icon={logoWhatsapp} fullWidth onClick={onConfirm}>
          {phoneLabel ? `Kirim ke WA (${phoneLabel})` : 'Buka WhatsApp Sekarang'}
        </DsButton>
      </div>
    </IonContent>
  </IonModal>
);
