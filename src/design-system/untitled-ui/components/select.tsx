/**
 * Untitled UI v8.0 "Select" and "Multi-select".
 *
 * Figma variants → props:
 *   Size        sm | md | lg                           → size (36 / 40 / 44px)
 *   Type        Default | Icon leading | Avatar leading
 *               | Supporting text                      → option.icon / option.avatarSrc /
 *                                                        option.supportingText, icon
 *   State       Placeholder / Filled                   → value
 *               Focused / Open                         → keyboard focus, the open menu
 *               Disabled                               → disabled
 *   Destructive True                                   → invalid (hint shows as the error)
 *   Label, Hint text, Required *, Help icon            → label, hint, required, helpText
 *
 * Follows the WAI-ARIA "select-only combobox" pattern: focus stays on the
 * trigger, the highlighted option is announced through aria-activedescendant,
 * and the arrow keys, Home/End, Enter/Space, Escape and type-to-find work as
 * they do in a native select. Pass `name` to submit the value with a form.
 */
import * as React from 'react';
import { clsx } from 'clsx';

import { AlertCircle, Check, ChevronDown, HelpCircle, type UntitledIcon } from '../icons/icons';
import { nextEnabled, useDismiss } from './use-dismiss';

export type SelectSize = 'sm' | 'md' | 'lg';

export interface SelectOption {
  value: string;
  label: string;
  /** Grey text after the label ("@username" in the Figma examples). */
  supportingText?: string;
  icon?: UntitledIcon;
  avatarSrc?: string;
  disabled?: boolean;
}

interface SelectCommonProps {
  options: SelectOption[];
  size?: SelectSize;
  label?: React.ReactNode;
  /** Shown under the field; becomes the error message when `invalid`. */
  hint?: React.ReactNode;
  /** The "?" icon's tooltip text. */
  helpText?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  /** Leading icon shown in the trigger when the chosen option has none. */
  icon?: UntitledIcon;
  /** Submits the value(s) as hidden inputs under this name. */
  name?: string;
  id?: string;
  className?: string;
  'aria-label'?: string;
}

export interface SelectProps extends SelectCommonProps {
  value?: string | null;
  defaultValue?: string | null;
  onChange?: (value: string) => void;
}

export interface MultiSelectProps extends SelectCommonProps {
  value?: string[];
  defaultValue?: string[];
  onChange?: (value: string[]) => void;
}

interface SelectRootProps extends SelectCommonProps {
  multiple: boolean;
  selected: string[];
  onPick: (value: string) => void;
}

function OptionContent({ option }: { option: SelectOption }) {
  const Icon = option.icon;
  return (
    <>
      {Icon && <Icon className="uui-select__option-icon" />}
      {!Icon && option.avatarSrc && (
        <img className="uui-select__avatar" src={option.avatarSrc} alt="" />
      )}
      <span className="uui-select__text">
        <span className="uui-select__label">{option.label}</span>
        {option.supportingText && (
          <span className="uui-select__supporting">{option.supportingText}</span>
        )}
      </span>
    </>
  );
}

function SelectRoot({
  options,
  size = 'md',
  label,
  hint,
  helpText,
  placeholder = 'Select',
  required,
  disabled,
  invalid,
  icon: Icon,
  name,
  id,
  className,
  multiple,
  selected,
  onPick,
  'aria-label': ariaLabel,
}: SelectRootProps) {
  const autoId = React.useId();
  const triggerId = id ?? autoId;
  const labelId = `${triggerId}-label`;
  const hintId = `${triggerId}-hint`;
  const listId = `${triggerId}-listbox`;
  const optionId = (i: number) => `${triggerId}-option-${i}`;

  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(-1);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);
  const typeahead = React.useRef({ text: '', at: 0 });
  const disabledFlags = options.map((o) => !!o.disabled);

  const close = React.useCallback(() => setOpen(false), []);
  useDismiss(open, [rootRef], close);

  const openMenu = (highlight?: number) => {
    const firstSelected = options.findIndex((o) => selected.includes(o.value));
    setActive(
      highlight ?? (firstSelected >= 0 ? firstSelected : nextEnabled(disabledFlags, -1, 1)),
    );
    setOpen(true);
  };

  React.useEffect(() => {
    if (!open || active < 0) return;
    listRef.current?.children[active]?.scrollIntoView?.({ block: 'nearest' });
  }, [open, active]);

  const pick = (i: number) => {
    const option = options[i];
    if (!option || option.disabled) return;
    onPick(option.value);
    if (!multiple) setOpen(false);
  };

  const findByText = (char: string) => {
    const t = typeahead.current;
    const now = Date.now();
    t.text = now - t.at > 500 ? char : t.text + char;
    t.at = now;
    const start = active < 0 ? 0 : active + (t.text.length === 1 ? 1 : 0);
    for (let k = 0; k < options.length; k++) {
      const i = (start + k) % options.length;
      if (!options[i].disabled && options[i].label.toLowerCase().startsWith(t.text)) return i;
    }
    return -1;
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const key = e.key;
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(key)) {
        e.preventDefault();
        openMenu();
      } else if (key.length === 1 && /\S/.test(key)) {
        const i = findByText(key.toLowerCase());
        if (i >= 0) openMenu(i);
      }
      return;
    }
    switch (key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        e.preventDefault();
        const next = nextEnabled(disabledFlags, active, key === 'ArrowDown' ? 1 : -1);
        if (next >= 0) setActive(next);
        break;
      }
      case 'Home':
      case 'End': {
        e.preventDefault();
        const next =
          key === 'Home'
            ? nextEnabled(disabledFlags, -1, 1)
            : nextEnabled(disabledFlags, options.length, -1);
        if (next >= 0) setActive(next);
        break;
      }
      case 'Enter':
      case ' ':
        e.preventDefault();
        pick(active);
        break;
      case 'Tab':
        setOpen(false);
        break;
      default:
        if (key.length === 1 && /\S/.test(key)) {
          const i = findByText(key.toLowerCase());
          if (i >= 0) setActive(i);
        }
    }
  };

  const chosen = options.filter((o) => selected.includes(o.value));
  const single = !multiple && chosen[0];
  const showIcon = Icon && !(single && (single.icon || single.avatarSrc));

  return (
    <div
      ref={rootRef}
      className={clsx('uui-field', 'uui-select', className)}
      data-size={size}
      data-invalid={invalid || undefined}
    >
      {label && (
        <label className="uui-field__label" id={labelId} htmlFor={triggerId}>
          {label}
          {required && (
            <span className="uui-field__required" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      <div className="uui-select__anchor">
        <button
          type="button"
          id={triggerId}
          role="combobox"
          className="uui-field__control uui-select__trigger"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          aria-labelledby={label ? labelId : undefined}
          aria-label={label ? undefined : ariaLabel}
          aria-describedby={hint ? hintId : undefined}
          aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
          aria-invalid={invalid || undefined}
          aria-required={required || undefined}
          disabled={disabled}
          onClick={() => (open ? setOpen(false) : openMenu())}
          onKeyDown={onKeyDown}
        >
          {showIcon && <Icon className="uui-select__option-icon" />}
          <span className="uui-select__value">
            {single ? (
              <OptionContent option={single} />
            ) : chosen.length > 0 ? (
              <span className="uui-select__text">
                <span className="uui-select__label">{chosen.map((o) => o.label).join(', ')}</span>
              </span>
            ) : (
              <span className="uui-select__placeholder">{placeholder}</span>
            )}
          </span>
          {invalid ? (
            <AlertCircle className="uui-field__trailing-icon" />
          ) : helpText ? (
            <span className="uui-field__help" role="img" aria-label={helpText} title={helpText}>
              <HelpCircle className="uui-field__trailing-icon" />
            </span>
          ) : null}
          <ChevronDown className="uui-select__chevron" />
        </button>
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className="uui-select__menu"
          aria-labelledby={label ? labelId : undefined}
          aria-label={label ? undefined : ariaLabel}
          aria-multiselectable={multiple || undefined}
          hidden={!open}
          tabIndex={-1}
        >
          {options.map((option, i) => {
            const isSelected = selected.includes(option.value);
            return (
              <li
                key={option.value}
                id={optionId(i)}
                role="option"
                className="uui-select__option"
                aria-selected={isSelected}
                aria-disabled={option.disabled || undefined}
                data-active={i === active || undefined}
                // Keep focus on the trigger so the combobox pattern holds.
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => !option.disabled && setActive(i)}
                onClick={() => pick(i)}
              >
                <span className="uui-select__option-content">
                  <OptionContent option={option} />
                  {isSelected && <Check className="uui-select__check" />}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      {name && selected.map((v) => <input key={v} type="hidden" name={name} value={v} />)}
      {hint && (
        <p className="uui-field__hint" id={hintId}>
          {hint}
        </p>
      )}
    </div>
  );
}

/** Controlled when `value` is passed, otherwise keeps its own state. */
function useControllable<T>(value: T | undefined, defaultValue: T) {
  const [own, setOwn] = React.useState(defaultValue);
  const controlled = value !== undefined;
  return [controlled ? value : own, controlled ? () => {} : setOwn] as const;
}

export function Select({ value, defaultValue = null, onChange, ...props }: SelectProps) {
  const [current, setCurrent] = useControllable(value, defaultValue);
  return (
    <SelectRoot
      {...props}
      multiple={false}
      selected={current == null ? [] : [current]}
      onPick={(v) => {
        setCurrent(v);
        onChange?.(v);
      }}
    />
  );
}

export function MultiSelect({ value, defaultValue = [], onChange, ...props }: MultiSelectProps) {
  const [current, setCurrent] = useControllable(value, defaultValue);
  return (
    <SelectRoot
      {...props}
      multiple
      selected={current}
      onPick={(v) => {
        const next = current.includes(v) ? current.filter((x) => x !== v) : [...current, v];
        setCurrent(next);
        onChange?.(next);
      }}
    />
  );
}
