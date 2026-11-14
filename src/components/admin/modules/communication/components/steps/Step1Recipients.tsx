import { useState, useEffect } from 'react';
import { Search, Users, CheckCircle2, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../../ui/card';
import { Input } from '../../../../../ui/input';
import { Button } from '../../../../../ui/button';
import { Tabs } from '../../../../../ui/tabs';
import { SegmentedList, SegmentedTrigger } from '../../../../layout/page';
import { Checkbox } from '../../../../../ui/checkbox';
import { Badge } from '../../../../../ui/badge';
import { CommunicationDraft, Client, ClientGroup, RecipientType } from '../../types';
import { CustomGroupManager } from '../CustomGroupManager';
import { communicationApi } from '../../api';
import { useVirtualizedRows } from '../../../../../shared/useVirtualizedRows';
import { useSearchInputAutofillGuard } from '@/shared/forms/useSearchInputAutofillGuard';

interface Step1Props {
  draft: CommunicationDraft;
  updateDraft: (updates: Partial<CommunicationDraft>) => void;
  onNext: () => void;
}

export function Step1Recipients({ draft, updateDraft, onNext }: Step1Props) {
  const searchInputGuard = useSearchInputAutofillGuard({
    id: 'communication-step1-recipients-search',
  });
  const [activeTab, setActiveTab] = useState<RecipientType>(draft.recipientType || 'single');
  const [searchTerm, setSearchTerm] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [groups, setGroups] = useState<ClientGroup[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<ClientGroup | undefined>(draft.selectedGroup);
  const [showGroupManager, setShowGroupManager] = useState(false);
  const [_loading, setLoading] = useState(true);

  // Fetch Data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [fetchedClients, fetchedGroups] = await Promise.all([
          communicationApi.getClients(),
          communicationApi.getGroups(),
        ]);
        setClients(fetchedClients);
        setGroups(fetchedGroups);
        setFilteredClients(fetchedClients);
      } catch (err) {
        console.error('Failed to fetch data', err);
        // Fallback to empty arrays
        setClients([]);
        setGroups([]);
        setFilteredClients([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Handle Search
  useEffect(() => {
    if (!searchTerm) {
      setFilteredClients(clients);
      return;
    }
    const lower = searchTerm.toLowerCase();
    setFilteredClients(
      clients.filter((c) => {
        const firstName = c.firstName || '';
        const lastName = c.surname || c.lastName || '';
        const email = c.email || '';

        return (
          firstName.toLowerCase().includes(lower) ||
          lastName.toLowerCase().includes(lower) ||
          email.toLowerCase().includes(lower)
        );
      }),
    );
  }, [searchTerm, clients]);

  // Handlers
  const handleClientSelect = (client: Client) => {
    if (activeTab === 'single') {
      updateDraft({
        selectedRecipients: [client],
        recipientType: 'single',
        selectedGroup: undefined,
      });
    } else {
      const current = draft.selectedRecipients;
      const exists = current.find((c) => c.id === client.id);
      let newSelection;
      if (exists) {
        newSelection = current.filter((c) => c.id !== client.id);
      } else {
        newSelection = [...current, client];
      }
      updateDraft({ selectedRecipients: newSelection, recipientType: 'multiple' });
    }
  };

  const handleGroupSelect = (group: ClientGroup) => {
    setSelectedGroup(group);
    // For the system "All Clients" group, use every fetched client
    // For custom groups, filter by clientIds
    const groupClients =
      group.id === 'sys_all'
        ? clients
        : group.clientIds
          ? clients.filter((c) => group.clientIds.includes(c.id))
          : [];

    updateDraft({
      selectedGroup: group,
      selectedRecipients: groupClients,
      recipientType: 'group',
    });
  };

  const handleTabChange = (val: string) => {
    const type = val as RecipientType;
    setActiveTab(type);

    // Reset selection logic when switching tabs might be desired,
    // but for now let's keep draft state unless explicitly cleared by user actions
    // updateDraft({ recipientType: type });
  };

  // Render Helpers
  const isSelected = (clientId: string) => draft.selectedRecipients.some((c) => c.id === clientId);

  const ROW_HEIGHT = 48;
  const { parentRef, virtualItems, totalSize, isVirtualized } = useVirtualizedRows({
    count: filteredClients.length,
    estimateSize: ROW_HEIGHT,
    overscan: 8,
    threshold: 50,
  });

  const canProceed = () => {
    if (activeTab === 'group') return !!draft.selectedGroup;
    return draft.selectedRecipients.length > 0;
  };

  if (showGroupManager) {
    return (
      <CustomGroupManager
        onClose={() => setShowGroupManager(false)}
        onSelectGroup={(g) => {
          handleGroupSelect(g);
          setShowGroupManager(false);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle>Who are you sending this to?</CardTitle>
          <CardDescription>
            Pick individual clients, several clients, or a saved group.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <SegmentedList aria-label="Recipients">
                <SegmentedTrigger value="single">Single client</SegmentedTrigger>
                <SegmentedTrigger value="multiple">Multiple clients</SegmentedTrigger>
                <SegmentedTrigger value="group">Client groups</SegmentedTrigger>
              </SegmentedList>
            </div>

            {/* Single & Multiple Selection UI */}
            {(activeTab === 'single' || activeTab === 'multiple') && (
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    {...searchInputGuard}
                    placeholder="Search by name, email, or phone..."
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <div className="border rounded-md overflow-hidden">
                  {/* Sticky header */}
                  <div className="grid grid-cols-[50px_1fr_1fr_100px_100px] bg-muted/50 border-b text-sm font-medium text-muted-foreground">
                    <div className="px-4 py-3" />
                    <div className="px-4 py-3">Name</div>
                    <div className="px-4 py-3">Email</div>
                    <div className="px-4 py-3">Status</div>
                    <div className="px-4 py-3">Category</div>
                  </div>

                  {/* Scrollable virtualised body */}
                  <div ref={parentRef} className="max-h-[400px] overflow-y-auto">
                    {filteredClients.length === 0 ? (
                      <div className="h-24 text-center text-muted-foreground flex items-center justify-center text-sm">
                        No clients found
                      </div>
                    ) : (
                      <div
                        style={{
                          height: isVirtualized ? totalSize : undefined,
                          position: isVirtualized ? 'relative' : undefined,
                        }}
                      >
                        {virtualItems.map((vRow) => {
                          const client = filteredClients[vRow.index];
                          return (
                            <div
                              key={client.id}
                              role="row"
                              tabIndex={0}
                              className={`grid grid-cols-[50px_1fr_1fr_100px_100px] border-b border-muted/30 cursor-pointer hover:bg-muted/50 items-center ${isSelected(client.id) ? 'bg-primary/5' : ''}`}
                              onClick={() => handleClientSelect(client)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  handleClientSelect(client);
                                }
                              }}
                              style={
                                isVirtualized
                                  ? {
                                      position: 'absolute',
                                      top: 0,
                                      left: 0,
                                      width: '100%',
                                      height: vRow.size,
                                      transform: `translateY(${vRow.start}px)`,
                                    }
                                  : { height: ROW_HEIGHT }
                              }
                            >
                              <div className="px-4 flex items-center justify-center">
                                {activeTab === 'single' ? (
                                  <div
                                    className={`h-4 w-4 rounded-full border ${isSelected(client.id) ? 'bg-primary border-primary' : 'border-muted-foreground'}`}
                                  >
                                    {isSelected(client.id) && (
                                      <div className="h-2 w-2 bg-white rounded-full m-auto mt-0.5" />
                                    )}
                                  </div>
                                ) : (
                                  <Checkbox checked={isSelected(client.id)} />
                                )}
                              </div>
                              <div className="px-4 font-medium text-sm truncate">
                                {client.firstName} {client.surname || client.lastName}
                              </div>
                              <div className="px-4 text-sm text-muted-foreground truncate">
                                {client.email}
                              </div>
                              <div className="px-4">
                                <Badge
                                  variant="outline"
                                  className={
                                    client.status?.toLowerCase() === 'active'
                                      ? 'text-green-600 border-green-200 bg-green-50'
                                      : client.status?.toLowerCase() === 'suspended'
                                        ? 'text-amber-600 border-amber-200 bg-amber-50'
                                        : 'text-gray-600'
                                  }
                                >
                                  {client.status || 'Active'}
                                </Badge>
                              </div>
                              <div className="px-4 text-sm text-muted-foreground truncate">
                                {client.category}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex justify-between items-center text-sm text-muted-foreground px-2">
                  <span>{filteredClients.length} clients found</span>
                  {activeTab === 'multiple' && (
                    <span className="font-medium text-primary">
                      {draft.selectedRecipients.length} selected
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Groups UI */}
            {activeTab === 'group' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-medium text-muted-foreground">Available Groups</h3>
                  <Button variant="outline" size="sm" onClick={() => setShowGroupManager(true)}>
                    Manage Groups
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {groups.map((group) => (
                    <div
                      key={group.id}
                      onClick={() => handleGroupSelect(group)}
                      className={`
                        p-4 rounded-lg border cursor-pointer transition-all
                        ${
                          selectedGroup?.id === group.id
                            ? 'border-primary ring-1 ring-primary bg-primary/5'
                            : 'border-gray-200 hover:border-primary/50 hover:shadow-sm'
                        }
                      `}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <Badge
                          variant={group.type === 'system' ? 'secondary' : 'default'}
                          className="capitalize"
                        >
                          {group.type}
                        </Badge>
                        {selectedGroup?.id === group.id && (
                          <CheckCircle2 className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <h4 className="font-semibold text-gray-900">{group.name}</h4>
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{group.description}</p>
                      <div className="mt-4 flex items-center text-sm text-gray-600">
                        <Users className="h-4 w-4 mr-1" />
                        {group.clientCount} clients
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Tabs>
        </CardContent>
      </Card>

      {/* Continue stays pinned to the bottom of the page */}
      <div className="sticky bottom-0 z-10 flex items-center justify-end gap-4 border-t border-nw-line bg-white/95 py-3 backdrop-blur">
        <span className="text-sm text-nw-text-2">
          {activeTab === 'group'
            ? draft.selectedGroup
              ? `${draft.selectedGroup.clientCount} recipients`
              : 'No group selected'
            : `${draft.selectedRecipients.length} ${
                draft.selectedRecipients.length === 1 ? 'recipient' : 'recipients'
              }`}
        </span>
        <Button
          onClick={() => {
            updateDraft({ recipientType: activeTab });
            onNext();
          }}
          disabled={!canProceed()}
          className="w-full sm:w-auto gap-2"
        >
          Continue to message
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
