/**
 * Canonical formatting helpers (Phase 6c shared layer).
 *
 * The single home for currency / number / percentage / date formatting, lifted
 * verbatim from the most complete + most-used implementation (the dashboard
 * utils) so the dozens of per-file copies across the app can collapse onto one
 * tested source. Currency + number formatting is done MANUALLY (not via
 * `toLocaleString`) so thousands separators and the `R` symbol are identical in
 * every environment, independent of the Node/browser ICU locale data.
 */

/** Comma-separated thousands, preserving any decimal part. NaN → "0". */
export function formatNumber(value: number, _locale: string = 'en-ZA'): string {
  if (isNaN(value)) return '0';
  const isNeg = value < 0;
  const parts = Math.abs(value).toString().split('.');
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${isNeg ? '-' : ''}${intPart}${parts.length > 1 ? '.' + parts[1] : ''}`;
}

/** ZAR currency with the `R` symbol, comma thousands and 2 decimals. NaN → "R0.00". */
export function formatCurrency(
  value: number,
  currency: string = 'ZAR',
  _locale: string = 'en-ZA',
): string {
  if (isNaN(value)) return 'R0.00';
  const isNeg = value < 0;
  const fixed = Math.abs(value).toFixed(2);
  const [intPart, decPart] = fixed.split('.');
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const symbol = currency === 'ZAR' ? 'R' : currency;
  return `${isNeg ? '-' : ''}${symbol}${withCommas}.${decPart}`;
}

/** Compact currency for KPI cards: R1.2K / R3.4M / R5.6B. */
export function formatCurrencyCompact(
  value: number,
  currency: string = 'ZAR',
  _locale: string = 'en-ZA',
): string {
  const symbol = currency === 'ZAR' ? 'R' : currency;
  const abs = Math.abs(value);
  const isNeg = value < 0;
  const sign = isNeg ? '-' : '';

  if (abs >= 1_000_000_000) return `${sign}${symbol}${(abs / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${sign}${symbol}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${symbol}${(abs / 1_000).toFixed(1)}K`;
  return `${sign}${symbol}${abs.toFixed(0)}`;
}

/** Percentage with a fixed number of decimals (default 1): `12.3%`. */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/** Locale date (en-ZA) — accepts a Date or an ISO string; pass Intl options to override. */
export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString('en-ZA', options);
}

/** Locale time (en-ZA), defaults to 2-digit hour:minute; pass Intl options to override. */
export function formatTime(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleTimeString('en-ZA', {
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  });
}

/** "<date> <time>" using formatDate + formatTime. */
export function formatDateTime(date: string | Date): string {
  return `${formatDate(date)} ${formatTime(date)}`;
}

/** Human file size with the largest fitting unit: "1.5 KB", "2.34 MB", "0 Bytes". */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
