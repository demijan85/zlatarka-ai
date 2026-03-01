import { defaultCalculationConstants, normalizeConstants, type CalculationConstants } from './calculation';

export function constantsFromSearchParams(params: URLSearchParams): CalculationConstants {
  const raw = params.get('constants');
  if (!raw) return defaultCalculationConstants;

  try {
    const parsed = JSON.parse(raw) as unknown;
    return normalizeConstants(parsed);
  } catch {
    return defaultCalculationConstants;
  }
}
