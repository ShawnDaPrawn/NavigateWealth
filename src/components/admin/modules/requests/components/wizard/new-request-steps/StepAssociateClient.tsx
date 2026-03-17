import React, { useState } from 'react';
import { Search, User, AlertCircle } from 'lucide-react';
import { Input } from '../../../../../../ui/input';
import { Button } from '../../../../../../ui/button';
import { RequestTemplate, ClientAssociationRule } from '../../../types';
import { useClientList } from '../../../../client-management/hooks/useClientList';

interface StepAssociateClientProps {
  template: RequestTemplate;
  clientId: string | null;
  clientName: string | null;
  requestSubject: string | null;
  onSelectClient: (clientId: string, clientName: string) => void;
  onSetRequestSubject: (subject: string) => void;
}

/** Lightweight view model for client search results */
interface ClientListItem {
  id: string;
  name: string;
  idNumber: string;
  email: string;
}

export function StepAssociateClient({
  template,
  clientId,
  clientName,
  requestSubject,
  onSelectClient,
  onSetRequestSubject,
}: StepAssociateClientProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showClientSearch, setShowClientSearch] = useState(false);

  // Real client data from backend (Guidelines §6 — hooks are the only API consumers)
  const { clients, loading } = useClientList();

  // Map to lightweight search view model and filter
  const filteredClients: ClientListItem[] = React.useMemo(() => {
    if (!searchQuery) return [];
    const term = searchQuery.toLowerCase();
    return clients
      .filter(c => !c.deleted && !c.suspended)
      .map(c => ({
        id: c.id,
        name: `${c.firstName} ${c.lastName}`,
        idNumber: c.idNumber,
        email: c.email,
      }))
      .filter(c =>
        c.name.toLowerCase().includes(term) ||
        c.idNumber.includes(searchQuery) ||
        c.email.toLowerCase().includes(term)
      );
  }, [clients, searchQuery]);

  const handleSelectClient = (client: ClientListItem) => {
    onSelectClient(client.id, client.name);
    setShowClientSearch(false);
    setSearchQuery('');
  };

  const handleClearClient = () => {
    onSelectClient('', '');
  };

  const rule = template.clientAssociationRule;

  // If client not allowed, show informational message
  if (rule === ClientAssociationRule.NOT_ALLOWED) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-medium mb-1">Client Association</h3>
          <p className="text-sm text-muted-foreground">
            This template does not require or allow client association.
          </p>
        </div>

        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-slate-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-slate-700 mb-1">No Client Required</h4>
              <p className="text-sm text-slate-600">
                The <strong>{template.name}</strong> template is configured for administrative
                or system-level requests that do not involve a specific client.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">
            Request Subject <span className="text-red-500">*</span>
          </label>
          <Input
            placeholder="e.g., Compliance review, Provider query, System update..."
            value={requestSubject || ''}
            onChange={(e) => onSetRequestSubject(e.target.value)}
          />
          <p className="text-xs text-slate-500">
            Provide a brief description of what this request is about.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium mb-1">Associate Client</h3>
        <p className="text-sm text-muted-foreground">
          {rule === ClientAssociationRule.REQUIRED
            ? 'This request must be associated with a client.'
            : 'You may optionally associate this request with a client.'}
        </p>
      </div>

      {rule === ClientAssociationRule.REQUIRED && (
        <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-orange-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-orange-800">
              Client selection is <strong>required</strong> for this template.
            </p>
          </div>
        </div>
      )}

      {/* Selected Client Display */}
      {clientId && clientName ? (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-200 flex items-center justify-center">
                <User className="h-5 w-5 text-green-700" />
              </div>
              <div>
                <h4 className="font-medium text-green-900">{clientName}</h4>
                <p className="text-sm text-green-700">Client ID: {clientId}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleClearClient}>
              Change
            </Button>
          </div>
        </div>
      ) : (
        <div className="contents">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
              Select Client {rule === ClientAssociationRule.REQUIRED && <span className="text-red-500">*</span>}
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by name, ID number, or email..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowClientSearch(true);
                }}
                onFocus={() => setShowClientSearch(true)}
                className="pl-9"
              />
            </div>

            {/* Client Search Results */}
            {showClientSearch && searchQuery && (
              <div className="border border-slate-200 rounded-lg bg-white shadow-lg max-h-64 overflow-y-auto">
                {filteredClients.length === 0 ? (
                  <div className="p-4 text-center text-slate-500 text-sm">
                    No clients found
                  </div>
                ) : (
                  filteredClients.map((client) => (
                    <button
                      key={client.id}
                      onClick={() => handleSelectClient(client)}
                      className="w-full text-left p-3 hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                          <User className="h-4 w-4 text-slate-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h5 className="font-medium text-slate-900 text-sm">{client.name}</h5>
                          <p className="text-xs text-slate-500">
                            ID: {client.idNumber} • {client.email}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Optional: Request Subject when no client selected */}
          {rule === ClientAssociationRule.OPTIONAL && !clientId && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">
                Or provide Request Subject
              </label>
              <Input
                placeholder="e.g., General inquiry, Provider query..."
                value={requestSubject || ''}
                onChange={(e) => onSetRequestSubject(e.target.value)}
              />
              <p className="text-xs text-slate-500">
                If not associating with a client, provide a brief subject for this request.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}