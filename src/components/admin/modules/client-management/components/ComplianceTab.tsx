import React, { useState, useEffect, useCallback } from 'react';
import { useUrlState } from '../../../layout/page';
import { useClientSubCrumbs } from './crumbsContext';
import { useQueryClient } from '@tanstack/react-query';
import {
  Shield,
  UserCheck,
  Loader2,
  History,
  Landmark,
  Search,
  ClipboardList,
  Building2,
  MapPin,
  FileCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../../../../utils/api';

import { Client } from '../types';
import { getClientProfileQueryOptions } from '../api';
import { RiskAssessmentPanel } from './RiskAssessmentPanel';
import { IdentityVerificationPanel } from './compliance/IdentityVerificationPanel';
import { FinancialIntelligencePanel } from './compliance/FinancialIntelligencePanel';
import { SanctionsScreeningPanel } from './compliance/SanctionsScreeningPanel';
import { CorporateGovernancePanel } from './compliance/CorporateGovernancePanel';
import { AddressReportsPanel } from './compliance/AddressReportsPanel';
import { CDDPanel } from './compliance/CDDPanel';
import { OverviewContent } from './compliance/OverviewContent';
import { ActivityLogContent } from './compliance/ActivityLogContent';
import { ComplianceRegistrationGate } from './compliance/ComplianceRegistrationGate';
import { ComplianceActivity, ComplianceSubTab } from './compliance/complianceTypes';

interface ComplianceTabProps {
  selectedClient: Client;
  sanctionsScreeningRunning: boolean;
  onRunSanctionsScreening: () => void;
  lastSanctionsCheck: string;
}

const SUB_TABS: {
  id: ComplianceSubTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'overview', label: 'Overview', icon: Shield },
  { id: 'identity-verification', label: 'Identity verification', icon: UserCheck },
  { id: 'cdd', label: 'CDD', icon: FileCheck },
  { id: 'financial-intelligence', label: 'Financial intelligence', icon: Landmark },
  { id: 'corporate-governance', label: 'Corporate & governance', icon: Building2 },
  { id: 'screening-sanctions', label: 'Screening & sanctions', icon: Search },
  { id: 'address-reports', label: 'Address', icon: MapPin },
  { id: 'risk-assessment', label: 'Risk assessment', icon: ClipboardList },
  { id: 'activity-log', label: 'Reports', icon: History },
];
const COMPLIANCE_SECTIONS = SUB_TABS.map((t) => t.id);
/** Rail groups (design: CM 12 — Overview, then Checks, then Outcome). */
const RAIL_GROUPS: { title?: string; ids: ComplianceSubTab[] }[] = [
  { ids: ['overview'] },
  {
    title: 'Checks',
    ids: [
      'identity-verification',
      'cdd',
      'financial-intelligence',
      'corporate-governance',
      'screening-sanctions',
      'address-reports',
    ],
  },
  { title: 'Outcome', ids: ['risk-assessment', 'activity-log'] },
];

const isValidIdNumber = (val: unknown): val is string =>
  typeof val === 'string' &&
  val.trim().length > 0 &&
  !['not provided', 'n/a', 'undefined', 'null', 'none', '-'].includes(val.trim().toLowerCase());

export function ComplianceTab({ selectedClient }: ComplianceTabProps) {
  const queryClient = useQueryClient();
  const [registrationStatus, setRegistrationStatus] = useState<
    'loading' | 'registered' | 'unregistered'
  >('loading');
  const [isRegistering, setIsRegistering] = useState(false);
  const [honeycombId, setHoneycombId] = useState<string | null>(null);

  const [activities, setActivities] = useState<ComplianceActivity[]>([]);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);

  const [kvProfileIdNumber, setKvProfileIdNumber] = useState<string | null>(null);
  const [kvProfilePassport, setKvProfilePassport] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // The open section is in the address (?ksec=).
  const [activeSubTab, setActiveSubTab] = useUrlState<ComplianceSubTab>(
    'ksec',
    'overview',
    COMPLIANCE_SECTIONS,
  );
  const sectionLabel = SUB_TABS.find((t) => t.id === activeSubTab)?.label ?? '';
  useClientSubCrumbs(sectionLabel ? [{ label: sectionLabel }] : []);

  useEffect(() => {
    const loadProfileForCompliance = async () => {
      setProfileLoading(true);
      try {
        const profile = await queryClient.fetchQuery(
          getClientProfileQueryOptions(selectedClient.id),
        );
        if (profile) {
          setKvProfileIdNumber(isValidIdNumber(profile.idNumber) ? profile.idNumber : null);
          setKvProfilePassport(
            isValidIdNumber(profile.passportNumber) ? profile.passportNumber : null,
          );
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
  }, [selectedClient.id, queryClient]);

  const resolvedIdNumber =
    [
      kvProfileIdNumber,
      selectedClient.profile?.personalInformation?.idNumber,
      (selectedClient.profile as Record<string, unknown>)?.profile_id_number,
      selectedClient.idNumber,
      (selectedClient as unknown as Record<string, unknown>).profile_id_number,
    ].find(isValidIdNumber) || null;

  const resolvedPassport =
    [
      kvProfilePassport,
      selectedClient.profile?.personalInformation?.passportNumber,
      (selectedClient.profile as Record<string, unknown>)?.passportNumber,
    ].find(isValidIdNumber) || null;

  const hasIdentification = !!resolvedIdNumber || !!resolvedPassport;

  const checkRegistration = useCallback(async () => {
    try {
      setRegistrationStatus('loading');
      const data = await api.get<{ registered?: boolean; honeycombId?: string }>(
        `/integrations/honeycomb/status/${selectedClient.id}`,
      );
      if (data.registered) {
        setRegistrationStatus('registered');
        setHoneycombId(data.honeycombId ?? null);
      } else {
        setRegistrationStatus('unregistered');
      }
    } catch (error) {
      console.error('Error checking registration:', error);
      setRegistrationStatus('unregistered');
    }
  }, [selectedClient.id]);

  const fetchActivityLog = useCallback(async () => {
    try {
      setIsLoadingActivity(true);
      const data = await api.get<{ activity?: ComplianceActivity[] }>(
        `/integrations/honeycomb/activity/${selectedClient.id}`,
      );
      setActivities(data.activity || []);
    } catch (error) {
      console.error('Error fetching activity:', error);
    } finally {
      setIsLoadingActivity(false);
    }
  }, [selectedClient.id]);

  useEffect(() => {
    checkRegistration();
  }, [selectedClient.id, checkRegistration]);

  useEffect(() => {
    if (registrationStatus === 'registered') {
      fetchActivityLog();
    }
  }, [registrationStatus, selectedClient.id, fetchActivityLog]);

  const handleRegister = async () => {
    setIsRegistering(true);
    const toastId = toast.loading('Registering client with Honeycomb/Beeswax...');

    try {
      const data = await api.post<{ honeycombId?: string }>(
        `/integrations/honeycomb/register-client`,
        {
          clientId: selectedClient.id,
          firstName: selectedClient.firstName,
          lastName: selectedClient.lastName,
          idNumber: resolvedIdNumber,
          passport: resolvedPassport,
          email: selectedClient.email,
        },
      );

      toast.success('Client registered successfully!', { id: toastId });
      setHoneycombId(data.honeycombId ?? null);
      setRegistrationStatus('registered');
    } catch (error: unknown) {
      console.error('Registration error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to register client', {
        id: toastId,
      });
    } finally {
      setIsRegistering(false);
    }
  };

  if (registrationStatus === 'loading' || profileLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (registrationStatus === 'unregistered') {
    return (
      <ComplianceRegistrationGate
        clientFirstName={selectedClient.firstName}
        clientLastName={selectedClient.lastName}
        resolvedIdNumber={resolvedIdNumber}
        hasIdentification={hasIdentification}
        isRegistering={isRegistering}
        onRegister={handleRegister}
      />
    );
  }

  // ─── Registered State (Sub-tab Navigation) ────────────────────────────

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <nav aria-label="Compliance sections" className="lg:sticky lg:top-4 lg:self-start">
        {RAIL_GROUPS.map((group, gi) => (
          <div key={gi}>
            {group.title && (
              <p className="mb-1 mt-4 hidden px-3 text-xs font-medium text-nw-text-3 lg:block">
                {group.title}
              </p>
            )}
            <ul className="flex gap-1 overflow-x-auto lg:flex-col">
              {group.ids.map((id) => {
                const tab = SUB_TABS.find((t) => t.id === id)!;
                const Icon = tab.icon;
                const active = activeSubTab === id;
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => setActiveSubTab(id)}
                      aria-current={active ? 'page' : undefined}
                      className={`flex w-full items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nw-violet/60 ${
                        active
                          ? 'bg-nw-violet-50 font-medium text-nw-violet-600'
                          : 'text-nw-text-2 hover:bg-gray-50 hover:text-nw-ink'
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {tab.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        <p className="mt-4 hidden px-3 text-xs text-nw-text-3 lg:block">
          Beeswax ID{' '}
          <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono">{honeycombId}</span>
        </p>
      </nav>

      <div className="min-w-0 space-y-4">
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
    </div>
  );
}
