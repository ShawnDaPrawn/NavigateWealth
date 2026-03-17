import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../ui/card';
import { Skeleton } from '../../../../ui/skeleton';
import { Activity, ArrowRight, UserPlus, FileCheck, CheckSquare, AlertCircle } from 'lucide-react';
import { useDashboardData } from '../hooks';
import type { SystemActivityCardProps } from '../types';

export function SystemActivityCard({ onViewDetails, onModuleChange, loading: propLoading }: SystemActivityCardProps) {
  const { activities, loading: hookLoading } = useDashboardData();
  const loading = propLoading || hookLoading;

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'new_applications': return UserPlus;
      case 'new_policies': return FileCheck;
      case 'pending_tasks': return CheckSquare;
      default: return Activity;
    }
  };

  const getActivityColor = (color?: string) => {
    switch (color) {
      case 'purple': return 'text-purple-600 bg-purple-50 border-purple-100';
      case 'green': return 'text-green-600 bg-green-50 border-green-100';
      case 'orange': return 'text-orange-600 bg-orange-50 border-orange-100';
      case 'blue': return 'text-blue-600 bg-blue-50 border-blue-100';
      default: return 'text-gray-600 bg-gray-50 border-gray-100';
    }
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center">
          <Activity className="h-5 w-5 mr-2 text-primary" />
          System Activity
        </CardTitle>
        <CardDescription>
          Overview of system-wide activity metrics
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="p-4 rounded-xl border border-border">
                <div className="flex justify-between items-start mb-2">
                  <Skeleton className="h-9 w-9 rounded-lg" />
                  <Skeleton className="h-5 w-10 rounded-full" />
                </div>
                <div className="mt-2">
                  <Skeleton className="h-7 w-16 mb-1" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="h-40 flex flex-col items-center justify-center text-center text-muted-foreground bg-gray-50 rounded-lg border border-dashed">
            <Activity className="h-8 w-8 mb-2 opacity-50" />
            <p>No activity data available</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {activities.map((activity) => {
              const Icon = getActivityIcon(activity.type);
              const colorClass = getActivityColor(activity.color);
              
              return (
                <div 
                  key={activity.type}
                  className={`p-4 rounded-xl border ${colorClass} transition-all hover:shadow-sm cursor-pointer relative overflow-hidden group`}
                  onClick={() => onViewDetails?.(activity.type)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="p-2 bg-white/60 rounded-lg backdrop-blur-sm">
                      <Icon className="h-5 w-5" />
                    </div>
                    {activity.growth !== 0 && (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full bg-white/60 ${
                        activity.growth > 0 ? 'text-green-700' : 'text-red-700'
                      }`}>
                        {activity.growth > 0 ? '+' : ''}{Math.round(activity.growth)}%
                      </span>
                    )}
                  </div>
                  
                  <div className="mt-2">
                    <div className="text-2xl font-bold">
                      {activity.count.toLocaleString()}
                    </div>
                    <div className="text-sm opacity-80 font-medium truncate">
                      {activity.label}
                    </div>
                  </div>

                  {/* Hover effect arrow */}
                  <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}