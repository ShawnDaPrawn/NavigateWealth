import React, { useState, useEffect } from 'react';
import { Plus, ArrowLeft, Loader2, Users, Search, Filter, Edit2, Trash2, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Badge } from '../../../../ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../../ui/alert-dialog';
import { ClientGroup, Client } from '../types';
import { communicationApi } from '../api';
import { toast } from 'sonner@2.0.3';
import { Provider } from '../../product-management/types';
import { GroupEditor } from './groups/GroupEditor';

interface CustomGroupManagerProps {
  onClose: () => void;
  onSelectGroup?: (group: ClientGroup) => void;
}

export function CustomGroupManager({ onClose, onSelectGroup }: CustomGroupManagerProps) {
  const [view, setView] = useState<'list' | 'edit'>('list');
  const [groups, setGroups] = useState<ClientGroup[]>([]);
  const [filteredGroups, setFilteredGroups] = useState<ClientGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  
  // Search and Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'with-filters' | 'manual-only'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'members' | 'updated'>('updated');
  
  // Delete Confirmation State
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<ClientGroup | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Editor State
  const [editingGroup, setEditingGroup] = useState<ClientGroup | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  // Apply search and filters
  useEffect(() => {
    let result = [...groups];
    
    // Search filter
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(g => 
        g.name.toLowerCase().includes(lower) || 
        g.description?.toLowerCase().includes(lower)
      );
    }
    
    // Type filter
    if (filterType === 'with-filters') {
      result = result.filter(g => g.filterConfig && Object.keys(g.filterConfig).some(key => {
        const value = g.filterConfig?.[key as keyof typeof g.filterConfig];
        return Array.isArray(value) && value.length > 0;
      }));
    } else if (filterType === 'manual-only') {
      result = result.filter(g => g.clientIds && g.clientIds.length > 0 && (!g.filterConfig || Object.keys(g.filterConfig).length === 0));
    }
    
    // Sort
    result.sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      } else if (sortBy === 'members') {
        return (b.clientCount || 0) - (a.clientCount || 0);
      } else {
        const aDate = new Date(a.updatedAt || a.createdAt || 0);
        const bDate = new Date(b.updatedAt || b.createdAt || 0);
        return bDate.getTime() - aDate.getTime();
      }
    });
    
    setFilteredGroups(result);
  }, [groups, searchTerm, filterType, sortBy]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [fetchedGroups, fetchedClients, fetchedProviders] = await Promise.all([
        communicationApi.getGroups(),
        communicationApi.getClients(),
        communicationApi.getProviders()
      ]);
      // Filter to show custom groups - include groups without a type field (legacy) or explicitly custom
      setGroups(fetchedGroups.filter(g => !g.type || g.type === 'custom'));
      setClients(fetchedClients);
      setProviders(fetchedProviders);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load groups and configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setEditingGroup(null);
    setView('edit');
  };

  const handleEdit = (group: ClientGroup) => {
    setEditingGroup(group);
    setView('edit');
  };

  const handleSave = async (groupData: Partial<ClientGroup>) => {
    if (!groupData.name?.trim()) {
      toast.error('Group name is required');
      return;
    }

    setIsSaving(true);
    try {
      if (editingGroup) {
        await communicationApi.updateGroup(editingGroup.id, groupData);
        toast.success('Group updated successfully');
      } else {
        await communicationApi.createGroup(groupData);
        toast.success('Group created successfully');
      }
      
      await loadData(); // Reload to get updated counts
      setView('list');
    } catch (error) {
      console.error('Failed to save group:', error);
      toast.error('Failed to save group');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setIsDeleting(true);
      await communicationApi.deleteGroup(id);
      setGroups(groups.filter(g => g.id !== id));
      toast.success('Group deleted successfully');
    } catch (error) {
      console.error('Failed to delete group:', error);
      toast.error('Failed to delete group');
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setGroupToDelete(null);
    }
  };
  
  const handleRecalculate = async () => {
    try {
      setLoading(true);
      toast.info('Recalculating group memberships...');
      await communicationApi.recalculateGroupMemberships();
      await loadData(); // Reload groups to get updated counts
      toast.success('Group memberships updated successfully');
    } catch (error) {
      console.error('Failed to recalculate group memberships:', error);
      toast.error('Failed to recalculate group memberships');
    } finally {
      setLoading(false);
    }
  };
  
  const handleDebug = async () => {
    try {
      const debugData = await communicationApi.debugGroups();
      console.log('===== GROUP & CLIENT DEBUG DATA =====');
      console.log('Groups:', debugData.groups);
      console.log('Clients:', debugData.clients);
      console.log('Summary:', debugData.summary);
      console.log('====================================');
      toast.success('Debug data logged to console');
    } catch (error) {
      console.error('Failed to fetch debug data:', error);
      toast.error('Failed to fetch debug data');
    }
  };

  const getActiveFilters = (group: ClientGroup): string[] => {
    if (!group.filterConfig) return [];
    
    const filters: string[] = [];
    const config = group.filterConfig;
    
    if (config.productFilters?.length) filters.push('Products');
    if (config.netWorthFilters?.length) filters.push('Net Worth');
    if (config.ageFilters?.length) filters.push('Age');
    if (config.maritalStatusFilters?.length) filters.push('Marital Status');
    if (config.employmentStatusFilters?.length) filters.push('Employment');
    if (config.genderFilters?.length) filters.push('Gender');
    if (config.countryFilters?.length) filters.push('Country');
    if (config.incomeFilters?.length) filters.push('Income');
    if (config.occupationFilters?.length) filters.push('Occupation');
    if (config.dependantCountFilters?.length) filters.push('Dependants');
    if (config.retirementAgeFilters?.length) filters.push('Retirement Age');
    
    return filters;
  };

  if (view === 'edit') {
    return (
      <GroupEditor
        group={editingGroup}
        clients={clients}
        providers={providers}
        onSave={handleSave}
        onCancel={() => setView('list')}
        isSaving={isSaving}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Button variant="outline" onClick={onClose}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Selection
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Custom Groups</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage and organize your client groups
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={handleDebug} className="gap-2 hidden">
            🐛 Debug
          </Button>
          <Button variant="outline" onClick={handleRecalculate} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Recalculate
          </Button>
          <Button onClick={handleCreateNew} className="gap-2">
            <Plus className="h-4 w-4" /> Create New Group
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search groups by name or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={filterType} onValueChange={(v: string) => setFilterType(v)}>
          <SelectTrigger className="w-[200px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Groups</SelectItem>
            <SelectItem value="with-filters">With Filters</SelectItem>
            <SelectItem value="manual-only">Manual Only</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={(v: string) => setSortBy(v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="updated">Recently Updated</SelectItem>
            <SelectItem value="name">Name (A-Z)</SelectItem>
            <SelectItem value="members">Member Count</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
          <p className="text-muted-foreground">Loading groups...</p>
        </div>
      ) : groups.length === 0 ? (
        <div className="col-span-full text-center py-12 border-2 border-dashed rounded-lg bg-muted/20">
          <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">No Custom Groups</h3>
          <p className="text-muted-foreground mb-6">Create your first custom group to start organizing clients.</p>
          <Button onClick={handleCreateNew}>Create Group</Button>
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="col-span-full text-center py-12 border-2 border-dashed rounded-lg bg-muted/20">
          <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">No Groups Found</h3>
          <p className="text-muted-foreground">Try adjusting your search or filters.</p>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Group Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-center">Members</TableHead>
                <TableHead>Active Filters</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredGroups.map((group) => {
                const activeFilters = getActiveFilters(group);
                
                return (
                  <TableRow key={group.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell className="font-medium">{group.name}</TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">
                      {group.description || '—'}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Badge variant="secondary" className="gap-1">
                          <Users className="h-3 w-3" />
                          {group.clientCount || 0}
                        </Badge>
                        {group.externalContacts && group.externalContacts.length > 0 && (
                          <Badge variant="outline" className="gap-1 text-[10px] text-purple-600 border-purple-200">
                            {group.externalContacts.length} external
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {activeFilters.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {activeFilters.slice(0, 3).map((filter) => (
                            <Badge key={filter} variant="outline" className="text-[10px] px-1.5 py-0">
                              {filter}
                            </Badge>
                          ))}
                          {activeFilters.length > 3 && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              +{activeFilters.length - 3} more
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Manual selection</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(group.updatedAt || group.createdAt || Date.now()).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {onSelectGroup && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onSelectGroup(group)}
                          >
                            Select
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(group);
                          }}
                          aria-label="Edit group"
                        >
                          <Edit2 className="h-4 w-4 text-muted-foreground hover:text-primary" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            setGroupToDelete(group);
                            setDeleteDialogOpen(true);
                          }}
                          aria-label="Delete group"
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      
      {/* Summary */}
      {!loading && groups.length > 0 && (
        <div className="text-sm text-muted-foreground text-center">
          Showing {filteredGroups.length} of {groups.length} groups
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <AlertDialogTitle className="text-xl">Delete Group</AlertDialogTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  This action cannot be undone
                </p>
              </div>
            </div>
          </AlertDialogHeader>
          
          {groupToDelete && (
            <div className="space-y-4">
              <AlertDialogDescription className="text-base">
                You are about to permanently delete the following group:
              </AlertDialogDescription>
              
              <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground">{groupToDelete.name}</p>
                    {groupToDelete.description && (
                      <p className="text-sm text-muted-foreground">{groupToDelete.description}</p>
                    )}
                  </div>
                  <Badge variant="secondary" className="gap-1 ml-2">
                    <Users className="h-3 w-3" />
                    {groupToDelete.clientCount || 0}
                  </Badge>
                </div>
                
                {(() => {
                  const activeFilters = getActiveFilters(groupToDelete);
                  return activeFilters.length > 0 ? (
                    <div className="flex flex-wrap gap-1 pt-2 border-t">
                      <span className="text-xs text-muted-foreground mr-1">Filters:</span>
                      {activeFilters.map((filter) => (
                        <Badge key={filter} variant="outline" className="text-[10px] px-1.5 py-0">
                          {filter}
                        </Badge>
                      ))}
                    </div>
                  ) : null;
                })()}
              </div>
              
              <AlertDialogDescription className="text-sm">
                All client associations will be removed, but the clients themselves will not be affected.
              </AlertDialogDescription>
            </div>
          )}
          
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (groupToDelete) {
                  await handleDelete(groupToDelete.id);
                }
              }}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground gap-2"
            >
              {isDeleting ? (
                <div className="contents">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting...
                </div>
              ) : (
                <div className="contents">
                  <Trash2 className="h-4 w-4" />
                  Delete Group
                </div>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}