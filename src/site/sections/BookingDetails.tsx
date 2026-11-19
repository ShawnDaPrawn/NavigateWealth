/**
 * BookingDetails — the booking's "Your details" fields: full name, email and
 * contact number (all required, as POST /consultation/request requires them)
 * and optional notes. Errors sit beside their fields; an email address on a
 * domain flagged for scam activity gets the board's warning, in the words the
 * server would answer with.
 */
import type { ChangeEvent } from 'react';
import { BookingIcon, type BookingIconName } from './BookingIcons';
import {
  MAX_LENGTH,
  fieldId,
  type DetailsErrors,
  type DetailsField,
  type DetailsValues,
} from './bookingRules';

interface BookingDetailsProps {
  values: DetailsValues;
  onChange: (field: DetailsField, value: string) => void;
  errors: DetailsErrors;
  /** The scam-domain warning, while the email address is on a flagged domain. */
  blockedText?: string;
}

const BLOCKED_ID = 'nwbk-blocked';

export function BookingDetails({ values, onChange, errors, blockedText }: BookingDetailsProps) {
  const field = (
    name: Exclude<DetailsField, 'notes'>,
    label: string,
    icon: BookingIconName,
    input: { type: string; autoComplete: string; placeholder: string; inputMode?: 'email' | 'tel' },
  ) => {
    const id = fieldId(name);
    const error = errors[name];
    // The board marks a flagged domain with its warning alone, not a red field.
    const blocked = name === 'email' && !!blockedText;
    const describedBy = error ? `${id}-error` : blocked ? BLOCKED_ID : undefined;
    return (
      <div className="nwbk-field">
        <label htmlFor={id} className="nw-mono nwbk-label">
          {label}{' '}
          <span className="nwbk-req" aria-hidden="true">
            *
          </span>
        </label>
        <div className="nwbk-control">
          <BookingIcon name={icon} size={16} stroke="#5E6676" className="nwbk-control-icon" />
          <input
            id={id}
            className={error ? 'nwbk-input nwbk-input--invalid' : 'nwbk-input'}
            {...input}
            required
            maxLength={MAX_LENGTH[name]}
            value={values[name]}
            onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(name, e.target.value)}
            aria-invalid={error || blocked ? true : undefined}
            aria-describedby={describedBy}
          />
        </div>
        {error ? (
          <p id={`${id}-error`} className="nwbk-field-error">
            <BookingIcon name="alert" size={14} />
            {error}
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <>
      {field('name', 'Full Name', 'user', {
        type: 'text',
        autoComplete: 'name',
        placeholder: 'e.g. John Smith',
      })}
      <div className="nwbk-field-row">
        {field('email', 'Email Address', 'mail', {
          type: 'email',
          autoComplete: 'email',
          inputMode: 'email',
          placeholder: 'e.g. john@example.com',
        })}
        {field('phone', 'Contact Number', 'phone', {
          type: 'tel',
          autoComplete: 'tel',
          inputMode: 'tel',
          placeholder: 'e.g. +27 12 345 6789',
        })}
      </div>
      {blockedText ? (
        <p id={BLOCKED_ID} role="alert" className="nwbk-blocked">
          {blockedText}
        </p>
      ) : null}
      <div className="nwbk-field">
        <label htmlFor={fieldId('notes')} className="nw-mono nwbk-label">
          Additional Notes <span className="nwbk-optional">(optional)</span>
        </label>
        <div className="nwbk-control">
          <BookingIcon
            name="message"
            size={16}
            stroke="#5E6676"
            className="nwbk-control-icon nwbk-control-icon--top"
          />
          <textarea
            id={fieldId('notes')}
            className="nwbk-input nwbk-textarea"
            rows={4}
            maxLength={MAX_LENGTH.notes}
            placeholder="Tell us about your financial planning needs or any specific questions..."
            value={values.notes}
            onChange={(e) => onChange('notes', e.target.value)}
          />
        </div>
      </div>
    </>
  );
}
