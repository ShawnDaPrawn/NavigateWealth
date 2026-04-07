import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../ui/select';
import { Switch } from '../../../../ui/switch';
import { Separator } from '../../../../ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../ui/table';
import { ArrowLeft, Save, Calculator, RefreshCw, Download, ChevronDown, ChevronUp, History, Trash2 } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { RetirementInputs, RetirementResults, RetirementScenario, ProjectionYear } from './types';
import { projectId, publicAnonKey } from '../../../../../utils/supabase/info';
import { navigateWealthPdfDocumentTitle } from '../../../../../utils/pdfPrintTitle';
import { RetirementReportTemplate } from './RetirementReportTemplate';

// Helper to get auth token
const getAuthToken = (): string => {
  try {
    const storageKey = `sb-${projectId}-auth-token`;
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const session = JSON.parse(stored);
      return session.access_token || publicAnonKey;
    }
  } catch (e) {
    console.error('Error reading auth token:', e);
  }
  return publicAnonKey;
};

interface RetirementCalculatorProps {
  onBack: () => void;
}

const DEFAULT_INPUTS: RetirementInputs = {
  currentAge: 30,
  retirementAge: 65,
  lifeExpectancyAge: 90,
  currentSavings: 100000,
  contributionAmount: 5000,
  contributionFrequency: 'monthly',
  contributionGrowthRate: 6, // Nominal salary increase
  nominalReturn: 10, // Nominal investment return
  inflation: 5,
  annualFee: 1.5,
  taxRate: 0,
  drawdownTargetMode: 'replacement',
  drawdownTargetValue: 75, // 75% replacement ratio
  isNominal: false, // Default to Real (Today's Money)
};

export function RetirementCalculator({ onBack }: RetirementCalculatorProps) {
  const [inputs, setInputs] = useState<RetirementInputs>(DEFAULT_INPUTS);
  const [results, setResults] = useState<RetirementResults | null>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [scenarios, setScenarios] = useState<RetirementScenario[]>([]);
  const [scenarioName, setScenarioName] = useState('');
  const [showAssumptions, setShowAssumptions] = useState(false);
  const [activeTab, setActiveTab] = useState('projection');
  const [saving, setSaving] = useState(false);

  // Fetch clients on mount
  useEffect(() => {
    const fetchClients = async () => {
      try {
        const token = getAuthToken();
        const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/profile/all-users`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.users && Array.isArray(data.users)) {
             const transformedUsers = data.users.map((user: { id: string; user_metadata?: Record<string, unknown>; profile?: Record<string, unknown>; name?: string }) => ({
                id: user.id,
                first_name: (user.user_metadata?.firstName || (user.profile?.personalInformation as Record<string, unknown>)?.firstName || user.name?.split(' ')[0] || 'Unknown') as string,
                last_name: (user.user_metadata?.surname || (user.profile?.personalInformation as Record<string, unknown>)?.lastName || user.name?.split(' ').slice(1).join(' ') || 'User') as string,
             })).sort((a: { last_name: string }, b: { last_name: string }) => a.last_name.localeCompare(b.last_name));
             setClients(transformedUsers);
          }
        } else {
           throw new Error('Failed to fetch clients');
        }
      } catch (error) {
        console.error('Error fetching clients:', error);
        toast.error('Failed to load clients list');
      }
    };
    fetchClients();
  }, []);

  // Fetch scenarios when client changes
  useEffect(() => {
    if (selectedClientId) {
      loadScenarios(selectedClientId);
    } else {
      setScenarios([]);
    }
  }, [selectedClientId]);

  // Calculate on input change
  useEffect(() => {
    calculateResults();
  }, [inputs]);

  const loadScenarios = async (clientId: string) => {
    try {
      const token = getAuthToken();
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/resources/calculators/retirement/scenarios/${clientId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setScenarios(data.scenarios || []);
      }
    } catch (error) {
      console.error('Error loading scenarios:', error);
    }
  };

  const deleteScenario = async (id: string) => {
    if (!confirm('Are you sure you want to delete this scenario?')) return;
    try {
      const token = getAuthToken();
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/resources/calculators/retirement/scenarios/${selectedClientId}/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        toast.success('Scenario deleted');
        loadScenarios(selectedClientId);
      }
    } catch (error) {
       toast.error('Failed to delete scenario');
    }
  };

  const loadScenario = (scenario: RetirementScenario) => {
    setInputs(scenario.inputs);
    setScenarioName(scenario.name);
    toast.info(`Loaded scenario: ${scenario.name}`);
  };
  
  // Calculation logic
  const calculateResults = () => {
    const {
      currentAge, retirementAge, lifeExpectancyAge,
      currentSavings, contributionAmount, contributionFrequency,
      contributionGrowthRate, nominalReturn, inflation, annualFee,
      drawdownTargetMode, drawdownTargetValue
    } = inputs;

    // Basic validation
    if (retirementAge <= currentAge || lifeExpectancyAge <= retirementAge) {
      return;
    }

    // Rates
    const r_nominal = nominalReturn / 100;
    const i = inflation / 100;
    const f = annualFee / 100;
    const g = contributionGrowthRate / 100;

    // Real Return Calculation
    // r_real = (1 + r_nominal) / (1 + i) - 1
    const r_real = (1 + r_nominal) / (1 + i) - 1;
    // Net Real Return (after fees)
    const r = r_real - f;

    // Real Growth of Contributions
    // g_real = (1 + g_nominal) / (1 + i) - 1
    const g_real = (1 + g) / (1 + i) - 1;

    // Time horizons
    const n = retirementAge - currentAge; // Years to retirement
    const m = lifeExpectancyAge - retirementAge; // Years in retirement

    // Annual contribution amount
    const annualContribution = contributionFrequency === 'monthly' ? contributionAmount * 12 : contributionAmount;

    // 1. Future Value of Current Savings (at Retirement)
    const fvCurrentSavings = currentSavings * Math.pow(1 + r, n);

    // 2. Future Value of Contributions (at Retirement)
    let fvContributions = 0;
    if (Math.abs(r - g_real) < 0.0001) {
        // Special case r ~ g
        fvContributions = annualContribution * n * Math.pow(1 + r, n - 1);
    } else {
        // Growing annuity formula (end of period payments)
        fvContributions = annualContribution * ((Math.pow(1 + r, n) - Math.pow(1 + g_real, n)) / (r - g_real));
    }

    const totalCapital = fvCurrentSavings + fvContributions;

    // 3. Sustainable Income
    // Income = PV * ( r / (1 - (1+r)^(-m)) )
    let sustainableIncomeAnnual = 0;
    if (Math.abs(r) < 0.0001) {
        sustainableIncomeAnnual = totalCapital / m;
    } else {
        sustainableIncomeAnnual = totalCapital * (r / (1 - Math.pow(1 + r, -m)));
    }
    
    // Monthly income
    const sustainableIncomeMonthly = sustainableIncomeAnnual / 12;

    // 4. Projection Loop (to determine when funds run out)
    const projectionData: ProjectionYear[] = [];
    let balance = currentSavings;
    let currentAnnualContrib = annualContribution;
    let fundsRunOutAge: number | 'Forever' | 'Never' = 'Never';
    let hasRunOut = false;

    // We simulate year by year
    for (let year = 1; year <= (lifeExpectancyAge - currentAge) + 10; year++) { // Go a bit beyond life expectancy
        const age = currentAge + year;
        const isAccumulation = age <= retirementAge;
        const openingBalance = balance;
        let flow = 0;
        let growth = 0;

        if (isAccumulation) {
            flow = currentAnnualContrib;
            // Contributions grow
            currentAnnualContrib = currentAnnualContrib * (1 + g_real);
        } else {
            // Drawdown Phase
            flow = -sustainableIncomeAnnual;
        }

        // Apply Growth
        // Using: Balance_End = Balance_Start * (1+r) + Flow * (TimingAdjustment)
        // Assuming contributions/drawdowns happen throughout year, simplified to end-of-year for flow impact?
        // Let's stick to standard: Growth on Opening, Flow added at end (for accumulation).
        // For drawdown, typically we withdraw at start.
        // Let's assume End of Period for both for consistency with annuity formulas used.
        
        growth = openingBalance * r;
        balance = openingBalance + growth + flow;

        if (balance < 0) {
            balance = 0;
            if (!hasRunOut && !isAccumulation) {
                fundsRunOutAge = age;
                hasRunOut = true;
            }
        }
        
        // Stop projection if we are way past and balance is 0
        if (age > lifeExpectancyAge && balance === 0) break;

        // Limit years to avoid infinite loops if parameters are weird
        if (year > 100) break;

        projectionData.push({
            age,
            year,
            openingBalance,
            contributionsOrIncome: flow,
            growth,
            closingBalance: balance,
            phase: isAccumulation ? 'accumulation' : 'drawdown'
        });
    }
    
    // If we never ran out within the simulation horizon (up to life expectancy + 10), 
    // and we solved for sustainable income over M years, it should run out exactly at LifeExpectancy.
    // Due to float precision, it might be slightly off.
    if (!hasRunOut) {
        fundsRunOutAge = lifeExpectancyAge;
    }

    // Adjust for Nominal Display if requested
    let displayTotalCapital = totalCapital;
    let displaySustainableIncomeAnnual = sustainableIncomeAnnual;
    let displaySustainableIncomeMonthly = sustainableIncomeMonthly;
    let displayFvCurrentSavings = fvCurrentSavings;
    let displayFvContributions = fvContributions;
    
    let finalProjectionData = projectionData;

    if (inputs.isNominal) {
        const inflationFactorAtRetirement = Math.pow(1 + i, n);
        displayTotalCapital = totalCapital * inflationFactorAtRetirement;
        displaySustainableIncomeAnnual = sustainableIncomeAnnual * inflationFactorAtRetirement; // First year income
        displaySustainableIncomeMonthly = displaySustainableIncomeAnnual / 12;
        displayFvCurrentSavings = fvCurrentSavings * inflationFactorAtRetirement;
        displayFvContributions = fvContributions * inflationFactorAtRetirement;

        finalProjectionData = projectionData.map(p => {
            const inflationFactor = Math.pow(1 + i, p.year);
            return {
                ...p,
                openingBalance: p.openingBalance * Math.pow(1 + i, p.year - 1), // Opening is at start of year
                contributionsOrIncome: p.contributionsOrIncome * inflationFactor, // Flows during year
                growth: (p.closingBalance * inflationFactor) - (p.openingBalance * Math.pow(1 + i, p.year - 1)) - (p.contributionsOrIncome * inflationFactor), // Back-calc growth or just scale closing
                // Better: Scale everything
                // Actually growth is tricky. 
                // Let's just scale the balances and flows.
                // Opening (Real) * Infl(Start)
                // Flow (Real) * Infl(End)
                // Closing (Real) * Infl(End)
                // Growth = Closing - Opening - Flow
                closingBalance: p.closingBalance * inflationFactor
            };
        });
        
        // Recalculate growth for the table based on nominal balances
        finalProjectionData = finalProjectionData.map(p => ({
            ...p,
            growth: p.closingBalance - p.openingBalance - p.contributionsOrIncome
        }));
    }

    setResults({
      realReturn: r_real * 100,
      netRealReturn: r * 100,
      yearsToRetirement: n,
      yearsInRetirement: m,
      fvCurrentSavings: displayFvCurrentSavings,
      fvContributions: displayFvContributions,
      totalCapital: displayTotalCapital,
      sustainableIncomeAnnual: displaySustainableIncomeAnnual,
      sustainableIncomeMonthly: displaySustainableIncomeMonthly,
      replacementRatio: 0, // Placeholder
      fundsLastToAge: fundsRunOutAge,
      projectionData: finalProjectionData
    });
  };

  const handleSaveScenario = async () => {
    if (!selectedClientId) {
      toast.error('Please select a client first');
      return;
    }
    if (!scenarioName) {
      toast.error('Please name the scenario');
      return;
    }
    
    setSaving(true);
    try {
      const token = getAuthToken();
      const scenario: Partial<RetirementScenario> = {
        clientId: selectedClientId,
        name: scenarioName,
        inputs,
        results: results!
      };
      
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/resources/calculators/retirement/scenarios`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(scenario)
      });
      
      if (response.ok) {
        toast.success('Scenario saved successfully');
        loadScenarios(selectedClientId);
      } else {
        throw new Error('Failed to save');
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to save scenario');
    } finally {
      setSaving(false);
    }
  };

  const handleExportPdf = async () => {
    if (!results) {
        toast.error('Please calculate results before exporting');
        return;
    }

    const client = clients.find(c => c.id === selectedClientId);
    const clientName = client ? `${client.first_name} ${client.last_name}` : 'Client';

    try {
      // Hide scrollbars globally for print
      const style = document.createElement('style');
      style.id = 'print-no-scroll';
      style.innerHTML = `
        @media print {
          /* Hide everything in the body by default */
          body > * {
            display: none !important;
          }

          /* Force hide Sonner toasts specifically */
          [data-sonner-toaster] {
            display: none !important;
            opacity: 0 !important;
            visibility: hidden !important;
          }

          /* Only show our print container */
          #print-root {
            display: block !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            z-index: 9999 !important;
            background: white !important;
          }

          /* Reset page styles for the print root */
          html, body {
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            height: auto !important;
          }
        }
      `;
      document.head.appendChild(style);

      // Create a temporary container for rendering
      const container = document.createElement('div');
      container.id = 'print-root';
      container.style.position = 'fixed';
      container.style.top = '0';
      container.style.left = '0';
      container.style.width = '100%';
      container.style.height = '100%';
      container.style.backgroundColor = 'white';
      container.style.zIndex = '9999';
      container.style.overflow = 'visible';
      container.style.padding = '0';
      container.style.margin = '0';
      document.body.appendChild(container);

      // Import React and ReactDOM for rendering
      const { createRoot } = await import('react-dom/client');
      const reactRoot = createRoot(container);

      // Render the report
      await new Promise<void>((resolve) => {
        reactRoot.render(
          <RetirementReportTemplate 
            inputs={inputs}
            results={results}
            clientName={clientName}
            scenarioName={scenarioName || "Retirement Projection"}
          />
        );
        // Wait for render to complete
        setTimeout(() => resolve(), 500);
      });

      const timestamp = new Date().toISOString().split('T')[0];
      const titlePart = `${scenarioName || 'Retirement Plan'} - ${clientName} (${timestamp})`;

      const originalTitle = document.title;
      document.title = navigateWealthPdfDocumentTitle(titlePart);

      // Show toast
      toast.info('Print dialog opening...', {
        description: 'Select "Save as PDF" as your printer destination'
      });

      // Wait a bit more for styles/images
      await new Promise(resolve => setTimeout(resolve, 500));

      // Trigger print dialog
      window.print();

      // Restore original title
      setTimeout(() => {
        document.title = originalTitle;
      }, 1000);

      // Cleanup
      setTimeout(() => {
        reactRoot.unmount();
        document.body.removeChild(container);
        const styleEl = document.getElementById('print-no-scroll');
        if (styleEl) styleEl.remove();
      }, 2000);

    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error('Failed to generate PDF');
    }
  };

  const formatCurrency = (val: number) => {
    if (val === undefined || val === null || isNaN(val)) return 'R0';
    const isNeg = val < 0;
    const abs = Math.abs(val);
    const intPart = Math.round(abs).toString();
    const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `${isNeg ? '-' : ''}R${withCommas}`;
  };
  
  const formatPercent = (val: number) => {
    return new Intl.NumberFormat('en-ZA', { style: 'percent', maximumFractionDigits: 2 }).format(val / 100);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      {/* Top Bar */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b pb-4">
        <div>
          <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2 text-muted-foreground hover:text-foreground mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Tools
          </Button>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Retirement Planning Calculator</h1>
          <p className="text-muted-foreground">Projection of capital accumulation and sustainable income drawdown.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
           <div className="w-[250px]">
             <Select value={selectedClientId} onValueChange={setSelectedClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Select Client for Scenario" />
              </SelectTrigger>
              <SelectContent>
                {clients.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
           </div>
          <Button variant="outline" onClick={calculateResults}>
            <RefreshCw className="h-4 w-4 mr-2" /> Recalculate
          </Button>
          <Button variant="default" onClick={handleExportPdf}>
            <Download className="h-4 w-4 mr-2" /> Export PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* INPUTS COLUMN */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="border-t-4 border-t-blue-600 shadow-md">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calculator className="h-5 w-5 text-blue-600" />
                Inputs & Assumptions
              </CardTitle>
              <CardDescription>Configure the client's current position.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* Personal Details */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider border-b pb-1">Timeline</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentAge">Current Age</Label>
                    <Input 
                      id="currentAge" 
                      type="number" 
                      value={inputs.currentAge}
                      onChange={(e) => setInputs({...inputs, currentAge: Number(e.target.value)})} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="retirementAge">Retirement Age</Label>
                    <Input 
                      id="retirementAge" 
                      type="number" 
                      value={inputs.retirementAge}
                      onChange={(e) => setInputs({...inputs, retirementAge: Number(e.target.value)})} 
                    />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="lifeExpectancy">Life Expectancy (Age)</Label>
                    <Input 
                      id="lifeExpectancy" 
                      type="number" 
                      value={inputs.lifeExpectancyAge}
                      onChange={(e) => setInputs({...inputs, lifeExpectancyAge: Number(e.target.value)})} 
                    />
                  </div>
                </div>
              </div>

              {/* Financials */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider border-b pb-1">Savings & Contributions</h3>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="currentSavings">Current Retirement Capital</Label>
                    <div className="relative">
                        <span className="absolute left-3 top-2.5 text-gray-500">R</span>
                        <Input 
                            id="currentSavings" 
                            className="pl-8"
                            type="number" 
                            value={inputs.currentSavings}
                            onChange={(e) => setInputs({...inputs, currentSavings: Number(e.target.value)})} 
                        />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="contribution">Contribution</Label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-gray-500">R</span>
                            <Input 
                                id="contribution" 
                                className="pl-8"
                                type="number" 
                                value={inputs.contributionAmount}
                                onChange={(e) => setInputs({...inputs, contributionAmount: Number(e.target.value)})} 
                            />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="frequency">Frequency</Label>
                        <Select 
                            value={inputs.contributionFrequency} 
                            onValueChange={(v: string) => setInputs({...inputs, contributionFrequency: v})}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="monthly">Monthly</SelectItem>
                                <SelectItem value="annually">Annually</SelectItem>
                            </SelectContent>
                        </Select>
                      </div>
                  </div>
                  
                   <div className="space-y-2">
                    <Label htmlFor="growthRate">Contribution Annual Growth (%)</Label>
                    <Input 
                        id="growthRate" 
                        type="number" 
                        value={inputs.contributionGrowthRate}
                        onChange={(e) => setInputs({...inputs, contributionGrowthRate: Number(e.target.value)})} 
                    />
                    <p className="text-xs text-muted-foreground">Usually matches salary inflation (e.g. 6%)</p>
                  </div>
                </div>
              </div>

              {/* Market Assumptions - Collapsible */}
              <div className="space-y-4">
                <div 
                    className="flex items-center justify-between cursor-pointer border-b pb-1 hover:text-blue-600 transition-colors"
                    onClick={() => setShowAssumptions(!showAssumptions)}
                >
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Market Assumptions</h3>
                    {showAssumptions ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
                
                {showAssumptions && (
                    <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                         <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="nominalReturn">Nominal Return (%)</Label>
                                <Input 
                                    id="nominalReturn" 
                                    type="number" 
                                    value={inputs.nominalReturn}
                                    onChange={(e) => setInputs({...inputs, nominalReturn: Number(e.target.value)})} 
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="inflation">Inflation (%)</Label>
                                <Input 
                                    id="inflation" 
                                    type="number" 
                                    value={inputs.inflation}
                                    onChange={(e) => setInputs({...inputs, inflation: Number(e.target.value)})} 
                                />
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="fees">Total Annual Fees (%)</Label>
                                <Input 
                                    id="fees" 
                                    type="number" 
                                    value={inputs.annualFee}
                                    onChange={(e) => setInputs({...inputs, annualFee: Number(e.target.value)})} 
                                />
                            </div>
                         </div>
                         <div className="flex items-center space-x-2 pt-2">
                            <Switch 
                                id="nominal-mode" 
                                checked={inputs.isNominal}
                                onCheckedChange={(c) => setInputs({...inputs, isNominal: c})}
                            />
                            <Label htmlFor="nominal-mode">Show Nominal Values (Future Money)</Label>
                        </div>
                    </div>
                )}
              </div>

            </CardContent>
          </Card>
          
          {/* Scenarios List */}
          <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                    <History className="h-4 w-4" />
                    Saved Scenarios
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                 <div className="space-y-2 mb-4">
                    <Label>New Scenario Name</Label>
                    <div className="flex gap-2">
                        <Input 
                            placeholder="e.g. Baseline..." 
                            value={scenarioName}
                            onChange={(e) => setScenarioName(e.target.value)}
                        />
                        <Button variant="secondary" onClick={handleSaveScenario} disabled={saving || !selectedClientId}>
                            <Save className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
                
                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                    {scenarios.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-2">No scenarios saved for this client.</p>
                    ) : (
                        scenarios.map(s => (
                            <div key={s.id} className="flex items-center justify-between p-2 rounded-md hover:bg-gray-50 border border-transparent hover:border-gray-100 group">
                                <button 
                                    className="text-sm font-medium text-left truncate flex-1"
                                    onClick={() => loadScenario(s)}
                                >
                                    {s.name}
                                </button>
                                <span className="text-[10px] text-muted-foreground mr-2">
                                    {new Date(s.updatedAt).toLocaleDateString()}
                                </span>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); deleteScenario(s.id); }}
                                    className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Trash2 className="h-3 w-3" />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </CardContent>
          </Card>
        </div>

        {/* RESULTS COLUMN */}
        <div className="lg:col-span-8 space-y-6">
           {results ? (
               <div className="contents">
                {/* Key Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="bg-gradient-to-br from-white to-green-50 border-green-100">
                        <CardHeader className="pb-2">
                            <CardDescription>Projected Capital at Age {inputs.retirementAge}</CardDescription>
                            <CardTitle className="text-2xl text-green-700">{formatCurrency(results.totalCapital)}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-xs text-muted-foreground space-y-1">
                                <div className="flex justify-between">
                                    <span>From Savings:</span>
                                    <span>{formatCurrency(results.fvCurrentSavings)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>From Contribs:</span>
                                    <span>{formatCurrency(results.fvContributions)}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    
                    <Card className="bg-gradient-to-br from-white to-blue-50 border-blue-100">
                        <CardHeader className="pb-2">
                            <CardDescription>Sustainable Monthly Income</CardDescription>
                            <CardTitle className="text-2xl text-blue-700">{formatCurrency(results.sustainableIncomeMonthly)}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-xs text-muted-foreground">
                                Annual: {formatCurrency(results.sustainableIncomeAnnual)}
                            </div>
                             <div className="text-xs text-blue-600/80 mt-1 font-medium">
                                Lasts until Age {results.fundsLastToAge}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-white">
                         <CardHeader className="pb-2">
                            <CardDescription>Net Real Return</CardDescription>
                            <CardTitle className="text-2xl">{formatPercent(results.netRealReturn)}</CardTitle>
                        </CardHeader>
                         <CardContent>
                            <div className="text-xs text-muted-foreground space-y-1">
                                <div className="flex justify-between">
                                    <span>Nominal Return:</span>
                                    <span>{formatPercent(inputs.nominalReturn)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Inflation:</span>
                                    <span>{formatPercent(inputs.inflation)}</span>
                                </div>
                                 <div className="flex justify-between">
                                    <span>Fees:</span>
                                    <span>{formatPercent(inputs.annualFee)}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Tabs for Table / Comparison */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="w-full justify-start">
                        <TabsTrigger value="projection">Year-by-Year Projection</TabsTrigger>
                        <TabsTrigger value="comparison" disabled>Scenario Comparison (Coming Soon)</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="projection" className="mt-4">
                        <Card>
                            <CardContent className="p-0">
                                <div className="rounded-md border h-[600px] overflow-auto">
                                    <Table>
                                        <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                                            <TableRow>
                                                <TableHead className="w-[80px]">Age</TableHead>
                                                <TableHead>Year</TableHead>
                                                <TableHead>Opening Balance</TableHead>
                                                <TableHead>Cash Flow</TableHead>
                                                <TableHead>Growth</TableHead>
                                                <TableHead className="text-right">Closing Balance</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {results.projectionData.map((row) => (
                                                <TableRow key={row.age} className={row.phase === 'drawdown' ? 'bg-orange-50/30' : ''}>
                                                    <TableCell className="font-medium">{row.age}</TableCell>
                                                    <TableCell className="text-muted-foreground">{new Date().getFullYear() + row.year}</TableCell>
                                                    <TableCell>{formatCurrency(row.openingBalance)}</TableCell>
                                                    <TableCell className={row.contributionsOrIncome < 0 ? 'text-red-600' : 'text-green-600'}>
                                                        {formatCurrency(row.contributionsOrIncome)}
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground">{formatCurrency(row.growth)}</TableCell>
                                                    <TableCell className="text-right font-bold">{formatCurrency(row.closingBalance)}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
               </div>
           ) : (
               <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg bg-gray-50">
                   <Calculator className="h-12 w-12 text-gray-300 mb-4" />
                   <h3 className="text-lg font-medium text-gray-500">Enter details to calculate</h3>
               </div>
           )}
        </div>
      </div>
    </div>
  );
}