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
