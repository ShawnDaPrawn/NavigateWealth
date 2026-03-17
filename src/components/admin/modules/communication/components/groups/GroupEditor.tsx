import React, { useState } from 'react';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { Button } from '../../../../../ui/button';
import { Input } from '../../../../../ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../../ui/tabs';
import { ClientGroup, Client, GroupFilterConfig } from '../../types';
import { Provider } from '../../../product-management/types';
import { FilterBuilder } from './FilterBuilder';
import { ManualSelection } from './ManualSelection';

interface GroupEditorProps {
  group: Partial<ClientGroup> | null;
  clients: Client[];
  providers: Provider[];
  onSave: (data: Partial<ClientGroup>) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
}

export function GroupEditor({ 
  group, 
  clients, 
  providers, 
  onSave, 
  onCancel, 
  isSaving 
}: GroupEditorProps) {
  const [name, setName] = useState(group?.name || '');
  const [description, setDescription] = useState(group?.description || '');
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>(group?.clientIds || []);
  const [filterConfig, setFilterConfig] = useState<GroupFilterConfig>(group?.filterConfig || {});
  const [searchTerm, setSearchTerm] = useState('');

  const handleSave = () => {
    onSave({
      name,
      description,
      type: 'custom',
      clientIds: selectedClientIds,
      filterConfig,
      clientCount: selectedClientIds.length
    });
  };

  const toggleClient = (id: string) => {
    if (selectedClientIds.includes(id)) {
      setSelectedClientIds(prev => prev.filter(cid => cid !== id));
    } else {
      setSelectedClientIds(prev => [...prev, id]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onCancel} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Groups
        </Button>
        <h2 className="text-xl font-bold">{group ? 'Edit Group' : 'Create New Group'}</h2>
        <Button onClick={handleSave} disabled={isSaving} className="gap-2">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Group
        </Button>
      </div>

      <div className="grid gap-6">
        {/* Metadata */}
        <Card>
          <CardHeader>
            <CardTitle>Group Details</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Group Name</label>
              <Input 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                placeholder="e.g. Gold Tier Clients"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Description</label>
              <Input 
                value={description} 
                onChange={(e) => setDescription(e.target.value)} 
                placeholder="Optional description..."
              />
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="filters">
          <TabsList>
            <TabsTrigger value="filters">Dynamic Filters</TabsTrigger>
            <TabsTrigger value="manual">Manual Selection ({selectedClientIds.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="filters" className="space-y-4">
            <FilterBuilder 
              filterConfig={filterConfig} 
              onChange={setFilterConfig} 
              providers={providers}
            />
          </TabsContent>

          <TabsContent value="manual">
            <ManualSelection 
              clients={clients}
              selectedIds={selectedClientIds}
              onToggle={toggleClient}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}