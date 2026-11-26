import { IonButtons, IonContent, IonFooter, IonHeader, IonModal, IonToolbar } from '@ionic/react';
import React from 'react';

import { DsButton } from './DsButton';

interface DsFormModalProps {
  isOpen: boolean;
  title: string;
  closeLabel?: string;
  onClose: () => void;
  onWillPresent?: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Keyboard-Safe Full-Screen Modal for ALL forms & search pickers.
 * Avoids Ionic sheet modal (`initialBreakpoint`) bugs on Android where opening the soft
 * keyboard collapses the sheet and leaves a blank white void covering inputs.
 */
export const DsFormModal: React.FC<DsFormModalProps> = ({
  isOpen,
  title,
  closeLabel = 'Tutup',
  onClose,
  onWillPresent,
  footer,
  children,
}) => (
  <IonModal isOpen={isOpen} onWillPresent={onWillPresent} onDidDismiss={onClose}>
    <IonHeader className="ion-no-border">
      <IonToolbar>
        <div className="flex items-center justify-between gap-2 px-[var(--ds-page-px)] py-2">
          <h2 className="ds-page-title truncate text-[var(--ds-text-primary)]">{title}</h2>
          <IonButtons>
            <DsButton size="sm" variant="ghost" onClick={onClose}>
              {closeLabel}
            </DsButton>
          </IonButtons>
        </div>
      </IonToolbar>
    </IonHeader>

    <IonContent scrollY>
      <div className="ds-container ds-stack !pb-10">{children}</div>
    </IonContent>

    {footer && (
      <IonFooter className="ion-no-border">
        <div className="border-t border-[var(--app-border)] bg-[var(--app-card)] px-[var(--ds-page-px)] py-3">
          <div className="mx-auto max-w-[var(--ds-container-max)]">{footer}</div>
        </div>
      </IonFooter>
    )}
  </IonModal>
);
