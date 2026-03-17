/**
 * ComplianceTab — Main compliance entry point within ClientDrawer.
 *
 * Registration gate: checks if client is registered with Honeycomb/Beeswax.
 * Once registered, renders sub-tabs for each compliance function group:
 *   - Overview (header + quick actions + activity snapshot)
 *   - Identity Verification (IDV via correct Honeycomb endpoints)
 *   - CDD (Customer Due Diligence)
 *   - Financial Intelligence (bank verify + credit check)
 *   - Screening & Sanctions (real sanctions search)
 *   - Risk Assessment (existing full-workflow panel)
 *   - Activity Log (unified compliance history)
 *
 * Sub-tabs use Level 2 tab style per TAB_DESIGN_STANDARDS.md:
 * white bg with purple borders for active state.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../ui/card';
import { Badge } from '../../../../ui/badge';
import { Button } from '../../../../ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../ui/table';
import { Input } from '../../../../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import {
  Shield,
  RefreshCw,
  UserCheck,
  AlertTriangle,
  Loader2,
  Link as LinkIcon,
  History,
  Eye,
  Landmark,
  Search,
  BarChart3,
  ClipboardList,
  Building2,
  MapPin,
  Download,
  Filter,
  X,
  FileCheck,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId } from '../../../../../utils/supabase/info';
import { BASE_PDF_CSS } from '../../resources/templates/BasePdfLayout';
import { getAuthToken } from './compliance/compliance-auth';

import { Client } from '../types';
import { clientApi } from '../api';
import { RiskAssessmentPanel } from './RiskAssessmentPanel';
import { IdentityVerificationPanel } from './compliance/IdentityVerificationPanel';
import { FinancialIntelligencePanel } from './compliance/FinancialIntelligencePanel';
import { SanctionsScreeningPanel } from './compliance/SanctionsScreeningPanel';
import { CorporateGovernancePanel } from './compliance/CorporateGovernancePanel';
import { AddressReportsPanel } from './compliance/AddressReportsPanel';
import { ComplianceDashboardPanel } from './compliance/ComplianceDashboardPanel';
import { ComplianceResultViewer } from './compliance/ComplianceResultViewer';
import { CDDPanel } from './compliance/CDDPanel';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ComplianceTabProps {
  selectedClient: Client;
  sanctionsScreeningRunning: boolean;
  onRunSanctionsScreening: () => void;
  lastSanctionsCheck: string;
}

interface ComplianceActivity {
  id: string;
  type: string;
  date: string;
  status: string;
  details?: Record<string, unknown>;
}

type ComplianceSubTab =
  | 'overview'
  | 'identity-verification'
  | 'cdd'
  | 'financial-intelligence'
  | 'corporate-governance'
  | 'screening-sanctions'
  | 'address-reports'
  | 'risk-assessment'
  | 'activity-log';

const SUB_TABS: { id: ComplianceSubTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'overview', label: 'Overview', icon: Shield },
  { id: 'identity-verification', label: 'Identity Verification', icon: UserCheck },
  { id: 'cdd', label: 'CDD', icon: FileCheck },
  { id: 'financial-intelligence', label: 'Financial Intelligence', icon: Landmark },
  { id: 'corporate-governance', label: 'Corporate & Governance', icon: Building2 },
  { id: 'screening-sanctions', label: 'Screening & Sanctions', icon: Search },
  { id: 'address-reports', label: 'Address', icon: MapPin },
  { id: 'risk-assessment', label: 'Risk Assessment', icon: ClipboardList },
  { id: 'activity-log', label: 'Reports', icon: History },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/integrations/honeycomb`;

const isValidIdNumber = (val: unknown): val is string =>
  typeof val === 'string' &&
  val.trim().length > 0 &&
  !['not provided', 'n/a', 'undefined', 'null', 'none', '-'].includes(val.trim().toLowerCase());

// ─── Component ──────────────────────────────────────────────────────────────

export function ComplianceTab({
  selectedClient,
  sanctionsScreeningRunning,
  onRunSanctionsScreening,
  lastSanctionsCheck,
}: ComplianceTabProps) {
  const [registrationStatus, setRegistrationStatus] = useState<'loading' | 'registered' | 'unregistered'>('loading');
  const [isRegistering, setIsRegistering] = useState(false);
  const [honeycombId, setHoneycombId] = useState<string | null>(null);

  const [activities, setActivities] = useState<ComplianceActivity[]>([]);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);

  // KV-stored profile data (source of truth for ID numbers)
  const [kvProfileIdNumber, setKvProfileIdNumber] = useState<string | null>(null);
  const [kvProfilePassport, setKvProfilePassport] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // Sub-tab navigation
  const [activeSubTab, setActiveSubTab] = useState<ComplianceSubTab>('overview');

  // ─── ID Resolution ──────────────────────────────────────────────────────

  useEffect(() => {
    const loadProfileForCompliance = async () => {
      setProfileLoading(true);
      try {
        const result = await clientApi.fetchClientProfile(selectedClient.id);
        if (result.success && result.data) {
          const idNum = result.data.idNumber;
          const passport = result.data.passportNumber;
          setKvProfileIdNumber(isValidIdNumber(idNum) ? idNum : null);
          setKvProfilePassport(isValidIdNumber(passport) ? passport : null);
        } else {
          setKvProfileIdNumber(null);
          setKvProfilePassport(null);
        }
      } catch (err) {
        console.warn('[ComplianceTab] Could not fetch KV profile:', err);
        setKvProfileIdNumber(null);
        setKvProfilePassport(null);
      } finally {
        setProfileLoading(false);
      }
    };

    if (selectedClient.id) {
      loadProfileForCompliance();
    }
  }, [selectedClient.id]);

  const resolvedIdNumber = [
    kvProfileIdNumber,
    selectedClient.profile?.personalInformation?.idNumber,
    (selectedClient.profile as Record<string, unknown>)?.profile_id_number,
    selectedClient.idNumber,
    (selectedClient as Record<string, unknown>).profile_id_number,
  ].find(isValidIdNumber) || null;

  const resolvedPassport = [
    kvProfilePassport,
    selectedClient.profile?.personalInformation?.passportNumber,
    (selectedClient.profile as Record<string, unknown>)?.passportNumber,
  ].find(isValidIdNumber) || null;

  const hasIdentification = !!resolvedIdNumber || !!resolvedPassport;

  // ─── Registration ─────────────────────────────────────────────────────

  useEffect(() => {
    checkRegistration();
  }, [selectedClient.id]);

  useEffect(() => {
    if (registrationStatus === 'registered') {
      fetchActivityLog();
    }
  }, [registrationStatus, selectedClient.id]);

  const checkRegistration = async () => {
    try {
      setRegistrationStatus('loading');
      const token = await getAuthToken();
      const res = await fetch(`${API_BASE}/status/${selectedClient.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.registered) {
          setRegistrationStatus('registered');
          setHoneycombId(data.honeycombId);
        } else {
          setRegistrationStatus('unregistered');
        }
      } else {
        setRegistrationStatus('unregistered');
      }
    } catch (error) {
      console.error('Error checking registration:', error);
      setRegistrationStatus('unregistered');
    }
  };

  const fetchActivityLog = async () => {
    try {
      setIsLoadingActivity(true);
      const token = await getAuthToken();
      const res = await fetch(`${API_BASE}/activity/${selectedClient.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setActivities(data.activity || []);
      }
    } catch (error) {
      console.error('Error fetching activity:', error);
    } finally {
      setIsLoadingActivity(false);
    }
  };

  const handleRegister = async () => {
    setIsRegistering(true);
    const toastId = toast.loading('Registering client with Honeycomb/Beeswax...');

    try {
      const token = await getAuthToken();
      const res = await fetch(`${API_BASE}/register-client`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId: selectedClient.id,
          firstName: selectedClient.firstName,
          lastName: selectedClient.lastName,
          idNumber: resolvedIdNumber,
          passport: resolvedPassport,
          email: selectedClient.email,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      toast.success('Client registered successfully!', { id: toastId });
      setHoneycombId(data.honeycombId);
      setRegistrationStatus('registered');
    } catch (error: unknown) {
      console.error('Registration error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to register client', { id: toastId });
    } finally {
      setIsRegistering(false);
    }
  };

  // ─── Loading ──────────────────────────────────────────────────────────

  if (registrationStatus === 'loading' || profileLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  // ─── Unregistered State ───────────────────────────────────────────────

  if (registrationStatus === 'unregistered') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium">Compliance Management</h3>
            <p className="text-sm text-muted-foreground">
              Integration with Beeswax/Honeycomb for KYC and Sanctions Screening
            </p>
          </div>
        </div>

        {!hasIdentification && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">ID Number Required</p>
              <p className="text-sm text-amber-700 mt-1">
                This client does not have a valid ID number or passport number on their profile.
                Please update their profile with a South African ID number or passport number before registering with Beeswax.
              </p>
            </div>
          </div>
        )}

        <Card className="border-dashed border-2">
          <CardContent className="py-12 flex flex-col items-center justify-center text-center space-y-4">
            <div className="bg-purple-100 p-4 rounded-full">
              <Shield className="h-12 w-12 text-purple-600" />
            </div>
            <div>
              <h4 className="text-xl font-semibold mb-2">Registration Required</h4>
              <p className="text-gray-500 max-w-md mx-auto">
                To perform compliance checks, this client must first be registered with the Beeswax/Honeycomb external compliance service.
              </p>
            </div>
            <div className="flex gap-4 pt-4">
              <Button
                onClick={handleRegister}
                disabled={isRegistering || !hasIdentification}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {isRegistering ? (
                  <div className="contents">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Registering...
                  </div>
                ) : (
                  <div className="contents">
                    <LinkIcon className="mr-2 h-4 w-4" />
                    Register Client on Beeswax
                  </div>
                )}
              </Button>
            </div>
            <p className="text-xs text-gray-400 mt-4">
              This will create a profile using Name: <strong>{selectedClient.firstName} {selectedClient.lastName}</strong> and ID: <strong>{resolvedIdNumber || 'N/A — update client profile'}</strong>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Registered State (Sub-tab Navigation) ────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Compliance Workspace</h3>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            Linked to Beeswax ID:{' '}
            <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{honeycombId}</span>
          </p>
        </div>
      </div>

      {/* SUBTABS - Level 2: Secondary Navigation
          Uses white background with purple borders for active state
          See: /components/admin/TAB_DESIGN_STANDARDS.md */}
      <div className="pb-4 border-b border-gray-200">
        <div className="flex items-center gap-2 overflow-x-auto">
          {SUB_TABS.map((subtab) => {
            const Icon = subtab.icon;
            return (
              <button
                key={subtab.id}
                onClick={() => setActiveSubTab(subtab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  activeSubTab === subtab.id
                    ? 'bg-white text-[#6d28d9] border-2 border-[#6d28d9] shadow-sm'
                    : 'bg-transparent text-gray-600 hover:bg-gray-100 border border-gray-300 hover:border-gray-400'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{subtab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ──── Sub-tab Content ──── */}

      {activeSubTab === 'overview' && (
        <OverviewContent
          selectedClient={selectedClient}
          honeycombId={honeycombId}
          resolvedIdNumber={resolvedIdNumber}
          resolvedPassport={resolvedPassport}
          hasIdentification={hasIdentification}
          activities={activities}
          isLoadingActivity={isLoadingActivity}
          onNavigate={setActiveSubTab}
        />
      )}

      {activeSubTab === 'identity-verification' && (
        <IdentityVerificationPanel
          clientId={selectedClient.id}
          firstName={selectedClient.firstName}
          lastName={selectedClient.lastName}
          idNumber={resolvedIdNumber}
          passport={resolvedPassport}
          hasIdentification={hasIdentification}
          onCheckComplete={fetchActivityLog}
        />
      )}

      {activeSubTab === 'cdd' && (
        <CDDPanel
          clientId={selectedClient.id}
          firstName={selectedClient.firstName}
          lastName={selectedClient.lastName}
          idNumber={resolvedIdNumber}
          passport={resolvedPassport}
          hasIdentification={hasIdentification}
          onCheckComplete={fetchActivityLog}
        />
      )}

      {activeSubTab === 'financial-intelligence' && (
        <FinancialIntelligencePanel
          clientId={selectedClient.id}
          firstName={selectedClient.firstName}
          lastName={selectedClient.lastName}
          idNumber={resolvedIdNumber}
          passport={resolvedPassport}
          hasIdentification={hasIdentification}
          onCheckComplete={fetchActivityLog}
        />
      )}

      {activeSubTab === 'screening-sanctions' && (
        <SanctionsScreeningPanel
          clientId={selectedClient.id}
          firstName={selectedClient.firstName}
          lastName={selectedClient.lastName}
          idNumber={resolvedIdNumber}
          passport={resolvedPassport}
          onCheckComplete={fetchActivityLog}
        />
      )}

      {activeSubTab === 'corporate-governance' && (
        <CorporateGovernancePanel
          clientId={selectedClient.id}
          firstName={selectedClient.firstName}
          lastName={selectedClient.lastName}
          idNumber={resolvedIdNumber}
          passport={resolvedPassport}
          hasIdentification={hasIdentification}
          onCheckComplete={fetchActivityLog}
        />
      )}

      {activeSubTab === 'address-reports' && (
        <AddressReportsPanel
          clientId={selectedClient.id}
          firstName={selectedClient.firstName}
          lastName={selectedClient.lastName}
          idNumber={resolvedIdNumber}
          passport={resolvedPassport}
          hasIdentification={hasIdentification}
          onCheckComplete={fetchActivityLog}
        />
      )}

      {activeSubTab === 'risk-assessment' && (
        <RiskAssessmentPanel
          clientId={selectedClient.id}
          clientFirstName={selectedClient.firstName}
          clientLastName={selectedClient.lastName}
          idNumber={resolvedIdNumber}
          passport={resolvedPassport}
          hasIdentification={hasIdentification}
        />
      )}

      {activeSubTab === 'activity-log' && (
        <ActivityLogContent
          activities={activities}
          isLoading={isLoadingActivity}
          onRefresh={fetchActivityLog}
          clientId={selectedClient.id}
          clientName={`${selectedClient.firstName} ${selectedClient.lastName}`}
        />
      )}
    </div>
  );
}

// ─── Overview Sub-component ──────────────────────────────────────────────────

function OverviewContent({
  selectedClient,
  honeycombId,
  resolvedIdNumber,
  resolvedPassport,
  hasIdentification,
  activities,
  isLoadingActivity,
  onNavigate,
}: {
  selectedClient: Client;
  honeycombId: string | null;
  resolvedIdNumber: string | null;
  resolvedPassport: string | null;
  hasIdentification: boolean;
  activities: ComplianceActivity[];
  isLoadingActivity: boolean;
  onNavigate: (tab: ComplianceSubTab) => void;
}) {
  // Viewer state for recent activity items
  const [viewerActivity, setViewerActivity] = useState<ComplianceActivity | null>(null);

  // Count activity types
  const activityCounts = activities.reduce<Record<string, number>>((acc, a) => {
    acc[a.type] = (acc[a.type] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Total Checks"
          value={activities.length}
          icon={<BarChart3 className="h-4 w-4 text-purple-500" />}
        />
        <StatCard
          label="IDV Reports"
          value={activityCounts['IDV Report'] || 0}
          icon={<UserCheck className="h-4 w-4 text-blue-500" />}
        />
        <StatCard
          label="Sanctions Searches"
          value={activityCounts['Sanctions Search'] || 0}
          icon={<Shield className="h-4 w-4 text-purple-500" />}
        />
        <StatCard
          label="Risk Assessments"
          value={activityCounts['Risk Assessment'] || 0}
          icon={<ClipboardList className="h-4 w-4 text-green-500" />}
        />
      </div>

      {/* Compliance Dashboard — readiness score, category progress, risk flags */}
      <ComplianceDashboardPanel
        clientId={selectedClient.id}
        onNavigate={onNavigate}
      />

      {/* Quick action cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <QuickActionCard
          title="Identity Verification"
          description="Run IDV checks via Honeycomb bureau integration"
          icon={<UserCheck className="h-5 w-5 text-blue-600" />}
          onClick={() => onNavigate('identity-verification')}
          disabled={!hasIdentification}
        />
        <QuickActionCard
          title="Sanctions Screening"
          description="Search OFAC, UN, EU and SA sanctions lists"
          icon={<Shield className="h-5 w-5 text-purple-600" />}
          onClick={() => onNavigate('screening-sanctions')}
        />
        <QuickActionCard
          title="Financial Intelligence"
          description="Bank verification, credit & consumer trace"
          icon={<Landmark className="h-5 w-5 text-green-600" />}
          onClick={() => onNavigate('financial-intelligence')}
          disabled={!hasIdentification}
        />
        <QuickActionCard
          title="Corporate & Governance"
          description="CIPC company search & director enquiry"
          icon={<Building2 className="h-5 w-5 text-purple-600" />}
          onClick={() => onNavigate('corporate-governance')}
          disabled={!hasIdentification}
        />
        <QuickActionCard
          title="Address"
          description="Best known address lookup"
          icon={<MapPin className="h-5 w-5 text-green-600" />}
          onClick={() => onNavigate('address-reports')}
          disabled={!hasIdentification}
        />
      </div>

      {/* Client identification summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-md font-medium">Client Identification</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Honeycomb ID</span>
              <div className="font-mono text-xs bg-gray-100 px-2 py-1 rounded mt-1">
                {honeycombId || '—'}
              </div>
            </div>
            <div>
              <span className="text-gray-500">SA ID Number</span>
              <div className="mt-1">
                {resolvedIdNumber ? (
                  <Badge variant="outline" className="font-mono text-xs">
                    {resolvedIdNumber.substring(0, 6)}••••••{resolvedIdNumber.substring(resolvedIdNumber.length - 1)}
                  </Badge>
                ) : (
                  <span className="text-xs text-gray-400">Not set</span>
                )}
              </div>
            </div>
            <div>
              <span className="text-gray-500">Passport</span>
              <div className="mt-1">
                {resolvedPassport ? (
                  <Badge variant="outline" className="font-mono text-xs">
                    {resolvedPassport.substring(0, 3)}•••
                  </Badge>
                ) : (
                  <span className="text-xs text-gray-400">Not set</span>
                )}
              </div>
            </div>
            <div>
              <span className="text-gray-500">Client Name</span>
              <div className="mt-1 font-medium text-sm">
                {selectedClient.firstName} {selectedClient.lastName}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent activity snapshot */}
      {activities.length > 0 && (
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-md font-medium flex items-center gap-2">
              <History className="h-5 w-5 text-gray-500" />
              Recent Activity
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('activity-log')}>
              View All
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {activities.slice(0, 5).map((activity) => (
                <button
                  key={activity.id}
                  onClick={() => setViewerActivity(activity)}
                  className="flex items-center justify-between p-2 rounded-lg bg-gray-50 text-sm w-full text-left hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-xs">{activity.type}</span>
                    <ActivityDetailSummary activity={activity} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">
                      {new Date(activity.date).toLocaleDateString('en-ZA', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                      {activity.status}
                    </Badge>
                    <Eye className="h-3.5 w-3.5 text-gray-400" />
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Result viewer for recent activity items */}
      <ComplianceResultViewer
        open={!!viewerActivity}
        onClose={() => setViewerActivity(null)}
        activity={viewerActivity}
        clientId={selectedClient.id}
        clientName={`${selectedClient.firstName} ${selectedClient.lastName}`}
      />
    </div>
  );
}

// ─── Activity Log Sub-component ──────────────────────────────────────────────

const REPORTS_PAGE_SIZE = 15;

function ActivityLogContent({
  activities,
  isLoading,
  onRefresh,
  clientId,
  clientName,
}: {
  activities: ComplianceActivity[];
  isLoading: boolean;
  onRefresh: () => void;
  clientId: string;
  clientName: string;
}) {
  const [viewerActivity, setViewerActivity] = useState<ComplianceActivity | null>(null);

  // ── Filters ──
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);

  // ── Pagination ──
  const [currentPage, setCurrentPage] = useState(1);

  // Unique activity types for the dropdown
  const activityTypes = useMemo(() => {
    const types = new Set(activities.map((a) => a.type));
    return Array.from(types).sort();
  }, [activities]);

  // Filtered activities
  const filteredActivities = useMemo(() => {
    return activities.filter((a) => {
      if (typeFilter !== 'all' && a.type !== typeFilter) return false;
      if (dateFrom) {
        const from = new Date(dateFrom);
        from.setHours(0, 0, 0, 0);
        if (new Date(a.date) < from) return false;
      }
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        if (new Date(a.date) > to) return false;
      }
      return true;
    });
  }, [activities, typeFilter, dateFrom, dateTo]);

  // Pagination derived values
  const totalPages = Math.max(1, Math.ceil(filteredActivities.length / REPORTS_PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedActivities = useMemo(() => {
    const start = (safePage - 1) * REPORTS_PAGE_SIZE;
    return filteredActivities.slice(start, start + REPORTS_PAGE_SIZE);
  }, [filteredActivities, safePage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [typeFilter, dateFrom, dateTo]);

  const hasActiveFilters = typeFilter !== 'all' || dateFrom || dateTo;

  const clearFilters = () => {
    setTypeFilter('all');
    setDateFrom('');
    setDateTo('');
    setCurrentPage(1);
  };

  // ── Download All ──
  const handleDownloadAll = async () => {
    setIsDownloadingAll(true);
    const toastId = toast.loading('Generating compliance dossier...');

    try {
      const token = await getAuthToken();
      const res = await fetch(`${API_BASE}/checks/history/${clientId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error(`Failed to fetch check history (${res.status})`);

      const data = await res.json();
      const allResults = data.history || [];

      const now = new Date().toLocaleString('en-ZA', {
        day: '2-digit', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
      const issueDate = new Date().toLocaleDateString('en-GB', {
        day: '2-digit', month: '2-digit', year: 'numeric',
      });

      // Group results by checkType
      interface ComplianceCheckResult { checkType: string; submittedAt: string; status: string; summary?: string; matterId?: string; rawResponse?: unknown }
      const grouped: Record<string, ComplianceCheckResult[]> = {};
      for (const r of allResults) {
        if (!grouped[r.checkType]) grouped[r.checkType] = [];
        grouped[r.checkType].push(r);
      }

      const checkTypeLabels: Record<string, string> = {
        idv_no_photo: 'Identity Verification (No Photo)',
        idv_with_photo: 'Identity Verification (With Photo)',
        idv_no_photo_secondary: 'IDV Secondary (No Photo)',
        idv_with_photo_secondary: 'IDV Secondary (With Photo)',
        idv_bulk: 'Bulk IDV',
        bank_verification: 'Bank Account Verification',
        consumer_credit: 'Consumer Credit Check',
        consumer_trace: 'Consumer Trace',
        debt_enquiry: 'Debt Review Enquiry',
        lifestyle_audit: 'Lifestyle Audit',
        income_predictor: 'Income Predictor',
        cipc: 'CIPC Company Search',
        director_enquiry: 'Director Enquiry',
        tenders_blue: 'Tenders Blue List',
        custom_screening: 'Custom Screening',
        sanctions_search: 'Sanctions Search',
        enforcement_actions: 'Enforcement Actions',
        legal_a_listing: 'Legal A Listing',
        best_known_address: 'Best Known Address',
        cdd_report: 'Customer Due Diligence (CDD)',
        assessment: 'Risk Assessment',
        registration: 'Client Registration',
      };

      let sectionNum = 0;
      let sectionsHtml = '';
      for (const [checkType, results] of Object.entries(grouped)) {
        sectionNum++;
        const label = checkTypeLabels[checkType] || checkType.replace(/_/g, ' ');
        sectionsHtml += `
          <div class="section dossier-section">
            <div class="section-head dossier-section-head">
              <span class="num">${sectionNum}</span>
              <h2>${label} <span style="font-weight:400;color:#9ca3af;font-size:9.5px">(${results.length} result${results.length !== 1 ? 's' : ''})</span></h2>
            </div>
            ${results.map((r: { submittedAt: string; status: string; summary?: string; matterId?: string; rawResponse?: unknown }) => `
              <div class="dossier-result">
                <table>
                  <tr><th>Date</th><td>${new Date(r.submittedAt).toLocaleString('en-ZA', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td></tr>
                  <tr><th>Status</th><td>${r.status}</td></tr>
                  <tr><th>Summary</th><td>${r.summary || '\u2014'}</td></tr>
                  ${r.matterId ? `<tr><th>Matter ID</th><td style="font-family:monospace;font-size:9px">${r.matterId}</td></tr>` : ''}
                </table>
                <details style="margin-top:2mm">
                  <summary style="cursor:pointer;font-size:8.5px;color:#6b7280">View full provider response</summary>
                  <pre style="background:#1f2937;color:#e5e7eb;padding:6px;border-radius:4px;font-size:8px;overflow-x:auto;max-height:200px;overflow-y:auto;margin-top:4px;white-space:pre-wrap;word-break:break-word">${JSON.stringify(r.rawResponse, null, 2)}</pre>
                </details>
              </div>
            `).join('')}
          </div>
        `;
      }

      const dossierHtml = generateDossierHtml({
        clientName,
        now,
        issueDate,
        grouped,
        allResults,
        sectionsHtml,
      });

      const win = window.open('', '_blank');
      if (win) {
        win.document.write(dossierHtml);
        win.document.close();
      }

      toast.success(`Dossier generated: ${allResults.length} results across ${Object.keys(grouped).length} check types`, { id: toastId });
    } catch (err: unknown) {
      console.error('[ActivityLog] Download All error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to generate dossier', { id: toastId });
    } finally {
      setIsDownloadingAll(false);
    }
  };

  return (
    <div className="contents">
      <Card className="flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between flex-shrink-0">
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="h-5 w-5" />
            Compliance Reports
            {filteredActivities.length !== activities.length && (
              <Badge variant="secondary" className="text-xs">
                {filteredActivities.length} of {activities.length}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadAll}
              disabled={isDownloadingAll || activities.length === 0}
            >
              {isDownloadingAll ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-1" />
              )}
              Download All
            </Button>
            <Button variant="outline" size="sm" onClick={onRefresh}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col flex-1 min-h-0">
          {/* Third-party attribution banner */}
          <div className="mb-4 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 flex items-center gap-2 flex-shrink-0">
            <Shield className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
            <span className="text-xs text-slate-600">
              All compliance checks performed by independent third party{' '}
              <strong className="text-slate-800">Honeycomb Information Services</strong> via the Beeswax platform.
            </span>
          </div>

          {/* Filter bar */}
          {activities.length > 0 && (
            <div className="mb-4 flex flex-wrap items-end gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 flex-shrink-0">
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Filter className="h-3.5 w-3.5" />
                <span className="font-medium">Filters</span>
              </div>

              <div className="flex-1 min-w-[160px] max-w-[220px]">
                <label className="block text-xs text-gray-500 mb-1">Check Type</label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    {activityTypes.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="min-w-[140px]">
                <label className="block text-xs text-gray-500 mb-1">From</label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="min-w-[140px]">
                <label className="block text-xs text-gray-500 mb-1">To</label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="h-8 text-xs text-gray-500 hover:text-gray-700"
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          )}

          {/* Scrollable table area */}
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-lg">
              No compliance activity recorded yet. Start by running an assessment or requesting a report.
            </div>
          ) : filteredActivities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-lg">
              No activities match the current filters.{' '}
              <button onClick={clearFilters} className="text-purple-600 hover:underline">Clear filters</button>
            </div>
          ) : (
            <div className="flex flex-col">
              {/* Contained scrollable table */}
              <div className="overflow-auto max-h-[520px] border border-gray-200 rounded-lg">
                <Table>
                  <TableHeader className="sticky top-0 bg-white z-10">
                    <TableRow>
                      <TableHead className="text-xs">Date</TableHead>
                      <TableHead className="text-xs">Type</TableHead>
                      <TableHead className="text-xs">Provider</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">Details</TableHead>
                      <TableHead className="text-right text-xs">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedActivities.map((activity) => (
                      <TableRow key={activity.id}>
                        <TableCell className="font-medium text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(activity.date).toLocaleString('en-ZA', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">{activity.type}</div>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">Honeycomb</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            {activity.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm max-w-[200px]">
                          <ActivityDetailSummary activity={activity} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8"
                            onClick={() => setViewerActivity(activity)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination footer */}
              <div className="flex items-center justify-between pt-3 mt-3 border-t border-gray-100 flex-shrink-0">
                <span className="text-xs text-gray-500">
                  Showing {((safePage - 1) * REPORTS_PAGE_SIZE) + 1}–{Math.min(safePage * REPORTS_PAGE_SIZE, filteredActivities.length)} of {filteredActivities.length}{filteredActivities.length !== activities.length ? ` (filtered from ${activities.length})` : ''}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0"
                    disabled={safePage <= 1}
                    onClick={() => setCurrentPage(safePage - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>

                  {/* Page number buttons — show up to 5 with ellipsis */}
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => {
                      if (totalPages <= 5) return true;
                      if (p === 1 || p === totalPages) return true;
                      return Math.abs(p - safePage) <= 1;
                    })
                    .reduce<(number | string)[]>((acc, p, idx, arr) => {
                      if (idx > 0) {
                        const prev = arr[idx - 1];
                        if (p - prev > 1) acc.push(`ellipsis-${idx}`);
                      }
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((item) =>
                      typeof item === 'string' ? (
                        <span key={item} className="px-1 text-xs text-gray-400">...</span>
                      ) : (
                        <Button
                          key={item}
                          variant={item === safePage ? 'default' : 'outline'}
                          size="sm"
                          className={`h-8 w-8 p-0 text-xs ${
                            item === safePage ? 'bg-purple-600 hover:bg-purple-700 text-white' : ''
                          }`}
                          onClick={() => setCurrentPage(item as number)}
                        >
                          {item}
                        </Button>
                      )
                    )}

                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0"
                    disabled={safePage >= totalPages}
                    onClick={() => setCurrentPage(safePage + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ComplianceResultViewer
        open={!!viewerActivity}
        onClose={() => setViewerActivity(null)}
        activity={viewerActivity}
        clientId={clientId}
        clientName={clientName}
      />
    </div>
  );
}

// ─── Dossier HTML Generator (BasePdfLayout template) ─────────────────────────

/**
 * Generates a full HTML document for the compliance dossier using the base PDF
 * template structure (masthead, branded header, numbered sections, repeating
 * print footer). Content uses CSS page-break rules so it flows across pages
 * without bleeding over the footer.
 */
function generateDossierHtml({
  clientName,
  now,
  issueDate,
  grouped,
  allResults,
  sectionsHtml,
}: {
  clientName: string;
  now: string;
  issueDate: string;
  grouped: Record<string, unknown[]>;
  allResults: unknown[];
  sectionsHtml: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Compliance Dossier \u2014 ${clientName}</title>
  <style>
    ${BASE_PDF_CSS}

    /* ===== Dossier-specific overrides for flowing multi-page layout ===== */

    /* Override fixed-height page for flowing content */
    .pdf-viewport {
      display: block;
      padding: 24px;
      background: #f3f4f6;
    }
    .pdf-page {
      height: auto;
      overflow: visible;
      max-width: 210mm;
      margin: 0 auto;
      page-break-after: auto;
      break-after: auto;
    }
    .pdf-content {
      height: auto;
      padding-bottom: 8mm;
    }

    /* On-screen footer is static, not absolute */
    .pdf-footer {
      position: relative;
      bottom: auto;
      left: auto;
      right: auto;
      margin-top: 6mm;
    }

    /* Dossier result blocks — avoid page-break inside */
    .dossier-result {
      break-inside: avoid;
      page-break-inside: avoid;
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 3mm;
      margin-bottom: 2mm;
    }
    .dossier-result table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9.5px;
    }
    .dossier-result table th,
    .dossier-result table td {
      padding: 2px 6px;
      border-bottom: 1px solid #f3f4f6;
      text-align: left;
      vertical-align: top;
    }
    .dossier-result table th {
      color: #6b7280;
      width: 25%;
      font-weight: 600;
      background: transparent;
      border: none;
      border-bottom: 1px solid #f3f4f6;
    }
    .dossier-result table td {
      font-weight: 500;
      border: none;
      border-bottom: 1px solid #f3f4f6;
    }

    /* Section headings stay with first result */
    .dossier-section-head {
      break-after: avoid;
      page-break-after: avoid;
    }

    /* Sections allow internal breaks for large result sets */
    .dossier-section {
      break-inside: auto;
      page-break-inside: auto;
    }

    /* Meta summary box */
    .dossier-meta {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.5mm 6mm;
      margin-bottom: 5mm;
      padding: 3mm 4mm;
      background: var(--soft);
      border: 1px solid var(--border);
      border-radius: 4px;
      font-size: 9.5px;
    }
    .dossier-meta .dk { color: #6b7280; font-weight: 600; }
    .dossier-meta .dv { color: var(--text); }

    /* Attribution callout */
    .dossier-attribution {
      break-inside: avoid;
      page-break-inside: avoid;
      margin-top: 6mm;
      padding: 3mm 4mm;
      background: var(--soft);
      border: 1px solid var(--border);
      border-radius: 4px;
      font-size: 8.5px;
      line-height: 1.5;
      color: #64748b;
    }
    .dossier-attribution strong { color: #334155; }

    /* Running footer for print \u2014 repeats on every printed page */
    .running-footer {
      display: none;
    }

    /* ===== Print overrides ===== */
    @media print {
      @page {
        size: A4;
        margin: 12mm 10mm 28mm 10mm;
      }

      html, body {
        margin: 0;
        padding: 0;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .no-print { display: none !important; }

      .pdf-viewport {
        padding: 0;
        background: transparent;
      }
      .pdf-page {
        box-shadow: none;
        border: none;
        max-width: none;
        width: auto;
      }
      .pdf-content {
        padding: 0;
      }

      /* Hide on-screen static footer in print */
      .pdf-footer { display: none !important; }

      /* Show running footer that repeats on every printed page */
      .running-footer {
        display: block;
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        height: 18mm;
        border-top: 1px solid var(--border);
        padding: 3mm 0 0 0;
        font-size: 8px;
        line-height: 1.35;
        color: var(--muted);
        background: #ffffff;
      }
      .running-footer .footer-row {
        display: flex;
        gap: 5mm;
        align-items: flex-start;
      }

      .top-masthead {
        display: flex;
        height: 15mm;
        border-bottom: 1px solid var(--border);
      }
    }
  </style>
</head>
<body>
  <!-- Print / Save button -->
  <div class="no-print" style="text-align:right;padding:12px 24px 0">
    <button onclick="window.print()" style="padding:8px 16px;background:#7c3aed;color:white;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:500">
      Print / Save as PDF
    </button>
  </div>

  <div class="pdf-preview-container">
    <div class="pdf-viewport">
      <div class="pdf-page">
        <div class="pdf-content">

          <!-- MASTHEAD -->
          <div class="top-masthead">
            <div class="masthead-left">COMPLIANCE DOSSIER</div>
            <div class="masthead-right">
              <strong>Wealthfront (Pty) Ltd</strong> t/a Navigate Wealth &nbsp;|&nbsp; <strong>FSP 54606</strong><br/>
              Email: info@navigatewealth.co
            </div>
          </div>

          <!-- HEADER -->
          <header class="page-header-full">
            <div class="header-row">
              <div class="brand-block">
                <div class="logo">Navigate <span class="wealth">Wealth</span></div>
                <div class="brand-subline">Independent Financial Advisory Services</div>
              </div>
              <div class="doc-block">
                <h1 class="doc-title">Compliance Dossier</h1>
                <div class="meta-grid">
                  <div class="meta-k">Issue date</div>
                  <div class="meta-v">${issueDate}</div>
                  <div class="meta-k">Client</div>
                  <div class="meta-v">${clientName}</div>
                </div>
              </div>
            </div>
          </header>
          <hr class="section-divider" style="border-top:2px solid #6b7280;margin:4mm 0 6mm 0" />

          <!-- DOSSIER META -->
          <div class="dossier-meta">
            <div><span class="dk">Client:</span> <span class="dv">${clientName}</span></div>
            <div><span class="dk">Generated:</span> <span class="dv">${now}</span></div>
            <div><span class="dk">Total Check Types:</span> <span class="dv">${Object.keys(grouped).length}</span></div>
            <div><span class="dk">Total Check Runs:</span> <span class="dv">${allResults.length}</span></div>
          </div>

          <!-- SECTIONS -->
          ${sectionsHtml}

          <!-- ATTRIBUTION -->
          <div class="dossier-attribution">
            <p style="margin:0 0 1mm 0"><strong>Independent Third-Party Verification</strong></p>
            <p style="margin:0">All checks in this dossier were performed by <strong>Honeycomb Information Services (Pty) Ltd</strong>,
            an independent South African bureau service provider, via the <strong>Beeswax</strong> compliance platform.
            Navigate Wealth acts as a consumer of this data and does not independently verify the information contained herein.
            All results are subject to the accuracy and completeness of the data held by the originating bureau(s).</p>
          </div>

          <!-- ON-SCREEN FOOTER (hidden in print; running-footer takes over) -->
          <footer class="pdf-footer">
            <div class="footer-row">
              <div class="footer-page">Compliance Dossier</div>
              <div class="footer-text">
                Wealthfront (Pty) Ltd, trading as Navigate Wealth, is an Authorised Financial Services Provider \u2013 FSP 54606.
                Registration Number: 2024/071953/07. Located at Route 21 Corporate Park, 25 Sovereign Drive, Milestone Place A, Centurion, 0178.
                For inquiries, please contact us at Tel: (012) 667 2505.
              </div>
            </div>
          </footer>

        </div>
      </div>
    </div>
  </div>

  <!-- RUNNING FOOTER (print only \u2014 repeats on every printed page) -->
  <div class="running-footer">
    <div class="footer-row">
      <div class="footer-page">Compliance Dossier</div>
      <div class="footer-text">
        Wealthfront (Pty) Ltd, trading as Navigate Wealth, is an Authorised Financial Services Provider \u2013 FSP 54606.
        Registration Number: 2024/071953/07. Located at Route 21 Corporate Park, 25 Sovereign Drive, Milestone Place A, Centurion, 0178.
        For inquiries, please contact us at Tel: (012) 667 2505.
      </div>
    </div>
  </div>
</body>
</html>`;
}

// ─── Activity Detail Summary (inline in table) ──────────────────────────────

function ActivityDetailSummary({ activity }: { activity: ComplianceActivity }) {
  const d = activity.details;
  if (!d) return <span className="text-xs text-muted-foreground">—</span>;

  switch (activity.type) {
    case 'IDV Report':
    case 'IDV Report (Photo)':
      return (
        <span className="text-xs text-muted-foreground">
          {d.matterId ? `Matter: ${String(d.matterId).substring(0, 8)}...` : 'Check completed'}
        </span>
      );

    case 'Bulk IDV':
      return (
        <span className="text-xs text-muted-foreground">
          {d.totalProcessed != null
            ? `${d.totalProcessed} processed, ${d.totalMatched ?? 0} matched`
            : 'Batch completed'}
        </span>
      );

    case 'Bank Verification':
      return (
        <span className="text-xs text-muted-foreground">
          {d.bankName ? `${d.bankName} — ` : ''}
          {d.verified ? 'Verified' : 'Check completed'}
        </span>
      );

    case 'Consumer Credit Check':
      return (
        <span className="text-xs text-muted-foreground">
          {d.creditScore ? `Score: ${d.creditScore}` : 'Check completed'}
        </span>
      );

    case 'Consumer Trace':
      return <span className="text-xs text-muted-foreground">Trace completed</span>;

    case 'Debt Review Enquiry':
      return (
        <span className={`text-xs font-medium ${d.isUnderDebtReview ? 'text-red-600' : 'text-green-600'}`}>
          {d.isUnderDebtReview === true ? 'Under debt review' : d.isUnderDebtReview === false ? 'Not under review' : 'Check completed'}
        </span>
      );

    case 'Sanctions Search':
      return (
        <span className={`text-xs font-medium ${
          d.screeningOutcome === 'Clear' ? 'text-green-600' : 'text-red-600'
        }`}>
          {d.screeningOutcome || 'Completed'}
          {d.totalMatches != null && ` (${d.totalMatches} match${d.totalMatches !== 1 ? 'es' : ''})`}
        </span>
      );

    case 'Enforcement Actions Search':
    case 'Legal A Listing Search':
      return (
        <span className={`text-xs font-medium ${
          d.screeningOutcome === 'Clear' ? 'text-green-600' : 'text-amber-600'
        }`}>
          {d.screeningOutcome || 'Completed'}
          {d.totalMatches != null && ` (${d.totalMatches})`}
        </span>
      );

    case 'CIPC Search':
      return (
        <span className="text-xs text-muted-foreground">
          {d.companiesFound != null ? `${d.companiesFound} company(ies) found` : 'Search completed'}
        </span>
      );

    case 'Director Enquiry':
      return (
        <span className="text-xs text-muted-foreground">
          {d.directorshipsFound != null ? `${d.directorshipsFound} directorship(s)` : 'Enquiry completed'}
        </span>
      );

    case 'Best Known Address':
      return <span className="text-xs text-muted-foreground">Address lookup completed</span>;

    case 'CDD Report':
      return (
        <span className="text-xs text-muted-foreground">
          {d.matterId ? `Matter: ${String(d.matterId).substring(0, 8)}...` : 'CDD report completed'}
        </span>
      );

    case 'Custom Screening':
      return (
        <span className="text-xs text-muted-foreground">
          {d.screeningOutcome || 'Screening completed'}
        </span>
      );

    case 'Lifestyle Audit':
      return (
        <span className="text-xs text-muted-foreground">
          {d.lifestyleScore != null ? `Score: ${d.lifestyleScore}` : ''}
          {d.estimatedIncome != null ? ` Est. income: R${Number(d.estimatedIncome).toLocaleString()}` : ''}
          {!d.lifestyleScore && !d.estimatedIncome ? 'Audit completed' : ''}
        </span>
      );

    case 'Income Predictor':
      return (
        <span className="text-xs text-muted-foreground">
          {d.estimatedIncome != null
            ? `Est. R${Number(d.estimatedIncome).toLocaleString()}/mo`
            : 'Prediction completed'}
          {d.confidenceLevel ? ` (${d.confidenceLevel})` : ''}
        </span>
      );

    case 'Tenders Blue Search':
      return (
        <span className="text-xs text-muted-foreground">
          {d.tendersFound != null ? `${d.tendersFound} tender record(s)` : 'Search completed'}
        </span>
      );

    case 'Risk Assessment':
      if (d.screeningOutcome) {
        return <span className="text-xs"><strong>{d.screeningOutcome}</strong></span>;
      }
      if (d.riskLevel) {
        return (
          <span className={`font-semibold text-xs ${
            d.riskLevel === 'Low' ? 'text-green-600' :
            d.riskLevel === 'Medium' ? 'text-orange-600' : 'text-red-600'
          }`}>
            Risk: {d.riskLevel}
          </span>
        );
      }
      if (d.assessmentName) {
        return <span className="text-xs text-muted-foreground">{d.assessmentName}</span>;
      }
      return <span className="text-xs text-muted-foreground">Assessment completed</span>;

    case 'Client Registration':
      return (
        <span className="text-xs text-muted-foreground">
          {d.registeredAt
            ? `Registered at ${new Date(d.registeredAt).toLocaleString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })}`
            : 'Registered'}
        </span>
      );

    default:
      return <span className="text-xs text-muted-foreground">{d.matterId ? `Matter: ${String(d.matterId).substring(0, 8)}...` : '—'}</span>;
  }
}

// ─── Shared UI Components ───────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="bg-gray-50 p-2 rounded-lg">{icon}</div>
        <div>
          <div className="text-xl font-bold">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickActionCard({
  title,
  description,
  icon,
  onClick,
  disabled = false,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`text-left p-4 rounded-lg border transition-all ${
        disabled
          ? 'opacity-50 cursor-not-allowed bg-gray-50 border-gray-200'
          : 'bg-white border-gray-200 hover:border-purple-300 hover:shadow-sm cursor-pointer'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">{icon}<span className="font-medium text-sm">{title}</span></div>
      <p className="text-xs text-gray-500">{description}</p>
    </button>
  );
}