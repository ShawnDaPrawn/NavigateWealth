import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { Calculator, ArrowRight } from 'lucide-react';

interface CalculatorsListProps {
  onSelectCalculator: (id: string) => void;
}

export function CalculatorsList({ onSelectCalculator }: CalculatorsListProps) {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold tracking-tight">Financial Calculators</h2>
        <p className="text-muted-foreground">
          Tools for financial planning, projections, and client scenarios.
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Retirement Calculator Card */}
        <Card className="hover:shadow-lg transition-all cursor-pointer group" onClick={() => onSelectCalculator('retirement')}>
          <CardHeader>
            <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center mb-4 group-hover:bg-blue-600 transition-colors">
              <Calculator className="h-6 w-6 text-blue-600 group-hover:text-white" />
            </div>
            <CardTitle>Retirement Planner</CardTitle>
            <CardDescription>
              Comprehensive retirement capital and income projection with real-return adjustments.
            </CardDescription>
          </CardHeader>
          <CardContent>
             <div className="flex items-center text-sm text-blue-600 font-medium mt-2">
               Launch Tool <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
             </div>
          </CardContent>
        </Card>

        {/* Placeholder for future calculators */}
        <Card className="opacity-60 border-dashed">
          <CardHeader>
             <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center mb-4">
              <Calculator className="h-6 w-6 text-gray-400" />
            </div>
            <CardTitle className="text-gray-500">Tax Calculator</CardTitle>
            <CardDescription>Coming Soon</CardDescription>
          </CardHeader>
        </Card>

        <Card className="opacity-60 border-dashed">
          <CardHeader>
             <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center mb-4">
              <Calculator className="h-6 w-6 text-gray-400" />
            </div>
            <CardTitle className="text-gray-500">Estate Duty Estimator</CardTitle>
            <CardDescription>Coming Soon</CardDescription>
          </CardHeader>
        </Card>

      </div>
    </div>
  );
}
