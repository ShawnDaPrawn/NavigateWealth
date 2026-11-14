import { TabsList, TabsTrigger } from '../../../../ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../ui/select';
import { Bot, ClipboardCheck, KeyRound, Settings2, TableProperties } from 'lucide-react';
import {
  IntegrationProvider,
  IntegrationStats,
  getPortalAutomationCategoryOptions,
  getProductCategoryLabel,
} from '../types';

interface IntegrationHeaderProps {
  provider: IntegrationProvider;
  selectedCategoryId: string;
  stats?: IntegrationStats;
  onCategoryChange: (id: string) => void;
  /** Proposed changes waiting for a decision, shown as a count on the tab. */
  pendingReviewCount?: number;
}

const formatCategorySync = (stats?: IntegrationStats) => {
  if (!stats?.lastAttempted || stats.lastAttempted === '-') return 'No sync yet';
  return stats.lastAttempted;
};

const getCategoryStatus = (stats?: IntegrationStats) => {
  if (stats?.lastUpdateStatus === 'success') return 'Successful';
  if (stats?.lastUpdateStatus === 'failed') return 'Failed';
  return 'Not synced';
};

export function IntegrationHeader({ provider, selectedCategoryId, stats, onCategoryChange, pendingReviewCount = 0 }: IntegrationHeaderProps) {
  const automationCategoryIds = getPortalAutomationCategoryOptions(provider.categoryIds);

  return (
    <div className="z-10 border-b bg-white p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-6 sm:gap-6">
        <div className="min-w-0">
          <h2 className="mb-2 text-xl font-bold text-gray-900 sm:text-2xl">{provider.name} Integration</h2>
          <p className="text-gray-500">Review proposed {provider.name} policy updates, and configure how they are collected</p>
        </div>
        <div className="flex w-full items-center gap-3 sm:w-auto sm:shrink-0">
          <div className="w-full sm:w-[250px]">
            <Select value={selectedCategoryId} onValueChange={onCategoryChange} disabled={automationCategoryIds.length === 0}>
              <SelectTrigger className="h-9 bg-white border-gray-300">
                <SelectValue placeholder={automationCategoryIds.length === 0 ? 'No automation category' : 'Select product...'} />
              </SelectTrigger>
              <SelectContent>
                {automationCategoryIds.map((catId) => (
                  <SelectItem key={catId} value={catId}>
                    {getProductCategoryLabel(catId)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-gray-500">
              {automationCategoryIds.length === 0
                ? 'Select a specific product subcategory on this provider first.'
                : `${getCategoryStatus(stats)} - Last sync: ${formatCategorySync(stats)}`}
            </p>
          </div>
        </div>
      </div>

      <TabsList className="h-auto p-1 bg-gray-100 border border-gray-200 rounded-lg inline-flex gap-1">
        <TabsTrigger
          value="upload"
          className="rounded-md px-4 py-1.5 text-sm data-[state=active]:bg-white data-[state=active]:text-purple-700 data-[state=active]:shadow-sm text-gray-500 font-medium transition-all flex items-center gap-2"
        >
          <ClipboardCheck className="w-3.5 h-3.5" />
          Review
          {pendingReviewCount > 0 && (
            <span className="ml-1 rounded-full bg-purple-100 px-1.5 text-[11px] font-semibold text-purple-700">
              {pendingReviewCount}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger
          value="portfolio"
          className="rounded-md px-4 py-1.5 text-sm data-[state=active]:bg-white data-[state=active]:text-purple-700 data-[state=active]:shadow-sm text-gray-500 font-medium transition-all flex items-center gap-2"
        >
          <TableProperties className="w-3.5 h-3.5" />
          Portfolio
        </TabsTrigger>
        <TabsTrigger
          value="setup"
          className="rounded-md px-4 py-1.5 text-sm data-[state=active]:bg-white data-[state=active]:text-purple-700 data-[state=active]:shadow-sm text-gray-500 font-medium transition-all flex items-center gap-2"
        >
          <KeyRound className="w-3.5 h-3.5" />
          Provider Setup
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
