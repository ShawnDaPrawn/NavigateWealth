import React from 'react';
import { BasePdfLayout } from '../templates/BasePdfLayout';

export const NavigateClientConsentForm = ({ 
  data = {} 
}: { 
  data?: Record<string, unknown> 
}) => {
  const fspList = [
    "AC&E Engineering Underwriting Managers (Pty) Ltd",
    "Alexander Forbes Ltd",
    "Allan Gray (Pty) Ltd",
    "Arrow Underwriting Managers (Pty) Ltd",
    "Auto Trade Underwriting Managers (Pty) Ltd",
    "Bonitas (As Part Of Medscheme (Pty) Ltd)",
    "Brolink (Pty) Ltd",
    "Brightrock Life (Pty) Ltd",
    "Bryte Ltd",
    "Commercial & Industrial Acceptances (Cia) (Pty) Ltd",
    "Constantia Insurance Company (Pty) Ltd",
    "Discovery (Life, Invest, Insure, Health, Gap, Funeral, Vitality Or Bank)",
    "Echelon (Pty) Ltd",
    "Envirosure Underwriting Managers (Pty) Ltd",
    "Fedhealth (As Part Of Medscheme (Pty) Ltd)",
    "Hollard Life Assurance Ltd",
    "King Price Insurance (Pty) Ltd",
    "Liberty Group (Life, Invest, Insure,Gap)",
    "Miway Insurance (Pty) Ltd",
    "Momentum Metropolitan (Life, Invest, Insure, Health, Gap, Funeral, Multiply)",
    "Mua Insurance Acceptances (Pty) Ltd",
    "Old Mutual Life (Life, Invest, Insure)",
    "Sanlam Ltd",
    "Santam Ltd",
    "Stalker Hutchison Admiral (Pty) Ltd",
    "Stanlib Group Of Companies",
    "Stratum Benefits (Pty) Ltd"
  ];

  // PAGE 1 CONTENT
  const Page1 = (
    <div className="contents">
      {/* 1. INTRODUCTION */}
      <section className="section">
        <div className="section-head">
          <span className="num">1.</span><h2>INTRODUCTION</h2>
        </div>
        <div className="text-[9.5px] leading-relaxed space-y-2 text-justify">
          <p>
            Sound and proper financial advice can only be provided with full disclosure of relevant information relating to personal and private information for the purposes of determining and advising on my/our financial situation and financial product experience and objective, in the process of acquiring, servicing or maintain any financial services product/s, including but not limited to any information relating to or interest in any financial services product or service, with any long term insurer, investment manager, health insurer, short term insurer or any other financial institution.
          </p>
          <p>
            My/our interests shall be best served if that information is made available to authorised financial service providers with a legitimate interest in receiving such information for those purposes. I accordingly confirm, for the purposes of providing the said sound and proper financial advice to me, that full permission and authority is granted to:
          </p>
          <p>
            <strong>Mr. Shawn Francisco</strong> of <strong>Navigate Wealth</strong>, as well as his three administrative assistants to obtain any and all such information via The Financial Services Exchange (Pty) Ltd, trading as Astute, or any other institution providing a mechanism for the transmission of such information.
          </p>
          <p>
            I herewith give consent for the long-term insurer, short-term insurer, health insurer, investment manager or any other financial institution possessing such information to release such information to the said Authorised User and I confirm that such Authorised User shall be acting on my behalf or in my interest and I waive any right to privacy only for the purposes as stated above. I further acknowledge that this consent to obtain information on my behalf will remain effective until canceled by me/us in writing.
          </p>
        </div>
      </section>

      {/* 2. CLIENT DETAILS */}
      <section className="section">
        <div className="section-head">
          <span className="num">2.</span><h2>CLIENT DETAILS</h2>
        </div>
        
        <h3 className="text-[9.5px] font-bold mb-1.5 uppercase">Main member</h3>
        <table>
          <tbody>
            <tr><th>First name</th><td className="field">{data.firstName || ''}</td></tr>
            <tr><th>Surname</th><td className="field">{data.lastName || ''}</td></tr>
            <tr><th>Identity number</th><td className="field">{data.idNumber || ''}</td></tr>
            <tr><th>Cellphone number</th><td className="field">{data.mobile || ''}</td></tr>
            <tr><th>Email address</th><td className="field">{data.email || ''}</td></tr>
            <tr><th>Office landline (optional)</th><td className="field">{data.officeLine || ''}</td></tr>
          </tbody>
        </table>
      </section>

      {/* 3. LEGAL ENTITY DETAILS */}
      <section className="section">
        <div className="section-head">
          <span className="num">3.</span><h2>LEGAL ENTITY DETAILS</h2>
        </div>

        <h3 className="text-[9.5px] font-bold mb-1.5 uppercase">Company, Trust, or Juristic Entity</h3>
        <table>
          <tbody>
            <tr><th>Name of the legal entity</th><td className="field">{data.entityName || ''}</td></tr>
            <tr><th>Trading as (if applicable)</th><td className="field">{data.tradingAs || ''}</td></tr>
            <tr><th>Registration number</th><td className="field">{data.regNumber || ''}</td></tr>
            <tr><th>Email address</th><td className="field">{data.entityEmail || ''}</td></tr>
            <tr><th>Office landline or other contact</th><td className="field">{data.entityContact || ''}</td></tr>
          </tbody>
        </table>
      </section>

      {/* 4. PRODUCT SUPPLIER | COMPANY DETAILS */}
      <section className="section">
        <div className="section-head">
          <span className="num">4.</span><h2>PRODUCT SUPPLIER | COMPANY DETAILS</h2>
        </div>
        
        <p className="text-[9.5px] mb-2">Indicate which financial services providers you hold products with.</p>
        
        <div className="grid grid-cols-2 gap-x-4">
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left bg-gray-50 p-1 border border-gray-200 w-[80%] text-[8px]">Provider Name</th>
                <th className="text-center bg-gray-50 p-1 border border-gray-200 w-[20%] text-[8px]">(X)</th>
              </tr>
            </thead>
            <tbody>
              {fspList.slice(0, 14).map((fsp, i) => (
                <tr key={i}>
                  <td className="p-1 border border-gray-200 text-[8.5px] leading-tight">{fsp}</td>
                  <td className="p-1 border border-gray-200 text-center">
                    <div className="inline-block w-3 h-3 border border-gray-400"></div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left bg-gray-50 p-1 border border-gray-200 w-[80%] text-[8px]">Provider Name</th>
                <th className="text-center bg-gray-50 p-1 border border-gray-200 w-[20%] text-[8px]">(X)</th>
              </tr>
            </thead>
            <tbody>
              {fspList.slice(14).map((fsp, i) => (
                <tr key={i}>
                  <td className="p-1 border border-gray-200 text-[8.5px] leading-tight">{fsp}</td>
                  <td className="p-1 border border-gray-200 text-center">
                    <div className="inline-block w-3 h-3 border border-gray-400"></div>
                  </td>
                </tr>
              ))}
              {/* Fill empty rows to balance if needed */}
               <tr>
                  <td className="p-1 border border-gray-200 text-[8.5px] leading-tight">&nbsp;</td>
                  <td className="p-1 border border-gray-200 text-center">
                    <div className="inline-block w-3 h-3 border border-gray-400"></div>
                  </td>
                </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );

  // PAGE 2 CONTENT
  const Page2 = (
    <div className="contents">
      {/* 5. PRODUCT SUPPLIER | SPECIFY YOUR PROVIDER */}
      <section className="section">
        <div className="section-head">
          <span className="num">5.</span><h2>PRODUCT SUPPLIER | SPECIFY YOUR PROVIDER</h2>
        </div>

        <p className="text-[9.5px] font-bold mb-2">At which Authorised Financial Service Providers do you hold a product/s at?</p>
        
        <table className="w-full">
          <thead>
            <tr>
              <th className="bg-gray-50 p-2 border border-gray-200 text-left w-1/2 text-[9px]">Please name the insurer, asset manager and/or medical aid provider</th>
              <th className="bg-gray-50 p-2 border border-gray-200 text-left w-1/2 text-[9px]">Please specify the type of policy</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="h-8 border border-gray-200"></td>
              <td className="h-8 border border-gray-200"></td>
            </tr>
            <tr>
              <td className="h-8 border border-gray-200"></td>
              <td className="h-8 border border-gray-200"></td>
            </tr>
            <tr>
              <td className="h-8 border border-gray-200"></td>
              <td className="h-8 border border-gray-200"></td>
            </tr>
             <tr>
              <td className="h-8 border border-gray-200"></td>
              <td className="h-8 border border-gray-200"></td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* 6. FAIR COLLECTION NOTICE */}
      <section className="section">
        <div className="section-head">
          <span className="num">6.</span><h2>FAIR COLLECTION NOTICE</h2>
        </div>

        <div className="text-[9.5px] leading-relaxed space-y-4 text-justify">
          <div>
            <h4 className="font-bold mb-1 text-[10px]">6.1 Consent to collect, store and dispose certain information to Direct Financial Planning and their authorised user</h4>
            <div className="space-y-2">
              <p>This Fair Collection Notice ("Notice") explains how Navigate Wealth, (we/us) obtain, use, disclose and otherwise process personal information, which may include health and financial information.</p>
              <p>You hereby consent to the collection, collation, storage and disclosure of the information contained in all sections of the Compliance documentation you signed, for any purpose relating to the rendering of sound and proper financial advice to you, and any additional information you provided to the financial adviser for the purpose of:</p>
              <ul className="list-disc pl-5 space-y-1 marker:text-gray-500">
                <li>Conducting a full needs analysis to determine financial needs;</li>
                <li>Completing comparison quotations;</li>
                <li>Obtaining information from The Financial Services Exchange (Astute) or any other financial institution;</li>
                <li>Doing the necessary administration within the Group.</li>
              </ul>
              <p>All private information will be treated as confidential by the financial adviser, the financial service provider and its authorised users and may not be made public without your written consent.</p>
              
              <p className="font-bold mt-2 text-[9.5px]">Consent to share policy information with the financial adviser</p>
              <p>By signing this Notice, you authorise Navigate Wealth to share your information (including your health information) with your financial adviser during any underwriting process.</p>
            </div>
          </div>

          <div>
            <h4 className="font-bold mb-1 text-[10px]">6.2 General</h4>
            <div className="space-y-2">
              <p>This Notice explains how I, as a representative of Navigate Wealth, obtains, use and disclose your personal information, as is required by the Protection of Personal Information Act (POPIA).</p>
              <p>You have the right to request a copy of the personal information we hold about you. To do this, simply complete the Data Subject Request form on www.navigatewealth.co and specify what information you would like. We will take all reasonable steps to confirm your identity before providing details of your personal information.</p>
              <ul className="list-disc pl-5 space-y-1 marker:text-gray-500">
                <li>Please note that any such access request may be subject to a legally allowable fee.</li>
                <li>You have the right to ask us to update, correct or delete your personal information on. You may do this by contacting us.</li>
                <li>Please note that we may amend this Notice from time to time.</li>
                <li>Acceptance of these terms and conditions is a requirement for rendering financial services to you.</li>
              </ul>
              <p>Where you act on behalf of a minor, an incapacitated person, or a person unable to act on their own, you confirm that you have the authority to do so. Navigate Wealth management herewith further certifies that I am mandated as an authorised representative with Navigate Wealth and that the company has a conflict-of-interest management policy. A copy of this can be made available upon request.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 7. CLIENT DECLARATION */}
      <section className="section">
        <div className="section-head">
          <span className="num">7.</span><h2>CLIENT DECLARATION</h2>
        </div>

        <div className="bg-[#eef2ff] p-4 border border-[#e0e7ff] text-[9.5px]">
          <div className="mb-6">
            I <span className="inline-block border-b border-black w-64 mx-2"></span> confirm that I have read the above notice.
          </div>

          <div className="flex justify-between items-end mb-8 gap-8">
            <div className="flex-1">
              <div className="flex items-end gap-2">
                <span className="whitespace-nowrap">Client signature</span>
                <div className="flex-1 border-b border-black h-8"></div>
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-end gap-2">
                <span className="whitespace-nowrap">Date</span>
                <div className="flex-1 border-b border-black h-8"></div>
              </div>
            </div>
          </div>

          <p className="mb-6 italic">A copy of this consent form will be made available to you within 30 days from the date of signing this document.</p>

          <div className="flex justify-between items-end gap-8">
            <div className="flex-1">
              <div className="flex items-end gap-2">
                <span className="whitespace-nowrap">Adviser signature</span>
                <div className="flex-1 border-b border-black h-8 relative">
                   {/* Placeholder for signature if needed */}
                </div>
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-end gap-2">
                <span className="whitespace-nowrap">Date</span>
                <div className="flex-1 border-b border-black h-8"></div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );

  return (
    <BasePdfLayout 
      docTitle="Client Consent Form"
      issueDate={data.issueDate}
      pages={[Page1, Page2]}
    />
  );
};

export default NavigateClientConsentForm;