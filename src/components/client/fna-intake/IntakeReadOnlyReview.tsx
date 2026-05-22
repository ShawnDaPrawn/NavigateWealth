/**
 * Read-only summary of submitted client intake answers.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { FnaIntakeDomain } from '@/services/fna-intake-api';

interface IntakeReadOnlyReviewProps {
  domain: FnaIntakeDomain;
  inputs: Record<string, unknown>;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number') return value.toLocaleString();
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) {
    if (value.length === 0) return '—';
    return value
      .map((item) => (typeof item === 'object' && item !== null ? JSON.stringify(item) : String(item)))
      .join('; ');
  }
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

function flattenEntries(
  obj: Record<string, unknown>,
  prefix = '',
): Array<{ key: string; value: unknown }> {
  const rows: Array<{ key: string; value: unknown }> = [];
  for (const [key, value] of Object.entries(obj)) {
    const label = prefix ? `${prefix}.${key}` : key;
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      !(value instanceof Date)
    ) {
      rows.push(...flattenEntries(value as Record<string, unknown>, label));
    } else {
      rows.push({ key: label, value });
    }
  }
  return rows;
}

const DOMAIN_TITLES: Record<FnaIntakeDomain, string> = {
  risk: 'Risk planning discovery',
  medical: 'Medical aid discovery',
  retirement: 'Retirement discovery',
  investment: 'Investment discovery',
  tax: 'Tax planning discovery',
  estate: 'Estate planning discovery',
};

export function IntakeReadOnlyReview({ domain, inputs }: IntakeReadOnlyReviewProps) {
  const rows = flattenEntries(inputs);

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          No saved answers found for this submission.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-gray-200">
      <CardHeader>
        <CardTitle className="text-base">{DOMAIN_TITLES[domain]}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="divide-y divide-gray-100">
          {rows.map(({ key, value }) => (
            <div key={key} className="grid gap-1 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
                {key.replace(/([A-Z])/g, ' $1').replace(/\./g, ' › ')}
              </dt>
              <dd className="text-sm text-gray-900 whitespace-pre-wrap break-words">
                {formatValue(value)}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
