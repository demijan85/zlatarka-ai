'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { QuarterlySummarySnapshot } from '@/types/domain';
import {
  defaultVersionedConstants,
  getEffectiveConstantsForPeriod,
  sortVersions,
  type VersionedCalculationConstants,
} from '@/lib/constants/calculation';
import { localeForLanguage } from '@/lib/i18n/locale';
import { useTranslation } from '@/lib/i18n/use-translation';
import { formatIsoDateLabelForLocale, getQuarterBounds } from '@/lib/utils/date';
import { getQuarterlyExportFileName } from '@/lib/utils/export-file-names';
import { periodStartDate } from '@/lib/utils/period';

async function parseError(response: Response, fallback: string): Promise<Error> {
  try {
    const parsed = (await response.json()) as { error?: string };
    if (parsed.error) return new Error(parsed.error);
  } catch {
    // ignore parse error
  }
  return new Error(fallback);
}

async function fetchQuarterly(year: number, quarter: number): Promise<QuarterlySummarySnapshot> {
  const params = new URLSearchParams({
    year: String(year),
    quarter: String(quarter),
  });
  const response = await fetch(`/api/summaries/quarterly?${params.toString()}`);
  if (!response.ok) throw await parseError(response, 'Failed to fetch quarterly summaries');
  return response.json();
}

async function fetchConstantVersions(): Promise<VersionedCalculationConstants[]> {
  const response = await fetch('/api/constants/versions');
  if (!response.ok) throw await parseError(response, 'Failed to fetch constants versions');
  return response.json();
}

export default function QuarterlyViewPage() {
  const now = new Date();
  const { t, language } = useTranslation();
  const currentQuarter = Math.floor(now.getMonth() / 3) + 1;
  const [year, setYear] = useState(now.getFullYear());
  const [quarter, setQuarter] = useState(currentQuarter);

  const { data: snapshot, isLoading, error } = useQuery({
    queryKey: ['quarterly', year, quarter],
    queryFn: () => fetchQuarterly(year, quarter),
  });
  const rows = snapshot?.rows ?? [];

  const { data: versionsData = [] } = useQuery({
    queryKey: ['constants-versions'],
    queryFn: fetchConstantVersions,
  });

  const totalQty = rows.reduce((sum, row) => sum + row.qty, 0);
  const totalPremium = rows.reduce((sum, row) => sum + row.totalPremium, 0);
  const alignCenter = { textAlign: 'center' as const };
  const alignRight = { textAlign: 'right' as const };
  const locale = localeForLanguage(language);
  const { expectedEndDate } = useMemo(() => {
    const bounds = getQuarterBounds(year, quarter);
    return { expectedEndDate: bounds.endDate };
  }, [quarter, year]);

  const startMonth = (quarter - 1) * 3 + 1;
  const orderedVersions = useMemo(
    () => sortVersions(versionsData.length ? versionsData : [defaultVersionedConstants]),
    [versionsData]
  );
  const constantsLabel = useMemo(() => {
    const appliedVersions = new Set<string>();

    for (let monthIndex = startMonth; monthIndex < startMonth + 3; monthIndex += 1) {
      appliedVersions.add(getEffectiveConstantsForPeriod(orderedVersions, periodStartDate(year, monthIndex, 'first')).validFrom);
      appliedVersions.add(getEffectiveConstantsForPeriod(orderedVersions, periodStartDate(year, monthIndex, 'second')).validFrom);
    }

    const labels = [...appliedVersions].sort();
    if (labels.length <= 1) return labels[0] ?? defaultVersionedConstants.validFrom;
    return `${labels[0]} / ${labels[labels.length - 1]}`;
  }, [orderedVersions, startMonth, year]);

  const coveredThroughLabel = useMemo(() => {
    if (!snapshot?.coveredThroughDate) return null;
    return new Date(`${snapshot.coveredThroughDate}T00:00:00`).toLocaleDateString(locale);
  }, [locale, snapshot?.coveredThroughDate]);

  function exportXlsx() {
    const params = new URLSearchParams({
      year: String(year),
      quarter: String(quarter),
    });

    fetch(`/api/summaries/quarterly/export?${params.toString()}`)
      .then(async (response) => {
        if (!response.ok) throw await parseError(response, 'Export failed');
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = getQuarterlyExportFileName(
          year,
          quarter,
          snapshot?.coveredThroughDate ?? null,
          snapshot?.expectedEndDate ?? expectedEndDate
        );
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
          {t('quarterly.constantsUsed')}: <strong>{formatIsoDateLabelForLocale(constantsLabel, locale)}</strong>
        </div>
        {!snapshot?.isComplete && coveredThroughLabel ? (
          <div
            style={{
              borderRadius: 8,
              padding: '10px 12px',
              background: '#fff8e1',
              border: '1px solid #facc15',
              color: '#854d0e',
              fontSize: 13,
            }}
          >
            <strong>{t('quarterly.coveredThrough')}:</strong> {coveredThroughLabel}. {t('quarterly.partialData')}
          </div>
        ) : null}

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
              <th style={alignCenter}>{t('table.rb')}</th>
              <th>{t('table.lastName')}</th>
              <th>{t('table.firstName')}</th>
              <th style={alignRight}>{t('monthly.qty')}</th>
              <th style={alignCenter}>{t('quarterly.cows')}</th>
              <th style={alignRight}>{t('quarterly.premiumPerL')}</th>
              <th style={alignRight}>{t('quarterly.totalPremium')}</th>
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
                  <td style={alignCenter}>{row.serialNum}</td>
                  <td>{row.lastName}</td>
                  <td>{row.firstName}</td>
                  <td style={alignRight}>{row.qty.toFixed(0)}</td>
                  <td style={alignCenter}>{row.cows}</td>
                  <td style={alignRight}>{row.premiumPerL.toFixed(2)}</td>
                  <td style={alignRight}>{row.totalPremium.toFixed(2)}</td>
                </tr>
              ))
            )}
            {rows.length > 0 ? (
              <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                <td colSpan={3}>{t('table.totals')}</td>
                <td style={alignRight}>{totalQty.toFixed(0)}</td>
                <td />
                <td />
                <td style={alignRight}>{totalPremium.toFixed(2)}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
