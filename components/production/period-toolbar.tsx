'use client';

import type { ProductionPeriod } from '@/types/production';

type PeriodToolbarProps = {
  period: ProductionPeriod;
  year: number;
  month: number;
  day: number;
  disablePeriodChange?: boolean;
  onPeriodChange: (period: ProductionPeriod) => void;
  onYearChange: (year: number) => void;
  onMonthChange: (month: number) => void;
  onDayChange: (day: number) => void;
  labels: {
    period: string;
    year: string;
    month: string;
    day: string;
    dayOption: string;
    weekOption: string;
    monthOption: string;
    yearOption: string;
  };
};

export function PeriodToolbar({
  period,
  year,
  month,
  day,
  disablePeriodChange = false,
  onPeriodChange,
  onYearChange,
  onMonthChange,
  onDayChange,
  labels,
}: PeriodToolbarProps) {
  const nowYear = new Date().getFullYear();

  return (
    <div className="control-row">
      <label className="muted">{labels.period}</label>
      <select
        className="input"
        value={period}
        disabled={disablePeriodChange}
        onChange={(event) => onPeriodChange(event.target.value as ProductionPeriod)}
      >
        <option value="day">{labels.dayOption}</option>
        <option value="week">{labels.weekOption}</option>
        <option value="month">{labels.monthOption}</option>
        <option value="year">{labels.yearOption}</option>
      </select>

      <label className="muted">{labels.year}</label>
      <select className="input" value={year} onChange={(event) => onYearChange(Number(event.target.value))}>
        {Array.from({ length: 6 }, (_, index) => nowYear - 2 + index).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>

      {period !== 'year' ? (
        <>
          <label className="muted">{labels.month}</label>
          <select className="input" value={month} onChange={(event) => onMonthChange(Number(event.target.value))}>
            {Array.from({ length: 12 }, (_, index) => index + 1).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </>
      ) : null}

      {period === 'day' || period === 'week' ? (
        <>
          <label className="muted">{labels.day}</label>
          <select className="input" value={day} onChange={(event) => onDayChange(Number(event.target.value))}>
            {Array.from({ length: 31 }, (_, index) => index + 1).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </>
      ) : null}
    </div>
  );
}
