'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { supplierSchema } from '@/lib/schemas/suppliers';
import { useTranslation } from '@/lib/i18n/use-translation';
import { z } from 'zod';

const formSchema = supplierSchema;
type FormValues = z.infer<typeof formSchema>;

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
  country: '',
  zip_code: '',
  number_of_cows: null,
};

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
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { ...emptyValues, ...initial },
  });

  useEffect(() => {
    reset({ ...emptyValues, ...initial });
  }, [initial, reset]);

  return (
    <form className="card" style={{ padding: 12, display: 'grid', gap: 10 }} onSubmit={handleSubmit(onSubmit)}>
      <div className="control-row">
        <input className="input" type="number" placeholder={t('supplierForm.order')} {...register('order_index')} />
        <input className="input" placeholder={t('supplierForm.firstName')} {...register('first_name')} />
        <input className="input" placeholder={t('supplierForm.lastName')} {...register('last_name')} />
      </div>
      <div className="control-row">
        <input className="input" placeholder={t('supplierForm.phone')} {...register('phone')} />
        <input className="input" placeholder={t('supplierForm.email')} {...register('email')} />
        <input className="input" placeholder={t('supplierForm.jmbg')} {...register('jmbg')} />
      </div>
      <div className="control-row">
        <input className="input" placeholder={t('supplierForm.bankAccount')} {...register('bank_account')} />
        <input className="input" placeholder={t('supplierForm.agricultureNumber')} {...register('agriculture_number')} />
        <input className="input" type="number" placeholder={t('supplierForm.cows')} {...register('number_of_cows')} />
      </div>
      <div className="control-row">
        <input className="input" placeholder={t('supplierForm.street')} {...register('street')} />
        <input className="input" placeholder={t('supplierForm.city')} {...register('city')} />
        <input className="input" placeholder={t('supplierForm.country')} {...register('country')} />
        <input className="input" placeholder={t('supplierForm.zip')} {...register('zip_code')} />
      </div>

      {Object.keys(errors).length > 0 ? (
        <div style={{ color: 'var(--danger)', fontSize: 13 }}>{t('suppliers.fieldError')}</div>
      ) : null}

      <div className="control-row">
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
