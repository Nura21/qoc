import { Capacitor } from '@capacitor/core';
import React from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import { initThemePreference } from './utils/themePreference';

initThemePreference();

if (Capacitor.getPlatform() === 'android') {
  // MainActivity.java applies systemBars | displayCutout | ime natively;
  // zero out Ionic CSS safe-area vars on Android so headers never get double top padding.
  document.documentElement.classList.add('qoc-native-android');
}

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
