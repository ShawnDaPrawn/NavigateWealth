/**
 * useFNAPublish — the Step 4 publish sequence, shared by every FNA wizard.
 *
 * Each wizard supplies only the calls that persist its own analysis and
 * return the published FNA's id. Everything around them — the publishing
 * overlay flag, the success and failure messages, the completion callback and
 * closing the dialog — is the same for all six.
 */

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { logger } from '../../../../../utils/logger';
import { FNA_WIZARD_TITLES, type FNAWizardType } from './fnaWizardFlow';

interface UseFNAPublishOptions {
  fnaType: FNAWizardType;
  onFNAComplete?: (fnaId: string) => void;
  onClose: () => void;
}

export function useFNAPublish({ fnaType, onFNAComplete, onClose }: UseFNAPublishOptions) {
  const [isPublishing, setIsPublishing] = useState(false);
  const title = FNA_WIZARD_TITLES[fnaType];

  const publish = useCallback(
    async (persist: () => Promise<string>): Promise<boolean> => {
      setIsPublishing(true);
      try {
        const fnaId = await persist();
        toast.success(`${title} published`);
        onFNAComplete?.(fnaId);
        onClose();
        return true;
      } catch (error) {
        logger.error(`Failed to publish ${title}`, error);
        toast.error(`Failed to publish ${title}. Please try again.`);
        return false;
      } finally {
        setIsPublishing(false);
      }
    },
    [title, onFNAComplete, onClose],
  );

  return { isPublishing, publish };
}
