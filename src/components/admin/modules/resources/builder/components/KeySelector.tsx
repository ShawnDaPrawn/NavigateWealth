import React, { useState, useMemo } from 'react';
import { Check, ChevronsUpDown, Search, Database, UserCircle, Calculator, Target } from 'lucide-react';
import { cn } from '../../../../../ui/utils';
import { Button } from '../../../../../ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '../../../../../ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../../../../ui/popover';
import { Badge } from '../../../../../ui/badge';
import { KeyAPI } from '../../key-manager/api';
import { ProductKey } from '../../../product-management/types';

interface KeySelectorProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function KeySelector({ value, onChange, placeholder = "Select key...", className }: KeySelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const allKeys = useMemo(() => KeyAPI.getAllKeys(), []);
  const selectedKey = allKeys.find((key) => key.id === value);

  // Filter keys based on search
  const filteredKeys = useMemo(() => {
    if (!search) return allKeys;
    const lowerSearch = search.toLowerCase();
    return allKeys.filter(key => 
      key.name.toLowerCase().includes(lowerSearch) || 
      key.id.toLowerCase().includes(lowerSearch) ||
      key.description.toLowerCase().includes(lowerSearch)
    );
  }, [allKeys, search]);

  // Group keys
  const groups = useMemo(() => {
    const g = {
      profile: [] as ProductKey[],
      product: [] as ProductKey[],
      calculated: [] as ProductKey[],
      recommendation: [] as ProductKey[],
    };

    filteredKeys.forEach(key => {
      if (KeyAPI.isClientProfileKey(key)) {
        g.profile.push(key);
      } else if (key.isRecommendation) {
        g.recommendation.push(key);
      } else if (key.isCalculated) {
        g.calculated.push(key);
      } else {
        g.product.push(key);
      }
    });

    return g;
  }, [filteredKeys]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between h-9 text-xs", !value && "text-muted-foreground", className)}
        >
          {selectedKey ? (
            <div className="flex items-center gap-2 truncate">
              {getKeyIcon(selectedKey)}
              <span className="truncate">{selectedKey.name}</span>
            </div>
          ) : (
            placeholder
          )}
          <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder="Search keys..." 
            value={search}
            onValueChange={setSearch}
            className="h-9 text-xs"
          />
          <CommandList className="max-h-[300px]">
            <CommandEmpty>No keys found.</CommandEmpty>
            
            {groups.profile.length > 0 && (
              <CommandGroup heading="Client Profile">
                {groups.profile.map(key => (
                  <KeyItem key={key.id} productKey={key} selected={value === key.id} onSelect={() => { onChange(key.id); setOpen(false); }} />
                ))}
              </CommandGroup>
            )}

            {groups.recommendation.length > 0 && (
              <CommandGroup heading="FNA Recommendations">
                {groups.recommendation.map(key => (
                  <KeyItem key={key.id} productKey={key} selected={value === key.id} onSelect={() => { onChange(key.id); setOpen(false); }} />
                ))}
              </CommandGroup>
            )}

            {groups.product.length > 0 && (
              <CommandGroup heading="Product Keys">
                {groups.product.map(key => (
                  <KeyItem key={key.id} productKey={key} selected={value === key.id} onSelect={() => { onChange(key.id); setOpen(false); }} />
                ))}
              </CommandGroup>
            )}

            {groups.calculated.length > 0 && (
              <CommandGroup heading="Calculated Totals">
                {groups.calculated.map(key => (
                  <KeyItem key={key.id} productKey={key} selected={value === key.id} onSelect={() => { onChange(key.id); setOpen(false); }} />
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function KeyItem({ productKey, selected, onSelect }: { productKey: ProductKey, selected: boolean, onSelect: () => void }) {
  return (
    <CommandItem
      value={productKey.id}
      onSelect={onSelect}
      className="text-xs"
    >
      <div className="flex items-center gap-2 w-full overflow-hidden">
        {getKeyIcon(productKey)}
        <div className="flex flex-col flex-1 overflow-hidden">
          <span className="truncate font-medium">{productKey.name}</span>
          <span className="truncate text-[10px] text-muted-foreground">{productKey.description}</span>
        </div>
        {selected && <Check className="ml-auto h-3 w-3 opacity-100" />}
        <Badge variant="outline" className="ml-1 text-[9px] h-4 px-1">{productKey.dataType}</Badge>
      </div>
    </CommandItem>
  );
}

function getKeyIcon(key: ProductKey) {
  if (KeyAPI.isClientProfileKey(key)) return <UserCircle className="h-3 w-3 text-blue-500" />;
  if (key.isRecommendation) return <Target className="h-3 w-3 text-purple-500" />;
  if (key.isCalculated) return <Calculator className="h-3 w-3 text-amber-500" />;
  return <Database className="h-3 w-3 text-slate-500" />;
}
