import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React, { useState } from 'react';
import { expect, test } from 'vitest';

import App from './App';
import { LaunchSplash } from './components/common/LaunchSplash';
import { DsButton } from './components/ui/DsButton';
import { DsInput } from './components/ui/DsField';

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
