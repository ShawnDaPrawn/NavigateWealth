/**
 * ProductQuoteFields — the controls the "Quote details" board draws, as
 * components every service's questions are built from:
 *
 *  - the step heading and its lead (Step);
 *  - labelled text, number, date, rand-amount and drop-down fields, and the
 *    note box (the board's "About you" step);
 *  - option cards with a tick box (the board's covers and its adviser-help
 *    card), and the same cards with a round mark for a single choice (the
 *    board draws none; its radio is the "your details" board's);
 *  - the two big buttons of a yes-or-no question (the board's "None" and
 *    "Yes, I have conditions");
 *  - chips, for a choice among short answers (the board's conditions);
 *  - the paper panel a follow-up question sits in (the board's conditions
 *    panel);
 *  - the review's sections, rows and lists.
 *
 * Rand amounts and numbers go through the app's CurrencyInputField and
 * NumberInputField, as on the live wizards, so they format and store exactly
 * as there; this file only restyles them.
 */
import { useId, type ReactNode } from 'react';
import { CurrencyInputField } from '../../components/ui/currency-input';
import { NumberInputField } from '../../components/ui/number-input';
import { formatAmountInput } from '../../components/pages/quote/components/wizard/amountInput';
import { ProductQuoteIcon } from './ProductQuoteIcons';
import { dash } from './ProductQuoteModel';
import '../styles/product-quote.css';

export interface QuoteOption {
  value: string;
  label: string;
  /** A line under the label. */
  info?: string;
}

// ── Step ──────────────────────────────────────────────────────────────────────

export function Step({
  title,
  lead,
  children,
}: {
  title: string;
  lead: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="nwpq-step nw-in">
      <div>
        {/* Focused when the step changes, so a reader hears where they are. */}
        <h3 className="nw-h nwpq-step-title" tabIndex={-1}>
          {title}
        </h3>
        <p className="nwpq-step-lead">{lead}</p>
      </div>
      {children}
    </div>
  );
}

// ── Labels ────────────────────────────────────────────────────────────────────

function Req({ required }: { required?: boolean }) {
  return required ? (
    <>
      {' '}
      <span className="nwpq-req" aria-hidden="true">
        *
      </span>
    </>
  ) : null;
}

/** A labelled field: the label above, the control (given its id) below. */
export function Field({
  label,
  required,
  small,
  className,
  children,
}: {
  label: ReactNode;
  required?: boolean;
  /** The board's smaller label, for a question inside a card or panel. */
  small?: boolean;
  className?: string;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className={`nwpq-field${className ? ` ${className}` : ''}`}>
      <label htmlFor={id} className={small ? 'nwpq-sublabel' : 'nwpq-label'}>
        {label}
        <Req required={required} />
      </label>
      {children(id)}
    </div>
  );
}

/** A question answered with buttons: the label names the group. */
function Question({
  label,
  ariaLabel,
  required,
  small,
  note,
  role,
  className,
  children,
}: {
  label?: ReactNode;
  /** The group's name when it has no visible label (the step heading asks the question). */
  ariaLabel?: string;
  required?: boolean;
  small?: boolean;
  note?: ReactNode;
  role: 'radiogroup' | 'group';
  className: string;
  children: ReactNode;
}) {
  const id = useId();
  if (!label) {
    return (
      <div role={role} aria-label={ariaLabel} className={className}>
        {children}
      </div>
    );
  }
  return (
    <div className="nwpq-field">
      <span id={id} className={small ? 'nwpq-sublabel' : 'nwpq-label'}>
        {label}
        <Req required={required} />
      </span>
      {note}
      <div
        role={role}
        aria-labelledby={id}
        aria-required={role === 'radiogroup' && required ? true : undefined}
        className={className}
      >
        {children}
      </div>
    </div>
  );
}

// ── Inputs ────────────────────────────────────────────────────────────────────

interface InputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  /** 46px in a card, as the board draws the cover amounts; 48px otherwise. */
  compact?: boolean;
}

export function TextInput({
  id,
  value,
  onChange,
  placeholder,
  required,
  compact,
  type = 'text',
  max,
}: InputProps & { type?: 'text' | 'date' | 'email' | 'tel'; max?: string }) {
  return (
    <input
      id={id}
      type={type}
      className={`nwpq-input${compact ? ' nwpq-input--46' : ''}`}
      value={value}
      max={max}
      placeholder={placeholder}
      required={required}
      aria-required={required || undefined}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/** A rand amount, stored comma-grouped ("2,000,000") as the live wizards store it. */
export function MoneyInput({
  id,
  value,
  onChange,
  placeholder,
  required,
  disabled,
  compact,
}: InputProps) {
  return (
    <div className={`nwpq-money${compact ? ' nwpq-money--46' : ''}`}>
      <CurrencyInputField
        id={id}
        className="nwpq-input nw-mono"
        placeholder={placeholder}
        value={value}
        required={required}
        aria-required={required || undefined}
        disabled={disabled}
        onChange={(e) => onChange(formatAmountInput(e.target.value))}
      />
    </div>
  );
}

export function NumberInput({
  id,
  value,
  onChange,
  placeholder,
  required,
  disabled,
  compact,
}: InputProps) {
  return (
    <NumberInputField
      id={id}
      className={`nwpq-input nwpq-number${compact ? ' nwpq-input--46' : ''}`}
      placeholder={placeholder}
      value={value}
      required={required}
      aria-required={required || undefined}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function SelectInput({
  id,
  value,
  onChange,
  placeholder,
  options,
  required,
}: Omit<InputProps, 'placeholder'> & { placeholder: string; options: readonly QuoteOption[] }) {
  return (
    <div className="nwpq-select-box">
      <select
        id={id}
        className="nwpq-input nwpq-select"
        value={value}
        required={required}
        aria-required={required || undefined}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ProductQuoteIcon name="chevronDown" size={16} stroke="#0D1626" className="nwpq-chev" />
    </div>
  );
}

export function TextArea({
  id,
  value,
  onChange,
  placeholder,
}: Pick<InputProps, 'id' | 'value' | 'onChange' | 'placeholder'>) {
  return (
    <textarea
      id={id}
      className="nwpq-input nwpq-textarea"
      rows={3}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/**
 * A rand amount with a toggle beside it that hands the figure to the adviser
 * (the live wizards' "Adviser assist" and "Not sure" buttons). The toggle
 * empties and disables the field, as on the live page.
 */
export function AmountWithToggle({
  label,
  value,
  onChange,
  placeholder,
  required,
  toggleLabel,
  toggled,
  onToggle,
  note,
}: {
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  required?: boolean;
  toggleLabel: string;
  toggled: boolean;
  onToggle: () => void;
  note?: ReactNode;
}) {
  return (
    <Field label={label} required={required}>
      {(id) => (
        <>
          <div className="nwpq-amount-row">
            <MoneyInput
              id={id}
              value={value}
              onChange={onChange}
              placeholder={placeholder}
              disabled={toggled}
            />
            <button
              type="button"
              className="nwpq-chip nwpq-chip--tall"
              aria-pressed={toggled}
              onClick={onToggle}
            >
              {toggleLabel}
            </button>
          </div>
          {note}
        </>
      )}
    </Field>
  );
}

// ── Choices ───────────────────────────────────────────────────────────────────

function Box({ on }: { on: boolean }) {
  return (
    <span className="nwpq-box" aria-hidden="true">
      {on ? <ProductQuoteIcon name="check" size={12} /> : null}
    </span>
  );
}

function Radio() {
  return (
    <span className="nwpq-radio" aria-hidden="true">
      <span className="nwpq-radio-dot" />
    </span>
  );
}

function OptionText({ option }: { option: QuoteOption }) {
  return (
    <span className="nwpq-opt-text">
      <span className="nwpq-opt-title">{option.label}</span>
      {option.info ? <span className="nwpq-opt-info">{dash(option.info)}</span> : null}
    </span>
  );
}

/**
 * One answer from a list of cards with a round mark. Cards with a line of
 * explanation run full width; short ones sit in the board's card grid.
 */
export function Choices({
  label,
  ariaLabel,
  required,
  options,
  value,
  onChange,
}: {
  label?: ReactNode;
  ariaLabel?: string;
  required?: boolean;
  options: readonly QuoteOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  const stacked = options.some((o) => o.info);
  return (
    <Question
      label={label}
      ariaLabel={ariaLabel}
      required={required}
      role="radiogroup"
      className={stacked ? 'nwpq-opts nwpq-opts--list' : 'nwpq-opts'}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className="nwpq-opt nwpq-opt--card"
          onClick={() => onChange(o.value)}
        >
          <Radio />
          <OptionText option={o} />
        </button>
      ))}
    </Question>
  );
}

/** Any number of answers from a list of cards with a tick box. */
export function Checks({
  options,
  values,
  onToggle,
  label,
}: {
  options: readonly QuoteOption[];
  values: readonly string[];
  onToggle: (value: string) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="nwpq-opts nwpq-opts--list">
      {options.map((o) => {
        const on = values.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            className="nwpq-opt nwpq-opt--card"
            onClick={() => onToggle(o.value)}
          >
            <Box on={on} />
            <OptionText option={o} />
          </button>
        );
      })}
    </div>
  );
}

/**
 * The board's tick-box card with a heading and a line under it, for one
 * thing that is on or off.
 */
export function ToggleCard({
  on,
  onToggle,
  title,
  text,
}: {
  on: boolean;
  onToggle: () => void;
  title: string;
  text?: string;
}) {
  return (
    <button type="button" aria-pressed={on} className="nwpq-opt nwpq-opt--card" onClick={onToggle}>
      <Box on={on} />
      <OptionText option={{ value: '', label: title, info: text }} />
    </button>
  );
}

/** A yes-or-no question (or three short answers): the board's two big buttons. */
export function Pair<T extends string | boolean>({
  label,
  required,
  options,
  value,
  onChange,
}: {
  label?: ReactNode;
  required?: boolean;
  options: readonly { value: T; label: string }[];
  value: T | null | '';
  onChange: (value: T) => void;
}) {
  return (
    <Question
      label={label}
      required={required}
      role="radiogroup"
      className={`nwpq-pair${options.length > 2 ? ' nwpq-pair--3' : ''}`}
    >
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className="nwpq-opt nwpq-pair-btn"
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </Question>
  );
}

/** One short answer from a row of chips. */
export function Chips({
  label,
  required,
  small,
  note,
  options,
  value,
  onChange,
}: {
  label: ReactNode;
  required?: boolean;
  small?: boolean;
  note?: ReactNode;
  options: readonly QuoteOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Question
      label={label}
      required={required}
      small={small}
      note={note}
      role="radiogroup"
      className="nwpq-chips"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className="nwpq-chip"
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </Question>
  );
}

/** Any number of short answers from a row of chips. */
export function ChipsMulti({
  label,
  required,
  small,
  options,
  values,
  onToggle,
}: {
  label: ReactNode;
  required?: boolean;
  small?: boolean;
  options: readonly string[];
  values: readonly string[];
  onToggle: (value: string) => void;
}) {
  return (
    <Question label={label} required={required} small={small} role="group" className="nwpq-chips">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          aria-pressed={values.includes(o)}
          className="nwpq-chip"
          onClick={() => onToggle(o)}
        >
          {o}
        </button>
      ))}
    </Question>
  );
}

/** The board's paper panel for follow-up questions. */
export function Panel({
  title,
  action,
  tone,
  children,
}: {
  title?: ReactNode;
  action?: ReactNode;
  tone?: 'warn';
  children: ReactNode;
}) {
  return (
    <div className={`nwpq-panel nw-in${tone ? ` nwpq-panel--${tone}` : ''}`}>
      {title || action ? (
        <div className="nwpq-panel-head">
          {title ? <span className="nwpq-panel-title">{title}</span> : null}
          {action}
        </div>
      ) : null}
      {children}
    </div>
  );
}

/** A two-column grid of fields, as the board lays out its "About you" step. */
export function FieldGrid({ children }: { children: ReactNode }) {
  return <div className="nwpq-grid">{children}</div>;
}

/** A muted line under a field or a choice. */
export function Note({ children, warn }: { children: ReactNode; warn?: boolean }) {
  return <p className={warn ? 'nwpq-note nwpq-note--warn' : 'nwpq-note'}>{children}</p>;
}

// ── Review ────────────────────────────────────────────────────────────────────

export function Review({ children }: { children: ReactNode }) {
  return <div className="nwpq-review">{children}</div>;
}

export function ReviewSection({
  title,
  onEdit,
  children,
}: {
  title: string;
  /** Takes the visitor back to the step; the contact section has none. */
  onEdit?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="nwpq-review-sec">
      {onEdit ? (
        <div className="nwpq-review-head">
          <span className="nwpq-review-title">{title}</span>
          <button
            type="button"
            className="nwpq-link nwpq-review-edit"
            onClick={onEdit}
            aria-label={`Edit ${title.toLowerCase()}`}
          >
            Edit
          </button>
        </div>
      ) : (
        // Without an Edit link the board sets the title in a plain line.
        <span className="nwpq-review-title">{title}</span>
      )}
      {children}
    </div>
  );
}

/** Label-and-value pairs, in the board's grid. */
export function ReviewRows({
  rows,
  narrow,
  plain,
}: {
  rows: readonly (readonly [string, string])[];
  /** The contact section's narrower columns. */
  narrow?: boolean;
  /** Values set in the text face rather than tabular figures. */
  plain?: boolean;
}) {
  return (
    <dl className={`nwpq-review-dl${narrow ? ' nwpq-review-dl--narrow' : ''}`}>
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className="nwpq-review-dt">{label}</dt>
          <dd className={`nwpq-review-dd${plain ? '' : ' nw-mono'}`}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A list of items, each with an optional figure on the right. */
export function ReviewList({ items }: { items: readonly (readonly [string, string?])[] }) {
  return (
    <ul className="nwpq-review-list">
      {items.map(([label, value]) => (
        <li key={label}>
          <span>{label}</span>
          {value ? <span className="nw-mono nwpq-review-fig">{value}</span> : null}
        </li>
      ))}
    </ul>
  );
}

/** A sentence in a review section ("No covers selected"). */
export function ReviewText({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return (
    <p className={muted ? 'nwpq-review-p nwpq-review-p--muted' : 'nwpq-review-p'}>{children}</p>
  );
}
