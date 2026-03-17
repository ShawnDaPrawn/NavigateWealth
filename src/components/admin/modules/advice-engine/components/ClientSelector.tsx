/**
 * ClientSelector Component
 * 
 * Client search and selection dropdown.
 * Supports debounced search with live results.
 * 
 * @module advice-engine/components/ClientSelector
 */

import React from 'react';
import { Search, X, User, Loader2, Check } from 'lucide-react';
import { Input } from '../../../../ui/input';
import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../../../../ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../../../ui/popover';
import { formatClientDisplay, formatClientName, getClientInitials } from '../utils';
import type { ClientSelectorProps } from '../types';

/**
 * Client selector with search
 * 
 * @example
 * <ClientSelector
 *   searchTerm={searchTerm}
 *   onSearchChange={setSearchTerm}
 *   results={results}
 *   isSearching={false}
 *   selectedClient={client}
 *   onSelectClient={handleSelect}
 * />
 */
export function ClientSelector({
  searchTerm,
  onSearchChange,
  results,
  isSearching = false,
  selectedClient,
  onSelectClient,
  placeholder = 'Search clients...',
}: ClientSelectorProps) {
  const [open, setOpen] = React.useState(false);

  const handleSelect = (client: ClientSelectorProps['results'][number]) => {
    onSelectClient(client);
    setOpen(false);
  };

  const handleClear = () => {
    onSelectClient(null);
    onSearchChange('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[250px] justify-between bg-background h-9 text-sm"
        >
          {selectedClient ? (
            <div className="flex items-center gap-2 truncate">
              <div className="h-5 w-5 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0 text-violet-700 font-medium text-[10px]">
                {getClientInitials(selectedClient)}
              </div>
              <span className="truncate">{formatClientName(selectedClient)}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="end">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search clients..."
            value={searchTerm}
            onValueChange={onSearchChange}
          />
          <CommandList>
            {isSearching && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">
                  Searching...
                </span>
              </div>
            )}

            {!isSearching && searchTerm.length < 2 && (
              <CommandEmpty>
                Type at least 2 characters to search
              </CommandEmpty>
            )}

            {!isSearching && searchTerm.length >= 2 && results.length === 0 && (
              <CommandEmpty>No clients found</CommandEmpty>
            )}

            {!isSearching && results.length > 0 && (
              <CommandGroup heading="Clients">
                {results.map((client) => (
                  <CommandItem
                    key={client.user_id}
                    value={client.user_id}
                    onSelect={() => handleSelect(client)}
                    className="flex items-center gap-2"
                  >
                    <div className="h-6 w-6 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-[10px] font-medium text-gray-600">
                        {getClientInitials(client)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {formatClientName(client)}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {client.email}
                      </p>
                    </div>
                    {selectedClient?.user_id === client.user_id && (
                      <Check className="h-4 w-4 text-violet-600" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
          {selectedClient && (
            <div className="p-1 border-t">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start h-8 text-xs font-normal"
                onClick={handleClear}
              >
                <X className="mr-2 h-3 w-3" />
                Clear Selection
              </Button>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}