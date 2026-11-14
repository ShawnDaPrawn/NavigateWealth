/**
 * Universal Key Manager
 * Centralized reference for all keys in the Navigate Wealth platform.
 *
 * Layout follows the PM-K boards: a short meta line, the key-type segmented
 * control, then one card with a toolbar (search, Category and Type chips) and
 * a table of keys.
 */

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Tabs } from '../../../ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../ui/table';
import {
  DsButton,
  DsChipSelect,
  SegmentedList,
  SegmentedTrigger,
  useBreadcrumbTrail,
  useUrlState,
} from '../../layout/page';
import type { ProductKey, ProductKeyCategory } from '@/shared/types/product-keys';
import { KeyAPI } from './key-manager';

const KEY_VIEWS = [
  'client-keys',
  'product-keys',
  'calculated-keys',
  'fna-recommendations',
  'key-usage',
] as const;
type KeyView = (typeof KEY_VIEWS)[number];
const KEY_VIEW_LABELS: Record<KeyView, string> = {
  'client-keys': 'Client keys',
  'product-keys': 'Product keys',
  'calculated-keys': 'Calculated keys',
  'fna-recommendations': 'FNA recommendations',
  'key-usage': 'Key usage',
};

const DATA_TYPE_LABELS: Record<string, string> = {
  number: 'Number',
  currency: 'Currency',
  percentage: 'Percentage',
  date: 'Date',
  text: 'Text',
  boolean: 'Yes / no',
};
const typeLabel = (t: string) => DATA_TYPE_LABELS[t] ?? t;

const categoryName = (id: string) => KeyAPI.KEY_CATEGORIES.find((c) => c.id === id)?.name ?? id;

/** How many "used in" places to list before folding the rest behind Show. */
const USAGE_PREVIEW = 3;

async function copyKey(id: string) {
  try {
    await navigator.clipboard.writeText(id);
    toast.success(`Copied ${id}`);
  } catch {
    toast.error('Could not copy the key');
  }
}

function KeyId({ id }: { id: string }) {
  return <code className="font-mono text-[12.5px] text-nw-ink">{id}</code>;
}

function CopyCell({ id }: { id: string }) {
  return (
    <TableCell className="w-[80px] text-right">
      <DsButton
        size="sm"
        variant="ghost"
        onClick={() => void copyKey(id)}
        aria-label={`Copy ${id}`}
      >
        Copy
      </DsButton>
    </TableCell>
  );
}

function EmptyRow({ colSpan }: { colSpan: number }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="h-24 text-center text-nw-text-3">
        No keys match these filters.
      </TableCell>
    </TableRow>
  );
}

export function UniversalKeyManager() {
  // The key type is part of where you are, so it lives in the address (?keys=key-usage).
  const [keyView, setKeyView] = useUrlState<KeyView>('keys', 'client-keys', KEY_VIEWS);
  useBreadcrumbTrail([{ label: 'Key manager' }, { label: KEY_VIEW_LABELS[keyView] }]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ProductKeyCategory | 'all'>('all');
  const [selectedDataType, setSelectedDataType] = useState<string>('all');
  const [expandedUsage, setExpandedUsage] = useState<Set<string>>(() => new Set());

  const hasKeys = KeyAPI.getKeyCount() > 0;

  const filteredKeys = useMemo(() => {
    if (!hasKeys) return [];
    return KeyAPI.filterKeys({
      category: selectedCategory,
      dataType: selectedDataType,
      searchTerm,
    });
  }, [searchTerm, selectedCategory, selectedDataType, hasKeys]);

  const individualKeys = useMemo(() => KeyAPI.getIndividualKeys(filteredKeys), [filteredKeys]);

  const viewKeys: ProductKey[] = useMemo(() => {
    switch (keyView) {
      case 'client-keys':
        return individualKeys.filter((key) => KeyAPI.isClientProfileKey(key));
      case 'product-keys':
        return individualKeys.filter((key) => !KeyAPI.isClientProfileKey(key));
      case 'calculated-keys':
        return KeyAPI.getCalculatedKeys(filteredKeys).filter(
          (key) => !key.isRecommendation && !KeyAPI.isClientProfileKey(key),
        );
      case 'fna-recommendations':
        return filteredKeys.filter((key) => key.isRecommendation);
      case 'key-usage':
        return filteredKeys.filter((key) => (KeyAPI.KEY_USAGE_MAP[key.id]?.length ?? 0) > 0);
    }
  }, [keyView, individualKeys, filteredKeys]);

  // Category chip options: the categories present in this key type, with counts.
  const categoryOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const key of viewKeys) counts.set(key.category, (counts.get(key.category) ?? 0) + 1);
    return KeyAPI.KEY_CATEGORIES.filter((c) => counts.has(c.id) || c.id === selectedCategory).map(
      (c) => ({ value: c.id, label: c.name, count: counts.get(c.id) ?? 0 }),
    );
  }, [viewKeys, selectedCategory]);

  const typeOptions = KeyAPI.getDataTypes().map((t) => ({ value: t, label: typeLabel(t) }));

  const toggleUsage = (id: string) =>
    setExpandedUsage((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const renderRows = () => {
    if (keyView === 'key-usage') {
      if (viewKeys.length === 0) return <EmptyRow colSpan={4} />;
      return viewKeys.map((key) => {
        const usage = KeyAPI.getKeyUsage(key.id);
        const open = expandedUsage.has(key.id);
        const shown = open ? usage : usage.slice(0, USAGE_PREVIEW);
        const rest = usage.length - shown.length;
        return (
          <TableRow key={key.id}>
            <TableCell>
              <KeyId id={key.id} />
              <div className="ds-meta">{key.name}</div>
            </TableCell>
            <TableCell className="text-nw-text-2">
              {shown.join(', ')}
              {rest > 0 && <span className="ds-meta"> +{rest} more</span>}
            </TableCell>
            <TableCell className="tabular-nums">{usage.length}</TableCell>
            <TableCell className="w-[80px] text-right">
              {usage.length > USAGE_PREVIEW && (
                <DsButton
                  size="sm"
                  variant="ghost"
                  aria-expanded={open}
                  onClick={() => toggleUsage(key.id)}
                >
                  {open ? 'Less' : 'Show'}
                </DsButton>
              )}
            </TableCell>
          </TableRow>
        );
      });
    }

    if (viewKeys.length === 0) return <EmptyRow colSpan={5} />;
    return viewKeys.map((key) => {
      let third: string = categoryName(key.category);
      if (keyView === 'calculated-keys') {
        const from = KeyAPI.getKeyDependencyNames(key.id);
        third = from.length > 0 ? `Sum of ${from.join(', ')}` : '—';
      }
      return (
        <TableRow key={key.id}>
          <TableCell>
            <KeyId id={key.id} />
          </TableCell>
          <TableCell title={key.description || undefined}>{key.name}</TableCell>
          <TableCell className="text-nw-text-2">{third}</TableCell>
          <TableCell className="text-nw-text-2">{typeLabel(key.dataType)}</TableCell>
          <CopyCell id={key.id} />
        </TableRow>
      );
    });
  };

  const thirdHeading =
    keyView === 'calculated-keys'
      ? 'Calculated from'
      : keyView === 'fna-recommendations'
        ? 'FNA'
        : 'Category';

  return (
    <div className="space-y-4">
      {!hasKeys && (
        <div className="ds-notice attn" role="alert">
          <div className="grow">
            <b>Key data failed to load.</b> Refresh the page; if it keeps happening, contact
            support.
          </div>
        </div>
      )}

      <p className="ds-meta">
        The shared dictionary of data keys used by forms, FNAs, documents and product fields.
      </p>

      <Tabs value={keyView} onValueChange={(v) => setKeyView(v as KeyView)} className="space-y-4">
        <SegmentedList aria-label="Key types">
          {KEY_VIEWS.map((v) => (
            <SegmentedTrigger key={v} value={v}>
              {KEY_VIEW_LABELS[v]}
            </SegmentedTrigger>
          ))}
        </SegmentedList>

        <section className="ds-card overflow-hidden">
          <div className="ds-toolbar flex-wrap">
            <input
              className="ds-input min-w-0 sm:min-w-[300px]"
              placeholder="Search by name, ID or description…"
              aria-label="Search keys"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <DsChipSelect
              label="Category"
              anyLabel="Any category"
              value={selectedCategory}
              options={categoryOptions}
              onChange={(v) => setSelectedCategory(v as ProductKeyCategory | 'all')}
            />
            <DsChipSelect
              label="Type"
              anyLabel="Any type"
              value={selectedDataType}
              options={typeOptions}
              onChange={setSelectedDataType}
            />
            <span className="grow" />
            <span className="ds-meta tabular-nums">
              {viewKeys.length} {viewKeys.length === 1 ? 'key' : 'keys'}
            </span>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                {keyView === 'key-usage' ? (
                  <TableRow>
                    <TableHead>Key</TableHead>
                    <TableHead>Used in</TableHead>
                    <TableHead>Places</TableHead>
                    <TableHead>
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                ) : (
                  <TableRow>
                    <TableHead>Key</TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead>{thirdHeading}</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                )}
              </TableHeader>
              <TableBody>{renderRows()}</TableBody>
            </Table>
          </div>
        </section>
      </Tabs>
    </div>
  );
}
