import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../ui/select';
import { Button } from '../../../../ui/button';
import { ChevronLeft, Plug, Settings2 } from 'lucide-react';
import { PageHeader, SegmentedList, SegmentedTrigger } from '../../../layout/page';
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
  /** Proposed changes waiting for a decision, shown as a count on the section. */
  pendingReviewCount?: number;
  /** "‹ Integrations": back to the connections list. */
  onBack?: () => void;
  /** Opens the Advanced & diagnostics page. */
  onOpenAdvanced?: () => void;
  /** The sign-in action for this provider ("Test sign-in", "Reconnect"…), when there is one. */
  connectAction?: { label: string; onClick: () => void };
  /** How we reach this provider ("Connected", "Spreadsheet sync"…), shown under the title. */
  statusLabel?: string;
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

/**
 * The top of an integration page: back link, the provider's name as the page
 * title, the header actions (guided sign-in and Advanced & diagnostics), and
 * the segmented control for the five sections. Render inside `Tabs`.
 */
export function IntegrationHeader({
  provider,
  selectedCategoryId,
  stats,
  onCategoryChange,
  pendingReviewCount = 0,
  onBack,
  onOpenAdvanced,
  connectAction,
  statusLabel = 'Spreadsheet sync',
}: IntegrationHeaderProps) {
  const automationCategoryIds = getPortalAutomationCategoryOptions(provider.categoryIds);
  const categorySummary = automationCategoryIds.map(getProductCategoryLabel).join(', ');

  return (
    <div className="flex flex-col gap-4">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex w-fit items-center gap-1 rounded text-sm text-nw-text-2 hover:text-nw-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nw-violet/60"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Integrations
        </button>
      )}
      <PageHeader
        title={`${provider.name} integration`}
        description={categorySummary ? `${statusLabel} · ${categorySummary}` : statusLabel}
        actions={
          <>
            {connectAction && (
              <Button variant="outline" onClick={connectAction.onClick}>
                <Plug className="h-4 w-4" aria-hidden="true" />
                {connectAction.label}
              </Button>
            )}
            {onOpenAdvanced && (
              <Button variant="outline" onClick={onOpenAdvanced}>
                <Settings2 className="h-4 w-4" aria-hidden="true" />
                Advanced &amp; diagnostics
              </Button>
            )}
          </>
        }
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SegmentedList aria-label="Integration sections">
          <SegmentedTrigger value="review" className="gap-1.5">
            Review
            {pendingReviewCount > 0 && (
              <span className="rounded-full bg-nw-count px-1.5 text-[11px] font-semibold tabular-nums text-nw-text-2">
                {pendingReviewCount}
              </span>
            )}
          </SegmentedTrigger>
          <SegmentedTrigger value="portfolio">Portfolio</SegmentedTrigger>
          <SegmentedTrigger value="setup">Provider setup</SegmentedTrigger>
          <SegmentedTrigger value="mapping">Mapping configuration</SegmentedTrigger>
          <SegmentedTrigger value="portal">Portal automation</SegmentedTrigger>
        </SegmentedList>

        <div className="w-full lg:w-[250px]">
          <Select
            value={selectedCategoryId}
            onValueChange={onCategoryChange}
            disabled={automationCategoryIds.length === 0}
          >
            <SelectTrigger className="h-9 bg-white" aria-label="Product category">
              <SelectValue
                placeholder={
                  automationCategoryIds.length === 0
                    ? 'No automation category'
                    : 'Select product...'
                }
              />
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
  );
}
