import React, { useState } from 'react';
import { Label } from '../../../ui/label';
import { Input } from '../../../ui/input';
import { Checkbox } from '../../../ui/checkbox';
import { StepProps } from '../types';
import {
  INPUT_CLASS,
  LABEL_CLASS,
  SECTION_CONTAINER_CLASS,
  SECTION_CONTAINER_SPACED_CLASS,
} from '../form-styles';
import { FileText, Lock, ShieldCheck, Scale, Wifi, PenLine, ChevronDown, ChevronUp, User, MapPin, Briefcase, Target, ExternalLink, Loader2 } from 'lucide-react';
import { useLegalDocumentViewer, LegalDocumentDialog } from '../../../shared/LegalDocumentViewer';

function SectionHeader({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description?: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="h-9 w-9 rounded-lg bg-[#6d28d9]/10 flex items-center justify-center flex-shrink-0">
        <Icon className="h-4.5 w-4.5 text-[#6d28d9]" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">{title}</h3>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string | undefined | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between items-start py-2 gap-4">
      <span className="text-xs text-gray-500 flex-shrink-0">{label}</span>
      <span className="text-xs text-gray-900 font-medium text-right">{value}</span>
    </div>
  );
}

function SummarySection({ icon: Icon, title, children, defaultOpen = false }: { icon: React.ElementType; title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-white hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-2.5">
          <Icon className="h-4 w-4 text-[#6d28d9]" />
          <span className="text-sm font-semibold text-gray-800">{title}</span>
        </div>
        {isOpen ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
      </button>
      {isOpen && (
        <div className="px-4 pb-4 pt-0 border-t border-gray-100 bg-gray-50/70 animate-in fade-in duration-200">
          <div className="divide-y divide-gray-100">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

/** Inline link button to open a legal document in the viewer dialog. */
function LegalLink({
  slug,
  label,
  onView,
  loadingSlug,
}: {
  slug: string;
  label: string;
  onView: (slug: string) => void;
  loadingSlug: string | null;
}) {
  const isLoading = loadingSlug === slug;
  return (
    <button
      type="button"
      onClick={() => onView(slug)}
      className="inline-flex items-center gap-1 text-[#6d28d9] hover:text-[#5b21b6] underline underline-offset-2 decoration-[#6d28d9]/30 hover:decoration-[#5b21b6]/60 transition-colors font-medium"
    >
      {isLoading ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <ExternalLink className="h-3 w-3" />
      )}
      {isLoading ? 'Loading...' : label}
    </button>
  );
}

export function Step5Terms({ data, updateData }: StepProps) {
  const fullName = [data.firstName, data.middleName, data.lastName].filter(Boolean).join(' ');
  const legalViewer = useLegalDocumentViewer();

  // Check if typed signature matches the full legal name (case-insensitive, trimmed)
  const signatureTrimmed = data.signatureFullName.trim().toLowerCase();
  const fullNameTrimmed = fullName.trim().toLowerCase();
  const signatureMatches = signatureTrimmed.length === 0 || signatureTrimmed === fullNameTrimmed;

  return (
    <div className="space-y-10">
      {/* Application Summary */}
      <div>
        <SectionHeader icon={FileText} title="Application Summary" description="Review the information you've provided" />
        <div className={`${SECTION_CONTAINER_CLASS} space-y-3`}>
          <SummarySection icon={User} title="Personal Information" defaultOpen>
            <SummaryRow label="Full Name" value={fullName} />
            {data.preferredName && <SummaryRow label="Known As" value={data.preferredName} />}
            <SummaryRow label="Date of Birth" value={data.dateOfBirth ? new Date(data.dateOfBirth).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' }) : undefined} />
            <SummaryRow label="Gender" value={data.gender} />
            <SummaryRow label="Nationality" value={data.nationality} />
            <SummaryRow label="ID Type" value={data.idType === 'sa_id' ? 'SA ID Number' : data.idType === 'passport' ? 'Passport' : undefined} />
            <SummaryRow label="ID Number" value={data.idNumber ? `${data.idNumber.slice(0, 4)}...${data.idNumber.slice(-3)}` : undefined} />
            <SummaryRow label="Tax Resident" value={data.isSATaxResident === true ? 'Yes' : data.isSATaxResident === false ? 'No' : undefined} />
            <SummaryRow label="Marital Status" value={data.maritalStatus} />
            {data.maritalRegime && <SummaryRow label="Marital Regime" value={data.maritalRegime} />}
            <SummaryRow label="Dependants" value={data.numberOfDependants} />
            {data.spouseFirstName && <SummaryRow label="Spouse" value={`${data.spouseFirstName} ${data.spouseLastName}`} />}
          </SummarySection>

          <SummarySection icon={MapPin} title="Contact Information">
            <SummaryRow label="Email" value={data.emailAddress} />
            <SummaryRow label="Cellphone" value={data.cellphoneNumber} />
            {data.preferredContactMethod && <SummaryRow label="Preferred Method" value={data.preferredContactMethod} />}
            {data.bestTimeToContact && <SummaryRow label="Best Time" value={data.bestTimeToContact} />}
            <SummaryRow label="City" value={data.residentialCity} />
            <SummaryRow label="Province" value={data.residentialProvince} />
            <SummaryRow label="Country" value={data.residentialCountry} />
          </SummarySection>

          <SummarySection icon={Briefcase} title="Employment & Financial">
            <SummaryRow label="Status" value={data.employmentStatus ? data.employmentStatus.charAt(0).toUpperCase() + data.employmentStatus.slice(1).replace('-', ' ') : undefined} />
            {data.jobTitle && <SummaryRow label="Job Title" value={data.jobTitle} />}
            {data.employerName && <SummaryRow label="Employer" value={data.employerName} />}
            <SummaryRow label="Industry" value={data.industry || data.selfEmployedIndustry || undefined} />
            {data.grossMonthlyIncome && <SummaryRow label="Income Range" value={data.grossMonthlyIncome} />}
            {data.monthlyExpensesEstimate && <SummaryRow label="Expenses Range" value={data.monthlyExpensesEstimate} />}
          </SummarySection>

          <SummarySection icon={Target} title="Services & Interests">
            {data.accountReasons.length > 0 && <SummaryRow label="Interested In" value={data.accountReasons.join(', ')} />}
            {data.urgency && (
              <SummaryRow
                label="Timeline"
                value={
                  data.urgency === 'immediately' ? 'Immediately' :
                  data.urgency === 'within_1_month' ? 'Within 1 month' :
                  data.urgency === 'within_3_months' ? 'Within 3 months' :
                  'Just exploring'
                }
              />
            )}
            {data.existingProducts.length > 0 && <SummaryRow label="Existing Products" value={data.existingProducts.join(', ')} />}
          </SummarySection>
        </div>
      </div>

      {/* Legal Agreements */}
      <div>
        <SectionHeader icon={Scale} title="Legal Agreements" description="Please read and accept the following" />
        <div className={SECTION_CONTAINER_SPACED_CLASS}>
          {/* Terms & Conditions */}
          <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex-shrink-0 mt-0.5">
              <FileText className="h-5 w-5 text-gray-500" />
            </div>
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="termsAccepted"
                  checked={data.termsAccepted}
                  onCheckedChange={(checked) => updateData('termsAccepted', checked === true)}
                />
                <Label htmlFor="termsAccepted" className="font-semibold cursor-pointer text-sm text-gray-800">
                  I accept the Terms and Conditions <span className="text-red-500">*</span>
                </Label>
              </div>
              <p className="text-xs text-gray-500 pl-6">
                By creating an account, you agree to Navigate Wealth&apos;s{' '}
                <LegalLink slug="terms-of-use" label="Terms of Service" onView={legalViewer.openDocument} loadingSlug={legalViewer.loadingSlug} />
                {' '}and{' '}
                <LegalLink slug="privacy-notice" label="Privacy Policy" onView={legalViewer.openDocument} loadingSlug={legalViewer.loadingSlug} />.
              </p>
            </div>
          </div>

          {/* POPIA Consent */}
          <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex-shrink-0 mt-0.5">
              <Lock className="h-5 w-5 text-gray-500" />
            </div>
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="popiaConsent"
                  checked={data.popiaConsent}
                  onCheckedChange={(checked) => updateData('popiaConsent', checked === true)}
                />
                <Label htmlFor="popiaConsent" className="font-semibold cursor-pointer text-sm text-gray-800">
                  POPIA Consent <span className="text-red-500">*</span>
                </Label>
              </div>
              <p className="text-xs text-gray-500 pl-6">
                I consent to the processing of my personal information in accordance with the{' '}
                <LegalLink slug="popia-paia-manual" label="Protection of Personal Information Act (POPIA)" onView={legalViewer.openDocument} loadingSlug={legalViewer.loadingSlug} />.
                {' '}View our{' '}
                <LegalLink slug="data-protection-policy" label="Data Protection Policy" onView={legalViewer.openDocument} loadingSlug={legalViewer.loadingSlug} />.
              </p>
            </div>
          </div>

          {/* Disclosure Acknowledgment */}
          <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex-shrink-0 mt-0.5">
              <ShieldCheck className="h-5 w-5 text-gray-500" />
            </div>
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="disclosureAcknowledged"
                  checked={data.disclosureAcknowledged}
                  onCheckedChange={(checked) => updateData('disclosureAcknowledged', checked === true)}
                />
                <Label htmlFor="disclosureAcknowledged" className="font-semibold cursor-pointer text-sm text-gray-800">
                  Disclosure Acknowledgment <span className="text-red-500">*</span>
                </Label>
              </div>
              <p className="text-xs text-gray-500 pl-6">
                I acknowledge that I have read and understood the{' '}
                <LegalLink slug="legal-conditions" label="Legal Conditions & Disclosures" onView={legalViewer.openDocument} loadingSlug={legalViewer.loadingSlug} />
                {' '}and{' '}
                <LegalLink slug="conflict-of-interest" label="Conflict of Interest Policy" onView={legalViewer.openDocument} loadingSlug={legalViewer.loadingSlug} />.
              </p>
            </div>
          </div>

          {/* FAIS Disclosure */}
          <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex-shrink-0 mt-0.5">
              <Scale className="h-5 w-5 text-gray-500" />
            </div>
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="faisAcknowledged"
                  checked={data.faisAcknowledged}
                  onCheckedChange={(checked) => updateData('faisAcknowledged', checked === true)}
                />
                <Label htmlFor="faisAcknowledged" className="font-semibold cursor-pointer text-sm text-gray-800">
                  FAIS Disclosure <span className="text-red-500">*</span>
                </Label>
              </div>
              <p className="text-xs text-gray-500 pl-6">
                I acknowledge that Navigate Wealth is an authorised financial services provider and that I have been informed of my rights under the{' '}
                <LegalLink slug="fais-disclosure" label="Financial Advisory and Intermediary Services (FAIS) Act" onView={legalViewer.openDocument} loadingSlug={legalViewer.loadingSlug} />.
              </p>
            </div>
          </div>

          {/* Electronic Communication */}
          <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex-shrink-0 mt-0.5">
              <Wifi className="h-5 w-5 text-gray-500" />
            </div>
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="electronicCommunicationConsent"
                  checked={data.electronicCommunicationConsent}
                  onCheckedChange={(checked) => updateData('electronicCommunicationConsent', checked === true)}
                />
                <Label htmlFor="electronicCommunicationConsent" className="font-semibold cursor-pointer text-sm text-gray-800">
                  Electronic Communication Consent
                </Label>
              </div>
              <p className="text-xs text-gray-500 pl-6">
                I consent to receiving documents, statements, and official correspondence electronically rather than by post.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Marketing Opt-in */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <Checkbox
            id="communicationConsent"
            checked={data.communicationConsent}
            onCheckedChange={(checked) => updateData('communicationConsent', checked === true)}
          />
          <Label htmlFor="communicationConsent" className="font-semibold cursor-pointer text-sm text-gray-800">
            I would like to receive marketing communications, newsletters, and market updates
          </Label>
        </div>
        <p className="text-xs text-gray-400 mt-2 pl-7">
          You can unsubscribe at any time. This is separate from transactional communications about your account.
        </p>
      </div>

      {/* Digital Signature */}
      <div>
        <SectionHeader icon={PenLine} title="Digital Signature" description="Type your full legal name exactly as shown above to confirm this application" />
        <div className={SECTION_CONTAINER_CLASS}>
          <Label htmlFor="signatureFullName" className={LABEL_CLASS}>
            Full Legal Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="signatureFullName"
            value={data.signatureFullName}
            onChange={(e) => updateData('signatureFullName', e.target.value)}
            placeholder={fullName || 'Type your full name as it appears above'}
            className={`${INPUT_CLASS} text-base font-medium italic ${
              data.signatureFullName.trim() && !signatureMatches
                ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
                : ''
            }`}
          />
          {data.signatureFullName.trim() && !signatureMatches ? (
            <p className="text-xs text-red-500 mt-2">
              Your signature must match your full name: <span className="font-semibold">{fullName}</span>
            </p>
          ) : (
            <p className="text-xs text-gray-400 mt-3">
              By typing your name above and submitting this application, you confirm that all information provided is true and accurate to the best of your knowledge.
            </p>
          )}
        </div>
      </div>

      {/* Legal Document Viewer Dialog */}
      <LegalDocumentDialog
        open={legalViewer.viewerOpen}
        onOpenChange={legalViewer.setViewerOpen}
        document={legalViewer.viewerDocument}
        onPrint={legalViewer.handlePrint}
      />
    </div>
  );
}