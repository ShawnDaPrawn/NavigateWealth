import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { FormTemplatesModule } from '../../form-prefill';

interface FormTemplateToolProps {
  selectedClientId?: string;
}

/** The Form Mapping Studio's page body (Resources › Tools › Form Mapping Studio). */
export function FormTemplateTool({ selectedClientId }: FormTemplateToolProps) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-purple-600" aria-hidden="true" />
        </div>
      }
    >
      <FormTemplatesModule selectedClientId={selectedClientId} />
    </Suspense>
  );
}
