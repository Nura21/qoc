import React, { useState } from 'react';

import { clientService } from '../../modules/clients/clientService';
import type { Client } from '../../types/database';
import { DsButton } from '../ui/DsButton';
import { DsInput, DsTextarea } from '../ui/DsField';
import { DsFormModal } from '../ui/DsFormModal';

interface QuickClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (client: Client) => void;
  onError: (err: unknown) => void;
}

export const QuickClientModal: React.FC<QuickClientModalProps> = ({ isOpen, onClose, onCreated, onError }) => {
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [phoneWa, setPhoneWa] = useState('');
  const [address, setAddress] = useState('');

  const reset = () => {
    setName('');
    setCompany('');
    setPhoneWa('');
    setAddress('');
  };

  const handleSave = async () => {
    try {
      const created = await clientService.upsert({
        name,
        company_name: company,
        phone_wa: phoneWa,
        address,
      });
      onCreated(created);
    } catch (err) {
      onError(err);
    }
  };

  return (
    <DsFormModal
      isOpen={isOpen}
      title="Klien Baru"
      closeLabel="Batal"
      onWillPresent={reset}
      onClose={onClose}
      footer={
        <DsButton size="lg" variant="primary" fullWidth onClick={() => void handleSave()}>
          Simpan &amp; Gunakan Klien Ini
        </DsButton>
      }
    >
      <div className="qoc-card space-y-3">
        <DsInput label="Nama Penerima / PIC *" placeholder="Contoh: Bpk. Hendra" value={name} onValueChange={setName} />
        <DsInput
          label="Perusahaan / Instansi (Opsional)"
          placeholder="PT Nusantara Karya"
          value={company}
          onValueChange={setCompany}
        />
        <DsInput
          label="Nomor WhatsApp"
          type="tel"
          placeholder="0812xxxxxxxx"
          value={phoneWa}
          onValueChange={setPhoneWa}
        />
        <DsTextarea
          label="Alamat"
          rows={2}
          placeholder="Alamat proyek atau kantor"
          value={address}
          onValueChange={setAddress}
        />
      </div>
    </DsFormModal>
  );
};
