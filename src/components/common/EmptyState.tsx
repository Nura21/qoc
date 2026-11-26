import { IonIcon } from '@ionic/react';
import React from 'react';

import { DsButton } from '../ui/DsButton';

interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, actionLabel, onAction }) => (
  <div className="qoc-card flex flex-col items-center px-6 py-10 text-center">
    <div className="mb-3.5 flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--ds-brand-soft-border)] bg-[var(--ds-brand-soft)] text-[var(--ds-brand-primary)]">
      <IonIcon icon={icon} className="text-[26px]" />
    </div>
    <h3 className="ds-card-title text-[var(--ds-text-primary)]">{title}</h3>
    <p className="mt-1.5 max-w-[260px] text-[12.5px] leading-relaxed text-[var(--ds-text-muted)]">{description}</p>
    {actionLabel && onAction && (
      <div className="mt-5">
        <DsButton size="md" variant="primary" onClick={onAction} className="!px-5">
          {actionLabel}
        </DsButton>
      </div>
    )}
  </div>
);
