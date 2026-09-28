/**
 * Untitled UI v8.0 "Dropdown menu", its list items, header and footer, and
 * "Context menu".
 *
 * Figma → components:
 *   Dropdown menu (Button simple / advanced, Icon, Account…)  → Dropdown (any trigger)
 *   _Dropdown menu list item                                  → DropdownItem
 *     Icon / Shortcut / State=Disabled                        → icon / shortcut / disabled
 *   Divider                                                   → DropdownDivider
 *   _Dropdown menu header (Avatar group, Header, Subheading)  → DropdownHeader
 *   _Dropdown menu footer (Text, Button)                      → DropdownFooter
 *   Context menu                                              → ContextMenu
 *
 * Follows the WAI-ARIA menu-button pattern: the trigger opens the menu with a
 * click, Enter, Space or the arrow keys; focus moves into the menu; the arrow
 * keys, Home and End move between items; Escape closes it and returns focus
 * to the trigger. Choosing an item calls its `onSelect` and closes the menu.
 */
import * as React from 'react';
import { clsx } from 'clsx';

import type { UntitledIcon } from '../icons/icons';
import { useDismiss } from './use-dismiss';

const CloseContext = React.createContext<() => void>(() => {});

const ITEM_SELECTOR = '[role="menuitem"]:not(:disabled)';

function focusItem(menu: HTMLElement | null, which: 'first' | 'last' | 'next' | 'prev') {
  if (!menu) return;
  const items = Array.from(menu.querySelectorAll<HTMLElement>(ITEM_SELECTOR));
  if (!items.length) return;
  const at = items.indexOf(document.activeElement as HTMLElement);
  const i =
    which === 'first'
      ? 0
      : which === 'last'
        ? items.length - 1
        : which === 'next'
          ? (at + 1) % items.length
          : (at - 1 + items.length) % items.length;
  items[i].focus();
}

export interface DropdownMenuProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

/** The menu panel on its own: 240px wide, white, 8px radius, shadow-lg. */
export const DropdownMenu = React.forwardRef<HTMLDivElement, DropdownMenuProps>(
  ({ className, onKeyDown, children, ...props }, ref) => (
    <div
      ref={ref}
      role="menu"
      className={clsx('uui-dropdown', className)}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        if (e.defaultPrevented) return;
        const map: Record<string, 'first' | 'last' | 'next' | 'prev'> = {
          ArrowDown: 'next',
          ArrowUp: 'prev',
          Home: 'first',
          End: 'last',
        };
        if (map[e.key]) {
          e.preventDefault();
          focusItem(e.currentTarget, map[e.key]);
        }
      }}
      {...props}
    >
      {children}
    </div>
  ),
);
DropdownMenu.displayName = 'DropdownMenu';

export interface DropdownItemProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'onSelect'
> {
  icon?: UntitledIcon;
  /** Keyboard hint on the right, e.g. "⌘K". */
  shortcut?: React.ReactNode;
  /** Called when the item is chosen; the menu then closes. */
  onSelect?: () => void;
}

export const DropdownItem = React.forwardRef<HTMLButtonElement, DropdownItemProps>(
  ({ icon: Icon, shortcut, onSelect, onClick, className, children, ...props }, ref) => {
    const close = React.useContext(CloseContext);
    return (
      <button
        ref={ref}
        type="button"
        role="menuitem"
        tabIndex={-1}
        className={clsx('uui-dropdown__item', className)}
        onClick={(e) => {
          onClick?.(e);
          if (e.defaultPrevented) return;
          onSelect?.();
          close();
        }}
        {...props}
      >
        <span className="uui-dropdown__item-content">
          {Icon && <Icon />}
          <span className="uui-dropdown__item-label">{children}</span>
          {shortcut && <kbd className="uui-dropdown__shortcut">{shortcut}</kbd>}
        </span>
      </button>
    );
  },
);
DropdownItem.displayName = 'DropdownItem';

export function DropdownDivider() {
  return <div role="separator" className="uui-dropdown__divider" />;
}

/** Top section with a bottom border, e.g. an AvatarLabelGroup for an account menu. */
export function DropdownHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx('uui-dropdown__header', className)} {...props} />;
}

/** Bottom section with a top border, e.g. "© Untitled UI" and a version number. */
export function DropdownFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx('uui-dropdown__footer', className)} {...props} />;
}

export interface DropdownProps {
  /** The element that opens the menu, usually a Button. It must accept a ref. */
  trigger: React.ReactElement;
  children: React.ReactNode;
  /** Align the menu with the trigger's left (start) or right (end) edge. */
  align?: 'start' | 'end';
  /** Accessible name for the menu; defaults to being labelled by the trigger. */
  'aria-label'?: string;
  className?: string;
}

type TriggerProps = React.HTMLAttributes<HTMLElement> & { ref?: React.Ref<HTMLElement> };

export function Dropdown({
  trigger,
  children,
  align = 'start',
  className,
  'aria-label': ariaLabel,
}: DropdownProps) {
  const [open, setOpen] = React.useState(false);
  const focusOn = React.useRef<'first' | 'last'>('first');
  const rootRef = React.useRef<HTMLDivElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLElement | null>(null);
  // Keep a ref the caller put on the trigger working alongside ours (React 18).
  const callerRef = (trigger as unknown as { ref?: React.Ref<HTMLElement> }).ref;
  const autoId = React.useId();
  const triggerProps = trigger.props as TriggerProps;
  const triggerId = triggerProps.id ?? `${autoId}-trigger`;
  const menuId = `${autoId}-menu`;

  const close = React.useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }, []);
  // Escape returns focus to the trigger; an outside click leaves it where the user put it.
  useDismiss(open, [rootRef], (reason) => close(reason === 'escape'));

  React.useEffect(() => {
    if (open) focusItem(menuRef.current, focusOn.current);
  }, [open]);

  const show = (which: 'first' | 'last') => {
    focusOn.current = which;
    setOpen(true);
  };

  const clonedTrigger = React.cloneElement(trigger as React.ReactElement<TriggerProps>, {
    ref: (node: HTMLElement | null) => {
      triggerRef.current = node;
      if (typeof callerRef === 'function') callerRef(node);
      else if (callerRef) (callerRef as React.MutableRefObject<HTMLElement | null>).current = node;
    },
    id: triggerId,
    'aria-haspopup': 'menu',
    'aria-expanded': open,
    'aria-controls': open ? menuId : undefined,
    onClick: (e: React.MouseEvent<HTMLElement>) => {
      triggerProps.onClick?.(e);
      if (open) setOpen(false);
      else show('first');
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
      triggerProps.onKeyDown?.(e);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        show(e.key === 'ArrowDown' ? 'first' : 'last');
      }
    },
  });

  return (
    <div ref={rootRef} className={clsx('uui-dropdown-anchor', className)} data-align={align}>
      {clonedTrigger}
      {open && (
        <CloseContext.Provider value={close}>
          <DropdownMenu
            ref={menuRef}
            id={menuId}
            aria-labelledby={ariaLabel ? undefined : triggerId}
            aria-label={ariaLabel}
            className="uui-dropdown--popover"
            onKeyDown={(e) => {
              if (e.key === 'Tab') close(false);
            }}
          >
            {children}
          </DropdownMenu>
        </CloseContext.Provider>
      )}
    </div>
  );
}

export interface ContextMenuProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The menu items, shown at the pointer on right-click (or Shift+F10 / the Menu key). */
  menu: React.ReactNode;
  'aria-label'?: string;
}

export function ContextMenu({
  menu,
  children,
  className,
  onContextMenu,
  onKeyDown,
  'aria-label': ariaLabel = 'Context menu',
  ...props
}: ContextMenuProps) {
  const [at, setAt] = React.useState<{ x: number; y: number } | null>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const returnTo = React.useRef<HTMLElement | null>(null);

  const close = React.useCallback((refocus = true) => {
    setAt(null);
    if (refocus) returnTo.current?.focus();
  }, []);
  useDismiss(at !== null, [menuRef], (reason) => close(reason === 'escape'));

  React.useEffect(() => {
    if (at) focusItem(menuRef.current, 'first');
  }, [at]);

  const openAt = (x: number, y: number) => {
    returnTo.current = document.activeElement as HTMLElement | null;
    setAt({ x, y });
  };

  return (
    <div
      ref={rootRef}
      className={clsx('uui-context-menu-area', className)}
      onContextMenu={(e) => {
        onContextMenu?.(e);
        if (e.defaultPrevented) return;
        e.preventDefault();
        openAt(e.clientX, e.clientY);
      }}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        if (e.defaultPrevented || at) return;
        if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
          e.preventDefault();
          const r = (e.target as HTMLElement).getBoundingClientRect();
          openAt(r.left, r.bottom);
        }
      }}
      {...props}
    >
      {children}
      {at && (
        <CloseContext.Provider value={close}>
          <DropdownMenu
            ref={menuRef}
            aria-label={ariaLabel}
            className="uui-dropdown--context"
            style={{ left: at.x, top: at.y }}
            onKeyDown={(e) => {
              if (e.key === 'Tab') close(false);
            }}
          >
            {menu}
          </DropdownMenu>
        </CloseContext.Provider>
      )}
    </div>
  );
}
