import React from 'react';
import { BasePdfLayout } from '../templates/BasePdfLayout';

export const ClientConsentForm = ({ 
  data = {} 
}: { 
  data?: Record<string, unknown> 
}) => {
  return (
    <BasePdfLayout 
      docTitle="Client Consent Form"
      formCode="NW_CONSENT_01"
      issueDate={data.issueDate}
      version="1.0"
    >
        <section className="section">
            <div className="section-head">
              <span className="num">1.</span><h2>Introduction</h2>
            </div>
            <div className="callout">
              Sound and appropriate financial advice can only be provided with full disclosure of relevant personal and financial information.
              This form records your consent for Navigate Wealth to process such information strictly for advice and servicing.
            </div>
          </section>

          <section className="section">
            <div className="section-head">
              <span className="num">2.</span><h2>Client Details</h2>
            </div>
            <table>
              <tbody>
                <tr><th>First Name</th><td className="field">{data.firstName || ''}</td></tr>
                <tr><th>Surname</th><td className="field">{data.lastName || ''}</td></tr>
                <tr><th>ID / Passport Number</th><td className="field">{data.idNumber || ''}</td></tr>
                <tr><th>Email Address</th><td className="field">{data.email || ''}</td></tr>
                <tr><th>Mobile Number</th><td className="field">{data.mobile || ''}</td></tr>
              </tbody>
            </table>
          </section>

          <section className="section">
            <div className="section-head">
              <span className="num">3.</span><h2>Client Consents</h2>
            </div>
            <table>
              <tbody>
                <tr><td><span className="checkbox"></span>I consent to Navigate Wealth processing my personal information.</td></tr>
                <tr><td><span className="checkbox"></span>I consent to information sharing with product providers where required.</td></tr>
                <tr><td><span className="checkbox"></span>I confirm that the information provided is accurate and complete.</td></tr>
              </tbody>
            </table>
          </section>

          <section className="section">
            <div className="section-head">
              <span className="num">4.</span><h2>Signatures</h2>
            </div>
            <table>
              <tbody>
                <tr><th>Client Full Name</th><td className="field"></td></tr>
                <tr><th>Client Signature</th><td className="signature-box"></td></tr>
                <tr><th>Date</th><td className="field"></td></tr>
                <tr><th>Adviser Signature</th><td className="signature-box"></td></tr>
              </tbody>
            </table>
          </section>
    </BasePdfLayout>
  );
};

export default ClientConsentForm;