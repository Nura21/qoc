import { IonReactMemoryRouter } from '@ionic/react-router';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React, { useState } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { expect, test } from 'vitest';

import App from './App';
import { AppRoutes } from './app/AppRoutes';
import { AppTourOverlay } from './components/common/AppTourOverlay';
import { LaunchSplash } from './components/common/LaunchSplash';
import { DsButton } from './components/ui/DsButton';
import { DsInput } from './components/ui/DsField';
import { appTour } from './store/appTour';
import {
  qocActionSheetEnterAnimation,
  qocActionSheetLeaveAnimation,
  qocAlertEnterAnimation,
  qocAlertLeaveAnimation,
  qocModalEnterAnimation,
  qocModalLeaveAnimation,
  qocNavAnimation,
} from './utils/animations';

test('renders QOC app without crashing', () => {
  const { baseElement } = render(<App />);
  expect(baseElement).toBeDefined();
});

test('renders Design System button and external-label input cleanly', () => {
  const Harness: React.FC = () => {
    const [val, setVal] = useState('150000');
    return (
      <div>
        <DsInput label="Harga Satuan (Rp)" value={val} onValueChange={setVal} />
        <DsButton size="lg" variant="primary" fullWidth>
          Simpan Dokumen
        </DsButton>
      </div>
    );
  };

  render(<Harness />);
  const input = screen.getByLabelText('Harga Satuan (Rp)') as HTMLInputElement;
  expect(input.value).toBe('150000');
  fireEvent.change(input, { target: { value: '250000' } });
  expect(input.value).toBe('250000');
  expect(screen.getByRole('button', { name: 'Simpan Dokumen' })).toBeInTheDocument();
});

test('renders Snappy Fintech LaunchSplash and cleanly unmounts after ready', async () => {
  render(<LaunchSplash minDurationMs={20} />);
  expect(screen.getByLabelText('Memuat aplikasi QOC')).toBeInTheDocument();
  expect(screen.getByText('Quotation → Invoice Cepat')).toBeInTheDocument();

  await waitFor(
    () => {
      expect(screen.queryByLabelText('Memuat aplikasi QOC')).not.toBeInTheDocument();
    },
    { timeout: 1500 },
  );
});

test('builds GPU overlay and navigation animations cleanly for modals, sheets, alerts, and routes', () => {
  const modalEl = document.createElement('div');
  modalEl.innerHTML = '<ion-backdrop></ion-backdrop><div class="modal-wrapper"></div>';
  expect(qocModalEnterAnimation(modalEl)).toBeDefined();
  expect(qocModalLeaveAnimation(modalEl)).toBeDefined();
  expect(qocModalEnterAnimation(modalEl, { currentBreakpoint: 0.65 })).toBeDefined();
  expect(qocModalLeaveAnimation(modalEl, { currentBreakpoint: 0.65 })).toBeDefined();

  const sheetEl = document.createElement('div');
  sheetEl.innerHTML = '<ion-backdrop></ion-backdrop><div class="action-sheet-wrapper"></div>';
  expect(qocActionSheetEnterAnimation(sheetEl)).toBeDefined();
  expect(qocActionSheetLeaveAnimation(sheetEl)).toBeDefined();

  const alertEl = document.createElement('div');
  alertEl.innerHTML = '<ion-backdrop></ion-backdrop><div class="alert-wrapper"></div>';
  expect(qocAlertEnterAnimation(alertEl)).toBeDefined();
  expect(qocAlertLeaveAnimation(alertEl)).toBeDefined();

  const entering = document.createElement('div');
  entering.className = 'ion-page';
  const leaving = document.createElement('div');
  leaving.className = 'ion-page';
  expect(qocNavAnimation(entering, { enteringEl: entering, leavingEl: leaving, direction: 'forward' })).toBeDefined();
  expect(qocNavAnimation(entering, { enteringEl: entering, leavingEl: leaving, direction: 'back' })).toBeDefined();
});

test('interactive Spotlight App Tour walks through all 5 steps and persists completion', async () => {
  appTour.resetForTesting();

  render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <div data-tour-id="tour-hero">Hero</div>
      <div data-tour-id="tour-quick-actions">Quick</div>
      <div data-tour-id="tour-tab-documents">Docs</div>
      <div data-tour-id="tour-tab-catalog">Catalog</div>
      <div data-tour-id="tour-tab-profile">Profile</div>
      <AppTourOverlay />
    </MemoryRouter>,
  );

  expect(screen.queryByRole('dialog', { name: 'Tur Aplikasi QOC' })).not.toBeInTheDocument();

  act(() => {
    appTour.start();
  });

  expect(screen.getByRole('dialog', { name: 'Tur Aplikasi QOC' })).toBeInTheDocument();
  expect(screen.getByText('Ringkasan Tagihan')).toBeInTheDocument();
  expect(screen.getByText('Langkah 1 dari 5')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Lanjut' }));
  expect(screen.getByText('Buat Dokumen 1-Klik')).toBeInTheDocument();
  expect(screen.getByText('Langkah 2 dari 5')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Kembali' }));
  expect(screen.getByText('Ringkasan Tagihan')).toBeInTheDocument();

  // Walk to step 5 and finish
  fireEvent.click(screen.getByRole('button', { name: 'Lanjut' }));
  fireEvent.click(screen.getByRole('button', { name: 'Lanjut' }));
  fireEvent.click(screen.getByRole('button', { name: 'Lanjut' }));
  fireEvent.click(screen.getByRole('button', { name: 'Lanjut' }));
  expect(screen.getByText('Profil, Klien & Cadangan')).toBeInTheDocument();
  expect(screen.getByText('Langkah 5 dari 5')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Mulai Pakai' }));
  await waitFor(() => {
    expect(screen.queryByRole('dialog', { name: 'Tur Aplikasi QOC' })).not.toBeInTheDocument();
  });
  expect(appTour.hasSeen()).toBe(true);
});

test('navigating away from Document PDF detail to another tab works and returning to Dokumen starts fresh at /documents', async () => {
  const LocationProbe: React.FC = () => {
    const loc = useLocation();
    return <div data-testid="current-path">{loc.pathname}</div>;
  };

  render(
    <IonReactMemoryRouter initialEntries={['/documents', '/documents/demo_doc_1']} initialIndex={1}>
      <LocationProbe />
      <AppRoutes />
    </IonReactMemoryRouter>,
  );

  expect(screen.getByTestId('current-path')).toHaveTextContent('/documents/demo_doc_1');

  // Clicking another tab (Barang) while viewing a PDF must navigate immediately
  fireEvent.click(screen.getByRole('button', { name: 'Barang' }));
  await waitFor(() => {
    expect(screen.getByTestId('current-path')).toHaveTextContent('/catalog');
  });

  // Returning to Dokumen tab must always start fresh at /documents (never stale /documents/:id)
  fireEvent.click(screen.getByRole('button', { name: 'Dokumen' }));
  await waitFor(() => {
    expect(screen.getByTestId('current-path')).toHaveTextContent('/documents');
  });
});
