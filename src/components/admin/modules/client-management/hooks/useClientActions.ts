import { useState } from 'react';
import { toast } from 'sonner@2.0.3';
import { clientApi } from '../api';

export function useClientActions() {
  const [updating, setUpdating] = useState(false);

  const updateClientMetadata = async (userId: string, metadata: Record<string, unknown>) => {
    try {
      setUpdating(true);
      await clientApi.updateClientMetadata(userId, metadata);
      toast.success('Client profile updated successfully');
      return true;
    } catch (error: unknown) {
      console.error('Error updating client:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Failed to update client: ' + errorMessage);
      return false;
    } finally {
      setUpdating(false);
    }
  };

  const runSanctionsScreening = async (userId: string) => {
    try {
      setUpdating(true);
      await clientApi.runSanctionsScreening(userId);
      toast.success('Sanctions screening completed. No matches found.');
      return true;
    } catch (error: unknown) {
      console.error('Error running sanctions screening:', error);
      toast.error('Sanctions screening failed');
      return false;
    } finally {
      setUpdating(false);
    }
  };

  return { 
    updating, 
    updateClientMetadata,
    runSanctionsScreening
  };
}