export type Supplier = {
  id: number;
  order_index: number;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  jmbg: string | null;
  agriculture_number: string | null;
  bank_account: string | null;
  street: string | null;
  city: string | null;
  country: string | null;
  zip_code: string | null;
  number_of_cows: number | null;
  hidden_in_daily_entry: boolean;
};

export type DailyEntry = {
  id: number;
  date: string;
  qty: number;
  fat_pct: number | null;
  supplier_id: number;
  supplier?: Supplier;
};

export type DailyIntakeLock = {
  yearMonth: string;
  isLocked: boolean;
};

export type MonthlySummaryRow = {
  serialNum: number;
  supplierId: number;
  firstName: string;
  lastName: string;
  city: string | null;
  street: string | null;
  zipCode: string | null;
  jmbg: string | null;
  bankAccount: string | null;
  qty: number;
  fatPct: number;
  pricePerFatPct: number;
  pricePerQty: number;
  taxPercentage: number;
  priceWithTax: number;
  stimulation: number;
  totalAmount: number;
};

export type QuarterlySummaryRow = {
  serialNum: number;
  supplierId: number;
  firstName: string;
  lastName: string;
  qty: number;
  cows: number;
  premiumPerL: number;
  totalPremium: number;
};

export type SupplierHistoryMonth = {
  month: number;
  qty: number;
  fatPct: number;
  pricePerQty: number;
  priceWithTax: number;
  stimulation: number;
  totalAmount: number;
  activeDays: number;
  measurementCount: number;
  constantsValidFrom: string;
};

export type SupplierHistoryDay = {
  date: string;
  month: number;
  day: number;
  qty: number;
  fatPct: number | null;
};

export type SupplierHistorySummary = {
  totalQty: number;
  totalAmount: number;
  avgFatPct: number;
  totalStimulationAmount: number;
  activeMonths: number;
  activeDays: number;
  measurementCount: number;
  lastDeliveryDate: string | null;
};

export type SupplierHistory = {
  supplier: Supplier;
  year: number;
  summary: SupplierHistorySummary;
  months: SupplierHistoryMonth[];
  dailyEntries: SupplierHistoryDay[];
};

export type CorrectionRequestStatus = 'pending' | 'approved' | 'rejected';

export type CorrectionRequest = {
  id: number;
  yearMonth: string;
  supplierId: number;
  supplierName: string;
  entryDate: string;
  fieldName: 'qty' | 'fat_pct';
  currentValue: number | null;
  requestedValue: number;
  reason: string;
  status: CorrectionRequestStatus;
  requestedBy: string;
  requestedAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  appliedEntryId: number | null;
};

export type AuditLogRecord = {
  id: number;
  actionType: string;
  entityType: string;
  entityId: string | null;
  actorIdentifier: string;
  actorIp: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
};
