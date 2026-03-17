/**
 * Universal Key Manager
 * Centralized reference for all keys in the Navigate Wealth platform
 */

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../ui/card';
import { Badge } from '../../../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../ui/tabs';
import { Label } from '../../../ui/label';
import { 
  Info,
  Key,
  Database,
  Workflow,
  Calculator,
  UserCircle,
  Target,
} from 'lucide-react';
import { ProductKeyCategory } from '../product-management';
import { 
  KeyAPI,
  KeyList,
  CategoryFilter,
  SearchFilters,
  CATEGORY_ICONS,
} from './key-manager';

export function UniversalKeyManager() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ProductKeyCategory | 'all'>('all');
  const [selectedDataType, setSelectedDataType] = useState<string>('all');
  const [productKeysCategory, setProductKeysCategory] = useState<ProductKeyCategory | 'all'>('all');
  const [calculatedKeysCategory, setCalculatedKeysCategory] = useState<ProductKeyCategory | 'all'>('all');
  const [clientKeysCategory, setClientKeysCategory] = useState<ProductKeyCategory | 'all'>('all');
  const [fnaKeysCategory, setFnaKeysCategory] = useState<ProductKeyCategory | 'all'>('all');

  // Check if keys are loaded
  const hasKeys = KeyAPI.getKeyCount() > 0;
  const totalKeysCount = KeyAPI.getKeyCount();

  // Filter keys based on search and filters
  const filteredKeys = useMemo(() => {
    if (!hasKeys) return [];
    
    return KeyAPI.filterKeys({
      category: selectedCategory,
      dataType: selectedDataType,
      searchTerm: searchTerm
    });
  }, [searchTerm, selectedCategory, selectedDataType, hasKeys]);

  // Separate individual and calculated keys
  const individualKeys = useMemo(() => 
    KeyAPI.getIndividualKeys(filteredKeys),
    [filteredKeys]
  );

  const calculatedKeys = useMemo(() => 
    KeyAPI.getCalculatedKeys(filteredKeys).filter(key => !key.isRecommendation),
    [filteredKeys]
  );

  const fnaRecommendationKeys = useMemo(() => 
    filteredKeys.filter(key => key.isRecommendation),
    [filteredKeys]
  );

  // Filter out profile keys from product keys (they have their own tab)
  const productOnlyIndividualKeys = useMemo(() => 
    individualKeys.filter(key => !KeyAPI.isClientProfileKey(key)),
    [individualKeys]
  );

  const productOnlyCalculatedKeys = useMemo(() => 
    calculatedKeys.filter(key => !KeyAPI.isClientProfileKey(key)),
    [calculatedKeys]
  );

  // Get only profile keys for client keys tab
  const clientProfileKeys = useMemo(() => 
    individualKeys.filter(key => KeyAPI.isClientProfileKey(key)),
    [individualKeys]
  );

  // Filter client keys by category
  const filteredClientKeys = useMemo(() => {
    if (clientKeysCategory === 'all') return clientProfileKeys;
    return clientProfileKeys.filter(key => key.category === clientKeysCategory);
  }, [clientProfileKeys, clientKeysCategory]);

  // Filter individual keys by product keys category
  const filteredIndividualKeys = useMemo(() => {
    if (productKeysCategory === 'all') return productOnlyIndividualKeys;
    return productOnlyIndividualKeys.filter(key => key.category === productKeysCategory);
  }, [productOnlyIndividualKeys, productKeysCategory]);

  // Filter calculated keys by calculated keys category
  const filteredCalculatedKeys = useMemo(() => {
    if (calculatedKeysCategory === 'all') return productOnlyCalculatedKeys;
    return productOnlyCalculatedKeys.filter(key => key.category === calculatedKeysCategory);
  }, [productOnlyCalculatedKeys, calculatedKeysCategory]);

  // Filter FNA keys by category
  const filteredFnaKeys = useMemo(() => {
    if (fnaKeysCategory === 'all') return fnaRecommendationKeys;
    return fnaRecommendationKeys.filter(key => key.category === fnaKeysCategory);
  }, [fnaRecommendationKeys, fnaKeysCategory]);

  return (
    <div className="space-y-6">
      {/* Error State - Keys not loaded */}
      {!hasKeys && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <Info className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="space-y-2 text-sm text-red-900">
                <p className="font-medium">Key data failed to load</p>
                <p>The product key definitions could not be loaded from the key manager constants. Please refresh the page or contact support if the issue persists.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-white">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Database className="w-6 h-6 text-purple-600" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-2xl">Universal Key Manager</CardTitle>
              <CardDescription className="mt-2 text-base">
                Centralized reference for all keys in the Navigate Wealth platform. Keys are the 
                standardized data points used throughout FNAs, dashboards, reports, and calculations.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Info Alert */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="space-y-2 text-sm text-blue-900">
              <p className="font-medium">Understanding Client Keys:</p>
              <ul className="list-disc list-inside space-y-1 text-blue-800">
                <li><strong>Product Keys</strong> - Individual data points mapped from product fields (e.g., &quot;Life Cover&quot; for a specific policy)</li>
                <li><strong>Calculated Keys</strong> - Automatically computed totals by summing related product keys (e.g., &quot;Life Cover Total&quot; across all policies)</li>
                <li><strong>Client Key Values</strong> - Stored per client in KV store (e.g., <code className="bg-blue-100 px-1 rounded">user_profile:shawn:client_keys</code>)</li>
                <li><strong>Usage</strong> - Keys power FNAs, dashboards, AI advice engine, reports, and compliance tracking</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Search & Filter Keys</CardTitle>
        </CardHeader>
        <CardContent>
          <SearchFilters
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            selectedDataType={selectedDataType}
            onDataTypeChange={setSelectedDataType}
          />
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs defaultValue="client-keys" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 h-12">
          <TabsTrigger value="client-keys" className="flex items-center gap-2 text-base">
            <UserCircle className="h-4 w-4" />
            Client Keys
          </TabsTrigger>
          <TabsTrigger value="product-keys" className="flex items-center gap-2 text-base">
            <Key className="h-4 w-4" />
            Product Keys
          </TabsTrigger>
          <TabsTrigger value="calculated-keys" className="flex items-center gap-2 text-base">
            <Calculator className="h-4 w-4" />
            Calculated Keys
          </TabsTrigger>
          <TabsTrigger value="fna-recommendations" className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4" />
            FNA Recommendations
          </TabsTrigger>
          <TabsTrigger value="key-usage" className="flex items-center gap-2 text-base">
            <Workflow className="h-4 w-4" />
            Key Usage
          </TabsTrigger>
        </TabsList>

        {/* Client Keys Tab */}
        <TabsContent value="client-keys">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Client Profile Keys</CardTitle>
                  <CardDescription className="mt-1">
                    Keys that store individual client information across profile categories
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-sm">
                  {filteredClientKeys.length} keys
                </Badge>
              </div>
              
              {/* Category Filter */}
              <div className="mt-4 pt-4 border-t">
                <CategoryFilter
                  keys={clientProfileKeys}
                  selectedCategory={clientKeysCategory}
                  onCategoryChange={setClientKeysCategory}
                  filterType="profile"
                />
              </div>
            </CardHeader>
            <CardContent>
              <KeyList
                keys={filteredClientKeys}
                emptyStateTitle="No client keys found"
                emptyStateDescription="Try adjusting your search filters"
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Product Keys Tab */}
        <TabsContent value="product-keys">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Individual Product Keys</CardTitle>
                  <CardDescription className="mt-1">
                    Keys that can be assigned to individual product fields in policy structures
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-sm">
                  {filteredIndividualKeys.length} keys
                </Badge>
              </div>
              
              {/* Category Filter */}
              <div className="mt-4 pt-4 border-t">
                <CategoryFilter
                  keys={productOnlyIndividualKeys}
                  selectedCategory={productKeysCategory}
                  onCategoryChange={setProductKeysCategory}
                  filterType="product"
                />
              </div>
            </CardHeader>
            <CardContent>
              <KeyList
                keys={filteredIndividualKeys}
                emptyStateTitle="No product keys found"
                emptyStateDescription="Try adjusting your search filters"
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Calculated Keys Tab */}
        <TabsContent value="calculated-keys">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Calculated Total Keys</CardTitle>
                  <CardDescription className="mt-1">
                    Automatically computed totals derived from summing product keys across all client policies
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-sm">
                  {filteredCalculatedKeys.length} totals
                </Badge>
              </div>
              
              {/* Category Filter */}
              <div className="mt-4 pt-4 border-t">
                <CategoryFilter
                  keys={productOnlyCalculatedKeys}
                  selectedCategory={calculatedKeysCategory}
                  onCategoryChange={setCalculatedKeysCategory}
                  filterType="product"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-6 p-4 bg-amber-50 rounded-lg border border-amber-200">
                <div className="flex gap-3">
                  <Info className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-amber-900">
                    <p className="font-medium mb-1">How Calculated Keys Work:</p>
                    <p>These totals are automatically computed by the backend <code className="bg-amber-100 px-1 rounded">recalculateClientTotals</code> function whenever policies are saved. The FNA modules read these pre-calculated values from the KV store.</p>
                  </div>
                </div>
              </div>

              <KeyList
                keys={filteredCalculatedKeys}
                emptyStateTitle="No calculated keys found"
                emptyStateDescription="Try adjusting your search filters"
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* FNA Recommendations Tab */}
        <TabsContent value="fna-recommendations">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>FNA Recommendations</CardTitle>
                  <CardDescription className="mt-1">
                    Keys that store calculated recommendation values from Financial Needs Analysis
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-sm">
                  {filteredFnaKeys.length} recommendations
                </Badge>
              </div>
              
              {/* Category Filter */}
              <div className="mt-4 pt-4 border-t">
                <CategoryFilter
                  keys={fnaRecommendationKeys}
                  selectedCategory={fnaKeysCategory}
                  onCategoryChange={setFnaKeysCategory}
                  filterType="product"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
                <div className="flex gap-3">
                  <Target className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-purple-900">
                    <p className="font-medium mb-1">How FNA Recommendations Work:</p>
                    <p>These keys are used to store the &quot;Recommended&quot; or &quot;Goal&quot; values calculated by the FNA engines. They can be mapped to document generation, AI advice, and summary dashboards.</p>
                  </div>
                </div>
              </div>

              <KeyList
                keys={filteredFnaKeys}
                emptyStateTitle="No FNA recommendations found"
                emptyStateDescription="Try adjusting your search filters"
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Key Usage Tab */}
        <TabsContent value="key-usage">
          <Card>
            <CardHeader>
              <CardTitle>Key Usage Across Modules</CardTitle>
              <CardDescription className="mt-1">
                See which modules and features consume each key
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {KeyAPI.KEY_CATEGORIES.map(category => {
                  const categoryKeys = KeyAPI.getKeysByCategory(category.id).filter(key =>
                    KeyAPI.KEY_USAGE_MAP[key.id] && KeyAPI.KEY_USAGE_MAP[key.id].length > 0
                  );

                  if (categoryKeys.length === 0) return null;

                  const Icon = CATEGORY_ICONS[category.id];

                  return (
                    <div key={category.id} className="space-y-3">
                      <div className="flex items-center gap-2 pb-2 border-b">
                        <Icon className="w-5 h-5 text-gray-600" />
                        <h3 className="font-semibold text-gray-900">{category.name}</h3>
                        <Badge variant="outline" className="text-xs">
                          {categoryKeys.length} keys
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {categoryKeys.map(key => (
                          <div 
                            key={key.id}
                            className="p-3 border rounded-lg bg-gray-50/50 hover:bg-gray-50"
                          >
                            <div className="flex items-start gap-3">
                              <Workflow className="w-4 h-4 text-blue-600 mt-1 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm text-gray-900 mb-1">
                                  {key.name}
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {KeyAPI.KEY_USAGE_MAP[key.id]?.map(module => (
                                    <Badge 
                                      key={module}
                                      variant="outline"
                                      className="text-xs bg-blue-50 text-blue-700 border-blue-200"
                                    >
                                      {module}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}