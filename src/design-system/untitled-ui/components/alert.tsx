/**
 * Untitled UI v8.0 "Alert" and "Notification", with "Featured icon outline".
 *
 * Alert variants → props:
 *   Color  Default | Gray | Brand | Error | Warning | Success   → color
 *   Supporting text, Actions, X close button                    → children, actions, onClose
 *   Size   Floating                                             → (the only size exported)
 * Notification variants → props:
 *   Type   Primary icon | Gray icon | Error / Warning / Success icon | No icon
 *                                                               → color, icon
 * The Full-width alert, and the Image, Avatar and Progress notification
 * types, are not exported yet.
 *
 * Error and warning alerts are announced assertively (role="alert"); the
 * others politely (role="status").
 */
import * as React from 'react';
import { clsx } from 'clsx';

import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  InfoCircle,
  type UntitledIcon,
} from '../icons/icons';
import { CloseButton } from './close-button';

export type AlertColor = 'default' | 'gray' | 'brand' | 'error' | 'warning' | 'success';

const ICONS: Record<AlertColor, UntitledIcon> = {
  default: InfoCircle,
  gray: InfoCircle,
  brand: InfoCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  success: CheckCircle,
};

/** A 20px icon inside two faint rings of its colour ("Featured icon outline"). */
export function FeaturedIconOutline({
  icon: Icon,
  color = 'brand',
  className,
}: {
  icon: UntitledIcon;
  color?: Exclude<AlertColor, 'default'>;
  className?: string;
}) {
  return (
    <span className={clsx('uui-featured-outline', className)} data-color={color} aria-hidden="true">
      <Icon />
    </span>
  );
}

interface MessageProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  color?: AlertColor;
  title: React.ReactNode;
  /** Supporting text under the title. */
  children?: React.ReactNode;
  /** Buttons under the text, e.g. two link buttons. */
  actions?: React.ReactNode;
  /** Renders the X close button. */
  onClose?: () => void;
  closeLabel?: string;
  /** Replaces the colour's default icon; pass `null` for none. */
  icon?: UntitledIcon | null;
}

function Message({
  kind,
  color = 'default',
  title,
  children,
  actions,
  onClose,
  closeLabel = 'Dismiss',
  icon,
  className,
  ...props
}: MessageProps & { kind: 'alert' | 'notification' }) {
  const Icon = icon === null ? null : (icon ?? ICONS[color]);
  const urgent = color === 'error' || color === 'warning';
  const id = React.useId();

  return (
    <div
      role={urgent ? 'alert' : 'status'}
      aria-labelledby={`${id}-title`}
      className={clsx(kind === 'alert' ? 'uui-alert' : 'uui-notification', className)}
      data-color={color}
      data-closable={onClose ? true : undefined}
      {...props}
    >
      {Icon &&
        (kind === 'alert' && color === 'default' ? (
          <span className="uui-alert__featured" aria-hidden="true">
            <Icon />
          </span>
        ) : (
          <FeaturedIconOutline icon={Icon} color={color === 'default' ? 'brand' : color} />
        ))}
      <div className="uui-alert__content">
        <div className="uui-alert__text">
          <p className="uui-alert__title" id={`${id}-title`}>
            {title}
          </p>
          {children && <div className="uui-alert__supporting">{children}</div>}
        </div>
        {actions && <div className="uui-alert__actions">{actions}</div>}
      </div>
      {onClose && (
        <CloseButton
          size="sm"
          className="uui-alert__close"
          aria-label={closeLabel}
          onClick={onClose}
        />
      )}
    </div>
  );
}

export type AlertProps = MessageProps;

/** An inline message in the page flow ("Alert", Floating size). */
export function Alert(props: AlertProps) {
  return <Message kind="alert" {...props} />;
}

export type NotificationProps = MessageProps;

/**
 * A 400px toast card with shadow-lg ("Notification"). It does not position
 * or time itself: place it in a fixed stack and remove it when done.
 */
export function Notification(props: NotificationProps) {
  return <Message kind="notification" color="brand" {...props} />;
}
