'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AuditLogRecord } from '@/types/domain';
import { useTranslation } from '@/lib/i18n/use-translation';
import { localeForLanguage } from '@/lib/i18n/locale';

async function parseError(response: Response, fallback: string): Promise<Error> {
  try {
    const parsed = (await response.json()) as { error?: string };
    if (parsed.error) return new Error(parsed.error);
  } catch {
    // ignore parse error
  }
  return new Error(fallback);
}

async function fetchAuditLogs(filters: {
  actionType: string;
  actorIdentifier: string;
  from: string;
  to: string;
}): Promise<AuditLogRecord[]> {
  const params = new URLSearchParams({ limit: '300' });
  if (filters.actionType.trim()) params.set('actionType', filters.actionType.trim());
  if (filters.actorIdentifier.trim()) params.set('actorIdentifier', filters.actorIdentifier.trim());
  if (filters.from.trim()) params.set('from', new Date(filters.from.trim()).toISOString());
  if (filters.to.trim()) params.set('to', new Date(filters.to.trim()).toISOString());

  const response = await fetch(`/api/audit-logs?${params.toString()}`);
  if (!response.ok) throw await parseError(response, 'Failed to fetch audit logs');
  return response.json();
}

export default function AuditLogsPage() {
  const { t, language } = useTranslation();
  const locale = localeForLanguage(language);
  const [actionType, setActionType] = useState('');
  const [actorIdentifier, setActorIdentifier] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ['audit-logs', actionType, actorIdentifier, from, to],
    queryFn: () => fetchAuditLogs({ actionType, actorIdentifier, from, to }),
  });

  function formatDateTime(value: string): string {
    return new Date(value).toLocaleString(locale);
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="card" style={{ padding: 12, display: 'grid', gap: 10 }}>
        <h2 style={{ margin: 0 }}>{t('audit.title')}</h2>
        <div className="muted" style={{ fontSize: 12 }}>
          {t('audit.subtitle')}
        </div>

        <div className="control-row">
          <input
            className="input"
            placeholder={t('audit.action')}
            value={actionType}
            onChange={(event) => setActionType(event.target.value)}
          />
          <input
            className="input"
            placeholder={t('audit.actor')}
            value={actorIdentifier}
            onChange={(event) => setActorIdentifier(event.target.value)}
          />
          <input className="input" type="datetime-local" value={from} onChange={(event) => setFrom(event.target.value)} />
          <input className="input" type="datetime-local" value={to} onChange={(event) => setTo(event.target.value)} />
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('table.rb')}</th>
              <th>{t('audit.time')}</th>
              <th>{t('audit.actor')}</th>
              <th>{t('audit.action')}</th>
              <th>{t('audit.entity')}</th>
              <th>IP</th>
              <th>{t('audit.details')}</th>
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
                <td colSpan={7}>{t('common.noData')}</td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={row.id}>
                  <td>{index + 1}</td>
                  <td>{formatDateTime(row.createdAt)}</td>
                  <td>{row.actorIdentifier}</td>
                  <td>{row.actionType}</td>
                  <td>
                    {row.entityType}
                    {row.entityId ? ` (${row.entityId})` : ''}
                  </td>
                  <td>{row.actorIp ?? ''}</td>
                  <td style={{ maxWidth: 320, whiteSpace: 'normal', wordBreak: 'break-word' }}>
                    {JSON.stringify(row.metadata ?? {})}
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
