/**
 * Untitled UI v8.0 "Text editor", "Text editor toolbar" and "_Text editor icon".
 *
 * Figma variants → props:
 *   Size        sm | md                       → size (16/20px padding, 14/16px text)
 *   Hint text   True                          → hint
 *   Type        Default                       → the toolbar above the input
 *   Toolbar     Simple                        → the formatting buttons below
 *   _Text editor icon  State = Current        → aria-pressed (from the selection)
 * The Advanced toolbar (font and size selects, colour picker), the Floating
 * toolbar type and the "Text editor tooltip" are not exported yet.
 *
 * The editing surface is a `contentEditable` region driven by the browser's
 * built-in formatting commands, which is enough for notes and short
 * messages. For anything larger, keep these styles and put a dedicated
 * editor engine behind `TextEditorToolbar` / `TextEditorButton`.
 *
 * `onChange` returns HTML. Sanitise it before storing or rendering it
 * anywhere else; pasting is limited to plain text to keep foreign markup out.
 */
import * as React from 'react';
import { clsx } from 'clsx';

import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold01,
  Dotpoints01,
  Italic01,
  Link01,
  Underline01,
  type UntitledIcon,
} from '../icons/icons';

export interface TextEditorButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'children'
> {
  icon: UntitledIcon;
  /** Accessible name and tooltip, e.g. "Bold". */
  label: string;
  /** The "Current" state: the format is applied at the caret. */
  active?: boolean;
}

/** A 32px toolbar button with a 20px icon ("_Text editor icon"). */
export const TextEditorButton = React.forwardRef<HTMLButtonElement, TextEditorButtonProps>(
  ({ icon: Icon, label, active, className, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={clsx('uui-text-editor__button', className)}
      aria-label={label}
      title={label}
      aria-pressed={active === undefined ? undefined : active}
      // Keep the selection in the editor while a button is pressed.
      onMouseDown={(e) => e.preventDefault()}
      {...props}
    >
      <Icon />
    </button>
  ),
);
TextEditorButton.displayName = 'TextEditorButton';

export function TextEditorDivider() {
  return <span className="uui-text-editor__divider" role="separator" aria-orientation="vertical" />;
}

export function TextEditorToolbar({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div role="toolbar" className={clsx('uui-text-editor__toolbar', className)} {...props} />;
}

type Command =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'insertUnorderedList'
  | 'justifyLeft'
  | 'justifyCenter'
  | 'justifyRight'
  | 'justifyFull';

const GROUPS: { command: Command; icon: UntitledIcon; label: string }[][] = [
  [
    { command: 'bold', icon: Bold01, label: 'Bold' },
    { command: 'italic', icon: Italic01, label: 'Italic' },
    { command: 'underline', icon: Underline01, label: 'Underline' },
  ],
  [
    { command: 'justifyLeft', icon: AlignLeft, label: 'Align left' },
    { command: 'justifyCenter', icon: AlignCenter, label: 'Align centre' },
    { command: 'justifyRight', icon: AlignRight, label: 'Align right' },
    { command: 'justifyFull', icon: AlignJustify, label: 'Justify' },
  ],
  [{ command: 'insertUnorderedList', icon: Dotpoints01, label: 'Bulleted list' }],
];

export interface TextEditorProps {
  size?: 'sm' | 'md';
  label?: React.ReactNode;
  /** Shown under the input, e.g. "964 characters left". */
  hint?: React.ReactNode;
  /** Initial HTML. The editor is uncontrolled after the first render. */
  defaultValue?: string;
  /** Called with the editor's HTML after every change. */
  onChange?: (html: string, text: string) => void;
  placeholder?: string;
  /** Adds a "Link" button that asks for a URL (http, https or mailto only). */
  allowLinks?: boolean;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}

const SAFE_LINK = /^(https?:|mailto:)/i;

// document.execCommand is deprecated but remains the only built-in way to
// format a contentEditable region, and every current browser supports it.
function exec(command: string, value?: string) {
  document.execCommand?.(command, false, value);
}

export function TextEditor({
  size = 'md',
  label,
  hint,
  defaultValue = '',
  onChange,
  placeholder,
  allowLinks = false,
  disabled,
  className,
  'aria-label': ariaLabel,
}: TextEditorProps) {
  const id = React.useId();
  const editorRef = React.useRef<HTMLDivElement>(null);
  const [active, setActive] = React.useState<Partial<Record<Command, boolean>>>({});
  const [empty, setEmpty] = React.useState(!defaultValue);

  // Set the initial HTML once; React must not own this subtree afterwards.
  React.useLayoutEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = defaultValue;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshState = React.useCallback(() => {
    const next: Partial<Record<Command, boolean>> = {};
    for (const group of GROUPS)
      for (const { command } of group) {
        try {
          next[command] = document.queryCommandState?.(command) ?? false;
        } catch {
          next[command] = false;
        }
      }
    setActive(next);
  }, []);

  React.useEffect(() => {
    const onSelection = () => {
      const sel = document.getSelection();
      if (sel && editorRef.current?.contains(sel.anchorNode)) refreshState();
    };
    document.addEventListener('selectionchange', onSelection);
    return () => document.removeEventListener('selectionchange', onSelection);
  }, [refreshState]);

  const emit = () => {
    const el = editorRef.current;
    if (!el) return;
    const text = el.textContent ?? '';
    setEmpty(text.length === 0 && !el.querySelector('li,img'));
    onChange?.(el.innerHTML, text);
  };

  const run = (command: string, value?: string) => {
    editorRef.current?.focus();
    exec(command, value);
    refreshState();
    emit();
  };

  const addLink = () => {
    const url = window.prompt('Link URL', 'https://');
    if (url && SAFE_LINK.test(url.trim())) run('createLink', url.trim());
  };

  return (
    <div
      className={clsx('uui-text-editor', className)}
      data-size={size}
      data-disabled={disabled || undefined}
    >
      {label && (
        <span className="uui-field__label" id={`${id}-label`}>
          {label}
        </span>
      )}
      <TextEditorToolbar aria-label="Formatting" aria-controls={`${id}-input`}>
        {GROUPS.map((group, g) => (
          <React.Fragment key={g}>
            {g > 0 && <TextEditorDivider />}
            {group.map(({ command, icon, label: name }) => (
              <TextEditorButton
                key={command}
                icon={icon}
                label={name}
                active={!!active[command]}
                disabled={disabled}
                onClick={() => run(command)}
              />
            ))}
          </React.Fragment>
        ))}
        {allowLinks && (
          <>
            <TextEditorDivider />
            <TextEditorButton icon={Link01} label="Link" disabled={disabled} onClick={addLink} />
          </>
        )}
      </TextEditorToolbar>
      <div
        ref={editorRef}
        id={`${id}-input`}
        className="uui-text-editor__input"
        role="textbox"
        aria-multiline="true"
        aria-labelledby={label ? `${id}-label` : undefined}
        aria-label={label ? undefined : ariaLabel}
        aria-describedby={hint ? `${id}-hint` : undefined}
        aria-disabled={disabled || undefined}
        data-placeholder={placeholder}
        data-empty={empty || undefined}
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={emit}
        onKeyUp={refreshState}
        onMouseUp={refreshState}
        onPaste={(e) => {
          // Paste as plain text so foreign markup and scripts never enter.
          e.preventDefault();
          exec('insertText', e.clipboardData.getData('text/plain'));
          emit();
        }}
        onKeyDown={(e) => {
          if (!(e.metaKey || e.ctrlKey)) return;
          const key = e.key.toLowerCase();
          const map: Record<string, Command> = { b: 'bold', i: 'italic', u: 'underline' };
          if (map[key]) {
            e.preventDefault();
            run(map[key]);
          }
        }}
      />
      {hint && (
        <p className="uui-field__hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
    </div>
  );
}
