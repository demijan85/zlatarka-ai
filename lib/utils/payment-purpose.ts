export function getQuarterLabel(quarter: number, language: 'sr-Cyrl' | 'en'): string {
  if (language === 'en') {
    return quarter === 1
      ? 'FIRST QUARTER'
      : quarter === 2
        ? 'SECOND QUARTER'
        : quarter === 3
          ? 'THIRD QUARTER'
          : 'FOURTH QUARTER';
  }

  return quarter === 1
    ? 'prvi kvartal'
    : quarter === 2
      ? 'drugi kvartal'
      : quarter === 3
        ? 'treci kvartal'
        : 'cetvrti kvartal';
}

export function getQuarterlyPremiumPurpose(quarter: number, year: number, language: 'sr-Cyrl' | 'en'): string {
  if (language === 'en') {
    return `Premium, ${getQuarterLabel(quarter, language)} ${year}`;
  }

  return `Premija, ${getQuarterLabel(quarter, language)} ${year}`;
}
