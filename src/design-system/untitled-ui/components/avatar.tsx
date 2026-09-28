/**
 * Untitled UI v8.0 "Avatar", "Avatar group" and "Avatar label group".
 *
 * Figma variants → props:
 *   Size              xs | sm | md | lg | xl | 2xl  → size (group: xs | sm | md)
 *   Placeholder text  True                          → initials
 *   Placeholder icon  True                          → neither src nor initials
 *   Border            True                          → bordered
 *   Status icon       Online / Offline              → status
 * The Verified tick, Count and company-logo status icons, and "Avatar profile
 * photo", are not exported yet.
 */
import * as React from 'react';
import { clsx } from 'clsx';

import { Plus, User01 } from '../icons/icons';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

export interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: AvatarSize;
  /** Photo URL. Falls back to `initials`, then to the placeholder icon. */
  src?: string;
  /** Alt text for the photo; also the accessible name when there is none. */
  alt?: string;
  /** Shown when there is no photo, e.g. "OR". */
  initials?: string;
  status?: 'online' | 'offline';
  /** The white frame with a hairline and shadow ("Border=True"). */
  bordered?: boolean;
}

export const Avatar = React.forwardRef<HTMLSpanElement, AvatarProps>(
  (
    { size = 'md', src, alt = '', initials, status, bordered = false, className, ...props },
    ref,
  ) => {
    const [failed, setFailed] = React.useState(false);
    const showImage = !!src && !failed;

    return (
      <span
        ref={ref}
        className={clsx('uui-avatar', className)}
        data-size={size}
        data-bordered={bordered || undefined}
        role={showImage ? undefined : 'img'}
        aria-label={showImage ? undefined : alt || initials || undefined}
        {...props}
      >
        <span className="uui-avatar__face" data-image={showImage || undefined}>
          {showImage ? (
            <img className="uui-avatar__img" src={src} alt={alt} onError={() => setFailed(true)} />
          ) : initials ? (
            <span aria-hidden="true">{initials}</span>
          ) : (
            <User01 />
          )}
        </span>
        {status && (
          <span className="uui-avatar__status" data-status={status}>
            <span className="uui-sr-only">{status === 'online' ? 'Online' : 'Offline'}</span>
          </span>
        )}
      </span>
    );
  },
);
Avatar.displayName = 'Avatar';

export interface AvatarGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'xs' | 'sm' | 'md';
  /** Each avatar's props; `size` is set by the group. */
  avatars: Omit<AvatarProps, 'size'>[];
  /** Show at most this many, then a "+N" avatar. */
  max?: number;
  /** Renders the dashed add button ("Add more button"). */
  onAdd?: () => void;
  addLabel?: string;
}

export const AvatarGroup = React.forwardRef<HTMLDivElement, AvatarGroupProps>(
  ({ size = 'sm', avatars, max, onAdd, addLabel = 'Add user', className, ...props }, ref) => {
    const shown = max !== undefined ? avatars.slice(0, max) : avatars;
    const extra = avatars.length - shown.length;

    return (
      <div ref={ref} className={clsx('uui-avatar-group', className)} data-size={size} {...props}>
        <div className="uui-avatar-group__stack">
          {shown.map((avatar, i) => (
            <Avatar key={avatar.src ?? avatar.initials ?? i} size={size} {...avatar} />
          ))}
          {extra > 0 && (
            <Avatar
              size={size}
              className="uui-avatar-group__more"
              initials={`+${extra}`}
              alt={`${extra} more`}
            />
          )}
        </div>
        {onAdd && (
          <button
            type="button"
            className="uui-avatar-group__add"
            aria-label={addLabel}
            onClick={onAdd}
          >
            <Plus />
          </button>
        )}
      </div>
    );
  },
);
AvatarGroup.displayName = 'AvatarGroup';

export interface AvatarLabelGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg';
  avatar: Omit<AvatarProps, 'size'>;
  name: React.ReactNode;
  /** Supporting text, e.g. an email address. */
  hint?: React.ReactNode;
}

const LABEL_AVATAR_SIZE = { sm: 'sm', md: 'md', lg: 'lg' } as const;

export const AvatarLabelGroup = React.forwardRef<HTMLDivElement, AvatarLabelGroupProps>(
  ({ size = 'md', avatar, name, hint, className, ...props }, ref) => (
    <div ref={ref} className={clsx('uui-avatar-label', className)} data-size={size} {...props}>
      <Avatar size={LABEL_AVATAR_SIZE[size]} bordered {...avatar} />
      <span className="uui-avatar-label__text">
        <span className="uui-avatar-label__name">{name}</span>
        {hint && <span className="uui-avatar-label__hint">{hint}</span>}
      </span>
    </div>
  ),
);
AvatarLabelGroup.displayName = 'AvatarLabelGroup';
