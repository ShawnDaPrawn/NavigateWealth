import React, { useState } from 'react';
import { ArrowLeft, Save, Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '../../../../../ui/button';
import { Input } from '../../../../../ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../../ui/tabs';
import { ClientGroup, Client, GroupFilterConfig, ExternalContact } from '../../types';
import { Provider } from '../../../product-management/types';
import { FilterBuilder } from './FilterBuilder';
import { ManualSelection } from './ManualSelection';
import { toast } from 'sonner@2.0.3';

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
  const isNewsletterSystemGroup = group?.id === 'sys_newsletter_contacts';
  const [name, setName] = useState(group?.name || '');
  const [description, setDescription] = useState(group?.description || '');
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>(group?.clientIds || []);
  const [filterConfig, setFilterConfig] = useState<GroupFilterConfig>(group?.filterConfig || {});
  const [externalContacts, setExternalContacts] = useState<ExternalContact[]>(group?.externalContacts || []);
  const [searchTerm, setSearchTerm] = useState('');

  const handleSave = () => {
    const invalidContacts = externalContacts.filter(
      (contact) => contact.email.trim() && !contact.email.includes('@'),
    );
    if (invalidContacts.length > 0) {
      toast.error('Please fix invalid external contact emails before saving');
      return;
    }

    const now = new Date().toISOString();
    const normalizedExternalContacts = externalContacts
      .map((contact) => ({
        email: contact.email.trim().toLowerCase(),
        name: contact.name?.trim() || undefined,
        source: contact.source || (isNewsletterSystemGroup ? 'newsletter' : 'manual'),
        subscribedAt: contact.subscribedAt || now,
      }))
      .filter((contact) => contact.email.includes('@'));

    if (isNewsletterSystemGroup) {
      onSave({
        externalContacts: normalizedExternalContacts,
      });
      return;
    }

    onSave({
      name,
      description,
      type: group?.type || 'custom',
      clientIds: selectedClientIds,
      filterConfig,
      externalContacts: normalizedExternalContacts,
      clientCount: selectedClientIds.length + normalizedExternalContacts.length,
    });
  };

  const toggleClient = (id: string) => {
    if (selectedClientIds.includes(id)) {
      setSelectedClientIds(prev => prev.filter(cid => cid !== id));
    } else {
      setSelectedClientIds(prev => [...prev, id]);
    }
  };

  const addExternalContact = () => {
    setExternalContacts((prev) => [
      ...prev,
      {
        email: '',
        name: '',
        source: isNewsletterSystemGroup ? 'newsletter' : 'manual',
        subscribedAt: new Date().toISOString(),
      },
    ]);
  };

  const updateExternalContact = (
    index: number,
    key: keyof ExternalContact,
    value: string,
  ) => {
    setExternalContacts((prev) =>
      prev.map((contact, idx) => {
        if (idx !== index) return contact;
        return {
          ...contact,
          [key]: value,
        };
      }),
    );
  };

  const removeExternalContact = (index: number) => {
    setExternalContacts((prev) => prev.filter((_, idx) => idx !== index));
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
                readOnly={isNewsletterSystemGroup}
                placeholder="e.g. Gold Tier Clients"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Description</label>
              <Input 
                value={description} 
                onChange={(e) => setDescription(e.target.value)} 
                readOnly={isNewsletterSystemGroup}
                placeholder="Optional description..."
              />
            </div>
          </CardContent>
        </Card>

        {!isNewsletterSystemGroup && (
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
        )}

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">External Contacts ({externalContacts.length})</CardTitle>
              <Button size="sm" variant="outline" onClick={addExternalContact} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Add Contact
              </Button>
            </div>
            {isNewsletterSystemGroup && (
              <p className="text-xs text-muted-foreground">
                Edit newsletter contact names and emails here. Changes update the newsletter audience details.
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {externalContacts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No external contacts in this group yet.</p>
            ) : (
              externalContacts.map((contact, index) => (
                <div key={`${contact.email}-${index}`} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                  <Input
                    value={contact.name || ''}
                    onChange={(e) => updateExternalContact(index, 'name', e.target.value)}
                    placeholder="Full name"
                  />
                  <Input
                    type="email"
                    value={contact.email}
                    onChange={(e) => updateExternalContact(index, 'email', e.target.value)}
                    placeholder="name@example.com"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeExternalContact(index)}
                    aria-label="Remove external contact"
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
