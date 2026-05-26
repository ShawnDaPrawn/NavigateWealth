import * as React from 'react';

type SearchInputAutofillGuardOptions = {
  id: string;
  role?: React.AriaRole;
  ariaAutocomplete?: React.InputHTMLAttributes<HTMLInputElement>['aria-autocomplete'];
  ariaControls?: string;
  ariaExpanded?: boolean;
};

type SearchInputAutofillGuardProps = React.InputHTMLAttributes<HTMLInputElement> & {
  'data-1p-ignore': 'true';
  'data-lpignore': 'true';
  'data-form-type': 'other';
};

export function useSearchInputAutofillGuard({
  id,
  role,
  ariaAutocomplete,
  ariaControls,
  ariaExpanded,
}: SearchInputAutofillGuardOptions): SearchInputAutofillGuardProps {
  const [readOnly, setReadOnly] = React.useState(true);

  const releaseGuard = React.useCallback<React.FocusEventHandler<HTMLInputElement>>(() => {
    setReadOnly(false);
  }, []);

  return {
    id,
    name: id,
    type: 'text',
    inputMode: 'search',
    enterKeyHint: 'search',
    readOnly,
    autoComplete: 'off',
    autoCorrect: 'off',
    autoCapitalize: 'off',
    spellCheck: false,
    role,
    'aria-autocomplete': ariaAutocomplete,
    'aria-controls': ariaControls,
    'aria-expanded': ariaExpanded,
    'data-1p-ignore': 'true',
    'data-lpignore': 'true',
    'data-form-type': 'other',
    onFocus: releaseGuard,
  };
}
