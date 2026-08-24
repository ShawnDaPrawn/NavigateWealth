/**
 * The living will, section by section.
 *
 * Split out of `WillPdfView.tsx` (1,396 lines) — twenty-five self-contained
 * section components in two families sharing one file with the viewer.
 */
import { type LivingWillDataPayload, formatDate } from './willPdfShared';

const TREATMENT_PREF_LABELS: Record<string, string> = {
  accept: 'Accept',
  refuse: 'Refuse',
  limited: 'Limited Trial',
};

export function LivingWillPreamble({ data }: { data: LivingWillDataPayload }) {
  return (
    <div className="section">
      <div className="section-head">
        <span className="num">1.</span>
        <h2>Declaration</h2>
      </div>
      <div className="callout" style={{ marginTop: '2mm' }}>
        <p style={{ fontSize: '9.5px', lineHeight: 1.5 }}>
          I, <strong>{data.personalDetails.fullName || '___________________'}</strong>, Identity
          Number <strong>{data.personalDetails.idNumber || '___________________'}</strong>, born on{' '}
          <strong>{formatDate(data.personalDetails.dateOfBirth)}</strong>, residing at{' '}
          <strong>{data.personalDetails.physicalAddress || '___________________'}</strong>, being of
          sound and disposing mind and memory, make this Living Will to express my wishes regarding
          medical treatment and end-of-life care in the event that I am unable to communicate my
          decisions.
        </p>
      </div>
    </div>
  );
}

export function LivingWillPersonalDetails({ data }: { data: LivingWillDataPayload }) {
  const pd = data.personalDetails;
  return (
    <div className="section">
      <div className="section-head">
        <span className="num">2.</span>
        <h2>Personal Information</h2>
      </div>
      <table>
        <tbody>
          <tr>
            <th>Full Legal Name</th>
            <td>{pd.fullName || '-'}</td>
          </tr>
          <tr>
            <th>Identity Number</th>
            <td>{pd.idNumber || '-'}</td>
          </tr>
          <tr>
            <th>Date of Birth</th>
            <td>{formatDate(pd.dateOfBirth)}</td>
          </tr>
          <tr>
            <th>Physical Address</th>
            <td>{pd.physicalAddress || '-'}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function SectionHealthcareAgents({
  agents,
}: {
  agents: LivingWillDataPayload['healthcareAgents'];
}) {
  if (!agents || agents.length === 0) return null;
  return (
    <div className="section">
      <div className="section-head">
        <span className="num">3.</span>
        <h2>Healthcare Agent / Proxy</h2>
      </div>
      <p style={{ fontSize: '9.5px', lineHeight: 1.5, marginBottom: '2mm' }}>
        I appoint the following person(s) to make healthcare decisions on my behalf:
      </p>
      <table>
        <thead>
          <tr>
            <th style={{ width: '5%' }}>#</th>
            <th style={{ width: '22%' }}>Name</th>
            <th style={{ width: '15%' }}>ID Number</th>
            <th style={{ width: '15%' }}>Relationship</th>
            <th style={{ width: '25%' }}>Contact</th>
            <th style={{ width: '12%' }}>Priority</th>
          </tr>
        </thead>
        <tbody>
          {agents.map((a, idx) => (
            <tr key={a.id}>
              <td>{idx + 1}</td>
              <td>{a.name}</td>
              <td>{a.idNumber || '-'}</td>
              <td>{a.relationship || '-'}</td>
              <td>{a.contactDetails || '-'}</td>
              <td>{a.isPrimary ? 'Primary' : 'Alternate'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SectionTreatmentPreferences({
  treatment,
}: {
  treatment: LivingWillDataPayload['lifeSustainingTreatment'];
}) {
  return (
    <div className="section">
      <div className="section-head">
        <span className="num">4.</span>
        <h2>Life-Sustaining Treatment Preferences</h2>
      </div>
      <p style={{ fontSize: '9.5px', lineHeight: 1.5, marginBottom: '2mm' }}>
        In the event of a terminal condition, persistent vegetative state, or irreversible coma:
      </p>
      <table>
        <tbody>
          <tr>
            <th>Mechanical Ventilation</th>
            <td>{TREATMENT_PREF_LABELS[treatment.ventilator] || '-'}</td>
          </tr>
          <tr>
            <th>CPR</th>
            <td>{TREATMENT_PREF_LABELS[treatment.cpr] || '-'}</td>
          </tr>
          <tr>
            <th>Artificial Nutrition &amp; Hydration</th>
            <td>{TREATMENT_PREF_LABELS[treatment.artificialNutrition] || '-'}</td>
          </tr>
          <tr>
            <th>Dialysis</th>
            <td>{TREATMENT_PREF_LABELS[treatment.dialysis] || '-'}</td>
          </tr>
          <tr>
            <th>Antibiotics</th>
            <td>{TREATMENT_PREF_LABELS[treatment.antibiotics] || '-'}</td>
          </tr>
        </tbody>
      </table>
      {treatment.additionalInstructions && (
        <div style={{ marginTop: '2mm' }}>
          <p style={{ fontSize: '9.5px', fontWeight: 700, marginBottom: '1mm' }}>
            Additional Instructions:
          </p>
          <div className="callout">
            <p style={{ fontSize: '9.5px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
              {treatment.additionalInstructions}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export function SectionPainManagement({
  painMgmt,
}: {
  painMgmt: LivingWillDataPayload['painManagement'];
}) {
  return (
    <div className="section">
      <div className="section-head">
        <span className="num">5.</span>
        <h2>Pain Management &amp; Comfort Care</h2>
      </div>
      <table>
        <tbody>
          <tr>
            <th>Comfort Care Only</th>
            <td>{painMgmt.comfortCareOnly ? 'Yes' : 'No'}</td>
          </tr>
          <tr>
            <th>Maximum Pain Relief</th>
            <td>{painMgmt.maximumPainRelief ? 'Yes' : 'No'}</td>
          </tr>
        </tbody>
      </table>
      {painMgmt.additionalInstructions && (
        <div style={{ marginTop: '2mm' }}>
          <p style={{ fontSize: '9.5px', fontWeight: 700, marginBottom: '1mm' }}>
            Additional Instructions:
          </p>
          <div className="callout">
            <p style={{ fontSize: '9.5px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
              {painMgmt.additionalInstructions}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export function SectionOrganDonation({
  donation,
}: {
  donation: LivingWillDataPayload['organDonation'];
}) {
  const donationTypeLabel =
    donation.donationType === 'all'
      ? 'All organs and tissues'
      : donation.donationType === 'specific'
        ? 'Specific organs only'
        : 'None';
  return (
    <div className="section">
      <div className="section-head">
        <span className="num">6.</span>
        <h2>Organ Donation</h2>
      </div>
      <table>
        <tbody>
          <tr>
            <th>Organ Donor</th>
            <td>{donation.isDonor ? 'Yes' : 'No'}</td>
          </tr>
          {donation.isDonor && (
            <tr>
              <th>Donation Type</th>
              <td>{donationTypeLabel}</td>
            </tr>
          )}
          {donation.donationType === 'specific' && donation.specificOrgans && (
            <tr>
              <th>Specific Organs</th>
              <td>{donation.specificOrgans}</td>
            </tr>
          )}
        </tbody>
      </table>
      {donation.additionalInstructions && (
        <div style={{ marginTop: '2mm' }}>
          <div className="callout">
            <p style={{ fontSize: '9.5px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
              {donation.additionalInstructions}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export function SectionLivingWillWishes({
  funeralWishes,
  additionalDirectives,
}: {
  funeralWishes: string;
  additionalDirectives: string;
}) {
  const hasFuneral = funeralWishes && funeralWishes.trim().length > 0;
  const hasDirectives = additionalDirectives && additionalDirectives.trim().length > 0;
  if (!hasFuneral && !hasDirectives) return null;
  return (
    <div className="section">
      <div className="section-head">
        <span className="num">7.</span>
        <h2>Funeral &amp; End-of-Life Wishes</h2>
      </div>
      {hasFuneral && (
        <div style={{ marginBottom: '3mm' }}>
          <p style={{ fontSize: '9.5px', fontWeight: 700, marginBottom: '1mm' }}>Funeral Wishes:</p>
          <div className="callout">
            <p style={{ fontSize: '9.5px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
              {funeralWishes}
            </p>
          </div>
        </div>
      )}
      {hasDirectives && (
        <div>
          <p style={{ fontSize: '9.5px', fontWeight: 700, marginBottom: '1mm' }}>
            Additional Directives:
          </p>
          <div className="callout">
            <p style={{ fontSize: '9.5px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
              {additionalDirectives}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export function LivingWillLegalNotice() {
  return (
    <div className="section">
      <div className="section-head">
        <span className="num">8.</span>
        <h2>Legal Notice</h2>
      </div>
      <div className="callout" style={{ background: '#fffbeb', borderColor: '#fde68a' }}>
        <p style={{ fontSize: '9px', lineHeight: 1.5, color: '#92400e' }}>
          <strong>Important:</strong> This document is a draft prepared by Navigate Wealth for
          review purposes only. It does not constitute a valid Living Will until it has been
          printed, signed by the declarant in the presence of two competent witnesses (who must also
          sign). Navigate Wealth recommends that the declarant seek independent legal advice before
          executing this living will.
        </p>
      </div>
    </div>
  );
}

export function LivingWillSignatures({ data }: { data: LivingWillDataPayload }) {
  return (
    <div className="section" style={{ marginTop: '8mm' }}>
      <div className="section-head">
        <span className="num">9.</span>
        <h2>Signatures</h2>
      </div>
      <p style={{ fontSize: '9.5px', lineHeight: 1.5, marginBottom: '4mm' }}>
        Signed at _________________________ on this _________ day of _________________________
        20______
      </p>
      <div
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8mm', marginTop: '4mm' }}
      >
        <div>
          <p style={{ fontSize: '9px', fontWeight: 700, marginBottom: '1mm' }}>DECLARANT</p>
          <div style={{ border: '1px solid #d1d5db', borderRadius: '4px', padding: '4px' }}>
            <div style={{ marginTop: '10mm', borderBottom: '1px solid #000' }}></div>
          </div>
          <p style={{ fontSize: '8.5px', color: '#6b7280', marginTop: '1mm' }}>
            {data.personalDetails.fullName || 'Full Name'}
          </p>
        </div>
        <div></div>
      </div>
      <div
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8mm', marginTop: '6mm' }}
      >
        <div>
          <p style={{ fontSize: '9px', fontWeight: 700, marginBottom: '1mm' }}>WITNESS 1</p>
          <div style={{ border: '1px solid #d1d5db', borderRadius: '4px', padding: '4px' }}>
            <div style={{ marginTop: '10mm', borderBottom: '1px solid #000' }}></div>
          </div>
          <p style={{ fontSize: '8.5px', color: '#6b7280', marginTop: '1mm' }}>
            Full Name: _______________________________
          </p>
          <p style={{ fontSize: '8.5px', color: '#6b7280' }}>
            ID Number: _______________________________
          </p>
        </div>
        <div>
          <p style={{ fontSize: '9px', fontWeight: 700, marginBottom: '1mm' }}>WITNESS 2</p>
          <div style={{ border: '1px solid #d1d5db', borderRadius: '4px', padding: '4px' }}>
            <div style={{ marginTop: '10mm', borderBottom: '1px solid #000' }}></div>
          </div>
          <p style={{ fontSize: '8.5px', color: '#6b7280', marginTop: '1mm' }}>
            Full Name: _______________________________
          </p>
          <p style={{ fontSize: '8.5px', color: '#6b7280' }}>
            ID Number: _______________________________
          </p>
        </div>
      </div>
    </div>
  );
}
