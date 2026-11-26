import { IonIcon } from '@ionic/react';
import React from 'react';

export type DsButtonVariant = 'primary' | 'whatsapp' | 'secondary' | 'outline' | 'danger' | 'ghost';
export type DsButtonSize = 'lg' | 'md' | 'sm' | 'icon';

export interface DsButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: DsButtonVariant;
  size?: DsButtonSize;
  icon?: string;
  fullWidth?: boolean;
}

const ICON_SIZES: Record<DsButtonSize, string> = {
  lg: 'text-[18px]',
  md: 'text-[16px]',
  sm: 'text-[15px]',
  icon: 'text-[18px]',
};

/**
 * QOC Design System v2 Smooth Button Primitive.
 * Uses dedicated component classes inside @layer components so radii, padding,
 * and shadows render identically across Android WebView, iOS, and Web.
 */
export const DsButton: React.FC<DsButtonProps> = ({
  variant = 'primary',
  size = 'md',
  icon,
  fullWidth = false,
  className = '',
  children,
  type = 'button',
  disabled,
  ...rest
}) => (
  <button
    type={type}
    disabled={disabled}
    className={`ds-btn ds-btn-${size} ds-btn-${variant} ${fullWidth ? 'w-full' : 'shrink-0'} ${className}`}
    {...rest}
  >
    {icon && <IonIcon icon={icon} className={`shrink-0 ${ICON_SIZES[size]}`} />}
    {children && <span className="truncate">{children}</span>}
  </button>
);
