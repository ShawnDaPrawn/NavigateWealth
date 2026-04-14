import React from 'react';
import { Button } from '../../../../ui/button';
import { TabsList, TabsTrigger } from '../../../../ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../ui/select';
import { Bot, History, UploadCloud, Settings2 } from 'lucide-react';
import { IntegrationProvider, PRODUCT_CATEGORIES } from '../types';

interface IntegrationHeaderProps {
  provider: IntegrationProvider;
  selectedCategoryId: string;
  onCategoryChange: (id: string) => void;
}

export function IntegrationHeader({ provider, selectedCategoryId, onCategoryChange }: IntegrationHeaderProps) {
  return (
    <div className="p-6 border-b bg-white z-10">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{provider.name} Integration</h2>
          <p className="text-gray-500">Manage spreadsheet imports and field mapping for {provider.name}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-[200px]">
            <Select value={selectedCategoryId} onValueChange={onCategoryChange}>
              <SelectTrigger className="h-9 bg-white border-gray-300">
                <SelectValue placeholder="Select product..." />
              </SelectTrigger>
              <SelectContent>
                {provider.categoryIds.map(catId => (
                  <SelectItem key={catId} value={catId}>
                    {PRODUCT_CATEGORIES.find(c => c.id === catId)?.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline">
            <History className="w-4 h-4 mr-2" />
            History
          </Button>
        </div>
      </div>
      
      <TabsList className="h-auto p-1 bg-gray-100 border border-gray-200 rounded-lg inline-flex gap-1">
        <TabsTrigger 
          value="upload" 
          className="rounded-md px-4 py-1.5 text-sm data-[state=active]:bg-white data-[state=active]:text-purple-700 data-[state=active]:shadow-sm text-gray-500 font-medium transition-all flex items-center gap-2"
        >
          <UploadCloud className="w-3.5 h-3.5" />
          Upload & Sync
        </TabsTrigger>
        <TabsTrigger 
          value="mapping" 
          className="rounded-md px-4 py-1.5 text-sm data-[state=active]:bg-white data-[state=active]:text-purple-700 data-[state=active]:shadow-sm text-gray-500 font-medium transition-all flex items-center gap-2"
        >
          <Settings2 className="w-3.5 h-3.5" />
          Mapping Configuration
        </TabsTrigger>
        <TabsTrigger
          value="portal"
          className="rounded-md px-4 py-1.5 text-sm data-[state=active]:bg-white data-[state=active]:text-purple-700 data-[state=active]:shadow-sm text-gray-500 font-medium transition-all flex items-center gap-2"
        >
          <Bot className="w-3.5 h-3.5" />
          Portal Automation
        </TabsTrigger>
      </TabsList>
    </div>
  );
}
