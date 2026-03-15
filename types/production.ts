export type ProductionPeriod = 'day' | 'week' | 'month' | 'year';

export type ProductionCategory = 'cheese' | 'dairy';

export type ProductionProduct = {
  id: string;
  code: string;
  name: string;
  category: ProductionCategory;
  description: string;
  active: boolean;
};

export type PackagingDefinition = {
  id: string;
  productId: string;
  label: string;
  code: string;
  unitWeightKg: number;
  active: boolean;
};

export type ProductionOutput = {
  productId: string;
  milkUsedLiters: number;
  producedKg: number;
  wasteKg: number;
  note: string;
};

export type PackagingRecord = {
  packagingId: string;
  packedCount: number;
};

export type ProductionRecord = {
  date: string;
  carryoverMilkLiters: number;
  milkWasteLiters: number;
  averageFatUnit: number | null;
  note: string;
  outputs: ProductionOutput[];
  packaging: PackagingRecord[];
  updatedAt: string;
};

export type IntakeSnapshot = {
  date: string;
  milkReceivedLiters: number;
  averageFatUnit: number | null;
  supplierCount: number;
};

export type ProductionSummary = {
  milkReceivedLiters: number;
  processedMilkLiters: number;
  carryoverMilkLiters: number;
  milkWasteLiters: number;
  producedKg: number;
  productionWasteKg: number;
  packedKg: number;
  openStockKg: number;
  averageFatUnit: number | null;
  averageLitersPerKg: number | null;
  intakeDays: number;
  productionDays: number;
};

export type PackagingMixRow = {
  packagingId: string;
  label: string;
  count: number;
  packedKg: number;
};
