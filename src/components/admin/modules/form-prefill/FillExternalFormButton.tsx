import { Button } from '../../../ui/button';
import { FileText } from 'lucide-react';
import { isFormPrefillEnabled } from '../../../../utils/formPrefillFeature';

interface FillExternalFormButtonProps {
  clientId: string;
}

/** Drawer entry to Tier B external PDF templates with client pre-selected. */
export function FillExternalFormButton({ clientId }: FillExternalFormButtonProps) {
  if (!isFormPrefillEnabled()) return null;

  const href = `/admin?module=resources&resourcesTab=tools&formTemplatesClientId=${encodeURIComponent(clientId)}`;

  return (
    <Button type="button" size="sm" variant="outline" asChild>
      <a href={href}>
        <FileText className="h-4 w-4 mr-2" />
        Fill external form
      </a>
    </Button>
  );
}
