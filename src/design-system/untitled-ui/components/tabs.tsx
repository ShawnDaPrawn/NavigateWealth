/**
 * Untitled UI v8.0 "Horizontal tabs", "Vertical tabs" and "_Tab button base".
 *
 * Figma variants → props:
 *   Type   Button brand | Button gray | Underline | Button border
 *          | Button minimal | Line (vertical)      → type
 *   Size   sm | md (36/44px buttons)               → size
 *   Full width  True                               → fullWidth (horizontal only)
 *   Orientation (the two component sets)           → orientation
 *   Icon, Badge                                    → item.icon, item.badge
 *
 * Follows the WAI-ARIA tabs pattern: one tab stop for the list, arrow keys
 * (left/right, or up/down when vertical) and Home/End move between tabs and
 * select them. Items with a `panel` get a linked tabpanel; leave it out to use
 * the tabs as in-page navigation that renders its own content.
 */
import * as React from 'react';
import { clsx } from 'clsx';

import type { UntitledIcon } from '../icons/icons';

export type TabsType =
  | 'button-brand'
  | 'button-gray'
  | 'underline'
  | 'button-border'
  | 'button-minimal'
  | 'line';

export interface TabItem {
  id: string;
  label: React.ReactNode;
  icon?: UntitledIcon;
  /** Count shown in a small pill after the label. */
  badge?: React.ReactNode;
  disabled?: boolean;
  /** Content shown while this tab is selected. */
  panel?: React.ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  value?: string;
  defaultValue?: string;
  onChange?: (id: string) => void;
  type?: TabsType;
  size?: 'sm' | 'md';
  orientation?: 'horizontal' | 'vertical';
  /** Stretch the tabs to fill the row (horizontal only). */
  fullWidth?: boolean;
  /** Names the tab list, e.g. "Account settings". */
  'aria-label'?: string;
  className?: string;
}

export function Tabs({
  items,
  value,
  defaultValue,
  onChange,
  type = 'button-brand',
  size = 'sm',
  orientation = 'horizontal',
  fullWidth = false,
  'aria-label': ariaLabel,
  className,
}: TabsProps) {
  const baseId = React.useId();
  const firstEnabled = items.find((i) => !i.disabled)?.id;
  const [own, setOwn] = React.useState(defaultValue ?? firstEnabled);
  // Fall back to the first enabled tab if the chosen one is missing or
  // disabled (e.g. after `items` changes), so the list keeps a tab stop.
  const wanted = value ?? own;
  const selected = items.some((i) => i.id === wanted && !i.disabled) ? wanted : firstEnabled;
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  // The line style is vertical-only, as in Figma.
  const vertical = orientation === 'vertical' || type === 'line';

  const select = (id: string) => {
    if (value === undefined) setOwn(id);
    onChange?.(id);
  };

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    const back = vertical ? 'ArrowUp' : 'ArrowLeft';
    const forward = vertical ? 'ArrowDown' : 'ArrowRight';
    const n = items.length;
    const step = (from: number, dir: 1 | -1) => {
      for (let k = 1; k <= n; k++) {
        const i = (((from + dir * k) % n) + n) % n;
        if (!items[i].disabled) return i;
      }
      return -1;
    };
    const targets: Record<string, () => number> = {
      [forward]: () => step(index, 1),
      [back]: () => step(index, -1),
      Home: () => step(-1, 1),
      End: () => step(n, -1),
    };
    if (!targets[e.key]) return;
    e.preventDefault();
    const next = targets[e.key]();
    if (next >= 0) {
      refs.current[next]?.focus();
      select(items[next].id);
    }
  };

  const current = items.find((i) => i.id === selected);
  const hasPanels = items.some((i) => i.panel !== undefined);

  return (
    <div
      className={clsx('uui-tabs', className)}
      data-orientation={vertical ? 'vertical' : 'horizontal'}
    >
      <div
        role="tablist"
        aria-label={ariaLabel}
        aria-orientation={vertical ? 'vertical' : 'horizontal'}
        className="uui-tabs__list"
        data-type={type}
        data-size={size}
        data-full-width={(fullWidth && !vertical) || undefined}
      >
        {items.map((item, i) => {
          const isSelected = item.id === selected;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${item.id}`}
              className="uui-tabs__tab"
              aria-selected={isSelected}
              aria-controls={hasPanels ? `${baseId}-panel-${item.id}` : undefined}
              tabIndex={isSelected ? 0 : -1}
              disabled={item.disabled}
              onClick={() => select(item.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
            >
              {Icon && <Icon />}
              <span className="uui-tabs__label">{item.label}</span>
              {item.badge !== undefined && <span className="uui-tabs__badge">{item.badge}</span>}
            </button>
          );
        })}
      </div>
      {hasPanels && current && (
        <div
          role="tabpanel"
          id={`${baseId}-panel-${current.id}`}
          aria-labelledby={`${baseId}-tab-${current.id}`}
          className="uui-tabs__panel"
          tabIndex={0}
        >
          {current.panel}
        </div>
      )}
    </div>
  );
}
