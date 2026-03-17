import React from 'react';
import { ComplianceKPIs } from './ComplianceKPIs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../ui/card';
import { Badge } from '../../../../ui/badge';
import { Button } from '../../../../ui/button';
import { 
  FileText, 
  CheckCircle, 
  AlertTriangle, 
  Calendar,
  ArrowRight,
  Activity
} from 'lucide-react';
import { useComplianceOverview } from '../hooks/useComplianceOverview';

export function ComplianceOverview({ onViewTab }: { onViewTab: (tab: string) => void }) {
  const { activities, deadlines, stats, loading } = useComplianceOverview();

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-slate-100 animate-pulse rounded" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-slate-100 animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-500">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Compliance Overview</h2>
        <p className="text-muted-foreground">
          High-level view of regulatory status and pending actions.
        </p>
      </div>

      <ComplianceKPIs stats={stats} />

      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Recent Activity
            </CardTitle>
            <CardDescription>Latest compliance actions and system events</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activities.map((activity) => (
                <div key={activity.id} className="flex items-start gap-4 pb-4 border-b last:border-0 last:pb-0">
                  <div className={`mt-1 p-2 rounded-full ${
                    activity.status === 'success' ? 'bg-green-100 text-green-600' :
                    activity.status === 'warning' ? 'bg-amber-100 text-amber-600' :
                    'bg-blue-100 text-blue-600'
                  }`}>
                    {activity.status === 'success' ? <CheckCircle className="h-4 w-4" /> :
                     activity.status === 'warning' ? <AlertTriangle className="h-4 w-4" /> :
                     <FileText className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium leading-none">{activity.description}</p>
                    <div className="flex items-center text-xs text-muted-foreground">
                      <span>{activity.user}</span>
                      <span className="mx-1">•</span>
                      <span>{activity.time}</span>
                    </div>
                  </div>
                </div>
              ))}
              {activities.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Deadlines */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Upcoming Deadlines
                </CardTitle>
                <CardDescription>Key regulatory dates in the next 60 days</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onViewTab('calendar')}>
                View All <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {deadlines.map((deadline) => (
                <div key={deadline.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="space-y-1">
                    <div className="font-medium text-sm">{deadline.title}</div>
                    <div className="text-xs text-muted-foreground">Due: {deadline.date}</div>
                  </div>
                  <Badge variant={deadline.daysLeft <= 14 ? "destructive" : "secondary"}>
                    {deadline.daysLeft} days left
                  </Badge>
                </div>
              ))}
              {deadlines.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No upcoming deadlines</p>
              )}
            </div>
            <div className="mt-6">
              <Button className="w-full" variant="outline" onClick={() => onViewTab('statutory')}>
                Manage Statutory Returns
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
