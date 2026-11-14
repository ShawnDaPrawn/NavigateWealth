import { Card, CardContent } from '../../../../../ui/card';
import { Button } from '../../../../../ui/button';
import { Shield, Loader2, Link as LinkIcon } from 'lucide-react';
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

      <Card className="border-dashed border-2">
        <CardContent className="py-12 flex flex-col items-center justify-center text-center space-y-4">
          <div className="bg-purple-100 p-4 rounded-full">
            <Shield className="h-12 w-12 text-purple-600" />
          </div>
          <div>
            <h4 className="text-xl font-semibold mb-2">Registration required</h4>
            <p className="text-gray-500 max-w-md mx-auto">
              Register this client with Honeycomb (Beeswax) to run KYC and sanctions checks. Their
              SA ID or passport number is needed.
            </p>
          </div>
          <div className="flex gap-4 pt-4">
            <Button
              onClick={onRegister}
              disabled={isRegistering || !hasIdentification}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isRegistering ? (
                <div className="contents">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Registering…
                </div>
              ) : (
                <div className="contents">
                  <LinkIcon className="mr-2 h-4 w-4" />
                  Register client
                </div>
              )}
            </Button>
          </div>
          <p className="text-xs text-gray-400 mt-4">
            This will create a profile using Name:{' '}
            <strong>
              {clientFirstName} {clientLastName}
            </strong>{' '}
            and ID: <strong>{resolvedIdNumber || 'N/A — update client profile'}</strong>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
