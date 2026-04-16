const TAX_ON_STIMULATION_VALID_FROM = '2026-04-01';

export function formatTaxRateForLabel(value: number): string {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(2).replace(/\.?0+$/, '');
}

export function buildPriceWithTaxRateSuffix(taxPercentages: number[]): string {
  const uniqueRates = [
    ...new Set(
      taxPercentages
        .filter((value) => Number.isFinite(value) && value > 0)
        .sort((a, b) => a - b)
        .map((value) => `${formatTaxRateForLabel(value)}%`)
    ),
  ];

  if (uniqueRates.length === 0) return '';
  return `(${uniqueRates.join(' / ')})`;
}

export function buildPriceWithTaxHeaderLabel(baseLabel: string, taxPercentages: number[]): string {
  const suffix = buildPriceWithTaxRateSuffix(taxPercentages);
  if (!suffix) return baseLabel;
  return `${baseLabel} ${suffix}`;
}

export function buildPriceWithTaxMultilineLabel(
  firstLineLabel: string,
  secondLineLabel: string,
  taxPercentages: number[]
): string {
  const suffix = buildPriceWithTaxRateSuffix(taxPercentages);
  if (!suffix) return `${firstLineLabel}\n${secondLineLabel}`;
  return `${firstLineLabel}\n${secondLineLabel} ${suffix}`;
}

export function calculateDisplayedTotalPricePerLiter(totalAmount: number, qty: number): number {
  if (!Number.isFinite(totalAmount) || !Number.isFinite(qty) || qty <= 0) return 0;
  return totalAmount / qty;
}

export function calculateDisplayedTotalPricePerLiterFromComponents(
  priceWithTax: number,
  stimulation: number,
  taxPercentage: number,
  effectiveDate: string
): number {
  if (!Number.isFinite(priceWithTax) || !Number.isFinite(stimulation)) return 0;
  return effectiveDate >= TAX_ON_STIMULATION_VALID_FROM
    ? priceWithTax + stimulation * (1 + taxPercentage / 100)
    : priceWithTax + stimulation;
}
