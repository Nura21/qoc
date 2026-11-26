import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'id.umkm.quotationinvoice',
  appName: 'QOC',
  webDir: 'dist',
  plugins: {
    SystemBars: {
      // MainActivity.java is the single source of truth for systemBars + displayCutout + IME insets
      // Disabling SystemBars' built-in listener prevents double keyboard (IME) padding white gap on Android.
      insetsHandling: 'disable',
    },
  },
};

export default config;
