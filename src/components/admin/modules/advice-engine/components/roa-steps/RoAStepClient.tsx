import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../../ui/tabs';
import { RoADraft } from '../DraftRoAInterface';
import { Search, Plus, UserCheck } from 'lucide-react';
import { useClientSearch } from '../../hooks/useClientSearch';
import { useClient } from '../../hooks/useClient';
import { ClientSearchResult } from '../../types';
import { ClientSearchPanel } from './ClientSearchPanel';
import { NewClientForm } from './NewClientForm';

interface RoAStepClientProps {
  draft: RoADraft | null;
  onUpdate: (updates: Partial<RoADraft>) => void;
}

export function RoAStepClient({ draft, onUpdate }: RoAStepClientProps) {
  const { 
    searchTerm, 
    setSearchTerm, 
    results: searchResults, 
    isSearching 
  } = useClientSearch();

  // Fetch full client details for selected client
  const { data: clientDetails } = useClient(draft?.clientId);

  const handleSelectExistingClient = (client: ClientSearchResult) => {
    onUpdate({ 
      clientId: client.user_id, 
      clientData: undefined // Clear any new client data
    });
    setSearchTerm('');
  };

  const handleNewClientChange = (data: NonNullable<RoADraft['clientData']>) => {
    onUpdate({ 
      clientData: data,
      clientId: undefined // Clear existing client selection
    });
  };

  const getSelectedClient = () => {
    if (draft?.clientId) {
      // Check fetched client details (Priority for existing clients)
      if (clientDetails) {
        return {
          id: clientDetails.user_id,
          firstName: clientDetails.first_name,
          lastName: clientDetails.last_name,
          email: clientDetails.email,
          mobile: clientDetails.phone || '',
          riskProfile: 'N/A'
        };
      }

      // Check search results (Fallback)
      const searchResult = searchResults.find(c => c.user_id === draft.clientId);
      if (searchResult) {
        return {
          id: searchResult.user_id,
          firstName: searchResult.first_name,
          lastName: searchResult.last_name,
          email: searchResult.email,
          mobile: searchResult.phone || '',
          riskProfile: 'N/A'
        };
      }
    }
    return null;
  };

  const selectedClient = getSelectedClient();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold mb-2">Select Client</h2>
        <p className="text-muted-foreground">
          Choose an existing client or create a new client profile for this Record of Advice
        </p>
      </div>

      {/* Current Selection Display */}
      {(selectedClient || draft?.clientData) && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-green-800">
              <UserCheck className="h-5 w-5" />
              Selected Client
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedClient ? (
              <div className="space-y-2">
                <p className="font-medium">{selectedClient.firstName} {selectedClient.lastName}</p>
                <p className="text-sm text-muted-foreground">{selectedClient.email}</p>
                <p className="text-sm text-muted-foreground">{selectedClient.mobile}</p>
                <p className="text-sm text-muted-foreground">Risk Profile: {selectedClient.riskProfile}</p>
              </div>
            ) : draft?.clientData && (
              <div className="space-y-2">
                <p className="font-medium">{draft.clientData.firstName} {draft.clientData.lastName}</p>
                <p className="text-sm text-muted-foreground">{draft.clientData.email}</p>
                <p className="text-sm text-muted-foreground">{draft.clientData.mobile}</p>
                <p className="text-sm text-muted-foreground">New client profile</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Client Selection Interface */}
      <Tabs defaultValue="existing" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="existing" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Select Existing Client
          </TabsTrigger>
          <TabsTrigger value="new" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Create New Client
          </TabsTrigger>
        </TabsList>

        {/* Existing Client Tab */}
        <TabsContent value="existing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Search Existing Clients</CardTitle>
            </CardHeader>
            <ClientSearchPanel
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              results={searchResults}
              isSearching={isSearching}
              onSelectClient={handleSelectExistingClient}
              selectedClientId={draft?.clientId}
            />
          </Card>
        </TabsContent>

        {/* New Client Tab */}
        <TabsContent value="new" className="space-y-4">
          <NewClientForm 
             onDataChange={handleNewClientChange}
             initialData={draft?.clientData}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
