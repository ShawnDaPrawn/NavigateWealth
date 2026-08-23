/**
 * Publications utils — newsletter subscriber derivations, Excel
 * import/export, and spreadsheet parsing. One slice of the former
 * monolithic utils.tsx (re-exported by ../utils.tsx).
 */
import type { Subscriber, SubscriberStatus, UnsubTimeRange } from '../types';
import { UNSUB_TIME_RANGE_DAYS } from '../constants';

const MAX_SUBSCRIBER_IMPORT_ROWS = 500;
const MAX_SUBSCRIBER_IMPORT_BYTES = 1024 * 1024;

// ============================================================================
// NEWSLETTER SUBSCRIBER UTILITIES (§7.1 — pure derivation functions)
// ============================================================================

/**
 * Derive subscriber status from confirmed + active flags.
 * §7.1 — pure utility, never inline in JSX.
 */
export function deriveSubscriberStatus(sub: Subscriber): SubscriberStatus {
  if (!sub.confirmed) return 'pending';
  if (!sub.active) return 'unsubscribed';
  return 'active';
}

/**
 * Derive a human-readable unsubscribe reason.
 */
export function deriveUnsubscribeReason(sub: Subscriber): string {
  if (sub.removedBy === 'admin') return 'Removed by Admin';
  if (sub.unsubscribedAt && !sub.removedBy) return 'Self-Unsubscribed';
  return 'Unsubscribed';
}

/**
 * Format a date string using en-ZA locale (§8.3 — dd MMM yyyy).
 * Returns '—' for null/undefined/invalid inputs.
 */
export function formatDateZA(d: string | null | undefined): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-ZA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

/**
 * Filter subscribers by time range (unsubscribed view).
 */
export function filterByTimeRange(subscribers: Subscriber[], range: UnsubTimeRange): Subscriber[] {
  if (range === 'all') return subscribers;
  const days = UNSUB_TIME_RANGE_DAYS[range];
  if (!days) return subscribers;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return subscribers.filter((s) => s.unsubscribedAt && new Date(s.unsubscribedAt) >= cutoff);
}

/**
 * Export unsubscribed subscribers to an Excel file.
 * Extracted from inline JSX onClick (§7 — no business logic in UI).
 */
export function exportUnsubscribedToExcel(
  subscribers: Subscriber[],
  timeRange: UnsubTimeRange,
): void {
  // Dynamic import — xlsx is only needed at export time
  import('xlsx').then((XLSX) => {
    const exportData = subscribers.map((s) => ({
      Email: s.email,
      'First Name': s.firstName || '',
      Surname: s.surname || '',
      Source: s.source || '',
      Reason: s.removedBy === 'admin' ? 'Admin Removed' : 'Self-Unsubscribed',
      'Subscribed Date': s.subscribedAt ? new Date(s.subscribedAt).toLocaleDateString('en-ZA') : '',
      'Unsubscribed Date': s.unsubscribedAt
        ? new Date(s.unsubscribedAt).toLocaleDateString('en-ZA')
        : '',
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    ws['!cols'] = [
      { wch: 32 },
      { wch: 16 },
      { wch: 16 },
      { wch: 18 },
      { wch: 20 },
      { wch: 16 },
      { wch: 18 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Unsubscribed');
    const rangeLabel = timeRange === 'all' ? 'all-time' : timeRange;
    XLSX.writeFile(
      wb,
      `unsubscribed-subscribers-${rangeLabel}-${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  });
}

/**
 * Generate and download the subscriber Excel template.
 */
export function downloadSubscriberExcelTemplate(): void {
  import('xlsx').then((XLSX) => {
    const templateData = [
      { Email: 'john.smith@example.com', 'First Name/s': 'John', Surname: 'Smith' },
      { Email: 'jane.doe@example.com', 'First Name/s': 'Jane', Surname: 'Doe' },
    ];
    const ws = XLSX.utils.json_to_sheet(templateData, {
      header: ['Email', 'First Name/s', 'Surname'],
    });
    ws['!cols'] = [{ wch: 32 }, { wch: 20 }, { wch: 20 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Subscribers');
    XLSX.writeFile(wb, 'navigate-wealth-newsletter-subscribers-template.xlsx');
  });
}

/**
 * Parse a subscriber spreadsheet file (.xlsx, .xls, .csv).
 * Returns parsed rows via callback.
 */
export function parseSubscriberFile(
  file: File,
  onParsed: (rows: { email: string; firstName: string; surname: string }[]) => void,
): void {
  if (file.size > MAX_SUBSCRIBER_IMPORT_BYTES) {
    onParsed([]);
    return;
  }

  const reader = new FileReader();

  reader.onload = (ev) => {
    try {
      import('xlsx').then((XLSX) => {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array', sheetRows: MAX_SUBSCRIBER_IMPORT_ROWS + 2 });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][];

        if (rawRows.length < 2 || rawRows.length > MAX_SUBSCRIBER_IMPORT_ROWS + 1) {
          onParsed([]);
          return;
        }

        const normalise = (key: string) =>
          key
            .trim()
            .toLowerCase()
            .replace(/[^a-z]/g, '');
        const headers = rawRows[0].map((key) => normalise(String(key || '')));

        const results: { email: string; firstName: string; surname: string }[] = [];

        for (const row of rawRows.slice(1)) {
          const mapped: Record<string, string> = {};
          headers.forEach((header, index) => {
            if (header) mapped[header] = String(row[index] ?? '').trim();
          });

          const email = mapped['email'] || mapped['emailaddress'] || '';
          const firstName = mapped['firstnames'] || mapped['firstname'] || mapped['name'] || '';
          const surname = mapped['surname'] || mapped['lastname'] || '';

          if (email && email.includes('@')) {
            results.push({ email: email.toLowerCase(), firstName, surname });
          }
        }

        onParsed(results);
      });
    } catch {
      onParsed([]);
    }
  };

  reader.readAsArrayBuffer(file);
}
