import { Card, CardContent } from '../../../../../ui/card';
import { Button } from '../../../../../ui/button';
import { Shield, AlertTriangle, Loader2, Link as LinkIcon } from 'lucide-react';

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
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Compliance Management</h3>
          <p className="text-sm text-muted-foreground">
            Integration with Beeswax/Honeycomb for KYC and Sanctions Screening
          </p>
        </div>
      </div>

      {!hasIdentification && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">ID Number Required</p>
            <p className="text-sm text-amber-700 mt-1">
              This client does not have a valid ID number or passport number on their profile.
              Please update their profile with a South African ID number or passport number before
              registering with Beeswax.
            </p>
          </div>
        </div>
      )}

      <Card className="border-dashed border-2">
        <CardContent className="py-12 flex flex-col items-center justify-center text-center space-y-4">
          <div className="bg-purple-100 p-4 rounded-full">
            <Shield className="h-12 w-12 text-purple-600" />
          </div>
          <div>
            <h4 className="text-xl font-semibold mb-2">Registration Required</h4>
            <p className="text-gray-500 max-w-md mx-auto">
              To perform compliance checks, this client must first be registered with the
              Beeswax/Honeycomb external compliance service.
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
                  Registering...
                </div>
              ) : (
                <div className="contents">
                  <LinkIcon className="mr-2 h-4 w-4" />
                  Register Client on Beeswax
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
