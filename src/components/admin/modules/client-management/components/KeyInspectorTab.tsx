/**
 * Key Inspector Tab - Client Management
 * View and manage client key values with policy drill-down
 * Located in: Manage Client Drawer → Key Inspector Tab
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../ui/card';
import { Badge } from '../../../../ui/badge';
import { Button } from '../../../../ui/button';
import { 
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Database,
  Clock
} from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../../../../ui/collapsible';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '../../../../ui/alert';
import { toast } from 'sonner@2.0.3';
import { Client } from '../types';
import { KEY_CATEGORIES } from '../../product-management/keyManagerConstants';
import { ProductKeyCategory } from '../../product-management/types';
import { useClientKeys, useRecalculateClientKeys } from '../hooks/useClientKeys';
import { CATEGORY_ICONS } from '../../resources/key-manager/constants';

interface KeyInspectorTabProps {
  selectedClient: Client;
}

interface ClientKeyValue {
  keyId: string;
  name: string;
  value: number | string | boolean | null;
  dataType: 'currency' | 'number' | 'percentage' | 'text' | 'date' | 'boolean';
  category: ProductKeyCategory;
  isCalculated: boolean;
  lastUpdated?: string;
  contributingPolicies?: ContributingPolicy[];
}

interface ContributingPolicy {
  policyId: string;
  policyName: string;
  provider: string;
  value: number;
  fieldName: string;
}

export function KeyInspectorTab({ selectedClient }: KeyInspectorTabProps) {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  // Fetch client keys using the hook
  const { data: clientKeysData, isLoading, error } = useClientKeys(selectedClient.id);
  
  // Recalculation mutation
  const { mutate: recalculate, isPending: isRecalculating } = useRecalculateClientKeys();

  // Extract data from the response
  const clientKeys = clientKeysData?.keys || [];
  const lastCalculation = clientKeysData?.lastCalculated 
    ? new Date(clientKeysData.lastCalculated).toLocaleString() 
    : 'Never';

  const handleRecalculate = () => {
    recalculate(selectedClient.id);
  };

  const toggleKeyExpansion = (keyId: string) => {
    const newExpanded = new Set(expandedKeys);
    if (newExpanded.has(keyId)) {
      newExpanded.delete(keyId);
    } else {
      newExpanded.add(keyId);
    }
    setExpandedKeys(newExpanded);
  };

  const formatValue = (value: number | string | boolean | null, dataType: string): string => {
    if (value === null || value === undefined) {
      return 'N/A';
    }

    switch (dataType) {
      case 'currency':
        return `R ${Number(value).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      case 'number':
        return String(value);
      case 'percentage':
        return `${Number(value).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
      case 'boolean':
        return value ? 'Yes' : 'No';
      case 'date':
        return new Date(String(value)).toLocaleDateString();
      default:
        return String(value);
    }
  };

  const getValueBadgeVariant = (value: number | string | boolean | null) => {
    if (value === null || value === 0 || value === '') {
      return 'secondary';
    }
    return 'default';
  };

  const groupedKeys = KEY_CATEGORIES.reduce((acc, category) => {
    const categoryKeys = clientKeys.filter(key => key.category === category.id);
    if (categoryKeys.length > 0) {
      acc[category.id] = {
        category,
        keys: categoryKeys
      };
    }
    return acc;
  }, {} as Record<ProductKeyCategory, { category: typeof KEY_CATEGORIES[0], keys: ClientKeyValue[] }>);

  const hasNonZeroValues = clientKeys.some(key => 
    key.value !== null && key.value !== 0 && key.value !== ''
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-white">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Database className="w-6 h-6 text-purple-600" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-xl">Client Key Inspector</CardTitle>
                <CardDescription className="mt-1">
                  View all calculated totals and key values for {selectedClient.firstName} {selectedClient.lastName}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right text-sm">
                <div className="text-muted-foreground">Last Updated</div>
                <div className="font-medium flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {lastCalculation}
                </div>
              </div>
              <Button 
                onClick={handleRecalculate}
                disabled={isRecalculating}
                className="bg-purple-600 hover:bg-purple-700"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isRecalculating ? 'animate-spin' : ''}`} />
                {isRecalculating ? 'Recalculating...' : 'Recalculate'}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Info Alert */}
      {!hasNonZeroValues && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No Key Data Available</AlertTitle>
          <AlertDescription>
            This client doesn't have any policies with mapped key values yet. Add policies in the Policy Details tab to populate key data.
          </AlertDescription>
        </Alert>
      )}

      {/* Keys by Category */}
      <div className="space-y-4">
        {Object.entries(groupedKeys).map(([categoryId, { category, keys }]) => {
          const Icon = CATEGORY_ICONS[category.id];
          const totalValue = keys.reduce((sum, key) => {
            if (key.dataType === 'currency' && typeof key.value === 'number') {
              return sum + key.value;
            }
            return sum;
          }, 0);

          return (
            <Card key={categoryId}>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      {Icon && <Icon className="w-5 h-5 text-gray-600" />}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{category.name}</CardTitle>
                      <CardDescription>{category.description}</CardDescription>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">Category Total</div>
                    <div className="text-xl font-bold">
                      {formatValue(totalValue, 'currency')}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {keys.map(key => {
                    const isExpanded = expandedKeys.has(key.keyId);
                    const hasContributingPolicies = key.contributingPolicies && key.contributingPolicies.length > 0;

                    return (
                      <Collapsible
                        key={key.keyId}
                        open={isExpanded}
                        onOpenChange={() => toggleKeyExpansion(key.keyId)}
                      >
                        <div className={`p-4 border rounded-lg ${
                          key.value === 0 || key.value === null 
                            ? 'bg-gray-50/50 border-gray-200' 
                            : 'bg-white border-gray-300'
                        }`}>
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-1">
                                <h4 className="font-medium text-gray-900">{key.name}</h4>
                                {key.isCalculated && (
                                  <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-300">
                                    Calculated
                                  </Badge>
                                )}
                                {key.value === 0 || key.value === null ? (
                                  <Badge variant="secondary" className="text-xs">
                                    No Data
                                  </Badge>
                                ) : (
                                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                                )}
                              </div>
                              <code className="text-xs text-gray-500 font-mono">{key.keyId}</code>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <div className={`text-2xl font-bold ${
                                  key.value === 0 || key.value === null ? 'text-gray-400' : 'text-gray-900'
                                }`}>
                                  {formatValue(key.value, key.dataType)}
                                </div>
                              </div>
                              {hasContributingPolicies && (
                                <CollapsibleTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    {isExpanded ? (
                                      <ChevronUp className="w-4 h-4" />
                                    ) : (
                                      <ChevronDown className="w-4 h-4" />
                                    )}
                                  </Button>
                                </CollapsibleTrigger>
                              )}
                            </div>
                          </div>

                          <CollapsibleContent className="mt-4">
                            {hasContributingPolicies && (
                              <div className="space-y-2 pl-4 border-l-2 border-purple-200">
                                <div className="text-sm font-medium text-gray-700 mb-2">
                                  Contributing Policies ({key.contributingPolicies?.length})
                                </div>
                                {key.contributingPolicies?.map(policy => (
                                  <div 
                                    key={policy.policyId}
                                    className="p-3 bg-purple-50/50 rounded-lg border border-purple-100"
                                  >
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1">
                                        <div className="font-medium text-sm text-gray-900">
                                          {policy.policyName}
                                        </div>
                                        <div className="text-xs text-gray-600 mt-1">
                                          {policy.provider} • {policy.fieldName}
                                        </div>
                                      </div>
                                      <div className="text-right ml-4">
                                        <div className="font-semibold text-sm">
                                          {formatValue(policy.value, key.dataType)}
                                        </div>
                                        <Button 
                                          variant="ghost" 
                                          size="sm"
                                          className="h-6 mt-1 text-xs"
                                          onClick={() => {
                                            // TODO: Navigate to policy details
                                            toast.info('View Policy', {
                                              description: 'Navigate to policy details'
                                            });
                                          }}
                                        >
                                          <ExternalLink className="w-3 h-3 mr-1" />
                                          View
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Summary Card */}
      {hasNonZeroValues && (
        <Card className="border-green-200 bg-gradient-to-br from-green-50 to-white">
          <CardHeader>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
              <div>
                <CardTitle className="text-lg">Summary</CardTitle>
                <CardDescription>
                  This client has {clientKeys.filter(k => k.value && k.value !== 0).length} active keys 
                  across {Object.keys(groupedKeys).length} categories
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
