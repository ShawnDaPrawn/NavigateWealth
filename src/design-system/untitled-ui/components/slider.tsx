/**
 * Untitled UI v8.0 "Slider".
 *
 * Figma variants → props:
 *   Label   False | Bottom | Top floating      → label: 'none' | 'bottom' | 'top-floating'
 *   Handles one | two                          → a number or a [min, max] pair as the value
 *   State   Focused                            → keyboard focus
 *
 * Each handle is a real `<input type="range">`, so the arrow keys, Page Up/Down,
 * Home/End, forms and screen readers all work as they do natively. With two
 * handles, neither can pass the other.
 */
import * as React from 'react';
import { clsx } from 'clsx';

type SliderValue = number | [number, number];

export interface SliderProps<V extends SliderValue = SliderValue> extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'defaultValue' | 'onChange'
> {
  value?: V;
  defaultValue?: V;
  onChange?: (value: V) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: 'none' | 'bottom' | 'top-floating';
  /** Text for a handle's label and its aria-valuetext; defaults to "N%". */
  formatValue?: (value: number) => string;
  disabled?: boolean;
  /** Names the slider; two handles become "<label>, minimum" / "<label>, maximum". */
  'aria-label'?: string;
  /** Submits the value(s) under this name. */
  name?: string;
}

const defaultFormat = (v: number) => `${v}%`;

export function Slider<V extends SliderValue>({
  value,
  defaultValue,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  label = 'none',
  formatValue = defaultFormat,
  disabled,
  name,
  className,
  style,
  'aria-label': ariaLabel = 'Slider',
  ...props
}: SliderProps<V>) {
  const [own, setOwn] = React.useState<SliderValue>(defaultValue ?? min);
  const current = (value ?? own) as SliderValue;
  const values = typeof current === 'number' ? [current] : current;
  const range = values.length === 2;

  const pct = (v: number) => (max === min ? 0 : ((v - min) / (max - min)) * 100);
  const update = (i: number, raw: number) => {
    let next: SliderValue;
    if (range) {
      const pair: [number, number] = [values[0], values[1]];
      pair[i] = i === 0 ? Math.min(raw, pair[1]) : Math.max(raw, pair[0]);
      next = pair;
    } else {
      next = raw;
    }
    if (value === undefined) setOwn(next);
    onChange?.(next as V);
  };

  const from = range ? pct(values[0]) : 0;
  const to = pct(values[values.length - 1]);

  return (
    <div
      className={clsx('uui-slider', className)}
      data-label={label}
      data-range={range || undefined}
      data-disabled={disabled || undefined}
      style={{ ...style, '--_from': from, '--_to': to } as React.CSSProperties}
      {...props}
    >
      <div className="uui-slider__rail">
        <div className="uui-slider__track">
          <div className="uui-slider__fill" />
        </div>
        {values.map((v, i) => (
          <React.Fragment key={i}>
            <input
              type="range"
              className="uui-slider__input"
              min={min}
              max={max}
              step={step}
              value={v}
              name={name}
              disabled={disabled}
              aria-label={range ? `${ariaLabel}, ${i === 0 ? 'minimum' : 'maximum'}` : ariaLabel}
              aria-valuetext={formatValue(v)}
              // The lower handle sits on top when both are at the maximum, so it can move back.
              data-on-top={(range && i === 0 && v >= max) || undefined}
              onChange={(e) => update(i, Number(e.currentTarget.value))}
            />
            {label !== 'none' && (
              <span
                className="uui-slider__label"
                aria-hidden="true"
                style={{ '--_at': pct(v) } as React.CSSProperties}
              >
                {formatValue(v)}
              </span>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
