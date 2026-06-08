import { Shield, CheckCircle2, XCircle, PenLine } from 'lucide-react';
import { Label } from '../../../../../ui/label';
import { ReviewSection, SectionProps } from './shared';

export function ConsentSection({ data }: Pick<SectionProps, 'data'>) {
  return (
    <ReviewSection icon={Shield} title="Consent & Agreements">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {[
          { label: 'Terms & Conditions', value: data?.termsAccepted },
          { label: 'POPIA Consent', value: data?.popiaConsent },
          { label: 'Disclosure Acknowledged', value: data?.disclosureAcknowledged },
          { label: 'FAIS Disclosure', value: data?.faisAcknowledged },
          { label: 'Electronic Communications', value: data?.electronicCommunicationConsent },
          { label: 'Marketing Consent', value: data?.communicationConsent },
        ].map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-2.5 p-2.5 rounded-lg bg-gray-50/80 border border-gray-100"
          >
            <div
              className={`h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0 ${item.value ? 'bg-green-100' : 'bg-gray-100'}`}
            >
              {item.value ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
              ) : (
                <XCircle className="h-3.5 w-3.5 text-gray-400" />
              )}
            </div>
            <span
              className={`text-xs ${item.value ? 'text-gray-800 font-medium' : 'text-gray-400'}`}
            >
              {item.label}
            </span>
          </div>
        ))}
      </div>
      {data?.signatureFullName && (
        <div className="mt-4 pt-3 border-t border-gray-100 flex items-center gap-3">
          <PenLine className="h-4 w-4 text-[#6d28d9]" />
          <div>
            <Label className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">
              Digital Signature
            </Label>
            <div className="text-sm font-semibold italic text-gray-900 mt-0.5">
              {data.signatureFullName}
            </div>
          </div>
        </div>
      )}
    </ReviewSection>
  );
}
