'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { QuarterlySummaryRow } from '@/types/domain';
import { getEffectiveConstantsForPeriod, toCalculationConstants } from '@/lib/constants/calculation';
import { useConstantsStore } from '@/lib/constants/store';
import { constantsQueryValue } from '@/lib/constants/query';
import { useTranslation } from '@/lib/i18n/use-translation';
import { yearMonthFrom } from '@/lib/utils/year-month';

async function fetchQuarterly(year: number, quarter: number, constantsEncoded: string): Promise<QuarterlySummaryRow[]> {
  const params = new URLSearchParams({
    year: String(year),
    quarter: String(quarter),
    constants: constantsEncoded,
  });
  const response = await fetch(`/api/summaries/quarterly?${params.toString()}`);
  if (!response.ok) throw new Error('Failed to fetch quarterly summaries');
  return response.json();
}

export default function QuarterlyViewPage() {
  const now = new Date();
  const { t } = useTranslation();
  const currentQuarter = Math.floor(now.getMonth() / 3) + 1;
  const [year, setYear] = useState(now.getFullYear());
  const [quarter, setQuarter] = useState(currentQuarter);

  const versions = useConstantsStore((state) => state.versions);

  const startMonth = (quarter - 1) * 3 + 1;
  const currentYearMonth = useMemo(() => yearMonthFrom(year, startMonth), [year, startMonth]);
  const effectiveVersion = useMemo(
    () => getEffectiveConstantsForPeriod(versions, currentYearMonth),
    [versions, currentYearMonth]
  );
  const constants = useMemo(() => toCalculationConstants(effectiveVersion), [effectiveVersion]);
  const encoded = useMemo(() => constantsQueryValue(constants), [constants]);

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ['quarterly', year, quarter, encoded],
    queryFn: () => fetchQuarterly(year, quarter, encoded),
  });

  const totalQty = rows.reduce((sum, row) => sum + row.qty, 0);
  const totalPremium = rows.reduce((sum, row) => sum + row.totalPremium, 0);

  function exportXlsx() {
    const params = new URLSearchParams({
      year: String(year),
      quarter: String(quarter),
      constants: encoded,
    });

    fetch(`/api/summaries/quarterly/export?${params.toString()}`)
      .then(async (response) => {
        if (!response.ok) throw new Error('Export failed');
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `quarterly_summary_${year}_Q${quarter}.xlsx`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      })
      .catch((exportError) => alert((exportError as Error).message));
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="card" style={{ padding: 12, display: 'grid', gap: 10 }}>
        <h2 style={{ margin: 0 }}>{t('quarterly.title')}</h2>
        <div className="muted" style={{ fontSize: 12 }}>
          {t('quarterly.constantsUsed')}: <strong>{effectiveVersion.validFrom}</strong>
        </div>

        <div className="control-row">
          <select className="input" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {Array.from({ length: 6 }, (_, i) => now.getFullYear() - 2 + i).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <select className="input" value={quarter} onChange={(e) => setQuarter(Number(e.target.value))}>
            {[1, 2, 3, 4].map((q) => (
              <option key={q} value={q}>
                Q{q}
              </option>
            ))}
          </select>

          <button className="btn" onClick={exportXlsx}>
            {t('quarterly.export')}
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('table.rb')}</th>
              <th>{t('table.lastName')}</th>
              <th>{t('table.firstName')}</th>
              <th>{t('monthly.qty')}</th>
              <th>{t('quarterly.cows')}</th>
              <th>{t('quarterly.premiumPerL')}</th>
              <th>{t('quarterly.totalPremium')}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7}>{t('common.loading')}</td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={7} style={{ color: 'var(--danger)' }}>
                  {(error as Error).message}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7}>{t('quarterly.noData')}</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.supplierId}>
                  <td>{row.serialNum}</td>
                  <td>{row.lastName}</td>
                  <td>{row.firstName}</td>
                  <td>{row.qty.toFixed(2)}</td>
                  <td>{row.cows}</td>
                  <td>{row.premiumPerL.toFixed(2)}</td>
                  <td>{row.totalPremium.toFixed(2)}</td>
                </tr>
              ))
            )}
            {rows.length > 0 ? (
              <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                <td colSpan={3}>{t('table.totals')}</td>
                <td>{totalQty.toFixed(2)}</td>
                <td />
                <td />
                <td>{totalPremium.toFixed(2)}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
