import { useCallback, useState } from 'react';

export interface ToastMessageHook {
  toastMessage: string | null;
  showToast: (msg: string) => void;
  showError: (err: unknown, fallback?: string) => void;
  clearToast: () => void;
}

export function useToastMessage(): ToastMessageHook {
  const [message, setMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setMessage(msg);
  }, []);

  const showError = useCallback((err: unknown, fallback = 'Terjadi kesalahan.') => {
    setMessage(err instanceof Error ? err.message : fallback);
  }, []);

  const clearToast = useCallback(() => {
    setMessage(null);
  }, []);

  return {
    toastMessage: message,
    showToast,
    showError,
    clearToast,
  };
}
