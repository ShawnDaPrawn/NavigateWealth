/**
 * The booking's two single-choice groups — how to meet, and at what time —
 * as ARIA radio groups: one tab stop per group, the arrow keys (and Home and
 * End) move the choice, Space or a click picks the one in focus.
 */
import { useRef, type KeyboardEvent } from 'react';
import { BookingIcon, type BookingIconName } from './BookingIcons';
import { radioStep } from './bookingRules';

function useRadioKeys(count: number, onPick: (index: number) => void) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (index: number) => (e: KeyboardEvent<HTMLButtonElement>) => {
    const next = radioStep(e.key, index, count);
    if (next === null) return;
    e.preventDefault();
    onPick(next);
    refs.current[next]?.focus();
  };
  const ref = (index: number) => (el: HTMLButtonElement | null) => {
    refs.current[index] = el;
  };
  return { onKeyDown, ref, refs };
}

export interface MeetingOption {
  id: string;
  title: string;
  subtitle: string;
  detail: string;
  icon: BookingIconName;
}

interface MeetingChoiceProps {
  options: readonly MeetingOption[];
  value: string;
  onChange: (id: string) => void;
}

export function MeetingChoice({ options, value, onChange }: MeetingChoiceProps) {
  const { onKeyDown, ref } = useRadioKeys(options.length, (i) => onChange(options[i].id));
  return (
    <div role="radiogroup" aria-label="Meeting type" className="nwbk-opts">
      {options.map((option, i) => {
        const on = option.id === value;
        const id = `nwbk-type-${option.id}`;
        return (
          <button
            key={option.id}
            ref={ref(i)}
            type="button"
            role="radio"
            aria-checked={on}
            aria-labelledby={`${id}-t`}
            aria-describedby={`${id}-s ${id}-d`}
            tabIndex={on ? 0 : -1}
            className={on ? 'nwbk-opt nwbk-opt--on' : 'nwbk-opt'}
            onClick={() => onChange(option.id)}
            onKeyDown={onKeyDown(i)}
          >
            <span className="nwbk-opt-icon" aria-hidden="true">
              <BookingIcon name={option.icon} size={20} />
            </span>
            <span className="nwbk-opt-text">
              <span className="nwbk-opt-head">
                <span id={`${id}-t`} className="nwbk-opt-title">
                  {option.title}
                </span>
                <span className="nwbk-radio" aria-hidden="true">
                  <BookingIcon name="check" size={12} stroke="#FFFFFF" />
                </span>
              </span>
              <span id={`${id}-s`} className="nwbk-opt-sub">
                {option.subtitle}
              </span>
              <span id={`${id}-d`} className="nwbk-opt-detail">
                {option.detail}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

interface TimeChoiceProps {
  slots: readonly { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  /** The id of the message saying a time is needed, while it shows. */
  errorId?: string;
  /** Receives the button that takes focus when the group is asked for. */
  focusRef?: (el: HTMLButtonElement | null) => void;
}

export function TimeChoice({ slots, value, onChange, errorId, focusRef }: TimeChoiceProps) {
  const { onKeyDown, ref } = useRadioKeys(slots.length, (i) => onChange(slots[i].value));
  const checked = slots.findIndex((s) => s.value === value);
  const stop = checked === -1 ? 0 : checked;
  return (
    <div
      role="radiogroup"
      aria-label="Time slots"
      aria-invalid={errorId ? true : undefined}
      aria-describedby={errorId}
      className="nwbk-slots"
    >
      {slots.map((slot, i) => {
        const on = i === checked;
        return (
          <button
            key={slot.value}
            ref={(el) => {
              ref(i)(el);
              if (i === stop) focusRef?.(el);
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={i === stop ? 0 : -1}
            className={on ? 'nwbk-slot nwbk-slot--on' : 'nwbk-slot'}
            onClick={() => onChange(slot.value)}
            onKeyDown={onKeyDown(i)}
          >
            {slot.label}
          </button>
        );
      })}
    </div>
  );
}
