import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Badge } from '../../../../ui/badge';
import { Label } from '../../../../ui/label';
import { Avatar, AvatarFallback } from '../../../../ui/avatar';
import { Checkbox } from '../../../../ui/checkbox';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import { Separator } from '../../../../ui/separator';
import { 
  User, 
  Users, 
  Search, 
  AlertTriangle, 
  CheckCircle,
  X,
  Filter,
  UserCheck,
  Mail,
  MessageSquare,
  ChevronDown
} from 'lucide-react';
import { RecipientType, Client, ClientGroup, CommunicationChannel } from '../types';
import { communicationApi } from '../api';
import { VirtualizedClientList } from './VirtualizedClientList';

interface RecipientSelectorProps {
  recipientType: RecipientType;
  onRecipientTypeChange: (type: RecipientType) => void;
  selectedClients: Client[];
  selectedGroup: ClientGroup | null;
  onClientsChange: (clients: Client[]) => void;
  onGroupChange: (group: ClientGroup | null) => void;
  channel: CommunicationChannel;
}

// Helper: derive display name from communication Client type (Guidelines §7.1)
function getClientDisplayName(client: Client): string {
  const first = client.firstName || '';
  const last = client.surname || client.lastName || '';
  return `${first} ${last}`.trim() || 'Unknown';
}

export function RecipientSelector({
  recipientType,
  onRecipientTypeChange,
  selectedClients,
  selectedGroup,
  onClientsChange,
  onGroupChange,
  channel,
}: RecipientSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [allGroups, setAllGroups] = useState<ClientGroup[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Fetch clients and groups from backend (matches Step1Recipients pattern)
  useEffect(() => {
    const fetchData = async () => {
      setDataLoading(true);
      try {
        const [fetchedClients, fetchedGroups] = await Promise.all([
          communicationApi.getClients(),
          communicationApi.getGroups(),
        ]);
        setAllClients(fetchedClients);
        setAllGroups(fetchedGroups);
      } catch (err) {
        console.error('RecipientSelector: Failed to fetch clients/groups', err);
        setAllClients([]);
        setAllGroups([]);
      } finally {
        setDataLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (!searchTerm) {
      setFilteredClients(allClients);
      return;
    }
    const lower = searchTerm.toLowerCase();
    const filtered = allClients.filter(client => {
      const name = getClientDisplayName(client).toLowerCase();
      return (
        name.includes(lower) ||
        (client.email && client.email.toLowerCase().includes(lower))
      );
    });
    setFilteredClients(filtered);
  }, [searchTerm, allClients]);

  const isClientEligible = (client: Client): boolean => {
    if (channel === 'email') {
      return !!(client.email && client.hasEmailOptIn);
    } else {
      return !!(client.phone && client.hasWhatsAppOptIn);
    }
  };

  const getClientStatus = (client: Client): { icon: React.ReactNode; color: string; reason?: string } => {
    const eligible = isClientEligible(client);
    
    if (eligible) {
      return {
        icon: <CheckCircle className="h-4 w-4" />,
        color: 'text-green-600',
      };
    }

    let reason = '';
    if (channel === 'email') {
      if (!client.email) reason = 'No email address';
      else if (!client.hasEmailOptIn) reason = 'Email opt-out';
    } else {
      if (!client.phone) reason = 'No phone number';
      else if (!client.hasWhatsAppOptIn) reason = 'WhatsApp opt-out';
    }

    return {
      icon: <AlertTriangle className="h-4 w-4" />,
      color: 'text-orange-600',
      reason,
    };
  };

  const handleClientSelect = (client: Client) => {
    const isSelected = selectedClients.some(c => c.id === client.id);
    if (isSelected) {
      onClientsChange(selectedClients.filter(c => c.id !== client.id));
    } else {
      onClientsChange([...selectedClients, client]);
    }
  };

  const getGroupClients = (group: ClientGroup): Client[] => {
    return allClients.filter(client => group.clientIds.includes(client.id));
  };

  const getGroupStats = (group: ClientGroup) => {
    const clients = getGroupClients(group);
    const eligible = clients.filter(isClientEligible);
    const ineligible = clients.filter(client => !isClientEligible(client));
    
    return {
      total: clients.length,
      eligible: eligible.length,
      ineligible: ineligible.length,
    };
  };

  const getCurrentStats = () => {
    let clients: Client[] = [];
    
    if (recipientType === 'single' || recipientType === 'multiple') { // Mapped 'client' to standard types
      clients = selectedClients;
    } else if (selectedGroup) {
      clients = getGroupClients(selectedGroup);
    }

    const eligible = clients.filter(isClientEligible);
    const ineligible = clients.filter(client => !isClientEligible(client));
    
    return {
      total: clients.length,
      eligible: eligible.length,
      ineligible: ineligible.length,
    };
  };

  const stats = getCurrentStats();

  return (
    <Card className="h-full border-0 shadow-sm">
      <CardHeader className="pb-4">
        <div className="space-y-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="h-4 w-4 text-primary" />
            </div>
            Audience Selection
          </CardTitle>
          
          {/* Recipient Type Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">TARGET TYPE</Label>
            <div className="grid grid-cols-1 gap-2">
              <Button
                variant={recipientType === 'single' || recipientType === 'multiple' ? 'default' : 'outline'}
                onClick={() => onRecipientTypeChange('multiple')}
                className="justify-start h-11"
              >
                <User className="h-4 w-4 mr-2" />
                Individual Clients
                <ChevronDown className="h-4 w-4 ml-auto" />
              </Button>
              <Button
                variant={recipientType === 'group' ? 'default' : 'outline'}
                onClick={() => onRecipientTypeChange('group')}
                className="justify-start h-11"
              >
                <Users className="h-4 w-4 mr-2" />
                Client Groups
                <ChevronDown className="h-4 w-4 ml-auto" />
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Enhanced Stats Summary */}
        {stats.total > 0 && (
          <Card className="border border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Selected Recipients</span>
                  <Badge variant="secondary" className="text-sm">
                    {stats.total} total
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{stats.eligible}</div>
                    <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                      <CheckCircle className="h-3 w-3 text-green-600" />
                      Eligible
                    </div>
                  </div>
                  
                  {stats.ineligible > 0 && (
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">{stats.ineligible}</div>
                      <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                        <AlertTriangle className="h-3 w-3 text-orange-600" />
                        Ineligible
                      </div>
                    </div>
                  )}
                </div>
                
                {channel === 'email' && (
                  <div className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
                    <Mail className="h-3 w-3" />
                    Email recipients with valid addresses and opt-in consent
                  </div>
                )}
                
                {channel === 'whatsapp' && (
                  <div className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    WhatsApp recipients with valid numbers and opt-in consent
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {recipientType === 'single' || recipientType === 'multiple' ? (
          <div className="contents">
            {/* Enhanced Client Search */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-muted-foreground">SEARCH & SELECT CLIENTS</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email address..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-11"
                />
              </div>
            </div>

            {/* Selected Clients Summary */}
            {selectedClients.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-muted-foreground">SELECTED CLIENTS</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onClientsChange([])}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Clear All
                  </Button>
                </div>
                
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedClients.map((client: { id: string; [key: string]: unknown }) => {
                    const status = getClientStatus(client);
                    const displayName = getClientDisplayName(client);
                    return (
                      <div key={client.id} className="group flex items-center justify-between p-3 bg-muted/20 rounded-lg border transition-colors hover:bg-muted/40">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {displayName.split(' ').map((n: string) => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{displayName}</span>
                              <span className={status.color}>
                                {status.icon}
                              </span>
                            </div>
                            {status.reason && (
                              <div className="text-xs text-muted-foreground mt-1">
                                {status.reason}
                              </div>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleClientSelect(client)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
                <Separator className="my-3" />
              </div>
            )}

            {/* Enhanced Available Clients */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-muted-foreground">AVAILABLE CLIENTS</Label>
                <Button variant="ghost" size="sm" className="text-xs">
                  <Filter className="h-3 w-3 mr-1" />
                  Filter
                </Button>
              </div>
              
              <VirtualizedClientList
                clients={filteredClients.filter(client => !selectedClients.some(s => s.id === client.id))}
                maxHeightClass="max-h-64"
                rowHeight={72}
                threshold={50}
                getDisplayName={getClientDisplayName}
                getStatus={getClientStatus}
                isEligible={isClientEligible}
                onClientClick={handleClientSelect}
                contactDetail={(client) => channel === 'email' ? client.email || 'No email address' : client.phone || 'No phone number'}
                showCheckbox
                showHoverAction
                emptyMessage="No available clients found"
              />
            </div>
          </div>
        ) : (
          <div className="contents">
            {/* Enhanced Group Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-muted-foreground">SELECT CLIENT GROUP</Label>
              <Select
                value={selectedGroup?.id || ''}
                onValueChange={(value) => {
                  const group = allGroups.find(g => g.id === value) || null;
                  onGroupChange(group);
                }}
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Choose a client group..." />
                </SelectTrigger>
                <SelectContent>
                  {allGroups.map((group) => {
                    const groupStats = getGroupStats(group);
                    return (
                      <SelectItem key={group.id} value={group.id} className="p-3">
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <Users className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <div className="font-medium text-sm">{group.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {group.description}
                              </div>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {groupStats.eligible}/{groupStats.total}
                          </Badge>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Enhanced Selected Group Details */}
            {selectedGroup && (
              <div className="space-y-4">
                <Card className="border border-primary/20 bg-primary/5">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                          <Users className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-base">{selectedGroup.name}</h4>
                          <p className="text-sm text-muted-foreground">{selectedGroup.description}</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center">
                          <div className="text-xl font-bold text-primary">{getGroupStats(selectedGroup).total}</div>
                          <div className="text-xs text-muted-foreground">Total Members</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xl font-bold text-green-600">{getGroupStats(selectedGroup).eligible}</div>
                          <div className="text-xs text-muted-foreground">Eligible</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="space-y-3">
                  <Label className="text-sm font-medium text-muted-foreground">GROUP MEMBERS</Label>
                  <VirtualizedClientList
                    clients={getGroupClients(selectedGroup)}
                    maxHeightClass="max-h-64"
                    rowHeight={72}
                    threshold={50}
                    getDisplayName={getClientDisplayName}
                    getStatus={getClientStatus}
                    isEligible={isClientEligible}
                    onClientClick={() => {}}
                    contactDetail={(client) => channel === 'email' ? client.email || 'No email address' : client.phone || 'No phone number'}
                    emptyMessage="No group members"
                    getRowClassName={(client) => isClientEligible(client) ? 'bg-green-50/50 border-green-200/60' : 'bg-orange-50/50 border-orange-200'}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}