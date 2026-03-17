import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import { Progress } from '../../../../ui/progress';
import { CheckCircle2, Download, XCircle, FileSpreadsheet, Clock, Users, ClipboardList, ShieldCheck, TrendingUp } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { ReportRun, Report, ReportCategory } from '../types';
import { redownloadReport } from '../utils';

/**
 * Maps report category to an icon component for run list entries.
 */
const CATEGORY_ICON_MAP: Record<ReportCategory, { icon: React.ElementType; iconClass: string; bgClass: string }> = {
  clients:    { icon: Users,          iconClass: 'text-blue-600',   bgClass: 'bg-blue-50' },
  activity:   { icon: ClipboardList,  iconClass: 'text-amber-600',  bgClass: 'bg-amber-50' },
  financial:  { icon: TrendingUp,     iconClass: 'text-green-600',  bgClass: 'bg-green-50' },
  compliance: { icon: ShieldCheck,    iconClass: 'text-purple-600', bgClass: 'bg-purple-50' },
  custom:     { icon: FileSpreadsheet, iconClass: 'text-gray-600',  bgClass: 'bg-gray-50' },
};

interface ReportRunsListProps {
  runs: ReportRun[];
  reports: Report[];
}

export function ReportRunsList({ runs, reports }: ReportRunsListProps) {
  if (runs.length === 0) return null;

  const handleDownload = (run: ReportRun) => {
    const success = redownloadReport(run.id);
    if (!success) {
      toast.error('Report data is no longer in memory. Please run the report again.');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-muted-foreground" />
          Recent Report Runs
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {runs.slice(0, 10).map((run) => {
            const report = reports.find(r => r.id === run.reportId);
            const catCfg = CATEGORY_ICON_MAP[report?.category || 'custom'] || CATEGORY_ICON_MAP.custom;
            const IconComponent = catCfg.icon;
            return (
              <div key={run.id} className="flex items-center gap-4 p-3 border rounded-lg">
                <div className={`${catCfg.bgClass} p-2 rounded-lg flex-shrink-0`}>
                  <IconComponent className={`h-4 w-4 ${catCfg.iconClass}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{report?.name || 'Unknown Report'}</div>
                  <div className="text-xs text-muted-foreground">
                    Started: {new Date(run.startedAt).toLocaleString()}
                  </div>
                  {run.outputFile && run.status === 'Completed' && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      File: {run.outputFile}
                    </div>
                  )}
                  {run.error && (
                    <div className="text-xs text-red-600 mt-1 flex items-start gap-1">
                      <XCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      {run.error}
                    </div>
                  )}
                </div>
                
                <div className="w-32 flex-shrink-0">
                  {run.status === 'Running' && (
                    <div className="space-y-1">
                      <Progress value={run.progress} className="h-2" />
                      <div className="text-xs text-center text-muted-foreground">{Math.round(run.progress)}%</div>
                    </div>
                  )}
                  {run.status === 'Completed' && (
                    <Badge variant="default" className="bg-green-600">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Completed
                    </Badge>
                  )}
                  {run.status === 'Failed' && (
                    <Badge variant="destructive">
                      <XCircle className="h-3 w-3 mr-1" />
                      Failed
                    </Badge>
                  )}
                </div>
                
                {run.status === 'Completed' && (
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleDownload(run)}
                    className="flex-shrink-0"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}