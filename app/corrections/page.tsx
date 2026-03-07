'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CorrectionRequest, CorrectionRequestStatus } from '@/types/domain';
import { useTranslation } from '@/lib/i18n/use-translation';
import { localeForLanguage } from '@/lib/i18n/locale';
import { yearMonthFrom } from '@/lib/utils/year-month';

type StatusFilter = CorrectionRequestStatus | 'all';

async function parseError(response: Response, fallback: string): Promise<Error> {
  try {
    const parsed = (await response.json()) as { error?: string };
    if (parsed.error) return new Error(parsed.error);
  } catch {
    // ignore parse error
  }
  return new Error(fallback);
}

async function fetchCorrections(yearMonth: string, status: StatusFilter): Promise<CorrectionRequest[]> {
  const params = new URLSearchParams({ yearMonth, limit: '300' });
  if (status !== 'all') params.set('status', status);

  const response = await fetch(`/api/corrections?${params.toString()}`);
  if (!response.ok) throw await parseError(response, 'Failed to fetch correction requests');
  return response.json();
}

async function reviewCorrection(id: number, status: 'approved' | 'rejected', reviewNote: string): Promise<CorrectionRequest> {
  const response = await fetch(`/api/corrections/${id}/review`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status,
      reviewNote: reviewNote.trim() || undefined,
    }),
  });

  if (!response.ok) throw await parseError(response, 'Failed to review correction request');
  return response.json();
}

export default function CorrectionsPage() {
  const now = new Date();
  const { t, language } = useTranslation();
  const locale = localeForLanguage(language);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [status, setStatus] = useState<StatusFilter>('pending');
  const queryClient = useQueryClient();

  const yearMonth = yearMonthFrom(year, month);
  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ['corrections', yearMonth, status],
    queryFn: () => fetchCorrections(yearMonth, status),
  });

  const reviewMutation = useMutation({
    mutationFn: (payload: { id: number; status: 'approved' | 'rejected'; note: string }) =>
      reviewCorrection(payload.id, payload.status, payload.note),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['corrections', yearMonth, status] });
    },
  });

  function onReview(id: number, nextStatus: 'approved' | 'rejected') {
    const reviewNote = prompt(t('corrections.reviewNote')) ?? '';
    reviewMutation.mutate({ id, status: nextStatus, note: reviewNote });
  }

  function formatDateTime(value: string | null): string {
    if (!value) return '';
    return new Date(value).toLocaleString(locale);
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="card" style={{ padding: 12, display: 'grid', gap: 10 }}>
        <h2 style={{ margin: 0 }}>{t('corrections.title')}</h2>
        <div className="muted" style={{ fontSize: 12 }}>
          {t('corrections.subtitle')}
        </div>

        <div className="control-row">
          <select className="input" value={year} onChange={(event) => setYear(Number(event.target.value))}>
            {Array.from({ length: 6 }, (_, index) => now.getFullYear() - 2 + index).map((itemYear) => (
              <option key={itemYear} value={itemYear}>
                {itemYear}
              </option>
            ))}
          </select>

          <select className="input" value={month} onChange={(event) => setMonth(Number(event.target.value))}>
            {Array.from({ length: 12 }, (_, index) => index + 1).map((itemMonth) => (
              <option key={itemMonth} value={itemMonth}>
                {new Date(year, itemMonth - 1, 1).toLocaleDateString(locale, { month: 'long' })}
              </option>
            ))}
          </select>

          <select className="input" value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}>
            <option value="all">{t('corrections.status')} - {t('corrections.all')}</option>
            <option value="pending">{t('corrections.pending')}</option>
            <option value="approved">{t('corrections.approved')}</option>
            <option value="rejected">{t('corrections.rejected')}</option>
          </select>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('table.rb')}</th>
              <th>{t('daily.supplier')}</th>
              <th>{t('daily.day')}</th>
              <th>{t('corrections.field')}</th>
              <th>{t('corrections.current')}</th>
              <th>{t('corrections.requested')}</th>
              <th>{t('corrections.reason')}</th>
              <th>{t('corrections.status')}</th>
              <th>{t('corrections.requestedBy')}</th>
              <th>{t('corrections.requestedAt')}</th>
              <th>{t('corrections.reviewedBy')}</th>
              <th>{t('corrections.reviewedAt')}</th>
              <th>{t('suppliers.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={13}>{t('common.loading')}</td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={13} style={{ color: 'var(--danger)' }}>
                  {(error as Error).message}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={13}>{t('common.noData')}</td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={row.id}>
                  <td>{index + 1}</td>
                  <td>{row.supplierName}</td>
                  <td>{row.entryDate}</td>
                  <td>{row.fieldName}</td>
                  <td style={{ textAlign: 'right' }}>{row.currentValue ?? ''}</td>
                  <td style={{ textAlign: 'right' }}>{row.requestedValue}</td>
                  <td>{row.reason}</td>
                  <td>{t(`corrections.${row.status}`)}</td>
                  <td>{row.requestedBy}</td>
                  <td>{formatDateTime(row.requestedAt)}</td>
                  <td>{row.reviewedBy ?? ''}</td>
                  <td>{formatDateTime(row.reviewedAt)}</td>
                  <td>
                    {row.status === 'pending' ? (
                      <div className="control-row">
                        <button
                          className="btn"
                          disabled={reviewMutation.isPending}
                          onClick={() => onReview(row.id, 'approved')}
                        >
                          {t('corrections.approve')}
                        </button>
                        <button
                          className="btn danger"
                          disabled={reviewMutation.isPending}
                          onClick={() => onReview(row.id, 'rejected')}
                        >
                          {t('corrections.reject')}
                        </button>
                      </div>
                    ) : (
                      ''
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
