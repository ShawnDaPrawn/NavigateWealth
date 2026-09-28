/**
 * Untitled UI v8.0 "Breadcrumbs" and "_Breadcrumb button base".
 *
 * Figma variants → props:
 *   Divider  Chevron | Slash                 → divider
 *   Type     Text | Button                   → type
 *   Current  True                            → the last item (aria-current="page")
 *   Icon     True                            → item.icon (e.g. HomeLine, icon-only)
 * The "Text with line" and "Account dropdowns" types are not exported yet.
 *
 * A `nav` landmark with an ordered list. Items with `href` are links; set
 * `maxItems` to collapse the middle of a long trail into "…".
 */
import * as React from 'react';
import { clsx } from 'clsx';

import { ChevronRight, type UntitledIcon } from '../icons/icons';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  /** Leading icon. With `iconOnly`, the label becomes the accessible name. */
  icon?: UntitledIcon;
  iconOnly?: boolean;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}

export interface BreadcrumbsProps extends React.HTMLAttributes<HTMLElement> {
  items: BreadcrumbItem[];
  divider?: 'chevron' | 'slash';
  type?: 'text' | 'button';
  /** Show at most this many items; the middle ones collapse to "…". */
  maxItems?: number;
}

export function Breadcrumbs({
  items,
  divider = 'chevron',
  type = 'text',
  maxItems,
  className,
  'aria-label': ariaLabel = 'Breadcrumb',
  ...props
}: BreadcrumbsProps) {
  let shown: (BreadcrumbItem | 'ellipsis')[] = items;
  if (maxItems && maxItems >= 2 && items.length > maxItems) {
    // Keep the first item and the last (maxItems - 1), as in the Figma "..." example.
    shown = [items[0], 'ellipsis', ...items.slice(items.length - (maxItems - 1))];
  }

  return (
    <nav
      className={clsx('uui-breadcrumbs', className)}
      aria-label={ariaLabel}
      data-type={type}
      {...props}
    >
      <ol className="uui-breadcrumbs__list">
        {shown.map((item, i) => {
          const last = i === shown.length - 1;
          return (
            <li
              key={item === 'ellipsis' ? '…' : `${i}-${item.label}`}
              className="uui-breadcrumbs__item"
            >
              {item === 'ellipsis' ? (
                <span className="uui-breadcrumbs__crumb" aria-hidden="true">
                  …
                </span>
              ) : (
                <Crumb item={item} current={last} />
              )}
              {!last && (
                <span className="uui-breadcrumbs__divider" aria-hidden="true">
                  {divider === 'slash' ? '/' : <ChevronRight />}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function Crumb({ item, current }: { item: BreadcrumbItem; current: boolean }) {
  const Icon = item.icon;
  const content = (
    <>
      {Icon && <Icon />}
      {!item.iconOnly && <span>{item.label}</span>}
    </>
  );
  const common = {
    className: 'uui-breadcrumbs__crumb',
    'aria-current': current ? ('page' as const) : undefined,
    'aria-label': item.iconOnly ? item.label : undefined,
  };
  return item.href && !current ? (
    <a {...common} href={item.href} onClick={item.onClick}>
      {content}
    </a>
  ) : (
    <span {...common}>{content}</span>
  );
}
