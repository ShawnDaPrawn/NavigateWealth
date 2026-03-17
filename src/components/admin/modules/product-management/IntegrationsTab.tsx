import React, { useState, useEffect, useRef } from 'react';
import { Tabs, TabsContent } from '../../../ui/tabs';
import { IntegrationProvider, IntegrationConfig, PreviewData } from './types';
import { productManagementApi } from './api';
import { ProviderList } from './integrations/ProviderList';
import { IntegrationHeader } from './integrations/IntegrationHeader';
import { UploadTab } from './integrations/UploadTab';
import { MappingTab } from './integrations/MappingTab';
import { toast } from 'sonner@2.0.3';
import { Inbox, LayoutList } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { integrationsKeys } from '../../../../utils/queryKeys';

export function IntegrationsTab() {
  const queryClient = useQueryClient();
  
  // UI State
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('upload');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  
  // Upload State
  const [uploadedFile, setUploadedFile] = useState<{name: string, size: string, uploadedAt: string} | null>(null);
  const [rawFile, setRawFile] = useState<File | null>(null);
  const [showUploadPreview, setShowUploadPreview] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  
  // Mapping Configuration State (Local Mutable)
  const [configMapping, setConfigMapping] = useState<{source: string, target: string}[]>([]);
  const [configSettings, setConfigSettings] = useState({ autoMap: true, ignoreUnmatched: false, strictMode: false });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Queries ---

  // 1. Fetch Providers
  const { data: providers = [], isLoading: isLoadingProviders } = useQuery({
    queryKey: integrationsKeys.providers(),
    queryFn: () => productManagementApi.fetchIntegrationProviders()
  });

  // Select first provider automatically if needed
  useEffect(() => {
    if (!selectedProviderId && providers.length > 0) {
      setSelectedProviderId(providers[0].id);
    }
  }, [providers, selectedProviderId]);

  const selectedProvider = providers.find(p => p.id === selectedProviderId);

  // Reset UI when provider changes
  useEffect(() => {
    if (selectedProvider) {
        const firstCat = selectedProvider.categoryIds[0];
        if (firstCat) setSelectedCategoryId(firstCat);
        
        setUploadedFile(null);
        setRawFile(null);
        setShowUploadPreview(false);
        setPreviewData(null);
        setActiveTab('upload');
    }
  }, [selectedProviderId, providers, selectedProvider]);

  // 2. Fetch History & Stats
  const { data: integrationStats } = useQuery({
    queryKey: integrationsKeys.history(selectedProviderId, selectedCategoryId),
    enabled: !!selectedProviderId && !!selectedCategoryId,
    queryFn: () => productManagementApi.fetchIntegrationHistory(selectedProviderId!, selectedCategoryId),
    initialData: { lastAttempted: '-', lastUpdateStatus: null, lastSuccessful: '-' }
  });

  // 3. Fetch Config
  const { data: serverConfig } = useQuery({
    queryKey: integrationsKeys.config(selectedProviderId, selectedCategoryId),
    enabled: !!selectedProviderId && !!selectedCategoryId,
    queryFn: () => productManagementApi.fetchIntegrationConfig(selectedProviderId!, selectedCategoryId)
  });

  // Sync server config to local state
  useEffect(() => {
    if (serverConfig) {
        if (serverConfig.fieldMapping) {
            const mappingArray = Object.entries(serverConfig.fieldMapping).map(([source, target]) => ({
                 source,
                 target: target as string
             }));
             setConfigMapping(mappingArray.length > 0 ? mappingArray : [{ source: '', target: '' }]);
        } else {
            setConfigMapping([{ source: '', target: '' }]);
        }
        
        if (serverConfig.settings) {
            setConfigSettings(serverConfig.settings);
        }
    }
  }, [serverConfig]);


  // --- Mutations ---

  // Upload/Process File Mutation
  const processFileMutation = useMutation({
    mutationFn: async (params: { mode: 'preview' | 'commit' }) => {
        if (!rawFile || !selectedProviderId || !selectedCategoryId) throw new Error("Missing requirements");
        
        return productManagementApi.uploadIntegrationFile(
            rawFile, 
            selectedProviderId, 
            selectedCategoryId, 
            params.mode
        );
    },
    onSuccess: (data, variables) => {
        if (variables.mode === 'preview') {
             if (data.success && data.preview) {
                const headers = [...data.preview.mappedColumns, ...data.preview.unmappedColumns];
                setPreviewData({
                    headers: headers,
                    rows: data.preview.sampleData || [],
                    validationErrors: data.preview.validationErrors
                });
                setShowUploadPreview(true);
                if (data.preview.validationErrors?.length > 0) {
                     toast.warning(`Found ${data.preview.validationErrors.length} validation issues.`);
                } else {
                     toast.success("File processed successfully.");
                }
            }
        } else {
            // Commit success
            if (data.success && data.result) {
                toast.success(`Successfully imported ${data.result.insertedRows} rows.`);
                setUploadedFile(null);
                setRawFile(null);
                setShowUploadPreview(false);
                setPreviewData(null);
                
                // Refresh stats
                queryClient.invalidateQueries({ queryKey: integrationsKeys.history(selectedProviderId, selectedCategoryId) });
            }
        }
    },
    onError: (err: Error) => {
        toast.error(err.message || 'Operation failed');
    }
  });

  // Save Config Mutation
  const saveConfigMutation = useMutation({
    mutationFn: async () => {
        if (!selectedProviderId || !selectedCategoryId) throw new Error("Missing selection");
        
        const newMappingObj: Record<string, string> = {};
        configMapping.forEach(row => {
            if (row.source && row.target) {
                newMappingObj[row.source] = row.target;
            }
        });
        
        const config: IntegrationConfig = {
            fieldMapping: newMappingObj,
            settings: configSettings
        };

        return productManagementApi.saveIntegrationConfig(selectedProviderId, selectedCategoryId, config);
    },
    onSuccess: () => {
        toast.success("Configuration saved successfully");
        queryClient.invalidateQueries({ queryKey: integrationsKeys.config(selectedProviderId, selectedCategoryId) });
    },
    onError: () => {
        toast.error("Failed to save configuration");
    }
  });

  // --- Handlers ---

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
        processSelectedFile(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          processSelectedFile(e.target.files[0]);
      }
  };

  const processSelectedFile = (file: File) => {
    setRawFile(file);
    setUploadedFile({
      name: file.name,
      size: (file.size / 1024 / 1024).toFixed(2) + ' MB',
      uploadedAt: new Date().toLocaleTimeString()
    });
    setShowUploadPreview(false);
    setPreviewData(null);
  };

  const handleProcessFile = () => {
      processFileMutation.mutate({ mode: 'preview' });
  };
  
  const handleConfirmImport = () => {
     toast.promise(
        processFileMutation.mutateAsync({ mode: 'commit' }),
        {
            loading: 'Importing data...',
            success: 'Import complete',
            error: 'Import failed'
        }
     );
  };

  const handleUpdateMapping = (targetId: string, sourceValue: string) => {
    const existingIndex = configMapping.findIndex(m => m.target === targetId);
    let newMapping = [...configMapping];
    if (existingIndex >= 0) {
        if (sourceValue.trim() === '') newMapping.splice(existingIndex, 1);
        else newMapping[existingIndex] = { ...newMapping[existingIndex], source: sourceValue };
    } else {
        if (sourceValue.trim() !== '') newMapping.push({ source: sourceValue, target: targetId });
    }
    setConfigMapping(newMapping);
  };
  
  const handleSettingChange = (key: keyof typeof configSettings, value: boolean) => {
    setConfigSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveConfiguration = () => {
      saveConfigMutation.mutate();
  };

  const isColumnMapped = (colName: string) => {
    return configMapping.some(m => m.source === colName && m.target !== '');
  };

  const matchedColumnsCount = configMapping.filter(m => m.target !== '').length;


  return (
    <div className="flex h-[calc(100vh-200px)] min-h-[800px] gap-6">
      
      {/* Left Panel: Provider List */}
      <ProviderList 
        providers={providers}
        selectedProviderId={selectedProviderId}
        onSelect={setSelectedProviderId}
      />

      {/* Right Panel: Details & Actions */}
      <div className="flex-1 flex flex-col h-full overflow-hidden rounded-lg border bg-white shadow-sm">
        {selectedProvider ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
            <IntegrationHeader 
                provider={selectedProvider} 
                selectedCategoryId={selectedCategoryId}
                onCategoryChange={setSelectedCategoryId}
            />

            {/* Tab: Upload & Sync */}
            <TabsContent value="upload" className="flex-1 overflow-y-auto p-6 bg-gray-50/30">
              <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept=".csv, .xlsx, .xls"
                  onChange={handleFileSelect}
              />
              <UploadTab 
                provider={selectedProvider}
                selectedCategoryId={selectedCategoryId}
                uploadedFile={uploadedFile}
                isProcessing={processFileMutation.isPending}
                showPreview={showUploadPreview}
                onDrop={handleFileDrop}
                onManualUpload={() => fileInputRef.current?.click()}
                onProcess={handleProcessFile}
                onClear={() => { setUploadedFile(null); setRawFile(null); setShowUploadPreview(false); setPreviewData(null); }}
                onConfirm={handleConfirmImport}
                isColumnMapped={isColumnMapped}
                previewData={previewData}
                stats={integrationStats}
                matchedColumnsCount={matchedColumnsCount}
              />
            </TabsContent>

            {/* Tab: Mapping Configuration */}
            <TabsContent value="mapping" className="flex-1 overflow-y-auto p-6 bg-gray-50/30">
              <MappingTab 
                provider={selectedProvider}
                selectedCategoryId={selectedCategoryId}
                configMapping={configMapping}
                configSettings={configSettings}
                onUpdateMapping={handleUpdateMapping}
                onUpdateSetting={handleSettingChange}
                onSave={handleSaveConfiguration}
              />
            </TabsContent>
          </Tabs>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-gray-50/30">
             {isLoadingProviders ? (
                 <div className="flex flex-col items-center gap-2">
                     <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400"></div>
                     <p className="text-sm text-gray-500">Loading providers...</p>
                 </div>
             ) : providers.length === 0 ? (
                 <div className="flex flex-col items-center gap-3 max-w-md text-center p-8">
                     <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center mb-2">
                        <Inbox className="h-6 w-6 text-gray-400" />
                     </div>
                     <h3 className="text-lg font-medium text-gray-900">No Providers Configured</h3>
                     <p className="text-sm text-gray-500">
                        You haven't set up any product providers yet. 
                        Go to the <span className="font-medium text-gray-700">Provider Management</span> tab to add your first provider.
                     </p>
                 </div>
             ) : (
                 <div className="flex flex-col items-center gap-3">
                    <LayoutList className="h-12 w-12 text-gray-300" />
                    <p className="text-lg font-medium text-gray-500">Select a provider to view details</p>
                 </div>
             )}
          </div>
        )}
      </div>
    </div>
  );
}