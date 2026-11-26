import { IonAlert } from '@ionic/react';
import React from 'react';

interface DsConfirmAlertProps {
  isOpen: boolean;
  header: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Reusable confirmation dialog wrapping IonAlert.
 * Enforces consistent safe deletion & destructive action UX across all pages.
 */
export const DsConfirmAlert: React.FC<DsConfirmAlertProps> = ({
  isOpen,
  header,
  message,
  confirmLabel = 'Ya, Lanjutkan',
  cancelLabel = 'Batal',
  destructive = true,
  onConfirm,
  onCancel,
}) => (
  <IonAlert
    isOpen={isOpen}
    header={header}
    message={message}
    buttons={[
      { text: cancelLabel, role: 'cancel', handler: onCancel },
      {
        text: confirmLabel,
        role: destructive ? 'destructive' : undefined,
        handler: onConfirm,
      },
    ]}
    onDidDismiss={onCancel}
  />
);
