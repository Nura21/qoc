export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function nowIsoUtc(): string {
  return new Date().toISOString();
}

export function todayLocalDate(offsetDays = 0): string {
  const d = new Date();
  if (offsetDays !== 0) {
    d.setDate(d.getDate() + offsetDays);
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function periodYmFromDate(isoDate?: string): string {
  if (isoDate && /^\d{4}-\d{2}/.test(isoDate)) {
    return isoDate.slice(0, 4) + isoDate.slice(5, 7);
  }
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function toIntRupiah(val: number | string | null | undefined): number {
  if (val === null || val === undefined || val === '') return 0;
  const num = typeof val === 'number' ? val : Number(String(val).replace(/[^\d-]/g, ''));
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.round(num));
}

export function formatRupiah(amount: number | null | undefined): string {
  const safe = toIntRupiah(amount ?? 0);
  return `Rp${safe.toLocaleString('id-ID')}`;
}

export function formatDateId(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const parts = dateStr.slice(0, 10).split('-');
  if (parts.length !== 3) return dateStr;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const mIdx = Number(parts[1]) - 1;
  const monthName = months[mIdx] ?? parts[1];
  return `${Number(parts[2])} ${monthName} ${parts[0]}`;
}

export function normalizeWaPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) {
    return `62${digits.slice(1)}`;
  }
  if (digits.startsWith('8')) {
    return `62${digits}`;
  }
  return digits;
}
