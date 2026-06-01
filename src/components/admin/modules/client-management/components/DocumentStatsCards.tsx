import { Card, CardContent } from '../../../../ui/card';
import { Badge } from '../../../../ui/badge';
import { FileText, Link as LinkIcon, Folder } from 'lucide-react';
import type { DocumentItem } from './documentsUtils';

interface DocumentStatsCardsProps {
  /** Number of document "packs" (grouped uploads) — the Total Packs stat. */
  totalPacks: number;
  /** The filtered document list the doc/link/new counts are derived from. */
  filteredDocuments: DocumentItem[];
}

/** The four summary stat cards (Total Packs / Documents / Links / New) shown
 *  above the DocumentsTab filter bar. */
export function DocumentStatsCards({ totalPacks, filteredDocuments }: DocumentStatsCardsProps) {
  return (
    <div className="grid grid-cols-4 gap-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Packs</p>
              <p className="text-2xl font-semibold">{totalPacks}</p>
            </div>
            <Folder className="h-8 w-8 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Documents</p>
              <p className="text-2xl font-semibold">
                {filteredDocuments.filter((d) => d.type === 'document').length}
              </p>
            </div>
            <FileText className="h-8 w-8 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Links</p>
              <p className="text-2xl font-semibold">
                {filteredDocuments.filter((d) => d.type === 'link').length}
              </p>
            </div>
            <LinkIcon className="h-8 w-8 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">New</p>
              <p className="text-2xl font-semibold">
                {filteredDocuments.filter((d) => d.status === 'new').length}
              </p>
            </div>
            <Badge className="bg-blue-100 text-blue-800">New</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
