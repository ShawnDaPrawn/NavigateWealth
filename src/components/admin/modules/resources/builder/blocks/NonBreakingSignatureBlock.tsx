import React from 'react';
import { FormBlock, NonBreakingSignatureData } from '../types';
import { Input } from '../../../../../ui/input';
import { Label } from '../../../../../ui/label';
import { Button } from '../../../../../ui/button';
import { Plus, Trash2 } from 'lucide-react';

export const NonBreakingSignatureBlock = {
  type: 'non_breaking_signature',
  label: 'Signature (Non-Breaking)',
  category: 'signatures',
  icon: (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.55 18-9-15.56L3.61 18"/><path d="M21.55 18h-18"/><path d="M21.55 18v2.33a2 2 0 0 1-2.18 2H4.63a2 2 0 0 1-2.18-2V18"/><path d="M7 14h10"/></svg>
  ),
  initialData: {
    signatories: [
        { label: 'Testator', key: 'testator' },
        { label: 'Witness 1', key: 'witness1' },
        { label: 'Witness 2', key: 'witness2' }
    ]
  } as NonBreakingSignatureData,
  render: ({ block }: { block: FormBlock }) => {
    const data = block.data as NonBreakingSignatureData;
    
    // CSS to prevent page break inside
    const style = {
        pageBreakInside: 'avoid',
        breakInside: 'avoid'
    } as React.CSSProperties;

    return (
      <div className="w-full my-4 p-4 border border-gray-200 bg-gray-50 rounded" style={style}>
        <div className="text-[10px] uppercase text-gray-400 font-bold mb-4 tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            Non-Breaking Group
        </div>
        
        <div className="grid grid-cols-2 gap-8">
            {data.signatories.map((sig, i) => (
                <div key={i} className="mb-4">
                    <div className="h-12 border-b border-black mb-1"></div>
                    <div className="font-bold text-sm">{sig.label}</div>
                    <div className="text-xs text-gray-500 font-mono">Date: _______________</div>
                </div>
            ))}
        </div>
      </div>
    );
  },
  editor: ({ block, onChange }: { block: FormBlock, onChange: (key: string, value: unknown) => void }) => {
    const data = block.data as NonBreakingSignatureData;
    
    const addSignatory = () => {
        const newSigs = [...data.signatories, { label: 'New Signatory', key: 'new_sig' }];
        onChange('signatories', newSigs);
    };

    const updateSignatory = (index: number, field: 'label' | 'key', val: string) => {
        const newSigs = [...data.signatories];
        newSigs[index] = { ...newSigs[index], [field]: val };
        onChange('signatories', newSigs);
    };

    const removeSignatory = (index: number) => {
        const newSigs = data.signatories.filter((_, i) => i !== index);
        onChange('signatories', newSigs);
    };

    return (
      <div className="space-y-4">
        <div className="space-y-2">
            <Label>Signatories</Label>
            {data.signatories.map((sig, i) => (
                <div key={i} className="flex gap-2 items-start border p-2 rounded bg-gray-50">
                    <div className="flex-1 space-y-2">
                        <Input 
                            placeholder="Label (e.g. Testator)" 
                            value={sig.label} 
                            onChange={(e) => updateSignatory(i, 'label', e.target.value)}
                            className="h-8 text-sm"
                        />
                        <Input 
                            placeholder="Key (e.g. testator)" 
                            value={sig.key} 
                            onChange={(e) => updateSignatory(i, 'key', e.target.value)}
                            className="h-7 text-xs font-mono"
                        />
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removeSignatory(i)} className="h-6 w-6 p-0 text-red-500">
                        <Trash2 className="h-3 w-3" />
                    </Button>
                </div>
            ))}
            <Button variant="outline" size="sm" onClick={addSignatory} className="w-full text-xs">
                <Plus className="h-3 w-3 mr-1" /> Add Signatory
            </Button>
        </div>
      </div>
    );
  }
};