import { Button } from '../../../../../ui/button';
import { Loader2 } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { Notice } from '../../../../layout/page';

interface ComplianceRegistrationGateProps {
  clientFirstName: string;
  clientLastName: string;
  resolvedIdNumber: string | null;
  hasIdentification: boolean;
  isRegistering: boolean;
  onRegister: () => void;
}

export function ComplianceRegistrationGate({
  clientFirstName,
  clientLastName,
  resolvedIdNumber,
  hasIdentification,
  isRegistering,
  onRegister,
}: ComplianceRegistrationGateProps) {
  const [, setSearchParams] = useSearchParams();
  const openPersonalDetails = () =>
    setSearchParams(
      (current) => {
        const params = new URLSearchParams(current);
        params.set('ctab', 'personal');
        params.delete('ksec');
        return params;
      },
      { replace: true },
    );

  return (
    <div className="space-y-6">
      {!hasIdentification && (
        <Notice
          kind="attention"
          title="ID number required."
          action={
            <Button variant="outline" size="sm" className="bg-white" onClick={openPersonalDetails}>
              Open personal details
            </Button>
          }
        >
          No valid ID number or passport is on file. Add one to the client&apos;s profile before
          registering them for compliance checks.
        </Notice>
      )}

      {/* Design CM-K-Gate: one plain card, centred. */}
      <section className="rounded-xl border border-nw-line bg-white px-6 py-14 text-center">
        <h3 className="text-base font-semibold text-nw-ink">Registration required</h3>
        <p className="mx-auto mt-2 max-w-sm text-sm text-nw-text-2">
          Register this client with Honeycomb (Beeswax) to run KYC and sanctions checks. Their SA ID
          or passport number is needed.
        </p>
        <Button
          className="mt-4"
          onClick={onRegister}
          disabled={isRegistering || !hasIdentification}
        >
          {isRegistering && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
          {isRegistering ? 'Registering…' : 'Register client'}
        </Button>
        <p className="mt-4 text-xs text-nw-text-3">
          The profile will use {clientFirstName} {clientLastName}
          {resolvedIdNumber ? ', ID ' + resolvedIdNumber : ''}.
        </p>
      </section>
    </div>
  );
}
