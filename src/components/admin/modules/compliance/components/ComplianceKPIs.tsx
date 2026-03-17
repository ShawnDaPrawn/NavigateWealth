import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../ui/card';
import { Badge } from '../../../../ui/badge';
import { Progress } from '../../../../ui/progress';
import { 
  Shield, 
  AlertTriangle, 
  FileText,
  Users,
  Calendar
} from 'lucide-react';
import { ComplianceStats } from '../types';

interface ComplianceKPIsProps {
  stats?: ComplianceStats | null;
}

export function ComplianceKPIs({ stats }: ComplianceKPIsProps) {
  // Use passed stats or fallbacks if loading/null
  // In a real app, you might want to show loading skeletons here too
  
  // Mock detailed data based on high-level stats (since we only added high level stats to the type)
  // Ideally, the API would return this detailed structure. 
  // For this refactor, I will keep the structure but use the stats where applicable.
  
  const kpis = {
    fspLicence: {
      status: 'Active',
      number: 'FSP 123456',
      nextReview: new Date('2024-08-15'),
      daysUntilReview: 45
    },
    cpdCycle: {
      required: 30,
      earned: stats ? Math.floor(stats.complianceScore * 0.3) : 18, // Mock derivation
      progress: stats ? stats.complianceScore : 60,
      deadline: new Date('2024-12-31')
    },
    statutoryReturns: {
      afsStatus: 'Submitted',
      afsDate: new Date('2024-03-31'),
      liquidityStatus: stats && stats.overdueItems > 0 ? 'Due Soon' : 'Submitted',
      liquidityDue: new Date('2024-04-30')
    },
    ficaAlerts: {
      kycPending: stats ? stats.pendingReviews : 12,
      kycExpiring: 5,
      ctrPending: 2,
      strPending: stats ? stats.riskIssues : 0
    },
  };

  const getStatusBadge = (status: string, daysUntil?: number) => {
    if (daysUntil !== undefined) {
      if (daysUntil < 0) return { variant: 'destructive' as const, className: 'bg-red-100 text-red-700 hover:bg-red-200 border-red-200', text: 'Overdue' };
      if (daysUntil <= 7) return { variant: 'destructive' as const, className: 'bg-red-100 text-red-700 hover:bg-red-200 border-red-200', text: 'Critical' };
      if (daysUntil <= 14) return { variant: 'secondary' as const, className: 'bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200', text: 'Warning' };
      return { variant: 'default' as const, className: 'bg-green-100 text-green-700 hover:bg-green-200 border-green-200', text: 'On Track' };
    }
    
    switch (status.toLowerCase()) {
      case 'active':
      case 'submitted':
        return { variant: 'default' as const, className: 'bg-green-100 text-green-700 hover:bg-green-200 border-green-200', text: status };
      case 'due soon':
        return { variant: 'secondary' as const, className: 'bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200', text: status };
      case 'overdue':
        return { variant: 'destructive' as const, className: 'bg-red-100 text-red-700 hover:bg-red-200 border-red-200', text: status };
      default:
        return { variant: 'outline' as const, className: '', text: status };
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-ZA', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 max-w-full overflow-hidden">
      {/* FSP Licence Status */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">FSP Licence</CardTitle>
          <Shield className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="text-2xl font-bold">{kpis.fspLicence.number}</div>
            <Badge {...getStatusBadge(kpis.fspLicence.status)}>
              {kpis.fspLicence.status}
            </Badge>
            <p className="text-xs text-muted-foreground">
              Next review: {formatDate(kpis.fspLicence.nextReview)}
            </p>
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span className="text-xs">
                {kpis.fspLicence.daysUntilReview} days remaining
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CPD Cycle */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">CPD Cycle</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="text-2xl font-bold">
              {kpis.cpdCycle.earned}/{kpis.cpdCycle.required}
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>Hours completed</span>
                <span>{kpis.cpdCycle.progress}%</span>
              </div>
              <Progress value={kpis.cpdCycle.progress} className="h-2" />
            </div>
            <p className="text-xs text-muted-foreground">
              Deadline: {formatDate(kpis.cpdCycle.deadline)}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Statutory Returns */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Statutory Returns</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">AFS</span>
              <Badge {...getStatusBadge(kpis.statutoryReturns.afsStatus)}>
                {kpis.statutoryReturns.afsStatus}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Liquidity</span>
              <Badge {...getStatusBadge(kpis.statutoryReturns.liquidityStatus)}>
                {kpis.statutoryReturns.liquidityStatus}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Next due: {formatDate(kpis.statutoryReturns.liquidityDue)}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* FICA Alerts */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">FICA Alerts</CardTitle>
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex justify-between">
                <span>KYC Pending</span>
                <span className="font-medium">{kpis.ficaAlerts.kycPending}</span>
              </div>
              <div className="flex justify-between">
                <span>KYC Expiring</span>
                <span className="font-medium">{kpis.ficaAlerts.kycExpiring}</span>
              </div>
              <div className="flex justify-between">
                <span>CTR Queue</span>
                <span className="font-medium">{kpis.ficaAlerts.ctrPending}</span>
              </div>
              <div className="flex justify-between">
                <span>STR Queue</span>
                <span className="font-medium">{kpis.ficaAlerts.strPending}</span>
              </div>
            </div>
            {(kpis.ficaAlerts.kycPending > 10 || kpis.ficaAlerts.kycExpiring > 3) && (
              <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Action Required
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
