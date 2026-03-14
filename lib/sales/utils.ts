import type { PackagingDefinition, ProductionPeriod, ProductionRecord } from '@/types/production';
import type { Customer, InventoryRow, SalesDispatch } from '@/types/sales';
import { buildDate, getWeekRange } from '@/lib/production/utils';

export function filterDispatchesByPeriod(
  dispatches: SalesDispatch[],
  period: ProductionPeriod,
  year: number,
  month: number,
  day: number
) {
  const dayValue = buildDate(year, month, day);
  const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
  const weekRange = getWeekRange(year, month, day);

  return dispatches.filter((dispatch) => {
    if (period === 'year') return dispatch.date.startsWith(`${year}-`);
    if (period === 'week') return dispatch.date >= weekRange.startLabel && dispatch.date <= weekRange.endLabel;
    if (period === 'month') return dispatch.date.startsWith(monthPrefix);
    return dispatch.date === dayValue;
  });
}

export function summarizeInventory(
  packagingDefinitions: PackagingDefinition[],
  productionRecords: ProductionRecord[],
  dispatches: SalesDispatch[]
): InventoryRow[] {
  const produced = new Map<string, number>();
  const sold = new Map<string, number>();

  for (const record of productionRecords) {
    for (const item of record.packaging) {
      produced.set(item.packagingId, (produced.get(item.packagingId) ?? 0) + item.packedCount);
    }
  }

  for (const dispatch of dispatches) {
    for (const item of dispatch.items) {
      sold.set(item.packagingId, (sold.get(item.packagingId) ?? 0) + item.quantity);
    }
  }

  return packagingDefinitions
    .filter((item) => item.active)
    .map((item) => {
      const producedCount = produced.get(item.id) ?? 0;
      const soldCount = sold.get(item.id) ?? 0;
      const onHandCount = producedCount - soldCount;

      return {
        packagingId: item.id,
        label: item.label,
        unitWeightKg: item.unitWeightKg,
        producedCount,
        soldCount,
        onHandCount,
        onHandKg: onHandCount * item.unitWeightKg,
      };
    })
    .filter((item) => item.producedCount > 0 || item.soldCount > 0 || item.onHandCount !== 0);
}

export function sumDispatchKg(dispatch: SalesDispatch, packagingDefinitions: PackagingDefinition[]) {
  return dispatch.items.reduce((sum, item) => {
    const definition = packagingDefinitions.find((packaging) => packaging.id === item.packagingId);
    return sum + (definition ? definition.unitWeightKg * item.quantity : 0);
  }, 0);
}

export function sumDispatchUnits(dispatch: SalesDispatch) {
  return dispatch.items.reduce((sum, item) => sum + item.quantity, 0);
}

export function buildDispatchLabel(dispatch: SalesDispatch, packagingDefinitions: PackagingDefinition[]) {
  return dispatch.items
    .map((item) => {
      const definition = packagingDefinitions.find((packaging) => packaging.id === item.packagingId);
      if (!definition || item.quantity <= 0) return null;
      return `${definition.label}: ${item.quantity}`;
    })
    .filter((item): item is string => Boolean(item))
    .join(', ');
}

export function buildCustomerRows(
  dispatches: SalesDispatch[],
  packagingDefinitions: PackagingDefinition[],
  period: ProductionPeriod
) {
  const map = new Map<string, { units: number; kg: number }>();

  for (const dispatch of dispatches) {
    const key = period === 'year' ? dispatch.date.slice(0, 7) : dispatch.date;
    const current = map.get(key) ?? { units: 0, kg: 0 };
    current.units += sumDispatchUnits(dispatch);
    current.kg += sumDispatchKg(dispatch, packagingDefinitions);
    map.set(key, current);
  }

  return [...map.entries()]
    .map(([label, item]) => ({
      label,
      units: item.units,
      kg: item.kg,
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function buildCustomerName(customer: Customer | undefined) {
  if (!customer) return '-';
  return customer.name || customer.code;
}
