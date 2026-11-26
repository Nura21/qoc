import React, { useEffect, useState } from 'react';

import { getDb } from '../../db/client';
import { seedDemoDataIfEmpty } from '../../db/seedDemoData';

interface LaunchSplashProps {
  /** Minimum brand animation duration in ms (defaults to 1150ms for silky smooth opening reveal) */
  minDurationMs?: number;
}

/**
 * Smooth GPU-accelerated Opening Splash Animation ("Snappy Fintech").
 * Covers the screen cleanly with opaque `--app-surface` while SQLite initializes in parallel,
 * animates emblem spring + checkmark stroke + wordmark glide, then smoothly dissolves into Dashboard.
 */
export const LaunchSplash: React.FC<LaunchSplashProps> = ({ minDurationMs = 1150 }) => {
  const [phase, setPhase] = useState<'enter' | 'exit' | 'gone'>('enter');

  useEffect(() => {
    let active = true;
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const effectiveMin = prefersReducedMotion ? 160 : minDurationMs;
    const fadeOutMs = prefersReducedMotion ? 140 : 360;

    const minTimer = new Promise<void>((resolve) => {
      window.setTimeout(resolve, effectiveMin);
    });
    const dbReady = getDb()
      .then(() => seedDemoDataIfEmpty())
      .then(() => undefined)
      .catch(() => undefined);
    const maxCap = new Promise<void>((resolve) => {
      window.setTimeout(resolve, 1900);
    });

    let unmountTimer = 0;
    void Promise.race([Promise.all([minTimer, dbReady]), maxCap]).then(() => {
      if (!active) return;
      setPhase('exit');
      unmountTimer = window.setTimeout(() => {
        if (active) setPhase('gone');
      }, fadeOutMs);
    });

    return () => {
      active = false;
      if (unmountTimer) window.clearTimeout(unmountTimer);
    };
  }, [minDurationMs]);

  if (phase === 'gone') return null;

  return (
    <div
      role="status"
      aria-label="Memuat aplikasi QOC"
      data-splash-phase={phase}
      className={`qoc-launch-overlay ${phase === 'exit' ? 'qoc-launch-exit' : ''}`}
    >
      {/* Subtle ambient glow behind brand mark */}
      <div className="qoc-launch-glow pointer-events-none absolute h-64 w-64 rounded-full" />

      <div className="relative flex flex-col items-center px-6 text-center">
        {/* Emblem with spring entrance + pulse halo + animated SVG checkmark */}
        <div className="qoc-launch-emblem relative flex h-[84px] w-[84px] items-center justify-center rounded-[26px] bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] shadow-[0_18px_38px_-10px_rgba(37,99,235,0.55)]">
          <div className="qoc-launch-pulse pointer-events-none absolute inset-0 rounded-[26px] border-2 border-blue-400/55" />
          <svg
            width="44"
            height="44"
            viewBox="0 0 42 42"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M11 6.5H24.5L31.5 13.5V33.5C31.5 34.6046 30.6046 35.5 29.5 35.5H11C9.89543 35.5 9 34.6046 9 33.5V8.5C9 7.39543 9.89543 6.5 11 6.5Z"
              fill="#FFFFFF"
            />
            <path d="M24.5 6.5L31.5 13.5H26.5C25.3954 13.5 24.5 12.6046 24.5 11.5V6.5Z" fill="#DBEAFE" />
            <path
              d="M15 23L19 27L26.5 19"
              stroke="#2563EB"
              strokeWidth="2.9"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="qoc-launch-check"
            />
          </svg>
        </div>

        {/* Brand wordmark & subtitle gliding up smoothly */}
        <div className="qoc-launch-text mt-5 space-y-1">
          <div className="text-[26px] font-extrabold tracking-tight text-[var(--ds-text-primary)]">QOC</div>
          <div className="text-[12.5px] font-medium text-[var(--ds-text-secondary)]">Quotation → Invoice Cepat</div>
        </div>

        {/* Slim GPU progress bar + trust pill */}
        <div className="qoc-launch-pill mt-5 flex flex-col items-center gap-3">
          <div className="h-1 w-28 overflow-hidden rounded-full bg-[var(--ds-brand-soft-border)]">
            <div className="qoc-launch-bar h-full w-full origin-left rounded-full bg-[var(--ds-brand-primary)]" />
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--ds-brand-soft-border)] bg-[var(--ds-brand-soft)] px-3 py-1 text-[10px] font-bold text-[var(--ds-brand-soft-text)]">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span>Cepat · Praktis · Tanpa Internet</span>
          </div>
        </div>
      </div>
    </div>
  );
};
