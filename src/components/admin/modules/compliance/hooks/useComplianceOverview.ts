import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner@2.0.3';
import { ComplianceActivity, ComplianceDeadline, ComplianceStats } from '../types';
import { complianceApi } from '../api';

export function useComplianceOverview() {
  const [activities, setActivities] = useState<ComplianceActivity[]>([]);
  const [deadlines, setDeadlines] = useState<ComplianceDeadline[]>([]);
  const [stats, setStats] = useState<ComplianceStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [activitiesData, deadlinesData, statsData] = await Promise.all([
        complianceApi.getRecentActivities(),
        complianceApi.getUpcomingDeadlines(),
        complianceApi.getComplianceStats()
      ]);
      
      setActivities(activitiesData);
      setDeadlines(deadlinesData);
      setStats(statsData);
    } catch (error: unknown) {
      console.error('Error fetching compliance overview data:', error);
      toast.error('Failed to load compliance overview');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { activities, deadlines, stats, loading, refetch: fetchData };
}
