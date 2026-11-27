const TOUR_SEEN_KEY = 'qoc_app_tour_seen_v1';

type TourListener = () => void;

const listeners = new Set<TourListener>();
let active = false;
let splashFinished = false;
let autoStartTimer: number | null = null;

function emit(): void {
  listeners.forEach((fn) => fn());
}

function readSeenFlag(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(TOUR_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

function writeSeenFlag(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(TOUR_SEEN_KEY, '1');
    }
  } catch {
    // Ignore storage quota / private mode failures
  }
}

export const appTour = {
  isActive(): boolean {
    return active;
  },

  hasSeen(): boolean {
    return readSeenFlag();
  },

  /**
   * Starts the interactive Spotlight App Tour (e.g., from Profil replay button or auto-launch).
   */
  start(): void {
    if (autoStartTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(autoStartTimer);
      autoStartTimer = null;
    }
    if (active) return;
    active = true;
    emit();
  },

  /**
   * Marks the tour as seen and closes it cleanly.
   */
  complete(): void {
    writeSeenFlag();
    if (!active) return;
    active = false;
    emit();
  },

  /**
   * Called by LaunchSplash once its fade-out finishes so the tour appears cleanly on first install.
   */
  notifySplashFinished(): void {
    if (splashFinished) return;
    splashFinished = true;
    if (import.meta.env.MODE === 'test') return;
    if (readSeenFlag() || active) return;

    if (typeof window !== 'undefined') {
      autoStartTimer = window.setTimeout(() => {
        autoStartTimer = null;
        if (!readSeenFlag() && !active) {
          active = true;
          emit();
        }
      }, 220);
    }
  },

  subscribe(listener: TourListener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  /** Resets in-memory state for unit tests. */
  resetForTesting(): void {
    if (autoStartTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(autoStartTimer);
      autoStartTimer = null;
    }
    active = false;
    splashFinished = false;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(TOUR_SEEN_KEY);
      }
    } catch {
      // Ignore
    }
    emit();
  },
};
