/**
 * SignupCountryCode — the dialling-code button beside the cellphone field on
 * the "Signup" board, and the list it opens.
 *
 * The board draws the closed button only. Open, it offers what the live
 * page's CountryCodeCombobox offers, from the same list (authConstants'
 * COUNTRY_CODES): a search box, Southern Africa first, then the rest, and the
 * same wording. Picking one sets the same `countryCode` the live form sends.
 *
 * The board shows a flag picture; the repository has no flag images, so the
 * flag is the live list's emoji, set in the board's 22×15 frame.
 *
 * The list is a Radix popover: it closes on Escape or a click outside and
 * hands focus back to the button. Radix portals it to <body>, outside the
 * page's `.nw-site` wrapper, so the portal carries its own wrapper for the
 * scoped styles, as PressKitDialog's does.
 */
import { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { COUNTRY_CODES, type CountryCode } from '../../components/pages/auth/authConstants';
import { LoginIcon } from './LoginIcons';
import '../styles/login.css';
import '../styles/signup.css';

interface SignupCountryCodeProps {
  value: string;
  onChange: (code: string) => void;
  disabled: boolean;
}

export function SignupCountryCode({ value, onChange, disabled }: SignupCountryCodeProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const selected = COUNTRY_CODES.find((c) => c.code === value);

  const matches = (c: CountryCode) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.code.includes(q);
  };
  const groups = [
    { label: 'Southern Africa', items: COUNTRY_CODES.filter((c) => c.priority && matches(c)) },
    { label: 'Other Countries', items: COUNTRY_CODES.filter((c) => !c.priority && matches(c)) },
  ].filter((group) => group.items.length > 0);

  const choose = (code: string) => {
    onChange(code);
    setOpen(false);
    setSearch('');
  };

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch('');
      }}
    >
      <Popover.Trigger asChild>
        <button
          type="button"
          className="nwsu-cc"
          disabled={disabled}
          aria-label={`Country code: ${selected ? `${selected.name} ` : ''}${value}`}
        >
          <span className="nwsu-flag" aria-hidden="true">
            {selected?.flag}
          </span>
          <span>{value}</span>
          <LoginIcon name="chevronDown" size={14} stroke="#5E6676" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <div className="nw-site nwli nwsu">
          <Popover.Content className="nwsu-pop" align="start" sideOffset={6} collisionPadding={16}>
            <div className="nwsu-pop-search">
              <LoginIcon name="search" size={16} />
              <input
                type="text"
                className="nwsu-pop-input"
                placeholder="Search country..."
                aria-label="Search country"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="nwsu-pop-list">
              {groups.length === 0 && <p className="nwsu-pop-empty">No countries found.</p>}
              {groups.map((group) => (
                <div key={group.label} role="group" aria-label={group.label}>
                  {!search && (
                    <p className="nw-mono nwsu-pop-label" aria-hidden="true">
                      {group.label}
                    </p>
                  )}
                  {group.items.map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      className="nwsu-pop-option"
                      aria-pressed={c.code === value}
                      onClick={() => choose(c.code)}
                    >
                      <span className="nwsu-flag" aria-hidden="true">
                        {c.flag}
                      </span>
                      <span className="nwsu-pop-name">{c.name}</span>
                      <span className="nw-mono nwsu-pop-code">{c.code}</span>
                      <span className="nwsu-pop-tick" aria-hidden="true">
                        {c.code === value && <LoginIcon name="check" size={14} />}
                      </span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </Popover.Content>
        </div>
      </Popover.Portal>
    </Popover.Root>
  );
}
