import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import { ArrowRight, FileText, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { useDashboardData } from '../hooks';
import { getStatusLabel, getStatusVariant, formatDate } from '../utils';
import type { RequestsWidgetProps } from '../types';

export function RequestsWidget({ 
  onViewAll, 
  onModuleChange, 
  onViewRequest,
  maxRequests = 5 
}: RequestsWidgetProps) {
  const { requests, loading } = useDashboardData();

  const handleViewAll = () => {
    if (onViewAll) {
      onViewAll();
    } else if (onModuleChange) {
      onModuleChange('quotes'); // Using 'quotes' as the module name for Requests based on AdminDashboardPage switch
    }
  };

  const displayRequests = requests.slice(0, maxRequests);

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-lg font-semibold flex items-center">
            <FileText className="h-5 w-5 mr-2 text-primary" />
            Recent Requests
          </CardTitle>
          <CardDescription>Latest client service requests</CardDescription>
        </div>
        <Button variant="ghost" size="sm" onClick={handleViewAll}>
          View All <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="flex-1">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-gray-50 rounded animate-pulse" />
            ))}
          </div>
        ) : displayRequests.length === 0 ? (
          <div className="h-40 flex flex-col items-center justify-center text-center text-muted-foreground bg-gray-50 rounded-lg border border-dashed">
            <CheckCircle className="h-8 w-8 mb-2 opacity-50" />
            <p>No recent requests found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {displayRequests.map((request) => (
              <div 
                key={request.id} 
                className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                onClick={() => onViewRequest?.(request.id)}
              >
                <div className="flex items-start space-x-3 mb-2 sm:mb-0">
                  <div className="p-2 bg-primary/10 rounded-full flex-shrink-0 mt-0.5">
                    <FileText className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium text-sm text-gray-900">
                      {request.templateName}
                    </div>
                    <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {request.recipientEmail}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between sm:justify-end space-x-3 w-full sm:w-auto">
                  <Badge variant={getStatusVariant(request.status)}>
                    {getStatusLabel(request.status)}
                  </Badge>
                  <div className="text-xs text-muted-foreground flex items-center whitespace-nowrap">
                    <Clock className="h-3 w-3 mr-1" />
                    {formatDate(request.createdAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
