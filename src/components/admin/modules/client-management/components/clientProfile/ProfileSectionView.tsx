/**
 * Read-only view of the Personal info and Contact details sections (design:
 * CM 6, CM 27 — a section card with Edit). Edit swaps in the existing form.
 */
import { useState } from 'react';
import { Check, Copy, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../../../ui/button';
import { copyToClipboard } from '../../../../../../utils/clipboard';
import type { ReactNode } from 'react';
import type { RowGroup, TableSpec } from './profileSectionRows';

const NOT_PROVIDED = 'Not provided';

function CopyValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await copyToClipboard(value);
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };
  return (
    <button
      type="button"
      onClick={() => void copy()}
      className="ml-1.5 rounded p-0.5 text-nw-text-3 hover:text-nw-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nw-violet/60"
      aria-label={`Copy ${value}`}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-600" aria-hidden="true" />
      ) : (
        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
      )}
    </button>
  );
}

/** A section card in view mode: title, Edit, then label / value rows. */
export function ProfileSectionView({
  title,
  groups = [],
  tables = [],
  actions,
  onEdit,
  canEdit = true,
}: {
  title: string;
  groups?: RowGroup[];
  tables?: TableSpec[];
  /** Extra header buttons before Edit (e.g. Add family member). */
  actions?: ReactNode;
  onEdit: () => void;
  canEdit?: boolean;
}) {
  return (
    <section aria-label={title} className="rounded-xl border border-nw-line bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-nw-line-2 px-5 py-3.5">
        <h2 className="text-[15px] font-semibold text-nw-ink">{title}</h2>
        <div className="flex flex-wrap gap-2">
          {actions}
          {canEdit && (
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              Edit
            </Button>
          )}
        </div>
      </div>
      {groups.map((group, i) => (
        <div key={group.title ?? i} className="border-b border-nw-line-2 px-5 py-4 last:border-b-0">
          {group.title && (
            <h3 className="mb-3 text-[13px] font-semibold text-nw-text-2">{group.title}</h3>
          )}
          <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
            {group.rows.map((row) => (
              <div key={row.label} className="flex flex-col">
                <dt className="text-xs text-nw-text-3">{row.label}</dt>
                <dd className="flex items-center text-sm text-nw-ink">
                  {row.value ? (
                    <>
                      {row.value}
                      {row.copy && <CopyValue value={row.value} />}
                    </>
                  ) : (
                    <span className="text-nw-text-3">{NOT_PROVIDED}</span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
      {tables.map((table, i) => (
        <div key={table.title ?? i} className="border-b border-nw-line-2 last:border-b-0">
          {(table.title || table.description) && (
            <div className="px-5 pt-4">
              {table.title && (
                <h3 className="text-[13px] font-semibold text-nw-text-2">{table.title}</h3>
              )}
              {table.description && <p className="text-sm text-nw-text-3">{table.description}</p>}
            </div>
          )}
          {table.rows.length === 0 ? (
            <p className="px-5 py-4 text-sm text-nw-text-3">{table.emptyText}</p>
          ) : (
            <div className="overflow-x-auto px-5 py-3">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-nw-text-3">
                    {table.columns.map((c) => (
                      <th key={c} className="py-2 pr-4 font-medium">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-nw-line-2">
                  {table.rows.map((row, r) => (
                    <tr key={r}>
                      {row.map((cell, c) => (
                        <td key={c} className="py-2 pr-4 text-nw-ink">
                          {cell || <span className="text-nw-text-3">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
