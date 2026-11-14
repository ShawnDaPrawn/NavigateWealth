/**
 * FULL CLIENT PROFILE VIEWER FOR ADMIN
 * Complete feature parity with client ProfilePage
 *
 * This component replicates ALL functionality from /components/pages/ProfilePage.tsx
 * including CRUD operations, validations, file uploads, risk assessment, and more.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '../../../../../ui/button';
import { Alert, AlertDescription, AlertTitle } from '../../../../../ui/alert';
import { formatCurrency } from '../../../../../../utils/currencyFormatter';
import {
  User,
  Mail,
  MapPin,
  Briefcase,
  Heart,
  Users,
  CreditCard,
  Shield,
  Target,
  Save,
  PieChart,
  Wallet,
  Loader2,
  AlertCircle,
  Plus,
} from 'lucide-react';
import { AddressSection } from '../../../../profile-sections/AddressSection';
import { EmploymentSection } from '../../../../profile-sections/EmploymentSection';
import { HealthSection } from '../../../../profile-sections/HealthSection';
import { FamilySection } from '../../../../profile-sections/FamilySection';
import { BankingSection } from '../../../../profile-sections/BankingSection';
import { RiskProfileSection } from '../../../../profile-sections/RiskProfileSection';
import { AssetsLiabilitiesSection } from '../../../../profile-sections/AssetsLiabilitiesSection';
import { BudgetingPage } from '../../../../../pages/BudgetingPage';
import { IdentitySection } from '../../../../profile-sections/IdentitySection';
import { Client, ProfileData } from '../../types';
import { useClientProfile } from './clientProfileHook';
import { copyToClipboard } from '../../../../../../utils/clipboard';
import { api } from '../../../../../../utils/api';
import {
  UnsavedChangesDialog,
  useUnsavedChangesGuard,
  useUnsavedChangesRegistry,
} from '../../../../../shared/unsaved-changes';
import {
  derivePolicyAssetsFromPolicies,
  type DerivedPolicyAsset,
  type PolicyAssetSourceRecord,
} from '../../../../../../utils/derivedPolicyAssets';

import { ClientProfilePersonalCard } from './ClientProfilePersonalCard';
import { ProfileSectionView } from './ProfileSectionView';
import {
  addressGroups,
  assetsView,
  bankingTable,
  contactGroups,
  employmentView,
  familyTable,
  healthView,
  kycTable,
  personalGroups,
} from './profileSectionRows';
import { useUrlState } from '../../../../layout/page';
import { useClientSubCrumbs } from '../../../../layout/page';

const PROFILE_SECTIONS = [
  'personal',
  'contact',
  'kyc',
  'address',
  'employment',
  'health',
  'family',
  'banking',
  'risk',
  'assets',
  'budgeting',
] as const;
type ProfileSection = (typeof PROFILE_SECTIONS)[number];
/** Sections whose card has a view mode and an Edit button. */
const VIEW_EDIT_SECTIONS: ReadonlySet<ProfileSection> = new Set([
  'personal',
  'contact',
  'kyc',
  'address',
  'employment',
  'health',
  'family',
  'banking',
  'assets',
]);
import { ClientProfileContactCard } from './ClientProfileContactCard';

interface ClientProfileViewerFullProps {
  clientData: Client;
  onSave?: (data: ProfileData) => void;
}

const ADMIN_CLIENT_PROFILE_REGISTRY_ID = 'admin-client-profile';

export function ClientProfileViewerFull({ clientData, onSave }: ClientProfileViewerFullProps) {
  // The open section is in the address (?psec=).
  const [activeSection, setActiveSection] = useUrlState<ProfileSection>(
    'psec',
    'personal',
    PROFILE_SECTIONS,
  );
  const [editing, setEditing] = useState(false);
  const { state, actions } = useClientProfile(clientData, onSave);
  // The profile-section child components declare looser prop contracts
  // (profileData: Record<string, unknown>; handleInputChange: (field: string,
  // value: string | number | boolean) => void) than the strongly-typed hook
  // state/actions. Adapt at this single call boundary rather than weakening the
  // hook's types.
  const profileDataLoose = state.profileData as unknown as Record<string, unknown>;
  const handleInputChangeLoose = actions.handleInputChange as unknown as (
    field: string,
    value: unknown,
  ) => void;
  const registry = useUnsavedChangesRegistry();

  const unsavedChangesGuard = useUnsavedChangesGuard({
    isDirty: state.hasChanges,
    onSave: actions.handleSave,
    onDiscard: actions.handleDiscard,
    message:
      'You have unsaved changes to this client profile. Would you like to save before leaving?',
  });

  useEffect(() => {
    registry.register({
      id: ADMIN_CLIENT_PROFILE_REGISTRY_ID,
      isDirty: state.hasChanges,
      tryAction: unsavedChangesGuard.tryAction,
    });
    return () => registry.unregister(ADMIN_CLIENT_PROFILE_REGISTRY_ID);
  }, [registry, state.hasChanges, unsavedChangesGuard.tryAction]);

  const handleSectionChange = useCallback(
    (sectionId: string) => {
      if (sectionId === activeSection) return;
      unsavedChangesGuard.tryAction(() => {
        setEditing(false);
        setActiveSection(sectionId as ProfileSection);
      });
    },
    [activeSection, unsavedChangesGuard, setActiveSection],
  );
  const [policyRecords, setPolicyRecords] = useState<PolicyAssetSourceRecord[]>([]);
  const [policyAssetsLoading, setPolicyAssetsLoading] = useState(false);
  const [policyAssetsError, setPolicyAssetsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPolicyAssets() {
      setPolicyAssetsLoading(true);
      setPolicyAssetsError(null);

      try {
        const response = await api.get<{ policies?: PolicyAssetSourceRecord[] }>(
          `/integrations/policies?clientId=${encodeURIComponent(clientData.id)}`,
        );

        if (!cancelled) {
          setPolicyRecords(Array.isArray(response.policies) ? response.policies : []);
        }
      } catch (_error) {
        if (!cancelled) {
          setPolicyRecords([]);
          setPolicyAssetsError('Linked policy assets could not be loaded right now.');
        }
      } finally {
        if (!cancelled) {
          setPolicyAssetsLoading(false);
        }
      }
    }

    void loadPolicyAssets();

    return () => {
      cancelled = true;
    };
  }, [clientData.id]);

  const derivedPolicyAssets = useMemo<DerivedPolicyAsset[]>(
    () => derivePolicyAssetsFromPolicies(policyRecords),
    [policyRecords],
  );

  const sections = [
    { id: 'personal', label: 'Personal info', icon: User },
    { id: 'contact', label: 'Contact details', icon: Mail },
    { id: 'kyc', label: 'KYC', icon: Shield },
    { id: 'address', label: 'Address', icon: MapPin },
    { id: 'employment', label: 'Employment', icon: Briefcase },
    { id: 'health', label: 'Health info', icon: Heart },
    { id: 'family', label: 'Family', icon: Users },
    { id: 'banking', label: 'Banking', icon: CreditCard },
    { id: 'risk', label: 'Risk profile', icon: Target },
    { id: 'assets', label: 'Assets & liabilities', icon: PieChart },
    { id: 'budgeting', label: 'Budgeting', icon: Wallet },
  ];
  const activeLabel = sections.find((x) => x.id === activeSection)?.label ?? '';
  useClientSubCrumbs(activeLabel ? [{ label: activeLabel }] : []);
  const viewOnly = VIEW_EDIT_SECTIONS.has(activeSection) && !editing && !state.hasChanges;

  // Edit (or an Add button) swaps the view card for the section's form; an
  // Add also starts the new row there.
  const startEditing = (add?: () => void) => {
    setEditing(true);
    if (typeof add === 'function') add();
  };

  const handleSaveAll = async () => {
    if (await actions.handleSave()) setEditing(false);
  };
  const handleCancelAll = () => {
    actions.handleDiscard();
    setEditing(false);
  };

  // Show loading state while fetching data
  if (state.loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#6d28d9] mb-3" />
          <p className="text-sm text-gray-600">Loading client profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
      {/* Section rail */}
      <nav aria-label="Personal details sections" className="lg:sticky lg:top-4 lg:self-start">
        <ul className="flex gap-1 overflow-x-auto lg:flex-col">
          {sections.map((section) => {
            const Icon = section.icon;
            const active = activeSection === section.id;
            return (
              <li key={section.id}>
                <button
                  type="button"
                  onClick={() => handleSectionChange(section.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex w-full items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nw-violet/60 ${
                    active
                      ? 'bg-nw-violet-50 font-medium text-nw-violet-600'
                      : 'text-nw-text-2 hover:bg-gray-50 hover:text-nw-ink'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {section.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="flex min-w-0 flex-col gap-4">
        {state.error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}

        <div className="min-w-0">
          {viewOnly && activeSection === 'personal' && (
            <ProfileSectionView
              title="Personal info"
              groups={personalGroups(state.profileData)}
              onEdit={() => setEditing(true)}
            />
          )}
          {viewOnly && activeSection === 'contact' && (
            <ProfileSectionView
              title="Contact details"
              groups={contactGroups(state.profileData)}
              onEdit={() => setEditing(true)}
            />
          )}
          {/* Personal Information Section */}
          {viewOnly && activeSection === 'kyc' && (
            <ProfileSectionView
              title="KYC documents"
              tables={[kycTable(state.profileData)]}
              onEdit={startEditing}
              actions={
                <Button size="sm" onClick={() => startEditing()}>
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  Add document
                </Button>
              }
            />
          )}
          {viewOnly && activeSection === 'address' && (
            <ProfileSectionView
              title="Address"
              groups={addressGroups(state.profileData)}
              onEdit={startEditing}
            />
          )}
          {viewOnly && activeSection === 'employment' && (
            <ProfileSectionView
              title="Employment information"
              {...employmentView(state.profileData)}
              onEdit={startEditing}
              actions={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => startEditing(actions.addEmployer)}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  Add employer
                </Button>
              }
            />
          )}
          {viewOnly && activeSection === 'health' && (
            <ProfileSectionView
              title="Health information"
              {...healthView(state.profileData)}
              onEdit={startEditing}
              actions={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => startEditing(actions.addChronicCondition)}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  Add condition
                </Button>
              }
            />
          )}
          {viewOnly && activeSection === 'family' && (
            <ProfileSectionView
              title="Family members"
              tables={[familyTable(state.profileData)]}
              onEdit={startEditing}
              actions={
                <Button size="sm" onClick={() => startEditing(actions.addFamilyMember)}>
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  Add family member
                </Button>
              }
            />
          )}
          {viewOnly && activeSection === 'banking' && (
            <ProfileSectionView
              title="Banking details"
              tables={[bankingTable(state.profileData)]}
              onEdit={startEditing}
              actions={
                <Button size="sm" onClick={() => startEditing(actions.addBankAccount)}>
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  Add bank account
                </Button>
              }
            />
          )}
          {viewOnly && activeSection === 'assets' && (
            <ProfileSectionView
              title="Assets & liabilities"
              {...assetsView(state.profileData)}
              onEdit={startEditing}
            />
          )}
          {activeSection === 'personal' && !viewOnly && (
            <ClientProfilePersonalCard state={state} actions={actions} />
          )}

          {/* Contact Details Section */}
          {activeSection === 'contact' && !viewOnly && (
            <ClientProfileContactCard state={state} actions={actions} />
          )}

          {/* KYC Section */}
          {activeSection === 'kyc' && !viewOnly && (
            <IdentitySection
              profileData={profileDataLoose}
              identityDocsInEditMode={state.identityDocsInEditMode}
              hasDocumentType={actions.hasDocumentType}
              addIdentityDocument={actions.addIdentityDocument}
              handleDocumentUpload={actions.handleDocumentUpload}
              updateIdentityDocument={actions.updateIdentityDocument}
              confirmDeleteIdentityDocument={actions.confirmDeleteIdentityDocument}
              removeIdentityDocument={actions.removeIdentityDocument}
              saveIdentityDocument={actions.saveIdentityDocument}
              cancelEditIdentityDocument={actions.cancelEditIdentityDocument}
              editIdentityDocument={actions.editIdentityDocument}
              getDocumentTypeLabel={actions.getDocumentTypeLabel}
              getDocumentTypeIcon={actions.getDocumentTypeIcon}
              identityDocToDelete={state.identityDocToDelete}
              setIdentityDocToDelete={actions.setIdentityDocToDelete}
              userId={clientData.id}
            />
          )}

          {/* Address Section */}
          {activeSection === 'address' && !viewOnly && (
            <AddressSection
              profileData={profileDataLoose}
              handleInputChange={handleInputChangeLoose}
              proofOfResidenceInEditMode={state.proofOfResidenceInEditMode}
              handleProofOfResidenceUpload={actions.handleProofOfResidenceUpload}
              saveProofOfResidence={actions.saveProofOfResidence}
              editProofOfResidence={actions.editProofOfResidence}
              confirmDeleteProofOfResidence={actions.confirmDeleteProofOfResidence}
              removeProofOfResidence={actions.removeProofOfResidence}
              proofOfResidenceToDelete={state.proofOfResidenceToDelete}
              setProofOfResidenceToDelete={actions.setProofOfResidenceToDelete}
              copyToClipboard={(text: string, _fieldName: string) => copyToClipboard(text)}
            />
          )}

          {/* Employment Section */}
          {activeSection === 'employment' && !viewOnly && (
            <EmploymentSection
              profileData={profileDataLoose}
              handleInputChange={handleInputChangeLoose}
              employersInEditMode={state.employersInEditMode}
              selfEmployedInEditMode={state.selfEmployedInEditMode}
              addEmployer={actions.addEmployer}
              updateEmployer={actions.updateEmployer}
              saveEmployer={actions.saveEmployer}
              editEmployer={actions.editEmployer}
              cancelEditEmployer={actions.cancelEditEmployer}
              confirmDeleteEmployer={actions.confirmDeleteEmployer}
              removeEmployer={actions.removeEmployer}
              saveSelfEmployed={actions.saveSelfEmployed}
              editSelfEmployed={actions.editSelfEmployed}
              cancelEditSelfEmployed={actions.cancelEditSelfEmployed}
              employerToDelete={state.employerToDelete}
              setEmployerToDelete={actions.setEmployerToDelete}
              copyToClipboard={(text: string, _fieldName: string) => copyToClipboard(text)}
            />
          )}

          {/* Health Section */}
          {activeSection === 'health' && !viewOnly && (
            <HealthSection
              profileData={profileDataLoose}
              handleInputChange={handleInputChangeLoose}
              chronicConditionsInEditMode={state.chronicConditionsInEditMode}
              addChronicCondition={actions.addChronicCondition}
              updateChronicCondition={actions.updateChronicCondition}
              saveChronicCondition={actions.saveChronicCondition}
              editChronicCondition={actions.editChronicCondition}
              cancelEditChronicCondition={actions.cancelEditChronicCondition}
              confirmDeleteChronicCondition={actions.confirmDeleteChronicCondition}
              removeChronicCondition={actions.removeChronicCondition}
              chronicConditionToDelete={state.chronicConditionToDelete}
              setChronicConditionToDelete={actions.setChronicConditionToDelete}
            />
          )}

          {/* Family Section */}
          {activeSection === 'family' && !viewOnly && (
            <FamilySection
              profileData={profileDataLoose}
              familyMembersInEditMode={state.familyMembersInEditMode}
              addFamilyMember={actions.addFamilyMember}
              updateFamilyMember={actions.updateFamilyMember}
              saveFamilyMember={actions.saveFamilyMember}
              editFamilyMember={actions.editFamilyMember}
              cancelEditFamilyMember={actions.cancelEditFamilyMember}
              confirmDeleteFamilyMember={actions.confirmDeleteFamilyMember}
              removeFamilyMember={actions.removeFamilyMember}
              familyMemberToDelete={state.familyMemberToDelete}
              setFamilyMemberToDelete={actions.setFamilyMemberToDelete}
            />
          )}

          {/* Banking Section */}
          {activeSection === 'banking' && !viewOnly && (
            <BankingSection
              profileData={profileDataLoose}
              bankAccountsInEditMode={state.bankAccountsInEditMode}
              addBankAccount={actions.addBankAccount}
              updateBankAccount={actions.updateBankAccount}
              saveBankAccount={actions.saveBankAccount}
              editBankAccount={actions.editBankAccount}
              cancelEditBankAccount={actions.cancelEditBankAccount}
              confirmDeleteBankAccount={actions.confirmDeleteBankAccount}
              removeBankAccount={actions.removeBankAccount}
              handleProofOfBankUpload={actions.handleProofOfBankUpload}
              confirmDeleteProofOfBank={actions.confirmDeleteProofOfBank}
              removeProofOfBank={actions.removeProofOfBank}
              bankAccountToDelete={state.bankAccountToDelete}
              setBankAccountToDelete={actions.setBankAccountToDelete}
              proofOfBankToDelete={state.proofOfBankToDelete}
              setProofOfBankToDelete={actions.setProofOfBankToDelete}
              copyToClipboard={(text: string, _fieldName: string) => copyToClipboard(text)}
            />
          )}

          {/* Risk Profile Section */}
          {activeSection === 'risk' && (
            <RiskProfileSection
              profileData={state.profileData}
              updateRiskQuestion={actions.updateRiskQuestion}
              resetRiskAssessment={actions.resetRiskAssessment}
              assessmentStarted={state.assessmentStarted}
              setAssessmentStarted={actions.setAssessmentStarted}
              allQuestionsAnswered={actions.allQuestionsAnswered}
            />
          )}

          {/* Assets & Liabilities Section */}
          {activeSection === 'assets' && !viewOnly && (
            <AssetsLiabilitiesSection
              assets={state.profileData.assets || []}
              liabilities={state.profileData.liabilities || []}
              derivedPolicyAssets={derivedPolicyAssets}
              linkedPolicyAssetsLoading={policyAssetsLoading}
              linkedPolicyAssetsError={policyAssetsError}
              assetsInEditMode={state.assetsInEditMode}
              liabilitiesInEditMode={state.liabilitiesInEditMode}
              addAsset={actions.addAsset}
              updateAsset={actions.updateAsset}
              saveAsset={actions.saveAsset}
              editAsset={actions.editAsset}
              cancelEditAsset={actions.cancelEditAsset}
              confirmDeleteAsset={actions.confirmDeleteAsset}
              removeAsset={actions.removeAsset}
              addLiability={actions.addLiability}
              updateLiability={actions.updateLiability}
              saveLiability={actions.saveLiability}
              editLiability={actions.editLiability}
              cancelEditLiability={actions.cancelEditLiability}
              confirmDeleteLiability={actions.confirmDeleteLiability}
              removeLiability={actions.removeLiability}
              assetToDelete={state.assetToDelete}
              setAssetToDelete={actions.setAssetToDelete}
              liabilityToDelete={state.liabilityToDelete}
              setLiabilityToDelete={actions.setLiabilityToDelete}
              formatCurrency={formatCurrency}
            />
          )}

          {/* Budgeting Section - Reusing the BudgetingPage component */}
          {activeSection === 'budgeting' && (
            <div className="h-full">
              <BudgetingPage
                userId={clientData.id}
                embedded={true}
                onEmptyStateAction={() => handleSectionChange('personal')}
                incomeValidationError={state.incomeValidationError}
                setIncomeValidationError={
                  actions.setIncomeValidationError as (error: string | null) => void
                }
                profileData={profileDataLoose}
                handleInputChange={handleInputChangeLoose}
              />
            </div>
          )}
        </div>

        {(state.hasChanges || (editing && VIEW_EDIT_SECTIONS.has(activeSection))) && (
          <div
            className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-nw-line bg-white px-5 py-3 shadow-sm"
            role="region"
            aria-label="Unsaved changes"
          >
            <span className="flex items-center gap-2 text-sm text-nw-text-2">
              {state.hasChanges && (
                <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" />
              )}
              {state.hasChanges ? 'You have unsaved changes' : 'Editing'}
            </span>
            <div className="ml-auto flex gap-2">
              <Button variant="outline" onClick={handleCancelAll} disabled={state.saving}>
                Cancel
              </Button>
              <Button
                onClick={() => void handleSaveAll()}
                disabled={state.saving || !state.hasChanges}
              >
                {state.saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Save className="h-4 w-4" aria-hidden="true" />
                )}
                {state.saving ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </div>
        )}
      </div>
      <UnsavedChangesDialog {...unsavedChangesGuard.dialogProps} />
    </div>
  );
}
