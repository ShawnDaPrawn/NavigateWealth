/**
 * The last will and testament, section by section.
 *
 * Split out of `WillPdfView.tsx` (1,396 lines) — twenty-five self-contained
 * section components in two families sharing one file with the viewer.
 */
import { MARITAL_STATUS_LABELS, type WillDataPayload, formatDate } from './willPdfShared';

export function SectionPreamble({ data }: { data: WillDataPayload }) {
  return (
    <div className="section">
      <div className="section-head">
        <span className="num">1.</span>
        <h2>Preamble</h2>
      </div>
      <div className="callout" style={{ marginTop: '2mm' }}>
        <p style={{ fontSize: '9.5px', lineHeight: 1.5 }}>
          I, <strong>{data.personalDetails.fullName || '___________________'}</strong>, Identity
          Number <strong>{data.personalDetails.idNumber || '___________________'}</strong>, born on{' '}
          <strong>{formatDate(data.personalDetails.dateOfBirth)}</strong>, residing at{' '}
          <strong>{data.personalDetails.physicalAddress || '___________________'}</strong>, being of
          sound mind and under no duress, hereby revoke all former wills and testamentary
          dispositions previously made by me and declare this to be my Last Will and Testament.
        </p>
      </div>
    </div>
  );
}

export function SectionPersonalDetails({ data }: { data: WillDataPayload }) {
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
            <th>Marital Status</th>
            <td>{MARITAL_STATUS_LABELS[pd.maritalStatus] || pd.maritalStatus}</td>
          </tr>
          {pd.maritalStatus?.startsWith('married') && pd.spouseName && (
            <tr>
              <th>Spouse</th>
              <td>
                {pd.spouseName}
                {pd.spouseIdNumber ? ` (ID: ${pd.spouseIdNumber})` : ''}
              </td>
            </tr>
          )}
          <tr>
            <th>Physical Address</th>
            <td>{pd.physicalAddress || '-'}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function SectionExecutors({ executors }: { executors: WillDataPayload['executors'] }) {
  if (executors.length === 0) return null;
  return (
    <div className="section">
      <div className="section-head">
        <span className="num">3.</span>
        <h2>Appointment of Executor(s)</h2>
      </div>
      <p style={{ fontSize: '9.5px', lineHeight: 1.5, marginBottom: '2mm' }}>
        I hereby nominate and appoint the following person(s) as executor(s) of this my Last Will
        and Testament:
      </p>
      <table>
        <thead>
          <tr>
            <th style={{ width: '5%' }}>#</th>
            <th style={{ width: '25%' }}>Name</th>
            <th style={{ width: '15%' }}>Type</th>
            <th style={{ width: '20%' }}>ID / Company</th>
            <th style={{ width: '35%' }}>Contact Details</th>
          </tr>
        </thead>
        <tbody>
          {executors.map((exec, idx) => (
            <tr key={exec.id}>
              <td>{idx + 1}</td>
              <td>{exec.name}</td>
              <td>{exec.type === 'professional' ? 'Professional' : 'Individual'}</td>
              <td>{exec.type === 'professional' ? exec.company || '-' : exec.idNumber || '-'}</td>
              <td>{exec.contactDetails || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SectionBeneficiaries({
  beneficiaries,
}: {
  beneficiaries: WillDataPayload['beneficiaries'];
}) {
  if (beneficiaries.length === 0) return null;
  const total = beneficiaries.reduce((s, b) => s + b.percentage, 0);
  return (
    <div className="section">
      <div className="section-head">
        <span className="num">4.</span>
        <h2>Beneficiaries &amp; Distribution of Estate</h2>
      </div>
      <p style={{ fontSize: '9.5px', lineHeight: 1.5, marginBottom: '2mm' }}>
        Subject to the specific bequests herein below, the residue of my estate shall be distributed
        as follows:
      </p>
      <table>
        <thead>
          <tr>
            <th style={{ width: '5%' }}>#</th>
            <th style={{ width: '30%' }}>Name</th>
            <th style={{ width: '20%' }}>ID Number</th>
            <th style={{ width: '20%' }}>Relationship</th>
            <th style={{ width: '12%' }}>Share (%)</th>
          </tr>
        </thead>
        <tbody>
          {beneficiaries.map((ben, idx) => (
            <tr key={ben.id}>
              <td>{idx + 1}</td>
              <td>{ben.name}</td>
              <td>{ben.idNumber || '-'}</td>
              <td>{ben.relationship || '-'}</td>
              <td style={{ textAlign: 'right' }}>{ben.percentage}%</td>
            </tr>
          ))}
          <tr>
            <td colSpan={4} style={{ fontWeight: 700, textAlign: 'right' }}>
              Total
            </td>
            <td
              style={{
                fontWeight: 700,
                textAlign: 'right',
                color: total === 100 ? '#16a34a' : '#dc2626',
              }}
            >
              {total}%
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function SectionGuardians({ guardians }: { guardians: WillDataPayload['guardians'] }) {
  if (guardians.length === 0) return null;
  return (
    <div className="section">
      <div className="section-head">
        <span className="num">5.</span>
        <h2>Guardianship of Minor Children</h2>
      </div>
      <p style={{ fontSize: '9.5px', lineHeight: 1.5, marginBottom: '2mm' }}>
        In the event of my death, I nominate and appoint the following person(s) as guardian(s) of
        my minor children:
      </p>
      <table>
        <thead>
          <tr>
            <th style={{ width: '5%' }}>#</th>
            <th style={{ width: '25%' }}>Name</th>
            <th style={{ width: '15%' }}>ID Number</th>
            <th style={{ width: '15%' }}>Relationship</th>
            <th style={{ width: '40%' }}>Address</th>
          </tr>
        </thead>
        <tbody>
          {guardians.map((g, idx) => (
            <tr key={g.id}>
              <td>{idx + 1}</td>
              <td>{g.name}</td>
              <td>{g.idNumber || '-'}</td>
              <td>{g.relationship || '-'}</td>
              <td>{g.address || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SectionBequests({ bequests }: { bequests: WillDataPayload['specificBequests'] }) {
  if (bequests.length === 0) return null;
  return (
    <div className="section">
      <div className="section-head">
        <span className="num">6.</span>
        <h2>Specific Bequests</h2>
      </div>
      <p style={{ fontSize: '9.5px', lineHeight: 1.5, marginBottom: '2mm' }}>
        I bequeath the following specific items to the persons named below:
      </p>
      <table>
        <thead>
          <tr>
            <th style={{ width: '5%' }}>#</th>
            <th style={{ width: '40%' }}>Item / Description</th>
            <th style={{ width: '30%' }}>Beneficiary</th>
            <th style={{ width: '25%' }}>ID Number</th>
          </tr>
        </thead>
        <tbody>
          {bequests.map((beq, idx) => (
            <tr key={beq.id}>
              <td>{idx + 1}</td>
              <td>{beq.itemDescription}</td>
              <td>{beq.beneficiaryName}</td>
              <td>{beq.beneficiaryIdNumber || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SectionFuneralWishes({
  funeralWishes,
  additionalClauses,
}: {
  funeralWishes: string;
  additionalClauses: string;
}) {
  const hasFuneral = funeralWishes && funeralWishes.trim().length > 0;
  const hasAdditional = additionalClauses && additionalClauses.trim().length > 0;
  if (!hasFuneral && !hasAdditional) return null;

  // Calculate section number dynamically based on what's rendered
  return (
    <div className="section">
      <div className="section-head">
        <span className="num">7.</span>
        <h2>Funeral Wishes &amp; Additional Clauses</h2>
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
      {hasAdditional && (
        <div>
          <p style={{ fontSize: '9.5px', fontWeight: 700, marginBottom: '1mm' }}>
            Additional Clauses:
          </p>
          <div className="callout">
            <p style={{ fontSize: '9.5px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
              {additionalClauses}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export function SectionLegalNotice() {
  return (
    <div className="section">
      <div className="section-head">
        <span className="num">8.</span>
        <h2>Legal Notice</h2>
      </div>
      <div
        className="callout"
        style={{
          background: '#fffbeb',
          borderColor: '#fde68a',
        }}
      >
        <p style={{ fontSize: '9px', lineHeight: 1.5, color: '#92400e' }}>
          <strong>Important:</strong> This document is a draft prepared by Navigate Wealth for
          review purposes only. It does not constitute a valid Last Will and Testament until it has
          been printed, signed by the testator in the presence of two competent witnesses (who must
          also sign), in compliance with the requirements of the Wills Act 7 of 1953 (South Africa).
          Navigate Wealth recommends that the testator seek independent legal advice before
          executing this will.
        </p>
      </div>
    </div>
  );
}

export function SectionSignatures({ data }: { data: WillDataPayload }) {
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
          <p style={{ fontSize: '9px', fontWeight: 700, marginBottom: '1mm' }}>TESTATOR</p>
          <div
            className="signature-box"
            style={{ border: '1px solid #d1d5db', borderRadius: '4px', padding: '4px' }}
          >
            <div className="signature-line" style={{ marginTop: '10mm' }}></div>
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
          <div
            className="signature-box"
            style={{ border: '1px solid #d1d5db', borderRadius: '4px', padding: '4px' }}
          >
            <div className="signature-line" style={{ marginTop: '10mm' }}></div>
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
          <div
            className="signature-box"
            style={{ border: '1px solid #d1d5db', borderRadius: '4px', padding: '4px' }}
          >
            <div className="signature-line" style={{ marginTop: '10mm' }}></div>
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

// ── Living Will Section Components ─────────────────────────────────
