/**
 * Untitled UI v8.0 "Radio group" (card items).
 *
 * Figma variants → props:
 *   Type      Radio button | Icon simple   → type: 'radio' | 'icon'
 *   Size      sm | md                      → size
 *   Selected  True                         → the group's value
 *   State     Focused / Disabled           → keyboard focus / disabled
 *   Text, Subtext, Supporting text         → title, subtext, description
 * The Avatar, Payment icon, Checkbox and Icon card types are not exported yet.
 *
 * Each card is a label wrapping a real radio input, so the group gets native
 * arrow-key movement, form submission and screen-reader semantics.
 */
import * as React from 'react';
import { clsx } from 'clsx';

import { Check, Placeholder, type UntitledIcon } from '../icons/icons';

interface GroupContext {
  name: string;
  value: string | null;
  size: 'sm' | 'md';
  type: 'radio' | 'icon';
  disabled?: boolean;
  select: (value: string) => void;
}

const RadioGroupContext = React.createContext<GroupContext | null>(null);

export interface RadioGroupProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'defaultValue' | 'onChange'
> {
  value?: string | null;
  defaultValue?: string | null;
  onChange?: (value: string) => void;
  /** The inputs' shared name; generated if omitted. */
  name?: string;
  size?: 'sm' | 'md';
  type?: 'radio' | 'icon';
  disabled?: boolean;
}

export function RadioGroup({
  value,
  defaultValue = null,
  onChange,
  name,
  size = 'md',
  type = 'radio',
  disabled,
  className,
  children,
  ...props
}: RadioGroupProps) {
  const autoName = React.useId();
  const [own, setOwn] = React.useState(defaultValue);
  const current = value !== undefined ? value : own;
  const ctx: GroupContext = {
    name: name ?? autoName,
    value: current,
    size,
    type,
    disabled,
    select: (v) => {
      if (value === undefined) setOwn(v);
      onChange?.(v);
    },
  };

  return (
    <div
      role="radiogroup"
      className={clsx('uui-radio-group', className)}
      data-size={size}
      aria-disabled={disabled || undefined}
      {...props}
    >
      <RadioGroupContext.Provider value={ctx}>{children}</RadioGroupContext.Provider>
    </div>
  );
}

export interface RadioGroupItemProps extends Omit<
  React.LabelHTMLAttributes<HTMLLabelElement>,
  'title'
> {
  value: string;
  title: React.ReactNode;
  /** Grey text beside the title ("$10/month" in the Figma examples). */
  subtext?: React.ReactNode;
  description?: React.ReactNode;
  /** The featured icon for type "icon"; defaults to the placeholder. */
  icon?: UntitledIcon;
  disabled?: boolean;
}

export function RadioGroupItem({
  value,
  title,
  subtext,
  description,
  icon: Icon = Placeholder,
  disabled,
  className,
  ...props
}: RadioGroupItemProps) {
  const group = React.useContext(RadioGroupContext);
  const id = React.useId();
  if (!group) throw new Error('RadioGroupItem must be used inside a RadioGroup');
  const isDisabled = disabled || group.disabled;
  const checked = group.value === value;

  return (
    <label
      className={clsx('uui-radio-card', className)}
      data-size={group.size}
      data-type={group.type}
      data-checked={checked || undefined}
      data-disabled={isDisabled || undefined}
      {...props}
    >
      <input
        type="radio"
        className="uui-radio-card__input"
        name={group.name}
        value={value}
        checked={checked}
        disabled={isDisabled}
        aria-labelledby={`${id}-title`}
        aria-describedby={description ? `${id}-desc` : undefined}
        onChange={() => group.select(value)}
      />
      {group.type === 'radio' ? (
        <span className="uui-radio-card__radio-wrap" aria-hidden="true">
          <span className="uui-radio-card__radio" />
        </span>
      ) : (
        <span className="uui-radio-card__icon" aria-hidden="true">
          <Icon />
        </span>
      )}
      <span className="uui-radio-card__text">
        <span className="uui-radio-card__heading">
          <span className="uui-radio-card__title" id={`${id}-title`}>
            {title}
          </span>
          {subtext && <span className="uui-radio-card__subtext">{subtext}</span>}
        </span>
        {description && (
          <span className="uui-radio-card__description" id={`${id}-desc`}>
            {description}
          </span>
        )}
      </span>
      {group.type === 'icon' && (
        <span className="uui-radio-card__check" aria-hidden="true">
          <Check strokeWidth={3} />
        </span>
      )}
    </label>
  );
}
