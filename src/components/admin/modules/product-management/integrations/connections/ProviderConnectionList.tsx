/**
 * The provider list, led by whether the provider actually works.
 * =============================================================
 *
 * This replaces a list whose badge read "Active" off the last sync attempt.
 * That badge was the single most misleading thing in the module: a provider
 * whose password expired weeks ago and a provider nobody had ever configured
 * both showed the same grey "Not Synced", and a provider whose last spreadsheet
 * import worked showed "Active" however broken its portal was.
 *
 * What replaces it answers one question — can we get in? — and puts the one
 * action that would change the answer next to it.
 */
import { Badge } from '../../../../../ui/badge';
import { Button } from '../../../../../ui/button';
import { AlertCircle, CheckCircle2, Loader2, Plug, Trash2 } from 'lucide-react';
import { cn } from '../../../../../ui/utils';
import {
  IntegrationProvider,
  PortalProviderConnection,
  getPortalAutomationCategoryOptions,
  getProductCategoryLabel,
} from '../../types';
import {
  compareConnections,
  connectionDetailLine,
  describeConnection,
} from './connectionPresentation';
import { useConfirm } from '../../../../layout/page';

interface ProviderConnectionListProps {
  providers: IntegrationProvider[];
  connections: PortalProviderConnection[];
  /** Opens the provider's integration page. */
  onSelect: (id: string) => void;
  onConnect: (connection: PortalProviderConnection) => void;
  onDelete?: (id: string) => void;
}

const TONE_CLASS = {
  good: 'bg-green-50 text-green-700 border-green-200',
  bad: 'bg-red-50 text-red-700 border-red-200',
  warn: 'bg-amber-50 text-amber-800 border-amber-200',
  busy: 'bg-blue-50 text-blue-700 border-blue-200',
  neutral: 'text-gray-500 border-gray-200',
} as const;

export function ProviderConnectionList({
  providers,
  connections,
  onSelect,
  onConnect,
  onDelete,
}: ProviderConnectionListProps) {
  const { confirm: askConfirm, confirmDialog } = useConfirm();
  const connectionByProvider = new Map(connections.map((entry) => [entry.providerId, entry]));

  // A provider with no automation-eligible category has no connection row on
  // the server. It still belongs in the list — it is a real provider and
  // spreadsheet sync still works for it — so it is shown with no connection
  // state rather than hidden.
  const ordered = [...providers].sort((a, b) => {
    const left = connectionByProvider.get(a.id);
    const right = connectionByProvider.get(b.id);
    if (left && right) return compareConnections(left, right);
    if (left) return -1;
    if (right) return 1;
    return (a.name || '').localeCompare(b.name || '');
  });

  return (
    <section className="overflow-hidden rounded-xl border border-nw-line bg-white">
      <div className="border-b border-nw-line px-5 py-4">
        <h2 className="text-base font-semibold text-nw-ink">Connections</h2>
        <p className="mt-0.5 text-sm text-nw-text-3">
          Which providers we can sign in to, and which need attention.
        </p>
      </div>
      <ul className="divide-y divide-nw-line">
        {ordered.map((provider) => {
          const connection = connectionByProvider.get(provider.id);
          const presentation = connection ? describeConnection(connection.state) : null;
          const automationCategories = getPortalAutomationCategoryOptions(provider.categoryIds);

          return (
            <li
              key={provider.id}
              className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center"
            >
              <span
                aria-hidden="true"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xs font-semibold text-nw-text-2"
              >
                {(provider.name || '?').slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-medium text-nw-ink">{provider.name}</h3>
                  {automationCategories.slice(0, 3).map((cat) => (
                    <span
                      key={cat}
                      className="rounded-full border border-gray-200 bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600"
                    >
                      {getProductCategoryLabel(cat)}
                    </span>
                  ))}
                  {automationCategories.length > 3 && (
                    <span className="text-[10px] text-gray-500">
                      + {automationCategories.length - 3} more
                    </span>
                  )}
                </div>
                {connection ? (
                  <p className="mt-0.5 line-clamp-2 text-xs text-gray-600">
                    {connectionDetailLine(connection)}
                  </p>
                ) : (
                  <p className="mt-0.5 text-xs text-gray-500">
                    {automationCategories.length === 0
                      ? 'No automation category on this provider, so there is no portal to connect to.'
                      : 'Spreadsheet sync only.'}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {presentation && (
                  <Badge variant="outline" className={cn('gap-1', TONE_CLASS[presentation.tone])}>
                    {presentation.tone === 'good' && <CheckCircle2 className="h-3 w-3" />}
                    {presentation.tone === 'bad' && <AlertCircle className="h-3 w-3" />}
                    {presentation.tone === 'busy' && <Loader2 className="h-3 w-3 animate-spin" />}
                    {presentation.label}
                  </Badge>
                )}
                {connection && presentation?.action && (
                  <Button variant="outline" size="sm" onClick={() => onConnect(connection)}>
                    <Plug className="mr-1.5 h-3 w-3" />
                    {presentation.action}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  aria-label={`Open ${provider.name} integration`}
                  onClick={() => onSelect(provider.id)}
                >
                  Open
                </Button>
                {onDelete && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete provider ${provider.name}`}
                    className="h-8 w-8 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    onClick={async () => {
                      const ok = await askConfirm({
                        title: `Delete ${provider.name}?`,
                        description: 'This removes the provider and its connection settings.',
                        confirmLabel: 'Delete provider',
                        destructive: true,
                      });
                      if (ok) onDelete(provider.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {confirmDialog}
    </section>
  );
}
