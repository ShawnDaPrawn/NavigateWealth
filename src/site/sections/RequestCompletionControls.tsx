/**
 * The request form's controls, as the "Request Completion" board draws them:
 * the label row with its asterisk and "Required" tag, the 48px fields, the
 * select with its chevron, option buttons for a single choice, bordered
 * check rows, and the switch row. Each takes and gives values exactly as the
 * live page's controls do; only the look is the board's.
 */
import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { RequestCompletionIcon } from './RequestCompletionIcons';

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(' ');
}

interface LabelRowProps {
  htmlFor?: string;
  id?: string;
  label: ReactNode;
  required?: boolean;
}

/** A field's label: the text, a red asterisk and the "Required" tag when it must be filled. */
export function FieldLabel({ htmlFor, id, label, required }: LabelRowProps) {
  return (
    <div className="nwrc-label-row">
      <label className="nwrc-label" htmlFor={htmlFor} id={id}>
        {label}
        {required ? <span className="nwrc-star">*</span> : null}
      </label>
      {required ? <span className="nwrc-tag nw-mono">Required</span> : null}
    </div>
  );
}

/** The same label row for a group of options, as a fieldset's legend. */
export function GroupLegend({
  id,
  label,
  required,
}: {
  id: string;
  label: ReactNode;
  required?: boolean;
}) {
  return (
    <legend id={id} className="nwrc-legend">
      <span className="nwrc-label-row">
        <span className="nwrc-label">
          {label}
          {required ? <span className="nwrc-star">*</span> : null}
        </span>
        {required ? <span className="nwrc-tag nw-mono">Required</span> : null}
      </span>
    </legend>
  );
}

export function FieldNote({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="nwrc-note">
      {children}
    </p>
  );
}

interface SelectProps {
  id: string;
  value: string | undefined;
  options: string[];
  invalid?: boolean;
  required?: boolean;
  describedBy?: string;
  onChange: (value: string) => void;
}

/** The live page's "Select..." list, drawn as the board's native select. */
export function SelectField({
  id,
  value,
  options,
  invalid,
  required,
  describedBy,
  onChange,
}: SelectProps) {
  return (
    <div className="nwrc-select-wrap">
      <select
        id={id}
        className={cx('nwrc-input nwrc-select', invalid && 'nwrc-invalid')}
        value={value ?? ''}
        aria-invalid={invalid ? true : undefined}
        aria-required={required ? true : undefined}
        aria-describedby={describedBy}
        onChange={(e) => {
          if (e.target.value) onChange(e.target.value);
        }}
      >
        <option value="" disabled={value !== undefined && value !== ''}>
          Select...
        </option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      <RequestCompletionIcon
        name="chevronDown"
        size={16}
        stroke="#5E6676"
        className="nwrc-select-chev"
      />
    </div>
  );
}

interface OptionGroupProps {
  /** Labels the group (a legend's id). */
  labelledBy: string;
  value: string | undefined;
  options: string[];
  invalid?: boolean;
  required?: boolean;
  /** One column, for a template laid out vertically. */
  vertical?: boolean;
  /** Yes / No side by side. */
  pair?: boolean;
  onChange: (value: string) => void;
}

/**
 * A single choice as the board's option buttons. Like a radio group, the
 * group is one tab stop and the arrow keys move the choice.
 */
export function OptionGroup({
  labelledBy,
  value,
  options,
  invalid,
  required,
  vertical,
  pair,
  onChange,
}: OptionGroupProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const selected = options.indexOf(value ?? '');
  const tabStop = selected >= 0 ? selected : 0;

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? 1
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? -1
          : 0;
    if (!step) return;
    e.preventDefault();
    const next = (index + step + options.length) % options.length;
    onChange(options[next]);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-invalid={invalid ? true : undefined}
      aria-required={required ? true : undefined}
      className={cx(
        'nwrc-options',
        vertical && 'nwrc-options--column',
        pair && 'nwrc-options--pair',
        invalid && 'nwrc-options--invalid',
      )}
    >
      {options.map((opt, index) => {
        const on = value === opt;
        return (
          <button
            key={opt}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={index === tabStop ? 0 : -1}
            className={cx('nwrc-opt', on && 'nwrc-opt--on')}
            onClick={() => onChange(opt)}
            onKeyDown={(e) => onKeyDown(e, index)}
          >
            <span className="nwrc-ring">
              <span className="nwrc-dot" />
            </span>
            {opt}
          </button>
        );
      })}
    </div>
  );
}

interface CheckRowProps {
  id: string;
  checked: boolean;
  invalid?: boolean;
  describedBy?: string;
  children: ReactNode;
  onChange: (checked: boolean) => void;
}

/** A check box in the board's bordered row. */
export function CheckRow({ id, checked, invalid, describedBy, children, onChange }: CheckRowProps) {
  return (
    <label htmlFor={id} className={cx('nwrc-check', invalid && 'nwrc-check--invalid')}>
      <input
        id={id}
        type="checkbox"
        className="nwrc-check-box"
        checked={checked}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.checked)}
      />
      {children}
    </label>
  );
}

interface SwitchRowProps {
  id: string;
  checked: boolean;
  label: ReactNode;
  invalid?: boolean;
  required?: boolean;
  describedBy?: string;
  onChange: (checked: boolean) => void;
}

/** The board's switch row: the question on the left, the switch on the right. */
export function SwitchRow({
  id,
  checked,
  label,
  invalid,
  required,
  describedBy,
  onChange,
}: SwitchRowProps) {
  return (
    <div className={cx('nwrc-switch-row', invalid && 'nwrc-switch-row--invalid')}>
      <span id={`${id}-label`} className="nwrc-switch-label">
        {label}
        {required ? <span className="nwrc-star">*</span> : null}
      </span>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        className={cx('nwrc-switch', checked && 'nwrc-switch--on')}
        onClick={() => onChange(!checked)}
      >
        <span className="nwrc-knob" />
      </button>
    </div>
  );
}
