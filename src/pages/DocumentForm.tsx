import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonPage,
  IonTitle,
  IonToast,
  IonToolbar,
} from '@ionic/react';
import { chevronDownOutline, cubeOutline, layersOutline, personOutline, pricetagOutline } from 'ionicons/icons';
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { CatalogPickerModal } from '../components/documents/CatalogPickerModal';
import { DocumentLineCard } from '../components/documents/DocumentLineCard';
import {
  type EditableLineSeed,
  ManualItemModal,
  type ManualItemPayload,
} from '../components/documents/ManualItemModal';
import { QuickClientModal } from '../components/documents/QuickClientModal';
import { DsButton } from '../components/ui/DsButton';
import { DsCurrencyInput, DsInput, DsSelect, DsTextarea } from '../components/ui/DsField';
import { useToastMessage } from '../hooks/useToastMessage';
import { catalogService } from '../modules/catalog/catalogService';
import { clientService } from '../modules/clients/clientService';
import { type DraftItemInput, documentService } from '../modules/documents/documentService';
import { profileService } from '../modules/profile/profileService';
import { appSession } from '../store/appSession';
import type { CatalogItem, Client, DocType } from '../types/database';
import { formatRupiah, generateId, todayLocalDate, toIntRupiah } from '../utils/formatters';
import { hapticError, hapticLight, hapticSuccess } from '../utils/haptics';

interface FormLineItem extends DraftItemInput {
  key: string;
}

const DocumentForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const queryType = (searchParams.get('type') as DocType | null) || 'QUOTATION';
  const { toastMessage, showToast, showError, clearToast } = useToastMessage();

  const [docType, setDocType] = useState<DocType>(queryType);
  const [clientId, setClientId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [issueDate, setIssueDate] = useState(todayLocalDate());
  const [validUntil, setValidUntil] = useState(todayLocalDate(14));
  const [dueDate, setDueDate] = useState(todayLocalDate(7));
  const [handoverDate, setHandoverDate] = useState(todayLocalDate());
  const [discountAmount, setDiscountAmount] = useState('0');
  const [taxAmount, setTaxAmount] = useState('0');
  const [scopeAndTerms, setScopeAndTerms] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [lines, setLines] = useState<FormLineItem[]>([]);

  const [clients, setClients] = useState<Client[]>([]);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [editingLineKey, setEditingLineKey] = useState<string | null>(null);
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    const init = async () => {
      const [cList, catList, prof] = await Promise.all([
        clientService.list(),
        catalogService.list({ activeOnly: true }),
        profileService.get(),
      ]);
      if (!active) return;
      setClients(cList);
      setCatalogItems(catList);

      if (id) {
        const existing = await documentService.getDetail(id);
        if (!active || !existing) return;
        setDocType(existing.doc_type);
        setClientId(existing.client_id ?? '');
        setTitle(existing.title ?? '');
        setIssueDate(existing.issue_date);
        setValidUntil(existing.valid_until ?? todayLocalDate(14));
        setDueDate(existing.due_date ?? todayLocalDate(7));
        setHandoverDate(existing.handover_date ?? todayLocalDate());
        setDiscountAmount(String(existing.discount_amount));
        setTaxAmount(String(existing.tax_amount));
        setScopeAndTerms(existing.scope_and_terms ?? '');
        if (existing.discount_amount > 0 || existing.tax_amount > 0) {
          setShowAdvanced(true);
        }
        setLines(
          existing.items.map((it) => ({
            key: it.id,
            catalog_item_id: it.catalog_item_id,
            item_name: it.item_name,
            description: it.description ?? '',
            qty: it.qty,
            unit: it.unit,
            unit_price: it.unit_price,
            saveToCatalog: false,
            saveCatalogType: 'GOODS',
          })),
        );
      } else {
        if (cList.length > 0) setClientId(cList[0].id);
        if (prof?.default_scope_terms) setScopeAndTerms(prof.default_scope_terms);

        const seed = appSession.consumePendingFormSeed();
        if (seed?.docType) setDocType(seed.docType);
        if (seed?.catalogItem) {
          const cat = seed.catalogItem;
          setLines([
            {
              key: generateId(),
              catalog_item_id: cat.id,
              item_name: cat.name,
              description: cat.description ?? '',
              qty: 1,
              unit: cat.unit,
              unit_price: cat.default_price,
              saveToCatalog: false,
              saveCatalogType: cat.item_type,
            },
          ]);
        }
      }
    };
    void init();
    return () => {
      active = false;
    };
  }, [id]);

  const subtotal = lines.reduce((sum, l) => sum + toIntRupiah((Number(l.qty) || 0) * toIntRupiah(l.unit_price)), 0);
  const rawDisc = toIntRupiah(discountAmount);
  const disc = Math.min(subtotal, rawDisc);
  const tax = toIntRupiah(taxAmount);
  const grandTotal = Math.max(0, subtotal - disc + tax);
  const discountWarning =
    rawDisc > subtotal && subtotal > 0
      ? `Diskon melebihi subtotal, dibatasi maks. ${formatRupiah(subtotal)}`
      : undefined;

  const handleAdjustQty = useCallback((key: string, delta: number) => {
    void hapticLight();
    setLines((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l;
        const current = Number(l.qty) || 1;
        const next = Math.round((current + delta) * 100) / 100;
        const minQty = current < 1 ? 0.1 : 1;
        return { ...l, qty: Math.max(minQty, next) };
      }),
    );
  }, []);

  const handleRemoveLine = useCallback((key: string) => {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }, []);

  const handlePickCatalogItem = (cat: CatalogItem) => {
    setLines((prev) => [
      ...prev,
      {
        key: generateId(),
        catalog_item_id: cat.id,
        item_name: cat.name,
        description: cat.description ?? '',
        qty: 1,
        unit: cat.unit,
        unit_price: cat.default_price,
        saveToCatalog: false,
        saveCatalogType: cat.item_type,
      },
    ]);
    setPickerOpen(false);
    showToast(`Ditambahkan: ${cat.name}`);
  };

  const openAddManualModal = () => {
    setEditingLineKey(null);
    setManualModalOpen(true);
  };

  const openEditLineModal = useCallback((key: string) => {
    setEditingLineKey(key);
    setManualModalOpen(true);
  }, []);

  const handleSaveManualOrEditedItem = (payload: ManualItemPayload) => {
    if (editingLineKey) {
      setLines((prev) =>
        prev.map((l) =>
          l.key === editingLineKey
            ? {
                ...l,
                item_name: payload.name,
                description: payload.description,
                qty: payload.qty,
                unit: payload.unit,
                unit_price: payload.price,
              }
            : l,
        ),
      );
      showToast('Item diperbarui.');
    } else {
      setLines((prev) => [
        ...prev,
        {
          key: generateId(),
          catalog_item_id: null,
          item_name: payload.name,
          description: payload.description,
          qty: payload.qty,
          unit: payload.unit,
          unit_price: payload.price,
          saveToCatalog: payload.saveToCatalog,
          saveCatalogType: payload.itemType,
        },
      ]);
      showToast('Item manual ditambahkan!');
    }
    setEditingLineKey(null);
  };

  const editingLineObj = editingLineKey ? lines.find((l) => l.key === editingLineKey) : null;
  const editingSeed: EditableLineSeed | null = editingLineObj
    ? {
        name: editingLineObj.item_name,
        description: editingLineObj.description,
        qty: editingLineObj.qty,
        unit: editingLineObj.unit,
        price: editingLineObj.unit_price,
        isFromCatalog: Boolean(editingLineObj.catalog_item_id),
      }
    : null;

  const handleClientCreated = async (created: Client) => {
    const refreshed = await clientService.list();
    setClients(refreshed);
    setClientId(created.id);
    setClientModalOpen(false);
    showToast(`Klien "${created.name}" dipilih.`);
  };

  const handleSubmit = async (publishNow: boolean) => {
    if (saving) return;
    if (lines.length === 0) {
      void hapticError();
      showToast('Tambahkan minimal 1 item dari List Barang atau + Manual.');
      return;
    }
    setSaving(true);
    try {
      const saved = await documentService.saveDraft(
        {
          id,
          client_id: clientId || null,
          doc_type: docType,
          title,
          issue_date: issueDate,
          valid_until: docType === 'QUOTATION' ? validUntil : null,
          due_date: docType === 'INVOICE' ? dueDate : null,
          handover_date: docType === 'BAST' ? handoverDate : null,
          discount_amount: disc,
          tax_amount: tax,
          scope_and_terms: scopeAndTerms,
        },
        lines,
      );

      const finalDoc = publishNow ? await documentService.publish(saved.id) : saved;
      void hapticSuccess();
      appSession.setLastViewedDocId(finalDoc.id);
      navigate(`/documents/${finalDoc.id}`, { replace: true });
    } catch (err) {
      void hapticError();
      showError(err, 'Gagal menyimpan dokumen.');
    } finally {
      setSaving(false);
    }
  };

  const clientOptions = clients.map((c) => ({
    value: c.id,
    label: c.company_name ? `${c.name} — ${c.company_name}` : c.name,
  }));

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/dashboard" text="" />
          </IonButtons>
          <IonTitle className="ds-page-title">
            {id
              ? `Edit ${docType === 'QUOTATION' ? 'Quotation' : docType === 'INVOICE' ? 'Invoice' : 'BAST'}`
              : `Buat ${docType === 'QUOTATION' ? 'Quotation' : docType === 'INVOICE' ? 'Invoice' : 'BAST'}`}
          </IonTitle>
          {!id && docType !== 'BAST' && (
            <IonButtons slot="end" className="pr-3">
              <div className="inline-flex rounded-lg bg-slate-200/70 p-0.5 text-[11px] font-bold dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setDocType('QUOTATION')}
                  className={`rounded-md px-2.5 py-1 transition ${
                    docType === 'QUOTATION'
                      ? 'bg-white text-blue-600 shadow-2xs dark:bg-slate-900 dark:text-blue-400'
                      : 'text-slate-500'
                  }`}
                >
                  Quo
                </button>
                <button
                  type="button"
                  onClick={() => setDocType('INVOICE')}
                  className={`rounded-md px-2.5 py-1 transition ${
                    docType === 'INVOICE'
                      ? 'bg-white text-blue-600 shadow-2xs dark:bg-slate-900 dark:text-blue-400'
                      : 'text-slate-500'
                  }`}
                >
                  Inv
                </button>
              </div>
            </IonButtons>
          )}
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <div className="ds-container ds-stack pb-12">
          {/* Card 1: Klien, Judul & Tanggal */}
          <section className="qoc-card space-y-3">
            <div className="flex items-center gap-2 border-b border-[var(--app-border)] pb-2.5">
              <span
                aria-hidden="true"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--ds-brand-soft)] text-[var(--ds-brand-primary)]"
              >
                <IonIcon icon={personOutline} className="text-sm" />
              </span>
              <h3 className="ds-card-title text-[var(--ds-text-primary)]">Info Dokumen &amp; Klien</h3>
            </div>

            <DsSelect
              label="Klien"
              placeholder="-- Pilih Klien --"
              value={clientId}
              options={clientOptions}
              onValueChange={setClientId}
              rightSlot={
                <button
                  type="button"
                  onClick={() => setClientModalOpen(true)}
                  className="text-[11px] font-bold text-[var(--ds-brand-primary)]"
                >
                  + Klien Baru
                </button>
              }
            />

            <DsInput
              label="Judul Proyek / Pesanan"
              placeholder="Contoh: Paket Visual & Website Promo"
              value={title}
              onValueChange={setTitle}
            />

            <div className="grid grid-cols-2 gap-2.5">
              <DsInput label="Tanggal Terbit" type="date" value={issueDate} onValueChange={setIssueDate} />
              {docType === 'QUOTATION' && (
                <DsInput label="Berlaku Hingga" type="date" value={validUntil} onValueChange={setValidUntil} />
              )}
              {docType === 'INVOICE' && (
                <DsInput label="Jatuh Tempo" type="date" value={dueDate} onValueChange={setDueDate} />
              )}
              {docType === 'BAST' && (
                <DsInput label="Tgl Serah Terima" type="date" value={handoverDate} onValueChange={setHandoverDate} />
              )}
            </div>
          </section>

          {/* Card 2: Rincian Item + Picker List Barang + Inline Edit & Stepper Qty */}
          <section className="qoc-card space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--app-border)] pb-2.5">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300"
                >
                  <IonIcon icon={layersOutline} className="text-sm" />
                </span>
                <h3 className="ds-card-title text-[var(--ds-text-primary)]">Rincian Item ({lines.length})</h3>
              </div>
              <div className="flex items-center gap-1.5">
                <DsButton size="sm" variant="outline" onClick={openAddManualModal}>
                  + Manual
                </DsButton>
                <DsButton size="sm" variant="primary" icon={cubeOutline} onClick={() => setPickerOpen(true)}>
                  List Barang
                </DsButton>
              </div>
            </div>

            {lines.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--ds-border-strong)] p-5 text-center text-xs text-[var(--ds-text-muted)]">
                Belum ada item. Ketuk <strong>List Barang</strong> untuk pilih dari katalog atau{' '}
                <strong>+ Manual</strong>.
              </div>
            ) : (
              <div className="space-y-2.5">
                {lines.map((it) => (
                  <DocumentLineCard
                    key={it.key}
                    item={it}
                    onEdit={openEditLineModal}
                    onRemove={handleRemoveLine}
                    onAdjustQty={handleAdjustQty}
                  />
                ))}
              </div>
            )}

            <div className="ds-divider-dashed space-y-1 pt-3 text-xs">
              <div className="flex justify-between text-[11px] text-[var(--ds-text-muted)]">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatRupiah(subtotal)}</span>
              </div>
              {disc > 0 && (
                <div className="flex justify-between text-[11px] text-emerald-600">
                  <span>Diskon</span>
                  <span className="tabular-nums">-{formatRupiah(disc)}</span>
                </div>
              )}
              {tax > 0 && (
                <div className="flex justify-between text-[11px] text-[var(--ds-text-muted)]">
                  <span>Pajak / PPN</span>
                  <span className="tabular-nums">+{formatRupiah(tax)}</span>
                </div>
              )}
              <div className="flex justify-between pt-1 text-sm font-extrabold text-[var(--ds-text-primary)]">
                <span>Total</span>
                <span className="tabular-nums text-[var(--ds-brand-primary)]">{formatRupiah(grandTotal)}</span>
              </div>
            </div>
          </section>

          {/* Card 3: Progressive Disclosure — Diskon, Pajak & Scope (Smooth CSS Grid Collapse) */}
          <section className="qoc-card">
            <button
              type="button"
              aria-expanded={showAdvanced}
              onClick={() => {
                void hapticLight();
                setShowAdvanced((v) => !v);
              }}
              className="flex w-full items-center justify-between gap-2.5 text-left"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                >
                  <IonIcon icon={pricetagOutline} className="text-sm" />
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[var(--ds-text-primary)]">
                    Diskon, Pajak &amp; Scope Kerja (Opsional)
                  </div>
                  <div className="truncate text-[10px] text-[var(--ds-text-muted)]">
                    {disc > 0 || tax > 0
                      ? `Diskon ${formatRupiah(disc)}${tax > 0 ? ` · Pajak ${formatRupiah(tax)}` : ''}`
                      : scopeAndTerms
                        ? 'Scope terisi otomatis dari Profil'
                        : 'Ketuk untuk atur diskon, PPN, atau syarat revisi'}
                  </div>
                </div>
              </div>
              <IonIcon
                icon={chevronDownOutline}
                className={`shrink-0 text-base text-[var(--ds-text-muted)] transition-transform duration-[260ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  showAdvanced ? 'rotate-180' : 'rotate-0'
                }`}
              />
            </button>

            <div className="ds-collapse" data-open={String(showAdvanced)}>
              <div className="ds-collapse-inner">
                <div className="mt-3 space-y-3 border-t border-[var(--app-border)] pt-3">
                  <div className="grid grid-cols-2 gap-2.5">
                    <DsCurrencyInput
                      label="Diskon"
                      placeholder="0"
                      error={discountWarning}
                      value={discountAmount}
                      onValueChange={setDiscountAmount}
                    />
                    <DsCurrencyInput
                      label="Pajak / PPN"
                      placeholder="0"
                      value={taxAmount}
                      onValueChange={setTaxAmount}
                    />
                  </div>

                  <DsTextarea
                    label="Scope Kerja & Batas Revisi"
                    rows={3}
                    placeholder="Maksimal 2x revisi minor. Pekerjaan tambahan di luar rincian dikenakan biaya sesuai kesepakatan."
                    value={scopeAndTerms}
                    onValueChange={setScopeAndTerms}
                    rightSlot={
                      <span className="text-[10px] font-semibold text-[var(--ds-brand-primary)]">Auto-fill Profil</span>
                    }
                  />
                </div>
              </div>
            </div>
          </section>
        </div>

        <CatalogPickerModal
          isOpen={pickerOpen}
          items={catalogItems}
          onClose={() => setPickerOpen(false)}
          onSelect={handlePickCatalogItem}
        />

        <ManualItemModal
          isOpen={manualModalOpen}
          editingItem={editingSeed}
          onClose={() => setManualModalOpen(false)}
          onSave={handleSaveManualOrEditedItem}
        />

        <QuickClientModal
          isOpen={clientModalOpen}
          onClose={() => setClientModalOpen(false)}
          onCreated={(c) => void handleClientCreated(c)}
          onError={(err) => showError(err, 'Gagal menambah klien.')}
        />

        <IonToast
          isOpen={Boolean(toastMessage)}
          message={toastMessage ?? ''}
          duration={2500}
          onDidDismiss={clearToast}
        />
      </IonContent>

      {/* Sticky Thumb-Zone Summary & Action Bar */}
      <IonFooter className="ion-no-border">
        <div className="border-t border-[var(--app-border)] bg-[var(--app-card)] px-3.5 py-2.5 shadow-[0_-4px_16px_rgba(15,23,42,0.06)]">
          <div className="mx-auto flex max-w-[680px] items-center justify-between gap-2.5">
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--ds-text-muted)]">
                Total ({lines.length} item)
              </div>
              <div className="truncate text-base font-extrabold tabular-nums text-[var(--ds-brand-primary)]">
                {formatRupiah(grandTotal)}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <DsButton size="md" variant="outline" disabled={saving} onClick={() => void handleSubmit(false)}>
                Draft
              </DsButton>
              <DsButton size="md" variant="primary" disabled={saving} onClick={() => void handleSubmit(true)}>
                Terbitkan
              </DsButton>
            </div>
          </div>
        </div>
      </IonFooter>
    </IonPage>
  );
};

export default DocumentForm;
