import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../../../../../ui/dialog';
import { Button } from '../../../../../ui/button';
import { Input } from '../../../../../ui/input';
import { Label } from '../../../../../ui/label';
import { Goal, GoalType, AdHocContribution } from './types';
import { Checkbox } from '../../../../../ui/checkbox';
import { Trash2, Calculator, Info, Plus, X } from 'lucide-react';
import { formatCurrency } from '../../../../../../utils/currencyFormatter';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../../ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../../ui/select';
import { Card, CardContent } from '../../../../../ui/card';

/** Loosely-typed policy record — shape varies by product category */
type PolicyRecord = { id?: string; categoryId?: string; policyNumber?: string; policy_number?: string; name?: string; data?: Record<string, unknown>; [key: string]: unknown };

/** Schema field definition */
type SchemaField = { id: string; name: string; [key: string]: unknown };

interface GoalFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (goal: Goal) => void;
  onDelete: (id: string) => void;
  initialData?: Goal;
  policies: PolicyRecord[];
  clientId: string;
}

export function GoalFormDialog({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialData,
  policies,
  clientId,
  schemas = {}, // Map of categoryId -> Field[]
  mainSchema = [] // Fallback schema
}: GoalFormDialogProps) {
  // Goal Definition
  const [name, setName] = useState('');
  const [type, setType] = useState<GoalType>('Wealth Accumulation');
  const [targetAmount, setTargetAmount] = useState<string>('');
  const [targetDate, setTargetDate] = useState('');
  const [inflationRate, setInflationRate] = useState('6');
  
  // Financial Inputs
  const [initialLumpSum, setInitialLumpSum] = useState<string>('');
  const [monthlyContribution, setMonthlyContribution] = useState<string>('');
  const [annualEscalation, setAnnualEscalation] = useState('6'); // Default to inflation
  const [annualGrowthRate, setAnnualGrowthRate] = useState('10'); // Default equity
  const [adHocContributions, setAdHocContributions] = useState<AdHocContribution[]>([]);
  
  // Validation Errors
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Linkage
  const [selectedPolicyIds, setSelectedPolicyIds] = useState<string[]>([]);
  
  // Helper to find value by field name in the relevant schema
  const getValueByName = (policy: PolicyRecord, possibleNames: string[]) => {
      if (!policy) return undefined;
      
      // Determine which schema to use. 
      // Prioritize the specific sub-category schema if available
      let schema = schemas[policy.categoryId];
      
      // If not found, check if it's in the main schema (often the case for single-category views)
      if (!schema || schema.length === 0) {
          schema = mainSchema;
      }
      
      if (!schema || schema.length === 0) return undefined;
      
      // Find field definition by name (case insensitive)
      const field = schema.find((f: SchemaField) => possibleNames.some(n => n.toLowerCase() === f.name.toLowerCase()));
      if (!field) return undefined;
      
      return policy.data?.[field.id];
  };

  // Helper to safely extract policy number
  const getPolicyNumber = (policy: PolicyRecord) => {
    if (!policy) return 'Unnamed Policy';
    
    // Try schema lookup first
    const schemaValue = getValueByName(policy, ['Policy Number', 'Policy Ref', 'Reference Number']);
    if (schemaValue) return schemaValue;

    return policy.policyNumber || 
           policy.policy_number || 
           policy.data?.policy_number || 
           policy.data?.invest_policy_number || 
           policy.data?.['Policy Number'] ||
           policy.data?.['Policy Number/Ref'] ||
           policy.data?.inv_1 || 
           policy.data?.inv_vol_1 || 
           policy.data?.inv_gua_1 || 
           policy.name || 
           'Unnamed Policy';
  };

  // Helper to safely extract label
  const getPolicyLabel = (policy: PolicyRecord) => {
    // Try schema lookup first
    const schemaValue = getValueByName(policy, ['Product Type', 'Plan', 'Benefit Type', 'Type']);
    
    const type = schemaValue ||
                 policy.data?.invest_product_type || 
                 policy.data?.inv_2 || 
                 policy.data?.inv_vol_2 || 
                 'Voluntary Investment';
    // Override generic "Investment" label
    return type === 'Investment' ? 'Voluntary Investment' : type;
  };

  // Helper to clean number values
  const cleanNumber = (val: unknown) => {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return val;
    // Remove all non-numeric chars except dot and minus
    const clean = String(val).replace(/[^0-9.-]+/g, "");
    return Number(clean) || 0;
  };

  // Helper to get Value
  const getPolicyValue = (policy: PolicyRecord) => {
      // Try schema lookup first
      const schemaValue = getValueByName(policy, ['Current Value', 'Fund Value', 'Capital Value', 'Amount Due/Refundable', 'Cover Amount']);
      if (schemaValue !== undefined) return cleanNumber(schemaValue);

      return cleanNumber(policy.data?.invest_current_value) || 
             cleanNumber(policy.data?.inv_3) || 
             cleanNumber(policy.data?.inv_vol_3) || 
             cleanNumber(policy.data?.inv_gua_3) || 
             0;
  };

  // Helper to get Premium
  const getPolicyPremium = (policy: PolicyRecord) => {
      // Try schema lookup first
      const schemaValue = getValueByName(policy, ['Premium', 'Monthly Contribution', 'Contribution']);
      if (schemaValue !== undefined) return cleanNumber(schemaValue);

      return cleanNumber(policy.data?.invest_monthly_contribution) || 
             cleanNumber(policy.data?.inv_6) || 
             cleanNumber(policy.data?.inv_vol_6) || 
             0;
  };

  // Linked Values Calculation
  const linkedSummary = React.useMemo(() => {
    const linked = policies.filter(p => selectedPolicyIds.includes(p.id));

    return {
        lumpSum: linked.reduce((sum, p) => sum + getPolicyValue(p), 0),
        monthly: linked.reduce((sum, p) => sum + getPolicyPremium(p), 0)
    };
  }, [selectedPolicyIds, policies]);

  // AdHoc Input State
  const [newAdHocAmount, setNewAdHocAmount] = useState('');
  const [newAdHocDate, setNewAdHocDate] = useState('');
  
  // Filter only Voluntary Investments
  const voluntaryPolicies = policies.filter(p => 
      p.categoryId === 'investments_voluntary' || 
      p.categoryId === 'invest_voluntary' ||
      (p.categoryId === 'investments' && p.data?.invest_product_type !== 'Endowment') // Fallback heuristic
  );

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setName(initialData.name);
        setType(initialData.type || 'Wealth Accumulation');
        setTargetAmount(initialData.targetAmount.toString());
        setTargetDate(initialData.targetDate.split('T')[0]);
        setInflationRate(initialData.inflationRate.toString());
        
        setInitialLumpSum(initialData.initialLumpSum?.toString() || '');
        setMonthlyContribution(initialData.monthlyContribution?.toString() || '');
        setAnnualEscalation(initialData.annualEscalation?.toString() || '6');
        setAnnualGrowthRate(initialData.annualGrowthRate?.toString() || '10');
        setAdHocContributions(initialData.adHocContributions || []);
        
        setSelectedPolicyIds(initialData.linkedInvestmentIds || []);
      } else {
        resetForm();
      }
    }
  }, [isOpen, initialData]);
  
  const resetForm = () => {
    setName('');
    setType('Wealth Accumulation');
    setTargetAmount('');
    setTargetDate('');
    setInflationRate('6');
    setInitialLumpSum('');
    setMonthlyContribution('');
    setAnnualEscalation('6');
    setAnnualGrowthRate('10');
    setAdHocContributions([]);
    setSelectedPolicyIds([]);
    setErrors({});
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) newErrors.name = "Goal name is required";
    
    if (!targetAmount) {
        newErrors.targetAmount = "Target amount is required";
    } else if (Number(targetAmount) <= 0) {
        newErrors.targetAmount = "Target amount must be greater than 0";
    }

    if (!targetDate) {
        newErrors.targetDate = "Target date is required";
    } else {
        const date = new Date(targetDate);
        if (date <= new Date()) {
            newErrors.targetDate = "Target date must be in the future";
        }
    }

    if (Number(inflationRate) < 0 || Number(inflationRate) > 20) {
        newErrors.inflationRate = "Inflation must be between 0% and 20%";
    }

    if (Number(annualGrowthRate) < 0 || Number(annualGrowthRate) > 30) {
        newErrors.growthRate = "Growth rate must be between 0% and 30%";
    }

    if (Number(annualEscalation) < 0 || Number(annualEscalation) > 20) {
        newErrors.escalationRate = "Escalation rate must be between 0% and 20%";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;

    const goal: Goal = {
      id: initialData?.id || crypto.randomUUID(),
      clientId,
      name,
      type,
      targetAmount: Number(targetAmount),
      targetDate: new Date(targetDate).toISOString(),
      inflationRate: Number(inflationRate),
      
      initialLumpSum: Number(initialLumpSum) || 0,
      monthlyContribution: Number(monthlyContribution) || 0,
      annualEscalation: Number(annualEscalation) || 0,
      annualGrowthRate: Number(annualGrowthRate) || 0,
      adHocContributions,
      
      linkedInvestmentIds: selectedPolicyIds,
      createdAt: initialData?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    onSave(goal);
    onClose();
  };

  const togglePolicy = (id: string) => {
    const isSelecting = !selectedPolicyIds.includes(id);
    
    setSelectedPolicyIds(prev => 
      isSelecting ? [...prev, id] : prev.filter(p => p !== id)
    );
    
    // Auto-populate logic on selection (Optional enhancement)
    // If selecting and inputs are empty, we could prompt or just leave it for the calc engine.
    // The requirement says: "If the adviser links an existing investment: Auto-populate capital and monthly inputs"
    // However, the calculation logic ADDS them together.
    // So if I populate the inputs, I might be double counting if I also sum them in the calc engine.
    // DECISION: The inputs (initialLumpSum, monthlyContribution) represent NEW/UNLINKED money.
    // The linked policies are calculated ADDITIVELY in the utils.ts `calculateGoalStatus`.
    // Therefore, we DO NOT auto-fill the inputs with policy values, because that would double count.
    // We only auto-fill if the user wants to "import" values, but here we are "linking".
  };

  const addAdHoc = () => {
      if (newAdHocAmount && newAdHocDate) {
          setAdHocContributions([...adHocContributions, { amount: Number(newAdHocAmount), date: newAdHocDate }]);
          setNewAdHocAmount('');
          setNewAdHocDate('');
      }
  };

  const removeAdHoc = (index: number) => {
      const updated = [...adHocContributions];
      updated.splice(index, 1);
      setAdHocContributions(updated);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initialData ? 'Edit Goal' : 'New Financial Goal'}</DialogTitle>
          <DialogDescription>
            Configure your goal parameters, assumptions, and link investments.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="details">Goal Details</TabsTrigger>
                <TabsTrigger value="financials">Inputs & Assumptions</TabsTrigger>
                <TabsTrigger value="linking">Link Investments</TabsTrigger>
            </TabsList>
            
            {/* --- TAB 1: GOAL DETAILS --- */}
            <TabsContent value="details" className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                        <Label htmlFor="name">Goal Name</Label>
                        <Input 
                            id="name" 
                            value={name} 
                            onChange={e => setName(e.target.value)} 
                            placeholder="e.g. Early Retirement Fund" 
                            className={errors.name ? "border-red-500 focus-visible:ring-red-500" : ""}
                        />
                        {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
                    </div>
                    
                    <div className="col-span-2 md:col-span-1">
                        <Label htmlFor="type">Goal Type</Label>
                        <Select value={type} onValueChange={(v: GoalType) => setType(v)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Wealth Accumulation">Wealth Accumulation</SelectItem>
                                <SelectItem value="Capital Growth">Capital Growth</SelectItem>
                                <SelectItem value="Offshore Exposure">Offshore Exposure</SelectItem>
                                <SelectItem value="Education Funding">Education Funding</SelectItem>
                                <SelectItem value="Medium-term Lifestyle">Medium-term Lifestyle</SelectItem>
                                <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="col-span-2 md:col-span-1">
                        <Label htmlFor="date">Target Date</Label>
                        <Input 
                            id="date" 
                            type="date" 
                            value={targetDate} 
                            onChange={e => setTargetDate(e.target.value)} 
                            className={errors.targetDate ? "border-red-500 focus-visible:ring-red-500" : ""}
                        />
                        {errors.targetDate && <p className="text-xs text-red-500 mt-1">{errors.targetDate}</p>}
                    </div>

                    <div className="col-span-2">
                        <Label htmlFor="amount">Target Amount (Future Value)</Label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-gray-500">R</span>
                            <Input 
                                id="amount" 
                                type="number" 
                                className={`pl-8 ${errors.targetAmount ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                                value={targetAmount} 
                                onChange={e => setTargetAmount(e.target.value)} 
                                placeholder="1000000" 
                            />
                        </div>
                        {errors.targetAmount && <p className="text-xs text-red-500 mt-1">{errors.targetAmount}</p>}
                    </div>
                </div>
            </TabsContent>

            {/* --- TAB 2: FINANCIAL INPUTS --- */}
            <TabsContent value="financials" className="space-y-6 py-4">
                
                {/* Combined Capital & Monthly Table-like Structure */}
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                    <div className="grid grid-cols-3 gap-0 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">
                        <div className="py-3 px-4 text-left">Source</div>
                        <div className="py-3 px-4 border-l border-gray-200">Lump Sum</div>
                        <div className="py-3 px-4 border-l border-gray-200">Monthly</div>
                    </div>

                    {/* Linked Policies Breakdown */}
                    {selectedPolicyIds.map(id => {
                        const policy = policies.find(p => p.id === id);
                        if (!policy) return null;
                        return (
                            <div key={id} className="grid grid-cols-3 gap-0 text-sm border-b border-gray-100 bg-white hover:bg-gray-50 transition-colors">
                                <div className="py-3 px-4 flex flex-col justify-center">
                                    <span className="font-medium text-gray-900">{policy.providerName}</span>
                                    <span className="text-xs text-gray-500">{getPolicyNumber(policy)}</span>
                                </div>
                                <div className="py-3 px-4 border-l border-gray-100 flex items-center justify-center text-gray-600 font-medium">
                                    {formatCurrency(getPolicyValue(policy))}
                                </div>
                                <div className="py-3 px-4 border-l border-gray-100 flex items-center justify-center text-gray-600 font-medium">
                                    {formatCurrency(getPolicyPremium(policy))}
                                </div>
                            </div>
                        );
                    })}

                    {/* Empty State for Linked */}
                    {selectedPolicyIds.length === 0 && (
                         <div className="grid grid-cols-3 gap-0 text-sm border-b border-gray-100">
                            <div className="py-3 px-4 text-gray-400 italic">No linked investments</div>
                            <div className="py-3 px-4 border-l border-gray-100 bg-gray-50/30"></div>
                            <div className="py-3 px-4 border-l border-gray-100 bg-gray-50/30"></div>
                        </div>
                    )}

                    {/* Additional Input Row */}
                    <div className="grid grid-cols-3 gap-0 text-sm">
                        <div className="py-3 px-4 flex flex-col justify-center">
                            <span className="font-medium text-blue-700">Additional / Unlinked</span>
                            <span className="text-xs text-blue-600/70">Manual entry</span>
                        </div>
                        <div className="p-2 border-l border-gray-100 flex items-center">
                             <div className="relative w-full">
                                <span className="absolute left-2.5 top-2 text-gray-400 text-xs">R</span>
                                <Input 
                                    id="lumpSum" 
                                    type="number" 
                                    className="pl-6 h-9 text-center bg-blue-50/30 border-blue-200 focus-visible:ring-blue-500" 
                                    value={initialLumpSum} 
                                    onChange={e => setInitialLumpSum(e.target.value)} 
                                    placeholder="0" 
                                />
                            </div>
                        </div>
                        <div className="p-2 border-l border-gray-100 flex items-center">
                            <div className="relative w-full">
                                <span className="absolute left-2.5 top-2 text-gray-400 text-xs">R</span>
                                <Input 
                                    id="monthly" 
                                    type="number" 
                                    className="pl-6 h-9 text-center bg-blue-50/30 border-blue-200 focus-visible:ring-blue-500" 
                                    value={monthlyContribution} 
                                    onChange={e => setMonthlyContribution(e.target.value)} 
                                    placeholder="0" 
                                />
                            </div>
                        </div>
                    </div>
                    
                    {/* Total Row */}
                    <div className="grid grid-cols-3 gap-0 text-sm bg-gray-50 border-t border-gray-200 font-semibold">
                        <div className="py-3 px-4 text-gray-900 text-right pr-6">Total Starting Value</div>
                        <div className="py-3 px-4 border-l border-gray-200 text-center text-gray-900">
                             {formatCurrency(linkedSummary.lumpSum + (Number(initialLumpSum) || 0))}
                        </div>
                        <div className="py-3 px-4 border-l border-gray-200 text-center text-gray-900">
                             {formatCurrency(linkedSummary.monthly + (Number(monthlyContribution) || 0))}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-4 border-t pt-4">
                     <div>
                        <Label htmlFor="growth" className="text-xs">Exp. Net Growth (%)</Label>
                        <Input 
                            id="growth" 
                            type="number" 
                            value={annualGrowthRate} 
                            onChange={e => setAnnualGrowthRate(e.target.value)} 
                            placeholder="10" 
                            className={errors.growthRate ? "border-red-500 focus-visible:ring-red-500" : ""}
                        />
                        {errors.growthRate && <p className="text-[10px] text-red-500 mt-1">{errors.growthRate}</p>}
                     </div>
                     <div>
                        <Label htmlFor="escalation" className="text-xs">Annual Escalation (%)</Label>
                        <Input 
                            id="escalation" 
                            type="number" 
                            value={annualEscalation} 
                            onChange={e => setAnnualEscalation(e.target.value)} 
                            placeholder="6" 
                            className={errors.escalationRate ? "border-red-500 focus-visible:ring-red-500" : ""}
                        />
                        {errors.escalationRate && <p className="text-[10px] text-red-500 mt-1">{errors.escalationRate}</p>}
                     </div>
                     <div>
                        <Label htmlFor="inflation" className="text-xs">Inflation (%)</Label>
                        <Input 
                            id="inflation" 
                            type="number" 
                            value={inflationRate} 
                            onChange={e => setInflationRate(e.target.value)} 
                            placeholder="6" 
                            className={errors.inflationRate ? "border-red-500 focus-visible:ring-red-500" : ""}
                        />
                        {errors.inflationRate && <p className="text-[10px] text-red-500 mt-1">{errors.inflationRate}</p>}
                     </div>
                </div>
                
                <div className="border-t pt-4">
                    <Label className="mb-2 block">Ad-Hoc Contributions</Label>
                    <div className="flex gap-2 mb-2">
                        <Input type="number" placeholder="Amount" value={newAdHocAmount} onChange={e => setNewAdHocAmount(e.target.value)} className="flex-1" />
                        <Input type="date" value={newAdHocDate} onChange={e => setNewAdHocDate(e.target.value)} className="w-[140px]" />
                        <Button type="button" size="icon" onClick={addAdHoc} variant="outline" aria-label="Add ad-hoc contribution"><Plus className="h-4 w-4" /></Button>
                    </div>
                    
                    {adHocContributions.length > 0 && (
                        <div className="space-y-2 mt-2 max-h-[100px] overflow-y-auto">
                            {adHocContributions.map((adhoc, idx) => (
                                <div key={idx} className="flex justify-between items-center text-sm bg-gray-50 p-2 rounded">
                                    <span>{formatCurrency(adhoc.amount)} on {adhoc.date}</span>
                                    <button onClick={() => removeAdHoc(idx)} className="text-red-500 hover:text-red-700"><X className="h-3 w-3" /></button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </TabsContent>

            {/* --- TAB 3: LINKING --- */}
            <TabsContent value="linking" className="space-y-4 py-4">
                <div className="border rounded-md p-2 max-h-[300px] overflow-y-auto space-y-2">
                    {voluntaryPolicies.length === 0 ? (
                       <p className="text-sm text-gray-500 italic p-4 text-center">No voluntary investments available to link.</p>
                    ) : (
                       voluntaryPolicies.map(policy => (
                            <div key={policy.id} className="flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-lg border border-transparent hover:border-gray-200 transition-all">
                             <Checkbox 
                                id={policy.id} 
                                checked={selectedPolicyIds.includes(policy.id)}
                                onCheckedChange={() => togglePolicy(policy.id)}
                             />
                             <label htmlFor={policy.id} className="text-sm cursor-pointer flex-1">
                                <div className="flex justify-between font-medium text-gray-900">
                                    <span className="flex items-center gap-2">
                                        {policy.providerName}
                                        <span className="text-gray-400 font-normal">|</span>
                                        <span className="text-gray-700">
                                            {getPolicyNumber(policy)}
                                        </span>
                                    </span>
                                    <span>{formatCurrency(getPolicyValue(policy))}</span>
                                </div>
                                <div className="text-xs text-gray-500 flex justify-between mt-1">
                                    <span>{getPolicyLabel(policy)}</span>
                                    {getPolicyPremium(policy) > 0 && (
                                        <span>+ {formatCurrency(getPolicyPremium(policy))}/m</span>
                                    )}
                                </div>
                             </label>
                          </div>
                       ))
                    )}
                 </div>
                 <p className="text-xs text-gray-500">
                    Linked policies are automatically included in the goal calculation using their current value and monthly premiums.
                 </p>
            </TabsContent>
        </Tabs>

        <DialogFooter className="flex justify-between sm:justify-between items-center mt-4 border-t pt-4">
          {initialData ? (
             <Button variant="destructive" size="sm" onClick={() => { onDelete(initialData.id); onClose(); }}>
                <Trash2 className="h-4 w-4 mr-2" /> Delete
             </Button>
          ) : <div></div>}
          <div className="flex gap-2">
             <Button variant="outline" onClick={onClose}>Cancel</Button>
             <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
                 {initialData ? 'Update Goal' : 'Create Goal'}
             </Button>
          </div>
        </DialogFooter>
        
        {Object.keys(errors).length > 0 && (
             <div className="bg-red-50 border border-red-100 text-red-600 text-xs p-3 mx-6 mb-6 rounded-md flex items-center gap-2">
                 <Info className="h-4 w-4 shrink-0" />
                 <span>Please correct the errors highlighted above before saving.</span>
             </div>
        )}
      </DialogContent>
    </Dialog>
  );
}