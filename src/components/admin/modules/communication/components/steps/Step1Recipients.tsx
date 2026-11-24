import { useState, useEffect } from 'react';
import { Search, Users, ArrowRight, X } from 'lucide-react';
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
import {
  estimateGroupRecipients,
  getDraftGroups,
  groupSelectionUpdate,
  toggleGroup,
} from '../../groupSelection';

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
        selectedGroups: undefined,
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

  const selectedGroups = getDraftGroups(draft);
  const isGroupSelected = (groupId: string) => selectedGroups.some((g) => g.id === groupId);
  const groupRecipientCount = estimateGroupRecipients(selectedGroups);

  const selectGroups = (next: ClientGroup[]) => {
    updateDraft({ ...groupSelectionUpdate(next, clients), recipientType: 'group' });
  };

  /** Several groups can be selected; clicking a selected group deselects it. */
  const handleGroupToggle = (group: ClientGroup) =>
    selectGroups(toggleGroup(selectedGroups, group));

  /** From the group manager: add the group, never toggle it off. */
  const handleGroupAdd = (group: ClientGroup) => {
    if (!isGroupSelected(group.id)) selectGroups([...selectedGroups, group]);
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
    if (activeTab === 'group') return selectedGroups.length > 0;
    return draft.selectedRecipients.length > 0;
  };

  if (showGroupManager) {
    return (
      <CustomGroupManager
        onClose={() => setShowGroupManager(false)}
        onSelectGroup={(g) => {
          handleGroupAdd(g);
          setShowGroupManager(false);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <Card>
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
                  <div className="grid grid-cols-[44px_minmax(0,1fr)] sm:grid-cols-[50px_minmax(0,1fr)_minmax(0,1fr)_100px_100px] bg-muted/50 border-b text-sm font-medium text-muted-foreground">
                    <div className="px-4 py-3" />
                    <div className="px-4 py-3">Name</div>
                    <div className="hidden px-4 py-3 sm:block">Email</div>
                    <div className="hidden px-4 py-3 sm:block">Status</div>
                    <div className="hidden px-4 py-3 sm:block">Category</div>
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
                              className={`grid grid-cols-[44px_minmax(0,1fr)] sm:grid-cols-[50px_minmax(0,1fr)_minmax(0,1fr)_100px_100px] border-b border-muted/30 cursor-pointer hover:bg-muted/50 items-center ${isSelected(client.id) ? 'bg-primary/5' : ''}`}
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
                              <div className="min-w-0 px-4">
                                <div className="truncate text-sm font-medium">
                                  {client.firstName} {client.surname || client.lastName}
                                </div>
                                <div className="truncate text-xs text-muted-foreground sm:hidden">
                                  {client.email}
                                </div>
                              </div>
                              <div className="hidden truncate px-4 text-sm text-muted-foreground sm:block">
                                {client.email}
                              </div>
                              <div className="hidden px-4 sm:block">
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
                              <div className="hidden truncate px-4 text-sm text-muted-foreground sm:block">
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
                {/* What is selected, always above the grid: with many groups the
                    highlighted card can be far down the page. */}
                <div
                  className="rounded-lg border bg-muted/30 p-4"
                  aria-live="polite"
                  data-testid="selected-groups"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-medium text-gray-900">
                      {selectedGroups.length === 0
                        ? 'No groups selected'
                        : `${selectedGroups.length} ${
                            selectedGroups.length === 1 ? 'group' : 'groups'
                          } selected · ${groupRecipientCount} ${
                            groupRecipientCount === 1 ? 'recipient' : 'recipients'
                          }`}
                    </h3>
                    {selectedGroups.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => selectGroups([])}
                      >
                        Clear all
                      </Button>
                    )}
                  </div>
                  {selectedGroups.length === 0 ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      Pick one or more groups below. A client in more than one group gets the
                      message once.
                    </p>
                  ) : (
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {selectedGroups.map((group) => (
                        <li
                          key={group.id}
                          className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-white py-1 pl-3 pr-1 text-sm"
                        >
                          <span className="font-medium text-gray-900">{group.name}</span>
                          <span className="text-xs text-muted-foreground">{group.clientCount}</span>
                          <button
                            type="button"
                            onClick={() => handleGroupToggle(group)}
                            className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-gray-900"
                            aria-label={`Remove ${group.name}`}
                          >
                            <X className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-medium text-muted-foreground">Available Groups</h3>
                  <Button variant="outline" size="sm" onClick={() => setShowGroupManager(true)}>
                    Manage Groups
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {groups.map((group) => {
                    const checked = isGroupSelected(group.id);
                    return (
                      <div
                        key={group.id}
                        role="checkbox"
                        aria-checked={checked}
                        aria-label={group.name}
                        tabIndex={0}
                        onClick={() => handleGroupToggle(group)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleGroupToggle(group);
                          }
                        }}
                        className={`
                          p-4 rounded-lg border cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
                          ${
                            checked
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
                          <Checkbox
                            checked={checked}
                            tabIndex={-1}
                            aria-hidden="true"
                            className="pointer-events-none"
                          />
                        </div>
                        <h4 className="font-semibold text-gray-900">{group.name}</h4>
                        <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                          {group.description}
                        </p>
                        <div className="mt-4 flex items-center text-sm text-gray-600">
                          <Users className="h-4 w-4 mr-1" />
                          {group.clientCount} {group.clientCount === 1 ? 'client' : 'clients'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Tabs>
        </CardContent>
      </Card>

      {/* Continue stays pinned to the bottom of the page */}
      <div className="sticky bottom-0 z-10 flex items-center justify-end gap-4 border-t border-nw-line bg-white/95 py-3 backdrop-blur">
        <span className="min-w-0 truncate text-sm text-nw-text-2" data-testid="recipient-summary">
          {activeTab === 'group'
            ? selectedGroups.length > 0
              ? `To ${selectedGroups.map((g) => g.name).join(', ')} · ${groupRecipientCount} ${
                  groupRecipientCount === 1 ? 'recipient' : 'recipients'
                }`
              : 'No group selected'
            : `${draft.selectedRecipients.length} ${
                draft.selectedRecipients.length === 1 ? 'recipient' : 'recipients'
              }`}
        </span>
        <Button
          onClick={() => {
            // Group members are recomputed here: picking clients on another
            // tab overwrites selectedRecipients while the groups stay selected.
            updateDraft(
              activeTab === 'group'
                ? { ...groupSelectionUpdate(selectedGroups, clients), recipientType: 'group' }
                : { recipientType: activeTab },
            );
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
