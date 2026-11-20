/**
 * A request template's fields (the live page's "legacy" field list), drawn in
 * the "Request Completion" board's form. Every field type the live page
 * renders is here, writing the same value under the same key (the field's
 * id): text for text, email, phone, number, date and long answers; the chosen
 * option for a list or a single choice; the list of ticked options for check
 * boxes; true or false for a switch.
 */
import { useId, type ReactNode } from 'react';
import { NumberInputField } from '../../components/ui/number-input';
import {
  CheckRow,
  FieldLabel,
  FieldNote,
  GroupLegend,
  OptionGroup,
  SelectField,
  SwitchRow,
} from './RequestCompletionControls';

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(' ');
}

export interface TemplateField {
  id: string;
  label: string;
  description?: string;
  type: string;
  required?: boolean;
  placeholder?: string;
  options?: string[];
}

/** A section's heading and rule, for a header field or a section header block. */
export function SectionHeading({ number, title }: { number?: string; title: ReactNode }) {
  return (
    <div className="nwrc-section">
      <h2 className="nwrc-section-title">
        {number ? <span className="nwrc-section-num">{number}</span> : null}
        {title}
      </h2>
    </div>
  );
}

interface FieldsProps {
  fields: TemplateField[];
  responses: Record<string, unknown>;
  /** Keys of required fields left empty when the form was sent. */
  invalidKeys: ReadonlySet<string>;
  onChange: (key: string, value: unknown) => void;
}

/** Single-line answers, which the board sets two to a row. */
const SHORT = new Set(['text', 'email', 'phone', 'date', 'number']);

type Item =
  | { field: TemplateField; index: number }
  | { grid: Array<{ field: TemplateField; index: number }> };

/**
 * The board's layout for a list of fields: a section's first field takes the
 * full row, and the single-line answers that follow it pair up in a grid.
 */
function layout(fields: TemplateField[]): Item[] {
  const items: Item[] = [];
  let firstInSection = true;
  let run: Array<{ field: TemplateField; index: number }> | null = null;
  fields.forEach((field, index) => {
    const isField = field.type !== 'header' && field.type !== 'paragraph';
    if (isField && SHORT.has(field.type) && !firstInSection) {
      if (!run) {
        run = [];
        items.push({ grid: run });
      }
      run.push({ field, index });
    } else {
      run = null;
      items.push({ field, index });
    }
    if (field.type === 'header') firstInSection = true;
    else if (isField) firstInSection = false;
  });
  return items;
}

export function RequestCompletionFields({ fields, responses, invalidKeys, onChange }: FieldsProps) {
  const base = useId();
  const render = ({ field, index }: { field: TemplateField; index: number }) => {
    // Headers and paragraphs don't need the standard field wrapper
    if (field.type === 'header') {
      return <SectionHeading key={field.id} title={field.label} />;
    }
    if (field.type === 'paragraph') {
      const afterHeading = fields[index - 1]?.type === 'header';
      return (
        <p key={field.id} className={cx('nwrc-para', afterHeading && 'nwrc-para--lead')}>
          {field.description}
        </p>
      );
    }
    return (
      <Field
        key={field.id}
        id={`${base}-${index}`}
        field={field}
        value={responses[field.id]}
        invalid={invalidKeys.has(field.id)}
        onChange={(val) => onChange(field.id, val)}
      />
    );
  };
  return (
    <>
      {layout(fields).map((item) =>
        'grid' in item ? (
          <div key={`grid-${item.grid[0].field.id}`} className="nwrc-grid">
            {item.grid.map(render)}
          </div>
        ) : (
          render(item)
        ),
      )}
    </>
  );
}

interface FieldProps {
  id: string;
  field: TemplateField;
  value: unknown;
  invalid: boolean;
  onChange: (value: string | number | boolean | string[]) => void;
}

function Field({ id, field, value, invalid, onChange }: FieldProps) {
  const noteId = field.description ? `${id}-note` : undefined;
  const note = field.description ? (
    <FieldNote id={`${id}-note`}>{field.description}</FieldNote>
  ) : null;
  const required = !!field.required;
  const common = {
    id,
    'aria-invalid': invalid ? true : undefined,
    'aria-required': required ? true : undefined,
    'aria-describedby': noteId,
  } as const;
  const inputClass = cx('nwrc-input', invalid && 'nwrc-invalid');

  switch (field.type) {
    case 'text':
    case 'email':
    case 'phone':
      return (
        <div className="nwrc-field">
          <FieldLabel htmlFor={id} label={field.label} required={required} />
          {note}
          <input
            {...common}
            type={field.type === 'phone' ? 'tel' : 'text'}
            inputMode={field.type === 'email' ? 'email' : undefined}
            className={inputClass}
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
          />
        </div>
      );
    case 'number':
      return (
        <div className="nwrc-field">
          <FieldLabel htmlFor={id} label={field.label} required={required} />
          {note}
          <NumberInputField
            {...common}
            decimals={2}
            className={inputClass}
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
          />
        </div>
      );
    case 'textarea':
      return (
        <div className="nwrc-field">
          <FieldLabel htmlFor={id} label={field.label} required={required} />
          {note}
          <textarea
            {...common}
            rows={4}
            className={cx('nwrc-input nwrc-textarea', invalid && 'nwrc-invalid')}
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
          />
        </div>
      );
    case 'select':
      return (
        <div className="nwrc-field">
          <FieldLabel htmlFor={id} label={field.label} required={required} />
          {note}
          <SelectField
            id={id}
            value={value as string | undefined}
            options={field.options ?? []}
            invalid={invalid}
            required={required}
            describedBy={noteId}
            onChange={onChange}
          />
        </div>
      );
    case 'radio':
      return (
        <fieldset className="nwrc-group" aria-describedby={noteId}>
          <GroupLegend id={`${id}-legend`} label={field.label} required={required} />
          {note}
          <OptionGroup
            labelledBy={`${id}-legend`}
            value={value as string | undefined}
            options={field.options ?? []}
            invalid={invalid}
            required={required}
            onChange={onChange}
          />
        </fieldset>
      );
    case 'checkbox': {
      const options = field.options ?? [];
      const toggle = (opt: string, checked: boolean) => {
        const current = Array.isArray(value) ? value : [];
        if (checked) onChange([...current, opt]);
        else onChange(current.filter((v: string) => v !== opt));
      };
      // A single box that says what it confirms is drawn as the board's
      // confirmation row, its asterisk at the end.
      if (options.length === 1 && (!field.label || field.label === options[0])) {
        return (
          <div className="nwrc-field">
            <CheckRow
              id={`${id}-0`}
              checked={Array.isArray(value) && value.includes(options[0])}
              invalid={invalid}
              describedBy={noteId}
              onChange={(checked) => toggle(options[0], checked)}
            >
              {options[0]}
              {required ? <span className="nwrc-star nwrc-star--row">*</span> : null}
            </CheckRow>
            {note}
          </div>
        );
      }
      return (
        <fieldset className="nwrc-group" aria-describedby={noteId}>
          <GroupLegend id={`${id}-legend`} label={field.label} required={required} />
          {note}
          <div className="nwrc-checks">
            {options.map((opt, i) => (
              <CheckRow
                key={opt}
                id={`${id}-${i}`}
                checked={Array.isArray(value) && value.includes(opt)}
                invalid={invalid}
                onChange={(checked) => toggle(opt, checked)}
              >
                {opt}
              </CheckRow>
            ))}
          </div>
        </fieldset>
      );
    }
    case 'toggle':
      return (
        <div className="nwrc-field">
          <SwitchRow
            id={id}
            checked={!!value}
            label={field.label}
            invalid={invalid}
            required={required}
            describedBy={noteId}
            onChange={onChange}
          />
          {note}
        </div>
      );
    case 'date':
      return (
        <div className="nwrc-field">
          <FieldLabel htmlFor={id} label={field.label} required={required} />
          {note}
          <input
            {...common}
            type="date"
            className={cx('nwrc-input nwrc-date', invalid && 'nwrc-invalid')}
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );
    default:
      // The live page keeps the label of a type it cannot draw, with nothing under it.
      return (
        <div className="nwrc-field">
          <FieldLabel label={field.label} required={required} />
          {note}
        </div>
      );
  }
}
