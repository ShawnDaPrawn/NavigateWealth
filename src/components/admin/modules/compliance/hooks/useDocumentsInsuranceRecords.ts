import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner@2.0.3';
import { DocumentsInsuranceRecord } from '../types';
import { complianceApi } from '../api';

export function useDocumentsInsuranceRecords() {
  const [records, setRecords] = useState<DocumentsInsuranceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecords = useCallback(async () => {
    try {
      setLoading(true);
      const data = await complianceApi.getDocumentsInsuranceRecords();
      setRecords(data);
    } catch (error: unknown) {
      console.error('Error fetching documents & insurance records:', error);
      toast.error('Failed to load documents & insurance records');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  return { records, loading, refetch: fetchRecords };
}
