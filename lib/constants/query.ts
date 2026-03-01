import type { CalculationConstants } from './calculation';

export function constantsQueryValue(constants: CalculationConstants): string {
  return JSON.stringify(constants);
}
