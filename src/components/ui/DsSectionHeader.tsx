import { IonIcon } from '@ionic/react';
import { chevronForwardOutline } from 'ionicons/icons';
import React from 'react';

export type SectionTone = 'brand' | 'danger' | 'success' | 'warn' | 'indigo' | 'neutral';

interface DsSectionHeaderProps {
  title: string;
  icon?: string;
  tone?: SectionTone;
  actionLabel?: string;
  onAction?: () => void;
  /** Renders a subtle hairline separator above the section to visually separate page zones */
  divider?: boolean;
}

const TONE_BADGE: Record<SectionTone, string> = {
  brand: 'bg-[var(--ds-brand-soft)] text-[var(--ds-brand-primary)]',
  danger: 'bg-red-100/90 text-red-600 dark:bg-red-950/60 dark:text-red-400',
  success: 'bg-emerald-100/90 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400',
  warn: 'bg-amber-100/90 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400',
  indigo: 'bg-indigo-100/90 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400',
  neutral: 'bg-[var(--ds-bg-subtle)] text-[var(--ds-text-secondary)]',
};

/**
 * Reusable Mobile Section Header with semantic color-coded icon badge,
 * optional top hairline divider, and clean right-aligned action link.
 */
export const DsSectionHeader: React.FC<DsSectionHeaderProps> = ({
  title,
  icon,
  tone = 'brand',
  actionLabel,
  onAction,
  divider = false,
}) => (
  <div className={divider ? 'border-t border-[var(--app-border)]/85 pt-3.5' : ''}>
    <div className="mb-2.5 flex items-center justify-between gap-2 px-0.5">
      <div className="flex min-w-0 items-center gap-2">
        {icon && (
          <span
            aria-hidden="true"
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${TONE_BADGE[tone]}`}
          >
            <IonIcon icon={icon} className="text-[13px]" />
          </span>
        )}
        <h2 className="ds-section-label truncate">{title}</h2>
      </div>

      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex shrink-0 items-center gap-0.5 text-[12px] font-bold text-[var(--ds-brand-primary)] transition-opacity active:opacity-70"
        >
          <span>{actionLabel}</span>
          <IonIcon icon={chevronForwardOutline} className="text-[13px]" />
        </button>
      )}
    </div>
  </div>
);
