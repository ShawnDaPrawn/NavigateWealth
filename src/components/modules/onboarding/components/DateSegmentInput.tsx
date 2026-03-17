/**
 * DateSegmentInput
 *
 * A segmented YYYY / MM / DD date input that auto-advances focus
 * as the user completes each segment. Designed for financial onboarding
 * where date-of-birth entry must be fast and frustration-free.
 *
 * The native `<input type="date">` forces users to click between
 * segments — this component eliminates that friction entirely.
 *
 * Guidelines refs: §8.3 (form patterns), §5.3 (centralised constants)
 */

import React, { useRef, useCallback } from 'react';

interface DateSegmentInputProps {
  /** ISO date string: "YYYY-MM-DD" or "" */
  value: string;
  /** Called with an ISO date string when all segments are filled */
  onChange: (isoDate: string) => void;
  id?: string;
  className?: string;
  disabled?: boolean;
}

/** Clamp a numeric string to [min, max], preserving leading zeros. */
function clampStr(raw: string, min: number, max: number): string {
  const n = parseInt(raw, 10);
  if (isNaN(n)) return raw;
  if (n > max) return String(max).padStart(raw.length, '0');
  if (n < min && raw.length >= String(max).length) return String(min).padStart(raw.length, '0');
  return raw;
}

export function DateSegmentInput({ value, onChange, id, className = '', disabled }: DateSegmentInputProps) {
  const yearRef = useRef<HTMLInputElement>(null);
  const monthRef = useRef<HTMLInputElement>(null);
  const dayRef = useRef<HTMLInputElement>(null);

  // Parse existing ISO value into segments
  const parts = (value || '').split('-');
  const year = parts[0] || '';
  const month = parts[1] || '';
  const day = parts[2] || '';

  const emitDate = useCallback(
    (y: string, m: string, d: string) => {
      // Only emit a full ISO date when all three segments have content
      if (y && m && d) {
        const paddedM = m.padStart(2, '0');
        const paddedD = d.padStart(2, '0');
        onChange(`${y}-${paddedM}-${paddedD}`);
      } else if (!y && !m && !d) {
        onChange('');
      } else {
        // Partial — store as-is so we don't lose partial input
        const partial = [
          y || '',
          m ? m.padStart(2, '0') : '',
          d ? d.padStart(2, '0') : '',
        ].join('-');
        onChange(partial);
      }
    },
    [onChange],
  );

  const handleYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\D/g, '').slice(0, 4);
    if (v.length === 4) {
      // Auto-advance to month
      monthRef.current?.focus();
    }
    emitDate(v, month, day);
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\D/g, '').slice(0, 2);
    v = clampStr(v, 1, 12);
    if (v.length === 2) {
      dayRef.current?.focus();
    }
    emitDate(year, v, day);
  };

  const handleDayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\D/g, '').slice(0, 2);
    v = clampStr(v, 1, 31);
    if (v.length === 2) {
      // Blur to signal completion
      dayRef.current?.blur();
    }
    emitDate(year, month, v);
  };

  // Backspace on empty segment → go back
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    prevRef: React.RefObject<HTMLInputElement | null> | null,
  ) => {
    if (e.key === 'Backspace' && (e.target as HTMLInputElement).value === '' && prevRef) {
      prevRef.current?.focus();
    }
  };

  const segmentBase =
    'text-center bg-transparent outline-none text-sm font-medium text-gray-900 placeholder:text-gray-400 placeholder:font-normal';

  return (
    <div
      className={`flex items-center gap-0 mt-1.5 h-11 bg-white border border-gray-300 shadow-sm rounded-md px-3
        focus-within:border-[#6d28d9] focus-within:ring-2 focus-within:ring-[#6d28d9]/20
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      id={id}
    >
      {/* Year */}
      <input
        ref={yearRef}
        type="text"
        inputMode="numeric"
        placeholder="YYYY"
        value={year}
        onChange={handleYearChange}
        onKeyDown={(e) => handleKeyDown(e, null)}
        maxLength={4}
        disabled={disabled}
        className={`${segmentBase} w-[3.2rem]`}
        aria-label="Year"
      />
      <span className="text-gray-400 text-sm font-medium select-none">/</span>
      {/* Month */}
      <input
        ref={monthRef}
        type="text"
        inputMode="numeric"
        placeholder="MM"
        value={month}
        onChange={handleMonthChange}
        onKeyDown={(e) => handleKeyDown(e, yearRef)}
        maxLength={2}
        disabled={disabled}
        className={`${segmentBase} w-[2rem]`}
        aria-label="Month"
      />
      <span className="text-gray-400 text-sm font-medium select-none">/</span>
      {/* Day */}
      <input
        ref={dayRef}
        type="text"
        inputMode="numeric"
        placeholder="DD"
        value={day}
        onChange={handleDayChange}
        onKeyDown={(e) => handleKeyDown(e, monthRef)}
        maxLength={2}
        disabled={disabled}
        className={`${segmentBase} w-[2rem]`}
        aria-label="Day"
      />
    </div>
  );
}
