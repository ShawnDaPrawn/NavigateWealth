import { useState } from 'react';

import {
  Provider,
  SaveProviderRequest,
  getPortalAutomationCategoryOptions,
  getProductCategoryLabel,
  type ProductCategoryId,
} from './types';
import { useProviders } from './hooks/useProviders';
import { DsButton, ErrorState, useBreadcrumbTrail } from '../../layout/page';
import { ProviderList } from './components/ProviderList';
import { ProviderFormDialog } from './components/ProviderFormDialog';
import { ProviderDeleteDialog } from './components/ProviderDeleteDialog';

export function ProviderManagementTab() {
  const {
    providers,
    isLoading,
    error,
    fetchProviders,
    addProvider,
    updateProvider,
    deleteProvider,
  } = useProviders();
  useBreadcrumbTrail([{ label: 'Providers' }]);

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
      {error ? (
        <ErrorState
          title="Unable to load providers"
          onRetry={() => void fetchProviders()}
          details={(error as Error).message}
        />
      ) : !isLoading && providers.length === 0 ? (
        <ProviderList
          providers={[]}
          isLoading={false}
          onEdit={handleOpenModal}
          onAdd={() => handleOpenModal()}
        />
      ) : (
        <section className="ds-card overflow-hidden">
          {/* PM-Providers: search, count and Add provider sit in the card's toolbar */}
          <div className="ds-toolbar">
            <input
              className="ds-input"
              placeholder="Search providers…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search providers"
            />
            <span className="grow" />
            <span className="ds-meta tabular-nums">
              {isLoading
                ? 'Providers'
                : `${providers.length} ${providers.length === 1 ? 'provider' : 'providers'}`}
            </span>
            <DsButton size="sm" variant="primary" onClick={() => handleOpenModal()}>
              Add provider
            </DsButton>
          </div>
          <ProviderList
            providers={filteredProviders}
            isLoading={isLoading}
            onEdit={handleOpenModal}
            onDelete={handleDeleteClick}
            isFiltered={searchQuery.trim().length > 0}
            onAdd={() => handleOpenModal()}
          />
        </section>
      )}

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
