/**
 * GlobalSearch - Account Search Command Palette
 */

import * as React from 'react';
import {
  Search,
  Users,
  UserCog,
  User,
  Loader2,
} from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '../../ui/command';
import { Badge } from '../../ui/badge';
import { useGlobalSearchData } from './useGlobalSearchData';
import { useAdminNavigation } from './AdminNavigationContext';
import type { SearchableAccount } from './useGlobalSearchData';

const STATUS_BADGE_CONFIG: Record<string, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-green-100 text-green-700 border-green-200' },
  approved: { label: 'Active', className: 'bg-green-100 text-green-700 border-green-200' },
  suspended: { label: 'Suspended', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  closed: { label: 'Closed', className: 'bg-red-100 text-red-700 border-red-200' },
  pending: { label: 'Pending', className: 'bg-blue-100 text-blue-700 border-blue-200' },
};

function getStatusBadge(status: string | undefined | null) {
  const key = (status ?? 'unknown').trim().toLowerCase() || 'unknown';
  return STATUS_BADGE_CONFIG[key] ?? {
    label: key.charAt(0).toUpperCase() + key.slice(1),
    className: 'bg-gray-100 text-gray-700 border-gray-200',
  };
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = React.useState(value);

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

export function GlobalSearch() {
  const [open, setOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState('');
  const debouncedSearch = useDebouncedValue(searchValue, 250);
  const { navigateToAccount } = useAdminNavigation();
  const { clients, personnel, isLoading, hasSearchQuery } = useGlobalSearchData(open, debouncedSearch);

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  React.useEffect(() => {
    if (!open) {
      setSearchValue('');
    }
  }, [open]);

  const handleSelect = React.useCallback(
    (account: SearchableAccount) => {
      setOpen(false);
      navigateToAccount(account.type, account.id);
    },
    [navigateToAccount],
  );

  return (
    <div className="contents">
      <button
        onClick={() => setOpen(true)}
        className="hidden lg:flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground bg-muted/50 hover:bg-muted/80 rounded-md border border-transparent hover:border-border transition-colors w-full max-w-sm"
        aria-label="Search accounts (Cmd+K)"
      >
        <Search className="h-4 w-4" />
        <span className="text-muted-foreground">Search accounts...</span>
        <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100 ml-auto">
          <span className="text-xs">{'\u2318'}</span>K
        </kbd>
      </button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Account Search"
        description="Search for client and personnel accounts by name or email."
      >
        <CommandInput
          placeholder="Search by name or email..."
          value={searchValue}
          onValueChange={setSearchValue}
        />
        <CommandList className="max-h-[400px]">
          {!hasSearchQuery ? (
            <div className="flex flex-col items-center justify-center py-8 gap-1 text-center">
              <Search className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">Search clients and personnel</p>
              <p className="text-xs text-muted-foreground/70">Type at least 2 characters to start</p>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-8 gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Searching accounts...</span>
            </div>
          ) : (
            <div className="contents">
              <CommandEmpty>
                <div className="flex flex-col items-center gap-1 py-2">
                  <Search className="h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm font-medium text-muted-foreground">No accounts found</p>
                  <p className="text-xs text-muted-foreground/70">
                    Try a different name or email address
                  </p>
                </div>
              </CommandEmpty>

              {clients.length > 0 && (
                <CommandGroup heading="Clients">
                  {clients.map((account) => (
                    <AccountItem
                      key={account.id}
                      account={account}
                      onSelect={handleSelect}
                    />
                  ))}
                </CommandGroup>
              )}

              {clients.length > 0 && personnel.length > 0 && <CommandSeparator />}

              {personnel.length > 0 && (
                <CommandGroup heading="Personnel">
                  {personnel.map((account) => (
                    <AccountItem
                      key={account.id}
                      account={account}
                      onSelect={handleSelect}
                    />
                  ))}
                </CommandGroup>
              )}
            </div>
          )}
        </CommandList>

        <div className="flex items-center justify-between border-t px-3 py-2 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3">
            {hasSearchQuery ? (
              <div className="contents">
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" /> {clients.length} clients
                </span>
                <span className="flex items-center gap-1">
                  <UserCog className="h-3 w-3" /> {personnel.length} personnel
                </span>
              </div>
            ) : (
              <span className="text-muted-foreground/80">Start typing to search</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <kbd className="inline-flex h-4 items-center rounded border bg-muted px-1 font-mono text-[10px]">{'\u2191\u2193'}</kbd>
            <span>navigate</span>
            <kbd className="inline-flex h-4 items-center rounded border bg-muted px-1 font-mono text-[10px] ml-1">{'\u21B5'}</kbd>
            <span>open</span>
            <kbd className="inline-flex h-4 items-center rounded border bg-muted px-1 font-mono text-[10px] ml-1">esc</kbd>
            <span>close</span>
          </div>
        </div>
      </CommandDialog>
    </div>
  );
}

interface AccountItemProps {
  account: SearchableAccount;
  onSelect: (account: SearchableAccount) => void;
}

function AccountItem({ account, onSelect }: AccountItemProps) {
  const statusBadge = getStatusBadge(account.status);
  const Icon = account.type === 'client' ? User : UserCog;
  const displayName = `${account.firstName} ${account.lastName}`;

  return (
    <CommandItem
      value={`${displayName} ${account.email}`}
      onSelect={() => onSelect(account)}
      className="flex items-center gap-3 py-2.5 px-2 cursor-pointer"
    >
      <div className="flex items-center justify-center h-8 w-8 rounded-full bg-gray-100 shrink-0">
        <Icon className="h-4 w-4 text-gray-500" />
      </div>

      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-sm font-medium text-gray-900 truncate">{displayName}</span>
        <span className="text-xs text-muted-foreground truncate">{account.email}</span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {account.type === 'personnel' && (
          <span className="text-xs text-muted-foreground">{account.meta}</span>
        )}
        <Badge
          variant="outline"
          className={`text-[10px] px-1.5 py-0 h-5 font-medium ${statusBadge.className}`}
        >
          {statusBadge.label}
        </Badge>
      </div>
    </CommandItem>
  );
}

