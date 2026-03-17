import React, { useState, Suspense } from 'react';
import { toast } from 'sonner@2.0.3';
import { Button } from '../../../ui/button';
import { Badge } from '../../../ui/badge';
import { cn } from '../../../ui/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../ui/select";
import { ComplianceOverview } from './components/ComplianceOverview';
import { 
  CheckCircle, 
  Download, 
  LayoutDashboard,
  Users,
  Briefcase,
  FileBarChart,
  Loader2
} from 'lucide-react';
import { useCurrentUserPermissions } from '../personnel/hooks/usePermissions';

// Heavy tab components — lazy-loaded (only one is rendered at a time)
const CDDTab = React.lazy(() => import('./components/CDDTab').then(m => ({ default: m.CDDTab })));
const PracticeTab = React.lazy(() => import('./components/PracticeTab').then(m => ({ default: m.PracticeTab })));
const ReportsTab = React.lazy(() => import('./components/ReportsTab').then(m => ({ default: m.ReportsTab })));

function TabFallback() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
    </div>
  );
}

const navigationItems = [
  { 
    id: 'overview', 
    label: 'Overview', 
    icon: LayoutDashboard,
    description: 'Dashboard & KPI Summary' 
  },
  {
    id: 'cdd',
    label: 'CDD',
    icon: Users,
    description: 'Client & Staff Due Diligence'
  },
  { 
    id: 'practice',  
    label: 'Practice', 
    icon: Briefcase,
    description: 'Practice Management'
  },
  { 
    id: 'reports', 
    label: 'Reports', 
    icon: FileBarChart,
    description: 'Registers & Reports'
  }
];

export function ComplianceModule() {
  const [activeTab, setActiveTab] = useState('overview');
  const [exportLoading, setExportLoading] = useState(false);
  const { canDo } = useCurrentUserPermissions();

  const canExport = canDo('compliance', 'export');

  const handleExportRegulatorPack = async () => {
    // Feature not implemented yet
    toast.info('Regulator Pack export is coming soon');
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return <ComplianceOverview onViewTab={setActiveTab} />;
      case 'cdd':
        return (
          <Suspense fallback={<TabFallback />}>
            <CDDTab />
          </Suspense>
        );
      case 'practice':
        return (
          <Suspense fallback={<TabFallback />}>
            <PracticeTab />
          </Suspense>
        );
      case 'reports':
        return (
          <Suspense fallback={<TabFallback />}>
            <ReportsTab />
          </Suspense>
        );
      default:
        return <ComplianceOverview onViewTab={setActiveTab} />;
    }
  };

  return (
    <div className="flex flex-col h-full w-full max-w-full bg-slate-50/50 overflow-hidden">
      {/* Header Section */}
      <div className="border-b bg-white px-6 py-4 shadow-sm shrink-0">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between max-w-screen-2xl mx-auto">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Compliance Management</h1>
              <Badge variant="outline" className="ml-2 border-green-200 bg-green-50 text-green-700">
                <CheckCircle className="h-3 w-3 mr-1" />
                FSP 123456 Active
              </Badge>
            </div>
            <p className="text-sm text-slate-500">
              Regulatory oversight, monitoring, and compliance documentation for Navigate Wealth
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleExportRegulatorPack}
              disabled={exportLoading || !canExport}
              className="bg-white"
            >
              {exportLoading ? (
                <div className="contents">
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  Generating Pack...
                </div>
              ) : (
                <div className="contents">
                  <Download className="mr-2 h-4 w-4" />
                  Export Regulator Pack
                </div>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="flex-1 overflow-hidden flex flex-col w-full max-w-full">
        
        {/* Mobile Navigation (Dropdown) - Visible only on small screens */}
        <div className="md:hidden p-4 bg-white border-b w-full">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
            Module Selection
          </label>
          <Select value={activeTab} onValueChange={setActiveTab}>
            <SelectTrigger className="w-full bg-slate-50 border-slate-200">
              <SelectValue placeholder="Select module" />
            </SelectTrigger>
            <SelectContent>
              {navigationItems.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  <div className="flex items-center gap-2">
                    <item.icon className="h-4 w-4 text-slate-500" />
                    <span className="font-medium">{item.label}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Desktop/Tablet Horizontal Navigation */}
        <div className="hidden md:block bg-white border-b shadow-sm z-10">
          <div className="max-w-screen-2xl mx-auto px-6">
            <nav className="flex items-center gap-1 overflow-x-auto py-2 no-scrollbar" aria-label="Tabs">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-md transition-all duration-200 whitespace-nowrap",
                      isActive 
                        ? "bg-slate-100 text-slate-900 shadow-sm ring-1 ring-slate-200" 
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    )}
                  >
                    <Icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-slate-500")} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto bg-slate-50/50 w-full max-w-full">
           <div className="max-w-screen-2xl mx-auto p-6 lg:p-8 space-y-6">
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
                {renderContent()}
              </div>
           </div>
        </main>
      </div>
    </div>
  );
}

// ==================== TYPES ====================
export * from './types';

// ==================== CONSTANTS ====================
export * from './constants';

// ==================== API ====================
export {
  faisApi,
  amlFicaApi,
  popiPaiaApi,
  statutoryApi,
  tcfApi,
  recordKeepingApi,
  debarmentSupervisionApi,
  conflictsMarketingApi,
  documentsInsuranceApi,
  newBusinessApi,
  complaintsApi,
  complianceOverviewApi,
  complianceApi, // Legacy
} from './api';

// ==================== HOOKS ====================
// React Query hooks (recommended)
export {
  // Query keys
  complianceKeys,
  
  // FAIS queries
  useFAISRecords,
  useFAISRecord,
  useFAISByAdviser,
  useCreateFAISRecord,
  useUpdateFAISRecord,
  useDeleteFAISRecord,
  
  // AML/FICA queries & mutations
  useAMLFICARecords,
  useAMLFICAByClient,
  useCreateAMLCheck,
  useRunAMLScreening,
  
  // POPI/PAIA queries & mutations
  usePOPIAConsents,
  usePOPIAConsentsByUser,
  usePAIARequests,
  useRecordConsent,
  useWithdrawConsent,
  useCreatePAIARequest,
  useUpdatePAIARequest,
  
  // Statutory queries & mutations
  useStatutoryRecords,
  useStatutoryRecord,
  useCreateStatutoryRecord,
  useSubmitStatutoryRecord,
  
  // TCF queries & mutations
  useTCFRecords,
  useCreateTCFAssessment,
  useUpdateTCFAssessment,
  
  // Record Keeping queries & mutations
  useRecordKeeping,
  useCreateRecordKeepingEntry,
  useMarkForDisposal,
  
  // Debarment & Supervision queries & mutations
  useDebarmentRecords,
  useSupervisionRecords,
  useRunDebarmentCheck,
  useCreateSupervisionRecord,
  
  // Conflicts & Marketing queries & mutations
  useConflictRecords,
  useMarketingRecords,
  useCreateConflictRecord,
  useCreateMarketingRecord,
  useApproveMarketing,
  
  // Documents & Insurance queries & mutations
  useDocumentsInsuranceRecords,
  useCreateDocumentsInsuranceRecord,
  useRenewInsurance,
  
  // New Business queries & mutations
  useNewBusinessRecords,
  useNewBusinessByClient,
  useCreateNewBusinessRecord,
  
  // Complaints queries & mutations
  useComplaints,
  useComplaint,
  useCreateComplaint,
  useUpdateComplaint,
  useResolveComplaint,
  useEscalateComplaint,
  
  // Overview queries & mutations
  useComplianceActivities,
  useComplianceDeadlines,
  useComplianceStats,
  useComplianceOverview,
  useRefreshCompliance,
} from './hooks';

// ==================== LEGACY HOOKS (backward compatibility) ====================
export {
  useFAISRecordsLegacy,
  useStatutoryRecordsLegacy,
  useDocumentsInsuranceRecordsLegacy,
  useComplianceOverviewLegacy,
} from './hooks';