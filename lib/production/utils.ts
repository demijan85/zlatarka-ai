import type {
  IntakeSnapshot,
  PackagingDefinition,
  PackagingMixRow,
  ProductionPeriod,
  ProductionProduct,
  ProductionRecord,
  ProductionSummary,
} from '@/types/production';
import { pad2 } from '@/lib/utils/date';

export function parseDecimalInput(value: string): number {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatNumber(value: number, digits = 0, locale = 'sr-RS'): string {
  return value.toLocaleString(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function buildDate(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function toDateValue(year: number, month: number, day: number) {
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function buildDateFromValue(value: Date) {
  return buildDate(value.getFullYear(), value.getMonth() + 1, value.getDate());
}

export function getWeekRange(year: number, month: number, day: number) {
  const current = toDateValue(year, month, day);
  const weekday = (current.getDay() + 6) % 7;
  const start = new Date(current);
  start.setDate(current.getDate() - weekday);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  return {
    start,
    end,
    startLabel: buildDateFromValue(start),
    endLabel: buildDateFromValue(end),
  };
}

export function filterSnapshotsByPeriod(
  snapshots: IntakeSnapshot[],
  period: ProductionPeriod,
  year: number,
  month: number,
  day: number
) {
  const monthPrefix = `${year}-${pad2(month)}`;
  const dayValue = buildDate(year, month, day);
  const weekRange = getWeekRange(year, month, day);

  return snapshots.filter((item) => {
    if (period === 'year') return item.date.startsWith(`${year}-`);
    if (period === 'week') return item.date >= weekRange.startLabel && item.date <= weekRange.endLabel;
    if (period === 'month') return item.date.startsWith(monthPrefix);
    return item.date === dayValue;
  });
}

export function filterRecordsByPeriod(
  records: ProductionRecord[],
  period: ProductionPeriod,
  year: number,
  month: number,
  day: number
) {
  const monthPrefix = `${year}-${pad2(month)}`;
  const dayValue = buildDate(year, month, day);
  const weekRange = getWeekRange(year, month, day);

  return records.filter((item) => {
    if (period === 'year') return item.date.startsWith(`${year}-`);
    if (period === 'week') return item.date >= weekRange.startLabel && item.date <= weekRange.endLabel;
    if (period === 'month') return item.date.startsWith(monthPrefix);
    return item.date === dayValue;
  });
}

export function summarizeProduction(
  snapshots: IntakeSnapshot[],
  records: ProductionRecord[],
  packagingDefinitions: PackagingDefinition[]
): ProductionSummary {
  let milkReceivedLiters = 0;
  let processedMilkLiters = 0;
  let carryoverMilkLiters = 0;
  let milkWasteLiters = 0;
  let producedKg = 0;
  let productionWasteKg = 0;
  let packedKg = 0;
  let fatTotal = 0;
  let fatCount = 0;

  for (const snapshot of snapshots) {
    milkReceivedLiters += snapshot.milkReceivedLiters;
    if (snapshot.averageFatUnit !== null) {
      fatTotal += snapshot.averageFatUnit;
      fatCount += 1;
    }
  }

  const packagingMap = new Map(packagingDefinitions.map((item) => [item.id, item]));

  for (const record of records) {
    carryoverMilkLiters += record.carryoverMilkLiters;
    milkWasteLiters += record.milkWasteLiters;
    if (record.averageFatUnit !== null) {
      fatTotal += record.averageFatUnit;
      fatCount += 1;
    }

    for (const output of record.outputs) {
      processedMilkLiters += output.milkUsedLiters;
      producedKg += output.producedKg;
      productionWasteKg += output.wasteKg;
    }

    for (const packaging of record.packaging) {
      const definition = packagingMap.get(packaging.packagingId);
      if (!definition) continue;
      packedKg += definition.unitWeightKg * packaging.packedCount;
    }
  }

  return {
    milkReceivedLiters,
    processedMilkLiters,
    carryoverMilkLiters,
    milkWasteLiters,
    producedKg,
    productionWasteKg,
    packedKg,
    openStockKg: Math.max(producedKg - packedKg - productionWasteKg, 0),
    averageFatUnit: fatCount > 0 ? fatTotal / fatCount : null,
    averageLitersPerKg: producedKg > 0 ? processedMilkLiters / producedKg : null,
    intakeDays: snapshots.filter((item) => item.milkReceivedLiters > 0).length,
    productionDays: records.filter((item) => item.outputs.some((output) => output.producedKg > 0)).length,
  };
}

export function summarizePackagingMix(
  records: ProductionRecord[],
  packagingDefinitions: PackagingDefinition[]
): PackagingMixRow[] {
  const map = new Map<string, PackagingMixRow>();
  const definitions = new Map(packagingDefinitions.map((item) => [item.id, item]));

  for (const record of records) {
    for (const packaging of record.packaging) {
      const definition = definitions.get(packaging.packagingId);
      if (!definition) continue;
      const current = map.get(packaging.packagingId) ?? {
        packagingId: packaging.packagingId,
        label: definition.label,
        count: 0,
        packedKg: 0,
      };
      current.count += packaging.packedCount;
      current.packedKg += packaging.packedCount * definition.unitWeightKg;
      map.set(packaging.packagingId, current);
    }
  }

  return [...map.values()].sort((left, right) => right.packedKg - left.packedKg);
}

export function buildProductionRows(
  products: ProductionProduct[],
  packaging: PackagingDefinition[],
  record: ProductionRecord | null
) {
  const outputs = record?.outputs ?? [];
  const packagingRows = record?.packaging ?? [];

  return {
    outputs: products
      .filter((product) => product.active)
      .map((product) => ({
        product,
        output: outputs.find((item) => item.productId === product.id) ?? {
          productId: product.id,
          milkUsedLiters: 0,
          producedKg: 0,
          wasteKg: 0,
          note: '',
        },
      })),
    packaging: packaging
      .filter((item) => item.active)
      .map((item) => ({
        packaging: item,
        row: packagingRows.find((packagingRow) => packagingRow.packagingId === item.id) ?? {
          packagingId: item.id,
          packedCount: 0,
        },
      })),
  };
}

export function buildBatchCode(date: string, productId: string) {
  return `${date.replaceAll('-', '')}-${productId.toUpperCase()}`;
}
