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

import { Trash2 } from 'lucide-react';
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
import { DsButton, useConfirm } from '../../../../layout/page';

interface ProviderConnectionListProps {
  providers: IntegrationProvider[];
  connections: PortalProviderConnection[];
  /** Opens the provider's integration page. */
  onSelect: (id: string) => void;
  onConnect: (connection: PortalProviderConnection) => void;
  onDelete?: (id: string) => void;
}

const PILL_TONE = {
  good: 'ok',
  bad: 'bad',
  warn: 'warn',
  busy: 'info',
  neutral: '',
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
    // PM-Integrations: a "Connections" card of to-do style rows
    <section className="ds-card overflow-hidden">
      <div className="ds-card-h">
        <div>
          <h3>Connections</h3>
          <p className="ds-meta">Which providers we can sign in to, and which need attention.</p>
        </div>
      </div>
      <ul>
        {ordered.map((provider) => {
          const connection = connectionByProvider.get(provider.id);
          const presentation = connection ? describeConnection(connection.state) : null;
          const automationCategories = getPortalAutomationCategoryOptions(provider.categoryIds);
          const categoryLine = automationCategories.map(getProductCategoryLabel).join(' · ');

          return (
            <li key={provider.id} className="ds-todo-row flex-wrap sm:flex-nowrap">
              <span
                aria-hidden="true"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-nw-violet-50 text-[11.5px] font-semibold text-nw-violet"
              >
                {(provider.name || '?').slice(0, 2).toUpperCase()}
              </span>
              <div className="grow min-w-0">
                <h3 className="text-[13.5px] font-medium text-nw-ink">{provider.name}</h3>
                <span className="ds-meta line-clamp-2">
                  {connection ? connectionDetailLine(connection) : categoryLine || 'No categories'}
                </span>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                {presentation ? (
                  <span className={cn('ds-pill', PILL_TONE[presentation.tone])}>
                    {presentation.label}
                  </span>
                ) : (
                  <span className="ds-pill">
                    {automationCategories.length === 0
                      ? 'No portal to connect to'
                      : 'Spreadsheet sync only'}
                  </span>
                )}
                {connection && presentation?.action && (
                  <DsButton size="sm" onClick={() => onConnect(connection)}>
                    {presentation.action}
                  </DsButton>
                )}
                <DsButton
                  size="sm"
                  aria-label={`Open ${provider.name} integration`}
                  onClick={() => onSelect(provider.id)}
                >
                  Open
                </DsButton>
                {onDelete && (
                  <DsButton
                    size="sm"
                    variant="ghost"
                    aria-label={`Delete provider ${provider.name}`}
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
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </DsButton>
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
