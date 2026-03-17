/**
 * KeyCard Component
 * Displays an individual key with its metadata, usage, and dependencies
 */

import React from 'react';
import { Badge } from '../../../../../ui/badge';
import { Workflow } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../../../../ui/tooltip';
import { ProductKey } from '../types';
import { KeyAPI } from '../api';
import { DATA_TYPE_COLORS } from '../constants';

interface KeyCardProps {
  keyData: ProductKey;
  showUsage?: boolean;
  showDependencies?: boolean;
  className?: string;
}

export function KeyCard({ 
  keyData, 
  showUsage = true, 
  showDependencies = true,
  className = '' 
}: KeyCardProps) {
  const usage = KeyAPI.getKeyUsage(keyData.id);
  const dependencies = keyData.isCalculated ? KeyAPI.getKeyDependencyNames(keyData.id) : [];

  return (
    <div 
      className={`p-4 border rounded-lg transition-colors ${
        keyData.isCalculated 
          ? 'border-amber-200 bg-amber-50/30 hover:bg-amber-50/50' 
          : 'hover:border-purple-300 hover:bg-purple-50/30'
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Key Name and Badges */}
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h4 className="font-semibold text-gray-900">{keyData.name}</h4>
            <Badge 
              variant="outline" 
              className={`text-xs ${DATA_TYPE_COLORS[keyData.dataType]}`}
            >
              {keyData.dataType}
            </Badge>
            {keyData.isCalculated && (
              <Badge 
                variant="outline" 
                className="text-xs bg-amber-100 text-amber-700 border-amber-300"
              >
                Calculated Total
              </Badge>
            )}
          </div>

          {/* Description */}
          <p className="text-sm text-gray-600 mb-3">{keyData.description}</p>

          {/* Key ID, Dependencies, and Usage */}
          <div className="flex flex-col gap-2">
            {/* Key ID with Tooltip */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <code className="text-xs bg-gray-100 px-2 py-1 rounded border text-gray-700 font-mono cursor-help w-fit">
                    {keyData.id}
                  </code>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Unique key identifier</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Dependencies for Calculated Keys */}
            {showDependencies && keyData.isCalculated && dependencies.length > 0 && (
              <div className="text-xs text-amber-700 italic">
                Sum of: {dependencies.join(', ')}
              </div>
            )}

            {/* Usage in Modules */}
            {showUsage && usage.length > 0 && (
              <div className="flex items-start gap-2 mt-2">
                <Workflow className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="flex flex-wrap gap-1">
                  {usage.map(module => (
                    <Badge 
                      key={module} 
                      variant="outline" 
                      className="text-xs bg-blue-50 text-blue-700 border-blue-200"
                    >
                      {module}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
