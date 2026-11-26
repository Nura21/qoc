import { IonIcon } from '@ionic/react';
import { closeCircle, searchOutline } from 'ionicons/icons';
import React from 'react';

interface DsSearchBarProps {
  value: string;
  placeholder: string;
  onValueChange: (val: string) => void;
}

/**
 * Smooth, full-width Search Bar calibrated for 360px Redmi 13C so placeholder text
 * never clips awkwardly like default IonSearchbar.
 */
export const DsSearchBar: React.FC<DsSearchBarProps> = ({ value, placeholder, onValueChange }) => (
  <div className="relative flex h-[44px] items-center rounded-[14px] border border-[var(--app-border)] bg-[var(--app-card)] px-3.5 shadow-2xs transition-colors focus-within:border-[var(--ds-brand-primary)]">
    <IonIcon icon={searchOutline} className="mr-2.5 shrink-0 text-[18px] text-[var(--app-muted)]" />
    <input
      type="search"
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      placeholder={placeholder}
      className="h-full w-full min-w-0 border-0 bg-transparent text-[13.5px] font-medium text-[var(--ds-text-primary)] outline-none placeholder:text-[var(--app-muted)]/75"
    />
    {value && (
      <button
        type="button"
        aria-label="Hapus pencarian"
        onClick={() => onValueChange('')}
        className="ml-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[var(--app-muted)] active:opacity-70"
      >
        <IonIcon icon={closeCircle} className="text-[18px]" />
      </button>
    )}
  </div>
);
