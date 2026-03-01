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
