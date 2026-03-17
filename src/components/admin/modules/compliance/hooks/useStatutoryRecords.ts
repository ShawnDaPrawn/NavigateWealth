import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner@2.0.3';
import { StatutoryRecord } from '../types';
import { complianceApi } from '../api';

export function useStatutoryRecords() {
  const [records, setRecords] = useState<StatutoryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecords = useCallback(async () => {
    try {
      setLoading(true);
      const data = await complianceApi.getStatutoryRecords();
      setRecords(data);
    } catch (error: unknown) {
      console.error('Error fetching statutory records:', error);
      toast.error('Failed to load statutory records');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  return { records, loading, refetch: fetchRecords };
}
