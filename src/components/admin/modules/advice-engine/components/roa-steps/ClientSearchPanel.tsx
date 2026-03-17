/**
 * ClientSearchPanel Component
 * 
 * Sub-component for searching and selecting clients.
 * Part of the RoA Client Selection Step.
 */

import { Search, User, Loader2 } from 'lucide-react';
import { Card, CardContent } from '../../../../../ui/card';
import { Label } from '../../../../../ui/label';
import { Input } from '../../../../../ui/input';
import type { ClientSearchResult } from '../../types';

interface ClientSearchPanelProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  results: ClientSearchResult[];
  isSearching: boolean;
  onSelectClient: (client: ClientSearchResult) => void;
  selectedClientId?: string;
}

export function ClientSearchPanel({
  searchTerm,
  onSearchChange,
  results,
  isSearching,
  onSelectClient,
  selectedClientId
}: ClientSearchPanelProps) {
  return (
    <CardContent className="space-y-4">
      {/* Search Input */}
      <div className="space-y-2">
        <Label htmlFor="client-search">Search by name, email, or phone</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="client-search"
            placeholder="Start typing to search clients..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Search Results */}
      {searchTerm && (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {isSearching ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Searching...</span>
            </div>
          ) : results.length > 0 ? (
            <div className="space-y-2">
              {results.map((client) => (
                <Card 
                  key={client.user_id} 
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedClientId === client.user_id ? 'ring-2 ring-primary bg-primary/5' : ''
                  }`}
                  onClick={() => onSelectClient(client)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{client.first_name} {client.last_name}</p>
                        <p className="text-sm text-muted-foreground">{client.email}</p>
                        <p className="text-sm text-muted-foreground">{client.phone}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8">
                <User className="h-12 w-12 text-muted-foreground opacity-50 mb-4" />
                <p className="text-muted-foreground">No clients found matching your search.</p>
                <p className="text-sm text-muted-foreground mt-1">Try a different search term or create a new client.</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {!searchTerm && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Search className="h-12 w-12 text-muted-foreground opacity-50 mb-4" />
            <p className="text-muted-foreground">Start typing to search for existing clients</p>
          </CardContent>
        </Card>
      )}
    </CardContent>
  );
}
