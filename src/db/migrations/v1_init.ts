export const V1_INIT_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS business_profile (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone_wa TEXT,
  address TEXT,
  logo_path TEXT,
  signature_path TEXT,
  bank_name TEXT,
  bank_account_no TEXT,
  bank_account_name TEXT,
  default_scope_terms TEXT,
  prefix_quotation TEXT NOT NULL DEFAULT 'QUO',
  prefix_invoice TEXT NOT NULL DEFAULT 'INV',
  prefix_bast TEXT NOT NULL DEFAULT 'BAST',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  company_name TEXT,
  phone_wa TEXT,
  email TEXT,
  address TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS catalog_items (
  id TEXT PRIMARY KEY,
  item_type TEXT NOT NULL DEFAULT 'GOODS' CHECK (item_type IN ('GOODS', 'SERVICE')),
  sku TEXT,
  name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  unit TEXT NOT NULL DEFAULT 'pcs',
  default_price INTEGER NOT NULL DEFAULT 0 CHECK (default_price >= 0),
  cost_price INTEGER CHECK (cost_price IS NULL OR cost_price >= 0),
  track_stock INTEGER NOT NULL DEFAULT 0 CHECK (track_stock IN (0, 1)),
  stock_qty REAL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS document_sequences (
  id TEXT PRIMARY KEY,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('QUOTATION', 'INVOICE', 'BAST')),
  period_ym TEXT NOT NULL,
  last_number INTEGER NOT NULL DEFAULT 0,
  UNIQUE (doc_type, period_ym)
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
  parent_document_id TEXT REFERENCES documents(id) ON DELETE SET NULL,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('QUOTATION', 'INVOICE', 'BAST')),
  doc_number TEXT NOT NULL,
  revision_no INTEGER NOT NULL DEFAULT 0,
  title TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (
    status IN ('DRAFT','SENT','ACCEPTED','REJECTED','EXPIRED','PARTIAL','PAID','SIGNED','VOID')
  ),
  issue_date TEXT NOT NULL,
  valid_until TEXT,
  due_date TEXT,
  handover_date TEXT,
  subtotal INTEGER NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  discount_amount INTEGER NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  tax_amount INTEGER NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  total_amount INTEGER NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  paid_amount INTEGER NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  scope_and_terms TEXT,
  notes TEXT,
  sender_snapshot TEXT,
  client_snapshot TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (doc_number, revision_no)
);

CREATE TABLE IF NOT EXISTS document_items (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  catalog_item_id TEXT REFERENCES catalog_items(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  item_name TEXT NOT NULL,
  description TEXT,
  qty REAL NOT NULL DEFAULT 1 CHECK (qty > 0),
  unit TEXT NOT NULL DEFAULT 'pcs',
  unit_price INTEGER NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  line_total INTEGER NOT NULL DEFAULT 0 CHECK (line_total >= 0)
);

CREATE TABLE IF NOT EXISTS document_payments (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount > 0),
  payment_date TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'TRANSFER' CHECK (method IN ('TRANSFER', 'CASH', 'QRIS', 'GIRO')),
  giro_due_date TEXT,
  status TEXT NOT NULL DEFAULT 'CONFIRMED' CHECK (status IN ('CONFIRMED', 'PENDING_GIRO', 'BOUNCED')),
  proof_path TEXT,
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS document_activities (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (
    action_type IN ('CREATED','SHARED_PDF_WA','REMINDED_WA','CONVERTED','PAYMENT_RECORDED','STATUS_CHANGED')
  ),
  metadata TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_clients_active ON clients(name) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_catalog_active ON catalog_items(is_active, name) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_catalog_sku ON catalog_items(sku) WHERE sku IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_documents_type_status ON documents(doc_type, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_documents_overdue ON documents(due_date)
  WHERE doc_type = 'INVOICE' AND status IN ('SENT', 'PARTIAL') AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_documents_parent ON documents(parent_document_id) WHERE parent_document_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_document_items_doc ON document_items(document_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_document_payments_doc ON document_payments(document_id, payment_date);
CREATE INDEX IF NOT EXISTS idx_document_activities_doc ON document_activities(document_id, created_at DESC);
`;
