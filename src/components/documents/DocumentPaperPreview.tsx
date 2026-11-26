import React from 'react';

import type { DocumentDetail } from '../../types/database';
import { formatDateId, formatRupiah } from '../../utils/formatters';

interface DocumentPaperPreviewProps {
  detail: DocumentDetail;
  remaining: number;
}

/**
 * Memoized white-paper document preview card (Quotation, Invoice, or BAST).
 * Extracted from DocumentDetailPage for KISS readability and zero redundant re-renders.
 */
export const DocumentPaperPreview: React.FC<DocumentPaperPreviewProps> = React.memo(({ detail, remaining }) => {
  const isBast = detail.doc_type === 'BAST';
  const sender = detail.parsed_sender;
  const client = detail.parsed_client;

  const bankSummary = [
    sender?.bank_name,
    sender?.bank_account_no,
    sender?.bank_account_name ? `a.n. ${sender.bank_account_name}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <article className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 text-[11px] text-slate-900 shadow-xs">
      {/* Paper Header */}
      <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-extrabold text-slate-900">{sender?.name || 'Profil Bisnis'}</div>
          {sender?.address && <div className="text-[10px] text-slate-500">{sender.address}</div>}
          {!isBast && bankSummary && <div className="mt-0.5 text-[10px] font-medium text-blue-700">{bankSummary}</div>}
        </div>
        <div className="shrink-0 text-right">
          <div className="text-xs font-extrabold tracking-wide text-blue-600">
            {isBast ? 'BERITA ACARA' : detail.doc_type}
          </div>
          <div className="font-mono text-[10px] text-slate-500">
            {detail.doc_number}
            {detail.revision_no > 0 ? `-R${detail.revision_no}` : ''}
          </div>
        </div>
      </div>

      {/* Client & Dates */}
      <div className="flex justify-between gap-2 text-[10px]">
        <div className="min-w-0 flex-1">
          <div className="text-slate-400">{isBast ? 'Pihak Penerima:' : 'Kepada:'}</div>
          <div className="truncate font-bold text-slate-800">{client?.name || detail.client_name}</div>
          {client?.company_name && <div className="truncate text-slate-500">{client.company_name}</div>}
        </div>
        <div className="shrink-0 text-right">
          <div className="text-slate-400">
            Terbit: <span className="font-semibold text-slate-700">{formatDateId(detail.issue_date)}</span>
          </div>
          {!isBast && (
            <div className="text-slate-400">
              {detail.doc_type === 'QUOTATION' ? 'Berlaku:' : 'Tempo:'}{' '}
              <span className="font-semibold text-slate-700">
                {formatDateId(detail.doc_type === 'QUOTATION' ? detail.valid_until : detail.due_date)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Line Items Table */}
      <table className="w-full border-t border-b border-slate-100 text-[10px]">
        <thead>
          <tr className="text-left text-slate-400">
            <th className="py-1.5 font-semibold">Rincian Item</th>
            <th className="py-1.5 text-right font-semibold">Qty</th>
            {!isBast && <th className="py-1.5 text-right font-semibold">Total</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {detail.items.map((it) => (
            <tr key={it.id}>
              <td className="break-words py-2 pr-2 font-medium text-slate-800">{it.item_name}</td>
              <td className="whitespace-nowrap py-2 text-right text-slate-500">
                {it.qty} {it.unit}
              </td>
              {!isBast && (
                <td className="whitespace-nowrap py-2 pl-2 text-right font-bold tabular-nums text-slate-800">
                  {formatRupiah(it.line_total)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals or BAST 2-Box Signatures */}
      {!isBast ? (
        <div className="space-y-1 text-[10px]">
          <div className="flex justify-between text-slate-500">
            <span>Subtotal</span>
            <span className="tabular-nums">{formatRupiah(detail.subtotal)}</span>
          </div>
          {detail.discount_amount > 0 && (
            <div className="flex justify-between text-emerald-600">
              <span>Diskon</span>
              <span className="tabular-nums">-{formatRupiah(detail.discount_amount)}</span>
            </div>
          )}
          {detail.tax_amount > 0 && (
            <div className="flex justify-between text-slate-500">
              <span>Pajak</span>
              <span className="tabular-nums">{formatRupiah(detail.tax_amount)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-slate-100 pt-1 text-xs font-extrabold text-slate-900">
            <span>Total Tagihan</span>
            <span className="tabular-nums">{formatRupiah(detail.total_amount)}</span>
          </div>
          {detail.doc_type === 'INVOICE' && (
            <div className="flex justify-between text-[10px] font-bold text-blue-700">
              <span>Sisa Belum Dibayar</span>
              <span className="tabular-nums">{formatRupiah(remaining)}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 pt-1 text-center text-[10px]">
          <div className="rounded-lg border border-dashed border-slate-200 p-2">
            <div className="mb-4 text-slate-400">Diserahkan oleh</div>
            <div className="font-semibold text-slate-800">
              {sender?.bank_account_name || sender?.name || 'Pelaksana'}
            </div>
          </div>
          <div className="rounded-lg border border-dashed border-slate-200 p-2">
            <div className="mb-4 text-slate-400">Diterima baik oleh</div>
            <div className="font-semibold text-slate-800">{client?.name || detail.client_name}</div>
          </div>
        </div>
      )}

      {(detail.scope_and_terms || detail.notes) && (
        <div className="rounded-xl bg-slate-50 p-2.5 text-[10px] leading-relaxed text-slate-600">
          <span className="font-bold text-slate-700">{isBast ? 'Keterangan:' : 'Scope & Ketentuan:'}</span>{' '}
          {detail.scope_and_terms || detail.notes}
        </div>
      )}
    </article>
  );
});

DocumentPaperPreview.displayName = 'DocumentPaperPreview';
