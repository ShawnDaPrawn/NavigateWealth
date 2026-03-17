/**
 * External Providers Section — FSPs the client may hold policies with
 *
 * §7  — Presentation only; no business logic.
 * §5.3 — Provider list from centralised constants.
 * §8.3 — Follows admin panel card/badge conventions.
 *
 * Displays checkboxes for SA's most common FSPs and allows free-text
 * entry for unlisted providers. Data is persisted to application_data
 * via the existing amendment flow.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Badge } from '../../../../ui/badge';
import { Input } from '../../../../ui/input';
import { Button } from '../../../../ui/button';
import { Label } from '../../../../ui/label';
import { Checkbox } from '../../../../ui/checkbox';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../../../ui/tooltip';
import {
  Building2,
  Plus,
  X,
  Search,
  Info,
} from 'lucide-react';
import {
  SA_FINANCIAL_PROVIDERS,
  SA_PROVIDER_MAP,
} from '../constants';
import type { FinancialServiceProvider } from '../constants';

// ── Group providers by category for display ──────────────────────────

const PROVIDER_GROUPS = SA_FINANCIAL_PROVIDERS.reduce<Record<string, FinancialServiceProvider[]>>(
  (acc, p) => {
    (acc[p.category] ??= []).push(p);
    return acc;
  },
  {},
);

// ── Unique category ordering (preserves insertion order from constant) ──
const CATEGORY_ORDER = [...new Set(SA_FINANCIAL_PROVIDERS.map((p) => p.category))];

// ── Props ────────────────────────────────────────────────────────────

interface ExternalProvidersSectionProps {
  /** Currently selected provider IDs (from SA_FINANCIAL_PROVIDERS) */
  selectedProviders: string[];
  /** Custom (free-text) provider names not in the pre-defined list */
  customProviders: string[];
  /** Whether the section is in edit mode */
  isEditing: boolean;
  /** Callback when selected providers change (edit mode) */
  onProvidersChange?: (providers: string[]) => void;
  /** Callback when custom providers change (edit mode) */
  onCustomProvidersChange?: (providers: string[]) => void;
}

// ── Component ────────────────────────────────────────────────────────

export function ExternalProvidersSection({
  selectedProviders,
  customProviders,
  isEditing,
  onProvidersChange,
  onCustomProvidersChange,
}: ExternalProvidersSectionProps) {
  const [searchFilter, setSearchFilter] = useState('');
  const [customInput, setCustomInput] = useState('');

  const totalCount = selectedProviders.length + customProviders.length;

  // Toggle a pre-defined provider
  const toggleProvider = useCallback(
    (providerId: string) => {
      if (!onProvidersChange) return;
      const next = selectedProviders.includes(providerId)
        ? selectedProviders.filter((id) => id !== providerId)
        : [...selectedProviders, providerId];
      onProvidersChange(next);
    },
    [selectedProviders, onProvidersChange],
  );

  // Add a custom provider
  const addCustomProvider = useCallback(() => {
    const trimmed = customInput.trim();
    if (!trimmed || !onCustomProvidersChange) return;

    // Prevent duplicates (case-insensitive)
    const exists =
      customProviders.some((p) => p.toLowerCase() === trimmed.toLowerCase()) ||
      SA_FINANCIAL_PROVIDERS.some((p) => p.name.toLowerCase() === trimmed.toLowerCase());

    if (exists) {
      setCustomInput('');
      return;
    }

    onCustomProvidersChange([...customProviders, trimmed]);
    setCustomInput('');
  }, [customInput, customProviders, onCustomProvidersChange]);

  // Remove a custom provider
  const removeCustomProvider = useCallback(
    (name: string) => {
      if (!onCustomProvidersChange) return;
      onCustomProvidersChange(customProviders.filter((p) => p !== name));
    },
    [customProviders, onCustomProvidersChange],
  );

  // Filtered providers for search
  const filteredGroups = useMemo(() => {
    if (!searchFilter.trim()) return PROVIDER_GROUPS;
    const q = searchFilter.toLowerCase();
    const result: Record<string, FinancialServiceProvider[]> = {};
    for (const [category, providers] of Object.entries(PROVIDER_GROUPS)) {
      const filtered = providers.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q),
      );
      if (filtered.length > 0) result[category] = filtered;
    }
    return result;
  }, [searchFilter]);

  // ── View Mode ──────────────────────────────────────────────────────
  if (!isEditing) {
    if (totalCount === 0) {
      return (
        <div className="text-sm text-gray-300 italic">
          No external providers recorded
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {selectedProviders.map((id) => {
            const provider = SA_PROVIDER_MAP[id];
            if (!provider) return null;
            return (
              <div
                key={id}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-gray-200 bg-gradient-to-r from-purple-50/40 to-white"
              >
                <div className="h-7 w-7 rounded-lg bg-purple-100/80 flex items-center justify-center shrink-0">
                  <Building2 className="h-3.5 w-3.5 text-purple-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{provider.name}</p>
                  <p className="text-[10px] text-gray-400">{provider.category}</p>
                </div>
              </div>
            );
          })}

          {customProviders.map((name) => (
            <div
              key={`custom-${name}`}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-dashed border-gray-300 bg-gradient-to-r from-gray-50/40 to-white"
            >
              <div className="h-7 w-7 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                <Building2 className="h-3.5 w-3.5 text-gray-500" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">{name}</p>
                <p className="text-[10px] text-gray-400">Custom Provider</p>
              </div>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-gray-400 flex items-center gap-1.5">
          <Info className="h-3 w-3 shrink-0" />
          These are financial service providers the client may hold existing policies with. This helps advisers identify where to look for existing cover.
        </p>
      </div>
    );
  }

  // ── Edit Mode ──────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Search filter */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
        <Input
          placeholder="Filter providers..."
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          className="pl-8 h-8 text-sm bg-gray-50/60 border-gray-200"
        />
      </div>

      {/* Provider checkboxes grouped by category */}
      <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
        {CATEGORY_ORDER.filter((cat) => filteredGroups[cat]).map((category) => (
          <div key={category}>
            <Label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1.5 block">
              {category}
            </Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
              {filteredGroups[category].map((provider) => {
                const isChecked = selectedProviders.includes(provider.id);
                return (
                  <label
                    key={provider.id}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-all text-sm ${
                      isChecked
                        ? 'border-purple-300 bg-purple-50/60 text-purple-900 shadow-sm'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/50 text-gray-700'
                    }`}
                  >
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => toggleProvider(provider.id)}
                      className="data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
                    />
                    <span className="font-medium truncate">{provider.name}</span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}

        {Object.keys(filteredGroups).length === 0 && (
          <div className="text-center py-4 text-sm text-gray-400">
            No providers match "{searchFilter}"
          </div>
        )}
      </div>

      {/* Custom provider input */}
      <div className="border-t border-gray-100 pt-3">
        <Label className="text-[11px] text-gray-400 uppercase tracking-wider font-medium mb-1.5 block">
          Add Unlisted Provider
        </Label>
        <div className="flex items-center gap-2">
          <Input
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            placeholder="Type provider name..."
            className="h-8 text-sm bg-gray-50/60 border-gray-200 flex-1"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCustomProvider();
              }
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1 text-xs shrink-0"
            onClick={addCustomProvider}
            disabled={!customInput.trim()}
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </Button>
        </div>

        {/* Custom providers list */}
        {customProviders.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {customProviders.map((name) => (
              <Badge
                key={name}
                className="text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200 pl-2.5 pr-1 py-0.5 gap-1"
              >
                {name}
                <button
                  type="button"
                  onClick={() => removeCustomProvider(name)}
                  className="ml-0.5 rounded-full hover:bg-gray-300/50 p-0.5 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Selected summary */}
      {totalCount > 0 && (
        <div className="text-[11px] text-gray-400 flex items-center gap-1.5 pt-1">
          <Info className="h-3 w-3 shrink-0" />
          {totalCount} provider{totalCount !== 1 ? 's' : ''} selected
          ({selectedProviders.length} from list, {customProviders.length} custom)
        </div>
      )}
    </div>
  );
}
