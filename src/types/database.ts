export type DocType = 'QUOTATION' | 'INVOICE' | 'BAST';

export type DocumentStatus =
  'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'PARTIAL' | 'PAID' | 'SIGNED' | 'VOID';

export type ItemType = 'GOODS' | 'SERVICE';

export type PaymentMethod = 'TRANSFER' | 'CASH' | 'QRIS' | 'GIRO';

export type PaymentStatus = 'CONFIRMED' | 'PENDING_GIRO' | 'BOUNCED';

export type ActivityActionType =
  'CREATED' | 'SHARED_PDF_WA' | 'REMINDED_WA' | 'CONVERTED' | 'PAYMENT_RECORDED' | 'STATUS_CHANGED';

export interface BusinessProfile {
  id: string;
  name: string;
  phone_wa: string | null;
  address: string | null;
  logo_path: string | null;
  signature_path: string | null;
  bank_name: string | null;
  bank_account_no: string | null;
  bank_account_name: string | null;
  default_scope_terms: string | null;
  prefix_quotation: string;
  prefix_invoice: string;
  prefix_bast: string;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  name: string;
  company_name: string | null;
  phone_wa: string | null;
  email: string | null;
  address: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CatalogItem {
  id: string;
  item_type: ItemType;
  sku: string | null;
  name: string;
  category: string | null;
  description: string | null;
  unit: string;
  default_price: number;
  cost_price: number | null;
  track_stock: 0 | 1;
  stock_qty: number | null;
  is_active: 0 | 1;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentSequence {
  id: string;
  doc_type: DocType;
  period_ym: string;
  last_number: number;
}

export interface SenderSnapshot {
  name: string;
  phone_wa: string | null;
  address: string | null;
  logo_path: string | null;
  signature_path: string | null;
  bank_name: string | null;
  bank_account_no: string | null;
  bank_account_name: string | null;
}

export interface ClientSnapshot {
  id: string | null;
  name: string;
  company_name: string | null;
  phone_wa: string | null;
  email: string | null;
  address: string | null;
}

export interface DocumentRecord {
  id: string;
  client_id: string | null;
  parent_document_id: string | null;
  doc_type: DocType;
  doc_number: string;
  revision_no: number;
  title: string | null;
  status: DocumentStatus;
  issue_date: string;
  valid_until: string | null;
  due_date: string | null;
  handover_date: string | null;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  scope_and_terms: string | null;
  notes: string | null;
  sender_snapshot: string | null;
  client_snapshot: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined / derived fields
  client_name?: string;
  client_company?: string | null;
  client_phone_wa?: string | null;
  is_overdue?: boolean;
}

export interface DocumentItem {
  id: string;
  document_id: string;
  catalog_item_id: string | null;
  sort_order: number;
  item_name: string;
  description: string | null;
  qty: number;
  unit: string;
  unit_price: number;
  line_total: number;
}

export interface DocumentPayment {
  id: string;
  document_id: string;
  amount: number;
  payment_date: string;
  method: PaymentMethod;
  giro_due_date: string | null;
  status: PaymentStatus;
  proof_path: string | null;
  notes: string | null;
  created_at: string;
}

export interface DocumentActivity {
  id: string;
  document_id: string;
  action_type: ActivityActionType;
  metadata: string | null;
  created_at: string;
}

export interface DocumentDetail extends DocumentRecord {
  items: DocumentItem[];
  payments: DocumentPayment[];
  activities: DocumentActivity[];
  parsed_sender: SenderSnapshot | null;
  parsed_client: ClientSnapshot | null;
}

export interface BackupPayload {
  version: number;
  exported_at: string;
  app: string;
  tables: {
    business_profile: BusinessProfile[];
    clients: Client[];
    catalog_items: CatalogItem[];
    document_sequences: DocumentSequence[];
    documents: DocumentRecord[];
    document_items: DocumentItem[];
    document_payments: DocumentPayment[];
    document_activities: DocumentActivity[];
  };
}
