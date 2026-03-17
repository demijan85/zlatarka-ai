const SERBIAN_BANK_ACCOUNT_REGEX = /^\d{3}-\d{13}-\d{2}$/;

function bankAccountDigits(value: string): string {
  return value.replace(/\D/g, '').slice(0, 18);
}

export function formatSerbianBankAccountForDisplay(value: string | null | undefined): string {
  const digits = bankAccountDigits(value ?? '');
  if (!digits) return '';
  if (digits.length <= 3) return digits;
  if (digits.length <= 16) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 16)}-${digits.slice(16, 18)}`;
}

export function normalizeSerbianBankAccount(value: string | null | undefined): string {
  const digits = bankAccountDigits(value ?? '');
  if (!digits) return '';
  if (digits.length < 6) return formatSerbianBankAccountForDisplay(digits);

  const bank = digits.slice(0, 3);
  const control = digits.slice(-2);
  const middle = digits.slice(3, -2).padStart(13, '0');
  return `${bank}-${middle}-${control}`;
}

export function isValidSerbianBankAccount(value: string | null | undefined): boolean {
  const normalized = normalizeSerbianBankAccount(value);
  return normalized === '' || SERBIAN_BANK_ACCOUNT_REGEX.test(normalized);
}
