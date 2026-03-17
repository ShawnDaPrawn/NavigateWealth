import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '../../../../ui/card';
import { Badge } from '../../../../ui/badge';
import { Button } from '../../../../ui/button';
import { CheckCircle2, AlertCircle, Clock, Trash2 } from 'lucide-react';
import { cn } from '../../../../ui/utils';
import { IntegrationProvider, PRODUCT_CATEGORIES } from '../types';

interface ProviderListProps {
  providers: IntegrationProvider[];
  selectedProviderId: string | null;
  onSelect: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function ProviderList({ providers, selectedProviderId, onSelect, onDelete }: ProviderListProps) {
  return (
    <Card className="w-1/3 min-w-[300px] flex flex-col h-full overflow-hidden">
      <CardHeader className="pb-4 border-b bg-gray-50/50">
        <CardTitle className="text-lg">Integration Providers</CardTitle>
        <CardDescription>Select a provider to manage data sync</CardDescription>
      </CardHeader>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {providers.map((provider) => (
          <div
            key={provider.id}
            onClick={() => onSelect(provider.id)}
            className={cn(
              "relative p-4 rounded-lg border transition-all cursor-pointer hover:shadow-md group",
              selectedProviderId === provider.id 
                ? "border-purple-500 bg-purple-50/50 ring-1 ring-purple-200" 
                : "border-gray-200 bg-white hover:border-purple-200"
            )}
          >
            <div className="flex justify-between items-start mb-2 pr-6">
              <h3 className="font-semibold text-gray-900">{provider.name}</h3>
              {provider.lastUpdateStatus === 'success' && (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Active
                </Badge>
              )}
              {provider.lastUpdateStatus === 'failed' && (
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 gap-1">
                  <AlertCircle className="w-3 h-3" /> Failed
                </Badge>
              )}
              {provider.lastUpdateStatus === 'never' && (
                <Badge variant="outline" className="text-gray-500 border-gray-200">
                  Not Synced
                </Badge>
              )}
            </div>
            
            <div className="space-y-1 mb-3">
               <div className="flex flex-wrap gap-1">
                  {provider.categoryIds.slice(0, 3).map(cat => (
                    <span key={cat} className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-full border border-gray-200">
                      {PRODUCT_CATEGORIES.find(c => c.id === cat)?.name}
                    </span>
                  ))}
                  {provider.categoryIds.length > 3 && (
                    <span className="text-[10px] px-1.5 py-0.5 text-gray-500">+ {provider.categoryIds.length - 3} more</span>
                  )}
               </div>
            </div>

            <div className="text-xs text-gray-500 flex items-center gap-1 mt-3 pt-3 border-t border-gray-100">
              <Clock className="w-3 h-3" />
              Last updated: {provider.lastAttempted || 'Never'}
            </div>

            {onDelete && (
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete provider ${provider.name}`}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 h-6 w-6 text-gray-400 hover:text-red-600 hover:bg-red-50"
                    onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Are you sure you want to delete ${provider.name}?`)) {
                            onDelete(provider.id);
                        }
                    }}
                >
                    <Trash2 className="w-3 h-3" />
                </Button>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}