import React, { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import { Provider, SaveProviderRequest } from './types';
import { useProviders } from './hooks/useProviders';
import { ProviderList } from './components/ProviderList';
import { ProviderFormDialog } from './components/ProviderFormDialog';
import { ProviderDeleteDialog } from './components/ProviderDeleteDialog';

export function ProviderManagementTab() {
  const { 
    providers, 
    isLoading, 
    addProvider, 
    updateProvider, 
    deleteProvider 
  } = useProviders();

  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [providerToDelete, setProviderToDelete] = useState<Provider | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const filteredProviders = providers.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOpenModal = (provider?: Provider) => {
    if (provider) {
      setEditingProvider(provider);
    } else {
      setEditingProvider(null);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProvider(null);
  };

  const handleSave = async (data: SaveProviderRequest) => {
    setIsSaving(true);
    try {
      if (editingProvider) {
        await updateProvider(editingProvider.id, data);
      } else {
        await addProvider(data);
      }
      handleCloseModal();
    } catch (error) {
      // Error is handled in hook
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = (provider: Provider) => {
    setProviderToDelete(provider);
  };

  const handleCancelDelete = () => {
    setProviderToDelete(null);
  };

  const handleConfirmDelete = async () => {
    if (!providerToDelete) return;

    setIsDeleting(true);
    try {
      await deleteProvider(providerToDelete.id);
      setProviderToDelete(null);
    } catch (error) {
      // Error is handled in hook (toast)
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search providers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button onClick={() => handleOpenModal()} className="bg-purple-600 hover:bg-purple-700">
          <Plus className="mr-2 h-4 w-4" />
          Add Provider
        </Button>
      </div>

      <ProviderList 
        providers={filteredProviders}
        isLoading={isLoading}
        onEdit={handleOpenModal}
        onDelete={handleDeleteClick}
      />

      <ProviderFormDialog
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        initialData={editingProvider ? {
            name: editingProvider.name,
            description: editingProvider.description || '',
            categoryIds: editingProvider.categoryIds as string[],
            logo: editingProvider.logo || ''
        } : undefined}
        onSave={handleSave}
        isSaving={isSaving}
      />

      <ProviderDeleteDialog
        isOpen={!!providerToDelete}
        onClose={handleCancelDelete}
        provider={providerToDelete}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
      />
    </div>
  );
}