/**
 * PreviewPanel — Read-only summary of the draft as it currently stands.
 *
 * Extracted verbatim from RoAModuleContractManager.tsx (2,125 lines). Behaviour
 * unchanged; only the imports are new.
 */
import { FileText } from 'lucide-react';
import { Badge } from '../../../../../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../../ui/card';
import { Separator } from '../../../../../ui/separator';
import type { RoAModuleContract } from '../../types';
import { getEvidenceCount, getRequiredFieldCount } from '../roaContractHelpers';
import { getStatusBadge } from './StatusBadge';

export function PreviewPanel({ draft }: { draft: RoAModuleContract }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4" />
          Adviser Module Preview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold">{draft.title}</h3>
            {getStatusBadge(draft)}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{draft.description}</p>
        </div>
        {draft.formSchema.sections.map((section) => (
          <div key={section.id} className="space-y-3">
            <h4 className="font-medium">{section.title}</h4>
            <div className="grid gap-3 md:grid-cols-2">
              {section.fields.map((field) => (
                <div key={field.key} className="rounded-md border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm">{field.label}</span>
                    {field.required && <Badge variant="outline">Required</Badge>}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {field.type} from {field.source}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        <Separator />
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <div className="text-sm font-medium">Required Fields</div>
            <div className="text-2xl font-semibold">{getRequiredFieldCount(draft)}</div>
          </div>
          <div>
            <div className="text-sm font-medium">Required Evidence</div>
            <div className="text-2xl font-semibold">{getEvidenceCount(draft)}</div>
          </div>
          <div>
            <div className="text-sm font-medium">Document Sections</div>
            <div className="text-2xl font-semibold">{draft.documentSections.length}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
