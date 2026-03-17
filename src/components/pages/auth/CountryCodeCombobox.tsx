/**
 * CountryCodeCombobox — searchable country code selector for the signup form.
 * Prioritises SADC/primary-market countries at the top with a visual separator.
 */

import React, { useState } from 'react';
import { ChevronsUpDown, Check, Search } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover';
import { Button } from '../../ui/button';
import { COUNTRY_CODES, type CountryCode } from './authConstants';

interface CountryCodeComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}

export function CountryCodeCombobox({ value, onValueChange, disabled }: CountryCodeComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selected = COUNTRY_CODES.find((c) => c.code === value);

  const priorityCodes = COUNTRY_CODES.filter((c) => c.priority);
  const otherCodes = COUNTRY_CODES.filter((c) => !c.priority);

  const matchesSearch = (c: CountryCode) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.code.includes(q)
    );
  };

  const filteredPriority = priorityCodes.filter(matchesSearch);
  const filteredOther = otherCodes.filter(matchesSearch);
  const hasResults = filteredPriority.length > 0 || filteredOther.length > 0;

  const handleSelect = (code: string) => {
    onValueChange(code);
    setOpen(false);
    setSearch('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Select country code"
          disabled={disabled}
          className="w-[130px] justify-between px-3 font-normal bg-[var(--input-background)] border-[var(--border)] hover:bg-gray-100"
        >
          <span className="truncate text-sm">
            {selected ? `${selected.flag} ${selected.code}` : '+27'}
          </span>
          <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="start">
        {/* Search input */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
          <Search className="h-4 w-4 text-gray-400 shrink-0" />
          <input
            type="text"
            placeholder="Search country..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-gray-400"
            autoFocus
          />
        </div>

        <div className="max-h-[260px] overflow-y-auto">
          {!hasResults && (
            <div className="py-6 text-center text-sm text-gray-500">No countries found.</div>
          )}

          {/* Priority countries */}
          {filteredPriority.length > 0 && (
            <div className="py-1">
              {!search && (
                <div className="px-3 py-1.5 text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                  Southern Africa
                </div>
              )}
              {filteredPriority.map((c) => (
                <button
                  key={`priority-${c.code}`}
                  onClick={() => handleSelect(c.code)}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-sm hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <span className="text-base leading-none">{c.flag}</span>
                  <span className="flex-1 text-left truncate">{c.name}</span>
                  <span className="text-gray-500 text-xs tabular-nums">{c.code}</span>
                  {value === c.code && (
                    <Check className="h-3.5 w-3.5 text-purple-700 shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Separator */}
          {filteredPriority.length > 0 && filteredOther.length > 0 && (
            <div className="border-t border-gray-100" />
          )}

          {/* Other countries */}
          {filteredOther.length > 0 && (
            <div className="py-1">
              {!search && (
                <div className="px-3 py-1.5 text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                  Other Countries
                </div>
              )}
              {filteredOther.map((c) => (
                <button
                  key={`other-${c.code}`}
                  onClick={() => handleSelect(c.code)}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-sm hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <span className="text-base leading-none">{c.flag}</span>
                  <span className="flex-1 text-left truncate">{c.name}</span>
                  <span className="text-gray-500 text-xs tabular-nums">{c.code}</span>
                  {value === c.code && (
                    <Check className="h-3.5 w-3.5 text-purple-700 shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
