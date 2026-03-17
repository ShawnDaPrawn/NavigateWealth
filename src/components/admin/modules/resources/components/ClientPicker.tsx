/**
 * ClientPicker Component
 * Inline search-and-select for picking a client to pre-fill forms.
 * Fetches from the client management API.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Input } from '../../../../ui/input';
import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import { Search, User, X, Loader2, CheckCircle2 } from 'lucide-react';
import { projectId, publicAnonKey } from '../../../../../utils/supabase/info';

interface ClientOption {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  idNumber?: string;
  profile?: Record<string, unknown>;
}

interface ClientPickerProps {
  selectedClient: ClientOption | null;
  onSelect: (client: ClientOption | null) => void;
}

export function ClientPicker({ selectedClient, onSelect }: ClientPickerProps) {
  const [search, setSearch] = useState('');
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch clients on mount
  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const storageKey = `sb-${projectId}-auth-token`;
      const stored = localStorage.getItem(storageKey);
      const token = stored ? JSON.parse(stored).access_token : publicAnonKey;

      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/profile/all-users`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!res.ok) throw new Error('Failed to fetch clients');

      const data = await res.json();
      const users = data.users || [];

      const mapped: ClientOption[] = users.map((u: { id: string; email?: string; name?: string; user_metadata?: Record<string, unknown>; profile?: Record<string, unknown> }) => ({
        id: u.id,
        firstName: u.user_metadata?.firstName || u.profile?.personalInformation?.firstName || u.name?.split(' ')[0] || 'Unknown',
        lastName: u.user_metadata?.surname || u.profile?.personalInformation?.lastName || u.name?.split(' ').slice(1).join(' ') || '',
        email: u.email || '',
        idNumber: u.profile?.personalInformation?.idNumber || u.profile?.personalInformation?.passportNumber || '',
        profile: u.profile,
      }));

      setClients(mapped);
    } catch (err) {
      console.error('[ClientPicker] Error fetching clients:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = clients.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.firstName.toLowerCase().includes(q) ||
      c.lastName.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.idNumber && c.idNumber.includes(q))
    );
  });

  if (selectedClient) {
    return (
      <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
        <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-green-900 truncate">
            {selectedClient.firstName} {selectedClient.lastName}
          </p>
          <p className="text-xs text-green-700 truncate">{selectedClient.email}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-green-600 hover:text-green-800 hover:bg-green-100 shrink-0"
          onClick={() => onSelect(null)}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, or ID..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setShowResults(true);
          }}
          onFocus={() => setShowResults(true)}
          className="pl-10 h-10"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground animate-spin" />
        )}
      </div>

      {showResults && !loading && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              <User className="h-8 w-8 mx-auto mb-2 opacity-40" />
              No clients found
            </div>
          ) : (
            filtered.slice(0, 20).map((client) => (
              <button
                key={client.id}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 text-left transition-colors border-b border-gray-50 last:border-0"
                onClick={() => {
                  onSelect(client);
                  setShowResults(false);
                  setSearch('');
                }}
              >
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                  <User className="h-4 w-4 text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {client.firstName} {client.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{client.email}</p>
                </div>
                {client.idNumber && (
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {client.idNumber.slice(0, 6)}...
                  </Badge>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}