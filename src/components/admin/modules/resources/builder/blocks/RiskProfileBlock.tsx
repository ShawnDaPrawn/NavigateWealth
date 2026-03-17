import React from 'react';
import { Gauge } from 'lucide-react';
import { BlockDefinition } from '../registry';
import { RiskProfileData } from '../types';
import { Input } from '../../../../../ui/input';
import { Label } from '../../../../../ui/label';
import { Slider } from '../../../../../ui/slider';
import { cn } from '../../../../../ui/utils';
import { Button } from '../../../../../ui/button';
import { Trash2, Plus } from 'lucide-react';

export const RiskProfileBlock: BlockDefinition = {
  type: 'risk_profile',
  label: 'Risk Profile',
  icon: Gauge,
  category: 'compliance',
  description: 'Visual risk meter',
  initialData: {
    level: 3,
    labels: ["Conservative", "Cautious", "Moderate", "Mod-Aggressive", "Aggressive"]
  },
  render: ({ block }) => {
    const data = block.data as RiskProfileData;
    const level = data.level || 3;
    const labels = data.labels || ["Conservative", "Cautious", "Moderate", "Mod-Aggressive", "Aggressive"];
    
    return (
      <div className="py-4 px-8 border border-gray-200 rounded-lg bg-white flex flex-col items-center">
         <div className="flex gap-1 w-full max-w-md">
            {labels.map((label, i) => {
               const isSelected = (i + 1) === level;
               return (
                 <div key={i} className="flex-1 flex flex-col items-center gap-2">
                    <div 
                      className={cn(
                        "w-full h-3 rounded-full transition-colors",
                        isSelected 
                          ? "bg-purple-600 ring-2 ring-offset-1 ring-purple-600" 
                          : "bg-gray-200"
                      )}
                    />
                    <div className={cn(
                      "text-[8px] text-center font-medium leading-tight",
                      isSelected ? "text-purple-700" : "text-gray-400"
                    )}>
                      {label}
                    </div>
                 </div>
               );
            })}
         </div>
         <div className="mt-2 text-[9px] font-bold text-gray-500 uppercase tracking-widest">Risk Profile Indicator</div>
      </div>
    );
  },
  editor: ({ block, onChange }) => {
    const data = block.data as RiskProfileData;
    const labels = data.labels || ["Conservative", "Cautious", "Moderate", "Mod-Aggressive", "Aggressive"];

    return (
       <div className="space-y-6">
          <div className="space-y-4">
             <div className="flex justify-between items-center">
                <Label className="text-xs">Selected Risk Level</Label>
                <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">{data.level || 3}</span>
             </div>
             <Slider 
                min={1} 
                max={labels.length} 
                step={1} 
                value={[data.level || 3]} 
                onValueChange={(vals) => onChange('level', vals[0])}
                className="py-2"
             />
             <p className="text-[10px] text-gray-400">
               Corresponds to the index of the labels below.
             </p>
          </div>

          <div className="h-px bg-gray-200" />

          <div className="space-y-3">
             <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase text-gray-500">Labels</Label>
                <Button 
                   variant="ghost" 
                   size="sm" 
                   className="h-6 w-6 p-0"
                   onClick={() => {
                      const newLabels = [...labels, 'New Level'];
                      onChange('labels', newLabels);
                   }}
                >
                   <Plus className="h-4 w-4" />
                </Button>
             </div>
             <div className="space-y-2">
                {labels.map((label, idx) => (
                   <div key={idx} className="flex gap-2 items-center">
                      <span className="text-[10px] text-gray-400 w-4">{idx + 1}</span>
                      <Input 
                         value={label}
                         onChange={(e) => {
                            const newLabels = [...labels];
                            newLabels[idx] = e.target.value;
                            onChange('labels', newLabels);
                         }}
                         className="h-7 text-xs"
                      />
                      <Button 
                         variant="ghost" 
                         size="icon"
                         className="h-7 w-7 shrink-0 text-red-400 hover:text-red-500"
                         onClick={() => {
                            const newLabels = [...labels];
                            newLabels.splice(idx, 1);
                            onChange('labels', newLabels);
                            // Adjust level if out of bounds
                            if ((data.level || 3) > newLabels.length) {
                               onChange('level', newLabels.length);
                            }
                         }}
                      >
                         <Trash2 className="h-4 w-4" />
                      </Button>
                   </div>
                ))}
             </div>
          </div>
       </div>
    );
  }
};