import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import {
  aiAccessLabels,
  credentialKinds,
  type AiAccess,
  type Collection,
  type VaultSummary,
} from '../../../shared/password-manager';
import { DsPill, type DsTone } from '../layout/page/ds';
import { collectionName, collectionOf } from './vaultFilters';
import { formatDay, healthIssues, hostOf } from './ui';

const accessTone: Record<AiAccess, DsTone> = {
  never: 'neutral',
  find: 'info',
  use: 'brand',
  reveal: 'warn',
};

export function AiAccessPill({ access }: { access: AiAccess | undefined }) {
  const value = access ?? 'never';
  return <DsPill tone={accessTone[value]}>{aiAccessLabels[value] ?? value}</DsPill>;
}

export function HealthPill({ item }: { item: VaultSummary }) {
  const issues = healthIssues(item.health);
  return issues.length ? (
    <DsPill tone="bad">{issues.join(', ')}</DsPill>
  ) : (
    <DsPill tone="ok">Healthy</DsPill>
  );
}

export default function VaultTable({
  items,
  collections,
  onOpen,
}: {
  items: VaultSummary[];
  collections: Collection[];
  onOpen: (item: VaultSummary) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Username</TableHead>
          <TableHead>Collection</TableHead>
          <TableHead>AI access</TableHead>
          <TableHead>Health</TableHead>
          <TableHead>Changed</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id} className="cursor-pointer" onClick={() => onOpen(item)}>
            <TableCell className="max-w-[16rem]">
              <button
                type="button"
                className="block max-w-full truncate text-left font-medium hover:underline"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpen(item);
                }}
              >
                {item.name || hostOf(item.url)}
              </button>
              <span className="block truncate text-xs text-muted-foreground">
                {hostOf(item.url)}
              </span>
            </TableCell>
            <TableCell className="max-w-[12rem]">
              <span className="block truncate">{item.username || '—'}</span>
              <span className="block text-xs text-muted-foreground">
                {credentialKinds[item.kind ?? 'login']}
              </span>
            </TableCell>
            <TableCell>{collectionName(collections, collectionOf(item))}</TableCell>
            <TableCell>
              <AiAccessPill access={item.aiAccess} />
            </TableCell>
            <TableCell>
              <HealthPill item={item} />
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {formatDay(item.passwordChangedAt, '—')}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
