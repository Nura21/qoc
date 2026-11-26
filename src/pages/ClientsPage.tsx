import { IonBackButton, IonButtons, IonContent, IonHeader, IonIcon, IonPage, IonToast, IonToolbar } from '@ionic/react';
import { addOutline, logoWhatsapp, peopleOutline, trashOutline } from 'ionicons/icons';
import React, { useState } from 'react';

import { DsConfirmAlert } from '../components/common/DsConfirmAlert';
import { EmptyState } from '../components/common/EmptyState';
import { DsButton } from '../components/ui/DsButton';
import { DsInput, DsTextarea } from '../components/ui/DsField';
import { DsFormModal } from '../components/ui/DsFormModal';
import { DsSearchBar } from '../components/ui/DsSearchBar';
import { useAsyncQuery } from '../hooks/useAsyncQuery';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useToastMessage } from '../hooks/useToastMessage';
import { clientService } from '../modules/clients/clientService';
import type { Client } from '../types/database';
import { normalizeWaPhone } from '../utils/formatters';
import { getInitials } from '../utils/textHelpers';

const ClientsPage: React.FC = () => {
  const { toastMessage, showToast, showError, clearToast } = useToastMessage();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 100);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: clients } = useAsyncQuery<Client[]>(() => clientService.list(debouncedQuery), [], debouncedQuery);

  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phoneWa, setPhoneWa] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');

  const openCreateModal = () => {
    setEditingClient(null);
    setName('');
    setCompanyName('');
    setPhoneWa('');
    setEmail('');
    setAddress('');
    setIsModalOpen(true);
  };

  const openEditModal = (c: Client) => {
    setEditingClient(c);
    setName(c.name);
    setCompanyName(c.company_name ?? '');
    setPhoneWa(c.phone_wa ?? '');
    setEmail(c.email ?? '');
    setAddress(c.address ?? '');
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    try {
      await clientService.upsert({
        id: editingClient?.id,
        name,
        company_name: companyName,
        phone_wa: phoneWa,
        email,
        address,
      });
      setIsModalOpen(false);
      showToast('Data klien disimpan.');
    } catch (err) {
      showError(err, 'Gagal menyimpan klien.');
    }
  };

  const handleDelete = async () => {
    if (!editingClient) return;
    await clientService.remove(editingClient.id);
    setConfirmDelete(false);
    setIsModalOpen(false);
    showToast(`Klien "${editingClient.name}" dihapus.`);
  };

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/profile" text="" />
          </IonButtons>
          <div className="flex items-center justify-between gap-3 pr-[var(--ds-page-px)] py-2">
            <h1 className="ds-page-title text-[var(--ds-text-primary)]">Daftar Klien</h1>
            <DsButton size="sm" variant="primary" icon={addOutline} onClick={openCreateModal}>
              Tambah
            </DsButton>
          </div>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <div className="ds-container ds-stack">
          <DsSearchBar value={query} placeholder="Cari klien, usaha, atau WA..." onValueChange={setQuery} />

          {clients.length === 0 ? (
            <EmptyState
              icon={peopleOutline}
              title="Belum ada klien tersimpan"
              description="Simpan kontak klien beserta nomor WhatsApp agar pengiriman tagihan jauh lebih cepat."
              actionLabel="+ Tambah Klien"
              onAction={openCreateModal}
            />
          ) : (
            <div className="space-y-2.5">
              {clients.map((c) => {
                const wa = normalizeWaPhone(c.phone_wa);
                return (
                  <div
                    key={c.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openEditModal(c)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') openEditModal(c);
                    }}
                    className="qoc-card flex cursor-pointer items-center justify-between gap-3 transition-transform active:scale-[0.99]"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--ds-brand-soft)] text-xs font-extrabold text-[var(--ds-brand-soft-text)]">
                        {getInitials(c.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="ds-card-title truncate text-[var(--ds-text-primary)]">{c.name}</h3>
                        <p className="truncate text-xs text-[var(--ds-text-muted)]">
                          {[c.company_name, c.phone_wa].filter(Boolean).join(' • ') || 'Ketuk untuk lengkapi detail'}
                        </p>
                      </div>
                    </div>

                    {wa && (
                      <a
                        href={`https://wa.me/${wa}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Chat WhatsApp ${c.name}`}
                        onClick={(e) => e.stopPropagation()}
                        className="flex h-[var(--ds-btn-icon-box)] w-[var(--ds-btn-icon-box)] shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 active:opacity-80 dark:bg-emerald-950/60 dark:text-emerald-300"
                      >
                        <IonIcon icon={logoWhatsapp} className="text-lg" />
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DsFormModal
          isOpen={isModalOpen}
          title={editingClient ? 'Edit Klien' : 'Klien Baru'}
          onClose={() => setIsModalOpen(false)}
          footer={
            <div className="space-y-2">
              <DsButton size="lg" variant="primary" fullWidth onClick={() => void handleSave()}>
                Simpan Klien
              </DsButton>
              {editingClient && (
                <DsButton
                  size="md"
                  variant="danger"
                  icon={trashOutline}
                  fullWidth
                  onClick={() => setConfirmDelete(true)}
                >
                  Hapus Klien
                </DsButton>
              )}
            </div>
          }
        >
          <div className="qoc-card space-y-3">
            <DsInput
              label="Nama Klien / PIC *"
              placeholder="Contoh: Bpk. Andi Wijaya"
              value={name}
              onValueChange={setName}
            />
            <DsInput
              label="Perusahaan / Instansi"
              placeholder="PT Sinar Jaya"
              value={companyName}
              onValueChange={setCompanyName}
            />
            <DsInput
              label="Nomor WhatsApp"
              type="tel"
              placeholder="0812xxxxxxxx"
              value={phoneWa}
              onValueChange={setPhoneWa}
            />
            <DsInput
              label="Email (Opsional)"
              type="email"
              placeholder="andi@perusahaan.com"
              value={email}
              onValueChange={setEmail}
            />
            <DsTextarea
              label="Alamat Lengkap"
              rows={2}
              placeholder="Alamat penagihan atau proyek"
              value={address}
              onValueChange={setAddress}
            />
          </div>
        </DsFormModal>

        <DsConfirmAlert
          isOpen={confirmDelete}
          header="Hapus Klien?"
          message={`Hapus klien "${editingClient?.name ?? ''}"?`}
          confirmLabel="Hapus"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => void handleDelete()}
        />

        <IonToast
          isOpen={Boolean(toastMessage)}
          message={toastMessage ?? ''}
          duration={2200}
          onDidDismiss={clearToast}
        />
      </IonContent>
    </IonPage>
  );
};

export default ClientsPage;
