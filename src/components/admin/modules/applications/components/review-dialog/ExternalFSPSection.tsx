import { Building2, Info } from 'lucide-react';
import { Badge } from '../../../../../ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../../../../ui/tooltip';
import { ExternalProvidersSection } from '../ExternalProvidersSection';
import { ReviewSection } from './shared';

interface ExternalFSPSectionProps {
  currentExternalProviders: string[];
  currentCustomProviders: string[];
  isEditing: boolean;
  onProvidersChange: (providers: string[]) => void;
  onCustomProvidersChange: (providers: string[]) => void;
}

export function ExternalFSPSection({
  currentExternalProviders,
  currentCustomProviders,
  isEditing,
  onProvidersChange,
  onCustomProvidersChange,
}: ExternalFSPSectionProps) {
  const totalCount = currentExternalProviders.length + currentCustomProviders.length;
  const hasProviders = totalCount > 0;

  return (
    <ReviewSection
      icon={Building2}
      title="External Providers (FSPs)"
      badge={
        hasProviders ? (
          <Badge
            variant="outline"
            className="text-[10px] font-medium bg-purple-50 text-purple-700 border-purple-200 ml-2"
          >
            {totalCount} provider{totalCount !== 1 ? 's' : ''}
          </Badge>
        ) : undefined
      }
      actions={
        !isEditing ? (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 text-[10px] text-gray-400 cursor-help">
                  <Info className="h-3 w-3" />
                  <span>Existing policies</span>
                </div>
              </TooltipTrigger>
              <TooltipContent className="text-xs max-w-[260px]">
                Financial service providers where the client may hold existing policies. Helps
                advisers identify existing cover.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : undefined
      }
    >
      <ExternalProvidersSection
        selectedProviders={currentExternalProviders}
        customProviders={currentCustomProviders}
        isEditing={isEditing}
        onProvidersChange={onProvidersChange}
        onCustomProvidersChange={onCustomProvidersChange}
      />
    </ReviewSection>
  );
}
