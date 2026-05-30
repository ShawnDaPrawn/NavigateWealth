import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { BudgetingPage } from './BudgetingPage';

// Profile hook (Guidelines §6 — all state and handlers in a single hook)
import { useProfileManager } from './profile/hooks/useProfileManager';
import { usePortfolioSummary } from './portfolio/hooks';
import { derivePolicyAssetsFromProductHoldings } from '../../utils/derivedPolicyAssets';

// Section components (Guidelines §4.1 — decomposed presentation)
import {
  PersonalInfoSection,
  ContactDetailsSection,
  IdentitySection,
  AddressSection,
  EmploymentSection,
  HealthSection,
  FamilySection,
  BankingSection,
  AssetsLiabilitiesSection,
  RiskProfileSection,
} from './profile/sections';

// UI primitives — only those needed for the page shell
import { Button } from '../ui/button';
import { BrandPageLoader } from '../ui/brand-loader';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { UnsavedChangesDialog, useUnsavedChangesGuard } from '../shared/unsaved-changes';

// Icons — only those used in the page shell (nav, header, loading)
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
  CheckCircle,
  PieChart,
  Activity,
  Wallet,
  AlertTriangle,
} from 'lucide-react';
import { PortalPageHeader } from '../portal/PortalPageHeader';
import { ACTIVE_THEME } from '../portal/portal-theme';

// ============================================================================
// Navigation config
// ============================================================================

const NAV_ITEMS = [
  { id: 'personal', label: 'Personal Info', icon: User },
  { id: 'contact', label: 'Contact Details', icon: Mail },
  { id: 'identity', label: 'Identity', icon: Shield },
  { id: 'address', label: 'Address', icon: MapPin },
  { id: 'employment', label: 'Employment', icon: Briefcase },
  { id: 'health', label: 'Health Info', icon: Heart },
  { id: 'family', label: 'Family', icon: Users },
  { id: 'banking', label: 'Banking', icon: CreditCard },
  { id: 'risk', label: 'Risk Profile', icon: Target },
  { id: 'assets', label: 'Assets & Liabilities', icon: PieChart },
  { id: 'budgeting', label: 'Budgeting', icon: Wallet },
] as const;

// ============================================================================
// Component
// ============================================================================

export function ProfilePage() {
  const { user, updateUser } = useAuth();
  const location = useLocation();
  const [activeSection, setActiveSection] = useState('personal');

  // All profile state and handlers via custom hook (Guidelines §6)
  const pm = useProfileManager({
    userEmail: user?.email,
    userFirstName: user?.firstName,
    userLastName: user?.lastName,
    updateUser,
  });
  const portfolioSummaryQuery = usePortfolioSummary(user?.id);
  const linkedPolicyAssets = useMemo(
    () => derivePolicyAssetsFromProductHoldings(portfolioSummaryQuery.data?.productHoldings || []),
    [portfolioSummaryQuery.data?.productHoldings],
  );
  const linkedPolicyAssetsError = portfolioSummaryQuery.error instanceof Error
    ? portfolioSummaryQuery.error.message
    : null;

  // Handle URL parameters to open specific tab
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab) {
      setActiveSection(tab);
    }
  }, [location]);

  const unsavedChangesGuard = useUnsavedChangesGuard({
    isDirty: pm.isDirty,
    onSave: pm.handleSave,
    onDiscard: pm.handleDiscard,
    message: 'You have unsaved changes to your profile. Would you like to save before leaving?',
  });

  const handleSectionChange = useCallback(
    (sectionId: string) => {
      if (sectionId === activeSection) return;
      unsavedChangesGuard.tryAction(() => setActiveSection(sectionId));
    },
    [activeSection, unsavedChangesGuard],
  );

  // ========================================================================
  // Render
  // ========================================================================

  if (pm.initialLoading) {
    return (
      <BrandPageLoader
        title="Loading your profile"
        message="Fetching your personal details, policy links, and preferences."
      />
    );
  }

  return (
    <div className={`min-h-screen ${ACTIVE_THEME === 'branded' ? 'bg-[#f8f9fb]' : 'bg-[rgb(249,249,249)]'}`}>
      <PortalPageHeader
        title="My Profile"
        subtitle="Manage your personal information and preferences"
        icon={User}
        compact
        actions={
          <div className="flex items-center gap-3">
            {pm.isDirty && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg border border-amber-200 text-xs font-medium">
                <AlertTriangle className="h-3.5 w-3.5" />
                Unsaved changes
              </div>
            )}
            {pm.saveSuccess && (
              <div className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg border border-green-200 animate-in fade-in slide-in-from-top-2 duration-300">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm">Saved successfully</span>
              </div>
            )}
            <Button onClick={pm.handleSave} disabled={pm.isLoading} className="bg-[#6d28d9] hover:bg-[#5b21b6] text-white">
              {pm.isLoading ? (
                <div className="contents"><Activity className="h-4 w-4 mr-2 animate-spin" />Saving...</div>
              ) : (
                <div className="contents"><Save className="h-4 w-4 mr-2" />Save Changes</div>
              )}
            </Button>
          </div>
        }
      />
      <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 py-6 lg:py-8">

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <Card className="sticky top-6 hidden lg:block">
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Quick Navigation</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <nav className="space-y-1">
                  {NAV_ITEMS.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleSectionChange(item.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                          activeSection === item.id
                            ? 'bg-[#6d28d9]/10 text-[#6d28d9] border-r-2 border-[#6d28d9]'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="text-[13px]">{item.label}</span>
                      </button>
                    );
                  })}
                </nav>
              </CardContent>
            </Card>

            {/* Mobile Navigation */}
            <div className="lg:hidden mb-4">
              <Select value={activeSection} onValueChange={handleSectionChange}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select section" /></SelectTrigger>
                <SelectContent>
                  {NAV_ITEMS.map((item) => (
                    <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Main Content — Decomposed Sections */}
          <div className="lg:col-span-3 space-y-6">
            {activeSection === 'personal' && (
              <PersonalInfoSection
                profileData={pm.profileData}
                handleInputChange={pm.handleInputChange}
                grossIncomeDisplay={pm.grossIncomeDisplay}
                setGrossIncomeDisplay={pm.setGrossIncomeDisplay}
                netIncomeDisplay={pm.netIncomeDisplay}
                setNetIncomeDisplay={pm.setNetIncomeDisplay}
                grossAnnualIncomeDisplay={pm.grossAnnualIncomeDisplay}
                setGrossAnnualIncomeDisplay={pm.setGrossAnnualIncomeDisplay}
                netAnnualIncomeDisplay={pm.netAnnualIncomeDisplay}
                setNetAnnualIncomeDisplay={pm.setNetAnnualIncomeDisplay}
                incomeValidationError={pm.incomeValidationError}
                setIncomeValidationError={pm.setIncomeValidationError}
                setProfileData={pm.setProfileData}
                setSaveSuccess={pm.setSaveSuccess}
              />
            )}

            {activeSection === 'contact' && (
              <ContactDetailsSection profileData={pm.profileData} handleInputChange={pm.handleInputChange} />
            )}

            {activeSection === 'identity' && (
              <IdentitySection
                profileData={pm.profileData}
                identityDocsInEditMode={pm.identityDocsInEditMode}
                identityDocToDelete={pm.identityDocToDelete}
                setIdentityDocToDelete={pm.setIdentityDocToDelete}
                hasDocumentType={pm.hasDocumentType}
                addIdentityDocument={pm.addIdentityDocument}
                updateIdentityDocument={pm.updateIdentityDocument}
                saveIdentityDocument={pm.saveIdentityDocument}
                editIdentityDocument={pm.editIdentityDocument}
                cancelEditIdentityDocument={pm.cancelEditIdentityDocument}
                confirmDeleteIdentityDocument={pm.confirmDeleteIdentityDocument}
                removeIdentityDocument={pm.removeIdentityDocument}
                handleDocumentUpload={pm.handleDocumentUpload}
                getDocumentTypeLabel={pm.getDocumentTypeLabel}
                getDocumentTypeIcon={pm.getDocumentTypeIcon as unknown as (type: 'passport' | 'national-id' | 'drivers-license') => { icon: React.ComponentType<{ className?: string }>; color: string }}
              />
            )}

            {activeSection === 'address' && (
              <AddressSection
                profileData={pm.profileData}
                handleInputChange={pm.handleInputChange}
                proofOfResidenceInEditMode={pm.proofOfResidenceInEditMode}
                proofOfResidenceToDelete={pm.proofOfResidenceToDelete}
                setProofOfResidenceToDelete={pm.setProofOfResidenceToDelete}
                handleProofOfResidenceUpload={pm.handleProofOfResidenceUpload}
                editProofOfResidence={pm.editProofOfResidence}
                saveProofOfResidence={pm.saveProofOfResidence}
                confirmDeleteProofOfResidence={pm.confirmDeleteProofOfResidence}
                removeProofOfResidence={pm.removeProofOfResidence}
              />
            )}

            {activeSection === 'employment' && (
              <EmploymentSection
                profileData={pm.profileData}
                handleInputChange={pm.handleInputChange}
                employersInEditMode={pm.employersInEditMode}
                employerToDelete={pm.employerToDelete}
                setEmployerToDelete={pm.setEmployerToDelete}
                addEmployer={pm.addEmployer}
                updateEmployer={pm.updateEmployer}
                saveEmployer={pm.saveEmployer}
                editEmployer={pm.editEmployer}
                cancelEditEmployer={pm.cancelEditEmployer}
                confirmDeleteEmployer={pm.confirmDeleteEmployer}
                removeEmployer={pm.removeEmployer}
                selfEmployedInEditMode={pm.selfEmployedInEditMode}
                editSelfEmployed={pm.editSelfEmployed}
                saveSelfEmployed={pm.saveSelfEmployed}
                cancelEditSelfEmployed={pm.cancelEditSelfEmployed}
              />
            )}

            {activeSection === 'health' && (
              <HealthSection
                profileData={pm.profileData}
                handleInputChange={pm.handleInputChange}
                chronicConditionsInEditMode={pm.chronicConditionsInEditMode}
                chronicConditionToDelete={pm.chronicConditionToDelete}
                setChronicConditionToDelete={pm.setChronicConditionToDelete}
                addChronicCondition={pm.addChronicCondition}
                updateChronicCondition={pm.updateChronicCondition}
                saveChronicCondition={pm.saveChronicCondition}
                editChronicCondition={pm.editChronicCondition}
                cancelEditChronicCondition={pm.cancelEditChronicCondition}
                confirmDeleteChronicCondition={pm.confirmDeleteChronicCondition}
                removeChronicCondition={pm.removeChronicCondition}
              />
            )}

            {activeSection === 'family' && (
              <FamilySection
                profileData={pm.profileData}
                familyMembersInEditMode={pm.familyMembersInEditMode}
                familyMemberToDelete={pm.familyMemberToDelete}
                setFamilyMemberToDelete={pm.setFamilyMemberToDelete}
                addFamilyMember={pm.addFamilyMember}
                updateFamilyMember={pm.updateFamilyMember}
                saveFamilyMember={pm.saveFamilyMember}
                editFamilyMember={pm.editFamilyMember}
                cancelEditFamilyMember={pm.cancelEditFamilyMember}
                confirmDeleteFamilyMember={pm.confirmDeleteFamilyMember}
                removeFamilyMember={pm.removeFamilyMember}
              />
            )}

            {activeSection === 'banking' && (
              <BankingSection
                profileData={pm.profileData}
                bankAccountsInEditMode={pm.bankAccountsInEditMode}
                bankAccountToDelete={pm.bankAccountToDelete}
                setBankAccountToDelete={pm.setBankAccountToDelete}
                proofOfBankToDelete={pm.proofOfBankToDelete}
                setProofOfBankToDelete={pm.setProofOfBankToDelete}
                addBankAccount={pm.addBankAccount}
                updateBankAccount={pm.updateBankAccount}
                saveBankAccount={pm.saveBankAccount}
                editBankAccount={pm.editBankAccount}
                cancelEditBankAccount={pm.cancelEditBankAccount}
                confirmDeleteBankAccount={pm.confirmDeleteBankAccount}
                removeBankAccount={pm.removeBankAccount}
                handleProofOfBankUpload={pm.handleProofOfBankUpload}
                confirmDeleteProofOfBank={pm.confirmDeleteProofOfBank}
                removeProofOfBank={pm.removeProofOfBank}
              />
            )}

            {activeSection === 'assets' && (
              <AssetsLiabilitiesSection
                profileData={pm.profileData}
                derivedPolicyAssets={linkedPolicyAssets}
                linkedPolicyAssetsLoading={portfolioSummaryQuery.isLoading}
                linkedPolicyAssetsError={linkedPolicyAssetsError}
                assetsInEditMode={pm.assetsInEditMode}
                liabilitiesInEditMode={pm.liabilitiesInEditMode}
                assetToDelete={pm.assetToDelete}
                setAssetToDelete={pm.setAssetToDelete}
                liabilityToDelete={pm.liabilityToDelete}
                setLiabilityToDelete={pm.setLiabilityToDelete}
                assetDisplayValues={pm.assetDisplayValues}
                setAssetDisplayValues={pm.setAssetDisplayValues}
                liabilityDisplayValues={pm.liabilityDisplayValues}
                setLiabilityDisplayValues={pm.setLiabilityDisplayValues}
                addAsset={pm.addAsset}
                updateAsset={pm.updateAsset}
                saveAsset={pm.saveAsset}
                editAsset={pm.editAsset}
                cancelEditAsset={pm.cancelEditAsset}
                confirmDeleteAsset={pm.confirmDeleteAsset}
                removeAsset={pm.removeAsset}
                addLiability={pm.addLiability}
                updateLiability={pm.updateLiability}
                saveLiability={pm.saveLiability}
                editLiability={pm.editLiability}
                cancelEditLiability={pm.cancelEditLiability}
                confirmDeleteLiability={pm.confirmDeleteLiability}
                removeLiability={pm.removeLiability}
                totalAssets={pm.totalAssets}
                totalLiabilities={pm.totalLiabilities}
                netWorth={pm.netWorth}
              />
            )}

            {activeSection === 'risk' && (
              <RiskProfileSection
                profileData={pm.profileData}
                assessmentStarted={pm.assessmentStarted}
                setAssessmentStarted={pm.setAssessmentStarted}
                updateRiskQuestion={pm.updateRiskQuestion}
                resetRiskAssessment={pm.resetRiskAssessment}
                allQuestionsAnswered={pm.allQuestionsAnswered}
              />
            )}

            {activeSection === 'budgeting' && (
              <BudgetingPage
                netIncome={pm.profileData.netIncome}
                grossIncome={pm.profileData.grossIncome}
              />
            )}
          </div>
        </div>
      </div>

      <UnsavedChangesDialog {...unsavedChangesGuard.dialogProps} />
    </div>
  );
}

export default ProfilePage;
