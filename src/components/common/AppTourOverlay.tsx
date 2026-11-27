import { IonIcon } from '@ionic/react';
import { addCircleOutline, cubeOutline, documentTextOutline, personOutline, sparklesOutline } from 'ionicons/icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { appTour } from '../../store/appTour';
import { hapticLight, hapticSuccess } from '../../utils/haptics';
import { DsButton } from '../ui/DsButton';

interface TourStep {
  id: string;
  targetId: string;
  icon: string;
  title: string;
  description: string;
  radius: number;
  padding: number;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'hero',
    targetId: 'tour-hero',
    icon: sparklesOutline,
    title: 'Ringkasan Tagihan',
    description: 'Pantau total tagihan belum dibayar, uang masuk, dan aktivitas terbaru usaha Anda langsung di sini.',
    radius: 22,
    padding: 6,
  },
  {
    id: 'quick-actions',
    targetId: 'tour-quick-actions',
    icon: addCircleOutline,
    title: 'Buat Dokumen 1-Klik',
    description: 'Ketuk + Quotation untuk penawaran harga atau + Invoice untuk langsung menagih klien via WhatsApp.',
    radius: 16,
    padding: 6,
  },
  {
    id: 'tab-documents',
    targetId: 'tour-tab-documents',
    icon: documentTextOutline,
    title: 'Daftar Dokumen & PDF',
    description: 'Kelola Quotation, Invoice, & BAST, ubah deal jadi Invoice 1-klik, hingga catat DP atau pelunasan.',
    radius: 14,
    padding: 4,
  },
  {
    id: 'tab-catalog',
    targetId: 'tour-tab-catalog',
    icon: cubeOutline,
    title: 'Katalog Barang & Jasa',
    description:
      'Simpan daftar harga, satuan, dan stok 1× di sini agar saat bikin dokumen tinggal pilih tanpa ketik ulang.',
    radius: 14,
    padding: 4,
  },
  {
    id: 'tab-profile',
    targetId: 'tour-tab-profile',
    icon: personOutline,
    title: 'Profil, Klien & Cadangan',
    description:
      'Atur nama usaha & rekening, daftar klien, cadangkan data, atau bersihkan data contoh saat siap pakai asli.',
    radius: 14,
    padding: 4,
  },
];

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
  radius: number;
}

export const AppTourOverlay: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [active, setActive] = useState(() => appTour.isActive());
  const [stepIndex, setStepIndex] = useState(0);
  const [closing, setClosing] = useState(false);
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return appTour.subscribe(() => {
      const nextActive = appTour.isActive();
      setActive(nextActive);
      if (nextActive) {
        setStepIndex(0);
        setClosing(false);
      }
    });
  }, []);

  // Ensure tour always begins on /dashboard so Hero & Quick Action targets are visible
  useEffect(() => {
    if (!active) return;
    if (location.pathname !== '/dashboard') {
      navigate('/dashboard', { replace: false });
    }
  }, [active, location.pathname, navigate]);

  const measureCurrentStep = useCallback(() => {
    const step = TOUR_STEPS[stepIndex];
    if (!step) return false;
    const el = document.querySelector<HTMLElement>(`[data-tour-id="${step.targetId}"]`);
    if (!el) {
      setSpotlight(null);
      return false;
    }
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      setSpotlight(null);
      return false;
    }

    const pad = step.padding;
    const left = Math.max(4, rect.left - pad);
    const top = Math.max(4, rect.top - pad);
    const width = Math.min(window.innerWidth - left - 4, rect.width + pad * 2);
    const height = Math.min(window.innerHeight - top - 4, rect.height + pad * 2);

    setSpotlight({
      top,
      left,
      width,
      height,
      radius: step.radius,
    });
    return true;
  }, [stepIndex]);

  useEffect(() => {
    if (!active) return;

    let rafId = 0;
    let attempts = 0;
    const step = TOUR_STEPS[stepIndex];

    const locate = () => {
      const el = step ? document.querySelector<HTMLElement>(`[data-tour-id="${step.targetId}"]`) : null;
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && (rect.top < 16 || rect.bottom > window.innerHeight - 16)) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
      const found = measureCurrentStep();
      if (!found && attempts < 24) {
        attempts += 1;
        rafId = window.requestAnimationFrame(locate);
      }
    };

    rafId = window.requestAnimationFrame(locate);
    const settleTimer = window.setTimeout(measureCurrentStep, 260);

    const handleResize = () => {
      measureCurrentStep();
    };
    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('orientationchange', handleResize, { passive: true });

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(settleTimer);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [active, stepIndex, location.pathname, measureCurrentStep]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const handleClose = useCallback(
    (completed: boolean) => {
      if (closing) return;
      if (completed) {
        void hapticSuccess();
      } else {
        void hapticLight();
      }
      setClosing(true);
      closeTimerRef.current = window.setTimeout(() => {
        closeTimerRef.current = null;
        setClosing(false);
        appTour.complete();
      }, 200);
    },
    [closing],
  );

  const handleNext = () => {
    if (stepIndex >= TOUR_STEPS.length - 1) {
      handleClose(true);
      return;
    }
    void hapticLight();
    setStepIndex((idx) => idx + 1);
  };

  const handlePrev = () => {
    if (stepIndex <= 0) return;
    void hapticLight();
    setStepIndex((idx) => idx - 1);
  };

  if (!active) return null;

  const step = TOUR_STEPS[stepIndex];
  const isLast = stepIndex === TOUR_STEPS.length - 1;
  const viewportW = typeof window !== 'undefined' ? window.innerWidth : 360;
  const viewportH = typeof window !== 'undefined' ? window.innerHeight : 800;

  // Smart tooltip placement: below upper targets, above bottom-bar targets, centered fallback if unmeasured
  const placeAbove = spotlight ? spotlight.top + spotlight.height / 2 > viewportH * 0.52 : false;
  const cardWidth = Math.min(340, Math.max(260, viewportW - 32));
  const cardLeft = Math.round((viewportW - cardWidth) / 2);

  let tooltipStyle: React.CSSProperties;
  if (!spotlight) {
    tooltipStyle = {
      top: '50%',
      left: cardLeft,
      width: cardWidth,
      transform: 'translate3d(0, -50%, 0)',
    };
  } else if (placeAbove) {
    const bottomGap = Math.max(16, viewportH - spotlight.top + 14);
    tooltipStyle = {
      bottom: bottomGap,
      left: cardLeft,
      width: cardWidth,
    };
  } else {
    const topPos = Math.min(viewportH - 230, spotlight.top + spotlight.height + 14);
    tooltipStyle = {
      top: Math.max(16, topPos),
      left: cardLeft,
      width: cardWidth,
    };
  }

  const targetCenterX = spotlight ? spotlight.left + spotlight.width / 2 : viewportW / 2;
  const caretOffsetX = Math.max(22, Math.min(cardWidth - 22, Math.round(targetCenterX - cardLeft)));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Tur Aplikasi QOC"
      className={`qoc-tour-backdrop ${closing ? 'qoc-tour-closing' : ''}`}
    >
      {/* Smooth Spotlight Cutout Ring (or full backdrop when unmeasured) */}
      {spotlight ? (
        <div
          aria-hidden="true"
          className="qoc-tour-spotlight"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
            borderRadius: spotlight.radius,
          }}
        />
      ) : (
        <div aria-hidden="true" className="fixed inset-0 bg-slate-950/72" />
      )}

      {/* Floating Smart Tooltip Card */}
      <div className="qoc-tour-card" style={tooltipStyle}>
        {spotlight && (
          <div
            aria-hidden="true"
            className={`qoc-tour-caret ${placeAbove ? 'qoc-tour-caret-bottom' : 'qoc-tour-caret-top'}`}
            style={{ left: caretOffsetX }}
          />
        )}

        <div key={step.id} className="qoc-tour-content space-y-3">
          {/* Header: Step Counter + Skip */}
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[var(--ds-brand-soft)] px-2.5 py-0.5 text-[10.5px] font-bold text-[var(--ds-brand-soft-text)]">
              <IonIcon icon={step.icon} className="text-xs text-[var(--ds-brand-primary)]" />
              <span>
                Langkah {stepIndex + 1} dari {TOUR_STEPS.length}
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleClose(false)}
              className="rounded-lg px-2 py-1 text-[11.5px] font-semibold text-[var(--ds-text-muted)] transition-colors active:text-[var(--ds-text-primary)]"
            >
              Lewati
            </button>
          </div>

          {/* Copy */}
          <div>
            <h3 className="text-[15px] font-extrabold tracking-tight text-[var(--ds-text-primary)]">{step.title}</h3>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--ds-text-secondary)]">{step.description}</p>
          </div>

          {/* Footer: Animated Progress Dots + Navigation */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-1.5" aria-hidden="true">
              {TOUR_STEPS.map((item, idx) => (
                <span
                  key={item.id}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    idx === stepIndex
                      ? 'w-5 bg-[var(--ds-brand-primary)]'
                      : idx < stepIndex
                        ? 'w-1.5 bg-[var(--ds-brand-primary)]/45'
                        : 'w-1.5 bg-[var(--ds-border-strong)]'
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              {stepIndex > 0 && (
                <DsButton size="sm" variant="ghost" onClick={handlePrev}>
                  Kembali
                </DsButton>
              )}
              <DsButton size="sm" variant="primary" onClick={handleNext}>
                {isLast ? 'Mulai Pakai' : 'Lanjut'}
              </DsButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
