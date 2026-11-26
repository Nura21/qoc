import React, { useId } from 'react';

interface BaseFieldProps {
  label: string;
  hint?: string;
  error?: string;
  rightSlot?: React.ReactNode;
  className?: string;
}

export interface DsInputProps extends BaseFieldProps, Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string | number;
  onValueChange: (val: string) => void;
}

export interface DsCurrencyInputProps
  extends BaseFieldProps, Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type' | 'inputMode'> {
  value: string | number;
  onValueChange: (rawDigits: string) => void;
}

export interface DsTextareaProps
  extends BaseFieldProps, Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  value: string;
  onValueChange: (val: string) => void;
}

export interface DsSelectOption {
  value: string;
  label: string;
}

export interface DsSelectProps extends BaseFieldProps {
  value: string;
  options: DsSelectOption[];
  placeholder?: string;
  onValueChange: (val: string) => void;
}

function scrollFieldIntoView(el: HTMLElement): void {
  window.setTimeout(() => {
    try {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch {
      // jsdom / legacy fallback
    }
  }, 260);
}

interface DsFieldShellProps extends BaseFieldProps {
  htmlFor: string;
  children: React.ReactNode;
}

/** Single reusable KISS field layout shell (external label, optional rightSlot, inline error/hint). */
const DsFieldShell: React.FC<DsFieldShellProps> = ({
  htmlFor,
  label,
  hint,
  error,
  rightSlot,
  className = '',
  children,
}) => (
  <div className={`min-w-0 ${className}`}>
    <div className="mb-1.5 flex items-center justify-between gap-2">
      <label htmlFor={htmlFor} className="truncate text-[12px] font-semibold text-[var(--ds-text-secondary)]">
        {label}
      </label>
      {rightSlot}
    </div>
    {children}
    {error ? (
      <p className="mt-1 text-[11px] font-medium text-red-600">{error}</p>
    ) : (
      hint && <p className="mt-1 text-[11px] text-[var(--ds-text-muted)]">{hint}</p>
    )}
  </div>
);

export const DsInput: React.FC<DsInputProps> = ({
  label,
  hint,
  error,
  rightSlot,
  className,
  value,
  onValueChange,
  onFocus,
  ...rest
}) => {
  const autoId = useId();
  return (
    <DsFieldShell htmlFor={autoId} label={label} hint={hint} error={error} rightSlot={rightSlot} className={className}>
      <input
        id={autoId}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        onFocus={(e) => {
          scrollFieldIntoView(e.currentTarget);
          onFocus?.(e);
        }}
        className={`ds-input-box ${error ? '!border-red-500 !bg-red-50/40' : ''}`}
        {...rest}
      />
    </DsFieldShell>
  );
};

export const DsCurrencyInput: React.FC<DsCurrencyInputProps> = ({
  label,
  hint,
  error,
  rightSlot,
  className,
  value,
  placeholder = '0',
  onValueChange,
  onFocus,
  ...rest
}) => {
  const autoId = useId();
  const digitsOnly = String(value ?? '').replace(/\D/g, '');
  const formattedDisplay = digitsOnly ? Number(digitsOnly).toLocaleString('id-ID') : '';

  return (
    <DsFieldShell htmlFor={autoId} label={label} hint={hint} error={error} rightSlot={rightSlot} className={className}>
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[12px] font-bold text-[var(--ds-text-muted)]">
          Rp
        </span>
        <input
          id={autoId}
          type="text"
          inputMode="numeric"
          placeholder={placeholder}
          value={formattedDisplay}
          onChange={(e) => onValueChange(e.target.value.replace(/\D/g, ''))}
          onFocus={(e) => {
            scrollFieldIntoView(e.currentTarget);
            onFocus?.(e);
          }}
          className={`ds-input-box !pl-9 tabular-nums ${error ? '!border-red-500 !bg-red-50/40' : ''}`}
          {...rest}
        />
      </div>
    </DsFieldShell>
  );
};

export const DsTextarea: React.FC<DsTextareaProps> = ({
  label,
  hint,
  error,
  rightSlot,
  className,
  value,
  rows = 3,
  onValueChange,
  onFocus,
  ...rest
}) => {
  const autoId = useId();
  return (
    <DsFieldShell htmlFor={autoId} label={label} hint={hint} error={error} rightSlot={rightSlot} className={className}>
      <textarea
        id={autoId}
        rows={rows}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        onFocus={(e) => {
          scrollFieldIntoView(e.currentTarget);
          onFocus?.(e);
        }}
        className={`ds-textarea-box ${error ? '!border-red-500 !bg-red-50/40' : ''}`}
        {...rest}
      />
    </DsFieldShell>
  );
};

export const DsSelect: React.FC<DsSelectProps> = ({
  label,
  hint,
  error,
  rightSlot,
  className,
  value,
  options,
  placeholder,
  onValueChange,
}) => {
  const autoId = useId();
  return (
    <DsFieldShell htmlFor={autoId} label={label} hint={hint} error={error} rightSlot={rightSlot} className={className}>
      <select id={autoId} value={value} onChange={(e) => onValueChange(e.target.value)} className="ds-input-box">
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </DsFieldShell>
  );
};
