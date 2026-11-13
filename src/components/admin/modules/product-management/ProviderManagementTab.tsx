import { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import {
  Provider,
  SaveProviderRequest,
  getPortalAutomationCategoryOptions,
  getProductCategoryLabel,
  type ProductCategoryId,
} from './types';
import { useProviders } from './hooks/useProviders';
import { ProviderList } from './components/ProviderList';
import { ProviderFormDialog } from './components/ProviderFormDialog';
import { ProviderDeleteDialog } from './components/ProviderDeleteDialog';

export function ProviderManagementTab() {
  const { providers, isLoading, addProvider, updateProvider, deleteProvider } = useProviders();

  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [providerToDelete, setProviderToDelete] = useState<Provider | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const filteredProviders = providers.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      getPortalAutomationCategoryOptions(p.categoryIds).some((categoryId) =>
        getProductCategoryLabel(categoryId).toLowerCase().includes(searchQuery.toLowerCase()),
      ),
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
    } catch (_error) {
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
    } catch (_error) {
      // Error is handled in hook (toast)
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <span className="text-sm font-medium text-nw-text-2 tabular-nums">
            {isLoading
              ? 'Providers'
              : `${providers.length} ${providers.length === 1 ? 'provider' : 'providers'}`}
          </span>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search providers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
              aria-label="Search providers"
            />
          </div>
        </div>
        <Button onClick={() => handleOpenModal()}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add provider
        </Button>
      </div>

      <ProviderList
        providers={filteredProviders}
        isLoading={isLoading}
        onEdit={handleOpenModal}
        isFiltered={searchQuery.trim().length > 0}
        onAdd={() => handleOpenModal()}
      />

      <ProviderFormDialog
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        initialData={
          editingProvider
            ? {
                name: editingProvider.name,
                description: editingProvider.description || '',
                categoryIds: editingProvider.categoryIds as unknown as ProductCategoryId[],
                logo: editingProvider.logo || '',
              }
            : undefined
        }
        onSave={handleSave}
        isSaving={isSaving}
        onDelete={
          editingProvider
            ? () => {
                const provider = editingProvider;
                handleCloseModal();
                handleDeleteClick(provider);
              }
            : undefined
        }
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
