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
import { Card, CardHeader, CardTitle, CardDescription } from '../../../../../ui/card';
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

interface ProviderConnectionListProps {
  providers: IntegrationProvider[];
  connections: PortalProviderConnection[];
  selectedProviderId: string | null;
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
  selectedProviderId,
  onSelect,
  onConnect,
  onDelete,
}: ProviderConnectionListProps) {
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
    <Card className="w-1/3 min-w-[300px] flex flex-col h-full overflow-hidden">
      <CardHeader className="pb-4 border-b bg-gray-50/50">
        <CardTitle className="text-lg">Connections</CardTitle>
        <CardDescription>
          Which providers we can sign in to, and which need attention
        </CardDescription>
      </CardHeader>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {ordered.map((provider) => {
          const connection = connectionByProvider.get(provider.id);
          const presentation = connection ? describeConnection(connection.state) : null;
          const automationCategories = getPortalAutomationCategoryOptions(provider.categoryIds);

          return (
            <div
              key={provider.id}
              onClick={() => onSelect(provider.id)}
              className={cn(
                'relative p-4 rounded-lg border transition-all cursor-pointer hover:shadow-md group',
                selectedProviderId === provider.id
                  ? 'border-purple-500 bg-purple-50/50 ring-1 ring-purple-200'
                  : 'border-gray-200 bg-white hover:border-purple-200',
              )}
            >
              <div className="flex justify-between items-start mb-2 pr-6">
                <h3 className="font-semibold text-gray-900">{provider.name}</h3>
                {presentation && (
                  <Badge variant="outline" className={cn('gap-1', TONE_CLASS[presentation.tone])}>
                    {presentation.tone === 'good' && <CheckCircle2 className="w-3 h-3" />}
                    {presentation.tone === 'bad' && <AlertCircle className="w-3 h-3" />}
                    {presentation.tone === 'busy' && <Loader2 className="w-3 h-3 animate-spin" />}
                    {presentation.label}
                  </Badge>
                )}
              </div>

              {connection ? (
                <p className="text-xs text-gray-600 mb-3 line-clamp-2">
                  {connectionDetailLine(connection)}
                </p>
              ) : (
                <p className="text-xs text-gray-500 mb-3">
                  {automationCategories.length === 0
                    ? 'No automation category on this provider, so there is no portal to connect to.'
                    : 'Spreadsheet sync only.'}
                </p>
              )}

              <div className="flex flex-wrap gap-1 mb-3">
                {automationCategories.slice(0, 3).map((cat) => (
                  <span
                    key={cat}
                    className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-full border border-gray-200"
                  >
                    {getProductCategoryLabel(cat)}
                  </span>
                ))}
                {automationCategories.length > 3 && (
                  <span className="text-[10px] px-1.5 py-0.5 text-gray-500">
                    + {automationCategories.length - 3} more
                  </span>
                )}
              </div>

              {connection && presentation?.action && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-8 text-xs"
                  onClick={(event) => {
                    event.stopPropagation();
                    onConnect(connection);
                  }}
                >
                  <Plug className="w-3 h-3 mr-1.5" />
                  {presentation.action}
                </Button>
              )}

              {onDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete provider ${provider.name}`}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 h-6 w-6 text-gray-400 hover:text-red-600 hover:bg-red-50"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Are you sure you want to delete ${provider.name}?`)) {
                      onDelete(provider.id);
                    }
                  }}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
