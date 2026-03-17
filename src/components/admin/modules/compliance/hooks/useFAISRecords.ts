import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner@2.0.3';
import { FAISRecord } from '../types';
import { complianceApi } from '../api';

export function useFAISRecords() {
  const [records, setRecords] = useState<FAISRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecords = useCallback(async () => {
    try {
      setLoading(true);
      const data = await complianceApi.getFAISRecords();
      setRecords(data);
    } catch (error: unknown) {
      console.error('Error fetching FAIS records:', error);
      toast.error('Failed to load FAIS records');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  return { records, loading, refetch: fetchRecords };
}
