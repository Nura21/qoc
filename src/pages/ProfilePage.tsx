import { IonContent, IonHeader, IonIcon, IonPage, IonToast, IonToolbar } from '@ionic/react';
import {
  bookOutline,
  chevronForwardOutline,
  colorPaletteOutline,
  imageOutline,
  shieldCheckmarkOutline,
  sparklesOutline,
  trashOutline,
} from 'ionicons/icons';
import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { DsConfirmAlert } from '../components/common/DsConfirmAlert';
import { UserGuideModal } from '../components/common/UserGuideModal';
import { DsButton } from '../components/ui/DsButton';
import { DsInput, DsTextarea } from '../components/ui/DsField';
import { DsFormModal } from '../components/ui/DsFormModal';
import { backupService } from '../db/backup';
import { clearAllData, seedDemoData } from '../db/seedDemoData';
import { useAsyncQuery } from '../hooks/useAsyncQuery';
import { useToastMessage } from '../hooks/useToastMessage';
import { clientService } from '../modules/clients/clientService';
import { profileService } from '../modules/profile/profileService';
import type { Client } from '../types/database';
import { hapticLight } from '../utils/haptics';
import { fileToResizedDataUrl } from '../utils/imageHelper';
import { getInitials } from '../utils/textHelpers';
import { getThemeMode, setThemeMode, type ThemeMode } from '../utils/themePreference';

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'Otomatis' },
  { value: 'light', label: 'Terang' },
  { value: 'dark', label: 'Gelap' },
];

const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { toastMessage, showToast, showError, clearToast } = useToastMessage();
  const [guideOpen, setGuideOpen] = useState(false);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => getThemeMode());

  const handleChangeTheme = (next: ThemeMode) => {
    void hapticLight();
    setThemeMode(next);
    setThemeModeState(next);
  };

  const handleLoadDemo = async () => {
    try {
      await clearAllData();
      const res = await seedDemoData();
      showToast(`Data contoh dimuat (${res.documents} dokumen, ${res.clients} klien, ${res.catalog} barang).`);
    } catch (err) {
      showError(err, 'Gagal memuat data contoh.');
    }
  };

  const handleClearAll = async () => {
    try {
      await clearAllData();
      setConfirmClearAll(false);
      showToast('Semua data dibersihkan. Siap diisi data usaha Anda!');
    } catch (err) {
      showError(err, 'Gagal membersihkan data.');
    }
  };

  const { data: screenData } = useAsyncQuery(
    async () => {
      const [profile, clients] = await Promise.all([profileService.get(), clientService.list()]);
      return { profile, clients };
    },
    { profile: null, clients: [] as Client[] },
  );

  const { profile, clients } = screenData;

  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [name, setName] = useState('');
  const [phoneWa, setPhoneWa] = useState('');
  const [address, setAddress] = useState('');
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [signaturePath, setSignaturePath] = useState<string | null>(null);
  const [bankName, setBankName] = useState('');
  const [bankAccountNo, setBankAccountNo] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [defaultScope, setDefaultScope] = useState('');
  const [prefixQuo, setPrefixQuo] = useState('QUO');
  const [prefixInv, setPrefixInv] = useState('INV');
  const [prefixBast, setPrefixBast] = useState('BAST');

  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [confirmDeleteClient, setConfirmDeleteClient] = useState(false);
  const [clientName, setClientName] = useState('');
  const [clientCompany, setClientCompany] = useState('');
  const [clientWa, setClientWa] = useState('');
  const [clientAddress, setClientAddress] = useState('');

  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const signInputRef = useRef<HTMLInputElement | null>(null);
  const restoreInputRef = useRef<HTMLInputElement | null>(null);

  const openEditProfile = () => {
    setName(profile?.name ?? '');
    setPhoneWa(profile?.phone_wa ?? '');
    setAddress(profile?.address ?? '');
    setLogoPath(profile?.logo_path ?? null);
    setSignaturePath(profile?.signature_path ?? null);
    setBankName(profile?.bank_name ?? '');
    setBankAccountNo(profile?.bank_account_no ?? '');
    setBankAccountName(profile?.bank_account_name ?? '');
    setDefaultScope(
      profile?.default_scope_terms ??
        'Maksimal 2x revisi minor. Pekerjaan atau lembur di luar rincian dikenakan biaya tambahan sesuai kesepakatan.',
    );
    setPrefixQuo(profile?.prefix_quotation || 'QUO');
    setPrefixInv(profile?.prefix_invoice || 'INV');
    setPrefixBast(profile?.prefix_bast || 'BAST');
    setEditProfileOpen(true);
  };

  const handleSaveProfile = async () => {
    try {
      await profileService.getOrSave({
        name,
        phone_wa: phoneWa,
        address,
        logo_path: logoPath,
        signature_path: signaturePath,
        bank_name: bankName,
        bank_account_no: bankAccountNo,
        bank_account_name: bankAccountName,
        default_scope_terms: defaultScope,
        prefix_quotation: prefixQuo,
        prefix_invoice: prefixInv,
        prefix_bast: prefixBast,
      });
      setEditProfileOpen(false);
      showToast('Profil bisnis diperbarui!');
    } catch (err) {
      showError(err, 'Gagal menyimpan profil.');
    }
  };

  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>, target: 'logo' | 'signature') => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToResizedDataUrl(file, 400);
      if (target === 'logo') setLogoPath(dataUrl);
      else setSignaturePath(dataUrl);
    } catch (err) {
      showError(err, 'Gagal memuat gambar.');
    } finally {
      e.target.value = '';
    }
  };

  const openAddClient = () => {
    setEditingClient(null);
    setClientName('');
    setClientCompany('');
    setClientWa('');
    setClientAddress('');
    setClientModalOpen(true);
  };

  const openEditClient = (c: Client) => {
    setEditingClient(c);
    setClientName(c.name);
    setClientCompany(c.company_name ?? '');
    setClientWa(c.phone_wa ?? '');
    setClientAddress(c.address ?? '');
    setClientModalOpen(true);
  };

  const handleSaveClient = async () => {
    try {
      await clientService.upsert({
        id: editingClient?.id,
        name: clientName,
        company_name: clientCompany,
        phone_wa: clientWa,
        address: clientAddress,
      });
      setClientModalOpen(false);
      showToast('Klien berhasil disimpan.');
    } catch (err) {
      showError(err, 'Gagal menyimpan klien.');
    }
  };

  const handleDeleteClient = async () => {
    if (!editingClient) return;
    await clientService.remove(editingClient.id);
    setConfirmDeleteClient(false);
    setClientModalOpen(false);
    showToast(`Klien "${editingClient.name}" dihapus.`);
  };

  const handleExportBackup = async () => {
    try {
      const res = await backupService.exportJson();
      showToast(`Backup ${res.filename} berhasil diekspor!`);
    } catch (err) {
      showError(err, 'Gagal mengekspor backup.');
    }
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const raw = await file.text();
      const res = await backupService.importJson(raw);
      showToast(`Restore sukses: ${res.restoredCounts.documents} dokumen & ${res.restoredCounts.clients} klien.`);
    } catch (err) {
      showError(err, 'Format file backup tidak valid.');
    } finally {
      e.target.value = '';
    }
  };

  const displayName = profile?.name || 'Belum Diisi (Ketuk Edit)';
  const bankSummary = [
    profile?.bank_name,
    profile?.bank_account_no,
    profile?.bank_account_name ? `a.n. ${profile.bank_account_name}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <div className="flex items-center justify-between gap-3 px-[var(--ds-page-px)] py-2">
            <div className="min-w-0 flex-1">
              <h1 className="ds-page-title truncate text-[var(--ds-text-primary)]">Profil, Klien &amp; Cadangan</h1>
              <p className="mt-0.5 truncate text-[11px] text-[var(--ds-text-muted)]">
                Data tersimpan aman di perangkat ini
              </p>
            </div>
            <DsButton size="sm" variant="secondary" onClick={openEditProfile}>
              Edit Profil
            </DsButton>
          </div>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <div className="ds-container ds-stack">
          {/* Card 1: Business Profile Summary */}
          <section className="qoc-card space-y-3">
            <div className="flex items-center gap-3">
              {profile?.logo_path ? (
                <img
                  src={profile.logo_path}
                  alt="Logo"
                  className="h-12 w-12 shrink-0 rounded-2xl border border-[var(--app-border)] object-contain p-1"
                />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-sm font-extrabold text-white shadow-sm shadow-blue-600/20">
                  {getInitials(profile?.name || 'QO')}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="ds-card-title truncate text-[var(--ds-text-primary)]">{displayName}</div>
                <div className="mt-0.5 truncate text-[12px] text-[var(--ds-text-muted)]">
                  {bankSummary || 'Rekening bank belum diatur'}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--app-border)] bg-[var(--ds-bg-muted)] p-3 text-[12px] leading-relaxed text-[var(--ds-text-secondary)]">
              <div className="mb-1 text-[11.5px] font-bold text-[var(--ds-text-primary)]">
                Default Scope &amp; Revisi
              </div>
              {profile?.default_scope_terms || 'Belum ada template scope default. Ketuk Edit Profil untuk mengaturnya.'}
            </div>
          </section>

          {/* Card 2: Daftar Klien Tersimpan */}
          <section className="qoc-card">
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <h2 className="ds-card-title text-[var(--ds-text-primary)]">Daftar Klien ({clients.length})</h2>
              <div className="flex shrink-0 items-center gap-1.5">
                {clients.length > 0 && (
                  <DsButton size="sm" variant="ghost" onClick={() => navigate('/clients')}>
                    Lihat Semua
                  </DsButton>
                )}
                <DsButton size="sm" variant="secondary" onClick={openAddClient}>
                  + Tambah
                </DsButton>
              </div>
            </div>

            {clients.length === 0 ? (
              <p className="py-4 text-center text-[12px] text-[var(--ds-text-muted)]">
                Belum ada klien tersimpan. Ketuk <strong>+ Tambah</strong> di atas.
              </p>
            ) : (
              <div className="divide-y divide-[var(--app-border)]">
                {clients.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => openEditClient(c)}
                    className="flex w-full items-center justify-between gap-2.5 py-2.5 text-left transition active:opacity-75"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-bold text-[var(--ds-text-primary)]">{c.name}</div>
                      <div className="truncate text-[11px] text-[var(--ds-text-muted)]">
                        {c.company_name || 'Perorangan'}
                      </div>
                    </div>
                    <span className="shrink-0 font-mono text-[11px] text-[var(--ds-text-muted)]">
                      {c.phone_wa || '-'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Card 3: Cadangkan & Pulihkan Data */}
          <section className="space-y-3 rounded-[18px] border border-emerald-200 bg-emerald-50/90 p-4 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100">
            <div className="flex items-center gap-2">
              <IonIcon
                icon={shieldCheckmarkOutline}
                className="shrink-0 text-lg text-emerald-700 dark:text-emerald-400"
              />
              <h2 className="ds-card-title text-emerald-900 dark:text-emerald-200">Cadangkan &amp; Pulihkan Data</h2>
            </div>
            <p className="text-[12px] leading-relaxed text-emerald-800 dark:text-emerald-300/90">
              Simpan salinan data usaha ke Google Drive pribadi atau chat WA sendiri agar tetap aman saat ganti HP.
            </p>
            <div className="grid grid-cols-2 gap-2.5 pt-0.5">
              <DsButton size="md" variant="whatsapp" fullWidth onClick={() => void handleExportBackup()}>
                Simpan Cadangan
              </DsButton>

              <input
                ref={restoreInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => void handleImportBackup(e)}
              />
              <DsButton
                size="md"
                variant="outline"
                fullWidth
                className="!border-emerald-300 !text-emerald-800 dark:!border-emerald-700 dark:!text-emerald-300"
                onClick={() => restoreInputRef.current?.click()}
              >
                Pulihkan Data
              </DsButton>
            </div>
          </section>

          {/* Card 4: Pengaturan & Bantuan (Ringkas 3 Baris) */}
          <section className="qoc-card space-y-3">
            <div className="ds-section-label">Pengaturan &amp; Bantuan</div>

            <div className="divide-y divide-[var(--app-border)]">
              {/* Row 1: Panduan Penggunaan QOC */}
              <button
                type="button"
                onClick={() => {
                  void hapticLight();
                  setGuideOpen(true);
                }}
                className="flex w-full items-center justify-between gap-3 py-2.5 pt-0 text-left transition active:opacity-75"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--ds-brand-soft)] text-[var(--ds-brand-primary)]">
                    <IonIcon icon={bookOutline} className="text-base" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-bold text-[var(--ds-text-primary)]">Panduan Singkat QOC</div>
                    <div className="truncate text-[11px] text-[var(--ds-text-muted)]">
                      Alur cepat 4 langkah &amp; tips praktis
                    </div>
                  </div>
                </div>
                <IonIcon icon={chevronForwardOutline} className="shrink-0 text-base text-[var(--ds-text-muted)]" />
              </button>

              {/* Row 2: Tampilan Tema */}
              <div className="space-y-2 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--ds-bg-muted)] text-[var(--ds-text-secondary)]">
                    <IonIcon icon={colorPaletteOutline} className="text-base" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-bold text-[var(--ds-text-primary)]">Tampilan Aplikasi</div>
                    <div className="text-[11px] text-[var(--ds-text-muted)]">
                      Pilih tema terang, gelap, atau otomatis
                    </div>
                  </div>
                </div>
                <div className="ds-segmented grid-cols-3">
                  {THEME_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      data-active={String(themeMode === opt.value)}
                      onClick={() => handleChangeTheme(opt.value)}
                      className="ds-segment-btn"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Row 3: Data Contoh (Demo) */}
              <div className="space-y-2 pt-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--ds-brand-soft)] text-[var(--ds-brand-primary)]">
                    <IonIcon icon={sparklesOutline} className="text-base" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-bold text-[var(--ds-text-primary)]">Data Contoh (Demo)</div>
                    <div className="text-[11px] text-[var(--ds-text-muted)]">
                      Muat contoh simulasi atau bersihkan saat siap pakai asli
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <DsButton size="sm" variant="secondary" fullWidth onClick={() => void handleLoadDemo()}>
                    Muat Contoh
                  </DsButton>
                  <DsButton size="sm" variant="danger" fullWidth onClick={() => setConfirmClearAll(true)}>
                    Bersihkan Data
                  </DsButton>
                </div>
              </div>
            </div>
          </section>

          {/* Subtle Centered Colophon Footer (Clean, Restrained Credit) */}
          <footer className="pb-3 pt-1 text-center text-[11px] leading-relaxed text-[var(--ds-text-muted)]/80">
            <div>QOC v1.0 · Penyimpanan Offline Aman</div>
            <div className="mt-0.5">
              Developed by{' '}
              <a
                href="https://www.linkedin.com/in/muhammad-irfansyahfalah/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-[var(--ds-text-secondary)] underline decoration-[var(--ds-border-strong)] underline-offset-2 transition-colors active:text-[var(--ds-brand-primary)]"
              >
                Nura
              </a>
            </div>
          </footer>
        </div>

        <UserGuideModal isOpen={guideOpen} onClose={() => setGuideOpen(false)} />

        <DsConfirmAlert
          isOpen={confirmClearAll}
          header="Bersihkan Semua Data?"
          message="Seluruh profil, klien, barang, dan dokumen contoh akan dikosongkan agar Anda bisa mulai mengisi data usaha asli."
          confirmLabel="Ya, Kosongkan"
          onCancel={() => setConfirmClearAll(false)}
          onConfirm={() => void handleClearAll()}
        />

        {/* Full-Screen Keyboard-Safe Edit Business Profile Modal */}
        <DsFormModal
          isOpen={editProfileOpen}
          title="Edit Profil Bisnis"
          onClose={() => setEditProfileOpen(false)}
          footer={
            <DsButton size="lg" variant="primary" fullWidth onClick={() => void handleSaveProfile()}>
              Simpan Profil
            </DsButton>
          }
        >
          <div className="qoc-card space-y-3">
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--ds-border-strong)] bg-[var(--ds-bg-muted)] p-3"
              >
                {logoPath ? (
                  <img src={logoPath} alt="Logo" className="h-11 w-11 object-contain" />
                ) : (
                  <IonIcon icon={imageOutline} className="text-xl text-slate-400" />
                )}
                <span className="mt-1 text-[11px] font-bold text-[var(--ds-brand-primary)]">
                  {logoPath ? 'Ubah Logo' : 'Unggah Logo'}
                </span>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => void handleImagePick(e, 'logo')}
                />
              </button>

              <button
                type="button"
                onClick={() => signInputRef.current?.click()}
                className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--ds-border-strong)] bg-[var(--ds-bg-muted)] p-3"
              >
                {signaturePath ? (
                  <img src={signaturePath} alt="TTD" className="h-11 w-20 rounded bg-white object-contain p-0.5" />
                ) : (
                  <IonIcon icon={imageOutline} className="text-xl text-slate-400" />
                )}
                <span className="mt-1 text-[11px] font-bold text-[var(--ds-brand-primary)]">
                  {signaturePath ? 'Ubah TTD' : 'Unggah TTD'}
                </span>
                <input
                  ref={signInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => void handleImagePick(e, 'signature')}
                />
              </button>
            </div>

            <DsInput
              label="Nama Usaha / Brand *"
              placeholder="Studio Karya Mandiri"
              value={name}
              onValueChange={setName}
            />
            <DsInput
              label="Nomor WhatsApp Usaha"
              type="tel"
              placeholder="62812xxxxxxxx"
              value={phoneWa}
              onValueChange={setPhoneWa}
            />
            <DsInput
              label="Alamat Usaha"
              placeholder="Jakarta Selatan, Indonesia"
              value={address}
              onValueChange={setAddress}
            />
            <div className="grid grid-cols-2 gap-2.5">
              <DsInput label="Nama Bank" placeholder="BCA" value={bankName} onValueChange={setBankName} />
              <DsInput
                label="No. Rekening"
                placeholder="5410-8829"
                value={bankAccountNo}
                onValueChange={setBankAccountNo}
              />
            </div>
            <DsInput
              label="Atas Nama Rekening / Pemilik"
              placeholder="Irfan"
              value={bankAccountName}
              onValueChange={setBankAccountName}
            />
            <DsTextarea
              label="Template Scope & Revisi Default"
              rows={3}
              value={defaultScope}
              onValueChange={setDefaultScope}
            />
            <div className="grid grid-cols-3 gap-2">
              <DsInput label="QUO" value={prefixQuo} onValueChange={setPrefixQuo} />
              <DsInput label="INV" value={prefixInv} onValueChange={setPrefixInv} />
              <DsInput label="BAST" value={prefixBast} onValueChange={setPrefixBast} />
            </div>
          </div>
        </DsFormModal>

        {/* Full-Screen Keyboard-Safe Add / Edit Client Modal */}
        <DsFormModal
          isOpen={clientModalOpen}
          title={editingClient ? 'Edit Klien' : 'Tambah Klien Baru'}
          onClose={() => setClientModalOpen(false)}
          footer={
            <div className="space-y-2">
              <DsButton size="lg" variant="primary" fullWidth onClick={() => void handleSaveClient()}>
                Simpan Klien
              </DsButton>
              {editingClient && (
                <DsButton
                  size="md"
                  variant="danger"
                  icon={trashOutline}
                  fullWidth
                  onClick={() => setConfirmDeleteClient(true)}
                >
                  Hapus Klien
                </DsButton>
              )}
            </div>
          }
        >
          <div className="qoc-card space-y-3">
            <DsInput
              label="Nama Kontak *"
              placeholder="Misal: Budi Santoso"
              value={clientName}
              onValueChange={setClientName}
            />
            <DsInput
              label="Perusahaan / Usaha"
              placeholder="Misal: PT Maju Jaya"
              value={clientCompany}
              onValueChange={setClientCompany}
            />
            <DsInput
              label="Nomor WhatsApp"
              type="tel"
              placeholder="62812xxxxxxxx"
              value={clientWa}
              onValueChange={setClientWa}
            />
            <DsTextarea label="Alamat (Opsional)" rows={2} value={clientAddress} onValueChange={setClientAddress} />
          </div>
        </DsFormModal>

        <DsConfirmAlert
          isOpen={confirmDeleteClient}
          header="Hapus Klien?"
          message={`Klien "${editingClient?.name ?? ''}" akan dihapus dari daftar. Dokumen historis tetap tersimpan aman.`}
          confirmLabel="Hapus"
          onCancel={() => setConfirmDeleteClient(false)}
          onConfirm={() => void handleDeleteClient()}
        />

        <IonToast
          isOpen={Boolean(toastMessage)}
          message={toastMessage ?? ''}
          duration={2500}
          onDidDismiss={clearToast}
        />
      </IonContent>
    </IonPage>
  );
};

export default ProfilePage;
