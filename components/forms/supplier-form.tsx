'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { supplierSchema } from '@/lib/schemas/suppliers';
import { useTranslation } from '@/lib/i18n/use-translation';
import { z } from 'zod';

const formSchema = supplierSchema;
export type SupplierFormValues = z.infer<typeof formSchema>;
type FormValues = SupplierFormValues;

const emptyValues: FormValues = {
  order_index: 0,
  first_name: '',
  last_name: '',
  phone: '',
  email: '',
  jmbg: '',
  agriculture_number: '',
  bank_account: '',
  street: '',
  city: '',
  country: 'Srbija',
  zip_code: '',
  number_of_cows: null,
  hidden_in_daily_entry: false,
};

function normalizedInitialValues(initial?: Partial<FormValues>): Partial<FormValues> {
  if (!initial) return {};

  return {
    ...initial,
    first_name: initial.first_name ?? '',
    last_name: initial.last_name ?? '',
    phone: initial.phone ?? '',
    email: initial.email ?? '',
    jmbg: initial.jmbg ?? '',
    agriculture_number: initial.agriculture_number ?? '',
    bank_account: initial.bank_account ?? '',
    street: initial.street ?? '',
    city: initial.city ?? '',
    country: initial.country ?? 'Srbija',
    zip_code: initial.zip_code ?? '',
    hidden_in_daily_entry: initial.hidden_in_daily_entry ?? false,
  };
}

export function SupplierForm({
  initial,
  onCancel,
  onSubmit,
}: {
  initial?: Partial<FormValues>;
  onCancel: () => void;
  onSubmit: (values: FormValues) => Promise<void>;
}) {
  const { t } = useTranslation();

  function labelWithRequired(label: string, required?: boolean) {
    return (
      <>
        {label}
        {required ? <span className="field-required-mark"> *</span> : null}
      </>
    );
  }

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { ...emptyValues, ...normalizedInitialValues(initial) },
  });

  useEffect(() => {
    reset({ ...emptyValues, ...normalizedInitialValues(initial) });
  }, [initial, reset]);

  return (
    <form className="supplier-form" onSubmit={handleSubmit(onSubmit)}>
      <div className="muted" style={{ fontSize: 12 }}>
        {t('supplierForm.requiredHint')}
      </div>

      <div className="supplier-form-grid supplier-form-grid-3">
        <label className="module-field">
          <span className="field-label">{labelWithRequired(t('supplierForm.order'), true)}</span>
          <input className="input" type="number" inputMode="numeric" required {...register('order_index')} />
        </label>
        <label className="module-field">
          <span className="field-label">{labelWithRequired(t('supplierForm.firstName'), true)}</span>
          <input className="input" autoFocus placeholder={t('supplierForm.firstName')} required {...register('first_name')} />
        </label>
        <label className="module-field">
          <span className="field-label">{labelWithRequired(t('supplierForm.lastName'), true)}</span>
          <input className="input" placeholder={t('supplierForm.lastName')} required {...register('last_name')} />
        </label>
      </div>

      <div className="supplier-form-grid supplier-form-grid-3">
        <label className="module-field">
          <span className="field-label">{t('supplierForm.phone')}</span>
          <input className="input" placeholder={t('supplierForm.phone')} {...register('phone')} />
        </label>
        <label className="module-field">
          <span className="field-label">{t('supplierForm.email')}</span>
          <input className="input" placeholder={t('supplierForm.email')} {...register('email')} />
        </label>
        <label className="module-field">
          <span className="field-label">{t('supplierForm.jmbg')}</span>
          <input className="input" placeholder={t('supplierForm.jmbg')} {...register('jmbg')} />
        </label>
      </div>

      <div className="supplier-form-grid supplier-form-grid-3">
        <label className="module-field">
          <span className="field-label">{t('supplierForm.bankAccount')}</span>
          <input className="input" placeholder={t('supplierForm.bankAccount')} {...register('bank_account')} />
        </label>
        <label className="module-field">
          <span className="field-label">{t('supplierForm.agricultureNumber')}</span>
          <input className="input" placeholder={t('supplierForm.agricultureNumber')} {...register('agriculture_number')} />
        </label>
        <label className="module-field">
          <span className="field-label">{t('supplierForm.cows')}</span>
          <input
            className="input"
            type="number"
            inputMode="numeric"
            placeholder={t('supplierForm.cows')}
            {...register('number_of_cows', {
              setValueAs: (value) => (value === '' ? null : Number(value)),
            })}
          />
        </label>
      </div>

      <div className="supplier-form-grid supplier-form-grid-3">
        <label className="module-field">
          <span className="field-label">{t('supplierForm.street')}</span>
          <input className="input" placeholder={t('supplierForm.street')} {...register('street')} />
        </label>
        <label className="module-field">
          <span className="field-label">{labelWithRequired(t('supplierForm.city'), true)}</span>
          <input className="input" placeholder={t('supplierForm.city')} required {...register('city')} />
        </label>
        <label className="module-field">
          <span className="field-label">{t('supplierForm.zip')}</span>
          <input className="input" placeholder={t('supplierForm.zip')} {...register('zip_code')} />
        </label>
      </div>

      {Object.keys(errors).length > 0 ? (
        <div style={{ color: 'var(--danger)', fontSize: 13 }}>{t('suppliers.fieldError')}</div>
      ) : null}

      <div className="supplier-form-actions">
        <button className="btn primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? t('common.saving') : t('suppliers.saveSupplier')}
        </button>
        <button className="btn" type="button" onClick={onCancel}>
          {t('common.cancel')}
        </button>
      </div>
    </form>
  );
}
