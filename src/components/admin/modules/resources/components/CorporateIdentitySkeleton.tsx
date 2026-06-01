import { Skeleton } from '../../../../ui/skeleton';
import { Card, CardContent } from '../../../../ui/card';

/**
 * Loading skeleton shared by the CorporateIdentityTab brand-section panels
 * (logos / colours / typography / collateral / guidelines). Extracted from
 * CorporateIdentityTab.tsx so each section can move into its own file.
 */
export function SectionSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: rows }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-4 pb-4 space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-20 w-full rounded-lg" />
              <Skeleton className="h-3 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
