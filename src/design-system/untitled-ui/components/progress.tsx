/**
 * Untitled UI v8.0 "Progress bar" and "Progress circle".
 *
 * Progress bar — Progress 0–100% → value; Label False | Right | Bottom → label.
 *   (The "floating" tooltip labels are not exported yet.)
 * Progress circle — Size xxs | xs | sm | md | lg → size; Shape Circle | Half circle
 *   → shape; Label → label.
 */
import * as React from 'react';
import { clsx } from 'clsx';

const clamp = (n: number) => Math.min(100, Math.max(0, n));

export interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 0–100. */
  value: number;
  label?: 'none' | 'right' | 'bottom';
  /** Accessible name; defaults to "Progress". */
  'aria-label'?: string;
}

export const ProgressBar = React.forwardRef<HTMLDivElement, ProgressBarProps>(
  ({ value, label = 'none', className, 'aria-label': ariaLabel = 'Progress', ...props }, ref) => {
    const v = clamp(value);
    return (
      <div
        ref={ref}
        className={clsx('uui-progress', className)}
        data-label={label}
        role="progressbar"
        aria-label={ariaLabel}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(v)}
        {...props}
      >
        <div className="uui-progress__track">
          <div className="uui-progress__fill" style={{ width: `${v}%` }} />
        </div>
        {label !== 'none' && (
          <span className="uui-progress__label" aria-hidden="true">
            {Math.round(v)}%
          </span>
        )}
      </div>
    );
  },
);
ProgressBar.displayName = 'ProgressBar';

// Figma: outer box, ring stroke width. The ring's centre line sits stroke/2 inside.
const CIRCLE = {
  xxs: { box: 64, stroke: 6 },
  xs: { box: 160, stroke: 16 },
  sm: { box: 200, stroke: 20 },
  md: { box: 240, stroke: 24 },
  lg: { box: 280, stroke: 28 },
} as const;

export interface ProgressCircleProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 0–100. */
  value: number;
  size?: keyof typeof CIRCLE;
  shape?: 'circle' | 'half';
  /** Caption, e.g. "Active users". Also the accessible name. */
  label?: string;
}

export const ProgressCircle = React.forwardRef<HTMLDivElement, ProgressCircleProps>(
  ({ value, size = 'md', shape = 'circle', label, className, ...props }, ref) => {
    const v = clamp(value);
    const { box, stroke } = CIRCLE[size];
    const r = box / 2 - stroke / 2;
    const c = box / 2;
    const half = shape === 'half';
    const length = half ? Math.PI * r : 2 * Math.PI * r;
    const height = half ? c + stroke / 2 : box;
    const d = half
      ? `M ${c - r} ${c} A ${r} ${r} 0 0 1 ${c + r} ${c}`
      : `M ${c} ${c - r} A ${r} ${r} 0 1 1 ${c - 0.001} ${c - r}`;
    const valueText = <span className="uui-progress-circle__value">{Math.round(v)}%</span>;

    return (
      <div
        ref={ref}
        className={clsx('uui-progress-circle', className)}
        data-size={size}
        data-shape={half ? 'half' : 'circle'}
        role="progressbar"
        aria-label={label ?? 'Progress'}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(v)}
        {...props}
      >
        <div className="uui-progress-circle__ring">
          <svg
            className="uui-progress-circle__svg"
            width={box}
            height={height}
            viewBox={`0 0 ${box} ${height}`}
            fill="none"
            aria-hidden="true"
          >
            <path className="uui-progress-circle__track" d={d} strokeWidth={stroke} />
            <path
              className="uui-progress-circle__line"
              d={d}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={length}
              strokeDashoffset={length * (1 - v / 100)}
              opacity={v === 0 ? 0 : 1}
            />
          </svg>
          <div className="uui-progress-circle__center" aria-hidden="true">
            {size !== 'xxs' && label && <span className="uui-progress-circle__label">{label}</span>}
            {valueText}
          </div>
        </div>
        {size === 'xxs' && label && (
          <span className="uui-progress-circle__label" aria-hidden="true">
            {label}
          </span>
        )}
      </div>
    );
  },
);
ProgressCircle.displayName = 'ProgressCircle';
