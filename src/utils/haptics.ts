import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

/**
 * Lightweight Material Design 3 tactile haptic feedback wrapper.
 * Silently no-ops on Web/Vitest or devices with haptics disabled.
 */
export async function hapticLight(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    // Ignore on unsupported devices
  }
}

export async function hapticSuccess(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await Haptics.notification({ type: NotificationType.Success });
  } catch {
    // Ignore on unsupported devices
  }
}

export async function hapticError(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await Haptics.notification({ type: NotificationType.Error });
  } catch {
    // Ignore on unsupported devices
  }
}
