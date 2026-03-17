import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../../ui/card';
import { Badge } from '../../../../../ui/badge';
import { Progress } from '../../../../../ui/progress';
import { Button } from '../../../../../ui/button';
import { Goal } from './types';
import { calculateGoalStatus } from './utils';
import { Pencil, AlertTriangle, CheckCircle, XCircle, Target } from 'lucide-react';
import { formatCurrency } from '../../../../../../utils/currencyFormatter';

interface GoalCardProps {
  goal: Goal;
  policies: Array<{ id?: string; [key: string]: unknown }>;
  onEdit: (goal: Goal) => void;
}

export function GoalCard({ goal, policies, onEdit }: GoalCardProps) {
  const result = useMemo(() => calculateGoalStatus(goal, policies), [goal, policies]);
  
  const percentage = Math.min(100, Math.max(0, (result.projectedValue / goal.targetAmount) * 100));
  
  const statusColor = {
    'On Track': 'bg-green-100 text-green-700 hover:bg-green-100/80',
    'At Risk': 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100/80',
    'Critical': 'bg-red-100 text-red-700 hover:bg-red-100/80'
  }[result.status];

  const StatusIcon = {
    'On Track': CheckCircle,
    'At Risk': AlertTriangle,
    'Critical': XCircle
  }[result.status];

  return (
    <Card className="min-w-[320px] w-full md:w-[380px] shadow-sm hover:shadow-md transition-shadow border-t-4 border-t-blue-500 flex flex-col h-full">
      <CardHeader className="pb-3 flex-none">
        <div className="flex justify-between items-start">
           <div>
             <CardTitle className="text-base font-bold flex items-center gap-2">
                <Target className="h-4 w-4 text-blue-500" />
                {goal.name}
             </CardTitle>
             <CardDescription className="text-xs mt-1">
                Type: {goal.type || 'Wealth Accumulation'}
             </CardDescription>
           </div>
           <Badge variant="outline" className={`${statusColor} border-0 flex gap-1 whitespace-nowrap`}>
              <StatusIcon className="h-3 w-3" />
              {result.status}
           </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-between">
         <div className="space-y-4">
            {/* Main Progress Block */}
            <div className="space-y-1">
               <div className="flex justify-between text-sm items-end">
                  <span className="text-gray-500 text-xs">Projected Value</span>
                  <span className="font-bold text-base">{formatCurrency(result.projectedValue)}</span>
               </div>
               <div className="flex justify-between text-sm items-end">
                  <span className="text-gray-500 text-xs">Target Amount</span>
                  <span className="font-medium text-sm text-gray-700">{formatCurrency(goal.targetAmount)}</span>
               </div>
               <div className="pt-1">
                 <Progress value={percentage} className="h-2" indicatorClassName={
                    result.status === 'On Track' ? 'bg-green-500' :
                    result.status === 'At Risk' ? 'bg-yellow-500' : 'bg-red-500'
                 } />
               </div>
               <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                  <span>{new Date().toLocaleDateString()}</span>
                  <span className="flex gap-1 items-center">
                    Target: {new Date(goal.targetDate).toLocaleDateString()}
                    {result.monthsToTarget !== undefined && (
                        <span className={`px-1 rounded ${result.monthsToTarget < 1 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
                           ({result.monthsToTarget < 1 ? '<1' : Math.ceil(result.monthsToTarget)}mo)
                        </span>
                    )}
                  </span>
               </div>
            </div>
            
            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs bg-gray-50 p-2 rounded border border-gray-100">
               <div>
                  <div className="text-gray-400">Total Capital</div>
                  <div className="font-medium text-gray-700">{formatCurrency(result.totalCurrentValue)}</div>
               </div>
               <div>
                  <div className="text-gray-400">Total Monthly</div>
                  <div className="font-medium text-gray-700">{formatCurrency(result.totalMonthlyContribution)}</div>
               </div>
               <div>
                  <div className="text-gray-400">Assumed Growth</div>
                  <div className="font-medium text-gray-700">{goal.annualGrowthRate || 10}%</div>
               </div>
               <div>
                  <div className="text-gray-400">Assumed Inflation</div>
                  <div className="font-medium text-gray-700">{goal.inflationRate}%</div>
               </div>
            </div>

            {/* Gap Analysis / Call to Action */}
            {result.shortfall > 0 ? (
                <div className="bg-red-50 border border-red-100 p-2 rounded text-xs space-y-2">
                    <div className="flex justify-between">
                        <span className="text-red-600 font-medium">Shortfall:</span>
                        <span className="text-red-700 font-bold">{formatCurrency(result.shortfall)}</span>
                    </div>
                    {result.requiredMonthlyContribution > 0 && (
                        <div className="space-y-1 pt-1 border-t border-red-100">
                             <div className="flex justify-between items-center">
                                <span className="text-red-600">
                                   Additional Monthly:
                                </span>
                                <span className="text-red-700 font-bold bg-white px-1.5 py-0.5 rounded shadow-sm border border-red-100">
                                    {formatCurrency(result.requiredMonthlyContribution)}
                                </span>
                             </div>
                             <div className="flex justify-between items-center text-[10px] text-red-400">
                                <span>Total Recommended Monthly:</span>
                                <span>{formatCurrency(result.requiredMonthlyContribution + result.totalMonthlyContribution)}</span>
                             </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="bg-green-50 border border-green-100 p-2 rounded text-xs flex justify-between items-center">
                    <span className="text-green-600 font-medium">Surplus Projected:</span>
                    <span className="text-green-700 font-bold">{formatCurrency(Math.abs(result.shortfall))}</span>
                </div>
            )}

            <Button variant="ghost" size="sm" className="w-full text-xs h-8 mt-2" onClick={() => onEdit(goal)}>
               <Pencil className="h-3 w-3 mr-1" /> Edit Inputs
            </Button>
         </div>
      </CardContent>
    </Card>
  );
}